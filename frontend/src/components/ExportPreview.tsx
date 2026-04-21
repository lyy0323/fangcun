import { useState, useEffect, useRef, useCallback } from 'react';
import { useBoardContext, useActiveBoard } from '../context/BoardContext';
import { PLACEHOLDER, resolveAuthor } from '../lib/types';
import type { PoemSection, ValidationResult } from '../lib/types';
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

function buildSectionLines(genre: 'Shi' | 'Ci' | 'Free', sec: PoemSection, validation: ValidationResult | null): string[] {
  if (genre === 'Free') {
    return sec.lines ?? [];
  }
  const chars = sec.poemChars;
  const rhymeSet = new Set(validation?.rhyme_positions ?? []);
  const sentenceLen =
    genre === 'Shi' ? (sec.charCount % 7 === 0 ? 7 : 5) : 0;

  const getPunct = (gi: number): string => {
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

  if (genre === 'Shi') {
    const coupletLen = sentenceLen * 2;
    const lines: string[] = [];
    for (let start = 0; start < chars.length; start += coupletLen) {
      let line = '';
      for (let i = start; i < Math.min(start + coupletLen, chars.length); i++) {
        line += chars[i] === PLACEHOLDER ? '□' : chars[i];
        line += getPunct(i);
      }
      if (line && !/[。，]$/.test(line)) line += '。';
      lines.push(line);
    }
    return lines;
  }

  let fullText = '';
  for (let i = 0; i < chars.length; i++) {
    fullText += chars[i] === PLACEHOLDER ? '□' : chars[i];
    fullText += getPunct(i);
  }
  if (fullText.length > 0 && !/[。，、]$/.test(fullText)) {
    fullText += '。';
  }

  const lines: string[] = [];
  let cur = '';
  for (const ch of fullText) {
    cur += ch;
    if (ch === '。') {
      lines.push(cur);
      cur = '';
    }
  }
  if (cur.trim()) lines.push(cur);
  return lines;
}

function buildAllPoemLines(board: Board, validations: (ValidationResult | null)[]): { lines: string[]; titleLines: Set<number> } {
  const allLines: string[] = [];
  const titleLines = new Set<number>();
  board.sections.forEach((sec, idx) => {
    const v = validations[idx] ?? null;
    if (idx > 0) allLines.push('');
    if (sec.title) {
      titleLines.add(allLines.length);
      allLines.push(sec.title);
    }
    allLines.push(...buildSectionLines(board.genre, sec, v));
  });
  return { lines: allLines, titleLines };
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
  const previewRef = useRef<HTMLDivElement>(null);

  const { lines, titleLines } = board ? buildAllPoemLines(board, state.validations) : { lines: [] as string[], titleLines: new Set<number>() };

  // 预加载各字体的"文"字用于选择器预览
  useEffect(() => { loadFontPreviews(); }, []);

  const render = useCallback(async () => {
    if (!board || lines.length === 0) return;
    const sectionCharCount = board.genre === 'Free'
      ? Math.max(...lines.map(l => [...l].length), 1)
      : board.sections[0].charCount;
    setLoading(true);
    const metadata = board.metadata || {};
    const rawDate = metadata.date || '';
    const preface = metadata.preface || '';
    const footnote = metadata.footnote || '';
    const author = resolveAuthor(metadata);

    // 转换公历日期为中文数字格式
    const date = rawDate ? convertGregorianToChinese(rawDate) : '';

    const allText = board.title + lines.join('') + date + preface + footnote + author;
    const [, logo] = await Promise.all([loadExportFonts(allText, fontKey), loadLogo()]);
    const canvas = renderToCanvas({
      title: board.title,
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
    });
    setCanvasEl(canvas);
    setLoading(false);
  }, [board, theme, fontKey]); // eslint-disable-line react-hooks/exhaustive-deps

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
    await downloadCanvas(canvasEl, board.title, theme);
    track('export_image', { theme, genre: board.genre });
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
          <div ref={previewRef} className="rounded-lg overflow-hidden shadow-sm" />
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-[var(--bg-card)]/80">
              <Loader size={20} className="animate-spin text-[var(--text-muted)]" />
            </div>
          )}
        </div>

        {/* 底栏：字体 + 配色 + 下载 */}
        <div className="px-4 py-3 border-t border-[var(--border)] flex flex-col gap-2.5">
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
                onClick={() => setTheme(k)}
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
