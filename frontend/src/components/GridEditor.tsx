import { useState, useRef, useCallback, useEffect } from 'react';
import { useBoardContext, useActiveBoard } from '../context/BoardContext';
import { track } from '../lib/api';
import { useValidation } from '../hooks/useValidation';
import { GridCell } from './GridCell';
import { PLACEHOLDER } from '../lib/types';
import { Solar } from 'lunar-javascript';
import { lunarToGregorian } from '../lib/dateConvert';
import type { ValidationResult } from '../lib/types';
import { X, ChevronUp, ChevronDown, Eye, EyeOff, ScrollText, Info } from 'lucide-react';

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_CELL = 30;
const STANDARD_PUNCTS = ['，', '。', '、', '；', '：', '？', '！'];  // ，。、；：？！
const AUX_MARKS = ['「', '」', '《', '》', '“', '”', '‘', '’'];  // 「」《》“”‘’
const OPENING_AUX = new Set(['「', '《', '“', '‘']);  // 开方向 → 字前
const CLOSING_AUX = new Set(['」', '》', '”', '’']);  // 关方向 → 字后
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
  overrides?: Record<number, string>,
): string | undefined {
  if (overrides && gi in overrides) {
    const val = overrides[gi];
    return val === '' ? undefined : val;
  }
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


// ---- Section Date Input (matches MetadataPopover UX) ----

function SectionDateInput({ section, sectionIdx, board, dateFormat, dispatch }: {
  section: { id: string; sectionDate?: string; sectionDateHidden?: boolean };
  sectionIdx: number;
  board: { createdAt: number; updatedAt: number };
  dateFormat: 'Gregorian' | 'Lunar';
  dispatch: (action: any) => void;
}) {
  const [formatOpen, setFormatOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const todayUTC8 = new Date(Date.now() + 8 * 3600_000);
  const todayStr = todayUTC8.toISOString().slice(0, 10);
  const todayLunar = (() => {
    try {
      const [y, m, d] = todayStr.split('-').map(Number);
      const lunar = Solar.fromYmd(y, m, d).getLunar();
      return `${lunar.getYearInGanZhi()}年${lunar.getMonthInChinese()}月${lunar.getDayInChinese()}`;
    } catch { return ''; }
  })();
  const placeholder = dateFormat === 'Gregorian' ? todayStr : todayLunar;

  const convertDate = (value: string, from: string, to: string): string => {
    if (!value.trim()) return value;
    try {
      if (to === 'Lunar' && from === 'Gregorian') {
        const match = value.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
        if (!match) return value;
        const solar = Solar.fromYmd(parseInt(match[1]), parseInt(match[2]), parseInt(match[3]));
        const lunar = solar.getLunar();
        return `${lunar.getYearInGanZhi()}年${lunar.getMonthInChinese()}月${lunar.getDayInChinese()}`;
      } else if (to === 'Gregorian' && from === 'Lunar') {
        return lunarToGregorian(value);
      }
    } catch {}
    return value;
  };

  return (
    <div>
      <div className="flex items-center gap-1.5 mb-0.5">
        <label className="text-[10px] text-[var(--text-secondary)]">日期</label>
        {!section.sectionDate && (
        <button
          className="text-[9px] text-[var(--text-muted)] hover:text-[var(--accent)] border border-[var(--border)] hover:border-[var(--accent)] rounded-full px-1.5 py-px transition-colors"
          onClick={() => {
            const val = dateFormat === 'Gregorian' ? todayStr : todayLunar;
            dispatch({ type: 'UPDATE_SECTION_META', sectionIndex: sectionIdx, field: 'sectionDate', value: val });
          }}
        >今天</button>
        )}
        <div className="relative">
          <button
            className="w-3.5 h-3.5 rounded-full flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors"
            onClick={() => setInfoOpen(v => !v)}
          >
            <Info size={10} />
          </button>
          {infoOpen && (
            <>
            <div className="fixed inset-0 z-[9]" onClick={() => setInfoOpen(false)} />
            <div className="absolute left-0 bottom-full mb-1 z-10 bg-[var(--bg-card)] border border-[var(--border)] rounded-lg shadow-lg p-2 text-[10px] text-[var(--text-muted)] whitespace-nowrap">
              <div>创建：{new Date(board.createdAt).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' })}</div>
              <div>修改：{new Date(board.updatedAt).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' })}</div>
            </div>
            </>
          )}
        </div>
      </div>
      <div className="flex gap-1.5">
        <input
          type="text"
          defaultValue={section.sectionDate || ''}
          key={`${section.id}-sdate-${section.sectionDate || ''}-${dateFormat}`}
          onBlur={e => dispatch({ type: 'UPDATE_SECTION_META', sectionIndex: sectionIdx, field: 'sectionDate', value: e.target.value.trim() })}
          onKeyDown={e => {
            if (e.key === 'Tab' && !section.sectionDate) {
              e.preventDefault();
              dispatch({ type: 'UPDATE_SECTION_META', sectionIndex: sectionIdx, field: 'sectionDate', value: placeholder });
            }
          }}
          placeholder={placeholder}
          className="flex-1 px-2 py-1 text-xs border border-[var(--border)] rounded bg-[var(--bg-input)] focus:outline-none focus:border-[var(--accent)]"
        />
        <div className="relative">
          <button
            className="flex items-center gap-0.5 px-1.5 py-1 text-[10px] border border-[var(--border)] rounded bg-[var(--bg-input)] hover:border-[var(--accent)] transition-colors"
            onClick={() => setFormatOpen(v => !v)}
          >
            <span>{dateFormat === 'Gregorian' ? '公历' : '农历'}</span>
            <ChevronDown size={8} className={`text-[var(--text-muted)] transition-transform ${formatOpen ? 'rotate-180' : ''}`} />
          </button>
          {formatOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setFormatOpen(false)} />
              <div className="absolute right-0 bottom-full mb-1 z-50 border border-[var(--border)] rounded-lg overflow-hidden shadow-lg" style={{ backgroundColor: 'var(--bg-card)' }}>
                {(['Gregorian', 'Lunar'] as const).map(fmt => (
                  <button
                    key={fmt}
                    className={`w-full text-left px-3 py-1 text-xs whitespace-nowrap hover:bg-[var(--accent-light)] transition-colors ${fmt === dateFormat ? 'bg-[var(--accent-light)] text-[var(--accent)]' : ''}`}
                    onClick={() => {
                      if (fmt !== dateFormat && section.sectionDate) {
                        const converted = convertDate(section.sectionDate, dateFormat, fmt);
                        if (converted !== section.sectionDate) {
                          dispatch({ type: 'UPDATE_SECTION_META', sectionIndex: sectionIdx, field: 'sectionDate', value: converted });
                        }
                      }
                      dispatch({ type: 'UPDATE_METADATA', metadata: { dateFormat: fmt } });
                      setFormatOpen(false);
                    }}
                  >
                    {fmt === 'Gregorian' ? '公历' : '农历'}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
      {section.sectionDate && (
        <button
          className="flex items-center gap-1 mt-1 text-[10px] text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors"
          onClick={() => dispatch({ type: 'UPDATE_SECTION_META', sectionIndex: sectionIdx, field: 'sectionDateHidden', value: !section.sectionDateHidden })}
        >
          {section.sectionDateHidden ? <EyeOff size={10} /> : <Eye size={10} />}
          <span>{section.sectionDateHidden ? '导出时隐藏' : '导出时显示'}</span>
        </button>
      )}
    </div>
  );
}

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
  const [punctPickerAt, setPunctPickerAt] = useState<number | null>(null);
  const [auxPickerAt, setAuxPickerAt] = useState<number | null>(null);
  const [confirmClearPunct, setConfirmClearPunct] = useState<number | null>(null);
  const auxTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [sectionMetaOpen, setSectionMetaOpen] = useState<number | null>(null);
  const [gridWidth, setGridWidth] = useState<number>(0);

  // Measure grid width for metadata area alignment (max child row width)
  useEffect(() => {
    if (sectionMetaOpen == null) return;
    const el = containerRef.current?.querySelector(`[data-section="${sectionMetaOpen}"]`) as HTMLElement | null;
    if (!el) return;
    let maxW = 0;
    for (const child of el.children) {
      maxW = Math.max(maxW, (child as HTMLElement).offsetWidth);
    }
    if (maxW > 0) setGridWidth(maxW);
  }, [sectionMetaOpen, si]);

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

  const pickerRef = useRef<HTMLDivElement>(null);
  const blurTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const closePickers = useCallback(() => { setPunctPickerAt(null); setAuxPickerAt(null); setConfirmClearPunct(null); }, []);

  // Close pickers on outside mousedown (instant, no delay)
  useEffect(() => {
    if (punctPickerAt == null && auxPickerAt == null) return;
    const handler = (e: MouseEvent) => {
      if (pickerRef.current?.contains(e.target as Node)) return;
      closePickers();
    };
    document.addEventListener('mousedown', handler, true);
    return () => document.removeEventListener('mousedown', handler, true);
  }, [punctPickerAt, auxPickerAt, closePickers]);

  // Desktop: auto-close on blur 0.5s (aux picker only, not punct picker)
  const startBlurTimer = useCallback(() => {
    if (punctPickerAt != null) return;
    clearTimeout(blurTimerRef.current);
    blurTimerRef.current = setTimeout(closePickers, 500);
  }, [closePickers, punctPickerAt]);
  const cancelBlurTimer = useCallback(() => { clearTimeout(blurTimerRef.current); }, []);

  // Compute popup position relative to the section's positioned ancestor
  const getPickerPos = useCallback((gi: number) => {
    const sectionEl = containerRef.current?.querySelector(`[data-section="${si}"]`) as HTMLElement | null;
    const el = sectionEl?.querySelector(`[data-charbox="${gi}"]`) as HTMLElement | null;
    if (!el) return { top: 0, left: 0, arrowOffset: 0 };
    const wrap = el.closest('[data-section-wrap]') as HTMLElement | null;
    if (!wrap) return { top: 0, left: 0, arrowOffset: 0 };
    const elRect = el.getBoundingClientRect();
    const wRect = wrap.getBoundingClientRect();
    const targetX = elRect.left - wRect.left + elRect.width / 2;
    const wrapW = wrap.offsetWidth;
    const popupHalf = 110;
    const pad = 8;
    const clampedX = Math.max(popupHalf + pad, Math.min(wrapW - popupHalf - pad, targetX));
    return {
      top: elRect.bottom - wRect.top + 4,
      left: clampedX,
      arrowOffset: targetX - clampedX,
    };
  }, [si]);

  // Position for punct picker: arrow points at the punctuation mark (right of char + aux closing marks)
  const getPunctPickerPos = useCallback((gi: number) => {
    const sectionEl = containerRef.current?.querySelector(`[data-section="${si}"]`) as HTMLElement | null;
    const cellEl = sectionEl?.querySelector(`[data-gi="${gi}"]`) as HTMLElement | null;
    const charEl = sectionEl?.querySelector(`[data-charbox="${gi}"]`) as HTMLElement | null;
    if (!cellEl || !charEl) return { top: 0, left: 0, arrowOffset: 0 };
    const wrap = cellEl.closest('[data-section-wrap]') as HTMLElement | null;
    if (!wrap) return { top: 0, left: 0, arrowOffset: 0 };
    const cellRect = cellEl.getBoundingClientRect();
    const charRect = charEl.getBoundingClientRect();
    const wRect = wrap.getBoundingClientRect();
    const targetX = cellRect.right - wRect.left - (cellRect.right - charRect.right) / 2;
    const wrapW = wrap.offsetWidth;
    const popupHalf = 110;
    const pad = 8;
    const clampedX = Math.max(popupHalf + pad, Math.min(wrapW - popupHalf - pad, targetX));
    return {
      top: charRect.bottom - wRect.top + 4,
      left: clampedX,
      arrowOffset: targetX - clampedX,
    };
  }, [si]);

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
    let lastCharIdx = -1;
    setSelectionEnd(null);
    for (const ch of val) {
      if (/[\u4e00-\u9fff\u3400-\u4dbf]/.test(ch) && cur < charCount) {
        dispatch({ type: 'UPDATE_CHAR', index: cur, char: ch });
        lastCharIdx = cur;
        cur = Math.min(cur + 1, charCount - 1);
      } else if (/[，。、；：？！]/.test(ch) && lastCharIdx >= 0) {
        dispatch({ type: 'SET_PUNCT_OVERRIDE', index: lastCharIdx, punct: ch });
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
          <div key={section.id} data-section-wrap className={`relative ${sectionIdx > 0 ? 'mt-5 pt-5 border-t border-dashed border-[var(--border)]' : ''}`}
            onPointerDownCapture={(e) => {
              if ((e.target as HTMLElement).closest('[data-move-btn]')) return;
              if (!isActive) dispatch({ type: 'SET_ACTIVE_SECTION', sectionIndex: sectionIdx });
            }}>
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
                        onClick={(e) => { e.stopPropagation(); dispatch({ type: 'MOVE_SECTION', sectionIndex: sectionIdx, direction: 'up' }); track('move_section', { direction: 'up' }); }}
                        title="上移"
                        data-move-btn
                      >
                        <ChevronUp size={12} />
                      </button>
                      <button
                        className="w-5 h-5 rounded flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--accent)] disabled:opacity-0 transition-colors"
                        disabled={sectionIdx === board.sections.length - 1}
                        onClick={(e) => { e.stopPropagation(); dispatch({ type: 'MOVE_SECTION', sectionIndex: sectionIdx, direction: 'down' }); track('move_section', { direction: 'down' }); }}
                        title="下移"
                        data-move-btn
                      >
                        <ChevronDown size={12} />
                      </button>
                      <button
                        className={`w-5 h-5 rounded flex items-center justify-center transition-colors ${sectionMetaOpen === sectionIdx ? 'text-[var(--accent)] bg-[var(--accent-light)]' : 'text-[var(--text-muted)] hover:text-[var(--accent)] hover:bg-[var(--accent-light)]'}`}
                        onClick={(e) => { e.stopPropagation(); setSectionMetaOpen(sectionMetaOpen === sectionIdx ? null : sectionIdx); }}
                        title="本首注释"
                      >
                        <ScrollText size={12} />
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
                            dispatch({ type: 'DELETE_SECTION', sectionIndex: sectionIdx }); track('delete_section');
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
                  onClick={() => { dispatch({ type: 'DELETE_SECTION', sectionIndex: sectionIdx }); track('delete_section'); setConfirmDeleteSection(null); }}
                >
                  删除
                </button>
              </div>
            )}

            {/* Per-section 编号 + 序（正文上方） */}
            {multiSection && sectionMetaOpen === sectionIdx && !section.immersive && (
              <div className="mb-2 mx-auto max-h-32 overflow-y-auto space-y-2" style={gridWidth ? { width: gridWidth } : undefined} onClick={e => e.stopPropagation()}>
                {localStorage.getItem('fangcun_legacy_id') === '1' && (
                <div>
                  <label className="text-[10px] text-[var(--text-secondary)] mb-0.5 block">编号</label>
                  <input
                    type="text"
                    defaultValue={section.sectionLegacyId || ''}
                    key={`${section.id}-slegacy`}
                    onBlur={e => dispatch({ type: 'UPDATE_SECTION_META', sectionIndex: sectionIdx, field: 'sectionLegacyId', value: e.target.value.trim() })}
                    placeholder="本首编号"
                    className="w-full px-2 py-1 text-xs border border-[var(--border)] rounded bg-[var(--bg-input)] focus:outline-none focus:border-[var(--accent)]"
                  />
                </div>
                )}
                <div>
                  <label className="text-[10px] text-[var(--text-secondary)] mb-0.5 block">序</label>
                  <textarea
                    defaultValue={section.sectionPreface || ''}
                    key={`${section.id}-spreface`}
                    onBlur={e => dispatch({ type: 'UPDATE_SECTION_META', sectionIndex: sectionIdx, field: 'sectionPreface', value: e.target.value.trim() })}
                    placeholder="本首序言"
                    rows={2}
                    className="w-full px-2 py-1 text-xs border border-[var(--border)] rounded bg-[var(--bg-input)] focus:outline-none focus:border-[var(--accent)] resize-none"
                  />
                </div>
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
                    {row.map((gi, ci) => {
                      return (
                      <div key={gi}
                        onMouseLeave={() => { clearTimeout(auxTimerRef.current); startBlurTimer(); }}
                      >
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
                        punctuation={getPunctuationAt(gi, genre, sSL, sRhymeSet, sV, section.punctOverrides)}
                        hasPunctSlot={!!getPunctuationAt(gi, genre, sSL, sRhymeSet, sV)}
                        auxBefore={(() => { const m = section.auxMarks?.[gi]; if (!m) return undefined; const b = m.filter(c => OPENING_AUX.has(c)); return b.length ? b : undefined; })()}
                        auxAfter={(() => { const m = section.auxMarks?.[gi]; if (!m) return undefined; const a = m.filter(c => CLOSING_AUX.has(c)); return a.length ? a : undefined; })()}
                        cellW={cellW}
                        charBoxSize={charBoxSize}
                        fontSize={fontSize}
                        punctW={punctW}
                        candidateSize={candidateSize}
                        candidates={section.candidatesMap[gi]}
                        immersive={section.immersive}
                        onCharHover={() => {
                          cancelBlurTimer();
                          if (section.immersive || punctPickerAt != null) return;
                          clearTimeout(auxTimerRef.current);
                          auxTimerRef.current = setTimeout(() => setAuxPickerAt(gi), 1000);
                        }}
                        onCharHoverEnd={() => clearTimeout(auxTimerRef.current)}
                        onCharTouchStart={() => {
                          if (section.immersive || punctPickerAt != null) return;
                          clearTimeout(auxTimerRef.current);
                          auxTimerRef.current = setTimeout(() => setAuxPickerAt(gi), 800);
                        }}
                        onCharTouchEnd={() => clearTimeout(auxTimerRef.current)}
                        onPunctClick={(idx) => {
                          setPunctPickerAt(punctPickerAt === idx ? null : idx);
                          setAuxPickerAt(null);
                          setConfirmClearPunct(null);
                        }}
                        onClickCell={(e) => {
                          clearTimeout(auxTimerRef.current);
                          if (auxPickerAt != null && auxPickerAt !== gi) {
                            setAuxPickerAt(gi); setPunctPickerAt(null); setConfirmClearPunct(null);
                          } else if (punctPickerAt != null) {
                            setPunctPickerAt(null); setConfirmClearPunct(null);
                          }
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
                      </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}

            {/* 常规标点选择器 (popup) */}
            {punctPickerAt != null && isActive && (() => {
              const pos = getPunctPickerPos(punctPickerAt);
              return (
              <div ref={pickerRef} className="absolute z-30 flex flex-col items-center gap-1 p-2 border border-[var(--border)] rounded-lg bg-[var(--bg-card)] shadow-lg -translate-x-1/2"
                style={{ top: pos.top, left: pos.left }}
                onClick={e => e.stopPropagation()}>
                <div className="absolute -top-[12px] border-[6px] border-transparent border-b-[var(--border)]" style={{ left: `calc(50% + ${pos.arrowOffset}px)`, transform: 'translateX(-50%)' }} />
                <div className="absolute -top-[10px] border-[6px] border-transparent border-b-[var(--bg-card)] z-10" style={{ left: `calc(50% + ${pos.arrowOffset}px)`, transform: 'translateX(-50%)' }} />
                {confirmClearPunct != null ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-[var(--text-secondary)]">确认清除？</span>
                    <button className="px-2 py-0.5 text-xs rounded border border-[var(--grid-empty-border)] text-[var(--text-secondary)] hover:bg-[var(--accent-light)]"
                      onClick={() => setConfirmClearPunct(null)}>取消</button>
                    <button className="px-2 py-0.5 text-xs rounded bg-red-500 text-white hover:bg-red-600"
                      onClick={() => { dispatch({ type: 'SET_PUNCT_OVERRIDE', index: confirmClearPunct, punct: '' }); setConfirmClearPunct(null); setPunctPickerAt(null); }}>确认</button>
                  </div>
                ) : (
                  <>
                    <div className="flex gap-1">
                      {STANDARD_PUNCTS.map(p => (
                        <button key={p} className="w-7 h-7 rounded flex items-center justify-center text-sm hover:bg-[var(--accent-light)] hover:text-[var(--accent)] transition-colors"
                          onClick={() => { dispatch({ type: 'SET_PUNCT_OVERRIDE', index: punctPickerAt, punct: p }); setPunctPickerAt(null); }}>{p}</button>
                      ))}
                    </div>
                    <div className="flex gap-1">
                      <button className="px-2 py-0.5 text-xs rounded text-[var(--text-muted)] hover:text-[var(--accent)] hover:bg-[var(--accent-light)] transition-colors"
                        onClick={() => { dispatch({ type: 'SET_PUNCT_OVERRIDE', index: punctPickerAt, punct: null }); setPunctPickerAt(null); }}>恢复默认</button>
                      <button className="px-2 py-0.5 text-xs rounded text-[var(--text-muted)] hover:text-red-500 hover:bg-red-50 transition-colors"
                        onClick={() => setConfirmClearPunct(punctPickerAt)}>清除</button>
                    </div>
                  </>
                )}
              </div>
              );
            })()}

            {/* 辅助标点选择器 (popup) */}
            {auxPickerAt != null && isActive && (() => {
              const pos = getPickerPos(auxPickerAt);
              return (
              <div ref={pickerRef} className="absolute z-30 flex flex-col items-center gap-1 p-2 border border-[var(--border)] rounded-lg bg-[var(--bg-card)] shadow-lg -translate-x-1/2"
                style={{ top: pos.top, left: pos.left }}
                onClick={e => e.stopPropagation()}
                onMouseEnter={cancelBlurTimer} onMouseLeave={startBlurTimer}>
                <div className="absolute -top-[12px] border-[6px] border-transparent border-b-[var(--border)]" style={{ left: `calc(50% + ${pos.arrowOffset}px)`, transform: 'translateX(-50%)' }} />
                <div className="absolute -top-[10px] border-[6px] border-transparent border-b-[var(--bg-card)] z-10" style={{ left: `calc(50% + ${pos.arrowOffset}px)`, transform: 'translateX(-50%)' }} />
                <div className="flex gap-1">
                  {AUX_MARKS.map(m => {
                    const active = section.auxMarks?.[auxPickerAt]?.includes(m);
                    return (
                      <button key={m}
                        className={`w-7 h-7 rounded flex items-center justify-center text-sm transition-colors ${active ? 'bg-[var(--accent)] text-white' : 'hover:bg-[var(--accent-light)] hover:text-[var(--accent)]'}`}
                        onClick={() => dispatch({ type: 'TOGGLE_AUX_MARK', index: auxPickerAt, mark: m })}>{m}</button>
                    );
                  })}
                </div>
              </div>
              );
            })()}


            {/* Per-section 脚注 + 日期（正文下方） */}
            {multiSection && sectionMetaOpen === sectionIdx && !section.immersive && (
              <div className="mt-2 mx-auto space-y-2 max-h-40 overflow-y-auto" style={gridWidth ? { width: gridWidth } : undefined} onClick={e => e.stopPropagation()}>
                <div>
                  <label className="text-[10px] text-[var(--text-secondary)] mb-0.5 block">脚注</label>
                  <textarea
                    defaultValue={section.sectionFootnote || ''}
                    key={`${section.id}-sfootnote`}
                    onBlur={e => dispatch({ type: 'UPDATE_SECTION_META', sectionIndex: sectionIdx, field: 'sectionFootnote', value: e.target.value.trim() })}
                    placeholder="本首脚注"
                    rows={2}
                    className="w-full px-2 py-1 text-xs border border-[var(--border)] rounded bg-[var(--bg-input)] focus:outline-none focus:border-[var(--accent)] resize-none"
                  />
                </div>
                <SectionDateInput
                  section={section}
                  sectionIdx={sectionIdx}
                  board={board}
                  dateFormat={board.metadata?.dateFormat || 'Gregorian'}
                  dispatch={dispatch}
                />
              </div>
            )}

            {/* Errors & warnings */}
            {!section.immersive && sV && sV.errors.length > 0 && (
              <div className="mt-2 text-xs space-y-0.5">
                {sV.errors.filter(e => e.position >= 0).slice(0, 5).map((e, i) => (
                  <div key={i} className="text-rose-500">
                    第{e.position + 1}字「{e.character}」{e.message}{e.error_type === 'Rhyme' && e.expected ? `，应押「${e.expected}」韵` : ''}
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
          onClick={(e) => { e.stopPropagation(); dispatch({ type: 'ADD_SECTION' }); track('add_section'); }}
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
