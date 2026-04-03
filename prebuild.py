#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
prebuild.py — 部署前预处理
消除 wordfreq 和 opencc 的运行时依赖：
1. 预排序韵字：将 rhyme_books.json 中每个韵部的 characters 按 wordfreq 降序排好并去重
2. 预构建繁简映射：生成 t2s_map.json（繁体→简体，仅包含不同的字）

用法: python prebuild.py
"""

import json
import os
import sys
import site
sys.path.insert(0, site.getusersitepackages())

from wordfreq import word_frequency
import opencc

CFG = "static/config"

def presort_rhyme_books():
    """预排序韵字：按 wordfreq 降序，去重"""
    path = os.path.join(CFG, "rhyme_books.json")
    print(f"[1/2] 预排序韵字: {path}")
    with open(path, "r") as f:
        data = json.load(f)

    total_cats = 0
    for book_name, book in data.items():
        for cat_name, cat in book.get("categories", {}).items():
            chars = cat.get("characters", [])
            # 去重 + 按词频降序排序
            unique = list(set(chars))
            unique.sort(key=lambda c: -word_frequency(c, 'zh'))
            cat["characters"] = unique
            total_cats += 1

    with open(path, "w") as f:
        json.dump(data, f, ensure_ascii=False, separators=(',', ':'))

    print(f"  -> 处理 {total_cats} 个韵部，已写回")

def build_t2s_map():
    """预构建繁简映射表"""
    cc = opencc.OpenCC('t2s')
    path_out = os.path.join(CFG, "t2s_map.json")
    print(f"[2/2] 构建繁简映射: {path_out}")

    # 收集所有 CJK 字符的繁简对照
    # 范围: U+4E00 ~ U+9FFF (基本汉字) + U+3400 ~ U+4DBF (扩展A)
    t2s_map = {}
    for code in range(0x4E00, 0xA000):
        ch = chr(code)
        simplified = cc.convert(ch)
        if simplified != ch and len(simplified) == 1:
            t2s_map[ch] = simplified

    # 扩展A
    for code in range(0x3400, 0x4DC0):
        ch = chr(code)
        simplified = cc.convert(ch)
        if simplified != ch and len(simplified) == 1:
            t2s_map[ch] = simplified

    with open(path_out, "w") as f:
        json.dump(t2s_map, f, ensure_ascii=False, separators=(',', ':'))

    size_kb = os.path.getsize(path_out) / 1024
    print(f"  -> {len(t2s_map)} 个繁简映射，{size_kb:.1f} KB")

if __name__ == "__main__":
    presort_rhyme_books()
    build_t2s_map()
    print("\n预处理完成。")
