import type { ValidationResult, RhymeLookupResult, RuleListItem, PoemSearchResult, PoemFull, FreeRhymeResult } from './types';

const BASE = '/api';

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

// --- 格律检测 ---
export function validateMeter(params: {
  poem_text: string;
  genre: string;
  rhyme_book_name: string;
  rule_name?: string;
  ensure_longpu?: boolean;
}): Promise<ValidationResult> {
  return post('/validate_meter', params);
}

// --- 自由韵脚检测 ---
export function freeRhyme(params: {
  lines: string[];
  rhyme_book_name: string;
}): Promise<FreeRhymeResult> {
  return post('/free_rhyme', params);
}

// --- 韵部同韵字 ---
export function rhymeLookup(
  book: string,
  category: string,
  include?: string,
): Promise<RhymeLookupResult | { primary: RhymeLookupResult; related: { relation: string; category: RhymeLookupResult }[] }> {
  let url = `/rhyme/lookup?book=${enc(book)}&category=${enc(category)}`;
  if (include) url += `&include=${enc(include)}`;
  return get(url);
}

// --- 韵部列表 ---
export function rhymeList(book: string, tone?: string) {
  let url = `/rhyme/list?book=${enc(book)}`;
  if (tone) url += `&tone=${enc(tone)}`;
  return get<{ book: string; categories: { name: string; tone_type: string; char_count: number }[] }>(url);
}

// --- 规则列表 ---
export function rulesList(genre: string): Promise<RuleListItem[]> {
  return get(`/rules/list?genre=${enc(genre)}`);
}

// --- 单字韵部查找 ---
export function charLookup(char: string, book: string) {
  return get<{
    char: string;
    tones: string[];
    rhyme_categories: { name: string; tone_type: string }[];
    definitions: { py: string; defs: { d: string; c?: string }[] }[];
  }>(`/char/lookup?char=${enc(char)}&book=${enc(book)}`);
}

// --- 字典搜索 (词首/词末/对语) ---
export function dictionarySearch(params: {
  term: string;
  mode: 'head' | 'tail' | 'pair';
  length?: string;
  tone?: string;
}): Promise<[string, number][]> {
  let url = `/dictionary/search?term=${enc(params.term)}&mode=${params.mode}`;
  if (params.length) url += `&length=${params.length}`;
  if (params.tone) url += `&tone=${params.tone}`;
  return get(url);
}

// --- 典故搜索 ---
export interface AllusionEntry {
  id: number;
  w: string;
  d: string;
  src: string;
  src_text: string;
  related: { w: string; d: string }[];
  examples: string[];
  rc: number;
}

export function allusionSearch(term: string, limit?: number): Promise<AllusionEntry[]> {
  let url = `/dictionary/allusion?term=${enc(term)}`;
  if (limit) url += `&limit=${limit}`;
  return get(url);
}

const enc = encodeURIComponent;

// ============================================================================
// 外部诗词库 (shi.sjtuguoxue.space)
// ============================================================================

// Android WebView 走本地代理（外部 API 需要正确 Referer），Web 端直连
const POEMS_API = navigator.userAgent.includes('FangcunAndroid')
  ? '/proxy/poems'
  : 'https://shi.sjtuguoxue.space/api';

export async function poemsSearchText(
  q: string,
  opts: { field?: string; dynasty?: string; type?: string; limit?: number; offset?: number } = {},
): Promise<PoemSearchResult> {
  const params = new URLSearchParams({ q });
  if (opts.field && opts.field !== 'all') params.set('field', opts.field);
  if (opts.dynasty) params.set('dynasty', opts.dynasty);
  if (opts.type) params.set('type', opts.type);
  if (opts.limit) params.set('limit', String(opts.limit));
  if (opts.offset) params.set('offset', String(opts.offset));
  const res = await fetch(`${POEMS_API}/search/text?${params}`);
  if (!res.ok) throw new Error('搜索失败');
  return res.json();
}

export async function poemsGetPoem(id: number): Promise<PoemFull> {
  const res = await fetch(`${POEMS_API}/poems/${id}`);
  if (!res.ok) throw new Error('获取详情失败');
  return res.json();
}

export function track(event: string, props?: Record<string, string | number>) {
  fetch(`${BASE}/_track`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event, props }),
  }).catch(() => {});
}
