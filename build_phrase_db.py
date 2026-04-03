#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
build_phrase_db.py
==================
从 4 份带 metadata 的诗词集中，统计生成可查询的 词首/词末/对语 数据库。
输出 3 个 JSON 文件到 static/config/ 目录。

用法:
    python build_phrase_db.py

数据来源:
    - data2_with_metadata.json         (历代诗词   ~453,033 首, list 格式)
    - poems_with_metadata.json         (私域诗词   ~3,081 首, dict 格式)

规则:
    - 词首/词末: 基于全部 ~456,114 首诗词的所有句子
      按邻字平仄分桶 (P=平/Z=仄)，可平可仄字归入两桶
    - 对语: 仅基于律诗 (closest_rule 以 "五律" 或 "七律" 开头)
            且仅提取颔联 (第3/4句) 和颈联 (第5/6句) 作为对仗行对

输出:
    - static/config/phrase_head.json   (词首索引，按邻字平仄分桶)
    - static/config/phrase_tail.json   (词末索引，按邻字平仄分桶)
    - static/config/phrase_pairs.json  (对语索引)
"""

import json
import os
import re
import sys
import time
from collections import Counter, defaultdict
from typing import List, Tuple, Dict, Set

# ============================================================================
# 配置参数
# ============================================================================

OUTPUT_DIR = "static/config"

# 诗词集文件列表
# dict 格式: {id: {content, closest_rule, ...}}
POEM_FILES_DICT = [
    "poems_with_metadata.json",
]
# list 格式: [{content, closest_rule, ...}, ...]
POEM_FILES_LIST = [
    "data2_with_metadata.json",
]

# 词首/词末: 每个查询字 × 每个长度 × 每个平仄桶 保留 top K 条
TOP_K_HEAD_TAIL = 100
MIN_COUNT_HEAD_TAIL = 2

# 对语: 每个查询词保留 top K 条
TOP_K_PAIR = 100
# 对语最低出现次数 (按 n-gram 长度分层，越长越要求高频才有意义)
MIN_COUNT_PAIR = {1: 3, 2: 2, 3: 2, 4: 2}

# 分句用的中文标点正则
PUNCT_RE = re.compile(r'[。，、；：！？…\.\,\;\:\!\?\n\r\s（）\(\)《》「」『』【】""''·]+')

# ============================================================================
# 汉字平仄查询
# ============================================================================

PING_TONES = {"平", "Ping", "ping", "yinping", "阴平", "yangping", "阳平"}
ZE_TONES = {"上", "去", "入"}

def load_char_dict() -> Dict:
    """加载 char_dict.json 用于邻字平仄判断"""
    filepath = os.path.join(OUTPUT_DIR, "char_dict.json")
    print(f"  [加载] {filepath} (平仄字典) ...", end=" ", flush=True)
    with open(filepath, 'r', encoding='utf-8') as f:
        data = json.load(f)
    print(f"{len(data)} 字")
    return data

def get_char_tone_class(char: str, char_dict: Dict) -> str:
    """
    获取单字的平仄类别:
      'P' = 纯平声
      'Z' = 纯仄声
      'A' = 可平可仄 (或查无此字)
    """
    info = char_dict.get(char)
    if not info or not info.get('tones'):
        return 'A'
    tones = info['tones']
    has_ping = any(t in PING_TONES for t in tones)
    has_ze = any(t in ZE_TONES for t in tones)
    if has_ping and has_ze:
        return 'A'
    if has_ping:
        return 'P'
    if has_ze:
        return 'Z'
    return 'A'

# ============================================================================
# 工具函数
# ============================================================================

def extract_lines(content: str) -> List[str]:
    """
    将诗词正文按标点分句，返回纯汉字行列表。
    只保留长度 >= 2 的行。
    """
    parts = PUNCT_RE.split(content)
    lines = []
    for part in parts:
        cleaned = ''.join(c for c in part if '\u4e00' <= c <= '\u9fff')
        if len(cleaned) >= 2:
            lines.append(cleaned)
    return lines


def extract_lushi_middle_pairs(lines: List[str]) -> List[Tuple[str, str]]:
    """
    从律诗的 8 句中提取中间两联（颔联 + 颈联）作为对仗行对。
    即第 3/4 句 (index 2,3) 和第 5/6 句 (index 4,5)。
    要求恰好 8 句且上下句等长。
    """
    if len(lines) != 8:
        return []
    pairs = []
    for i in [2, 4]:  # 颔联(2,3) 和 颈联(4,5)
        a, b = lines[i], lines[i + 1]
        if len(a) == len(b) and 2 <= len(a) <= 10:
            pairs.append((a, b))
    return pairs


def load_all_poems() -> Tuple[List[str], List[Tuple[str, str]], int, int]:
    """
    加载所有诗词集，返回:
      - all_contents: 所有诗词的 content (用于词首/词末)
      - lushi_pairs: 仅从律诗颔联/颈联提取的对仗行对 (用于对语)
      - total_poems: 总首数
      - lushi_count: 律诗首数
    """
    all_contents = []
    lushi_pairs = []
    total = 0
    lushi_count = 0

    def _process_poems(poems_iter, filepath):
        nonlocal total, lushi_count
        count = 0
        lv = 0
        for poem in poems_iter:
            content = poem.get('content', '')
            if not content:
                continue
            all_contents.append(content)
            count += 1
            rule = poem.get('closest_rule', '')
            if rule and (rule.startswith('五律') or rule.startswith('七律')):
                lines = extract_lines(content)
                pairs = extract_lushi_middle_pairs(lines)
                if pairs:
                    lushi_pairs.extend(pairs)
                    lv += 1
        total += count
        lushi_count += lv
        print(f"{count} 首 (其中律诗 {lv} 首)")

    for filepath in POEM_FILES_DICT:
        if not os.path.exists(filepath):
            print(f"  [跳过] {filepath} 不存在")
            continue
        print(f"  [加载] {filepath} ...", end=" ", flush=True)
        with open(filepath, 'r', encoding='utf-8') as f:
            data = json.load(f)
        _process_poems(data.values(), filepath)

    for filepath in POEM_FILES_LIST:
        if not os.path.exists(filepath):
            print(f"  [跳过] {filepath} 不存在")
            continue
        print(f"  [加载] {filepath} ...", end=" ", flush=True)
        with open(filepath, 'r', encoding='utf-8') as f:
            data = json.load(f)
        _process_poems(data, filepath)

    return all_contents, lushi_pairs, total, lushi_count


def save_json(filename: str, data):
    """保存 JSON 到 OUTPUT_DIR，使用紧凑格式。"""
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    filepath = os.path.join(OUTPUT_DIR, filename)
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, separators=(',', ':'))
    size_mb = os.path.getsize(filepath) / (1024 * 1024)
    print(f"  [保存] {filepath}  ({size_mb:.2f} MB)")
    return size_mb

# ============================================================================
# 构建 词首 索引 (按邻字平仄分桶)
# ============================================================================

def build_head_index(all_lines: List[str], char_dict: Dict) -> dict:
    """
    词首索引: 以首字为 key，按 n-gram 长度和邻字平仄分桶。
    
    邻字 = n-gram 的第 2 个字 (index 1)，即紧跟查询字之后的字。
    例: 查 "花" → "花开"(邻字"开"=平) → P桶, "花落"(邻字"落"=仄) → Z桶
    
    结构: {
      "花": {
        "2": { "P": [["花开", 253], ...], "Z": [["花落", 241], ...] },
        "3": { "P": [...], "Z": [...] },
        "4": { "P": [...], "Z": [...] }
      }
    }
    """
    print("\n[2/4] 构建词首索引 (按邻字平仄分桶) ...")
    # counters[char][n][tone_bucket] = Counter({gram: count})
    counters = defaultdict(lambda: defaultdict(lambda: defaultdict(Counter)))

    for line in all_lines:
        for n in [2, 3, 4]:
            if len(line) >= n:
                gram = line[:n]
                query_char = gram[0]
                neighbor_char = gram[1]  # 邻字 = 第2个字
                tone = get_char_tone_class(neighbor_char, char_dict)
                
                if tone == 'P':
                    counters[query_char][n]['P'][gram] += 1
                elif tone == 'Z':
                    counters[query_char][n]['Z'][gram] += 1
                else:  # 'A' 可平可仄 → 归入两桶
                    counters[query_char][n]['P'][gram] += 1
                    counters[query_char][n]['Z'][gram] += 1

    # 裁剪 + 排序
    index = {}
    for char, length_map in counters.items():
        entry = {}
        for n in [2, 3, 4]:
            if n in length_map:
                tone_entry = {}
                for tone_bucket in ['P', 'Z']:
                    if tone_bucket in length_map[n]:
                        top = [
                            [w, c] for w, c in length_map[n][tone_bucket].most_common(TOP_K_HEAD_TAIL)
                            if c >= MIN_COUNT_HEAD_TAIL
                        ]
                        if top:
                            tone_entry[tone_bucket] = top
                if tone_entry:
                    entry[str(n)] = tone_entry
        if entry:
            index[char] = entry

    print(f"  -> {len(index)} 个首字条目")
    return index

# ============================================================================
# 构建 词末 索引 (按邻字平仄分桶)
# ============================================================================

def build_tail_index(all_lines: List[str], char_dict: Dict) -> dict:
    """
    词末索引: 以末字为 key，按 n-gram 长度和邻字平仄分桶。
    
    邻字 = n-gram 的倒数第 2 个字 (index -2)，即紧邻查询字之前的字。
    例: 查 "花" → "繁花"(邻字"繁"=平) → P桶, "五月花"(邻字"月"=仄) → Z桶
    
    结构: 同 build_head_index
    """
    print("\n[3/4] 构建词末索引 (按邻字平仄分桶) ...")
    counters = defaultdict(lambda: defaultdict(lambda: defaultdict(Counter)))

    for line in all_lines:
        for n in [2, 3, 4]:
            if len(line) >= n:
                gram = line[-n:]
                query_char = gram[-1]
                neighbor_char = gram[-2]  # 邻字 = 倒数第2个字
                tone = get_char_tone_class(neighbor_char, char_dict)
                
                if tone == 'P':
                    counters[query_char][n]['P'][gram] += 1
                elif tone == 'Z':
                    counters[query_char][n]['Z'][gram] += 1
                else:  # 'A' → 归入两桶
                    counters[query_char][n]['P'][gram] += 1
                    counters[query_char][n]['Z'][gram] += 1

    index = {}
    for char, length_map in counters.items():
        entry = {}
        for n in [2, 3, 4]:
            if n in length_map:
                tone_entry = {}
                for tone_bucket in ['P', 'Z']:
                    if tone_bucket in length_map[n]:
                        top = [
                            [w, c] for w, c in length_map[n][tone_bucket].most_common(TOP_K_HEAD_TAIL)
                            if c >= MIN_COUNT_HEAD_TAIL
                        ]
                        if top:
                            tone_entry[tone_bucket] = top
                if tone_entry:
                    entry[str(n)] = tone_entry
        if entry:
            index[char] = entry

    print(f"  -> {len(index)} 个末字条目")
    return index

# ============================================================================
# 构建 对语 索引
# ============================================================================

def build_pair_index(all_pairs: List[Tuple[str, str]]) -> dict:
    """
    对语索引: 从对仗行对中提取同位置、同长度的 n-gram 对。
    
    双向存储: "明月"→"清泉" 和 "清泉"→"明月" 均记录。
    
    结构: { "明月": [["清泉", 45], ["落花", 12], ...] }
    """
    print("\n[4/4] 构建对语索引 ...")
    # pair_counter[phrase] = Counter({paired_phrase: count})
    pair_counter = defaultdict(Counter)

    for line_a, line_b in all_pairs:
        L = len(line_a)
        for n in [1, 2, 3, 4]:
            for start in range(L - n + 1):
                gram_a = line_a[start:start + n]
                gram_b = line_b[start:start + n]
                if gram_a != gram_b:  # 排除自身
                    pair_counter[gram_a][gram_b] += 1
                    pair_counter[gram_b][gram_a] += 1

    # 裁剪: 按 n-gram 长度使用分层阈值，每个 key 取 top K
    index = {}
    for phrase, counter in pair_counter.items():
        n = len(phrase)
        min_c = MIN_COUNT_PAIR.get(n, MIN_COUNT_PAIR.get(4, 5))
        top = [
            [w, c] for w, c in counter.most_common(TOP_K_PAIR)
            if c >= min_c
        ]
        if top:
            index[phrase] = top

    print(f"  -> {len(index)} 个对语条目")
    return index

# ============================================================================
# 主流程
# ============================================================================

def main():
    t0 = time.time()

    print("=" * 60)
    print("词首/词末/对语 数据库构建")
    print("=" * 60)

    # --- 0. 加载平仄字典 ---
    print("\n[0/4] 加载平仄字典 ...")
    char_dict = load_char_dict()

    # --- 1. 加载诗词 ---
    print("\n[1/4] 加载诗词集 ...")
    all_contents, lushi_pairs, total_poems, lushi_count = load_all_poems()
    print(f"  -> 共加载 {total_poems} 首, 其中律诗 {lushi_count} 首")
    print(f"  -> 律诗颔联+颈联行对: {len(lushi_pairs)} 对")

    # --- 1b. 提取所有行 (用于词首/词末) ---
    print("\n  提取全部句子 (词首/词末用) ...")
    all_lines = []
    for content in all_contents:
        all_lines.extend(extract_lines(content))

    print(f"  -> {len(all_lines)} 行")
    
    # 释放原始数据节省内存
    del all_contents

    # --- 2. 词首 ---
    head_index = build_head_index(all_lines, char_dict)

    # --- 3. 词末 ---
    tail_index = build_tail_index(all_lines, char_dict)

    # 释放 all_lines 节省内存
    del all_lines

    # --- 4. 对语 (仅律诗颔联+颈联) ---
    pair_index = build_pair_index(lushi_pairs)
    del lushi_pairs

    # --- 5. 保存 ---
    print("\n" + "-" * 60)
    print("保存结果:")
    s1 = save_json("phrase_head.json", head_index)
    s2 = save_json("phrase_tail.json", tail_index)
    s3 = save_json("phrase_pairs.json", pair_index)

    elapsed = time.time() - t0
    print(f"\n{'=' * 60}")
    print(f"全部完成! 耗时 {elapsed:.1f}s, 输出 {s1 + s2 + s3:.1f} MB")
    print(f"{'=' * 60}")


if __name__ == "__main__":
    main()
