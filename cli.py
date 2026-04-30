#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
方寸 (fangcun) — 格律诗词校验 CLI
供 AI Agent 以 tool-use 模式调用。

用法:
    fangcun validate --text "白日依山尽..." --genre Shi --rhyme-book Pingshuiyun
    fangcun rules   --genre Shi
    fangcun char    --char 花
    fangcun rhyme   --book Pingshuiyun --category 一东
    fangcun suggest --term 明月 --mode head

validate/rules/char/rhyme 需要安装 check_rhyme 包（pip install check_rhyme）
或将 checker.py 和 config_loader.py 放在同目录下。
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
        print("错误: 未找到 checker.py / config_loader.py。", file=sys.stderr)
        print("请安装 check_rhyme 包或将格律检测文件放在当前目录。", file=sys.stderr)
        sys.exit(1)

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
    _data["rules_summary"] = {
        "Shi": [{"name": r["name"], "char_count": r["char_count"]} for r in shi_rules],
        "Ci": [{"name": r["name"], "char_count": r["char_count"], "cipai": r.get("cipai")} for r in ci_rules],
    }


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


def _serialize_check_result(result) -> dict:
    closest = None
    if result.closest_rule:
        r = result.closest_rule
        closest = {"name": r.name, "genre": r.genre, "cipai": r.cipai, "char_count": r.char_count}
    return {
        "is_valid": result.is_valid,
        "closest_rule": closest,
        "errors": [{"position": e.position, "character": e.character, "error_type": e.error_type, "message": e.message} for e in result.errors],
        "warnings": [{"positions": w.positions, "character": w.character, "warning_type": w.warning_type, "message": w.message} for w in result.warnings],
        "display_segments": [{"text_chars": s.text_chars, "rule_items": s.rule_items, "start_index": s.start_index} for s in result.display_segments],
        "rhyme_name": result.rhyme_name,
        "rhyme_positions": result.rhyme_positions,
        "rhyme_chars": result.rhyme_chars,
    }


def cmd_validate(args):
    from checker import print_pretty_result
    _ensure_loaded()
    result = _data["checker"].check_auto(
        poem_text=args.text, genre=args.genre, rhyme_book_name=args.rhyme_book,
        ensure_longpu=args.longpu, rule_name=args.rule,
    )
    if args.pretty:
        print_pretty_result(result)
    else:
        print(json.dumps(_serialize_check_result(result), ensure_ascii=False))
    return 0 if result.is_valid else 1


def cmd_rules(args):
    _ensure_loaded()
    rules = _data["rules_summary"].get(args.genre, [])
    if args.search:
        rules = [r for r in rules if args.search in r["name"] or args.search in r.get("cipai", "")]
    print(json.dumps(rules, ensure_ascii=False))
    return 0


def cmd_char(args):
    _ensure_loaded()
    info = _lookup_char(args.char)
    if not info:
        print(json.dumps({"char": args.char, "tones": [], "rhyme_categories": {}}, ensure_ascii=False))
        return 0
    if args.book:
        cats = info.get("rhymes", {}).get(args.book, [])
        out = {"char": args.char, "tones": info.get("tones", []), "rhyme_categories": {args.book: cats}}
    else:
        out = {"char": args.char, "tones": info.get("tones", []), "rhyme_categories": info.get("rhymes", {})}
    print(json.dumps(out, ensure_ascii=False))
    return 0


def cmd_rhyme(args):
    _ensure_loaded()
    book_data = _data["rhyme_books_raw"].get(args.book, {}).get("categories", {})
    cat = book_data.get(args.category)
    if not cat:
        print(json.dumps({"error": f"韵部 '{args.category}' 不存在"}, ensure_ascii=False))
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


def cmd_suggest(args):
    _ensure_loaded()
    term = "".join(_t2s(c) for c in args.term)
    if args.mode == "pair":
        print(json.dumps(_data["phrase_pairs"].get(term, []), ensure_ascii=False))
        return 0
    src = _data["phrase_head"] if args.mode == "head" else _data["phrase_tail"]
    entry = src.get(term, {})
    if args.length is None:
        print(json.dumps(entry, ensure_ascii=False))
        return 0
    len_data = entry.get(str(args.length), {})
    if args.tone in ("P", "Z"):
        print(json.dumps(len_data.get(args.tone, []), ensure_ascii=False))
    else:
        merged = {}
        for t in ["P", "Z"]:
            for w, c in len_data.get(t, []):
                merged[w] = max(merged.get(w, 0), c)
        print(json.dumps(sorted(merged.items(), key=lambda x: -x[1]), ensure_ascii=False))
    return 0


def main():
    parser = argparse.ArgumentParser(prog="fangcun", description="方寸 — 格律诗词校验工具 (Chinese classical poetry validator)")
    sub = parser.add_subparsers(dest="command", required=True)

    p_val = sub.add_parser("validate", help="校验诗词格律")
    p_val.add_argument("--text", required=True)
    p_val.add_argument("--genre", required=True, choices=["Shi", "Ci"])
    p_val.add_argument("--rhyme-book", default="Pingshuiyun", choices=["Pingshuiyun", "Cilinzhengyun", "Zhonghua_Tongyun"])
    p_val.add_argument("--rule", default=None)
    p_val.add_argument("--longpu", action="store_true")
    p_val.add_argument("--pretty", action="store_true")

    p_rules = sub.add_parser("rules", help="列出格律规则")
    p_rules.add_argument("--genre", required=True, choices=["Shi", "Ci"])
    p_rules.add_argument("--search", default=None)

    p_char = sub.add_parser("char", help="查字声调与韵部")
    p_char.add_argument("--char", required=True)
    p_char.add_argument("--book", default=None)

    p_rhyme = sub.add_parser("rhyme", help="查韵部字表")
    p_rhyme.add_argument("--book", required=True, choices=["Pingshuiyun", "Cilinzhengyun", "Zhonghua_Tongyun"])
    p_rhyme.add_argument("--category", required=True)
    p_rhyme.add_argument("--include", default=None)

    p_sug = sub.add_parser("suggest", help="词语/对仗联想")
    p_sug.add_argument("--term", required=True)
    p_sug.add_argument("--mode", required=True, choices=["head", "tail", "pair"])
    p_sug.add_argument("--length", type=int, default=None)
    p_sug.add_argument("--tone", default=None, choices=["P", "Z"])

    args = parser.parse_args()

    old_stdout = sys.stdout
    sys.stdout = sys.stderr
    try:
        if args.command == "validate":
            _ensure_loaded()
            sys.stdout = old_stdout
            return cmd_validate(args)
        else:
            handler = {"rules": cmd_rules, "char": cmd_char, "rhyme": cmd_rhyme, "suggest": cmd_suggest}[args.command]
            _ensure_loaded()
            sys.stdout = old_stdout
            return handler(args)
    except Exception as e:
        sys.stdout = old_stdout
        print(json.dumps({"error": str(e)}, ensure_ascii=False), file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main() or 0)
