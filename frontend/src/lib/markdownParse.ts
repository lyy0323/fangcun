import type { MarkdownPasteResult, MarkdownPasteSection } from './markdownRoundTrip';

const DATE_RE = /^\d{4}[.\-/]\d{1,2}[.\-/]\d{1,2}$/;
// 农历：甲辰年三月初一 / 2024年三月初一（年可为干支或四位数字）
const LUNAR_DATE_RE = /^(?:\d{4}|[甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥])年[\u4e00-\u9fff]{0,3}月[\u4e00-\u9fff]{0,4}日?$/;

export function isMarkdownPaste(text: string): boolean {
  return /^###\s/m.test(text) || (/^>/m.test(text) && /^####\s/m.test(text));
}

function normalizeLines(lines: string[]): string[] {
  while (lines.length > 0 && lines[0] === '') lines.shift();
  while (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();
  if (lines.length === 0) return lines;

  // 单空行保留（自由诗分节），连续空行折叠为一行
  const result: string[] = [];
  let consecutive = 0;
  for (const l of lines) {
    if (l === '') {
      consecutive++;
      if (consecutive === 1) result.push('');
    } else {
      consecutive = 0;
      result.push(l);
    }
  }
  return result;
}

function isDateString(s: string): boolean {
  if (DATE_RE.test(s)) return true;
  if (/^日期[：:]/.test(s)) return true;
  return isLunarDateString(s);
}

function isLunarDateString(s: string): boolean {
  return !DATE_RE.test(s) && LUNAR_DATE_RE.test(s);
}

function normalizeDate(s: string): string {
  const m = s.match(/^(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})$/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  return s;
}

function extractDate(s: string): string {
  const raw = DATE_RE.test(s) ? s : s.replace(/^日期[：:]?\s*/, '');
  return normalizeDate(raw);
}

function resolveAfterQuotes(quotes: string[], section: MarkdownPasteSection) {
  if (quotes.length === 0) return;
  const last = quotes[quotes.length - 1];
  if (isDateString(last)) {
    const extracted = extractDate(last);
    section.date = extracted;
    section.dateIsLunar = isLunarDateString(extracted);
    const rest = quotes.slice(0, -1);
    if (rest.length > 0) section.footnote = rest.join('\n');
  } else {
    section.footnote = quotes.join('\n');
  }
}

export function parseMarkdownPaste(text: string): MarkdownPasteResult {
  const lines = text.split(/\r?\n/);
  const result: MarkdownPasteResult = { sections: [] };
  let currentSection: MarkdownPasteSection = { lines: [] };
  let afterQuotes: string[] = [];
  let phase: 'before' | 'text' | 'after' = 'before';
  let hasSection = false;
  // `---` 之后、下一个标题之前的引用块视为画板级注/日期
  // （组诗导出时以 `---` 分隔末节注/日期与画板注/日期）
  let boardQuoteMode = false;
  let boardQuotes: string[] = [];

  const resolveBoardQuotes = () => {
    if (boardQuotes.length === 0) return;
    const last = boardQuotes[boardQuotes.length - 1];
    if (isDateString(last)) {
      const extracted = extractDate(last);
      result.boardDate = extracted;
      result.boardDateIsLunar = isLunarDateString(extracted);
      const rest = boardQuotes.slice(0, -1);
      if (rest.length > 0) result.boardFootnote = rest.join('\n');
    } else {
      result.boardFootnote = boardQuotes.join('\n');
    }
    boardQuotes = [];
  };

  const finishSection = () => {
    resolveAfterQuotes(afterQuotes, currentSection);
    afterQuotes = [];
    if (currentSection.lines.length > 0 || currentSection.preface || currentSection.title) {
      currentSection.lines = normalizeLines(currentSection.lines);
      result.sections.push(currentSection);
    }
  };

  for (const line of lines) {
    const trimmed = line.trim();

    // ### Title / Author
    if (/^###\s/.test(trimmed) && !/^####/.test(trimmed)) {
      resolveBoardQuotes();
      boardQuoteMode = false;
      const content = trimmed.replace(/^###\s+/, '');
      const slashIdx = content.lastIndexOf(' / ');
      if (slashIdx >= 0) {
        result.title = content.slice(0, slashIdx).trim();
        result.author = content.slice(slashIdx + 3).trim();
      } else {
        result.title = content.trim();
      }
      continue;
    }

    // #### Section title（允许无标题的裸 `####` / `#### `，组诗无题小节）
    if (/^####(\s+|$)/.test(trimmed)) {
      resolveBoardQuotes();
      boardQuoteMode = false;
      finishSection();
      currentSection = { lines: [] };
      // \s* 兼容裸 `####`（trim 后无空格）：无题小节不得产生字面 "####" 标题
      currentSection.title = trimmed.replace(/^####\s*/, '').trim() || undefined;
      phase = 'before';
      hasSection = true;
      continue;
    }

    // --- separator：结束当前节尾注/日期，其后引用块归画板级
    if (/^-{3,}$/.test(trimmed)) {
      resolveAfterQuotes(afterQuotes, currentSection);
      afterQuotes = [];
      boardQuoteMode = true;
      continue;
    }

    // > blockquote
    if (/^>/.test(trimmed)) {
      const content = trimmed.replace(/^>\s*/, '').trim();
      if (!content) continue;

      if (boardQuoteMode) {
        boardQuotes.push(content);
        continue;
      }

      if (phase === 'text' && currentSection.lines.some(l => l !== '')) {
        phase = 'after';
      }

      if (phase !== 'after') {
        if (hasSection || result.sections.length > 0) {
          currentSection.preface = currentSection.preface
            ? currentSection.preface + '\n' + content
            : content;
        } else if (!currentSection.lines.length) {
          result.boardPreface = result.boardPreface
            ? result.boardPreface + '\n' + content
            : content;
        }
      } else {
        afterQuotes.push(content);
      }
      continue;
    }

    // Empty line
    if (!trimmed) {
      if (phase === 'text') {
        currentSection.lines.push('');
      }
      continue;
    }

    // Regular text line（画板引用块被正文打断时收束）
    if (boardQuoteMode) {
      resolveBoardQuotes();
      boardQuoteMode = false;
    }
    if (phase === 'after' || phase === 'before') {
      phase = 'text';
    }
    currentSection.lines.push(trimmed);
  }

  finishSection();
  resolveBoardQuotes();

  if (result.sections.length === 0 && result.boardPreface) {
    result.sections.push({ lines: [], preface: result.boardPreface });
    result.boardPreface = undefined;
  }

  return result;
}
