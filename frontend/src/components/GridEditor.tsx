import { useState, useRef, useCallback, useEffect } from 'react';
import { useBoardContext, useActiveBoard } from '../context/BoardContext';
import { track } from '../lib/api';
import { useValidation } from '../hooks/useValidation';
import { GridCell } from './GridCell';
import { PLACEHOLDER } from '../lib/types';
import type { ValidationResult } from '../lib/types';
import { X, ChevronUp, ChevronDown, Eye } from 'lucide-react';

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_CELL = 30;
const PUNCT_WIDTH = 14;
const SEP_WIDTH = 12;
const ORDINALS = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];
const PING_COLORS = ['#559977', '#779955', '#888855', '#669966'];
const ZE_COLORS = ['#557799', '#775599', '#885588', '#666699'];
const YE_COLOR = '#d97706';

// ============================================================================
// Pure helpers
// ============================================================================

interface SegmentLike {
  start_index: number;
  text_chars: string[];
  rule_items: { tone: string; comment: string | null }[];
}

function computeLines(
  charCount: number,
  genre: 'Shi' | 'Ci' | 'Free',
  segments?: SegmentLike[],
): number[][] {
  if (genre === 'Shi') {
    const sl = charCount % 7 === 0 ? 7 : 5;
    const cl = sl * 2;
    const lines: number[][] = [];
    for (let s = 0; s < charCount; s += cl) {
      const row: number[] = [];
      for (let c = 0; c < cl && s + c < charCount; c++) row.push(s + c);
      lines.push(row);
    }
    return lines;
  }
  if (segments?.length) {
    return segments.map(seg => {
      const row: number[] = [];
      for (let i = 0; i < seg.text_chars.length; i++) row.push(seg.start_index + i);
      return row;
    });
  }
  return [];
}

function getRuleItemAt(gi: number, v: ValidationResult | null) {
  if (!v?.display_segments) return null;
  for (const seg of v.display_segments) {
    const off = gi - seg.start_index;
    if (off >= 0 && off < seg.rule_items.length) return seg.rule_items[off];
  }
  return null;
}

function getPunctuationAt(
  gi: number,
  genre: 'Shi' | 'Ci' | 'Free',
  sentenceLen: number,
  rhymeSet: Set<number>,
  v: ValidationResult | null,
): string | undefined {
  if (genre === 'Shi') {
    const pos = gi % (sentenceLen * 2);
    const isEnd = pos === sentenceLen - 1 || pos === sentenceLen * 2 - 1;
    if (!isEnd) return undefined;
    return rhymeSet.has(gi) ? '。' : '，';
  }
  const item = getRuleItemAt(gi, v);
  if (!item) return undefined;
  if (rhymeSet.has(gi)) return '。';
  if (item.comment === '叶' || item.comment === '换叶') return '。';
  if (item.comment === '句') return '，';
  if (item.comment === '读') return '、';
  return undefined;
}

function buildRhymeColorMap(v: ValidationResult | null): Map<number, string> {
  const map = new Map<number, string>();
  if (!v) return map;
  const rawGroups = v.rhyme_groups ?? [];
  const relations = v.rhyme_relations ?? [];

  // 去重：多个 group 的 positions 集合若为子集关系，只保留最大的
  const groups = rawGroups
    .map(g => ({ ...g, posSet: new Set(g.positions) }))
    .filter((g, i, arr) => !arr.some((other, j) =>
      j !== i && other.posSet.size > g.posSet.size && g.positions.every(p => other.posSet.has(p))
    ));

  const groupOf = groups.map((_, i) => i);
  const find = (i: number): number => groupOf[i] === i ? i : (groupOf[i] = find(groupOf[i]));
  const union = (a: number, b: number) => { groupOf[find(a)] = find(b); };

  const posToGroup = new Map<number, number>();
  groups.forEach((g, gi) => { for (const p of g.positions) posToGroup.set(p, gi); });

  for (const rel of relations) {
    if (rel.relation === 'neighbor') {
      const ga = posToGroup.get(rel.pos1);
      // pos2 可能是数字或数组
      const pos2list = Array.isArray(rel.pos2) ? rel.pos2 : [rel.pos2];
      for (const p2 of pos2list) {
        const gb = posToGroup.get(p2);
        if (ga != null && gb != null) union(ga, gb);
      }
    }
  }

  const rootToColorIdx = new Map<number, number>();
  let colorCounter = 0;
  for (let i = 0; i < groups.length; i++) {
    const root = find(i);
    if (!rootToColorIdx.has(root)) rootToColorIdx.set(root, colorCounter++);
  }
  const totalGroups = rootToColorIdx.size;

  groups.forEach((g, groupIdx) => {
    const root = find(groupIdx);
    const cIdx = rootToColorIdx.get(root) ?? 0;
    for (const pos of g.positions) {
      const item = (() => {
        if (!v.display_segments) return null;
        for (const seg of v.display_segments) {
          const off = pos - seg.start_index;
          if (off >= 0 && off < seg.rule_items.length) return seg.rule_items[off];
        }
        return null;
      })();
      const tone = item?.tone ?? 'P';
      const palette = tone === 'Z' ? ZE_COLORS : PING_COLORS;
      const colorIdx = totalGroups > 1 ? cIdx % palette.length : 0;
      map.set(pos, palette[colorIdx]);
    }
  });

  for (const rel of relations) {
    if (rel.relation.startsWith('ye_')) {
      const pos2list = Array.isArray(rel.pos2) ? rel.pos2 : [rel.pos2];
      for (const p of pos2list) map.set(p, YE_COLOR);
    }
  }
  return map;
}

