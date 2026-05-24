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
import http.client
import json
import os
import ssl
import sys
import urllib.parse
from concurrent.futures import ThreadPoolExecutor, as_completed

CHECKER_URL = os.environ.get("FANGCUN_CHECKER_URL", "https://checker.sjtuguoxue.space")
DICT_URL = os.environ.get("FANGCUN_DICT_URL", "https://write.sjtuguoxue.space")

_ctx = ssl.create_default_context()
_conns: dict[str, http.client.HTTPSConnection] = {}


def _conn(base: str) -> http.client.HTTPSConnection:
    parsed = urllib.parse.urlparse(base)
    host = parsed.hostname
    port = parsed.port or 443
    key = f"{host}:{port}"
    c = _conns.get(key)
    if c:
        try:
            c.request("HEAD", "/", headers={"Connection": "keep-alive"})
            c.getresponse().read()
            return c
        except Exception:
            try:
                c.close()
            except Exception:
                pass
    c = http.client.HTTPSConnection(host, port, timeout=15, context=_ctx)
    _conns[key] = c
    return c


def _get(base: str, path: str):
    try:
        c = _conn(base)
        c.request("GET", path, headers={"Connection": "keep-alive"})
        resp = c.getresponse()
        body = resp.read()
        return json.loads(body)
    except Exception as e:
        return {"error": str(e)}


def _post(base: str, path: str, data: dict):
    try:
        c = _conn(base)
        body = json.dumps(data).encode()
        c.request("POST", path, body=body, headers={
            "Content-Type": "application/json",
            "Connection": "keep-alive",
        })
        resp = c.getresponse()
        return json.loads(resp.read())
    except Exception as e:
        return {"error": str(e)}


def _get_fresh(base: str, path: str):
    parsed = urllib.parse.urlparse(base)
    c = http.client.HTTPSConnection(parsed.hostname, parsed.port or 443, timeout=15, context=_ctx)
    try:
        c.request("GET", path)
        return json.loads(c.getresponse().read())
    except Exception as e:
        return {"error": str(e)}
    finally:
        c.close()


def _get_many(base: str, paths: list[str]) -> list:
    if len(paths) <= 1:
        return [_get(base, paths[0])] if paths else []
    with ThreadPoolExecutor(max_workers=min(len(paths), 8)) as pool:
        futs = [pool.submit(_get_fresh, base, p) for p in paths]
        return [f.result() for f in futs]


# ---------------------------------------------------------------------------
# validate
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
    if args.include_punctuation:
        payload["include_punctuation"] = True
    if args.warnings:
        payload["warnings"] = args.warnings if len(args.warnings) > 1 else args.warnings[0]

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
    R, G, X = "\033[91m", "\033[92m", "\033[0m"
    tone_map = {"P": "平", "Z": "仄", "A": "中", "?": "?"}

    rule = result.get("closest_rule")
    print(f"\n{'='*60}")
    if rule:
        print(f"体裁: {rule['name']}")
    if result.get("rhyme_name"):
        print(f"押韵: {result['rhyme_name']}")
    print(f"结果: {'通过' if result.get('is_valid') else '不通过'}")

    err_pos = {e["position"] for e in result.get("errors", [])}
    rhy_pos = set(result.get("rhyme_positions") or [])

    for seg in result.get("display_segments", []):
        tl, rl = "", ""
        for i, ch in enumerate(seg["text_chars"]):
            gi = seg["start_index"] + i
            tl += f"{R}{ch}{X}" if gi in err_pos else ch
            item = seg["rule_items"][i] if i < len(seg["rule_items"]) else {}
            rl += tone_map.get(item.get("tone", "?"), "?")
            if gi in rhy_pos:
                tl += "　"
                rl += f"{G}韵{X}"
        print(f"\n{tl}")
        print(rl)

    if result.get("errors"):
        print(f"\n--- 错误 ({len(result['errors'])}) ---")
        for e in result["errors"]:
            exp, act = e.get("expected", ""), e.get("actual", "")
            d = f" (expected={exp}, actual={act})" if exp else ""
            print(f"  [{e['position']:>3d}] {e['character']}  {e['message']}{d}")
    elif result.get("is_valid"):
        print("\n--- 格律通过 ---")
    print(f"{'='*60}\n")


# ---------------------------------------------------------------------------
# rules
# ---------------------------------------------------------------------------

