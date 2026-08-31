// ============================================================================
// Markdown 往返（导出 + 导入）纯函数
// 从 TopBar.tsx / BoardContext.tsx 抽出，供 reducer / 组件调用，且可在 Node 中
// 直接做往返（导出 → 解析 → 导入）单元验证。
// ============================================================================
import { PLACEHOLDER, resolveAuthor } from './types';
import type { Board, BoardMetadata, PoemSection, ValidationResult } from './types';

export interface MarkdownPasteSection {
  title?: string;
  preface?: string;
  footnote?: string;
  date?: string;
  /** 日期为农历格式（如「甲辰年三月初一」）时置位 */
  dateIsLunar?: boolean;
  lines: string[];
}

export interface MarkdownPasteResult {
  title?: string;
  author?: string;
  boardPreface?: string;
  boardFootnote?: string;
  boardDate?: string;
  boardDateIsLunar?: boolean;
  sections: MarkdownPasteSection[];
}

export interface MarkdownExportOptions {
  author: 'off' | 'override' | 'all';
  date: boolean;
}

// ============================================================================
// 导出：单画板 → Markdown
// ============================================================================

/**
 * 结构：
 *   ### 标题 / 作者
 *   > 画板序
 *   #### 小标题        （组诗时每节都有标题行，无题输出空 `#### `）
 *   > 本首序
 *   正文
 *   > 本首注
 *   > 本首日期
 *   > 画板注
 *   > 画板日期
 */
export function buildBoardMarkdown(
  b: Board,
  opts: MarkdownExportOptions,
  validations: (ValidationResult | null)[],
): string {
  const meta = b.metadata || {};
  const author = opts.author === 'off' ? ''
    : opts.author === 'override' ? (meta.author ?? '')
    : resolveAuthor(meta);
  const heading = author ? `### ${b.title} / ${author}` : `### ${b.title}`;
  const bq = (text: string) => text.split('\n').map(l => `> ${l}`);
  const lines: string[] = [heading, ''];

  // 画板序
  if (meta.preface) { lines.push(...bq(meta.preface), ''); }

  const multiSection = b.sections.length > 1;

  b.sections.forEach((sec, idx) => {
    // 小节标题（组诗）。每节都输出标题行：无题小节输出空 `#### `，
    // 保证第 1 节之后的边界可被解析回，且首节小序不会与画板序混淆。
    if (multiSection) {
      if (sec.title) lines.push(`#### ${sec.title}`, '');
      else lines.push(`#### `, '');
    }

    // 本首序
    if (sec.sectionPreface) lines.push(...bq(sec.sectionPreface), '');

    // 正文
    if (b.genre === 'Free') {
      // 保留空行（分节/分段），仅丢弃纯空白行
      const sLines = (sec.lines ?? []).filter(l => l === '' || l.trim() !== '');
      lines.push(...sLines, '');
    } else {
      const validation = validations[idx] ?? null;
      const chars = sec.poemChars;
      const rhymeSet = new Set(validation?.rhyme_positions ?? []);
      const sentenceLen = b.genre === 'Shi' ? (sec.charCount % 7 === 0 ? 7 : 5) : 0;

      const getPunct = (gi: number): string => {
        if (sec.punctOverrides && gi in sec.punctOverrides) return sec.punctOverrides[gi];
        if (b.genre === 'Shi') {
          const posInCouplet = gi % (sentenceLen * 2);
          const isSentenceEnd = posInCouplet === sentenceLen - 1 || posInCouplet === sentenceLen * 2 - 1;
          if (!isSentenceEnd) return '';
          return rhymeSet.has(gi) ? '。' : '，';
        }
        if (!validation?.display_segments) return '';
        for (const seg of validation.display_segments) {
          const offset = gi - seg.start_index;
          if (offset >= 0 && offset < seg.rule_items.length) {
            const comment = seg.rule_items[offset].comment;
            if (rhymeSet.has(gi)) return '。';
            if (comment === '叶' || comment === '换叶') return '。';
            if (comment === '句') return '，';
            if (comment === '读') return '、';
            return '';
          }
        }
        return '';
      };

      const OPENING = new Set(['「', '《', '“', '‘']);
      let text = '';
      for (let i = 0; i < chars.length; i++) {
        const am = sec.auxMarks?.[i];
        if (am) { for (const m of am) { if (OPENING.has(m)) text += m; } }
        text += chars[i] === PLACEHOLDER ? '□' : chars[i];
        if (am) { for (const m of am) { if (!OPENING.has(m)) text += m; } }
        const punct = getPunct(i);
        if (punct) text += punct;
        if (b.genre === 'Shi' && sentenceLen > 0) {
          const posInCouplet = i % (sentenceLen * 2);
          if (posInCouplet === sentenceLen * 2 - 1 && i < chars.length - 1) text += '\n';
        }
      }
      if (text.length > 0 && !/[，。、；：？！]$/.test(text)) text += '。';
      lines.push(text, '');
    }

    // 本首注 / 日期（日期恒在注之后，解析时取最后一个引用块为日期）
    if (sec.sectionFootnote) lines.push(...bq(sec.sectionFootnote));
    if (opts.date && sec.sectionDate && !sec.sectionDateHidden) lines.push(`> ${sec.sectionDate}`);
    if (sec.sectionFootnote || (opts.date && sec.sectionDate && !sec.sectionDateHidden)) lines.push('');
  });

  // 画板注 / 日期。组诗时以 `---` 与末节引用块分隔，保证可解析回画板级
  // （单节画板无 `---`，末引用块经单节上浮逻辑落回画板级）。
  const hasBoardTail = meta.footnote || (opts.date && meta.date && !meta.dateHidden);
  if (multiSection && hasBoardTail) lines.push('---', '');
  if (meta.footnote) lines.push(...bq(meta.footnote));
  if (opts.date && meta.date && !meta.dateHidden) lines.push(`> ${meta.date}`);

  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd();
}

