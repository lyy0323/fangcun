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
  author?: string;            // undefined → 继承全局默认；'' → 显式不署名；非空 → 画板级署名
  date?: string;              // 日期文本（用户输入，如"2024-04-04"或"甲辰年三月初一"）
  dateFormat?: 'Gregorian' | 'Lunar';  // 日期格式
  rhymeBook?: string;        // 韵书（平水韵/词林正韵/中华通韵，仅标注用途）
  preface?: string;          // 序言文本
  footnote?: string;         // 脚注文本
}

export function resolveAuthor(metadata?: BoardMetadata): string {
  if (metadata?.author !== undefined) return metadata.author;
  return localStorage.getItem('default_author') ?? '';
}

export interface PoemSection {
  id: string;
  title: string;
  ruleName: string;
  charCount: number;
  poemChars: string[];
  candidatesMap: Record<number, string[]>;
  lines?: string[];
  immersive?: boolean;
}

export interface Board {
  id: string;
  title: string;
  genre: 'Shi' | 'Ci' | 'Free';
  subGenre?: string;
  folderId?: string;
  rhymeBookName: string;
  sections: PoemSection[];
  inspirationCards: InspirationCard[];
  createdAt: number;
  updatedAt: number;
  metadata?: BoardMetadata;
}

export interface Folder {
  id: string;
  name: string;
  parentId: string | null;
  collapsed?: boolean;
  order: number;
  createdAt: number;
}

export function primarySection(board: Board): PoemSection {
  return board.sections[0];
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

// ============================================================================
// 自由韵脚检测
// ============================================================================

export interface FreeRhymePosition { line: number; pos: number; }

export interface FreeRhymeCandidate {
  line: number;
  pos: number;
  char: string;
  categories: string[];
}

export interface FreeRhymeGroup {
  positions: FreeRhymePosition[];
}

export interface FreeRhymeResult {
  candidates: FreeRhymeCandidate[];
  groups: FreeRhymeGroup[];
}

// ============================================================================
// 外部诗词库 (shi.sjtuguoxue.space)
// ============================================================================

export interface PoemBrief {
  id: number;
  title: string;
  author: string;
  dynasty: string;
  type: string;
  content: string;
  score?: number;
}

export interface PoemFull extends PoemBrief {
  paragraphs: string[];
  closest_rule: string | null;
  error_count: number;
  rhyme_name: string | null;
  rhyme_chars: string[];
}

export interface PoemSearchResult {
  total: number;
  total_capped?: boolean;
  results: PoemBrief[];
}
