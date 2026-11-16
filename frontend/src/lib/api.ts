import type { ValidationResult, RhymeLookupResult, RuleListItem, PoemSearchResult, PoemFull, FreeRhymeResult, RhymeCategory, ShangguyunReading } from './types';

const IS_ANDROID = navigator.userAgent.includes('FangcunAndroid');
// 生产 Web 直连 coco2 源站：Vercel 边缘 → 国内源站存在约 27% 的连接失败
// （30s 后返回 502 ROUTER_EXTERNAL_TARGET_CONNECTION_ERROR），直连源站 CORS 已放开且稳定。
// Android 走本地 Flask（5050），本地开发走 Vite 代理。
const IS_LOCAL_DEV = ['localhost', '127.0.0.1'].includes(location.hostname);
const BASE = IS_ANDROID || IS_LOCAL_DEV
  ? '/api'
  : 'https://shi.sjtuguoxue.space/__shiva/api';

// checker 端点经 shiva 透传，使 checker 调用计入后端调用量统计。
const CHECKER_BASE = BASE;
// 词牌列表为静态数据，直连 checker 可避开 coco2 代理偶发的 10s+ 卡顿/30s 502。
const CHECKER_DIRECT_BASE = 'https://checker.sjtuguoxue.space/api';

// checker 暂不计入 CJK 扩展 A；用占位符保留词谱位置，画板原文不变。
const normalizePoemTextForChecker = (poemText: string) =>
  poemText.replace(/[\u3400-\u4dbf]/g, '□');

