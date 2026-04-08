#!/usr/bin/env python3
"""
从 core_structure_09.jsonl 构建典故检索数据库。

输入: data/core_structure_09.jsonl
输出: static/config/allusion_index.json   (字→条目ID 倒排索引)
      static/config/allusion_entries.json  (条目扁平数组)

用法: python build_allusion_db.py
"""

import json
import os
import re

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
INPUT_PATH = os.path.join(SCRIPT_DIR, "data", "core_structure_09.jsonl")
CONFIG_DIR = os.path.join(SCRIPT_DIR, "static", "config")
T2S_PATH = os.path.join(CONFIG_DIR, "t2s_map.json")
INDEX_OUT = os.path.join(CONFIG_DIR, "allusion_index.json")
ENTRIES_OUT = os.path.join(CONFIG_DIR, "allusion_entries.json")

SRC_TEXT_MAX = 300  # 典源内容截断长度
EXAMPLE_MAX = 100   # 单条例句截断长度


def load_t2s():
    with open(T2S_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def t2s_convert(text, t2s_map):
    return "".join(t2s_map.get(c, c) for c in text)


def strip_html(text):
    """去除 <u> 等 HTML 标签"""
    return re.sub(r"</?[a-zA-Z][^>]*>", "", text)


def strip_trailing_digits(w):
    """去除典形词末尾数字后缀: '焚书坑儒1' → '焚书坑儒'"""
    return re.sub(r"\d+$", "", w)


def truncate(text, max_len):
    if len(text) <= max_len:
        return text
    return text[:max_len] + "……"


def build():
    t2s_map = load_t2s()

    with open(INPUT_PATH, "r", encoding="utf-8") as f:
        raw_entries = [json.loads(line) for line in f if line.strip()]

    print(f"读取 {len(raw_entries)} 条典源")

    # 阶段 1: 遍历所有条目, 按 (normalized_典形词) 聚合
    # key: normalized word -> { w, definitions, src, src_text, related_words, examples }
    aggregated = {}  # word -> entry dict

    for raw in raw_entries:
        src_word = strip_html(raw["典源词"])
        src_text = truncate(strip_html(raw["典源内容"]), SRC_TEXT_MAX)

        for deriv in raw["衍生列表"]:
            w_raw = strip_trailing_digits(deriv["典形词"])
            w = t2s_convert(w_raw, t2s_map)
            definition = strip_html(deriv["释义"])

            # 收集同源典形词和例句
            related_words = []
            examples = []
            for tongyuan in deriv.get("同源列表", []):
                rw = t2s_convert(strip_trailing_digits(tongyuan["典形词"]), t2s_map)
                if rw != w:
                    related_words.append(rw)
                for ex in tongyuan.get("例句", []):
                    cleaned = strip_html(ex).strip()
                    if cleaned:
                        examples.append(truncate(cleaned, EXAMPLE_MAX))

            if w in aggregated:
                # 合并同名典形词
                existing = aggregated[w]
                if definition not in existing["definitions"]:
                    existing["definitions"].append(definition)
                for rw in related_words:
                    if rw not in existing["related_set"]:
                        existing["related_set"].add(rw)
                        existing["related_words"].append(rw)
                for ex in examples:
                    if len(existing["examples"]) < 5 and ex not in existing["examples"]:
                        existing["examples"].append(ex)
            else:
                aggregated[w] = {
                    "w": w,
                    "definitions": [definition],
                    "src": src_word,
                    "src_text": src_text,
                    "related_words": related_words,
                    "related_set": set(related_words),
                    "examples": examples[:5],
                }

    print(f"聚合后 {len(aggregated)} 个唯一典形词")

    # 阶段 2: 为同源典形词补充释义 (从 aggregated 中查找)
    # 阶段 3: 构建条目数组和倒排索引
    entries = []
    char_index = {}  # char -> [entry_id, ...]

    for idx, (w, agg) in enumerate(sorted(aggregated.items(), key=lambda x: x[0])):
        # 构建 related 列表 (附带释义)
        related = []
        for rw in agg["related_words"]:
            rd = ""
            if rw in aggregated:
                rd = "；".join(aggregated[rw]["definitions"])
            related.append({"w": rw, "d": rd})

        entry = {
            "id": idx,
            "w": w,
            "d": "；".join(agg["definitions"]),
            "src": agg["src"],
            "src_text": agg["src_text"],
            "related": related,
            "examples": agg["examples"],
            "rc": len(related),
        }
        entries.append(entry)

        # 倒排索引: 每个字 → 条目 ID
        for ch in set(w):
            if "\u4e00" <= ch <= "\u9fff":
                char_index.setdefault(ch, []).append(idx)

    # 排序索引中的 ID 列表
    for ch in char_index:
        char_index[ch].sort()

    print(f"构建完成: {len(entries)} 条目, {len(char_index)} 个索引字")

    # 写出
    with open(ENTRIES_OUT, "w", encoding="utf-8") as f:
        json.dump(entries, f, ensure_ascii=False, separators=(",", ":"))
    print(f"写出 {ENTRIES_OUT} ({os.path.getsize(ENTRIES_OUT) / 1024 / 1024:.1f} MB)")

    with open(INDEX_OUT, "w", encoding="utf-8") as f:
        json.dump(char_index, f, ensure_ascii=False, separators=(",", ":"))
    print(f"写出 {INDEX_OUT} ({os.path.getsize(INDEX_OUT) / 1024 / 1024:.1f} MB)")


if __name__ == "__main__":
    build()