def cmd_rules(args):
    path = f"/api/rules/list?genre={args.genre}"
    if args.search:
        path += f"&search={urllib.parse.quote(args.search)}"
    print(json.dumps(_get(CHECKER_URL, path), ensure_ascii=False))
    return 0


# ---------------------------------------------------------------------------
# char — 批量查询（单字走 lookup，多字走 batch）
# ---------------------------------------------------------------------------

def cmd_char(args):
    chars = list(args.char)
    book = args.book

    if len(chars) == 1:
        bk = f"&book={urllib.parse.quote(book)}" if book else ""
        print(json.dumps(_get(CHECKER_URL, f"/api/char/lookup?char={urllib.parse.quote(chars[0])}{bk}"), ensure_ascii=False))
        return 0

    payload = {"chars": chars}
    if book:
        payload["book"] = book
    raw = _post(CHECKER_URL, "/api/char/batch", payload)

    if isinstance(raw, dict) and "error" in raw:
        print(json.dumps(raw, ensure_ascii=False))
        return 2

    results = []
    for r in raw:
        tones = r.get("tones", [])
        tone = "P" if tones == ["平"] else ("Z" if tones and all(t != "平" for t in tones) else "?")
        entry = {"char": r.get("char", ""), "tones": tones, "tone": tone}
        if book:
            cats = r.get("rhyme_categories", [])
            entry["rhymes"] = [c["name"] for c in cats] if isinstance(cats, list) else cats
        results.append(entry)
    print(json.dumps(results, ensure_ascii=False))
    return 0


# ---------------------------------------------------------------------------
# rhyme
# ---------------------------------------------------------------------------

def cmd_rhyme(args):
    path = f"/api/rhyme/lookup?book={urllib.parse.quote(args.book)}&category={urllib.parse.quote(args.category)}"
    if args.include:
        path += f"&include={urllib.parse.quote(args.include)}"
    if args.limit is not None:
        path += f"&limit={args.limit}"
    if args.offset is not None:
        path += f"&offset={args.offset}"
    result = _get(CHECKER_URL, path)
    print(json.dumps(result, ensure_ascii=False))
    return 0 if "error" not in result else 2


# ---------------------------------------------------------------------------
# suggest — 并发获取声调
# ---------------------------------------------------------------------------

def cmd_suggest(args):
    term = urllib.parse.quote(args.term)
    path = f"/api/dictionary/search?term={term}&mode={args.mode}"
    if args.length is not None:
        path += f"&length={args.length}"
    if args.tone:
        path += f"&tone={args.tone}"
    if args.limit is not None:
        path += f"&limit={args.limit}"
    if args.offset is not None:
        path += f"&offset={args.offset}"

    result = _get(DICT_URL, path)

    if isinstance(result, dict) and "error" in result:
        print(json.dumps(result, ensure_ascii=False))
        return 2

    if not args.with_tones or not isinstance(result, list):
        print(json.dumps(result, ensure_ascii=False))
        return 0

    items = result[:30]
    all_chars = set()
    for item in items:
        word = item[0] if isinstance(item, (list, tuple)) else item
        all_chars.update(word)

    char_list = list(all_chars)
    batch = _post(CHECKER_URL, "/api/char/batch", {"chars": char_list})

    tone_map = {}
    if isinstance(batch, list):
        for r in batch:
            ch = r.get("char", "")
            t = r.get("tones", [])
            tone_map[ch] = "P" if t == ["平"] else ("Z" if t and all(x != "平" for x in t) else "?")

    enhanced = []
    for item in items:
        word = item[0] if isinstance(item, (list, tuple)) else item
        freq = item[1] if isinstance(item, (list, tuple)) and len(item) > 1 else 0
        tones = "".join(tone_map.get(c, "?") for c in word)
        enhanced.append([word, freq, tones])
    print(json.dumps(enhanced, ensure_ascii=False))
    return 0


# ---------------------------------------------------------------------------
# free-rhyme — 自由韵脚检测
# ---------------------------------------------------------------------------

