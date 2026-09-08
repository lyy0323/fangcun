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
  author?: string;
  date?: string;
  dateFormat?: 'Gregorian' | 'Lunar';
  dateHidden?: boolean;
  rhymeBook?: string;
  preface?: string;
  footnote?: string;
  legacyId?: string;
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
  punctOverrides?: Record<number, string>;
  auxMarks?: Record<number, string[]>;
  sectionDate?: string;
  sectionDateHidden?: boolean;
  sectionPreface?: string;
  sectionFootnote?: string;
  sectionLegacyId?: string;
}

export interface Board {
  id: string;
  title: string;
  genre: 'Shi' | 'Ci' | 'Free';
  subGenre?: string;
  folderId?: string;
  boardOrder?: number;
  rhymeBookName: string;
  sections: PoemSection[];
  inspirationCards: InspirationCard[];
  createdAt: number;
  updatedAt: number;
  metadata?: BoardMetadata;
}

export type SortMode = 'updated-desc' | 'updated-asc' | 'created-desc' | 'created-asc' | 'name' | 'custom';

export interface Folder {
  id: string;
  name: string;
  parentId: string | null;
  collapsed?: boolean;
  order: number;
  sortMode?: SortMode;
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
  expected?: string;
  actual?: string;
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
  pos2: number | number[];
  relation: string;
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

// [上古韵双套] 韵书 key 集合与判断
export const SHANGGUYUN_BOOK_KEYS = ['ShangguyunShijing', 'ShangguyunChuci'] as const;
export type ShangguyunBookKey = typeof SHANGGUYUN_BOOK_KEYS[number];
export const isShangguyunBook = (book: string): boolean =>
  book === 'ShangguyunShijing' || book === 'ShangguyunChuci';
// 旧版单本「上古韵」key（已拆分为两套）→ 归一为诗经韵，兼容历史画板
export const normalizeBookKey = (book: string): string =>
  book === 'Shangguyun' ? 'ShangguyunShijing' : book;

// [上古韵双套] 单字上古读音（char/lookup 的 rhyme_categories[i].readings）
export interface ShangguyunReading {
  sj: string[];       // 诗经韵部归属（并列通押展开，如 ['鱼a','铎ak']）
  cc: string[];       // 楚辞韵部归属
  py: string;         // 拟音：拼音列（全音节 ASCII，如 g'ang）
  ipa: string;        // 诗经音国际音标（全音节，如 gˤaŋ）
  ipaf: string;       // 韵母国际音标（如 aŋ）
  tone: string;       // 平/上/去/入/次入
  freq: number;       // 總出現次數（√→1，空→0）
  ipa_cc?: string;    // 楚辞音异于诗经音时（-s→-h 类）附带的楚辞音
  ipaf_cc?: string;
}

// [上古韵双套] rhyme/lookup 的逐字展示详情（与 characters 对齐）
export interface RhymeLookupDetail {
  char: string;
  cat?: string;      // 所属韵部名
  py?: string;
  ipa?: string;
  ipaf?: string;
  tone?: string;
}

export interface RhymeLookupResult {
  category_name: string;
  tone_type: string;
  total: number;
  characters: string[];
  relations: Record<string, string[]>;
  details?: RhymeLookupDetail[];
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
