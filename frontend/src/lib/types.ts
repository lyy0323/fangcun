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