def cmd_free_rhyme(args):
    text = args.text
    lines = [l.strip() for l in text.replace("。", "\n").replace("！", "\n").replace("？", "\n").replace("；", "\n").split("\n") if l.strip()]
    if not lines:
        print(json.dumps({"error": "无有效诗句"}, ensure_ascii=False))
        return 2

    payload = {"lines": lines, "rhyme_book_name": args.rhyme_book}
    if args.merge_tones:
        payload["merge_tones"] = True

    result = _post(CHECKER_URL, "/api/free_rhyme", payload)

    if "error" in result and "candidates" not in result:
        print(json.dumps(result, ensure_ascii=False))
        return 2

    if args.pretty:
        candidates = result.get("candidates", [])
        groups = result.get("groups", [])
        print(f"\n韵脚候选 ({len(candidates)} 个):")
        for c in candidates:
            cats = ", ".join(c.get("categories", [])) or "无韵部"
            print(f"  第{c['line']+1}句 [{c['char']}] {cats}")
        if groups:
            print(f"\n押韵组 ({len(groups)} 组):")
            for i, g in enumerate(groups, 1):
                pos_strs = [f"第{p['line']+1}句" for p in g["positions"]]
                print(f"  组{i}: {' - '.join(pos_strs)}")
        else:
            print("\n未检测到押韵关系")
        print()
    else:
        print(json.dumps(result, ensure_ascii=False))
    return 0


# ---------------------------------------------------------------------------
# main
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(
        prog="fangcun",
        description="方寸 — 格律诗词校验工具 (Chinese classical poetry validator)",
        epilog=f"checker: {CHECKER_URL}  dict: {DICT_URL}",
    )
    sub = parser.add_subparsers(dest="command", required=True)

    p = sub.add_parser("validate", help="校验诗词格律")
    p.add_argument("--text", required=True, help="诗词文本（标点自动忽略）")
    p.add_argument("--genre", required=True, choices=["Shi", "Ci"])
    p.add_argument("--rhyme-book", default="Pingshuiyun", choices=["Pingshuiyun", "Cilinzhengyun", "Zhonghua_Tongyun"])
    p.add_argument("--rule", default=None, help="指定规则名")
    p.add_argument("--longpu", action="store_true")
    p.add_argument("--include-punctuation", action="store_true", help="检测句读标点（poem_text 需带标点）")
    p.add_argument("--warnings", nargs="+", choices=["default", "2gram", "rhyme_duplicate", "none"], help="重字检测模式")
    p.add_argument("--pretty", action="store_true", help="彩色人类可读输出")

    p = sub.add_parser("rules", help="列出格律规则")
    p.add_argument("--genre", required=True, choices=["Shi", "Ci"])
    p.add_argument("--search", default=None)

    p = sub.add_parser("char", help="查字声调与韵部（支持多字）")
    p.add_argument("--char", required=True, help="汉字（单字或多字如「明月」）")
    p.add_argument("--book", default=None)

    p = sub.add_parser("rhyme", help="查韵部字表")
    p.add_argument("--book", required=True, choices=["Pingshuiyun", "Cilinzhengyun", "Zhonghua_Tongyun"])
    p.add_argument("--category", required=True, help="韵部名（如 一东）")
    p.add_argument("--include", default=None)
    p.add_argument("--limit", type=int, default=None, help="返回字数上限")
    p.add_argument("--offset", type=int, default=None, help="跳过前 N 个字")

    p = sub.add_parser("suggest", help="词语/对仗联想")
    p.add_argument("--term", required=True)
    p.add_argument("--mode", required=True, choices=["head", "tail", "pair", "tongwei"])
    p.add_argument("--length", type=int, default=None)
    p.add_argument("--tone", default=None, choices=["P", "Z"])
    p.add_argument("--limit", type=int, default=None, help="返回结果数上限")
    p.add_argument("--offset", type=int, default=None, help="跳过前 N 条结果")
    p.add_argument("--with-tones", action="store_true", help="附带逐字声调标注")

    p = sub.add_parser("free-rhyme", help="自由诗/古体诗韵脚检测")
    p.add_argument("--text", required=True, help="诗文（句号/分号/换行自动分句）")
    p.add_argument("--rhyme-book", default="Pingshuiyun", choices=["Pingshuiyun", "Cilinzhengyun", "Zhonghua_Tongyun"])
    p.add_argument("--merge-tones", action="store_true", help="合并平仄（新诗/歌词用）")
    p.add_argument("--pretty", action="store_true", help="人类可读输出")

    args = parser.parse_args()
    try:
        return {"validate": cmd_validate, "rules": cmd_rules, "char": cmd_char, "rhyme": cmd_rhyme, "suggest": cmd_suggest, "free-rhyme": cmd_free_rhyme}[args.command](args)
    except Exception as e:
        print(json.dumps({"error": str(e)}, ensure_ascii=False), file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main() or 0)
