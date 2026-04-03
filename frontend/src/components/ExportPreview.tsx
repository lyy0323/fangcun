import { useState, useEffect, useRef, useCallback } from 'react';
import { useBoardContext, useActiveBoard } from '../context/BoardContext';
import { PLACEHOLDER } from '../lib/types';
import {
  renderToCanvas,
  loadExportFonts,
  loadLogo,
  downloadCanvas,
  THEME_KEYS,
  THEMES,
} from '../lib/exportImage';
import type { ThemeKey } from '../lib/exportImage';
import type { Board, ValidationResult } from '../lib/types';
import { X, Download, Loader } from 'lucide-react';

// ============================================================================
// 从 Board 构建诗句行
// ============================================================================

function buildPoemLines(board: Board, validation: ValidationResult | null): string[] {
  const chars = board.poemChars;
  const rhymeSet = new Set(validation?.rhyme_positions ?? []);
  const sentenceLen =
    board.genre === 'Shi' ? (board.charCount % 7 === 0 ? 7 : 5) : 0;

  // 获取标点
  const getPunct = (gi: number): string => {
    if (board.genre === 'Shi') {
      const posInCouplet = gi % (sentenceLen * 2);
      const isSentenceEnd =
        posInCouplet === sentenceLen - 1 ||
        posInCouplet === sentenceLen * 2 - 1;
      if (!isSentenceEnd) return '';
      return rhymeSet.has(gi) ? '。' : '，';
    }
    // Ci: 依赖 validation
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

  if (board.genre === 'Shi') {
    // 诗：每联（出句+对句）一行，与前端保持一致
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

  // 词：按 。拆行
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

// ============================================================================
// 组件
// ============================================================================

export function ExportPreview({ onClose }: { onClose: () => void }) {
  const { state } = useBoardContext();
  const board = useActiveBoard();
  const [theme, setTheme] = useState<ThemeKey>('素白');
  const [loading, setLoading] = useState(true);
  const [canvasEl, setCanvasEl] = useState<HTMLCanvasElement | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  const lines = board ? buildPoemLines(board, state.validation) : [];

  const render = useCallback(async () => {
    if (!board || lines.length === 0) return;
    setLoading(true);
    const allText = board.title + lines.join('');
    const [, logo] = await Promise.all([loadExportFonts(allText), loadLogo()]);
    const canvas = renderToCanvas({
      title: board.title,
      lines,
      charCount: board.charCount,
      genre: board.genre,
      theme,
      logo,
    });
    setCanvasEl(canvas);
    setLoading(false);
  }, [board, theme]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const handleDownload = () => {
    if (canvasEl && board) downloadCanvas(canvasEl, board.title);
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

        {/* 底栏：配色 + 下载 */}
        <div className="px-4 py-3 border-t border-[var(--border)] flex items-center justify-between gap-3">
          <div className="flex flex-wrap gap-1.5">
            {THEME_KEYS.map((k) => (
              <button
                key={k}
                onClick={() => setTheme(k)}
                className="w-6 h-6 rounded-full transition-all shrink-0"
                style={{
                  backgroundColor: THEMES[k].bg,
                  boxShadow:
                    theme === k
                      ? `0 0 0 2px var(--bg-card), 0 0 0 3.5px ${THEMES[k].text}`
                      : `inset 0 0 0 1px rgba(0,0,0,0.12)`,
                }}
                title={k}
              />
            ))}
          </div>
          <button
            onClick={handleDownload}
            disabled={!canvasEl}
            className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center bg-[var(--accent-light)] text-[var(--accent)] hover:opacity-80 transition-opacity disabled:opacity-40"
            title="下载"
          >
            <Download size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
