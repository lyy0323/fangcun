import json
import os
from dataclasses import dataclass, field
from typing import List, Dict, Set, Union, Optional, Any

# ----------------------------------------------------------------------------
# 1. 核心数据结构 (Data Structures)
#    这些定义现在从主程序移到了加载器中。
# ----------------------------------------------------------------------------

@dataclass
class RhymeCategory:
    """韵部定义"""
    name: str
    tone_type: str
    characters: Set[str]
    relations: Dict[str, List[str]] = field(default_factory=dict)

@dataclass
class RhymeBook:
    """韵书定义"""
    name: str
    categories: Dict[str, RhymeCategory] = field(default_factory=dict)

    def get_related(self, category_name: str, relation_type: str) -> List[str]:
        if category_name in self.categories:
            return self.categories[category_name].relations.get(relation_type, [])
        return []

@dataclass
class RuleSet:
    """格律规则集定义"""
    name: str
    genre: str
    cipai: Optional[str]
    char_count: int
    tone_pattern: List
    rhyme_rule: Dict

# ----------------------------------------------------------------------------
# 2. JSON 加载函数
# ----------------------------------------------------------------------------

CONFIG_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "static", "config")

def _load_json(filename: str) -> Any:
    """通用的 JSON 加载辅助函数"""
    filepath = os.path.join(CONFIG_DIR, filename)
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            return json.load(f)
    except FileNotFoundError:
        print(f"[Loader 错误] 未找到配置文件: {filepath}")
        print("请先运行 build_config.py 来生成配置文件。")
        return None
    except json.JSONDecodeError:
        print(f"[Loader 错误] JSON 解析失败: {filepath}")
        return None

def load_char_dict() -> Dict:
    """加载汉字字典"""
    print("[Loader] 正在加载: char_dict.json")
    data = _load_json("char_dict.json")
    return data if data else {}

def load_rhyme_books() -> Dict[str, RhymeBook]:
    """
    加载韵书, 并将字典反序列化 (re-hydrate) 为 RhymeBook 对象
    """
    print("[Loader] 正在加载: rhyme_books.json")
    data = _load_json("rhyme_books.json")
    if not data: return {}
    
    all_books = {}
    for book_name, book_data in data.items():
        book_obj = RhymeBook(name=book_data['name'])
        
        for cat_name, cat_data in book_data['categories'].items():
            # 将 JSON list 转为 Set
            cat_data['characters'] = set(cat_data.get('characters', []))
            # 实例化 RhymeCategory
            cat_obj = RhymeCategory(**cat_data)
            book_obj.categories[cat_name] = cat_obj
            
        all_books[book_name] = book_obj
        
    return all_books

def load_rule_database() -> Dict[str, Dict[str, List[RuleSet]]]:
    """
    加载所有规则 (Shi, Ci), 并反序列化为 RuleSet 对象
    """
    db = {'Shi': {}, 'Ci': {}}
    
    # --- 1. 加载诗 (Shi) 规则 ---
    print("[Loader] 正在加载: shi_rules.json")
    shi_rules_data = _load_json("shi_rules.json")
    if shi_rules_data:
        for rule_dict in shi_rules_data:
            try:
                rule_obj = RuleSet(**rule_dict) # 字典解包
                cipai = rule_obj.cipai
                if cipai not in db['Shi']:
                    db['Shi'][cipai] = []
                db['Shi'][cipai].append(rule_obj)
            except TypeError as e:
                print(f"[Loader 错误] 诗规则 {rule_dict.get('name')} 格式不匹配: {e}")
                
    # --- 2. 加载词 (Ci) 规则 ---
    print("[Loader] 正在加载: ci_rules.json")
    ci_rules_data = _load_json("ci_rules.json")
    if ci_rules_data:
        for rule_dict in ci_rules_data:
            try:
                rule_obj = RuleSet(**rule_dict) # 字典解包
                cipai = rule_obj.cipai
                if cipai not in db['Ci']:
                    db['Ci'][cipai] = []
                db['Ci'][cipai].append(rule_obj)
            except TypeError as e:
                print(f"[Loader 错误] 词规则 {rule_dict.get('name')} 格式不匹配: {e}")

    return db