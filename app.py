#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
南洋吟游·诗词创作画布 — Flask 后端
用法: python app.py
端口: 5050
"""

import json, os, sys

from flask import Flask, request, jsonify, g
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

import config_loader
from config_loader import RuleSet, RhymeBook
from checker import PoetryChecker, CheckResult
from api_keys import verify_key, record_call, get_route_stats, list_keys_summary

# ============================================================================
# 初始化
# ============================================================================

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "*"}})

# --- 限流 ---
# Serverless 环境每个实例独立，使用内存即可
limiter = Limiter(
    get_remote_address,
    app=app,
    default_limits=["60 per minute"],
    storage_uri="memory://",
)

# --- 认证开关 (FANGCUN_AUTH_DISABLED=1 关闭认证，用于本地开发) ---
AUTH_DISABLED = os.environ.get("FANGCUN_AUTH_DISABLED", "0") == "1"

# --- 合法枚举值 ---
VALID_GENRES = {"Shi", "Ci", "Free"}
VALID_BOOKS = {"Pingshuiyun", "Cilinzhengyun", "Zhonghua_Tongyun"}
VALID_MODES = {"head", "tail", "pair"}
VALID_TONES = {"P", "Z"}
MAX_PARAM_LENGTH = 2000

CFG = os.environ.get("FANGCUN_CONFIG_DIR", "static/config")

print("[App] 加载数据 ...")

# --- 原始 JSON (字典/词库查询用) ---
with open(f"{CFG}/char_dict.json", "r") as f:
    CHAR_DICT = json.load(f)
with open(f"{CFG}/rhyme_books.json", "r") as f:
    RHYME_BOOKS_RAW = json.load(f)
with open(f"{CFG}/phrase_head.json", "r") as f:
    PHRASE_HEAD = json.load(f)
with open(f"{CFG}/phrase_tail.json", "r") as f:
    PHRASE_TAIL = json.load(f)
with open(f"{CFG}/phrase_pairs.json", "r") as f:
    PHRASE_PAIRS = json.load(f)
with open(f"{CFG}/shi_rules.json", "r") as f:
    SHI_RULES_RAW = json.load(f)
with open(f"{CFG}/ci_rules.json", "r") as f:
    CI_RULES_RAW = json.load(f)
with open(f"{CFG}/t2s_map.json", "r") as f:
    T2S_MAP = json.load(f)

# --- 释义数据（可选） ---
_def_path = f"{CFG}/char_definitions.json"
if os.path.exists(_def_path):
    with open(_def_path, "r") as f:
        CHAR_DEFS = json.load(f)
else:
    CHAR_DEFS = {}

# --- 典故数据 ---
try:
    with open(f"{CFG}/allusion_index.json", "r") as f:
        ALLUSION_INDEX = json.load(f)
    with open(f"{CFG}/allusion_entries.json", "r") as f:
        ALLUSION_ENTRIES = json.load(f)
except FileNotFoundError:
    ALLUSION_INDEX = {}
    ALLUSION_ENTRIES = []

# --- 通过 config_loader 加载结构化对象 (checker 用) ---
char_dict = config_loader.load_char_dict()
rhyme_books = config_loader.load_rhyme_books()
rule_database = config_loader.load_rule_database()

CHECKER = PoetryChecker(
    char_dict=char_dict,
    rhyme_books=rhyme_books,
    rule_database=rule_database,
)

# --- 预构建规则摘要列表 (rules/list 用) ---
RULES_SUMMARY = {
    "Shi": [{"name": r["name"], "char_count": r["char_count"]} for r in SHI_RULES_RAW],
    "Ci":  [{"name": r["name"], "char_count": r["char_count"]} for r in CI_RULES_RAW],
}

# --- 韵部排序映射 ---
# 平水韵: 按 pingshuiyun_color.xlsx 中的序号
import re as _re

PINGSHUIYUN_ORDER = [
    '一东','二冬','三江','四支','五微','六鱼','七虞','八齐','九佳','十灰',
    '十一真','十二文','十三元','十四寒','十五删',
    '一先','二萧','三肴','四豪','五歌','六麻','七阳','八庚','九青','十蒸',
    '十一尤','十二侵','十三覃','十四盐','十五咸',
    '一董','二肿','三讲','四纸','五尾','六语','七麌','八荠','九蟹','十贿',
    '十一轸','十二吻','十三阮','十四旱','十五潸','十六铣','十七筱','十八巧','十九皓',
    '二十哿','二十一马','二十二养','二十三梗','二十四迥','二十五有','二十六寝','二十七感','二十八俭','二十九豏',
    '一送','二宋','三绛','四寘','五未','六御','七遇','八霁','九泰','十卦',
    '十一队','十二震','十三问','十四愿','十五翰','十六谏','十七霰','十八啸','十九效','二十号',
    '二十一个','二十二祃','二十三漾','二十四敬','二十五径','二十六宥','二十七沁','二十八勘','二十九艳','三十陷',
    '一屋','二沃','三觉','四质','五物','六月','七曷','八黠','九屑','十药',
    '十一陌','十二锡','十三职','十四缉','十五合','十六叶','十七洽',
]
_PSY_ORDER_MAP = {name: i for i, name in enumerate(PINGSHUIYUN_ORDER)}

def _cilin_sort_key(name: str) -> tuple:
    """词林正韵排序: 第N部_平/仄/入 → (N, 0=平/1=仄/2=入)"""
    m = _re.match(r'第(\d+)部_(.+)', name)
    if not m:
        return (999, 0)
    num = int(m.group(1))
    suffix = m.group(2)
    suffix_order = {'平': 0, '仄': 1, '入': 2}.get(suffix, 3)
    return (num, suffix_order)

def rhyme_category_sort_key(book: str, cat_name: str) -> int | tuple:
    """通用韵部排序 key"""
    if book == 'Pingshuiyun':
        return _PSY_ORDER_MAP.get(cat_name, 999)
    else:
        return _cilin_sort_key(cat_name)

print(f"[App] 就绪: {len(CHAR_DICT)} 字, "
      f"{len(PHRASE_HEAD)} 首字, {len(PHRASE_TAIL)} 末字, {len(PHRASE_PAIRS)} 对语, "
      f"{len(ALLUSION_ENTRIES)} 典故, "
      f"{len(SHI_RULES_RAW)} 诗规则, {len(CI_RULES_RAW)} 词规则")

# ============================================================================
# 安全中间件
# ============================================================================

@app.before_request
def check_api_auth():
    """API Key 认证 + 输入校验"""
    if not request.path.startswith("/api/"):
        return None

    # 内部端点免认证
    if request.path.startswith("/api/_stats/") or request.path == "/api/_track":
        return None

    # --- 1. API Key 认证 ---
    # 同源请求（本项目前端）免认证，外部调用需要 API Key
    if not AUTH_DISABLED:
        origin = request.headers.get("Origin", "")
        referer = request.headers.get("Referer", "")
        is_same_origin = (
            (origin and request.host in origin)
            or (referer and request.host in referer)
        )
        if is_same_origin:
            g.call_source = "frontend"
        else:
            api_key = request.headers.get("X-API-Key", "")
            key_name = verify_key(api_key)
            if not key_name:
                return jsonify({"error": "无效或缺失 API Key"}), 401
            g.call_source = key_name
    else:
        g.call_source = "local"

    # --- 2. 输入参数长度校验 ---
    for val in request.args.values():
        if len(val) > MAX_PARAM_LENGTH:
            return jsonify({"error": f"参数长度超限 (最大 {MAX_PARAM_LENGTH} 字符)"}), 400
    if request.is_json and request.content_length and request.content_length > 50000:
        return jsonify({"error": "请求体过大 (最大 50KB)"}), 400

    # --- 3. 枚举参数校验 ---
    genre = request.args.get("genre") or (request.get_json(silent=True) or {}).get("genre")
    if genre and genre not in VALID_GENRES:
        return jsonify({"error": f"无效体裁: {genre}，可选: Shi, Ci"}), 400

    book = request.args.get("book") or request.args.get("rhyme_book") or (request.get_json(silent=True) or {}).get("rhyme_book_name")
    if book and book not in VALID_BOOKS:
        return jsonify({"error": f"无效韵书: {book}，可选: Pingshuiyun, Cilinzhengyun, Zhonghua_Tongyun"}), 400

    mode = request.args.get("mode")
    if mode and mode not in VALID_MODES:
        return jsonify({"error": f"无效模式: {mode}，可选: head, tail, pair"}), 400

    return None


@app.after_request
def track_api_call(response):
    """记录 API 调用统计"""
    if request.path.startswith("/api/") and not request.path.startswith("/api/_") and response.status_code < 400:
        source = getattr(g, "call_source", None)
        if source:
            try:
                record_call(source, request.path)
            except Exception:
                pass  # 统计失败不影响正常响应
    return response


@app.after_request
def add_security_headers(response):
    """添加安全响应头"""
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    if not os.environ.get("FANGCUN_AUTH_DISABLED"):
        if request.path in ("/docs", "/dashboard"):
            response.headers["Content-Security-Policy"] = "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'"
        else:
            response.headers["Content-Security-Policy"] = "default-src 'self'"
    return response


# ============================================================================
# 序列化辅助
# ============================================================================

def _extract_rhyme_groups(rule_node: dict) -> dict:
    """从 rhyme_rule AST 提取韵组信息，用于前端着色"""
    groups = []       # [ { "positions": [...], "type": "same" }, ... ]
    relations = []    # [ { "pos1": x, "pos2": y, "relation": "ye_ping" }, ... ]

    def walk(node):
        t = node.get('type')
        if t == 'SAME_CATEGORY':
            groups.append({"positions": node.get("positions", []), "type": "same"})
        elif t == 'RELATION':
            relations.append({
                "pos1": node.get("pos1"),
                "pos2": node.get("pos2"),
                "relation": node.get("relation", ""),
            })
        elif t in ('AND', 'OR'):
            for sub in node.get('rules', []):
                walk(sub)

    if rule_node:
        walk(rule_node)
    return {"groups": groups, "relations": relations}

def serialize_check_result(result: CheckResult) -> dict:
    """将 CheckResult dataclass 转为可 JSON 序列化的 dict"""
    closest = None
    if result.closest_rule:
        r = result.closest_rule
        closest = {
            "name": r.name,
            "genre": r.genre,
            "cipai": r.cipai,
            "char_count": r.char_count,
        }

    errors = [
        {
            "position": e.position,
            "character": e.character,
            "error_type": e.error_type,
            "message": e.message,
        }
        for e in result.errors
    ]

    display_segments = [
        {
            "text_chars": seg.text_chars,
            "rule_items": seg.rule_items,
            "start_index": seg.start_index,
        }
        for seg in result.display_segments
    ]

    warnings = [
        {
            "positions": w.positions,
            "character": w.character,
            "warning_type": w.warning_type,
            "message": w.message,
        }
        for w in result.warnings
    ]

    rhyme_info = _extract_rhyme_groups(result.closest_rule.rhyme_rule) if result.closest_rule else {"groups": [], "relations": []}

    return {
        "is_valid": result.is_valid,
        "closest_rule": closest,
        "errors": errors,
        "warnings": warnings,
        "display_segments": display_segments,
        "rhyme_name": result.rhyme_name,
        "rhyme_positions": result.rhyme_positions,
        "rhyme_chars": result.rhyme_chars,
        "rhyme_groups": rhyme_info["groups"],
        "rhyme_relations": rhyme_info["relations"],
    }

# ============================================================================
# API 路由
# ============================================================================

# ---------- 1. POST /api/validate_meter ----------

@app.route("/api/validate_meter", methods=["POST"])
@limiter.limit("60 per minute")
def validate_meter():
    data = request.get_json(force=True)
    poem_text = data.get("poem_text", "")
    genre = data.get("genre", "Shi")
    rhyme_book_name = data.get("rhyme_book_name", "Pingshuiyun")
    rule_name = data.get("rule_name", None)
    ensure_longpu = data.get("ensure_longpu", False)

    result = CHECKER.check_auto(
        poem_text=poem_text,
        genre=genre,
        rhyme_book_name=rhyme_book_name,
        ensure_longpu=ensure_longpu,
        rule_name=rule_name,
    )
    return jsonify(serialize_check_result(result))

# ---------- 1b. POST /api/free_rhyme ----------

import re as _re
_CJK_RE = _re.compile(r'[\u4e00-\u9fff\u3400-\u4dbf]')
_PUNCT_SET = set('，。！？、；：')

@app.route("/api/free_rhyme", methods=["POST"])
@limiter.limit("60 per minute")
def free_rhyme():
    data = request.get_json(force=True)
    lines = data.get("lines", [])
    book = data.get("rhyme_book_name", "Zhonghua_Tongyun")
    merge_tones = data.get("merge_tones", False)

    if not isinstance(lines, list) or len(lines) > 100:
        return jsonify({"error": "lines must be a list (max 100)"}), 400
    if book not in VALID_BOOKS:
        return jsonify({"error": f"invalid rhyme_book_name, options: {', '.join(sorted(VALID_BOOKS))}"}), 400

    def _normalize_cat(cat: str) -> str:
        if merge_tones and (cat.endswith('_平') or cat.endswith('_仄')):
            return cat.rsplit('_', 1)[0]
        return cat

    candidates = []
    for li, line in enumerate(lines):
        if not isinstance(line, str):
            continue
        chars = list(line)
        for ci, ch in enumerate(chars):
            if not _CJK_RE.match(ch):
                continue
            nxt = chars[ci + 1] if ci + 1 < len(chars) else None
            is_before_punct = nxt in _PUNCT_SET
            is_before_space = nxt == ' '
            is_line_end = ci == len(chars) - 1 or all(
                not _CJK_RE.match(c) for c in chars[ci + 1:]
            )
            if is_before_punct or is_before_space or is_line_end:
                info = _lookup_char_dict(ch)
                cats = list(info.get("rhymes", {}).get(book, [])) if info else []
                candidates.append({
                    "line": li, "pos": ci, "char": ch, "categories": cats,
                })

    # forward-greedy grouping (use normalized categories for matching)
    assigned = [False] * len(candidates)
    groups = []
    for i, cand in enumerate(candidates):
        if assigned[i] or not cand["categories"]:
            continue
        anchor = set(_normalize_cat(c) for c in cand["categories"])
        group_positions = [{"line": cand["line"], "pos": cand["pos"]}]
        assigned[i] = True
        for j in range(i + 1, len(candidates)):
            if assigned[j] or not candidates[j]["categories"]:
                continue
            norm_cats = set(_normalize_cat(c) for c in candidates[j]["categories"])
            if anchor & norm_cats:
                group_positions.append({"line": candidates[j]["line"], "pos": candidates[j]["pos"]})
                assigned[j] = True
        if len(group_positions) >= 2:
            groups.append({"positions": group_positions})

    return jsonify({"candidates": candidates, "groups": groups})

# ---------- 2. GET /api/char/lookup ----------

def _t2s(ch: str) -> str:
    """繁→简转换（使用预构建映射表）"""
    return T2S_MAP.get(ch, ch)

def _lookup_char_dict(ch: str):
    """查字典，查不到时尝试繁→简"""
    info = CHAR_DICT.get(ch)
    if info:
        return info
    simplified = _t2s(ch)
    if simplified != ch:
        return CHAR_DICT.get(simplified)
    return None

def _lookup_definitions(ch: str):
    """查释义，查不到时尝试繁→简"""
    defs = CHAR_DEFS.get(ch)
    if defs:
        return defs
    simplified = _t2s(ch)
    if simplified != ch:
        return CHAR_DEFS.get(simplified)
    return None

@app.route("/api/char/lookup")
def char_lookup():
    ch = request.args.get("char", "")
    book = request.args.get("book", "")
    info = _lookup_char_dict(ch)
    defs = _lookup_definitions(ch)
    if not info:
        return jsonify({"char": ch, "tones": [], "rhyme_categories": {} if not book else [], "definitions": defs or []})

    if not book:
        return jsonify({"char": ch, "tones": info.get("tones", []), "rhyme_categories": info.get("rhymes", {}), "definitions": defs or []})

    cats_raw = info.get("rhymes", {}).get(book, [])
    seen = set()
    cats = []
    for c in cats_raw:
        if c not in seen:
            seen.add(c)
            bk = RHYME_BOOKS_RAW.get(book, {}).get("categories", {}).get(c, {})
            cats.append({"name": c, "tone_type": bk.get("tone_type", "")})
    cats.sort(key=lambda x: rhyme_category_sort_key(book, x["name"]))
    return jsonify({"char": ch, "tones": info.get("tones", []), "rhyme_categories": cats, "definitions": defs or []})

# ---------- 3. GET /api/rhyme/lookup ----------

@app.route("/api/rhyme/lookup")
def rhyme_lookup():
    book = request.args.get("book", "Pingshuiyun")
    category = request.args.get("category", "")
    include = request.args.get("include", "")

    book_data = RHYME_BOOKS_RAW.get(book, {}).get("categories", {})

    def _build_category(cat_name):
        bk = book_data.get(cat_name)
        if not bk:
            return None
        chars = bk["characters"]  # 已由 prebuild.py 预排序去重
        return {
            "category_name": bk["name"],
            "tone_type": bk["tone_type"],
            "total": len(chars),
            "characters": chars,
            "relations": bk.get("relations", {}),
        }

    primary = _build_category(category)
    if not primary:
        return jsonify({"error": f"韵部 '{category}' 不存在"}), 404

    # 无 include 参数时，扁平返回
    if not include:
        return jsonify(primary)

    # 有 include 参数时，返回 primary + related
    related = []
    for rel_type in include.split(","):
        rel_type = rel_type.strip()
        rel_names = primary["relations"].get(rel_type, [])
        for rn in rel_names:
            rel_cat = _build_category(rn)
            if rel_cat:
                related.append({"relation": rel_type, "category": rel_cat})

    return jsonify({"primary": primary, "related": related})

# ---------- 4. GET /api/rhyme/list ----------

@app.route("/api/rhyme/list")
def rhyme_list():
    book = request.args.get("book", "Pingshuiyun")
    tone = request.args.get("tone", "")
    book_data = RHYME_BOOKS_RAW.get(book, {}).get("categories", {})
    categories = []
    for cat_name, cat in book_data.items():
        if tone and cat.get("tone_type") != tone:
            continue
        chars = cat.get("characters", [])
        top4 = chars[:10]  # 已由 prebuild.py 预排序
        categories.append({
            "name": cat["name"],
            "tone_type": cat.get("tone_type", ""),
            "char_count": len(chars),
            "preview": "".join(top4),
        })
    categories.sort(key=lambda x: rhyme_category_sort_key(book, x["name"]))
    return jsonify({"book": book, "categories": categories})

# ---------- 5. GET /api/rules/list ----------

@app.route("/api/rules/list")
def rules_list():
    genre = request.args.get("genre", "Ci")
    rules = RULES_SUMMARY.get(genre, [])
    search = request.args.get("search", "")
    if search:
        rules = [r for r in rules if search in r["name"] or search in r.get("cipai", "")]
    return jsonify(rules)

# ---------- 6. GET /api/dictionary/search ----------

@app.route("/api/dictionary/search")
@limiter.limit("120 per minute")
def dict_search():
    term_raw = request.args.get("term", "")
    term = ''.join(_t2s(c) for c in term_raw)  # 繁→简，词库索引均为简体
    mode = request.args.get("mode", "head")
    length = request.args.get("length", "2")
    tone = request.args.get("tone", "all")

    if mode == "pair":
        return jsonify(PHRASE_PAIRS.get(term, []))

    src = PHRASE_HEAD if mode == "head" else PHRASE_TAIL
    entry = src.get(term, {})
    if length == "all":
        return jsonify(entry)
    len_data = entry.get(length, {})
    if tone in ("P", "Z"):
        return jsonify(len_data.get(tone, []))
    # merge P+Z
    merged = {}
    for t in ["P", "Z"]:
        for w, c in len_data.get(t, []):
            merged[w] = max(merged.get(w, 0), c)
    return jsonify(sorted(merged.items(), key=lambda x: -x[1]))

# ---------- 7. GET /api/dictionary/allusion ----------

def _sort_allusion_results(entries: list, term: str) -> list:
    """排序典故结果: 精确匹配 → 匹配位置 → 典形词长度 → 同源丰富度"""
    def score(entry):
        w = entry["w"]
        exact = 0 if w == term else 1
        pos = w.find(term) if term in w else len(w)
        length = len(w) if len(w) <= 4 else len(w) + 2
        rc = -min(entry.get("rc", 0), 20)
        return (exact, pos, length, rc)
    return sorted(entries, key=score)

@app.route("/api/dictionary/allusion")
@limiter.limit("120 per minute")
def allusion_search():
    term_raw = request.args.get("term", "")
    term = ''.join(_t2s(c) for c in term_raw)
    limit = min(int(request.args.get("limit", "60")), 200)

    if not term:
        return jsonify([])

    if len(term) == 1:
        entry_ids = ALLUSION_INDEX.get(term, [])
        entries = [ALLUSION_ENTRIES[eid] for eid in entry_ids]
    else:
        char_sets = [set(ALLUSION_INDEX.get(c, [])) for c in term]
        if not char_sets or any(len(s) == 0 for s in char_sets):
            return jsonify([])
        candidate_ids = char_sets[0]
        for s in char_sets[1:]:
            candidate_ids &= s
        entries = [ALLUSION_ENTRIES[eid] for eid in candidate_ids
                   if term in ALLUSION_ENTRIES[eid]["w"]]

    entries = _sort_allusion_results(entries, term)
    return jsonify(entries[:limit])

# ============================================================================
# 文档页面
# ============================================================================

@app.route("/docs")
@limiter.exempt
def docs():
    return app.send_static_file("docs.html")

# ---------- 前端埋点 ----------

VALID_EVENTS = {
    'export_image', 'copy_text',
    'create_board', 'delete_board',
    'import_poem', 'import_boards', 'export_boards',
    'create_folder', 'delete_folder', 'move_board',
    'add_inspiration', 'toggle_immersive',
}

@app.route("/api/_track", methods=["POST"])
@limiter.limit("120 per minute")
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
    record_call("frontend", route)
    return jsonify({"ok": True})

# ---------- 统计端点 (Dashboard 数据源) ----------

@app.route("/api/_stats/routes")
@limiter.exempt
def stats_routes():
    date = request.args.get("date")
    return jsonify(get_route_stats(date))

@app.route("/api/_stats/keys")
@limiter.exempt
def stats_keys():
    return jsonify(list_keys_summary())

@app.route("/dashboard")
@limiter.exempt
def dashboard():
    return app.send_static_file("dashboard.html")

# ============================================================================
# 入口
# ============================================================================

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5050, debug=False)
