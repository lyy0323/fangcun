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
    if _STATS_AVAILABLE and request.path.startswith("/api/") and not request.path.startswith("/api/_") and response.status_code < 400:
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
    'export_image', 'copy_text',
    'create_board', 'delete_board',
    'import_poem', 'import_boards', 'export_boards', 'import_ciyun',
    'create_folder', 'delete_folder', 'move_board',
    'add_inspiration', 'toggle_immersive',
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
