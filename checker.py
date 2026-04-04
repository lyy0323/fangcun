#!/usr/bin/env python
# -*- coding: utf-8 -*-

import sys
from dataclasses import dataclass, field
from typing import List, Dict, Set, Union, Optional, Any

# ----------------------------------------------------------------------------
# 1. 导入加载器和数据结构
# ----------------------------------------------------------------------------
import json
import os
import config_loader
from config_loader import RuleSet, RhymeBook

# 繁体→简体映射（由 prebuild.py 预构建）
_T2S_MAP_PATH = os.path.join("static", "config", "t2s_map.json")
try:
    with open(_T2S_MAP_PATH, "r") as _f:
        _T2S_MAP = json.load(_f)
except FileNotFoundError:
    _T2S_MAP = {}

def _t2s_char(ch: str) -> str:
    return _T2S_MAP.get(ch, ch)

# ----------------------------------------------------------------------------
# 2. 结果封装类 (CheckResult 已更新)
# ----------------------------------------------------------------------------
@dataclass
class ErrorDetail:
    """封装单个错误"""
    position: int
    character: str
    error_type: str
    message: str

@dataclass
class WarningDetail:
    """封装单个警告"""
    positions: List[int]
    character: str
    warning_type: str
    message: str

@dataclass
class DisplaySegment:
    """封装一个用于显示的“行” (诗句或词句)"""
    text_chars: List[str]      # e.g., ['岁', '到', '冬', '初']
    rule_items: List[Dict]
    start_index: int           # e.g., 0

@dataclass
class CheckResult:
    """封装检测结果 (已更新)"""
    is_valid: bool
    closest_rule: Optional[RuleSet]
    errors: List[ErrorDetail]
    cleaned_chars: List[str]
    display_segments: List[DisplaySegment] = field(default_factory=list)
    warnings: List[WarningDetail] = field(default_factory=list)
    rhyme_name: Optional[str] = None
    rhyme_positions: Optional[int] = None
    rhyme_chars: Optional[str] = None

# ----------------------------------------------------------------------------
# 3. 核心检测器类 (PoetryChecker Class)
# ----------------------------------------------------------------------------

