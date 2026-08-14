import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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
  loadBgImage,
  downloadCanvas,
  copyCanvasToClipboard,
  THEME_KEYS,
  THEMES,
  FONT_OPTIONS,
  DEFAULT_FONT,
  computeMinHeight,
  resolveAspectRatio,
  filterThemesByRatio,
} from '../lib/exportImage';
import { track } from '../lib/api';
import type { ThemeKey, FontKey, AspectRatio } from '../lib/exportImage';
import type { Board } from '../lib/types';
import { X, Download, Loader, Check, ImageIcon, Copy, ChevronLeft, ChevronRight } from 'lucide-react';


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

function buildAllPoemLines(board: Board, validations: (ValidationResult | null)[], align?: TextAlign, range?: [number, number]): { lines: string[]; titleLines: Set<number>; metaLines: Set<number> } {
  const allLines: string[] = [];
  const titleLines = new Set<number>();
  const metaLines = new Set<number>();
  const [start, end] = range ?? [0, board.sections.length];
  board.sections.slice(start, end).forEach((sec, idx) => {
    const v = validations[start + idx] ?? null;
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

/** 组诗拆分的滑动条选项：每张图包含 n 首（1..min(5, round(N/2))），以及「全部」（默认，单张） */
function buildSplitOptions(sectionCount: number): (number | 'all')[] {
  if (sectionCount <= 1) return ['all'];
  const maxN = Math.min(5, Math.round(sectionCount / 2));
  const opts: (number | 'all')[] = [];
  for (let n = 1; n <= maxN; n++) opts.push(n);
  opts.push('all');
  return opts;
}

/** 按每张 n 首把 section 切成若干连续区间 */
function buildChunks(sectionCount: number, perImage: number | 'all'): [number, number][] {
  const n = perImage === 'all' ? sectionCount : perImage;
  const chunks: [number, number][] = [];
  for (let start = 0; start < sectionCount; start += n) {
    chunks.push([start, Math.min(start + n, sectionCount)]);
  }
  return chunks;
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

type ExportLoadPhase = 'idle' | 'fonts' | 'background' | 'render' | 'error';

interface ExportLoadState {
  phase: ExportLoadPhase;
  loaded?: number;
  total?: number;
  message?: string;
  warning?: string;
}

export function ExportPreview({ onClose }: { onClose: () => void }) {
  const { state } = useBoardContext();
  const board = useActiveBoard();
  const [theme, setTheme] = useState<ThemeKey>('素白');
  const [fontKey, setFontKey] = useState<FontKey>(DEFAULT_FONT);
  const [loadState, setLoadState] = useState<ExportLoadState>({ phase: 'idle' });
  const [canvasEls, setCanvasEls] = useState<HTMLCanvasElement[]>([]);
  const [page, setPage] = useState(0);
  const [downloadState, setDownloadState] = useState<'idle' | 'saving' | 'done'>('idle');
  const [copyState, setCopyState] = useState<'idle' | 'copying' | 'done' | 'error'>('idle');
  const [align, setAlign] = useState<TextAlign>('center');
  const [splitValue, setSplitValue] = useState<number | 'all'>('all');
  const previewRef = useRef<HTMLDivElement>(null);
  const previewScrollRef = useRef<HTMLDivElement>(null);
  const renderAbortRef = useRef<AbortController | null>(null);
  const renderRequestRef = useRef(0);

  const isFree = board?.genre === 'Free';
  const sectionCount = board?.sections.length ?? 0;
  const splitOptions = useMemo(() => buildSplitOptions(sectionCount), [sectionCount]);
  const chunks = useMemo(() => buildChunks(sectionCount, splitValue), [sectionCount, splitValue]);

  // 每张拆分图各自的行（含 section 级序/标题/正文/脚注/日期）
  const chunkLines = useMemo(() => {
    if (!board) return [];
    return chunks.map(([start, end]) =>
      buildAllPoemLines(board, state.validations, isFree ? align : undefined, [start, end])
    );
  }, [board, chunks, state.validations, isFree, align]);

  const isMulti = chunkLines.length > 1;

  // 预计算纵横比（取所有拆分图中最高者），过滤可用模板
  const aspectRatio: AspectRatio = useMemo(() => {
    if (!board || chunkLines.length === 0) return '3:4';
    const metadata = board.metadata || {};
    const rawDate = (!metadata.dateHidden && metadata.date) || '';
    const date = rawDate ? convertGregorianToChinese(rawDate) : '';
    let maxMinH = 0;
    chunkLines.forEach((cl, ci) => {
      const isLast = ci === chunkLines.length - 1;
      const scc = board.genre === 'Free'
        ? Math.max(...cl.lines.map(l => [...l].length), 1)
        : board.sections[chunks[ci][0]].charCount;
      const minH = computeMinHeight({
        title: board.title, lines: cl.lines, charCount: scc, genre: board.genre, theme,
        date: isLast ? date : '',
        preface: ci === 0 ? (metadata.preface || '') : '',
        footnote: isLast ? (metadata.footnote || '') : '',
        author: resolveAuthor(metadata),
        sectionCount: chunks[ci][1] - chunks[ci][0],
        align: isFree ? align : undefined,
      });
      maxMinH = Math.max(maxMinH, minH);
    });
    return resolveAspectRatio(maxMinH);
  }, [board, chunkLines, chunks, theme, align, isFree]);
  const availableThemes = useMemo(() => filterThemesByRatio(aspectRatio), [aspectRatio]);

  // 如果当前选中模板不可用，自动切换
  useEffect(() => {
    if (availableThemes.length > 0 && !availableThemes.includes(theme)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTheme(availableThemes[0]);
    }
  }, [availableThemes, theme]);

  // 预加载各字体的"文"字用于选择器预览
  useEffect(() => { loadFontPreviews(); }, []);

  // 拆分选项变化后，若当前值已不存在则回退到「全部」
  useEffect(() => {
    if (!splitOptions.includes(splitValue)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSplitValue('all');
    }
  }, [splitOptions, splitValue]);

  const render = useCallback(async () => {
    if (!board || chunkLines.length === 0) return;

    renderAbortRef.current?.abort();
    const controller = new AbortController();
    renderAbortRef.current = controller;
    const requestId = ++renderRequestRef.current;
    const isCurrent = () => renderRequestRef.current === requestId && !controller.signal.aborted;
    const updateState = (next: ExportLoadState) => {
      if (isCurrent()) setLoadState(next);
    };

    setCanvasEls([]);
    updateState({ phase: 'fonts', loaded: 0, total: 0, message: '加载字体' });
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
    // 字体加载需覆盖所有拆分图的文本
    const allText = exportTitle
      + chunkLines.map(cl => cl.lines.join('')).join('')
      + date + preface + footnote + author;
    const colors = THEMES[theme];

    try {
      const [fontResult, logo] = await Promise.all([
        loadExportFonts(allText, fontKey, {
          signal: controller.signal,
          onProgress: (loaded, total) => updateState({ phase: 'fonts', loaded, total, message: '加载字体' }),
        }),
        loadLogo(),
      ]);
      if (!isCurrent() || fontResult.aborted) return;

      const warnings: string[] = [];
      if (fontResult.failedChunks > 0) warnings.push('部分字体资源加载失败，已使用可用字体');
      let warning = warnings.join('；') || undefined;
      let bgImg: HTMLImageElement | null = null;
      if (colors.bgImage) {
        updateState({ phase: 'background', message: '加载背景', warning });
        bgImg = await loadBgImage(colors.bgImage, controller.signal);
        if (!isCurrent()) return;
        if (!bgImg) {
          warnings.push('背景图加载失败，已使用纯色背景');
          warning = warnings.join('；');
        }
      }

      updateState({ phase: 'render', message: '渲染', warning });
      const lastIdx = chunkLines.length - 1;
      const canvases = chunkLines.map((cl, ci) => {
        const charCount = board.genre === 'Free'
          ? Math.max(...cl.lines.map(l => [...l].length), 1)
          : board.sections[chunks[ci][0]].charCount;
        return renderToCanvas({
          title: exportTitle,
          lines: cl.lines,
          charCount,
          genre: board.genre,
          theme,
          fontKey,
          logo,
          bgImg,
          date: ci === lastIdx ? date : '',
          preface: ci === 0 ? preface : '',
          footnote: ci === lastIdx ? footnote : '',
          author,
          sectionCount: chunks[ci][1] - chunks[ci][0],
          titleLines: cl.titleLines,
          metaLines: cl.metaLines,
          align: isFree ? align : undefined,
        });
      });
      if (!isCurrent()) return;
      setCanvasEls(canvases);
      setPage(0);
      setLoadState({ phase: 'idle', warning });
    } catch (error) {
      if (!isCurrent()) return;
      const errorName = error instanceof Error ? error.name : '';
      if (errorName === 'AbortError' || controller.signal.aborted) return;
      setCanvasEls([]);
      setLoadState({ phase: 'error', message: '渲染失败，请重试' });
      console.error('Export render failed:', error);
    }
  }, [board, chunkLines, chunks, theme, fontKey, align, isFree]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void render();
  }, [render]);

  useEffect(() => () => {
    renderAbortRef.current?.abort();
  }, []);

  // 将 canvas 渲染为 img 以便预览（长图按原始比例完整显示，可在预览区内上下滚动）
  useEffect(() => {
    const el = previewRef.current;
    if (!el) return;
    // 预览框最小高度满足 3:4 纵横比；长图由 img 自然撑高容器产生滚动
    if (el.clientWidth > 0) el.style.minHeight = `${el.clientWidth * 4 / 3}px`;
    el.innerHTML = '';
    const canvas = canvasEls[page];
    if (!canvas) return;
    try {
      const img = document.createElement('img');
      img.src = canvas.toDataURL();
      img.style.width = '100%';
      img.style.height = 'auto';
      img.style.display = 'block';
      img.style.borderRadius = '8px';
      el.appendChild(img);
      // 切换图片后预览区初始滚动位置定位到图片顶部
      if (previewScrollRef.current) previewScrollRef.current.scrollTop = 0;
    } catch (error) {
      // 例如跨域背景导致 canvas 被 taint 时，统一落入可重试错误态，
      // 不让异常 effect 留下一个看似可下载但实际不可用的旧预览。
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLoadState({ phase: 'error', message: '渲染失败，请重试' });
      console.error('Export preview failed:', error);
    }
  }, [canvasEls, page]);

  const isLoading = loadState.phase !== 'idle' && loadState.phase !== 'error';
  const hasFontProgress = loadState.phase === 'fonts' && !!loadState.total;
  const progress = hasFontProgress
    ? Math.min(100, Math.round(((loadState.loaded ?? 0) / (loadState.total ?? 1)) * 100))
    : 40;
  const canCopyImage = !window.AndroidBridge?.saveImage
    && typeof ClipboardItem !== 'undefined'
    && typeof navigator.clipboard?.write === 'function';

  const handleCopyImage = async () => {
    const canvas = canvasEls[page];
    if (!canvas || !board || copyState === 'copying') return;
    setCopyState('copying');
    try {
      await copyCanvasToClipboard(canvas);
      track('copy_image', { theme, genre: board.genre });
      setCopyState('done');
    } catch (error) {
      console.error('Copy image failed:', error);
      setCopyState('error');
    }
    setTimeout(() => setCopyState('idle'), 1500);
  };

  const handleDownload = async () => {
    if (canvasEls.length === 0 || !board || downloadState !== 'idle') return;
    setDownloadState('saving');
    const isAndroid = !!window.AndroidBridge?.saveImage;
    const multi = canvasEls.length > 1;
    for (let i = 0; i < canvasEls.length; i++) {
      await downloadCanvas(canvasEls[i], board.title, theme, multi ? i + 1 : undefined);
      // 浏览器可能拦截连续多文件下载，Web 端间隔稍作等待
      if (!isAndroid && multi && i < canvasEls.length - 1) {
        await new Promise(r => setTimeout(r, 300));
      }
    }
    track('export_image', { theme, genre: board.genre, split: multi ? canvasEls.length : 0 });
    if (isAndroid) track('save_image', { theme, genre: board.genre, split: multi ? canvasEls.length : 0 });
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

        {/* 预览区（长图可在区内上下滚动，预览框最小高度 3:4；切换组件固定在下部不随图片滚动） */}
        <div className="flex-1 min-h-0 flex flex-col">
          <div ref={previewScrollRef} className="flex-1 min-h-0 overflow-y-auto px-4 pt-4 pb-1 relative">
            <div
              ref={previewRef}
              className="w-full rounded-lg shadow-sm"
              onContextMenu={() => { if (board) track('long_press_image', { theme, genre: board.genre }); }}
            />
            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-[var(--bg-card)]/85">
                <div className="w-44 flex flex-col items-center gap-3">
                  <Loader size={20} className="animate-spin text-[var(--text-muted)]" />
                  <div className="w-full h-1 rounded-full bg-[var(--border)] overflow-hidden">
                    <div
                      className={`h-full rounded-full bg-[var(--accent)] transition-all duration-200 ${hasFontProgress ? '' : 'w-2/5 animate-pulse'}`}
                      style={hasFontProgress ? { width: `${progress}%` } : undefined}
                    />
                  </div>
                  <span className="text-xs text-[var(--text-muted)]">
                    {hasFontProgress
                      ? `加载字体 ${loadState.loaded ?? 0} / ${loadState.total}`
                      : loadState.message ?? '处理中'}
                  </span>
                </div>
              </div>
            )}
            {loadState.phase === 'error' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[var(--bg-card)]/90">
                <span className="text-xs text-[var(--text-muted)]">{loadState.message}</span>
                <button
                  onClick={() => { void render(); }}
                  className="px-3 py-1.5 rounded-lg text-xs text-white bg-[var(--accent)] hover:opacity-85 transition-opacity"
                >
                  重试
                </button>
              </div>
            )}
            {loadState.phase === 'idle' && loadState.warning && (
              <div className="text-center text-[11px] text-[var(--text-muted)] pb-1">
                {loadState.warning}
              </div>
            )}
          </div>
          {/* 多图切换（固定高度，不随图片滚动） */}
          <div className="shrink-0 h-10 flex items-center justify-center gap-3">
            {isMulti && canvasEls.length > 0 && (
              <>
                <button
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:bg-[var(--accent-light)] hover:text-[var(--accent)] transition-colors disabled:opacity-30"
                  disabled={page === 0}
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  aria-label="上一张"
                >
                  <ChevronLeft size={16} />
                </button>
                <span className="text-xs text-[var(--text-muted)]">{page + 1} / {canvasEls.length}</span>
                <button
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:bg-[var(--accent-light)] hover:text-[var(--accent)] transition-colors disabled:opacity-30"
                  disabled={page >= canvasEls.length - 1}
                  onClick={() => setPage(p => Math.min(canvasEls.length - 1, p + 1))}
                  aria-label="下一张"
                >
                  <ChevronRight size={16} />
                </button>
              </>
            )}
          </div>
        </div>

        {/* 底栏：拆分 + 字体 + 配色 + 下载 */}
        <div className="px-4 py-3 border-t border-[var(--border)] flex flex-col gap-2.5">
          {/* 组诗拆分滑动条（每张图 n 首 / 全部） */}
          {sectionCount > 1 && (
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="text-xs text-[var(--text-muted)]">每张图包含</span>
                <span className="text-xs text-[var(--text-muted)]">
                  {splitValue === 'all'
                    ? `全部（1 张）`
                    : `${splitValue} 首 · 共 ${chunks.length} 张`}
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={splitOptions.length - 1}
                step={1}
                value={splitOptions.indexOf(splitValue)}
                onChange={(e) => setSplitValue(splitOptions[Number(e.target.value)])}
                className="w-full accent-[var(--accent)]"
              />
              <div className="flex justify-between text-[11px] text-[var(--text-muted)]">
                {splitOptions.map((opt, i) => (
                  <span
                    key={i}
                    className={splitOptions.indexOf(splitValue) === i ? 'text-[var(--accent)] font-medium' : ''}
                  >
                    {opt === 'all' ? '全部' : opt}
                  </span>
                ))}
              </div>
            </div>
          )}
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
                className={`w-8 h-7 rounded-[0.35rem] flex items-center justify-center transition-colors ${
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
              const available = availableThemes.includes(k);
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
                onClick={() => { if (available) { setTheme(k); track('switch_theme', { theme: k }); } }}
                className={`relative w-6 h-6 rounded-full transition-all shrink-0 ${available ? '' : 'opacity-20 pointer-events-none'}`}
                style={{
                  ...bgStyle,
                  boxShadow:
                    theme === k
                      ? `0 0 0 2px var(--bg-card), 0 0 0 3.5px ${t.text}`
                      : `inset 0 0 0 1px rgba(0,0,0,0.12)`,
                }}
                title={k}
              >
                {t.bgImage && (
                  <span className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full flex items-center justify-center ${theme === k ? 'bg-[var(--accent-light)] border border-[var(--accent)]' : 'bg-white border border-[var(--border)]'}`}>
                    <ImageIcon size={8} className={theme === k ? 'text-[var(--accent)]' : 'text-[var(--text-muted)]'} />
                  </span>
                )}
              </button>
              );
            })}
          </div>
          <div className="shrink-0 flex items-center gap-1.5">
            {canCopyImage && (
              <button
                onClick={handleCopyImage}
                disabled={!canvasEls[page] || isLoading || loadState.phase === 'error' || copyState === 'copying'}
                className={[
                  'w-8 h-8 rounded-lg flex items-center justify-center transition-all disabled:opacity-40',
                  copyState === 'done'
                    ? 'bg-emerald-100 text-emerald-600'
                    : copyState === 'error'
                      ? 'bg-red-100 text-red-600'
                      : 'bg-[var(--accent-light)] text-[var(--accent)] hover:opacity-80',
                ].join(' ')}
                title={copyState === 'error' ? '复制失败' : '复制图片'}
                aria-label="复制图片"
              >
                {copyState === 'copying' ? <Loader size={16} className="animate-spin" /> :
                 copyState === 'done' ? <Check size={16} /> :
                 <Copy size={16} />}
              </button>
            )}
            <button
              onClick={handleDownload}
              disabled={canvasEls.length === 0 || isLoading || loadState.phase === 'error' || downloadState === 'saving'}
              className={[
                'w-8 h-8 rounded-lg flex items-center justify-center transition-all disabled:opacity-40',
                downloadState === 'done'
                  ? 'bg-emerald-100 text-emerald-600'
                  : 'bg-[var(--accent-light)] text-[var(--accent)] hover:opacity-80',
              ].join(' ')}
              title={isMulti && canvasEls.length > 0 ? `下载全部（${canvasEls.length} 张）` : '下载'}
              aria-label="下载图片"
            >
              {downloadState === 'saving' ? <Loader size={16} className="animate-spin" /> :
               downloadState === 'done' ? <Check size={16} /> :
               <Download size={16} />}
            </button>
          </div>
          </div>
        </div>
      </div>
    </div>
  );
}
