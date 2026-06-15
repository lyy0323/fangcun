import { useState, useEffect, useRef, useCallback } from 'react';
import { useBoardContext, useActiveBoard } from '../context/BoardContext';
import { PLACEHOLDER, resolveAuthor } from '../lib/types';
import type { PoemSection, ValidationResult } from '../lib/types';
import type { TextAlign } from '../lib/exportImage';
import {
  renderToCanvas,
  loadExportFonts,
  loadFontPreviews,
  previewFontFamily,
  loadLogo,
  downloadCanvas,
  THEME_KEYS,
  THEMES,
  FONT_OPTIONS,
  DEFAULT_FONT,
} from '../lib/exportImage';
import { track } from '../lib/api';
import type { ThemeKey, FontKey } from '../lib/exportImage';
import type { Board } from '../lib/types';
import { X, Download, Loader, Check } from 'lucide-react';


// ============================================================================
// 从 Board 构建诗句行
// ============================================================================

function buildSectionLines(genre: 'Shi' | 'Ci' | 'Free', sec: PoemSection, validation: ValidationResult | null, align?: TextAlign): string[] {
  if (genre === 'Free') {
    const rawLines = sec.lines ?? [];
    if (align !== 'justify') return rawLines;
    // Justify: merge single newlines (empty strings between non-empty lines), preserve double+ newlines
    const merged: string[] = [];
    let buf = '';
    for (let i = 0; i < rawLines.length; i++) {
      if (rawLines[i] === '') {
        // Check if this is part of consecutive empty lines (double+ newline)
        if (buf) { merged.push(buf); buf = ''; }
        let count = 0;
        while (i < rawLines.length && rawLines[i] === '') { count++; i++; }
        i--; // adjust for loop increment
        if (count >= 1) merged.push(''); // preserve paragraph break
      } else {
        buf += rawLines[i];
      }
    }
    if (buf) merged.push(buf);
    // Wrap at 20 chars per line, track paragraph-end lines
    const wrapped: string[] = [];
    for (const seg of merged) {
      if (seg === '') { wrapped.push(''); continue; }
      const chars = [...seg];
      for (let j = 0; j < chars.length; j += 20) {
        wrapped.push(chars.slice(j, j + 20).join(''));
      }
    }
    return wrapped;
  }
  const chars = sec.poemChars;
  const rhymeSet = new Set(validation?.rhyme_positions ?? []);
  const sentenceLen =
    genre === 'Shi' ? (sec.charCount % 7 === 0 ? 7 : 5) : 0;

  // Default punctuation (ignores overrides) — used for line-break decisions
  const getDefaultPunct = (gi: number): string => {
    if (genre === 'Shi') {
      const posInCouplet = gi % (sentenceLen * 2);
      const isSentenceEnd =
        posInCouplet === sentenceLen - 1 ||
        posInCouplet === sentenceLen * 2 - 1;
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

  // Display punctuation (with user overrides) — used for actual text
  const getDisplayPunct = (gi: number): string => {
    if (sec.punctOverrides && gi in sec.punctOverrides) return sec.punctOverrides[gi];
    return getDefaultPunct(gi);
  };

  if (genre === 'Shi') {
    const coupletLen = sentenceLen * 2;
    const lines: string[] = [];
    for (let start = 0; start < chars.length; start += coupletLen) {
      const OPENING = new Set(['「', '《', '“', '‘']);
      let line = '';
      for (let i = start; i < Math.min(start + coupletLen, chars.length); i++) {
        const am = sec.auxMarks?.[i];
        if (am) { for (const m of am) { if (OPENING.has(m)) line += m; } }
        line += chars[i] === PLACEHOLDER ? '□' : chars[i];
        if (am) { for (const m of am) { if (!OPENING.has(m)) line += m; } }
        line += getDisplayPunct(i);
      }
      if (line && !/[，。、；：？！]$/.test(line)) line += '。';
      lines.push(line);
    }
    return lines;
  }

  // Ci: build per-char text segments, split by default 。 positions
  const OPENING_CI = new Set(['「', '《', '“', '‘']);
  const segments: string[] = [];
  let cur = '';
  for (let i = 0; i < chars.length; i++) {
    const am = sec.auxMarks?.[i];
    if (am) { for (const m of am) { if (OPENING_CI.has(m)) cur += m; } }
    cur += chars[i] === PLACEHOLDER ? '□' : chars[i];
    if (am) { for (const m of am) { if (!OPENING_CI.has(m)) cur += m; } }
    cur += getDisplayPunct(i);
    if (getDefaultPunct(i) === '。') {
      segments.push(cur);
      cur = '';
    }
  }
  if (cur.trim()) {
    if (!/[，。、；：？！]$/.test(cur)) cur += '。';
    segments.push(cur);
  }
  return segments;
}

function buildAllPoemLines(board: Board, validations: (ValidationResult | null)[], align?: TextAlign): { lines: string[]; titleLines: Set<number>; metaLines: Set<number> } {
  const allLines: string[] = [];
  const titleLines = new Set<number>();
  const metaLines = new Set<number>();
  board.sections.forEach((sec, idx) => {
    const v = validations[idx] ?? null;
    if (idx > 0) allLines.push('');
    if (sec.sectionPreface) {
      metaLines.add(allLines.length);
      allLines.push(sec.sectionPreface);
    }
    if (sec.title) {
      titleLines.add(allLines.length);
      allLines.push(sec.title);
    }
    allLines.push(...buildSectionLines(board.genre, sec, v, align));
    if (sec.sectionFootnote) {
      metaLines.add(allLines.length);
      allLines.push(sec.sectionFootnote);
    }
    if (sec.sectionDate && !sec.sectionDateHidden) {
      metaLines.add(allLines.length);
      allLines.push(convertGregorianToChinese(sec.sectionDate));
    }
  });
  return { lines: allLines, titleLines, metaLines };
}

// ============================================================================
// 日期转换
// ============================================================================

/** 将公历日期转换为中文数字格式 */
function convertGregorianToChinese(dateStr: string): string {
  // 匹配公历格式：YYYY-MM-DD 或 YYYY/MM/DD 或 YYYY.MM.DD
  const gregorianPattern = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/;
  const match = dateStr.match(gregorianPattern);

  if (!match) {
    // 不是公历格式，原样返回（可能是农历）
    return dateStr;
  }

  const year = match[1];
  const month = parseInt(match[2]);
  const day = parseInt(match[3]);

  // 数字转中文
  const numMap: Record<string, string> = {
    '0': '〇', '1': '一', '2': '二', '3': '三', '4': '四',
    '5': '五', '6': '六', '7': '七', '8': '八', '9': '九'
  };

  // 转换年份（逐位转换）
  const yearChinese = year.split('').map(d => numMap[d]).join('');

  // 转换月份
  const monthChinese = month === 10 ? '十' :
                       month === 11 ? '十一' :
                       month === 12 ? '十二' :
                       month < 10 ? numMap[month.toString()] : '';

  // 转换日期
  let dayChinese = '';
  if (day === 10) {
    dayChinese = '十';
  } else if (day < 10) {
    dayChinese = numMap[day.toString()];
  } else if (day < 20) {
    dayChinese = '十' + numMap[(day % 10).toString()];
  } else if (day === 20) {
    dayChinese = '二十';
  } else if (day < 30) {
    dayChinese = '二十' + numMap[(day % 10).toString()];
  } else if (day === 30) {
    dayChinese = '三十';
  } else {
    dayChinese = '三十' + numMap[(day % 10).toString()];
  }

  return `${yearChinese}年${monthChinese}月${dayChinese}日`;
}

// ============================================================================
// 组件
// ============================================================================

export function ExportPreview({ onClose }: { onClose: () => void }) {
  const { state } = useBoardContext();
  const board = useActiveBoard();
  const [theme, setTheme] = useState<ThemeKey>('素白');
  const [fontKey, setFontKey] = useState<FontKey>(DEFAULT_FONT);
  const [loading, setLoading] = useState(true);
  const [canvasEl, setCanvasEl] = useState<HTMLCanvasElement | null>(null);
  const [downloadState, setDownloadState] = useState<'idle' | 'saving' | 'done'>('idle');
  const [align, setAlign] = useState<TextAlign>('center');
  const previewRef = useRef<HTMLDivElement>(null);

  const isFree = board?.genre === 'Free';
  const { lines, titleLines, metaLines } = board ? buildAllPoemLines(board, state.validations, isFree ? align : undefined) : { lines: [] as string[], titleLines: new Set<number>(), metaLines: new Set<number>() };

  // 预加载各字体的"文"字用于选择器预览
  useEffect(() => { loadFontPreviews(); }, []);

  const render = useCallback(async () => {
    if (!board || lines.length === 0) return;
    const sectionCharCount = board.genre === 'Free'
      ? Math.max(...lines.map(l => [...l].length), 1)
      : board.sections[0].charCount;
    setLoading(true);
    const metadata = board.metadata || {};
    const rawDate = (!metadata.dateHidden && metadata.date) || '';
    const preface = metadata.preface || '';
    const footnote = metadata.footnote || '';
    const author = resolveAuthor(metadata);

    // 转换公历日期为中文数字格式
    const date = rawDate ? convertGregorianToChinese(rawDate) : '';

    const exportTitle = (() => {
      let t = board.title;
      if (localStorage.getItem('fangcun_title_spacing') === '1' && [...t].length === 2) {
        t = [...t].join(' ');
      }
      return t;
    })();
    const allText = exportTitle + lines.join('') + date + preface + footnote + author;
    const [, logo] = await Promise.all([loadExportFonts(allText, fontKey), loadLogo()]);
    const canvas = renderToCanvas({
      title: exportTitle,
      lines,
      charCount: sectionCharCount,
      genre: board.genre,
      theme,
      fontKey,
      logo,
      date,
      preface,
      footnote,
      author,
      sectionCount: board.sections.length,
      titleLines,
      metaLines,
      align: isFree ? align : undefined,
    });
    setCanvasEl(canvas);
    setLoading(false);
  }, [board, theme, fontKey, align]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    render();
  }, [render]);

  // 将 canvas 渲染为 img 以便预览（自动缩放）
  useEffect(() => {
    if (!canvasEl || !previewRef.current) return;
    const img = document.createElement('img');
    img.src = canvasEl.toDataURL();
    img.style.width = '100%';
    img.style.borderRadius = '8px';
    previewRef.current.innerHTML = '';
    previewRef.current.appendChild(img);
  }, [canvasEl]);

  const handleDownload = async () => {
    if (!canvasEl || !board || downloadState !== 'idle') return;
    setDownloadState('saving');
    const isAndroid = !!window.AndroidBridge?.saveImage;
    await downloadCanvas(canvasEl, board.title, theme);
    track('export_image', { theme, genre: board.genre });
    if (isAndroid) track('save_image', { theme, genre: board.genre });
    setDownloadState('done');
    setTimeout(() => setDownloadState('idle'), 1500);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={onClose}
    >
      <div className="absolute inset-0 backdrop-blur-sm bg-black/30" />
      <div
        className="relative bg-[var(--bg-card)] rounded-2xl shadow-[var(--shadow)] w-[90%] max-w-md max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 顶栏 */}
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-[var(--border)]">
          <h2 className="text-base font-semibold text-[var(--text)]">
            导出图片
          </h2>
          <button
            className="w-7 h-7 rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--accent-light)] transition-colors"
            onClick={onClose}
          >
            <X size={16} />
          </button>
        </div>

        {/* 预览区 */}
        <div className="flex-1 overflow-y-auto px-4 py-4 relative">
          <div ref={previewRef} className="rounded-lg overflow-hidden shadow-sm"
            onContextMenu={() => { if (board) track('long_press_image', { theme, genre: board.genre }); }}
          />
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-[var(--bg-card)]/80">
              <Loader size={20} className="animate-spin text-[var(--text-muted)]" />
            </div>
          )}
        </div>

        {/* 底栏：字体 + 配色 + 下载 */}
        <div className="px-4 py-3 border-t border-[var(--border)] flex flex-col gap-2.5">
          {/* 对齐方式（仅自由诗） */}
          {isFree && (
          <div className="flex gap-0.5 border border-[var(--border)] rounded-lg p-0.5 w-fit">
            {([
              ['left', 'M2 3h8M2 7h6M2 11h8M2 15h5'],
              ['center', 'M1 3h10M3 7h6M1 11h10M2 15h8'],
              // ['right', 'M4 3h8M6 7h6M4 11h8M7 15h5'],
              ['justify', 'M2 3h8M2 7h8M2 11h8M2 15h8'],
            ] as [TextAlign, string][]).map(([mode, d]) => (
              <button
                key={mode}
                onClick={() => setAlign(mode)}
                className={`w-8 h-7 rounded flex items-center justify-center transition-colors ${
                  align === mode
                    ? 'bg-[var(--accent)] text-white'
                    : 'text-[var(--text-muted)] hover:bg-[var(--accent-light)]'
                }`}
                title={{ left: '左对齐', center: '居中', right: '右对齐', justify: '两端对齐' }[mode]}
              >
                <svg width="12" height="18" viewBox="0 0 12 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                  <path d={d} />
                </svg>
              </button>
            ))}
          </div>
          )}
          {/* 字体选择 */}
          <div className="flex flex-wrap gap-1.5">
            {FONT_OPTIONS.map((f) => (
              <button
                key={f.key}
                onClick={() => setFontKey(f.key)}
                className="w-7 h-7 rounded-full flex items-center justify-center text-xs transition-all shrink-0"
                style={{
                  fontFamily: previewFontFamily(f.cssDir),
                  boxShadow: fontKey === f.key
                    ? '0 0 0 2px var(--bg-card), 0 0 0 3.5px var(--accent)'
                    : 'inset 0 0 0 1px rgba(0,0,0,0.12)',
                }}
                title={f.label}
              >
                文
              </button>
            ))}
          </div>
          {/* 配色 + 下载 */}
          <div className="flex items-center justify-between gap-3">
          <div className="flex gap-1.5 overflow-x-auto flex-1 min-w-0 py-1 px-1">
            {THEME_KEYS.map((k) => {
              const t = THEMES[k];
              const bgStyle = t.topoColor
                ? { background: `radial-gradient(circle at 75% 25%, ${t.topoColor}, ${t.bg} 70%)` }
                : t.blobs
                  ? { background: `radial-gradient(circle at 30% 50%, ${t.blobs[0].color}88 0%, transparent 60%), radial-gradient(circle at 70% 50%, ${(t.blobs[1] ?? t.blobs[0]).color}88 0%, transparent 60%), ${t.bg}` }
                  : t.splitBg
                    ? { background: `linear-gradient(180deg, ${t.splitBg.top} 40%, ${t.splitBg.bottom} 60%)` }
                    : t.gradient
                      ? { background: `linear-gradient(${t.gradient.angle ?? 180}deg, ${t.gradient.colors.join(', ')})` }
                      : { backgroundColor: t.bg };
              return (
              <button
                key={k}
                onClick={() => { setTheme(k); track('switch_theme', { theme: k }); }}
                className="w-6 h-6 rounded-full transition-all shrink-0"
                style={{
                  ...bgStyle,
                  boxShadow:
                    theme === k
                      ? `0 0 0 2px var(--bg-card), 0 0 0 3.5px ${t.text}`
                      : `inset 0 0 0 1px rgba(0,0,0,0.12)`,
                }}
                title={k}
              />
              );
            })}
          </div>
          <button
            onClick={handleDownload}
            disabled={!canvasEl || loading || downloadState === 'saving'}
            className={[
              'shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-all disabled:opacity-40',
              downloadState === 'done'
                ? 'bg-emerald-100 text-emerald-600'
                : 'bg-[var(--accent-light)] text-[var(--accent)] hover:opacity-80',
            ].join(' ')}
            title="下载"
          >
            {downloadState === 'saving' ? <Loader size={16} className="animate-spin" /> :
             downloadState === 'done' ? <Check size={16} /> :
             <Download size={16} />}
          </button>
          </div>
        </div>
      </div>
    </div>
  );
}
