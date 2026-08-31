#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
南洋吟游·诗词创作画布 — Flask 后端
用法: python app.py
端口: 5050

音韵检测由独立服务提供（默认 checker.sjtuguoxue.space，可通过 CHECKER_URL 配置）。
本服务负责：释义查询、词库搜索、典故、统计、埋点。
"""

import json, os, sys, hashlib, time
from datetime import datetime, timezone, timedelta

from flask import Flask, request, jsonify, g, redirect
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

# ============================================================================
# 可选模块：统计/埋点（无 DB 时静默跳过）
# ============================================================================

try:
    from api_keys import record_call, get_route_stats
    _STATS_AVAILABLE = True
except Exception:
    _STATS_AVAILABLE = False
    def record_call(source, route): pass
    def get_route_stats(date=None): return []

_UTC8 = timezone(timedelta(hours=8))

# ============================================================================
# 初始化
# ============================================================================

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "*"}})

# --- 限流（默认关闭，设置 RATELIMIT_ENABLED=1 开启）---
_RATELIMIT_ENABLED = os.environ.get("RATELIMIT_ENABLED", "0") == "1"
limiter = Limiter(
    get_remote_address,
    app=app,
    default_limits=["60 per minute"] if _RATELIMIT_ENABLED else [],
    storage_uri="memory://",
)
if not _RATELIMIT_ENABLED:
    limiter.enabled = False

VALID_MODES = {"head", "tail", "pair", "tongwei"}
MAX_PARAM_LENGTH = 2000

CFG = os.environ.get("FANGCUN_CONFIG_DIR", "static/config")

print("[App] 加载数据 ...")

with open(f"{CFG}/t2s_map.json", "r") as f:
    T2S_MAP = json.load(f)

import dict_db

print(f"[App] 就绪: 词库→{'DB' if dict_db.POSTGRES_URL else 'JSON'}, "
      f"限流→{'开' if _RATELIMIT_ENABLED else '关'}, "
      f"统计→{'开' if _STATS_AVAILABLE else '关'}")

# ============================================================================
# 中间件
# ============================================================================

@app.before_request
def validate_input():
    """输入校验（无认证）"""
    if not request.path.startswith("/api/"):
        return None
    for val in request.args.values():
        if len(val) > MAX_PARAM_LENGTH:
            return jsonify({"error": f"参数长度超限 (最大 {MAX_PARAM_LENGTH} 字符)"}), 400
    if request.is_json and request.content_length and request.content_length > 50000:
        return jsonify({"error": "请求体过大 (最大 50KB)"}), 400
    mode = request.args.get("mode")
    if mode and mode not in VALID_MODES:
        return jsonify({"error": f"无效模式: {mode}，可选: {', '.join(sorted(VALID_MODES))}"}), 400
    return None


@app.after_request
def track_api_call(response):
    """记录 API 调用统计（可选）"""
    if _STATS_AVAILABLE and request.path.startswith("/api/") and not request.path.startswith("/api/_") and not request.path.startswith("/api/stats/") and response.status_code < 400:
        try:
            record_call("api", request.path)
        except Exception:
            pass
    return response


@app.after_request
def add_security_headers(response):
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    return response


# ============================================================================
# 辅助函数
# ============================================================================

def _t2s(ch: str) -> str:
    return T2S_MAP.get(ch, ch)

def _lookup_definitions(ch: str):
    defs = dict_db.lookup_definitions(ch)
    if defs:
        return defs
    simplified = _t2s(ch)
    if simplified != ch:
        return dict_db.lookup_definitions(simplified)
    return None

# ============================================================================
# API 路由
# ============================================================================

# ---------- GET /api/char/definitions ----------

@app.route("/api/char/definitions")
def char_definitions():
    ch = request.args.get("char", "")
    defs = _lookup_definitions(ch)
    return jsonify({"char": ch, "definitions": defs or []})

# ---------- GET /api/dictionary/search ----------

@app.route("/api/dictionary/search")
def dict_search():
    term_raw = request.args.get("term", "")
    term = ''.join(_t2s(c) for c in term_raw)
    mode = request.args.get("mode", "head")
    length = request.args.get("length", "2")
    tone = request.args.get("tone", "all")

    if mode == "pair":
        result = dict_db.lookup_pairs(term)
    elif mode == "tongwei":
        result = dict_db.lookup_tongwei(term)
    elif mode in ("head", "tail"):
        result = dict_db.lookup_phrases(term, mode, length, tone)
    else:
        return jsonify({"error": f"无效模式: {mode}"}), 400

    limit = request.args.get("limit")
    offset = request.args.get("offset")
    if isinstance(result, list) and (limit is not None or offset is not None):
        o = int(offset) if offset else 0
        if limit is not None:
            result = result[o:o + int(limit)]
        else:
            result = result[o:]

    return jsonify(result)

# ---------- GET /api/dictionary/allusion ----------

def _sort_allusion_results(entries: list, term: str) -> list:
    def score(entry):
        w = entry["w"]
        exact = 0 if w == term else 1
        pos = w.find(term) if term in w else len(w)
        length = len(w) if len(w) <= 4 else len(w) + 2
        rc = -min(entry.get("rc", 0), 20)
        return (exact, pos, length, rc)
    return sorted(entries, key=score)

@app.route("/api/dictionary/allusion")
def allusion_search():
    term_raw = request.args.get("term", "")
    term = ''.join(_t2s(c) for c in term_raw)
    limit = min(int(request.args.get("limit", "60")), 200)

    if not term:
        return jsonify([])

    entries = dict_db.lookup_allusions(term, limit)
    entries = _sort_allusion_results(entries, term)
    return jsonify(entries[:limit])

# ============================================================================
# 文档 & 统计
# ============================================================================

@app.route("/docs")
@limiter.exempt
def docs():
    return app.send_static_file("docs.html")

# ---------- 前端埋点（可选）----------

VALID_EVENTS = {
    'export_image', 'copy_image', 'copy_text',
    'create_board', 'delete_board', 'switch_board',
    'import_poem', 'import_boards', 'export_boards', 'import_ciyun',
    'create_folder', 'delete_folder', 'rename_folder', 'sort_folder', 'move_board',
    'add_inspiration', 'toggle_immersive',
    'switch_rhyme_book', 'select_rhyme_category',
    'add_section', 'delete_section', 'move_section',
    'save_image', 'long_press_image', 'switch_theme',
    'fill_date', 'switch_date_format', 'fill_preface', 'fill_footnote', 'fill_author',
    'upload_poem',
    'onboarding_show', 'onboarding_done', 'onboarding_skip',
}

@app.route("/api/_ping", methods=["POST"])
def api_ping():
    data = request.get_json(force=True)
    source = data.get("source", "android")
    route = data.get("route", "")
    if route.startswith("/api/") and not route.startswith("/api/_"):
        record_call(source, route)
    return jsonify({"ok": True})

@app.route("/api/_track", methods=["POST"])
def track_event():
    data = request.get_json(force=True)
    event = data.get("event", "")
    if event not in VALID_EVENTS:
        return jsonify({"error": "invalid event"}), 400
    props = data.get("props", {})
    parts = [f"_event:{event}"]
    for k, v in sorted(props.items()):
        parts.append(f"{k}={v}")
    route = ":".join(parts)
    source = data.get("source", "frontend")
    if source not in ("frontend", "android"):
        source = "frontend"
    record_call(source, route)
    return jsonify({"ok": True})

# ---------- 统计端点 ----------

@app.route("/api/stats/summary")
@limiter.exempt
def stats_summary():
    date = request.args.get("date")
    if not date:
        date = datetime.now(_UTC8).strftime("%Y-%m-%d")
    rows = get_route_stats(date)

    total_api_calls = 0
    total_events = 0
    north_star_events = {
        "export_image": 0,
        "copy_image": 0,
        "copy_text": 0,
    }
    api_calls = {}
    events = {}
    sources = {}

    for r in rows:
        route, count, source = r["route"], r["call_count"], r["source"]
        # checker 透传端点统一视为 api 来源（后端调用），
        # 与前端事件埋点分离、不重复计入其他来源桶
        if route in CHECKER_PROXY_ROUTES:
            source = "api"
        sources[source] = sources.get(source, 0) + count

        if route.startswith("_event:"):
            total_events += count
            event_name = route.split(":")[1] if ":" in route[7:] else route[7:]
            events[event_name] = events.get(event_name, 0) + count
            if event_name in north_star_events:
                north_star_events[event_name] += count
        else:
            total_api_calls += count
            short = route.replace("/api/", "", 1) if route.startswith("/api/") else route
            api_calls[short] = api_calls.get(short, 0) + count

    def _sorted_desc(d):
        return dict(sorted(d.items(), key=lambda x: x[1], reverse=True))

    return jsonify({
        "date": date,
        **north_star_events,
        "north_star_total": sum(north_star_events.values()),
        "total_api_calls": total_api_calls,
        "total_events": total_events,
        "api_calls": _sorted_desc(api_calls),
        "events": _sorted_desc(events),
        "sources": _sorted_desc(sources),
    })


@app.route("/api/_stats/routes")
@limiter.exempt
def stats_routes():
    date = request.args.get("date")
    return jsonify(get_route_stats(date))

@app.route("/api/_stats/keys")
@limiter.exempt
def stats_keys():
    return jsonify([])

@app.route("/dashboard")
@limiter.exempt
def dashboard():
    return app.send_static_file("dashboard.html")

# ---------- 音韵检测代理（→ checker 服务）----------
# 前端对 checker 端点的调用统一经本服务透传，使调用量计入后端统计：
#   - 生产 Web（Vercel）不再于边缘直接转发到 checker（见 vercel.json）
#   - Android 经本地 Flask 透传（原本直连远程 checker，调用量丢失）
# 透传路由走 track_api_call 统计（/api/* 且非 /api/_，状态 < 400）。

CHECKER_URL = os.environ.get("CHECKER_URL", "https://checker.sjtuguoxue.space")

# checker 透传端点：统计归一为 api 来源（后端调用），不计入前端事件/其他来源桶
CHECKER_PROXY_ROUTES = {
    "/api/validate_meter", "/api/free_rhyme",
    "/api/rhyme/lookup", "/api/rhyme/list",
    "/api/rules/list", "/api/char/lookup",
}


def _checker_proxy_ssl():
    """Android/部分环境需要 certifi 根证书；不可用时退回系统默认。"""
    try:
        import ssl
        import certifi
        return ssl.create_default_context(cafile=certifi.where())
    except Exception:
        return None


def _proxy_checker(path: str):
    import urllib.request, urllib.error
    from urllib.parse import quote
    url = f"{CHECKER_URL}{path}"
    if request.query_string:
        # 入站 query 可能含未转义的非 ASCII（浏览器已转义，但 curl/CLI 可能直传中文），
        # 统一百分号编码；safe 保留 = & 与已存在的 %XX 序列（避免二次编码）。
        url += "?" + quote(request.query_string.decode(), safe="=&%")
    body = request.get_data() if request.method in ("POST", "PUT", "PATCH") else None
    req = urllib.request.Request(
        url,
        data=body,
        headers={"Content-Type": request.headers.get("Content-Type", "application/json")},
        method=request.method,
    )
    ctx = _checker_proxy_ssl()
    try:
        opener = urllib.request.urlopen(req, timeout=30, context=ctx) if ctx else urllib.request.urlopen(req, timeout=30)
        with opener as resp:
            return app.response_class(
                resp.read(), status=resp.status,
                mimetype=resp.headers.get("Content-Type", "application/json"),
            )
    except urllib.error.HTTPError as e:
        return app.response_class(
            e.read(), status=e.code,
            mimetype=e.headers.get("Content-Type", "application/json"),
        )
    except Exception as e:
        return jsonify({"error": f"checker 请求失败: {e}"}), 502


@app.route("/api/validate_meter", methods=["POST"])
@limiter.exempt
def proxy_validate_meter():
    return _proxy_checker("/api/validate_meter")


@app.route("/api/free_rhyme", methods=["POST"])
@limiter.exempt
def proxy_free_rhyme():
    return _proxy_checker("/api/free_rhyme")


@app.route("/api/rhyme/lookup")
@limiter.exempt
def proxy_rhyme_lookup():
    return _proxy_checker("/api/rhyme/lookup")


@app.route("/api/rhyme/list")
@limiter.exempt
def proxy_rhyme_list():
    return _proxy_checker("/api/rhyme/list")


@app.route("/api/rules/list")
@limiter.exempt
def proxy_rules_list():
    return _proxy_checker("/api/rules/list")


@app.route("/api/char/lookup")
@limiter.exempt
def proxy_char_lookup():
    return _proxy_checker("/api/char/lookup")


# ---------- 上传代理（绕过 CORS）----------

@app.route("/api/_proxy/submit", methods=["POST"])
@limiter.exempt
def proxy_submit():
    import urllib.request
    body = request.get_json(force=True, silent=True) or {}
    print(f"[proxy_submit] body: {json.dumps(body, ensure_ascii=False)[:500]}, content_length: {request.content_length}")
    data = json.dumps(body).encode()
    auth = request.headers.get("Authorization", "")
    try:
        req = urllib.request.Request(
            "https://sjtuguoxue.space/api/submit/",
            data=data,
            headers={"Content-Type": "application/json", "Authorization": auth},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=30) as resp:
            result = resp.read()
            return app.response_class(result, status=resp.status, mimetype="application/json")
    except urllib.error.HTTPError as e:
        result = e.read()
        return app.response_class(result, status=e.code, mimetype="application/json")
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 502

# ============================================================================
# APK 下载代理（可选，需配置 CDN_AUTH_KEY）
# ============================================================================

def _sign_cdn_url(path: str, key: str, domain: str, expire_sec: int = 3600) -> str:
    ts = int(time.time()) + expire_sec
    rand = os.urandom(16).hex()
    uid = "0"
    s = f"{path}-{ts}-{rand}-{uid}-{key}"
    h = hashlib.md5(s.encode()).hexdigest()
    return f"{domain}{path}?auth_key={ts}-{rand}-{uid}-{h}"

@app.route("/download/android")
@limiter.exempt
def download_android():
    cdn_domain = os.environ.get("CDN_DOMAIN", "").strip()
    apk_path = os.environ.get("APK_PATH", "").strip()
    cdn_key = os.environ.get("CDN_AUTH_KEY", "").strip()
    if not cdn_key or not cdn_domain:
        return "Download not configured", 503
    url = _sign_cdn_url(apk_path, cdn_key, cdn_domain, expire_sec=3600)
    return redirect(url)

# ============================================================================
# 入口
# ============================================================================

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5050, debug=False)