// ============================================================================
// Component
// ============================================================================

export function GridEditor() {
  const { state, dispatch } = useBoardContext();
  const board = useActiveBoard();
  const si = state.activeSectionIndex;
  const sec = board?.sections[si];

  const inputRef = useRef<HTMLInputElement>(null);
  const [cursor, setCursor] = useState(0);
  const [selectionEnd, setSelectionEnd] = useState<number | null>(null);
  const composingRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [cellSize, setCellSize] = useState(DEFAULT_CELL);
  const [confirmDeleteSection, setConfirmDeleteSection] = useState<number | null>(null);
  const [immersiveHint, setImmersiveHint] = useState<number | null>(null);
  const [inputFocused, setInputFocused] = useState(true);
  const hintTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const enterImmersive = useCallback((sectionIdx: number) => {
    dispatch({ type: 'TOGGLE_IMMERSIVE', sectionIndex: sectionIdx });
    track('toggle_immersive');
    setImmersiveHint(sectionIdx);
    clearTimeout(hintTimerRef.current);
    hintTimerRef.current = setTimeout(() => setImmersiveHint(null), 3000);
  }, [dispatch]);

  const exitImmersive = useCallback((sectionIdx: number) => {
    dispatch({ type: 'TOGGLE_IMMERSIVE', sectionIndex: sectionIdx });
    setImmersiveHint(null);
  }, [dispatch]);
  const pendingCursorRef = useRef<number | null>(null);
  const cursorRef = useRef(cursor);
  cursorRef.current = cursor;

  useValidation();

  // Reset cursor on board/section switch
  useEffect(() => {
    const target = pendingCursorRef.current;
    if (target != null) {
      setCursor(target);
      pendingCursorRef.current = null;
    } else {
      setCursor(0);
    }
    setSelectionEnd(null);
    requestAnimationFrame(() => {
      const gi = target ?? 0;
      const cell = containerRef.current?.querySelector(
        `[data-section="${si}"] [data-gi="${gi}"]`,
      ) as HTMLElement | null;
      cell?.scrollIntoView({ block: 'nearest' });
    });
  }, [state.activeBoardId, si]);

  // Register insert-char callback for active section
  useEffect(() => {
    if (!board || !sec) return;
    const sl = board.genre === 'Shi' ? (sec.charCount % 7 === 0 ? 7 : 5) : 0;

    const fn = (text: string, mode: 'forward' | 'backward' | 'pair' = 'forward') => {
      const cur = cursorRef.current;
      const chars = [...text].filter(c => /[\u4e00-\u9fff]/.test(c));
      if (chars.length === 0) return;

      if (mode === 'forward') {
        let pos = cur;
        for (const ch of chars) {
          if (pos >= sec.charCount) break;
          dispatch({ type: 'UPDATE_CHAR', index: pos, char: ch });
          pos++;
        }
        setCursor(Math.min(pos, sec.charCount - 1));
      } else if (mode === 'backward') {
        const endPos = cur;
        const startPos = endPos - chars.length + 1;
        for (let i = 0; i < chars.length; i++) {
          const pos = startPos + i;
          if (pos < 0 || pos >= sec.charCount) continue;
          dispatch({ type: 'UPDATE_CHAR', index: pos, char: chars[i] });
        }
        setCursor(Math.max(0, startPos));
      } else if (mode === 'pair' && sl > 0) {
        const coupletLen = sl * 2;
        const posInCouplet = cur % coupletLen;
        const targetStart = posInCouplet < sl ? cur + sl : cur - sl;
        let pos = targetStart;
        for (const ch of chars) {
          if (pos >= sec.charCount || pos < 0) break;
          dispatch({ type: 'UPDATE_CHAR', index: pos, char: ch });
          pos++;
        }
      }
    };
    dispatch({ type: 'SET_INSERT_FN', fn });
    return () => { dispatch({ type: 'SET_INSERT_FN', fn: null }); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [board?.id, sec?.charCount, board?.genre, si]);

  // --- Pre-compute values needed by hooks below ---
  const genre = board?.genre ?? 'Shi';
  const charCount = sec?.charCount ?? 0;
  const poemChars = sec?.poemChars ?? [];
  const sentenceLen = genre === 'Shi' && charCount > 0 ? (charCount % 7 === 0 ? 7 : 5) : 0;
  const fallbackSegments = genre === 'Ci'
    ? state.validations.find(v => v?.display_segments)?.display_segments
    : undefined;
  const activeValidation = state.validations[si] ?? null;
  const activeLines = computeLines(charCount, genre, activeValidation?.display_segments ?? fallbackSegments);

  // Cell size (adaptive to container width)
  useEffect(() => {
    const el = containerRef.current;
    if (!el || activeLines.length === 0) return;
    const measure = () => {
      const containerW = el.clientWidth - 8;
      let maxRowW = 0;
      for (const row of activeLines) {
        let rowW = row.length * DEFAULT_CELL;
        if (genre === 'Shi' && sentenceLen > 0) {
          rowW += Math.floor(row.length / sentenceLen) * PUNCT_WIDTH + SEP_WIDTH;
        } else {
          rowW += Math.ceil(row.length * 0.2) * PUNCT_WIDTH;
        }
        if (rowW > maxRowW) maxRowW = rowW;
      }
      setCellSize(maxRowW <= containerW ? DEFAULT_CELL : Math.max(18, Math.floor(DEFAULT_CELL * containerW / maxRowW)));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeLines.length, genre, sentenceLen]);

  // Selection range
  const selStart = selectionEnd != null ? Math.min(cursor, selectionEnd) : null;
  const selEnd = selectionEnd != null ? Math.max(cursor, selectionEnd) : null;
  const selectedIndices = new Set<number>();
  if (selStart != null && selEnd != null) {
    for (let i = selStart; i <= selEnd; i++) selectedIndices.add(i);
  }

  // Multi-select → pair query (Shi only)
  useEffect(() => {
    if (selStart == null || selEnd == null || genre !== 'Shi' || sentenceLen <= 0) return;
    const len = selEnd - selStart + 1;
    if (len < 1 || len > 4) return;
    if (Math.floor(selStart / sentenceLen) !== Math.floor(selEnd / sentenceLen)) return;
    const text = poemChars.slice(selStart, selEnd + 1).filter(c => c !== PLACEHOLDER).join('');
    if (text.length !== len) return;
    const coupletLen = sentenceLen * 2;
    const posInCouplet = selStart % coupletLen;
    const insertAt = posInCouplet < sentenceLen ? selStart + sentenceLen : selStart - sentenceLen;
    dispatch({ type: 'SET_PAIR_QUERY', payload: { text, insertAt } });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selStart, selEnd]);

  const focusInput = useCallback(() => { inputRef.current?.focus({ preventScroll: true }); }, []);

  // --- Early return ---
  if (!board || board.sections.length === 0) return null;

  const multiSection = board.sections.length > 1;
  const cellW = cellSize;
  const charBoxSize = cellSize - 2;
  const fontSize = Math.max(10, Math.round(charBoxSize * 0.68));
  const punctW = Math.round(PUNCT_WIDTH * (cellSize / DEFAULT_CELL));
  const sepW = Math.round(SEP_WIDTH * (cellSize / DEFAULT_CELL));
  const candidateSize = Math.max(16, cellSize - 6);

  // --- IME handlers ---
  const handleCompositionStart = () => { composingRef.current = true; };
  const handleCompositionEnd = () => { composingRef.current = false; flushInput(); };

  const flushInput = () => {
    const inp = inputRef.current;
    if (!inp) return;
    const val = inp.value;
    inp.value = '';
    if (!val) return;
    let cur = cursor;
    setSelectionEnd(null);
    for (const ch of val) {
      if (/[\u4e00-\u9fff]/.test(ch) && cur < charCount) {
        dispatch({ type: 'UPDATE_CHAR', index: cur, char: ch });
        cur = Math.min(cur + 1, charCount - 1);
      }
    }
    setCursor(cur);
  };

  const handleInput = () => { if (!composingRef.current) flushInput(); };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (composingRef.current) return;

    // Bulk delete (multi-select)
    if ((e.key === 'Backspace' || e.key === 'Delete') && selectionEnd != null) {
      e.preventDefault();
      const s = Math.min(cursor, selectionEnd);
      const ed = Math.max(cursor, selectionEnd);
      for (let i = s; i <= ed; i++) dispatch({ type: 'UPDATE_CHAR', index: i, char: PLACEHOLDER });
      setCursor(s);
      setSelectionEnd(null);
      dispatch({ type: 'SET_PAIR_QUERY', payload: null });
      return;
    }

    if (e.key === 'Backspace') {
      e.preventDefault();
      if (poemChars[cursor] !== PLACEHOLDER) {
        dispatch({ type: 'UPDATE_CHAR', index: cursor, char: PLACEHOLDER });
      } else if (cursor > 0) {
        dispatch({ type: 'UPDATE_CHAR', index: cursor - 1, char: PLACEHOLDER });
        setCursor(cursor - 1);
      }
    } else if (e.key === 'ArrowLeft') {
      if (cursor > 0) {
        setCursor(c => c - 1);
      } else if (si > 0) {
        pendingCursorRef.current = board.sections[si - 1].charCount - 1;
        dispatch({ type: 'SET_ACTIVE_SECTION', sectionIndex: si - 1 });
      }
      setSelectionEnd(null);
    } else if (e.key === 'ArrowRight') {
      if (cursor < charCount - 1) {
        setCursor(c => c + 1);
      } else if (si < board.sections.length - 1) {
        pendingCursorRef.current = 0;
        dispatch({ type: 'SET_ACTIVE_SECTION', sectionIndex: si + 1 });
      }
      setSelectionEnd(null);
    } else if (e.key === 'ArrowUp') {
      const sLines = activeLines;
      for (let li = 0; li < sLines.length; li++) {
        const ci = sLines[li].indexOf(cursor);
        if (ci !== -1) {
          if (li > 0) {
            setCursor(sLines[li - 1][Math.min(ci, sLines[li - 1].length - 1)]);
          } else if (si > 0) {
            const prevSec = board.sections[si - 1];
            const prevV = state.validations[si - 1] ?? null;
            const prevLines = computeLines(prevSec.charCount, genre, prevV?.display_segments ?? fallbackSegments);
            if (prevLines.length > 0) {
              const lastRow = prevLines[prevLines.length - 1];
              pendingCursorRef.current = lastRow[Math.min(ci, lastRow.length - 1)];
              dispatch({ type: 'SET_ACTIVE_SECTION', sectionIndex: si - 1 });
            }
          }
          break;
        }
      }
    } else if (e.key === 'ArrowDown') {
      const sLines = activeLines;
      for (let li = 0; li < sLines.length; li++) {
        const ci = sLines[li].indexOf(cursor);
        if (ci !== -1) {
          if (li < sLines.length - 1) {
            setCursor(sLines[li + 1][Math.min(ci, sLines[li + 1].length - 1)]);
          } else if (si < board.sections.length - 1) {
            const nextSec = board.sections[si + 1];
            const nextV = state.validations[si + 1] ?? null;
            const nextLines = computeLines(nextSec.charCount, genre, nextV?.display_segments ?? fallbackSegments);
            if (nextLines.length > 0) {
              pendingCursorRef.current = nextLines[0][Math.min(ci, nextLines[0].length - 1)];
              dispatch({ type: 'SET_ACTIVE_SECTION', sectionIndex: si + 1 });
            }
          }
          break;
        }
      }
    }
  };

  const handleTitleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const val = e.target.value.trim();
    if (val && val !== board.title) dispatch({ type: 'UPDATE_TITLE', title: val });
  };

  return (
    <div className="w-full relative" onClick={() => inputRef.current?.blur()} ref={containerRef}>
      {/* Board title */}
      <div className="flex flex-col items-center mb-4" onClick={e => e.stopPropagation()}>
        <input
          className="text-lg font-semibold text-center bg-transparent outline-none border-b border-dashed border-[var(--grid-empty-border)] focus:border-[var(--accent)] pb-1 w-full max-w-64 text-[var(--text)] placeholder:text-[var(--text-muted)] text-ellipsis overflow-hidden"
          defaultValue={board.title}
          key={board.id + '-title'}
          placeholder="点击输入标题..."
          onBlur={handleTitleBlur}
          onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
          onMouseDown={(e) => {
            const anyImmersive = board.sections.findIndex(s => s.immersive);
            if (anyImmersive >= 0 && !multiSection) {
              e.preventDefault();
              exitImmersive(anyImmersive);
            }
          }}
        />
        {!multiSection && (
          <div className="flex items-center justify-center mt-1.5 h-5">
            {board.sections[0]?.immersive ? (
              <span className="text-xs text-[var(--text-muted)] transition-opacity duration-500" style={{ opacity: immersiveHint === 0 ? 1 : 0 }}>
                点击标题退出沉浸模式
              </span>
            ) : (
              <>
                <span className="w-5 shrink-0" />
                <span className="text-xs text-[var(--text-muted)]">
                  {activeValidation?.closest_rule?.name ?? (genre === 'Shi' ? '诗' : '词')}
                </span>
                <button
                  className="w-5 h-5 rounded flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--accent)] hover:bg-[var(--accent-light)] transition-colors shrink-0 ml-0.5"
                  onClick={(e) => { e.stopPropagation(); enterImmersive(0); }}
                  title="沉浸模式"
                >
                  <Eye size={12} />
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Sections */}
      {board.sections.map((section, sectionIdx) => {
        const sV = state.validations[sectionIdx] ?? null;
        const sSegs = sV?.display_segments ?? fallbackSegments;
        const sLines = computeLines(section.charCount, genre, sSegs);
        const sSL = genre === 'Shi' ? (section.charCount % 7 === 0 ? 7 : 5) : 0;
        const sErrorSet = new Set((sV?.errors ?? []).map(e => e.position));
        const sRhymeSet = new Set(sV?.rhyme_positions ?? []);
        const sColorMap = buildRhymeColorMap(sV);
        const isActive = sectionIdx === si;
        const ciLoading = genre === 'Ci' && sLines.length === 0;
        const sRuleName = sV?.closest_rule?.name ?? '';

        return (
          <div key={section.id} className={`relative ${sectionIdx > 0 ? 'mt-5 pt-5 border-t border-dashed border-[var(--border)]' : ''}`}>
            {/* Section header (multi-section) */}
            {multiSection && (
              <div className={`flex items-center mb-3 px-1 ${section.immersive ? 'justify-center' : ''}`} onClick={e => e.stopPropagation()}>
                {!section.immersive && <div className="flex-1" />}
                <div className="flex items-center gap-1.5 relative">
                  <input
                    className={`text-sm text-center bg-transparent outline-none border-b border-dashed border-transparent focus:border-[var(--accent)] placeholder:text-[var(--text-muted)] w-24 transition-colors ${isActive ? 'text-[var(--accent)]' : 'text-[var(--text-secondary)]'}`}
                    defaultValue={section.title}
                    key={section.id + '-stitle'}
                    placeholder={`其${ORDINALS[sectionIdx] ?? sectionIdx + 1}`}
                    onBlur={(e) => dispatch({ type: 'UPDATE_SECTION_TITLE', sectionIndex: sectionIdx, title: e.target.value.trim() })}
                    onMouseDown={(e) => {
                      if (section.immersive) {
                        e.preventDefault();
                        exitImmersive(sectionIdx);
                      }
                    }}
                  />
                  {section.immersive ? (
                    <span className="absolute left-full ml-2 text-xs text-[var(--text-muted)] transition-opacity duration-500 whitespace-nowrap pointer-events-none" style={{ opacity: immersiveHint === sectionIdx ? 1 : 0 }}>
                      点击小标题退出沉浸模式
                    </span>
                  ) : (
                    sRuleName && <span className="text-xs text-[var(--text-muted)]">{sRuleName}</span>
                  )}
                </div>
                {!section.immersive && (
                <div className="flex-1 flex justify-end gap-0.5">
                      <button
                        className="w-5 h-5 rounded flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--accent)] disabled:opacity-0 transition-colors"
                        disabled={sectionIdx === 0}
                        onClick={(e) => { e.stopPropagation(); dispatch({ type: 'MOVE_SECTION', sectionIndex: sectionIdx, direction: 'up' }); }}
                        title="上移"
                      >
                        <ChevronUp size={12} />
                      </button>
                      <button
                        className="w-5 h-5 rounded flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--accent)] disabled:opacity-0 transition-colors"
                        disabled={sectionIdx === board.sections.length - 1}
                        onClick={(e) => { e.stopPropagation(); dispatch({ type: 'MOVE_SECTION', sectionIndex: sectionIdx, direction: 'down' }); }}
                        title="下移"
                      >
                        <ChevronDown size={12} />
                      </button>
                      <button
                        className="w-5 h-5 rounded flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--accent)] hover:bg-[var(--accent-light)] transition-colors"
                        onClick={(e) => { e.stopPropagation(); enterImmersive(sectionIdx); }}
                        title="沉浸模式"
                      >
                        <Eye size={12} />
                      </button>
                      <button
                        className="w-5 h-5 rounded flex items-center justify-center text-[var(--text-muted)] hover:text-rose-500 hover:bg-rose-50 transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          const hasContent = section.poemChars.some(c => c !== PLACEHOLDER);
                          if (hasContent) {
                            setConfirmDeleteSection(sectionIdx);
                          } else {
                            dispatch({ type: 'DELETE_SECTION', sectionIndex: sectionIdx });
                          }
                        }}
                        title="删除"
                      >
                        <X size={12} />
                      </button>
                </div>
                )}
              </div>
            )}

            {/* 删除确认遮罩 */}
            {confirmDeleteSection === sectionIdx && (
              <div className="absolute inset-0 rounded-lg backdrop-blur-sm flex items-center justify-center gap-3 z-20" style={{ backgroundColor: 'color-mix(in srgb, var(--bg-card) 70%, transparent)' }}>
                <button
                  className="px-3 py-1 text-xs rounded-md border border-[var(--grid-empty-border)] text-[var(--text-secondary)] hover:bg-[var(--accent-light)]"
                  onClick={() => setConfirmDeleteSection(null)}
                >
                  取消
                </button>
                <button
                  className="px-3 py-1 text-xs rounded-md bg-red-500 text-white hover:bg-red-600"
                  onClick={() => { dispatch({ type: 'DELETE_SECTION', sectionIndex: sectionIdx }); setConfirmDeleteSection(null); }}
                >
                  删除
                </button>
              </div>
            )}

            {/* Ci loading */}
            {ciLoading && (
              <div className="flex flex-col items-center py-8 gap-3">
                <div className="w-5 h-5 border-2 border-[var(--grid-empty-border)] border-t-[var(--accent)] rounded-full animate-spin" />
                <div className="text-xs text-[var(--text-muted)]">加载词谱...</div>
              </div>
            )}

            {/* Grid */}
            {!ciLoading && (
              <div data-section={sectionIdx} className="flex flex-col items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
                {sLines.map((row, li) => (
                  <div key={li} className="flex justify-center">
                    {row.map((gi, ci) => (
                      <GridCell
                        key={gi}
                        char={section.poemChars[gi] ?? PLACEHOLDER}
                        globalIndex={gi}
                        isCursor={isActive && gi === cursor && inputFocused}
                        isSelected={isActive && selectedIndices.has(gi)}
                        isError={sErrorSet.has(gi)}
                        isRhyme={sRhymeSet.has(gi)}
                        rhymeColor={sColorMap.get(gi)}
                        ruleItem={getRuleItemAt(gi, sV)}
                        hasSepAfter={genre === 'Shi' && sSL > 0 && (ci + 1) === sSL}
                        sepWidth={sepW}
                        punctuation={getPunctuationAt(gi, genre, sSL, sRhymeSet, sV)}
                        cellW={cellW}
                        charBoxSize={charBoxSize}
                        fontSize={fontSize}
                        punctW={punctW}
                        candidateSize={candidateSize}
                        candidates={section.candidatesMap[gi]}
                        immersive={section.immersive}
                        onClickCell={(e) => {
                          if (e.shiftKey && genre === 'Shi' && sSL > 0 && isActive) {
                            setSelectionEnd(gi);
                          } else {
                            if (!isActive) {
                              pendingCursorRef.current = gi;
                              dispatch({ type: 'SET_ACTIVE_SECTION', sectionIndex: sectionIdx });
                            } else {
                              setCursor(gi);
                            }
                            setSelectionEnd(null);
                            dispatch({ type: 'SET_PAIR_QUERY', payload: null });
                            focusInput();
                            const ch = section.poemChars[gi];
                            if (ch && ch !== PLACEHOLDER) {
                              dispatch({ type: 'SET_DICT_QUERY', query: ch, cursor: gi });
                            }
                          }
                        }}
                        onClickCandidate={ch => {
                          if (!isActive) dispatch({ type: 'SET_ACTIVE_SECTION', sectionIndex: sectionIdx });
                          dispatch({ type: 'REPLACE_WITH_CANDIDATE', index: gi, char: ch });
                          focusInput();
                        }}
                        onAddCandidate={() => {
                          const ch = section.poemChars[gi];
                          if (ch && ch !== PLACEHOLDER) {
                            if (!isActive) dispatch({ type: 'SET_ACTIVE_SECTION', sectionIndex: sectionIdx });
                            dispatch({ type: 'ADD_CANDIDATE', index: gi, char: ch });
                          }
                          focusInput();
                        }}
                        onRemoveCandidate={ch => {
                          if (!isActive) dispatch({ type: 'SET_ACTIVE_SECTION', sectionIndex: sectionIdx });
                          dispatch({ type: 'REMOVE_CANDIDATE', index: gi, char: ch });
                          focusInput();
                        }}
                      />
                    ))}
                  </div>
                ))}
              </div>
            )}

            {/* Errors & warnings */}
            {!section.immersive && sV && sV.errors.length > 0 && (
              <div className="mt-2 text-xs space-y-0.5">
                {sV.errors.filter(e => e.position >= 0).slice(0, 5).map((e, i) => (
                  <div key={i} className="text-rose-500">
                    第{e.position + 1}字「{e.character}」{e.message}
                  </div>
                ))}
              </div>
            )}
            {!section.immersive && sV?.warnings && sV.warnings.length > 0 && (
              <div className={`${sV.errors.length > 0 ? 'mt-1' : 'mt-2'} text-xs space-y-0.5`}>
                {sV.warnings.map((w, i) => (
                  <div key={i} className="text-amber-500">{w.message}</div>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {/* Add section */}
      {!board.sections.some(s => s.immersive) && (
      <div className="flex justify-center mt-6">
        <button
          className="text-xs text-[var(--text-muted)] hover:text-[var(--accent)] border border-dashed border-[var(--border)] hover:border-[var(--accent)] rounded-lg px-4 py-1.5 transition-colors"
          onClick={(e) => { e.stopPropagation(); dispatch({ type: 'ADD_SECTION' }); }}
        >
          ＋ 添加一首
        </button>
      </div>
      )}

      {/* Hidden input for IME */}
      <input
        ref={inputRef}
        className="absolute opacity-0 pointer-events-none w-0 h-0"
        style={(() => {
          const cell = containerRef.current?.querySelector(
            `[data-section="${si}"] [data-gi="${cursor}"]`,
          ) as HTMLElement | null;
          if (cell) {
            const cr = cell.getBoundingClientRect();
            const pr = containerRef.current!.getBoundingClientRect();
            return { left: cr.left - pr.left, top: cr.bottom - pr.top, fontSize };
          }
          return { left: 0, top: 0 };
        })()}
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        onCompositionStart={handleCompositionStart}
        onCompositionEnd={handleCompositionEnd}
        onFocus={() => setInputFocused(true)}
        onBlur={() => setInputFocused(false)}
        autoFocus
      />
    </div>
  );
}