class PoetryChecker:
    
    def __init__(self, 
                 char_dict: Dict, 
                 rhyme_books: Dict[str, RhymeBook], 
                 rule_database: Dict[str, Dict[str, List[RuleSet]]]):
        
        self.char_dict = char_dict
        self.rhyme_books = rhyme_books
        self.rule_database = rule_database
        
        self.rule_index_by_length: Dict[str, Dict[int, List[RuleSet]]] = {
            'Shi': {},
            'Ci': {}
        }
        self._build_index()
        
        shi_count = sum(len(rules) for rules in self.rule_index_by_length['Shi'].values())
        ci_count = sum(len(rules) for rules in self.rule_index_by_length['Ci'].values())
        print(f"[Checker] 索引构建完成。加载 {shi_count} 条 [诗] 规则, {ci_count} 条 [词] 规则。")

    def _build_index(self):
        for genre, sub_genres in self.rule_database.items():
            for _, rule_list in sub_genres.items():
                for rule in rule_list:
                    count = rule.char_count
                    if count not in self.rule_index_by_length[genre]:
                        self.rule_index_by_length[genre][count] = []
                    self.rule_index_by_length[genre][count].append(rule)

    def check_auto(self, 
                   poem_text: str, 
                   genre: str, 
                   rhyme_book_name: str,
                   ensure_longpu: bool=False,
                   rule_name: Optional[str]=None) -> CheckResult:
        """
        [主入口] 自动检测诗词
        
        rule_name: 可选的体裁名称指定，支持三种模式:
          - None: 自动匹配（按字数取所有候选规则，选错误最少的）
          - 精确匹配: rule_name 完全等于某条规则的 name，仅用该规则检测
          - 前缀匹配: rule_name 为规则 name 的前缀（如 "五律"），
                      筛选所有 name.startswith(rule_name) 的规则，选错误最少的
        """
        PLACEHOLDER = '\u25a1'  # □
        chars = [c for c in poem_text if '\u4e00' <= c <= '\u9fff' or c == PLACEHOLDER]
        N = len(chars)

        # 1. 查找候选规则
        if genre not in self.rule_index_by_length:
            return CheckResult(False, None, [ErrorDetail(-1, "", "Config", f"未知的体裁: {genre}")], chars)
        
        if rule_name:
            # --- 显式指定模式 ---
            # 先收集该 genre 下的所有规则（跨字数）
            all_rules_for_genre = []
            for rules in self.rule_index_by_length[genre].values():
                all_rules_for_genre.extend(rules)
            
            # 精确匹配: 是否有 name 完全相等的规则
            exact = [r for r in all_rules_for_genre if r.name == rule_name]
            if exact:
                # 精确匹配时不再过滤 ensure_longpu（用户明确选了这条规则）
                candidate_rules = exact
            else:
                # 前缀匹配: 筛选 name.startswith(rule_name)
                candidate_rules = [r for r in all_rules_for_genre if r.name.startswith(rule_name)]
                # 仅前缀匹配时才应用 ensure_longpu 过滤
                if ensure_longpu:
                    longpu_rules = [r for r in candidate_rules if "龙谱" in r.name]
                    if longpu_rules:
                        candidate_rules = longpu_rules
            
            if not candidate_rules:
                return CheckResult(False, None, [ErrorDetail(-1, "", "Config", f"未找到匹配的规则: {rule_name}")], chars)
            
            # 如果指定了规则但字数不匹配，给出提示但仍然尝试检测
            # （字数以候选规则的 char_count 为准，如果 N 不等于任何候选的 char_count 则报错）
            matching_count_rules = [r for r in candidate_rules if r.char_count == N]
            if matching_count_rules:
                candidate_rules = matching_count_rules
            else:
                expected = sorted(set(r.char_count for r in candidate_rules))
                return CheckResult(False, None, [ErrorDetail(-1, "", "Length", f"字数不匹配: 找到 {N} 个汉字, 但 {rule_name} 要求 {expected} 字。")], chars)
        else:
            # --- 自动匹配模式 ---
            candidate_rules = self.rule_index_by_length[genre].get(N, [])
            if ensure_longpu:
                candidate_rules = [rule for rule in candidate_rules if "龙谱" in rule.name]
            if not candidate_rules:
                return CheckResult(False, None, [ErrorDetail(-1, "", "Length", f"字数不匹配: 找到 {N} 个汉字, 但未找到适用于此字数的 {genre} 规则。")], chars)

        # 2. 查找韵书 (同前)
        book = self.rhyme_books.get(rhyme_book_name)
        if not book:
             return CheckResult(False, None, [ErrorDetail(-1, "", "Config", f"未找到韵书: {rhyme_book_name}")], chars)

        # 3. 迭代 K_match 个候选规则 (已修改)
        best_match_rule: Optional[RuleSet] = None
        min_errors_list: List[ErrorDetail] = []
        min_error_count = float('inf')
        best_flat_rule_pattern: List = [] # [新增]

        for rule in candidate_rules:
            current_errors = []
            
            # [修改] _check_tone 现在返回 (错误, 扁平化的规则)
            tone_errors, flat_rule = self._check_tone(chars, rule.tone_pattern, rhyme_book_name)
            current_errors.extend(tone_errors)
            
            rhyme_errors = self._check_rhyme(chars, rule.rhyme_rule, book)
            current_errors.extend(rhyme_errors)
            
            if len(current_errors) < min_error_count:
                min_error_count = len(current_errors)
                min_errors_list = current_errors
                best_match_rule = rule
                best_flat_rule_pattern = flat_rule # [新增] 记录最佳规则

        # 4. [新增] 构建用于显示的 Segments
        display_segments = []
        if best_match_rule:
            display_segments = segment_for_display(
                chars, 
                best_flat_rule_pattern, 
                best_match_rule
            )
            rhyme_name = self._find_one_rhyme(best_match_rule, chars, book)
        rhyme_positions = sorted(list(get_rhyme_positions(best_match_rule.rhyme_rule)))
        rhyme_chars = [chars[i] for i in range(len(chars)) if i in rhyme_positions]

        # 5. 重字检测 (叠词特赦)
        warnings = self._check_duplicate_chars(chars)

        # 6. 返回结果 (已修改)
        is_valid = (min_error_count == 0)

        return CheckResult(is_valid=is_valid,
                           closest_rule=best_match_rule,
                           errors=min_errors_list,
                           cleaned_chars=chars,
                           display_segments=display_segments,
                           warnings=warnings,
                           rhyme_name=rhyme_name,
                           rhyme_positions=rhyme_positions,
                           rhyme_chars=rhyme_chars
                           )

    # --- 辅助函数: 重字检测 ---

    @staticmethod
    def _check_duplicate_chars(chars: List[str]) -> List[WarningDetail]:
        PLACEHOLDER = '\u25a1'
        positions_map: Dict[str, List[int]] = {}
        for i, ch in enumerate(chars):
            if ch == PLACEHOLDER or not ('\u4e00' <= ch <= '\u9fff'):
                continue
            positions_map.setdefault(ch, []).append(i)

        warnings = []
        for ch, positions in positions_map.items():
            if len(positions) < 2:
                continue
            non_overlap = []
            for pos in positions:
                is_overlap = any(abs(other - pos) == 1 for other in positions if other != pos)
                if not is_overlap:
                    non_overlap.append(pos)
            if len(non_overlap) >= 2 or (non_overlap and len(positions) > len(non_overlap)):
                warnings.append(WarningDetail(
                    positions=positions,
                    character=ch,
                    warning_type="Duplicate",
                    message=f"\u300c{ch}\u300d\u5728\u7b2c{'、'.join(str(p+1) for p in positions)}\u5b57\u51fa\u73b0{len(positions)}\u6b21",
                ))
        return warnings

    # --- 辅助函数: 获取汉字属性 ---

    def _lookup_char(self, char: str) -> Optional[Dict]:
        """查字典，查不到时尝试繁→简转换"""
        data = self.char_dict.get(char)
        if data:
            return data
        simplified = _t2s_char(char)
        if simplified != char:
            return self.char_dict.get(simplified)
        return None

    def _get_char_tones(self, char: str, rhyme_book_name: str = None) -> Set[str]:
        data = self._lookup_char(char)
        if not data: return {'A'}

        # 如果指定了韵书，从该韵书的韵部 tone_type 判断平仄
        if rhyme_book_name and rhyme_book_name in self.rhyme_books:
            rhymes = data.get('rhymes', {}).get(rhyme_book_name, [])
            if not rhymes: return {'A'}

            mapped_tones = set()
            book = self.rhyme_books[rhyme_book_name]

            for rhyme_cat_name in rhymes:
                rhyme_cat = book.categories.get(rhyme_cat_name)
                if rhyme_cat and hasattr(rhyme_cat, 'tone_type'):
                    mapped_tones.add(rhyme_cat.tone_type)

            if len(mapped_tones) == 0: return {'A'}
            if len(mapped_tones) > 1: return {'A'}  # 多音字（在不同韵部有不同平仄）
            return mapped_tones

        # 未指定韵书：使用全局声调
        if not data.get('tones'): return {'A'}
        mapped_tones = set()
        for tone in data['tones']:
            mapped_tones.add('P' if tone in ['Ping', 'ping', '平', 'yinping', '阴平', 'yangping', '阳平'] else 'Z')
        if len(mapped_tones) > 1: return {'A'}
        return mapped_tones
    
    def _get_char_tones_for_display(self, char: str) -> str:
        """[新增] 辅助函数, 获取单个显示用的平仄 '平'/'仄'/'中'"""
        tones = self._get_char_tones(char)
        if 'A' in tones: return '中'
        if 'P' in tones: return '平'
        if 'Z' in tones: return '仄'
        return '?' # 不应到达
    
    def _get_tone_tones_for_display(self, tone: str) -> str:
        """[新增] 辅助函数, 获取单个显示用的平仄 '平'/'仄'/'中'"""
        if tone == 'A': return '中'
        elif tone == 'P': return '平'
        elif tone == 'Z': return '仄'
        return '?' # 不应到达

    def _get_char_rhymes(self, char: str, book_name: str) -> Set[str]:
        data = self._lookup_char(char)
        if not data or not data['rhymes']: return set()
        return set(data['rhymes'].get(book_name, []))
    
    def _find_one_rhyme(self, rule: RuleSet, chars: List[str], book: RhymeBook) -> Optional[str]:
        """
        [更新] 推断“一韵到底”的韵部名称。
        如果是换韵, 则返回 None。
        如果是律诗首句入韵(OR 规则), 则排除首句韵脚。
        """
        # 1. 找到所有押韵位置（排除占位符 □）
        positions = sorted(list(get_rhyme_positions(rule.rhyme_rule)))
        valid_positions = [p for p in positions if p < len(chars) and chars[p] != '\u25a1']
        
        if not valid_positions:
            return None # 没有韵脚
            
        # 2. 检查此规则是否为 "换韵"
        rule_node = rule.rhyme_rule
        if rule_node.get('type') == 'AND':
            sc_count = 0
            for sub_rule in rule_node.get('rules', []):
                if sub_rule.get('type') == 'SAME_CATEGORY':
                    sc_count += 1
            if sc_count > 1:
                return " (换韵)" # 是换韵
        
        # 3. [新增] 确定用于推断的韵脚
        inference_positions = valid_positions
        
        # [律诗首句入韵 OR 规则]
        is_shi_or_rule = (rule.genre == "Shi" and 
                          rule.rhyme_rule.get('type') == 'OR' and 
                          len(valid_positions) > 1)
                          
        if is_shi_or_rule:
            # 只考察后 4 (n-1) 个韵字
            inference_positions = valid_positions[1:]
            
        if not inference_positions:
            return None # (例如一个只有首句入韵的 OR 规则, 但没有其他韵脚)

        # 4. 查找所有韵脚字的 "共同韵部"
        first_pos = inference_positions[0]
        first_char = chars[first_pos]
        common_rhymes = self._get_char_rhymes(first_char, book.name)
        if not common_rhymes:
            return None 

        for pos in inference_positions[1:]:
            char = chars[pos]
            char_rhymes = self._get_char_rhymes(char, book.name)
            common_rhymes.intersection_update(char_rhymes)
            if not common_rhymes:
                # 共同韵部为空, 说明一韵到底不成立 (可能作者出错了)
                return None
        
        # 5. 成功找到
        return ", ".join(sorted(list(common_rhymes)))

    # --- 算法 2a: 平仄检测 (已修改) ---
    
    def _check_segment_match(self,
                             chars_segment: List[str],
                             pattern_segment: List[str],
                             base_index: int,
                             rhyme_book_name: str = None) -> List[ErrorDetail]:
        # (同前, 未修改)
        errors = []
        for i, char in enumerate(chars_segment):
            if char == '\u25a1': continue  # □ 占位符跳过
            rule_tone = pattern_segment[i]["tone"]
            if rule_tone == 'A': continue
            actual_tones = self._get_char_tones(char, rhyme_book_name)
            if 'A' in actual_tones: continue
            if rule_tone not in actual_tones:
                errors.append(ErrorDetail(base_index + i, char, 'Tone', f"应为{self._get_tone_tones_for_display(rule_tone)}, 实为{self._get_tone_tones_for_display(list(actual_tones)[0])}"))
        return errors

    def _check_tone(self,
                    chars: List[str],
                    tone_pattern: List[Union[str, List[List[str]]]],
                    rhyme_book_name: str = None) -> (List[ErrorDetail], List[str]):
        """
        [平仄检测主算法 - 已修改]
        现在返回: (错误列表, 扁平化的最佳规则列表)
        """
        all_errors: List[ErrorDetail] = []
        flat_rule_pattern: List[Dict|str] = [] 
        i, p, N = 0, 0, len(chars)
        
        while i < N and p < len(tone_pattern):
            pattern_item = tone_pattern[p]
            
            # [修改] 情况 1: 是一个 Dict
            if isinstance(pattern_item, dict):
                # --- 情况 1: {"tone": "P", "comment": None} ---
                rule_tone = pattern_item["tone"]
                flat_rule_pattern.append(pattern_item) # [新增]
                if chars[i] != '\u25a1' and rule_tone != 'A':  # □ 占位符跳过
                    actual_tones = self._get_char_tones(chars[i], rhyme_book_name)
                    if 'A' not in actual_tones and rule_tone not in actual_tones:
                        all_errors.append(ErrorDetail(i, chars[i], 'Tone', f"应为{self._get_tone_tones_for_display(rule_tone)}, 实为{self._get_tone_tones_for_display(list(actual_tones)[0])}"))
                i += 1
                p += 1
            
            # [修改] 情况 2: 是一个 List (变体块)
            elif isinstance(pattern_item, list):
                # --- 情况 2: [[{...}, {...}], [{...}, {...}]] (变体块) ---
                best_error_set: List[ErrorDetail] = []
                # [修改] 变体选项现在是 List[Dict]
                best_variant_option: List[Dict] = pattern_item[0] # 默认选第一个
                min_variant_errors = float('inf')
                
                variant_len = len(pattern_item[0])
                chars_segment = chars[i : i + variant_len]
                
                if len(chars_segment) < variant_len:
                    all_errors.append(ErrorDetail(i, "".join(chars_segment), 'Tone', f"需要 {variant_len} 字的变体, 但诗句结束"))
                    # [修改] 填充 '?' 字典
                    flat_rule_pattern.extend([{"tone": "?", "comment": None}] * variant_len)
                    i += variant_len; p += 1; continue

                for variant_option in pattern_item:
                    current_errors = self._check_segment_match(chars_segment, variant_option, i, rhyme_book_name)
                    if not current_errors:
                        best_error_set = []; min_variant_errors = 0
                        best_variant_option = variant_option # [新增]
                        break
                    if len(current_errors) < min_variant_errors:
                        min_variant_errors = len(current_errors)
                        best_error_set = current_errors
                        best_variant_option = variant_option # [新增]
                
                if best_error_set: all_errors.extend(best_error_set)
                flat_rule_pattern.extend(best_variant_option) # [新增]
                i += variant_len
                p += 1
                
        return all_errors, flat_rule_pattern

    # --- 算法 2b/2c: 押韵检测 ---
    def _check_rhyme(self, chars: List[str], rule_node: Dict, book: RhymeBook) -> List[ErrorDetail]:
        """[押韵检测主算法] 递归 AST"""
        node_type = rule_node.get('type')
        if not node_type: return [] 
        
        if node_type == 'OR':
            errors_per_branch = []
            for sub_rule in rule_node['rules']:
                branch_errors = self._check_rhyme(chars, sub_rule, book)
                if not branch_errors: return [] # 成功: 任意一个分支通过即可
                errors_per_branch.append(branch_errors)
            # 失败: 所有分支都失败了。返回错误最少的那个。
            return min(errors_per_branch, key=len, default=[])
        
        if node_type == 'AND':
            all_errors = []
            for sub_rule in rule_node['rules']: all_errors.extend(self._check_rhyme(chars, sub_rule, book))
            return all_errors # 成功: 当 all_errors 为空时
        
        if node_type == 'SAME_CATEGORY':
            return self._check_same_category(chars, rule_node['positions'], book)
        
        if node_type == 'RELATION':
            return self._check_relation(chars, rule_node['pos1'], rule_node['pos2'], rule_node['relation'], book)
        
        return []

    def _check_same_category(self, chars: List[str], positions: List[int], book: RhymeBook) -> List[ErrorDetail]:
        """(从宽) 检查所有指定位置的字是否能同属一个韵部。占位符 □ 跳过。"""
        valid_positions = [p for p in positions if p < len(chars) and chars[p] != '\u25a1']
        if not valid_positions: return []
        
        first_pos = valid_positions[0]; first_char = chars[first_pos]
        common_rhymes = self._get_char_rhymes(first_char, book.name)
        if not common_rhymes: return [ErrorDetail(first_pos, first_char, 'Rhyme', '押韵字无韵部')]
        
        for pos in valid_positions[1:]:
            char = chars[pos]; char_rhymes = self._get_char_rhymes(char, book.name)
            if not char_rhymes: return [ErrorDetail(pos, char, 'Rhyme', f'押韵字无韵部')]
            
            common_rhymes.intersection_update(char_rhymes)
            if not common_rhymes:
                return [ErrorDetail(pos, char, 'Rhyme', f'出韵')]
                
        return [] # 成功

    def _check_relation(self, chars: List[str], pos1: int, pos2: int, relation: str, book: RhymeBook) -> List[ErrorDetail]:
        """(从宽) 检查 pos1 的 (任意) 韵部是否与 pos2 的 (任意) 韵部存在 'relation' 关系。占位符 □ 跳过。"""
        if pos1 >= len(chars) or pos2 >= len(chars): return []
        if chars[pos1] == '\u25a1' or chars[pos2] == '\u25a1': return []  # 占位符跳过
            
        char1, char2 = chars[pos1], chars[pos2]
        rhymes1 = self._get_char_rhymes(char1, book.name)
        rhymes2 = self._get_char_rhymes(char2, book.name)
        if not rhymes1 or not rhymes2: return [ErrorDetail(pos1, char1, 'Rhyme', '相关字无韵部')]
        
        for r1 in rhymes1:
            related = set(book.get_related(r1, relation))
            if not related.isdisjoint(rhymes2):
                return [] # 成功！ 找到了一个匹配的关系
                
        return [ErrorDetail(pos1, char1, 'Rhyme', f"其韵部与 {char2} (位于{pos2}) 无法构成 '{relation}' 关系")]

