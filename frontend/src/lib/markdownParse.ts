import type { MarkdownPasteResult, MarkdownPasteSection } from '../context/BoardContext';

const DATE_RE = /^\d{4}[.\-/]\d{1,2}[.\-/]\d{1,2}$/;

export function isMarkdownPaste(text: string): boolean {
  return /^###\s/m.test(text) || (/^>/m.test(text) && /^####\s/m.test(text));
}

function normalizeLines(lines: string[]): string[] {
  while (lines.length > 0 && lines[0] === '') lines.shift();
  while (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();
  if (lines.length === 0) return lines;

  let hasDoubleBlank = false;
  let consecutive = 0;
  for (const l of lines) {
    if (l === '') { consecutive++; if (consecutive >= 2) hasDoubleBlank = true; }
    else consecutive = 0;
  }

  if (!hasDoubleBlank) {
    return lines.filter(l => l !== '');
  }

  const result: string[] = [];
  consecutive = 0;
  for (const l of lines) {
    if (l === '') {
      consecutive++;
    } else {
      if (consecutive >= 2) result.push('');
      consecutive = 0;
      result.push(l);
    }
  }
  return result;
}

function isDateString(s: string): boolean {
  if (DATE_RE.test(s)) return true;
  if (/^日期[：:]/.test(s)) return true;
  return false;
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
    section.date = extractDate(last);
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

    // #### Section title
    if (/^####\s/.test(trimmed)) {
      finishSection();
      currentSection = { lines: [] };
      currentSection.title = trimmed.replace(/^####\s+/, '').trim() || undefined;
      phase = 'before';
      hasSection = true;
      continue;
    }

    // --- separator (skip)
    if (/^-{3,}$/.test(trimmed)) continue;

    // > blockquote
    if (/^>/.test(trimmed)) {
      const content = trimmed.replace(/^>\s*/, '').trim();
      if (!content) continue;

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

    // Regular text line
    if (phase === 'after' || phase === 'before') {
      phase = 'text';
    }
    currentSection.lines.push(trimmed);
  }

  finishSection();

  if (result.sections.length === 0 && result.boardPreface) {
    result.sections.push({ lines: [], preface: result.boardPreface });
    result.boardPreface = undefined;
  }

  return result;
}