// ============================================================================
// 导入：MarkdownPasteResult → 画板
// ============================================================================

/**
 * 语义：粘贴的 markdown 替换当前画板内容。
 * - 标题/作者/序/注/日期 → 画板级元数据
 * - 单节内容：本首序/注/日期上浮为画板级
 * - 多节内容：逐节写入 section 级字段；节数不足时按首节体裁补齐
 * - 律诗/词：正文按字序填入 poemChars，□ 空位还原为占位符，超出部分清空
 * - 农历日期 → 画板 dateFormat 置为 Lunar
 */
export function applyMarkdownImport(board: Board, payload: MarkdownPasteResult): Board {
  const updated: Board = { ...board, updatedAt: Date.now() };

  if (payload.title) updated.title = payload.title;

  const meta: Partial<BoardMetadata> = {};
  if (payload.author) meta.author = payload.author;
  if (payload.boardPreface) meta.preface = payload.boardPreface;
  if (payload.boardFootnote) meta.footnote = payload.boardFootnote;
  if (payload.boardDate) meta.date = payload.boardDate;

  const pSections = payload.sections;
  if (pSections.length === 0) return updated;

  // 节数不足时按首节体裁补齐
  const sections = [...updated.sections];
  while (sections.length < pSections.length) {
    const ref = sections[0];
    sections.push({
      id: crypto.randomUUID(),
      title: '',
      ruleName: ref.ruleName,
      charCount: ref.charCount,
      poemChars: Array(ref.charCount).fill(PLACEHOLDER),
      candidatesMap: {},
    } as PoemSection);
  }

  const singleSection = pSections.length === 1;
  let anyLunar = !!payload.boardDateIsLunar;

  for (let i = 0; i < pSections.length; i++) {
    const ps = pSections[i];
    const sec: PoemSection = { ...sections[i] };
    if (ps.title) sec.title = ps.title;

    if (singleSection) {
      // 单节：本首元数据上浮为画板级
      if (ps.preface && !meta.preface) meta.preface = ps.preface;
      if (ps.footnote && !meta.footnote) meta.footnote = ps.footnote;
      if (ps.date && !meta.date) meta.date = ps.date;
    } else {
      if (ps.preface) sec.sectionPreface = ps.preface;
      if (ps.footnote) sec.sectionFootnote = ps.footnote;
      if (ps.date) sec.sectionDate = ps.date;
    }
    if (ps.dateIsLunar) anyLunar = true;

    if (board.genre === 'Free') {
      sec.lines = ps.lines;
    } else {
      // 按字序填入：□（导出空位占位）还原为占位符，保持位置不位移；
      // 超出粘贴内容的尾部清空，避免残留旧内容。
      const allText = ps.lines.join('');
      const chars = [...allText].filter(c => /[一-鿿㐀-䶿□]/.test(c));
      const poemChars = [...sec.poemChars];
      for (let j = 0; j < poemChars.length; j++) {
        if (j < chars.length) {
          const c = chars[j];
          poemChars[j] = c === '□' ? PLACEHOLDER : c;
        } else {
          poemChars[j] = PLACEHOLDER;
        }
      }
      sec.poemChars = poemChars;
    }
    sections[i] = sec;
  }

  if (anyLunar) meta.dateFormat = 'Lunar';
  updated.sections = sections;
  if (Object.keys(meta).length > 0) updated.metadata = { ...updated.metadata, ...meta };
  return updated;
}
