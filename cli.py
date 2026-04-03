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
"""

import argparse
import json
import sys

import config_loader
from checker import PoetryChecker, CheckResult, print_pretty_result, get_rhyme_positions

# ---------------------------------------------------------------------------
# 懒加载全局数据 (首次访问时初始化)
# ---------------------------------------------------------------------------

_data = {}


def _ensure_loaded():
    if _data:
        return
    _data["char_dict"] = config_loader.load_char_dict()
    _data["rhyme_books"] = config_loader.load_rhyme_books()
    _data["rule_database"] = config_loader.load_rule_database()
    _data["checker"] = PoetryChecker(
        char_dict=_data["char_dict"],
        rhyme_books=_data["rhyme_books"],
        rule_database=_data["rule_database"],
    )
    # 原始 JSON 数据 (用于 char/rhyme/suggest 等查询)
    _data["char_dict_raw"] = _data["char_dict"]
    _data["rhyme_books_raw"] = config_loader._load_json("rhyme_books.json") or {}
    _data["phrase_head"] = config_loader._load_json("phrase_head.json") or {}
    _data["phrase_tail"] = config_loader._load_json("phrase_tail.json") or {}
    _data["phrase_pairs"] = config_loader._load_json("phrase_pairs.json") or {}
    _data["t2s_map"] = config_loader._load_json("t2s_map.json") or {}
    # 规则摘要
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


# ---------------------------------------------------------------------------
# 序列化
# ---------------------------------------------------------------------------

def _serialize_check_result(result: CheckResult) -> dict:
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
        {"position": e.position, "character": e.character,
         "error_type": e.error_type, "message": e.message}
        for e in result.errors
    ]

    warnings = [
        {"positions": w.positions, "character": w.character,
         "warning_type": w.warning_type, "message": w.message}
        for w in result.warnings
    ]

    display_segments = [
        {"text_chars": seg.text_chars, "rule_items": seg.rule_items,
         "start_index": seg.start_index}
        for seg in result.display_segments
    ]

    return {
        "is_valid": result.is_valid,
        "closest_rule": closest,
        "errors": errors,
        "warnings": warnings,
        "display_segments": display_segments,
        "rhyme_name": result.rhyme_name,
        "rhyme_positions": result.rhyme_positions,
        "rhyme_chars": result.rhyme_chars,
    }


# ---------------------------------------------------------------------------
# 子命令实现
# ---------------------------------------------------------------------------

def cmd_validate(args):
    _ensure_loaded()
    result = _data["checker"].check_auto(
        poem_text=args.text,
        genre=args.genre,
        rhyme_book_name=args.rhyme_book,
        ensure_longpu=args.longpu,
        rule_name=args.rule,
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
        keyword = args.search
        rules = [r for r in rules if keyword in r["name"] or keyword in r.get("cipai", "")]
    print(json.dumps(rules, ensure_ascii=False))
    return 0


def cmd_char(args):
    _ensure_loaded()
    ch = args.char
    info = _lookup_char(ch)
    if not info:
        print(json.dumps({"char": ch, "tones": [], "rhyme_categories": {}}, ensure_ascii=False))
        return 0
    book = args.book
    if book:
        cats = info.get("rhymes", {}).get(book, [])
        out = {"char": ch, "tones": info.get("tones", []), "rhyme_categories": {book: cats}}
    else:
        out = {"char": ch, "tones": info.get("tones", []), "rhyme_categories": info.get("rhymes", {})}
    print(json.dumps(out, ensure_ascii=False))
    return 0


def cmd_rhyme(args):
    _ensure_loaded()
    book_data = _data["rhyme_books_raw"].get(args.book, {}).get("categories", {})
    cat = book_data.get(args.category)
    if not cat:
        print(json.dumps({"error": f"韵部 '{args.category}' 不存在"}, ensure_ascii=False))
        return 2
    result = {
        "category_name": cat["name"],
        "tone_type": cat["tone_type"],
        "total": len(cat["characters"]),
        "characters": cat["characters"],
    }
    if args.include:
        related = []
        for rel_type in args.include.split(","):
            rel_type = rel_type.strip()
            for rn in cat.get("relations", {}).get(rel_type, []):
                rel_cat = book_data.get(rn)
                if rel_cat:
                    related.append({
                        "relation": rel_type,
                        "category": {
                            "category_name": rel_cat["name"],
                            "tone_type": rel_cat["tone_type"],
                            "total": len(rel_cat["characters"]),
                            "characters": rel_cat["characters"],
                        }
                    })
        result = {"primary": result, "related": related}
    print(json.dumps(result, ensure_ascii=False))
    return 0


def cmd_key(args):
    from api_keys import create_key, revoke_key, list_keys, get_route_stats
    action = args.key_action

    if action == "create":
        key = create_key(args.name)
        print(json.dumps({"key": key, "name": args.name, "message": "请妥善保存，Key 仅显示一次"}, ensure_ascii=False))
        return 0
    elif action == "revoke":
        ok = revoke_key(args.key)
        if ok:
            print(json.dumps({"message": "Key 已吊销"}, ensure_ascii=False))
            return 0
        else:
            print(json.dumps({"error": "Key 不存在或已吊销"}, ensure_ascii=False))
            return 1
    elif action == "list":
        keys = list_keys()
        print(json.dumps(keys, ensure_ascii=False))
        return 0
    elif action == "stats":
        stats = get_route_stats(getattr(args, "date", None))
        print(json.dumps(stats, ensure_ascii=False, indent=2))
        return 0
    return 2


def cmd_suggest(args):
    _ensure_loaded()
    term = "".join(_t2s(c) for c in args.term)
    mode = args.mode

    if mode == "pair":
        print(json.dumps(_data["phrase_pairs"].get(term, []), ensure_ascii=False))
        return 0

    src = _data["phrase_head"] if mode == "head" else _data["phrase_tail"]
    entry = src.get(term, {})
    length = args.length
    tone = args.tone

    if length is None:
        print(json.dumps(entry, ensure_ascii=False))
        return 0

    len_data = entry.get(str(length), {})
    if tone in ("P", "Z"):
        print(json.dumps(len_data.get(tone, []), ensure_ascii=False))
    else:
        merged = {}
        for t in ["P", "Z"]:
            for w, c in len_data.get(t, []):
                merged[w] = max(merged.get(w, 0), c)
        print(json.dumps(sorted(merged.items(), key=lambda x: -x[1]), ensure_ascii=False))
    return 0


# ---------------------------------------------------------------------------
# 主入口
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(
        prog="fangcun",
        description="方寸 — 格律诗词校验工具 (Chinese classical poetry validator)",
    )
    sub = parser.add_subparsers(dest="command", required=True)

    # -- validate --
    p_val = sub.add_parser("validate", help="校验诗词格律 (validate tonal pattern & rhyme)")
    p_val.add_argument("--text", required=True, help="诗词文本")
    p_val.add_argument("--genre", required=True, choices=["Shi", "Ci"], help="体裁: Shi(诗) / Ci(词)")
    p_val.add_argument("--rhyme-book", default="Pingshuiyun",
                       choices=["Pingshuiyun", "Cilinzhengyun"], help="韵书 (default: Pingshuiyun)")
    p_val.add_argument("--rule", default=None, help="指定规则名 (可选)")
    p_val.add_argument("--longpu", action="store_true", help="仅匹配龙谱")
    p_val.add_argument("--pretty", action="store_true", help="人类可读输出")

    # -- rules --
    p_rules = sub.add_parser("rules", help="列出可用格律规则 (list available rules)")
    p_rules.add_argument("--genre", required=True, choices=["Shi", "Ci"], help="体裁")
    p_rules.add_argument("--search", default=None, help="按关键词搜索规则名")

    # -- char --
    p_char = sub.add_parser("char", help="查字声调与韵部 (character tone & rhyme lookup)")
    p_char.add_argument("--char", required=True, help="要查询的汉字")
    p_char.add_argument("--book", default=None, help="韵书名 (可选, 不指定则返回所有韵书)")

    # -- rhyme --
    p_rhyme = sub.add_parser("rhyme", help="查韵部字表 (browse rhyme category)")
    p_rhyme.add_argument("--book", required=True, choices=["Pingshuiyun", "Cilinzhengyun"], help="韵书")
    p_rhyme.add_argument("--category", required=True, help="韵部名 (如 一东)")
    p_rhyme.add_argument("--include", default=None, help="包含关联韵部, 逗号分隔 (如 neighbor,ye_ping)")

    # -- suggest --
    p_sug = sub.add_parser("suggest", help="词语/对仗联想 (phrase & couplet suggestions)")
    p_sug.add_argument("--term", required=True, help="查询词")
    p_sug.add_argument("--mode", required=True, choices=["head", "tail", "pair"], help="模式: head(首字)/tail(尾字)/pair(对仗)")
    p_sug.add_argument("--length", type=int, default=None, help="词语长度 (可选)")
    p_sug.add_argument("--tone", default=None, choices=["P", "Z"], help="声调过滤: P(平)/Z(仄)")

    # -- key --
    p_key = sub.add_parser("key", help="管理 API Key (create/revoke/list)")
    p_key_sub = p_key.add_subparsers(dest="key_action", required=True)
    p_key_create = p_key_sub.add_parser("create", help="创建新 API Key")
    p_key_create.add_argument("--name", required=True, help="Key 名称/用途说明")
    p_key_revoke = p_key_sub.add_parser("revoke", help="吊销 API Key")
    p_key_revoke.add_argument("--key", required=True, help="要吊销的完整 Key")
    p_key_sub.add_parser("list", help="列出所有 API Key")
    p_key_stats = p_key_sub.add_parser("stats", help="查看按路由的调用统计")
    p_key_stats.add_argument("--date", default=None, help="按日期过滤 (YYYY-MM-DD, UTC+8)")

    args = parser.parse_args()

    # 将 loader 的日志重定向到 stderr，保持 stdout 仅输出 JSON
    import io
    old_stdout = sys.stdout
    sys.stdout = sys.stderr
    try:
        if args.command == "validate":
            sys.stdout = old_stdout
            # validate 需要特殊处理: pretty 输出到 stdout, 加载日志到 stderr
            sys.stdout = sys.stderr
            _ensure_loaded()
            sys.stdout = old_stdout
            result = _data["checker"].check_auto(
                poem_text=args.text,
                genre=args.genre,
                rhyme_book_name=args.rhyme_book,
                ensure_longpu=args.longpu,
                rule_name=args.rule,
            )
            if args.pretty:
                print_pretty_result(result)
            else:
                print(json.dumps(_serialize_check_result(result), ensure_ascii=False))
            return 0 if result.is_valid else 1
        elif args.command == "key":
            sys.stdout = old_stdout
            return cmd_key(args)
        else:
            handler = {
                "rules": cmd_rules,
                "char": cmd_char,
                "rhyme": cmd_rhyme,
                "suggest": cmd_suggest,
            }[args.command]
            _ensure_loaded()
            sys.stdout = old_stdout
            return handler(args)
    except Exception as e:
        sys.stdout = old_stdout
        print(json.dumps({"error": str(e)}, ensure_ascii=False), file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main() or 0)
