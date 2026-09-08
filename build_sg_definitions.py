#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
build_sg_definitions.py — 上古释义数据构建（v1）

从 PBOC9.5诗经楚辞韵.xlsx 的 ZidianBiao「釋義」列提取每字上古释义，
生成 shiva static/config/sg_char_definitions.json：

  { "夫": ["成年男子。《說文》：……", "百畝。……", ...], ... }

规则：
  1. 同一字的多行（不同上古读音）释義大多互不相同（行=行列/行走/辈分…），
     全部保留；义项按「\n + 数字」行拆开并去除行首编号；完全相同的义项
     只保留一次（去重保序）。
  2. 释义文本保留繁体原文（古籍引文忠实原貌，不做 t2s）。
  3. 字头简体化与 char_dict 同口径：乾坤之「乾」保留；opencc 会把部分
     BMP 繁体转成扩展B（鴀→𫛜 等）→ 回退原字；非 BMP 字头本身剔除。
  4. 用户口径：不区分诗经/楚辞（双套共用一份上古释义），每字仅一份。

用法:
  python build_sg_definitions.py                 # 输出到本仓库 static/config
  python build_sg_definitions.py --out <path.json>
"""

import argparse
import json
import re
import sys

from openpyxl import load_workbook
from opencc import OpenCC

_T2S = OpenCC("t2s")

DEFAULT_INPUT = "/Users/lyy0323/Downloads/PBOC9.5诗经楚辞韵 .xlsx"
DEFAULT_OUT = "static/config/sg_char_definitions.json"

_COL_CHAR = "字"
_COL_DEF = "釋義"

# 编号行：行首「数字 + 空格/全角空白」
_LEAD_NUM = re.compile(r"^\s*\d+[\.、．\s]\s*")


def simplify_ch(ch: str) -> str:
    """字头简体化（与 build_shangguyun_db._simplify_ch 同口径）。"""
    if not ch:
        return ch
    out = _T2S.convert(ch)
    if "乾" in ch:
        out = out.replace("干", "乾")
    if out and ord(out) > 0xFFFF:
        return ch  # opencc 转出扩展B → 回退原字形
    return out


def split_items(raw: str) -> list[str]:
    """按行拆义项并去编号前缀；保留无编号单行原文。"""
    if not raw:
        return []
    items: list[str] = []
    for line in raw.replace("\r\n", "\n").split("\n"):
        t = line.strip()
        if not t:
            continue
        t = _LEAD_NUM.sub("", t).strip()
        if t:
            items.append(t)
    return items


def build(input_path: str):
    wb = load_workbook(input_path, read_only=True, data_only=True)
    ws = wb["ZidianBiao"]
    header = [c.value for c in next(ws.iter_rows(min_row=1, max_row=1))]
    idx = {h: i for i, h in enumerate(header)}
    for col in (_COL_CHAR, _COL_DEF):
        if col not in idx:
            raise SystemExit(f"[错误] ZidianBiao 缺少列: {col}")

    chars: dict[str, dict[str, None]] = {}  # 简体字 -> 有序义项 dict(去重)
    stats = {"rows": 0, "with_def": 0, "empty_def": 0, "dropped_non_bmp": 0}

    for row in ws.iter_rows(min_row=2, values_only=True):
        stats["rows"] += 1
        raw_ch = str(row[idx[_COL_CHAR]] or "").strip()
        raw_def = str(row[idx[_COL_DEF]] or "").strip()
        if not raw_ch:
            continue
        ch = simplify_ch(raw_ch)
        if not ch or ord(ch) > 0xFFFF:
            stats["dropped_non_bmp"] += 1
            continue
        if not raw_def:
            stats["empty_def"] += 1
            continue
        items = split_items(raw_def)
        if not items:
            stats["empty_def"] += 1
            continue
        stats["with_def"] += 1
        bucket = chars.setdefault(ch, {})
        for it in items:
            bucket.setdefault(it, None)  # 保序去重

    result = {ch: list(items) for ch, items in chars.items()}
    total_items = sum(len(v) for v in result.values())
    print(f"[统计] 行 {stats['rows']} | 有释义行 {stats['with_def']} | "
          f"空释义 {stats['empty_def']} | 非BMP剔除 {stats['dropped_non_bmp']}")
    print(f"[统计] 字头 {len(result)} | 义项总条数 {total_items}")
    return result


def main():
    ap = argparse.ArgumentParser(description="构建上古释义数据")
    ap.add_argument("--input", default=DEFAULT_INPUT)
    ap.add_argument("--out", default=DEFAULT_OUT)
    args = ap.parse_args()
    result = build(args.input)
    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False)
    print(f"[写入] {args.out}")


if __name__ == "__main__":
    sys.exit(main())
