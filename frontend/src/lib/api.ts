import type { ValidationResult, RhymeLookupResult, RuleListItem } from './types';

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