# ----------------------------------------------------------------------------
# 4. [新增] 分行与显示逻辑
# ----------------------------------------------------------------------------

def get_rhyme_positions(rule_node: Dict) -> Set[int]:
    """[辅助] 递归获取一个规则中所有 'SAME_CATEGORY' 的押韵位置"""
    positions = set()
    node_type = rule_node.get('type')
    
    if not node_type:
        return positions
        
    if node_type == 'SAME_CATEGORY':
        positions.update(rule_node.get('positions', []))
        
    elif node_type in ('AND', 'OR'):
        for sub_rule in rule_node.get('rules', []):
            positions.update(get_rhyme_positions(sub_rule))
            
    # 'RELATION' 节点不计入主要韵脚
    return positions

def segment_for_display(chars: List[str], 
                        # [修改] 扁平化规则现在是 List[Dict]
                        flat_rule_pattern: List[Dict], 
                        rule: RuleSet) -> List[DisplaySegment]:
    """
    [分行逻辑] 
    诗: 按联 (每2句)
    词: 按韵 (rhyme_positions)
    """
    segments = []
    N = len(chars)
    if N == 0: return []
    
    # [修改] flat_rule_pattern 现在已经是 List[Dict], 无需映射
    mapped_rule_items = flat_rule_pattern
    
    if not mapped_rule_items: # 兜底
         mapped_rule_items = [{"tone": "?", "comment": None}] * N

    current_text_chars = []
    # [修改] 存储 List[Dict]
    current_rule_items = []
    current_start_index = 0
    
    # --- 词 (Ci) 分行逻辑 ---
    if rule.genre == "Ci":
        rhyme_positions = get_rhyme_positions(rule.rhyme_rule)
        
        for i in range(N):
            current_text_chars.append(chars[i])
            current_rule_items.append(mapped_rule_items[i])
            
            # 如果当前是韵脚, 且不是最后一个字, 则分行
            if i in rhyme_positions and i < (N - 1):
                segments.append(DisplaySegment(current_text_chars, current_rule_items, current_start_index))
                current_text_chars = []
                current_rule_items = []
                current_start_index = i + 1
                
    # --- 诗 (Shi) 分行逻辑 ---
    else:
        # 自动检测 5言 或 7言
        sentence_len = 7 if (rule.char_count % 7 == 0) else 5
        couplet_len = sentence_len * 2 # 每联 (2句) 分行
        
        for i in range(N):
            current_text_chars.append(chars[i])
            current_rule_items.append(mapped_rule_items[i])
            
            # 如果
            # 1. 达到了联的末尾 (e.g., i=13 for 7-char)
            # 2. 且不是最后一个字
            if (i + 1) % couplet_len == 0 and i < (N - 1):
                segments.append(DisplaySegment(current_text_chars, current_rule_items, current_start_index))
                current_text_chars = []
                current_rule_items = []
                current_start_index = i + 1

    # 添加最后剩余的部分
    if current_text_chars:
        segments.append(DisplaySegment(current_text_chars, current_rule_items, current_start_index))
        
    return segments

