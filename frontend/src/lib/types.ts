// ============================================================================
// 持久化结构 (localStorage)
// ============================================================================

export interface InspirationCard {
  id: string;
  type: 'text' | 'image' | 'audio';
  content: string;
  createdAt: number;
}

export interface BoardMetadata {
  date?: string;              // 日期文本（用户输入，如"2024-04-04"或"甲辰年三月初一"）
  dateFormat?: 'Gregorian' | 'Lunar';  // 日期格式
  rhymeBook?: string;        // 韵书（平水韵/词林正韵/中华通韵，仅标注用途）
  preface?: string;          // 序言文本
}

export interface Board {
  id: string;
  title: string;
  genre: 'Shi' | 'Ci';
  ruleName: string;
  charCount: number;
  rhymeBookName: string;
  poemChars: string[];           // 扁平数组, 空位 = "□"
  candidatesMap: Record<number, string[]>;
  inspirationCards: InspirationCard[];
  createdAt: number;
  updatedAt: number;
  metadata?: BoardMetadata;  // 元数据（可选，向后兼容）
}

// ============================================================================
// 运行时状态
// ============================================================================

export const PLACEHOLDER = '\u25a1'; // □

export interface RuleItem {
  tone: 'P' | 'Z' | 'A';
  comment: string | null;
}

export interface DisplaySegment {
  text_chars: string[];
  rule_items: RuleItem[];
  start_index: number;
}

export interface ErrorItem {
  position: number;
  character: string;
  error_type: 'Tone' | 'Rhyme';
  message: string;
}

export interface WarningItem {
  positions: number[];
  character: string;
  warning_type: 'Duplicate';
  message: string;
}

export interface ClosestRule {
  name: string;
  genre: string;
  cipai: string;
  char_count: number;
}

export interface RhymeGroup {
  positions: number[];
  type: 'same';
}

export interface RhymeRelation {
  pos1: number;
  pos2: number;
  relation: string;  // "ye_ping" | "ye_ze" | "neighbor" etc.
}

export interface ValidationResult {
  is_valid: boolean;
  closest_rule: ClosestRule | null;
  errors: ErrorItem[];
  warnings: WarningItem[];
  display_segments: DisplaySegment[];
  rhyme_name: string | null;
  rhyme_positions: number[];
  rhyme_chars: string[];
  rhyme_groups: RhymeGroup[];
  rhyme_relations: RhymeRelation[];
}

export interface RhymeCategory {
  name: string;
  tone_type: 'P' | 'Z';
}

export interface RhymeLookupResult {
  category_name: string;
  tone_type: string;
  total: number;
  characters: string[];
  relations: Record<string, string[]>;
}

export interface RuleListItem {
  name: string;
  char_count: number;
}

// 诗的体裁 charCount 映射
export const SHI_CHAR_COUNTS: Record<string, number> = {
  '五绝': 20,
  '七绝': 28,
  '五律': 40,
  '七律': 56,
};