async function get<T>(path: string, base = BASE, signal?: AbortSignal): Promise<T> {
  const res = await fetch(`${base}${path}`, { signal });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

async function post<T>(path: string, body: unknown, base = BASE, signal?: AbortSignal): Promise<T> {
  const res = await fetch(`${base}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

// --- 格律检测（→ checker 服务）---
export function validateMeter(params: {
  poem_text: string;
  genre: string;
  rhyme_book_name: string;
  rule_name?: string;
  ensure_longpu?: boolean;
  warnings?: string | string[];
  include_punctuation?: boolean;
}, signal?: AbortSignal): Promise<ValidationResult> {
  return post('/validate_meter', {
    ...params,
    poem_text: normalizePoemTextForChecker(params.poem_text),
  }, CHECKER_BASE, signal);
}

// --- 自由韵脚检测（→ checker 服务）---
export function freeRhyme(params: {
  lines: string[];
  rhyme_book_name: string;
  merge_tones?: boolean;
}): Promise<FreeRhymeResult> {
  return post('/free_rhyme', params, CHECKER_BASE);
}

// --- 韵部同韵字（→ checker 服务）---
export function rhymeLookup(
  book: string,
  category: string,
  include?: string,
  limit?: number,
  offset?: number,
): Promise<RhymeLookupResult | { primary: RhymeLookupResult; related: { relation: string; category: RhymeLookupResult }[] }> {
  let url = `/rhyme/lookup?book=${enc(book)}&category=${enc(category)}`;
  if (include) url += `&include=${enc(include)}`;
  if (limit != null) url += `&limit=${limit}`;
  if (offset != null) url += `&offset=${offset}`;
  return get(url, CHECKER_BASE);
}

// --- 韵部列表（→ checker 服务）---
export function rhymeList(book: string, tone?: string) {
  let url = `/rhyme/list?book=${enc(book)}`;
  if (tone) url += `&tone=${enc(tone)}`;
  return get<{ book: string; categories: { name: string; tone_type: string; char_count: number }[] }>(url, CHECKER_BASE);
}

// --- 规则列表（→ checker 服务）---
// fields=basic 只返回 name/char_count，词牌选择器不需要完整词谱（完整响应约 3.4 MB）。
// 旧版 checker 会忽略未知参数，仍返回完整列表，因此该参数可安全提前上线。
const rulesListCache = new Map<string, Promise<RuleListItem[]>>();

const RULES_LIST_TIMEOUT_MS = 10000;
const RULES_LIST_RETRY_DELAY_MS = 800;

// 直连 checker 后补记一次调用量，保持 dashboard 的 API 口径
function reportRulesListCall() {
  fetch(`${BASE}/_ping`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ source: IS_ANDROID ? 'android' : 'frontend', route: '/api/rules/list' }),
  }).catch(() => {});
}

export function rulesList(genre: string, opts?: { basic?: boolean }): Promise<RuleListItem[]> {
  const basic = opts?.basic ?? false;
  const key = `${genre}:${basic ? 'basic' : 'full'}`;
  const cached = rulesListCache.get(key);
  if (cached) return cached;

  const url = `/rules/list?genre=${enc(genre)}${basic ? '&fields=basic' : ''}`;
  const request = (async () => {
    let lastError: unknown;
    // 后端代理偶尔会卡住 30s 才返回 502：这里主动超时并重试一次，
    // 避免词牌选择器无限停在「加载中...」。
    for (let attempt = 0; attempt < 2; attempt++) {
      if (attempt > 0) await new Promise(resolve => setTimeout(resolve, RULES_LIST_RETRY_DELAY_MS));
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), RULES_LIST_TIMEOUT_MS);
      try {
        const list = await get<RuleListItem[]>(url, CHECKER_DIRECT_BASE, controller.signal);
        reportRulesListCall();
        return list;
      } catch (err) {
        lastError = err;
      } finally {
        clearTimeout(timer);
      }
    }
    throw lastError;
  })().catch(err => {
    // 失败不缓存，下一次打开词牌选择器可以立即重试
    rulesListCache.delete(key);
    throw err;
  });
  rulesListCache.set(key, request);
  return request;
}

// --- 单字查询：并发调用 checker(音韵) + 主项目(释义) ---
export interface CharLookupResult {
  char: string;
  tones: string[];
  rhyme_categories: (RhymeCategory & { readings?: ShangguyunReading[] })[];
  definitions: { py: string; defs: { d: string; c?: string }[] }[];
  /** 上古释义（不区分诗经/楚辞，每字一份，义项列表，繁体原文） */
  sg_definitions?: string[];
}

export async function charLookup(char: string, book: string): Promise<CharLookupResult> {
  const [rhyme, defs] = await Promise.all([
    get<{
      char: string;
      tones: string[];
      rhyme_categories: (RhymeCategory & { readings?: ShangguyunReading[] })[];
    }>(`/char/lookup?char=${enc(char)}&book=${enc(book)}`, CHECKER_BASE),
    get<{
      char: string;
      definitions: { py: string; defs: { d: string; c?: string }[] }[];
      sg_definitions?: string[];
    }>(`/char/definitions?char=${enc(char)}`),
  ]);
  return { ...rhyme, definitions: defs.definitions, sg_definitions: defs.sg_definitions };
}

// --- 字典搜索 (词首/词末/对语/同位) ---
export function dictionarySearch(params: {
  term: string;
  mode: 'head' | 'tail' | 'pair' | 'tongwei';
  length?: string;
  tone?: string;
  limit?: number;
  offset?: number;
}): Promise<[string, number][] | Record<string, [string, number][]>> {
  let url = `/dictionary/search?term=${enc(params.term)}&mode=${params.mode}`;
  if (params.length) url += `&length=${params.length}`;
  if (params.tone) url += `&tone=${params.tone}`;
  if (params.limit != null) url += `&limit=${params.limit}`;
  if (params.offset != null) url += `&offset=${params.offset}`;
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

const POEMS_API = IS_ANDROID
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

// 直连 coco2 源站：Vercel 回源（write.sjtuguoxue.space → 国内源站）实测
// 20%–67% 的请求 30s 后 502，埋点会静默丢失。
const TRACK_REMOTE = 'https://shi.sjtuguoxue.space/__shiva/api/_track';

async function postEvent(url: string, body: string, timeoutMs: number): Promise<void> {
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
      signal: controller?.signal,
    });
    if (!res.ok) throw new Error(`track failed: ${res.status}`);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export function track(event: string, props?: Record<string, string | number>) {
  const source = IS_ANDROID ? 'android' : 'frontend';
  const body = JSON.stringify({ event, props, source });
  if (IS_ANDROID) {
    // 本地优先：同源写入本地 Flask 的落盘队列，断网也不丢，联网后补发；
    // 本地服务异常时才直连源站兜底。
    postEvent(`${BASE}/_track`, body, 3000)
      .catch(() => postEvent(TRACK_REMOTE, body, 6000))
      .catch(() => {});
    return;
  }
  // Web 直连源站；失败重试一次，宁可变多一点也不要丢
  postEvent(`${BASE}/_track`, body, 8000)
    .catch(() => new Promise<void>(resolve => setTimeout(resolve, 800)).then(() => postEvent(`${BASE}/_track`, body, 8000)))
    .catch(() => {});
}

// ---------- 作品上传 ----------

const SUBMIT_URL = `${BASE}/_proxy/submit`;

export interface SubmitData {
  author: string;
  title: string;
  content: string;
  date: string;
  type?: string;
  genre?: string;
  preface?: string;
  footnote?: string;
  legacy_id?: string | null;
  relations?: { id: string; type: string }[];
}

export interface SubmitResult {
  ok: boolean;
  uuid?: string;
  legacy_id?: string;
  title?: string;
  author?: string;
  type?: string;
  genre?: string;
  error?: string;
}

export async function submitPoem(data: SubmitData, apiKey: string, timeoutMs = 20000): Promise<SubmitResult> {
  // 网络波动时请求可能挂起：超时即中止，避免上传流程卡死无法重试
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(SUBMIT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(data),
      signal: controller.signal,
    });
    try {
      const json = await res.json();
      if (!res.ok && !json.error) json.error = `HTTP ${res.status}`;
      return json;
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') {
        return { ok: false, error: '网络超时，请检查网络后重试' };
      }
      return { ok: false, error: `HTTP ${res.status}: ${res.statusText}` };
    }
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') {
      return { ok: false, error: '网络超时，请检查网络后重试' };
    }
    return { ok: false, error: `网络错误：${e instanceof Error ? e.message : String(e)}` };
  } finally {
    clearTimeout(timer);
  }
}