def print_pretty_result(result: CheckResult):
    """[重大更新] 优美的双行打印函数"""
    
    # --- 1. 定义终端颜色 ---
    CLR_RED = "\033[91m"     # 错误标红
    CLR_GREEN = "\033[92m"   # 韵字标绿
    CLR_RESET = "\033[0m"
    EM_SPACE = "\u3000"      # 全角空格
    
    print("\n" + "="*70)
    
    # --- 2. 打印头部信息 ---
    if not result.closest_rule:
        print(f"检测结果: {result.errors[0].message if result.errors else '未知错误'}")
        print("="*70 + "\n")
        return

    rule = result.closest_rule
    print(f"检测体裁: {rule.name}")
    
    if result.rhyme_name:
        print(f"押　　韵: {result.rhyme_name}")
    
    print(f"检测结果: {'通过' if result.is_valid else '不通过'}")
    
    # --- 3. 准备辅助数据 ---
    errors_dict: Dict[int, ErrorDetail] = {err.position: err for err in result.errors}
    rhyme_positions = get_rhyme_positions(rule.rhyme_rule)
    # [新增] 谱面行汉字
    rhyme_map = {'P': '平', 'Z': '仄', 'A': '中', '?': '?'}

    # --- 4. 遍历分行 (诗/词 逻辑) ---
    for seg in result.display_segments:
        
        if rule.genre == "Ci":
            # --- 4a. 词 (Ci) 逻辑 ---
            text_line = ""
            rule_line = ""
            for i, char in enumerate(seg.text_chars):
                global_index = seg.start_index + i
                # 1. 文本行
                text_line += f"{CLR_RED}{char}{CLR_RESET}" if global_index in errors_dict else char
                
                # 2. 规则行
                item_dict = seg.rule_items[i]
                tone = rhyme_map.get(item_dict['tone'], 'E')
                comment = item_dict.get('comment')
                rule_line += tone
                if comment:
                    rule_line += comment
                    text_line += EM_SPACE
            
            print(f"\n{text_line}")
            print(rule_line + f"{CLR_GREEN}韵{CLR_RESET}")
        
        else:
            # --- 4b. 诗 (Shi) 逻辑 ---
            sentence_len = 7 if (rule.char_count % 7 == 0) else 5
            text_parts = ["", ""] # [上句, 下句]
            rule_parts = ["", ""] # [上句谱, 下句谱]
            
            # 循环处理联中的每个字
            for i, char in enumerate(seg.text_chars):
                part_index = 0 if i < sentence_len else 1 # 0=上句, 1=下句
                if i == sentence_len: # 刚进入下句
                    text_parts[part_index] += EM_SPACE
                    rule_parts[part_index] += EM_SPACE
                
                global_index = seg.start_index + i
                
                # 1. 添加字 (标红?)
                text_parts[part_index] += f"{CLR_RED}{char}{CLR_RESET}" if global_index in errors_dict else char
                
                # [修改] 2. 添加谱
                item_dict = seg.rule_items[i]
                tone = rhyme_map.get(item_dict['tone'], 'E')
                comment = item_dict.get('comment')
                rule_char_to_add = f"{tone}{comment}" if comment else tone
                rule_parts[part_index] += rule_char_to_add
                
                # 3. 添加韵 (标绿?)
                if global_index in rhyme_positions:
                    text_parts[part_index] += EM_SPACE
                    rule_parts[part_index] += f"{CLR_GREEN}韵{CLR_RESET}"

            print(f"\n{text_parts[0]}{text_parts[1]}")
            print(f"{rule_parts[0]}{rule_parts[1]}")

    # --- 5. [恢复] 打印详细错误报告 ---
    if result.errors:
        print("\n\n--- 详细错误报告 ---")
        for err in result.errors:
            print(f"  - [位置 {err.position:02d}] 字: '{err.character}' - {err.message}")
    elif result.is_valid:
        print("\n\n--- 格律检测通过 ---")
        
    print("="*70 + "\n")

