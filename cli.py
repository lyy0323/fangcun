#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
方寸 (fangcun) — 格律诗词校验 CLI
供 AI Agent 以 tool-use 模式调用。

子命令:
    validate  校验格律（返回逐字平仄谱 + 结构化错误）
    rules     列出格律规则（含句式结构描述）
    char      查字声调与韵部（支持多字批量）
    rhyme     查韵部字表
    suggest   词语/对仗联想（含声调标注）

validate/rules/char/rhyme 需要 checker.py 和 config_loader.py。
"""

import argparse
import json
import sys

_data = {}


def _ensure_loaded():
    if _data:
        return
    try:
        import config_loader
        from checker import PoetryChecker
    except ImportError:
        print(json.dumps({"error": "checker not found", "hint": "安装 check_rhyme 包或将 checker.py、config_loader.py 放在当前目录"}, ensure_ascii=False))
        sys.exit(1)

    _data["config_loader"] = config_loader
    _data["char_dict"] = config_loader.load_char_dict()
    _data["rhyme_books"] = config_loader.load_rhyme_books()
    _data["rule_database"] = config_loader.load_rule_database()
    _data["checker"] = PoetryChecker(
        char_dict=_data["char_dict"],
        rhyme_books=_data["rhyme_books"],
        rule_database=_data["rule_database"],
    )
    _data["char_dict_raw"] = _data["char_dict"]
    _data["rhyme_books_raw"] = config_loader._load_json("rhyme_books.json") or {}
    _data["phrase_head"] = config_loader._load_json("phrase_head.json") or {}
    _data["phrase_tail"] = config_loader._load_json("phrase_tail.json") or {}
    _data["phrase_pairs"] = config_loader._load_json("phrase_pairs.json") or {}
    _data["t2s_map"] = config_loader._load_json("t2s_map.json") or {}
    shi_rules = config_loader._load_json("shi_rules.json") or []
    ci_rules = config_loader._load_json("ci_rules.json") or []
    _data["shi_rules_raw"] = shi_rules
    _data["ci_rules_raw"] = ci_rules


def _t2s(ch: str) -> str:
    return _data["t2s_map"].get(ch, ch)


def _lookup_char(ch: str):
    info = _data["char_dict_raw"].get(ch)
    if info:
        return info
    simplified = _t2s(ch)
    if simplified != ch:
        return _data["char_dict_raw"].get(simplified)
    return None


def _get_tone_label(ch: str) -> str:
    info = _lookup_char(ch)
    if not info or not info.get("tones"):
        return "?"
    tones = info["tones"]
    has_p = any(t in ("平", "Ping", "ping", "yinping", "阴平", "yangping", "阳平") for t in tones)
    has_z = any(t not in ("平", "Ping", "ping", "yinping", "阴平", "yangping", "阳平") for t in tones)
    if has_p and has_z:
        return "?"
    return "P" if has_p else "Z"


# ---------------------------------------------------------------------------
# validate — 核心检测
# ---------------------------------------------------------------------------

def cmd_validate(args):
    _ensure_loaded()
    result = _data["checker"].check_auto(
        poem_text=args.text, genre=args.genre, rhyme_book_name=args.rhyme_book,
        ensure_longpu=args.longpu, rule_name=args.rule,
    )

    if args.pretty:
        from checker import print_pretty_result
        print_pretty_result(result)
        return 0 if result.is_valid else 1

    closest = None
    if result.closest_rule:
        r = result.closest_rule
        closest = {"name": r.name, "genre": r.genre, "cipai": r.cipai, "char_count": r.char_count}

    tone_pattern = []
    for seg in result.display_segments:
        for item in seg.rule_items:
            tone_pattern.append(item.get("tone", "?"))

    errors = []
    for e in result.errors:
        err = {"position": e.position, "character": e.character, "type": e.error_type, "message": e.message}
        if e.expected is not None:
            err["expected"] = e.expected
        if e.actual is not None:
            err["actual"] = e.actual
        errors.append(err)

    warnings = []
    for w in result.warnings:
        warnings.append({"positions": w.positions, "character": w.character, "type": w.warning_type, "message": w.message})

    out = {
        "is_valid": result.is_valid,
        "rule": closest,
        "chars": result.cleaned_chars,
        "tone_pattern": tone_pattern,
        "rhyme": {
            "name": result.rhyme_name,
            "positions": result.rhyme_positions,
            "chars": result.rhyme_chars,
        },
        "errors": errors,
        "warnings": warnings,
    }
    print(json.dumps(out, ensure_ascii=False))
    return 0 if result.is_valid else 1


# ---------------------------------------------------------------------------
# rules — 规则列表（含结构描述）
# ---------------------------------------------------------------------------

def _describe_rule(raw_rule: dict) -> dict:
    name = raw_rule["name"]
    char_count = raw_rule["char_count"]
    genre = raw_rule.get("genre", "Shi")
    cipai = raw_rule.get("cipai")

    pattern = raw_rule.get("tone_pattern", [])
    flat = []
    for item in pattern:
        if isinstance(item, dict):
            flat.append(item.get("tone", "?"))
        elif isinstance(item, list):
            flat.append("/".join("".join(v.get("tone","?") for v in variant) for variant in item))

    desc = {"name": name, "char_count": char_count}
    if cipai:
        desc["cipai"] = cipai

    if genre == "Shi":
        sentence_len = 7 if char_count % 7 == 0 else 5
        desc["sentence_length"] = sentence_len
        desc["sentence_count"] = char_count // sentence_len
        first_tone = flat[0] if flat else "?"
        desc["start_tone"] = "平起" if first_tone == "P" else ("仄起" if first_tone == "Z" else "中")
        desc["first_line_rhyme"] = "首句入韵" in name

    if flat:
        desc["tone_preview"] = "".join(t.replace("P","平").replace("Z","仄").replace("A","中") for t in flat[:14])
        if len(flat) > 14:
            desc["tone_preview"] += "…"

    return desc


def cmd_rules(args):
    _ensure_loaded()
    raw_rules = _data["shi_rules_raw"] if args.genre == "Shi" else _data["ci_rules_raw"]
    results = []
    for r in raw_rules:
        desc = _describe_rule(r)
        if args.search:
            if args.search not in desc["name"] and args.search not in desc.get("cipai", ""):
                continue
        results.append(desc)
    print(json.dumps(results, ensure_ascii=False))
    return 0


# ---------------------------------------------------------------------------
# char — 单字/多字声调查询
# ---------------------------------------------------------------------------

def cmd_char(args):
    _ensure_loaded()
    chars = list(args.char)
    if len(chars) == 1:
        ch = chars[0]
        info = _lookup_char(ch)
        if not info:
            print(json.dumps({"char": ch, "tones": [], "rhyme_categories": {}}, ensure_ascii=False))
            return 0
        if args.book:
            cats = info.get("rhymes", {}).get(args.book, [])
            out = {"char": ch, "tones": info.get("tones", []), "rhyme_categories": {args.book: cats}}
        else:
            out = {"char": ch, "tones": info.get("tones", []), "rhyme_categories": info.get("rhymes", {})}
        print(json.dumps(out, ensure_ascii=False))
    else:
        results = []
        for ch in chars:
            info = _lookup_char(ch)
            if info:
                entry = {"char": ch, "tones": info.get("tones", []), "tone": _get_tone_label(ch)}
                if args.book:
                    entry["rhymes"] = info.get("rhymes", {}).get(args.book, [])
                results.append(entry)
            else:
                results.append({"char": ch, "tones": [], "tone": "?"})
        print(json.dumps(results, ensure_ascii=False))
    return 0


# ---------------------------------------------------------------------------
# rhyme — 韵部字表
# ---------------------------------------------------------------------------

def cmd_rhyme(args):
    _ensure_loaded()
    book_data = _data["rhyme_books_raw"].get(args.book, {}).get("categories", {})
    cat = book_data.get(args.category)
    if not cat:
        avail = list(book_data.keys())[:10]
        print(json.dumps({"error": f"韵部 '{args.category}' 不存在", "available_sample": avail}, ensure_ascii=False))
        return 2
    result = {"category_name": cat["name"], "tone_type": cat["tone_type"], "total": len(cat["characters"]), "characters": cat["characters"]}
    if args.include:
        related = []
        for rel_type in args.include.split(","):
            rel_type = rel_type.strip()
            for rn in cat.get("relations", {}).get(rel_type, []):
                rel_cat = book_data.get(rn)
                if rel_cat:
                    related.append({"relation": rel_type, "category": {"category_name": rel_cat["name"], "tone_type": rel_cat["tone_type"], "total": len(rel_cat["characters"]), "characters": rel_cat["characters"]}})
        result = {"primary": result, "related": related}
    print(json.dumps(result, ensure_ascii=False))
    return 0


# ---------------------------------------------------------------------------
# suggest — 词语联想（含声调）
# ---------------------------------------------------------------------------

def cmd_suggest(args):
    _ensure_loaded()
    term = "".join(_t2s(c) for c in args.term)

    if args.mode == "pair":
        raw = _data["phrase_pairs"].get(term, [])
        if args.with_tones:
            result = []
            for item in raw[:50]:
                word = item[0] if isinstance(item, list) else item
                freq = item[1] if isinstance(item, list) and len(item) > 1 else 0
                tones = "".join(_get_tone_label(c) for c in word)
                result.append([word, freq, tones])
            print(json.dumps(result, ensure_ascii=False))
        else:
            print(json.dumps(raw, ensure_ascii=False))
        return 0

    src = _data["phrase_head"] if args.mode == "head" else _data["phrase_tail"]
    entry = src.get(term, {})

    if args.length is None:
        print(json.dumps(entry, ensure_ascii=False))
        return 0

    len_data = entry.get(str(args.length), {})
    if args.tone in ("P", "Z"):
        raw = len_data.get(args.tone, [])
    else:
        merged = {}
        for t in ["P", "Z"]:
            for w, c in len_data.get(t, []):
                merged[w] = max(merged.get(w, 0), c)
        raw = sorted(merged.items(), key=lambda x: -x[1])

    if args.with_tones:
        result = []
        for item in raw[:50]:
            word = item[0] if isinstance(item, (list, tuple)) else item
            freq = item[1] if isinstance(item, (list, tuple)) and len(item) > 1 else 0
            tones = "".join(_get_tone_label(c) for c in word)
            result.append([word, freq, tones])
        print(json.dumps(result, ensure_ascii=False))
    else:
        print(json.dumps(raw, ensure_ascii=False))
    return 0


# ---------------------------------------------------------------------------
# 主入口
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(prog="fangcun", description="方寸 — 格律诗词校验工具 (Chinese classical poetry validator)")
    sub = parser.add_subparsers(dest="command", required=True)

    p_val = sub.add_parser("validate", help="校验诗词格律（返回逐字谱面 + 结构化错误）")
    p_val.add_argument("--text", required=True, help="诗词文本（汉字，标点自动忽略）")
    p_val.add_argument("--genre", required=True, choices=["Shi", "Ci"], help="体裁: Shi(诗) / Ci(词)")
    p_val.add_argument("--rhyme-book", default="Pingshuiyun", choices=["Pingshuiyun", "Cilinzhengyun", "Zhonghua_Tongyun"], help="韵书")
    p_val.add_argument("--rule", default=None, help="指定规则名（如「七律平起」），不指定则自动匹配")
    p_val.add_argument("--longpu", action="store_true", help="词牌仅匹配龙谱")
    p_val.add_argument("--pretty", action="store_true", help="人类可读彩色输出（非 JSON）")

    p_rules = sub.add_parser("rules", help="列出格律规则（含句式结构描述）")
    p_rules.add_argument("--genre", required=True, choices=["Shi", "Ci"], help="体裁")
    p_rules.add_argument("--search", default=None, help="按名称/词牌搜索")

    p_char = sub.add_parser("char", help="查字声调与韵部（支持多字如 --char 明月）")
    p_char.add_argument("--char", required=True, help="要查询的汉字（单字或多字）")
    p_char.add_argument("--book", default=None, help="韵书名（可选）")

    p_rhyme = sub.add_parser("rhyme", help="查韵部字表")
    p_rhyme.add_argument("--book", required=True, choices=["Pingshuiyun", "Cilinzhengyun", "Zhonghua_Tongyun"], help="韵书")
    p_rhyme.add_argument("--category", required=True, help="韵部名（如 一东）")
    p_rhyme.add_argument("--include", default=None, help="包含关联韵部（如 neighbor,ye_ping）")

    p_sug = sub.add_parser("suggest", help="词语/对仗联想（--with-tones 附带声调）")
    p_sug.add_argument("--term", required=True, help="查询词")
    p_sug.add_argument("--mode", required=True, choices=["head", "tail", "pair"], help="head(首字)/tail(尾字)/pair(对仗)")
    p_sug.add_argument("--length", type=int, default=None, help="词语长度")
    p_sug.add_argument("--tone", default=None, choices=["P", "Z"], help="末字声调: P(平)/Z(仄)")
    p_sug.add_argument("--with-tones", action="store_true", help="每条结果附带逐字声调标注")

    args = parser.parse_args()

    old_stdout = sys.stdout
    sys.stdout = sys.stderr
    try:
        handler = {"validate": cmd_validate, "rules": cmd_rules, "char": cmd_char, "rhyme": cmd_rhyme, "suggest": cmd_suggest}[args.command]
        _ensure_loaded()
        sys.stdout = old_stdout
        return handler(args)
    except Exception as e:
        sys.stdout = old_stdout
        print(json.dumps({"error": str(e)}, ensure_ascii=False), file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main() or 0)
