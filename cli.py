#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
方寸 (fangcun) — 格律诗词校验 CLI
供 AI Agent 以 tool-use 模式调用。

子命令:
    validate  校验格律（返回逐字平仄谱 + 结构化错误）
    rules     列出格律规则
    char      查字声调与韵部（支持多字批量）
    rhyme     查韵部字表
    suggest   词语/对仗联想（含声调标注）

所有查询通过线上 checker 服务完成，无需本地数据文件。
环境变量 FANGCUN_CHECKER_URL 可覆盖默认地址。
环境变量 FANGCUN_DICT_URL 可覆盖词库服务地址。
"""

import argparse
import json
import os
import sys
import urllib.request
import urllib.error
import urllib.parse

CHECKER_URL = os.environ.get("FANGCUN_CHECKER_URL", "https://checker.sjtuguoxue.space")
DICT_URL = os.environ.get("FANGCUN_DICT_URL", "https://write.sjtuguoxue.space")


# ---------------------------------------------------------------------------
# HTTP 客户端
# ---------------------------------------------------------------------------

def _get(base: str, path: str):
    url = f"{base}{path}"
    try:
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req, timeout=15) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        body = e.read().decode(errors="replace")
        try:
            return json.loads(body)
        except Exception:
            return {"error": f"HTTP {e.code}: {body[:200]}"}
    except urllib.error.URLError as e:
        return {"error": f"连接失败: {e.reason}", "hint": f"检查网络或设置 FANGCUN_CHECKER_URL 环境变量（当前: {base}）"}


def _post(base: str, path: str, data: dict):
    url = f"{base}{path}"
    body = json.dumps(data).encode()
    try:
        req = urllib.request.Request(url, data=body, headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=15) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        resp_body = e.read().decode(errors="replace")
        try:
            return json.loads(resp_body)
        except Exception:
            return {"error": f"HTTP {e.code}: {resp_body[:200]}"}
    except urllib.error.URLError as e:
        return {"error": f"连接失败: {e.reason}", "hint": f"检查网络或设置 FANGCUN_CHECKER_URL 环境变量（当前: {base}）"}


# ---------------------------------------------------------------------------
# validate — 核心检测
# ---------------------------------------------------------------------------

def cmd_validate(args):
    payload = {
        "poem_text": args.text,
        "genre": args.genre,
        "rhyme_book_name": args.rhyme_book,
    }
    if args.rule:
        payload["rule_name"] = args.rule
    if args.longpu:
        payload["ensure_longpu"] = True

    result = _post(CHECKER_URL, "/api/validate_meter", payload)

    if "error" in result and "is_valid" not in result:
        print(json.dumps(result, ensure_ascii=False))
        return 2

    if args.pretty:
        _pretty_print(result)
    else:
        out = {
            "is_valid": result.get("is_valid"),
            "rule": result.get("closest_rule"),
            "chars": result.get("chars", []),
            "tone_pattern": result.get("tone_pattern", []),
            "rhyme": {
                "name": result.get("rhyme_name"),
                "positions": result.get("rhyme_positions"),
                "chars": result.get("rhyme_chars"),
            },
            "errors": result.get("errors", []),
            "warnings": result.get("warnings", []),
        }
        print(json.dumps(out, ensure_ascii=False))

    return 0 if result.get("is_valid") else 1


def _pretty_print(result):
    RED = "\033[91m"
    GREEN = "\033[92m"
    RESET = "\033[0m"
    EM = "　"
    tone_map = {"P": "平", "Z": "仄", "A": "中", "?": "?"}

    rule = result.get("closest_rule")
    print(f"\n{'='*60}")
    if rule:
        print(f"体裁: {rule['name']}")
    rhyme_name = result.get("rhyme_name")
    if rhyme_name:
        print(f"押韵: {rhyme_name}")
    print(f"结果: {'通过' if result.get('is_valid') else '不通过'}")

    error_positions = {e["position"] for e in result.get("errors", [])}
    rhyme_positions = set(result.get("rhyme_positions") or [])

    for seg in result.get("display_segments", []):
        text_line = ""
        rule_line = ""
        for i, ch in enumerate(seg["text_chars"]):
            gi = seg["start_index"] + i
            if gi in error_positions:
                text_line += f"{RED}{ch}{RESET}"
            else:
                text_line += ch
            item = seg["rule_items"][i] if i < len(seg["rule_items"]) else {}
            rule_line += tone_map.get(item.get("tone", "?"), "?")
            if gi in rhyme_positions:
                text_line += EM
                rule_line += f"{GREEN}韵{RESET}"
        print(f"\n{text_line}")
        print(rule_line)

    if result.get("errors"):
        print(f"\n--- 错误 ({len(result['errors'])}) ---")
        for e in result["errors"]:
            exp = e.get("expected", "")
            act = e.get("actual", "")
            detail = f" (expected={exp}, actual={act})" if exp else ""
            print(f"  [{e['position']:>3d}] {e['character']}  {e['message']}{detail}")
    elif result.get("is_valid"):
        print("\n--- 格律通过 ---")
    print(f"{'='*60}\n")


# ---------------------------------------------------------------------------
# rules — 规则列表
# ---------------------------------------------------------------------------

def cmd_rules(args):
    path = f"/api/rules/list?genre={args.genre}"
    if args.search:
        path += f"&search={urllib.parse.quote(args.search)}"
    result = _get(CHECKER_URL, path)
    print(json.dumps(result, ensure_ascii=False))
    return 0


# ---------------------------------------------------------------------------
# char — 单字/多字音韵查询
# ---------------------------------------------------------------------------

def cmd_char(args):
    chars = list(args.char)
    book_param = f"&book={urllib.parse.quote(args.book)}" if args.book else ""

    if len(chars) == 1:
        result = _get(CHECKER_URL, f"/api/char/lookup?char={urllib.parse.quote(chars[0])}{book_param}")
        print(json.dumps(result, ensure_ascii=False))
    else:
        results = []
        for ch in chars:
            r = _get(CHECKER_URL, f"/api/char/lookup?char={urllib.parse.quote(ch)}{book_param}")
            if "error" not in r:
                tones = r.get("tones", [])
                tone = "P" if tones == ["平"] else ("Z" if tones and all(t != "平" for t in tones) else "?")
                entry = {"char": ch, "tones": tones, "tone": tone}
                if args.book:
                    cats = r.get("rhyme_categories", [])
                    entry["rhymes"] = [c["name"] for c in cats] if isinstance(cats, list) else cats
                results.append(entry)
            else:
                results.append({"char": ch, "tones": [], "tone": "?"})
        print(json.dumps(results, ensure_ascii=False))
    return 0


# ---------------------------------------------------------------------------
# rhyme — 韵部字表
# ---------------------------------------------------------------------------

def cmd_rhyme(args):
    path = f"/api/rhyme/lookup?book={urllib.parse.quote(args.book)}&category={urllib.parse.quote(args.category)}"
    if args.include:
        path += f"&include={urllib.parse.quote(args.include)}"
    result = _get(CHECKER_URL, path)
    print(json.dumps(result, ensure_ascii=False))
    return 0 if "error" not in result else 2


# ---------------------------------------------------------------------------
# suggest — 词语联想
# ---------------------------------------------------------------------------

def cmd_suggest(args):
    term = urllib.parse.quote(args.term)
    path = f"/api/dictionary/search?term={term}&mode={args.mode}"
    if args.length is not None:
        path += f"&length={args.length}"
    if args.tone:
        path += f"&tone={args.tone}"

    result = _get(DICT_URL, path)

    if isinstance(result, dict) and "error" in result:
        print(json.dumps(result, ensure_ascii=False))
        return 2

    if args.with_tones and isinstance(result, list):
        enhanced = []
        for item in result[:30]:
            word = item[0] if isinstance(item, (list, tuple)) else item
            freq = item[1] if isinstance(item, (list, tuple)) and len(item) > 1 else 0
            tones = ""
            for ch in word:
                r = _get(CHECKER_URL, f"/api/char/lookup?char={urllib.parse.quote(ch)}")
                t = r.get("tones", [])
                tones += "P" if t == ["平"] else ("Z" if t and all(x != "平" for x in t) else "?")
            enhanced.append([word, freq, tones])
        print(json.dumps(enhanced, ensure_ascii=False))
    else:
        print(json.dumps(result, ensure_ascii=False))
    return 0


# ---------------------------------------------------------------------------
# 主入口
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(
        prog="fangcun",
        description="方寸 — 格律诗词校验工具 (Chinese classical poetry validator)",
        epilog=f"checker: {CHECKER_URL}  dict: {DICT_URL}",
    )
    sub = parser.add_subparsers(dest="command", required=True)

    p_val = sub.add_parser("validate", help="校验诗词格律")
    p_val.add_argument("--text", required=True, help="诗词文本（标点自动忽略）")
    p_val.add_argument("--genre", required=True, choices=["Shi", "Ci"], help="Shi(诗) / Ci(词)")
    p_val.add_argument("--rhyme-book", default="Pingshuiyun", choices=["Pingshuiyun", "Cilinzhengyun", "Zhonghua_Tongyun"])
    p_val.add_argument("--rule", default=None, help="指定规则名")
    p_val.add_argument("--longpu", action="store_true", help="仅匹配龙谱")
    p_val.add_argument("--pretty", action="store_true", help="彩色人类可读输出")

    p_rules = sub.add_parser("rules", help="列出格律规则")
    p_rules.add_argument("--genre", required=True, choices=["Shi", "Ci"])
    p_rules.add_argument("--search", default=None, help="按名称/词牌搜索")

    p_char = sub.add_parser("char", help="查字声调与韵部（支持多字）")
    p_char.add_argument("--char", required=True, help="汉字（单字或多字如「明月」）")
    p_char.add_argument("--book", default=None, help="韵书名")

    p_rhyme = sub.add_parser("rhyme", help="查韵部字表")
    p_rhyme.add_argument("--book", required=True, choices=["Pingshuiyun", "Cilinzhengyun", "Zhonghua_Tongyun"])
    p_rhyme.add_argument("--category", required=True, help="韵部名（如 一东）")
    p_rhyme.add_argument("--include", default=None, help="关联韵部（如 neighbor,ye_ping）")

    p_sug = sub.add_parser("suggest", help="词语/对仗联想")
    p_sug.add_argument("--term", required=True, help="查询词")
    p_sug.add_argument("--mode", required=True, choices=["head", "tail", "pair", "tongwei"])
    p_sug.add_argument("--length", type=int, default=None)
    p_sug.add_argument("--tone", default=None, choices=["P", "Z"])
    p_sug.add_argument("--with-tones", action="store_true", help="附带逐字声调标注")

    args = parser.parse_args()
    handler = {"validate": cmd_validate, "rules": cmd_rules, "char": cmd_char, "rhyme": cmd_rhyme, "suggest": cmd_suggest}
    try:
        return handler[args.command](args)
    except Exception as e:
        print(json.dumps({"error": str(e)}, ensure_ascii=False), file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main() or 0)