# ----------------------------------------------------------------------------
# 5. 运行与测试 (使用新的打印函数)
# ----------------------------------------------------------------------------

if __name__ == "__main__":
    
    print("--- [主程序] 开始加载配置 ---")
    try:
        char_dict = config_loader.load_char_dict()
        rhyme_books = config_loader.load_rhyme_books()
        rule_database = config_loader.load_rule_database()
    except Exception as e:
        print(f"\n[主程序 致命错误] 加载配置失败: {e}")
        print("请确保 'config' 文件夹存在, 并且已成功运行 'build_config.py'")
        sys.exit(1)
    print("--- [主程序] 配置加载完毕 ---")

    checker = PoetryChecker(
        char_dict=char_dict,
        rhyme_books=rhyme_books,
        rule_database=rule_database
    )

    # --- 测试用例 1: 七律 (首句邻韵通过) ---
    poem_1_text = "平平仄仄仄平冬, 仄仄平平仄仄东。仄仄平平仄仄仄, 平平仄仄仄平风。平平仄仄平平仄, 仄仄平平仄仄中。仄仄平平仄平仄, 平平仄仄仄平同。"
    print("\n--- 开始检测: 七律 (首句邻韵通过) ---")
    result_1 = checker.check_auto(poem_1_text, "Shi", "Pingshuiyun")
    print_pretty_result(result_1)

    # --- 测试用例 2: 七律 (平仄变体 + 押韵失败) ---
    poem_2_text = "平平仄仄仄平东, 仄仄平平仄仄风。仄仄平平仄平仄, 平平仄仄仄平中。平平仄仄平平仄, 仄仄平平仄仄梦。仄仄平平仄仄仄, 平平仄仄仄平同。"
    print("--- 开始检测: 七律 (平仄变体通过, 押韵失败) ---")
    result_2 = checker.check_auto(poem_2_text, "Shi", "Pingshuiyun")
    print_pretty_result(result_2)

    # --- 测试用例 3: 五绝 (平仄失败) ---
    poem_3_text = "仄仄平平仄, 平平仄仄平, 平平平仄平, 仄仄仄平平"
    print("--- 开始检测: 五绝 (平仄失败) ---")
    result_3 = checker.check_auto(poem_3_text, "Shi", "Pingshuiyun")
    print_pretty_result(result_3)
    
    # # --- 测试用例 4: 词 (卜算子, 44字) ---
    # # 模拟一个卜算子: 32211, 32115. 3211221, 32115. (28字)
    # # 龙谱: A Z Z P P, A Z P P Z. A Z P P Z Z P, A Z P P Z.
    # poem_5_text = "仄仄平平平, 仄平平仄仄。 仄平平仄仄平平, 仄平平仄仄。" # (用模拟字, 保证平仄通过)
    # print("\n--- 开始检测: 词 (卜算子, 28字) ---")
    # # 我们的 cipu_rules.py 中生成的 卜算子_龙谱正格 是 28 字
    # result_5 = checker.check_auto(poem_5_text, "Ci", "Pingshuiyun")
    # print_pretty_result(result_5)

    # --- 测试用例 5: 七律 (自定义输入) ---
    poem_5_text = "岁到冬初生是非。相期底事转相违。催成颊上双行泪，抹灭云间数点晖。舞曲无声销永巷，诗笺有梦恋深闱。于今万马齐喑处，想共惊鸿一并飞。"
    print("--- 开始检测: 七律 (自定义内容) ---")
    result_5 = checker.check_auto(poem_5_text, "Shi", "Pingshuiyun")
    print_pretty_result(result_5)

    while 1:
        poem_type = input("请输入待检验的作品类型：1-诗，2-词>>> ").strip().replace('\n', '')
        if poem_type == '1':
            type_ = 'Shi'
            book = 'Pingshuiyun'
            ensure_longpu = False
        elif poem_type == '2':
            type_ = 'Ci'
            book = 'Cilinzhengyun'
            ensure_longpu = True
        else:
            continue
        poem_text = input("请输入待检验的作品：>>> ").strip().replace('\n', '')
        print_pretty_result(checker.check_auto(poem_text, type_, book, ensure_longpu))