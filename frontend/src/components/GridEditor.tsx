import { useState, useRef, useCallback, useEffect } from 'react';
import { useBoardContext, useActiveBoard } from '../context/BoardContext';
import { useValidation } from '../hooks/useValidation';
import { GridCell } from './GridCell';
import { PLACEHOLDER } from '../lib/types';

// 默认桌面端尺寸
const DEFAULT_CELL = 30;
const PUNCT_WIDTH = 14;
const SEP_WIDTH = 12;

export function GridEditor() {
  const { state, dispatch } = useBoardContext();
  const board = useActiveBoard();
  const validation = state.validation;
  const inputRef = useRef<HTMLInputElement>(null);
  const [cursor, setCursor] = useState(0);
  const [selectionEnd, setSelectionEnd] = useState<number | null>(null); // shift-click 多选终点
  const composingRef = useRef(false); // IME 组合状态标记
  const containerRef = useRef<HTMLDivElement>(null);
  const [cellSize, setCellSize] = useState(DEFAULT_CELL);

  // 格律检测 hook
  useValidation();

  // 重置光标和多选当画板切换时
  useEffect(() => { setCursor(0); setSelectionEnd(null); }, [state.activeBoardId]);

  // 通过 ref 保持 cursor 最新值，供回调使用
  const cursorRef = useRef(cursor);
  cursorRef.current = cursor;

  // 注册插入回调到 context
  // mode: 'forward' = 从光标向后填（词首/默认）
  //        'backward' = 以光标为末字向前填（词末）
  //        'pair' = 填入对仗位置（诗：上下句对应位置）
  useEffect(() => {
    if (!board) return;
    const sl = board.genre === 'Shi' ? (board.charCount % 7 === 0 ? 7 : 5) : 0; // sentenceLen

    const fn = (text: string, mode: 'forward' | 'backward' | 'pair' = 'forward') => {
      const cur = cursorRef.current;
      const chars = [...text].filter(c => /[\u4e00-\u9fff]/.test(c));
      if (chars.length === 0) return;

      if (mode === 'forward') {
        // 从光标向后填，超出上限则截断
        let pos = cur;
        for (const ch of chars) {
          if (pos >= board.charCount) break;
          dispatch({ type: 'UPDATE_CHAR', index: pos, char: ch });
          pos++;
        }
        setCursor(Math.min(pos, board.charCount - 1));

      } else if (mode === 'backward') {
        // 以光标为末字，向前填
        const endPos = cur;
        const startPos = endPos - chars.length + 1;
        for (let i = 0; i < chars.length; i++) {
          const pos = startPos + i;
          if (pos < 0 || pos >= board.charCount) continue;
          dispatch({ type: 'UPDATE_CHAR', index: pos, char: chars[i] });
        }
        setCursor(Math.max(0, startPos));

      } else if (mode === 'pair' && sl > 0) {
        // 对语：计算对仗位置
        // 当前光标在联内的位置
        const coupletLen = sl * 2;
        const posInCouplet = cur % coupletLen;
        let targetStart: number;
        if (posInCouplet < sl) {
          // 光标在上句 → 对仗位填到下句同位置
          targetStart = cur + sl;
        } else {
          // 光标在下句 → 对仗位填到上句同位置
          targetStart = cur - sl;
        }
        let pos = targetStart;
        for (const ch of chars) {
          if (pos >= board.charCount || pos < 0) break;
          dispatch({ type: 'UPDATE_CHAR', index: pos, char: ch });
          pos++;
        }
      }
    };

    dispatch({ type: 'SET_INSERT_FN', fn });
    return () => { dispatch({ type: 'SET_INSERT_FN', fn: null }); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [board?.id, board?.charCount, board?.genre]);

  const focusInput = useCallback(() => {
    inputRef.current?.focus();
  }, []);

  if (!board) return null;

  const { poemChars, charCount, genre } = board;

  // --- 计算行结构 ---
  // 诗: 每联（两句）为一行，句间加分隔
  // 词: 从 validation.display_segments 驱动, 若无则单行
  const sentenceLen = genre === 'Shi' ? (charCount % 7 === 0 ? 7 : 5) : 0;

  let lines: number[][] = []; // 每行包含的 globalIndex 数组

  if (genre === 'Shi') {
    // 每联 = 2句, 每行放一联
    const coupletLen = sentenceLen * 2;
    const couplets = charCount / coupletLen;
    for (let r = 0; r < couplets; r++) {
      const row: number[] = [];
      for (let c = 0; c < coupletLen; c++) row.push(r * coupletLen + c);
      lines.push(row);
    }
  } else {
    // 词: 使用 display_segments
    if (validation?.display_segments?.length) {
      for (const seg of validation.display_segments) {
        const row: number[] = [];
        for (let i = 0; i < seg.text_chars.length; i++) {
          row.push(seg.start_index + i);
        }
        lines.push(row);
      }
    }
    // 词且无 segments 时不 fallback 到单行，显示 loading
  }

  // --- 自适应单元格大小 ---
  // 计算最长行需要的总宽度，然后按容器宽度缩放
  useEffect(() => {
    const el = containerRef.current;
    if (!el || lines.length === 0) return;
    const measure = () => {
      const containerW = el.clientWidth - 8; // 留少量边距
      // 计算最长行在默认尺寸下的宽度
      let maxRowW = 0;
      for (const row of lines) {
        let rowW = row.length * DEFAULT_CELL;
        // 标点数量（粗估：诗每句末1个，词按 comment 算）
        if (genre === 'Shi' && sentenceLen > 0) {
          const puncts = Math.floor(row.length / sentenceLen); // 每句1个标点
          rowW += puncts * PUNCT_WIDTH;
          rowW += SEP_WIDTH; // 联内分隔
        } else {
          // 词：每行可能有若干标点，粗估 20%
          rowW += Math.ceil(row.length * 0.2) * PUNCT_WIDTH;
        }
        if (rowW > maxRowW) maxRowW = rowW;
      }
      if (maxRowW <= containerW) {
        setCellSize(DEFAULT_CELL);
      } else {
        const scale = containerW / maxRowW;
        setCellSize(Math.max(18, Math.floor(DEFAULT_CELL * scale))); // 最小 18px
      }
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lines.length, genre, sentenceLen]);

  // 派生尺寸
  const cellW = cellSize;
  const charBoxSize = cellSize - 2;
  // 字体尽量撑满格子（约为格子高度的 65~70%）
  const fontSize = Math.max(10, Math.round(charBoxSize * 0.68));
  const punctW = Math.round(PUNCT_WIDTH * (cellSize / DEFAULT_CELL));
  const sepW = Math.round(SEP_WIDTH * (cellSize / DEFAULT_CELL));
  const candidateSize = Math.max(16, cellSize - 6);

  // --- 错误/韵脚索引集 ---
  const errorSet = new Set((validation?.errors ?? []).map(e => e.position));
  const rhymeSet = new Set(validation?.rhyme_positions ?? []);

  // --- 韵脚颜色 ---
  // 平韵色序: 默认 + 备用（换韵时轮换）
  const PING_COLORS = ['#559977', '#779955', '#888855', '#669966'];
  const ZE_COLORS = ['#557799', '#775599', '#885588', '#666699'];
  const YE_COLOR = '#d97706'; // amber-600

  // 构建 position → color 映射
  const rhymeColorMap = new Map<number, string>();
  if (validation) {
    const groups = validation.rhyme_groups ?? [];
    const relations = validation.rhyme_relations ?? [];

    // 合并 neighbor 关系连接的组（视为同一韵部组）
    // groupOf[i] = 该组的合并根索引
    const groupOf = groups.map((_, i) => i);
    const find = (i: number): number => groupOf[i] === i ? i : (groupOf[i] = find(groupOf[i]));
    const union = (a: number, b: number) => { groupOf[find(a)] = find(b); };

    // 为每个 position 找到所属的 group index
    const posToGroup = new Map<number, number>();
    groups.forEach((g, gi) => { for (const p of g.positions) posToGroup.set(p, gi); });

    // neighbor 关系的两端合并
    for (const rel of relations) {
      if (rel.relation === 'neighbor') {
        const ga = posToGroup.get(rel.pos1);
        const gb = posToGroup.get(rel.pos2);
        if (ga != null && gb != null) union(ga, gb);
      }
    }

    // 为合并后的根分配颜色序号
    const rootToColorIdx = new Map<number, number>();
    let colorCounter = 0;
    for (let i = 0; i < groups.length; i++) {
      const root = find(i);
      if (!rootToColorIdx.has(root)) {
        rootToColorIdx.set(root, colorCounter++);
      }
    }
    const totalGroups = rootToColorIdx.size;

    // 为每个 SAME_CATEGORY 组的位置分配颜色
    groups.forEach((g, groupIdx) => {
      const root = find(groupIdx);
      const cIdx = rootToColorIdx.get(root) ?? 0;
      for (const pos of g.positions) {
        const item = (() => {
          if (!validation.display_segments) return null;
          for (const seg of validation.display_segments) {
            const off = pos - seg.start_index;
            if (off >= 0 && off < seg.rule_items.length) return seg.rule_items[off];
          }
          return null;
        })();
        const tone = item?.tone ?? 'P';
        const palette = tone === 'Z' ? ZE_COLORS : PING_COLORS;
        const colorIdx = totalGroups > 1 ? cIdx % palette.length : 0;
        rhymeColorMap.set(pos, palette[colorIdx]);
      }
    });

    // RELATION（叶韵）：仅 pos2 标黄（ye 是单向的）
    for (const rel of relations) {
      if (rel.relation.startsWith('ye_')) {
        rhymeColorMap.set(rel.pos2, YE_COLOR);
      }
    }
  }

  // --- 获取对应位置的 rule_item ---
  const getRuleItem = (gi: number) => {
    if (!validation?.display_segments) return null;
    for (const seg of validation.display_segments) {
      const offset = gi - seg.start_index;
      if (offset >= 0 && offset < seg.rule_items.length) {
        return seg.rule_items[offset];
      }
    }
    return null;
  };

  // --- 获取标点 ---
  const getPunctuation = (gi: number): string | undefined => {
    if (genre === 'Shi') {
      // 诗：韵脚后加句号，其他句末加逗号
      // 句末 = sentenceLen 的倍数减1的位置
      const posInCouplet = gi % (sentenceLen * 2);
      const isSentenceEnd = posInCouplet === sentenceLen - 1 || posInCouplet === sentenceLen * 2 - 1;
      if (!isSentenceEnd) return undefined;
      return rhymeSet.has(gi) ? '。' : '，';
    } else {
      // 词：根据 rule_item.comment 和韵脚位置
      const item = getRuleItem(gi);
      if (!item) return undefined;
      const comment = item.comment;
      if (rhymeSet.has(gi)) return '。';           // 韵脚 → 句号
      if (comment === '叶' || comment === '换叶') return '。';  // 叶韵 → 句号
      if (comment === '句') return '，';            // 句 → 逗号
      if (comment === '读') return '、';            // 读 → 顿号
      return undefined;
    }
  };

  // --- IME 组合事件 ---
  const handleCompositionStart = () => { composingRef.current = true; };
  const handleCompositionEnd = () => {
    composingRef.current = false;
    // compositionend 后手动触发一次处理
    flushInput();
  };

  // --- 输入处理 ---
  const flushInput = () => {
    const inp = inputRef.current;
    if (!inp) return;
    const val = inp.value;
    inp.value = '';
    if (!val) return;

    let cur = cursor;
    // 清除多选
    setSelectionEnd(null);
    for (const ch of val) {
      if (/[\u4e00-\u9fff]/.test(ch) && cur < charCount) {
        dispatch({ type: 'UPDATE_CHAR', index: cur, char: ch });
        cur = Math.min(cur + 1, charCount - 1);
      }
    }
    setCursor(cur);
  };

  const handleInput = () => {
    // IME 组合过程中不处理，等 compositionend
    if (composingRef.current) return;
    flushInput();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // IME 组合过程中不拦截按键
    if (composingRef.current) return;

    // 多选时 Backspace/Delete → 块状删除
    if ((e.key === 'Backspace' || e.key === 'Delete') && selectionEnd != null) {
      e.preventDefault();
      const s = Math.min(cursor, selectionEnd);
      const ed = Math.max(cursor, selectionEnd);
      for (let i = s; i <= ed; i++) {
        dispatch({ type: 'UPDATE_CHAR', index: i, char: PLACEHOLDER });
      }
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
        const prev = cursor - 1;
        dispatch({ type: 'UPDATE_CHAR', index: prev, char: PLACEHOLDER });
        setCursor(prev);
      }
    } else if (e.key === 'ArrowLeft') {
      setCursor(prev => Math.max(0, prev - 1));
      setSelectionEnd(null);
    } else if (e.key === 'ArrowRight') {
      setCursor(prev => Math.min(charCount - 1, prev + 1));
      setSelectionEnd(null);
    } else if (e.key === 'ArrowUp') {
      // 找到当前行，跳到上一行同列
      for (let li = 0; li < lines.length; li++) {
        const ci = lines[li].indexOf(cursor);
        if (ci !== -1 && li > 0) {
          const targetRow = lines[li - 1];
          setCursor(targetRow[Math.min(ci, targetRow.length - 1)]);
          break;
        }
      }
    } else if (e.key === 'ArrowDown') {
      for (let li = 0; li < lines.length; li++) {
        const ci = lines[li].indexOf(cursor);
        if (ci !== -1 && li < lines.length - 1) {
          const targetRow = lines[li + 1];
          setCursor(targetRow[Math.min(ci, targetRow.length - 1)]);
          break;
        }
      }
    }
  };

  // --- 多选范围 ---
  const selStart = selectionEnd != null ? Math.min(cursor, selectionEnd) : null;
  const selEnd = selectionEnd != null ? Math.max(cursor, selectionEnd) : null;
  const selectedIndices = new Set<number>();
  if (selStart != null && selEnd != null) {
    for (let i = selStart; i <= selEnd; i++) selectedIndices.add(i);
  }

  // 多选 → 对语查询（诗，<=4字，不跨句）
  useEffect(() => {
    if (selStart == null || selEnd == null || genre !== 'Shi' || sentenceLen <= 0) return;
    const len = selEnd - selStart + 1;
    if (len < 1 || len > 4) return;
    // 检查是否跨句
    const sentenceOfStart = Math.floor(selStart / sentenceLen);
    const sentenceOfEnd = Math.floor(selEnd / sentenceLen);
    if (sentenceOfStart !== sentenceOfEnd) return;
    // 提取选中文字
    const text = poemChars.slice(selStart, selEnd + 1).filter(c => c !== PLACEHOLDER).join('');
    if (text.length !== len) return; // 有空位则不查
    // 计算对仗插入位置
    const coupletLen = sentenceLen * 2;
    const posInCouplet = selStart % coupletLen;
    let insertAt: number;
    if (posInCouplet < sentenceLen) {
      insertAt = selStart + sentenceLen; // 上句 → 下句
    } else {
      insertAt = selStart - sentenceLen; // 下句 → 上句
    }
    dispatch({ type: 'SET_PAIR_QUERY', payload: { text, insertAt } });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selStart, selEnd]);

  // --- 检测状态展示 ---
  const ruleName = validation?.closest_rule?.name ?? '';

  // --- 标题编辑 ---
  const handleTitleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const val = e.target.value.trim();
    if (val && val !== board.title) {
      dispatch({ type: 'UPDATE_TITLE', title: val });
    }
  };

  // 词加载中（等待 display_segments）
  const ciLoading = genre === 'Ci' && lines.length === 0;

  return (
    <div className="w-full relative" onClick={focusInput} ref={containerRef}>
      {/* 大标题（可编辑，与网格居中对齐） */}
      <div className="flex flex-col items-center mb-4">
        <input
          className="text-lg font-semibold text-center bg-transparent outline-none border-b border-dashed border-[var(--grid-empty-border)] focus:border-[var(--accent)] pb-1 w-full max-w-64 text-[var(--text)] placeholder:text-[var(--text-muted)] text-ellipsis overflow-hidden"
          defaultValue={board.title}
          key={board.id + '-title'}
          placeholder="点击输入标题..."
          onBlur={handleTitleBlur}
          onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
          onClick={e => e.stopPropagation()}
        />
        {ruleName && (
          <div className="text-xs text-[var(--text-muted)] mt-1.5">{ruleName}</div>
        )}
      </div>

      {/* 加载动画（词等待 display_segments） */}
      {ciLoading && (
        <div className="flex flex-col items-center py-12 gap-3">
          <div className="w-5 h-5 border-2 border-[var(--grid-empty-border)] border-t-[var(--accent)] rounded-full animate-spin" />
          <div className="text-xs text-[var(--text-muted)]">加载词谱...</div>
        </div>
      )}

      {/* 网格 */}
      {!ciLoading && <div className="flex flex-col items-center gap-0.5">
        {lines.map((row, li) => (
          <div key={li} className="flex justify-center">
            {row.map((gi, ci) => (
              <GridCell
                key={gi}
                char={poemChars[gi] ?? PLACEHOLDER}
                globalIndex={gi}
                isCursor={gi === cursor}
                isSelected={selectedIndices.has(gi)}
                isError={errorSet.has(gi)}
                isRhyme={rhymeSet.has(gi)}
                rhymeColor={rhymeColorMap.get(gi)}
                ruleItem={getRuleItem(gi)}
                hasSepAfter={genre === 'Shi' && sentenceLen > 0 && (ci + 1) === sentenceLen}
                sepWidth={sepW}
                punctuation={getPunctuation(gi)}
                cellW={cellW}
                charBoxSize={charBoxSize}
                fontSize={fontSize}
                punctW={punctW}
                candidateSize={candidateSize}
                candidates={board.candidatesMap[gi]}
                onClickCell={(e) => {
                  if (e.shiftKey && genre === 'Shi' && sentenceLen > 0) {
                    // Shift+click: 多选
                    setSelectionEnd(gi);
                  } else {
                    // 普通点击: 移动光标, 清除多选
                    setCursor(gi);
                    setSelectionEnd(null);
                    dispatch({ type: 'SET_PAIR_QUERY', payload: null });
                    focusInput();
                    const ch = poemChars[gi];
                    if (ch && ch !== PLACEHOLDER) {
                      dispatch({ type: 'SET_DICT_QUERY', query: ch, cursor: gi });
                    }
                  }
                }}
                onClickCandidate={ch => dispatch({ type: 'REPLACE_WITH_CANDIDATE', index: gi, char: ch })}
                onAddCandidate={() => {
                  // 将当前正文字加入候选（如果不是空位）
                  const ch = poemChars[gi];
                  if (ch && ch !== PLACEHOLDER) {
                    dispatch({ type: 'ADD_CANDIDATE', index: gi, char: ch });
                  }
                }}
                onRemoveCandidate={ch => dispatch({ type: 'REMOVE_CANDIDATE', index: gi, char: ch })}
              />
            ))}
          </div>
        ))}
      </div>}

      {/* 隐藏 input（定位到光标格子附近，使 IME 候选框跟随） */}
      <input
        ref={inputRef}
        className="absolute opacity-0 pointer-events-none w-0 h-0"
        style={(() => {
          const cell = containerRef.current?.querySelector(`[data-gi="${cursor}"]`) as HTMLElement | null;
          if (cell) {
            const cr = cell.getBoundingClientRect();
            const pr = containerRef.current!.getBoundingClientRect();
            return { left: cr.left - pr.left, top: cr.bottom - pr.top, fontSize: fontSize };
          }
          return { left: 0, top: 0 };
        })()}
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        onCompositionStart={handleCompositionStart}
        onCompositionEnd={handleCompositionEnd}
        autoFocus
      />

      {/* 错误提示 */}
      {validation && validation.errors.length > 0 && (
        <div className="mt-4 text-xs text-[var(--text-secondary)] space-y-0.5">
          {validation.errors.filter(e => e.position >= 0).slice(0, 5).map((e, i) => (
            <div key={i} className="text-rose-500">
              第{e.position + 1}字「{e.character}」{e.message}
            </div>
          ))}
        </div>
      )}
      {validation && validation.warnings && validation.warnings.length > 0 && (
        <div className={`${validation.errors.length > 0 ? 'mt-1' : 'mt-4'} text-xs space-y-0.5`}>
          {validation.warnings.map((w, i) => (
            <div key={i} className="text-amber-500">
              {w.message}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
