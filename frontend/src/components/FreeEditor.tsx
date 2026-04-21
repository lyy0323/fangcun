import { useState, useRef, useCallback, useEffect } from 'react';
import { useBoardContext, useActiveBoard } from '../context/BoardContext';
import { useFreeRhyme } from '../hooks/useFreeRhyme';
import { Plus, X, Eye } from 'lucide-react';

const MAX_LINE_CHARS = 26;
const RHYME_COLORS = ['#559977', '#557799', '#997755', '#775599', '#779955', '#995577', '#996666', '#669966', '#666699', '#888855', '#885588', '#558888'];

function splitByLineBreaks(text: string): string[] {
  return text
    .replace(/<br\s*\/?>/gi, '\n')
    .split(/\r\n|\r|\n/);
}

function overflowLines(lines: string[]): string[] {
  const result: string[] = [];
  for (const line of lines) {
    if (result.length > 0 && result[result.length - 1].length + line.length <= MAX_LINE_CHARS && line.length === 0) {
      result.push(line);
    } else if (line.length <= MAX_LINE_CHARS) {
      result.push(line);
    } else {
      let remaining = line;
      while (remaining.length > MAX_LINE_CHARS) {
        result.push(remaining.slice(0, MAX_LINE_CHARS));
        remaining = remaining.slice(MAX_LINE_CHARS);
      }
      result.push(remaining);
    }
  }
  return result;
}

export function FreeEditor() {
  const { state, dispatch } = useBoardContext();
  const board = useActiveBoard();
  const inputRef = useRef<HTMLInputElement>(null);
  const composingRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeLine, setActiveLine] = useState(0);
  const [cursorPos, setCursorPos] = useState(0);
  const [inputFocused, setInputFocused] = useState(true);
  const [immersiveHint, setImmersiveHint] = useState(false);
  const hintTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const activeLineRef = useRef(activeLine);
  const cursorPosRef = useRef(cursorPos);
  activeLineRef.current = activeLine;
  cursorPosRef.current = cursorPos;

  useFreeRhyme();

  const lines = board?.sections[0]?.lines ?? [''];

  const rhymeColorMap = new Map<string, string>();
  if (state.freeRhymeResult) {
    state.freeRhymeResult.groups.forEach((g, gi) => {
      const color = RHYME_COLORS[gi % RHYME_COLORS.length];
      for (const p of g.positions) {
        rhymeColorMap.set(`${p.line}:${p.pos}`, color);
      }
    });
  }

  const updateLines = useCallback((newLines: string[]) => {
    dispatch({ type: 'SET_FREE_LINES', lines: newLines });
  }, [dispatch]);

  const focusInput = useCallback(() => {
    inputRef.current?.focus({ preventScroll: true });
  }, []);

  const insertText = useCallback((text: string, atLine: number, atPos: number, currentLines: string[]) => {
    const segments = splitByLineBreaks(text);
    const newLines = [...currentLines];
    const line = newLines[atLine] ?? '';
    const before = line.slice(0, atPos);
    const after = line.slice(atPos);

    if (segments.length === 1) {
      const merged = before + segments[0] + after;
      const expanded = overflowLines([merged]);
      newLines.splice(atLine, 1, ...expanded);
      updateLines(newLines);
      const insertEnd = before.length + segments[0].length;
      let curLine = atLine, curPos = insertEnd;
      for (let i = 0; i < expanded.length - 1; i++) {
        if (curPos > expanded[i].length) { curPos -= expanded[i].length; curLine++; }
        else break;
      }
      setActiveLine(curLine);
      setCursorPos(Math.min(curPos, expanded[curLine - atLine]?.length ?? 0));
      return;
    }

    const result: string[] = [];
    for (let i = 0; i < segments.length; i++) {
      let seg = segments[i];
      if (i === 0) seg = before + seg;
      if (i === segments.length - 1) seg = seg + after;
      result.push(seg);
    }
    const expanded = overflowLines(result);
    newLines.splice(atLine, 1, ...expanded);
    updateLines(newLines);
    const lastSeg = expanded[expanded.length - 1];
    setActiveLine(atLine + expanded.length - 1);
    setCursorPos(Math.max(0, lastSeg.length - after.length));
  }, [updateLines]);

  // Register insertCharFn
  useEffect(() => {
    if (!board || board.genre !== 'Free') return;
    const fn = (text: string) => {
      const filtered = [...text].filter(c => /[\u4e00-\u9fff\u3400-\u4dbf，。！？、；：]/.test(c)).join('');
      if (!filtered) return;
      insertText(filtered, activeLineRef.current, cursorPosRef.current, lines);
    };
    dispatch({ type: 'SET_INSERT_FN', fn });
    return () => { dispatch({ type: 'SET_INSERT_FN', fn: null }); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [board?.id, lines]);

  if (!board || board.genre !== 'Free') return null;

  const immersive = board.sections[0]?.immersive ?? false;

  const flushInput = () => {
    const inp = inputRef.current;
    if (!inp) return;
    const val = inp.value;
    inp.value = '';
    if (!val) return;

    let filtered = '';
    for (const ch of val) {
      if (/[\u4e00-\u9fff\u3400-\u4dbf，。！？、；： ]/.test(ch)) {
        filtered += ch;
      }
    }
    if (!filtered) return;
    insertText(filtered, activeLine, cursorPos, lines);
  };

  const handleCompositionStart = () => { composingRef.current = true; };
  const handleCompositionEnd = () => { composingRef.current = false; flushInput(); };
  const handleInput = () => { if (!composingRef.current) flushInput(); };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const plain = e.clipboardData.getData('text/plain');
    const html = e.clipboardData.getData('text/html');
    let text: string;
    if (plain) {
      text = plain;
    } else if (html) {
      text = html
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/(?:p|div|li|h[1-6]|tr)>/gi, '\n')
        .replace(/<[^>]*>/g, '');
    } else {
      return;
    }
    const filtered = text.replace(/[^\u4e00-\u9fff\u3400-\u4dbf，。！？、；：""''…—· \n\r]/g, '');
    if (!filtered) return;
    insertText(filtered, activeLine, cursorPos, lines);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (composingRef.current) return;
    if (e.key === ' ') {
      e.preventDefault();
      insertText(' ', activeLine, cursorPos, lines);
      return;
    }

    const li = activeLine;
    const ci = cursorPos;
    const line = lines[li] ?? '';

    if (e.key === 'Enter') {
      e.preventDefault();
      const newLines = [...lines];
      const before = line.slice(0, ci);
      const after = line.slice(ci);
      newLines.splice(li, 1, before, after);
      updateLines(newLines);
      setActiveLine(li + 1);
      setCursorPos(0);
    } else if (e.key === 'Backspace') {
      e.preventDefault();
      if (ci > 0) {
        const newLines = [...lines];
        newLines[li] = line.slice(0, ci - 1) + line.slice(ci);
        updateLines(newLines);
        setCursorPos(ci - 1);
      } else if (li > 0) {
        const prevLine = lines[li - 1];
        if (prevLine.length + line.length <= MAX_LINE_CHARS) {
          const newLines = [...lines];
          newLines[li - 1] = prevLine + line;
          newLines.splice(li, 1);
          updateLines(newLines);
          setActiveLine(li - 1);
          setCursorPos(prevLine.length);
        } else if (line === '') {
          const newLines = [...lines];
          newLines.splice(li, 1);
          updateLines(newLines);
          setActiveLine(li - 1);
          setCursorPos(prevLine.length);
        }
      }
    } else if (e.key === 'Delete') {
      e.preventDefault();
      if (ci < line.length) {
        const newLines = [...lines];
        newLines[li] = line.slice(0, ci) + line.slice(ci + 1);
        updateLines(newLines);
      } else if (li < lines.length - 1) {
        const nextLine = lines[li + 1];
        if (line.length + nextLine.length <= MAX_LINE_CHARS) {
          const newLines = [...lines];
          newLines[li] = line + nextLine;
          newLines.splice(li + 1, 1);
          updateLines(newLines);
        }
      }
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      if (ci > 0) {
        setCursorPos(ci - 1);
      } else if (li > 0) {
        setActiveLine(li - 1);
        setCursorPos(lines[li - 1].length);
      }
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      if (ci < line.length) {
        setCursorPos(ci + 1);
      } else if (li < lines.length - 1) {
        setActiveLine(li + 1);
        setCursorPos(0);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (li > 0) {
        setActiveLine(li - 1);
        setCursorPos(Math.min(ci, lines[li - 1].length));
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (li < lines.length - 1) {
        setActiveLine(li + 1);
        setCursorPos(Math.min(ci, lines[li + 1].length));
      }
    }
  };

  const handleCharClick = (lineIdx: number, charIdx: number) => {
    setActiveLine(lineIdx);
    setCursorPos(charIdx);
    focusInput();
    const ch = lines[lineIdx]?.[charIdx];
    if (ch && /[\u4e00-\u9fff\u3400-\u4dbf]/.test(ch)) {
      dispatch({ type: 'SET_DICT_QUERY', query: ch, cursor: charIdx });
    }
  };

  const handleLineClick = (lineIdx: number) => {
    setActiveLine(lineIdx);
    setCursorPos(lines[lineIdx]?.length ?? 0);
    focusInput();
  };

  const addLine = () => {
    const newLines = [...lines, ''];
    updateLines(newLines);
    setActiveLine(newLines.length - 1);
    setCursorPos(0);
    focusInput();
  };

  const deleteLine = (idx: number) => {
    if (lines.length <= 1) return;
    const newLines = lines.filter((_, i) => i !== idx);
    updateLines(newLines);
    if (activeLine >= newLines.length) {
      setActiveLine(newLines.length - 1);
      setCursorPos(newLines[newLines.length - 1]?.length ?? 0);
    } else if (activeLine === idx) {
      setCursorPos(0);
    }
  };

  const enterImmersive = () => {
    dispatch({ type: 'TOGGLE_IMMERSIVE', sectionIndex: 0 });
    setImmersiveHint(true);
    clearTimeout(hintTimerRef.current);
    hintTimerRef.current = setTimeout(() => setImmersiveHint(false), 3000);
  };

  const exitImmersiveMode = () => {
    dispatch({ type: 'TOGGLE_IMMERSIVE', sectionIndex: 0 });
    setImmersiveHint(false);
  };

  const isActive = (li: number) => li === activeLine && inputFocused;

  const [containerW, setContainerW] = useState(0);
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => setContainerW(el.clientWidth - 32);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const getMobileFontSize = (charCount: number) => {
    if (!containerW || containerW >= 512) return undefined;
    const charW = 16 * 1.25 + 2;
    const needed = charCount * charW;
    if (needed <= containerW) return undefined;
    return Math.max(10, 16 * containerW / needed);
  };

  return (
    <div
      ref={containerRef}
      className="w-full max-w-lg mx-auto py-6 px-4"
      onClick={() => inputRef.current?.blur()}
    >
      {/* Title */}
      <div className="flex flex-col items-center mb-6" onClick={e => e.stopPropagation()}>
        <input
          className="text-lg text-center bg-transparent outline-none border-b border-dashed border-transparent focus:border-[var(--accent)] placeholder:text-[var(--text-muted)] w-48 transition-colors font-semibold"
          defaultValue={board.title}
          key={board.id + '-title'}
          placeholder="标题"
          onBlur={(e) => dispatch({ type: 'UPDATE_TITLE', title: e.target.value.trim() || '新建·自由诗' })}
          onMouseDown={(e) => {
            if (immersive) { e.preventDefault(); exitImmersiveMode(); }
          }}
        />
        <div className="flex items-center justify-center mt-1.5 h-5">
          {immersive ? (
            <span className="text-xs text-[var(--text-muted)] transition-opacity duration-500" style={{ opacity: immersiveHint ? 1 : 0 }}>
              点击标题退出沉浸模式
            </span>
          ) : (
            <>
              <span className="w-5 shrink-0" />
              <span className="text-xs text-[var(--text-muted)]">{board.subGenre ?? '自由诗'}</span>
              <button
                className="w-5 h-5 rounded flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--accent)] hover:bg-[var(--accent-light)] transition-colors shrink-0 ml-0.5"
                onClick={(e) => { e.stopPropagation(); enterImmersive(); }}
                title="沉浸模式"
              >
                <Eye size={12} />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Lines */}
      <div className="space-y-0" onClick={(e) => e.stopPropagation()}>
        {lines.map((line, li) => {
          const active = isActive(li);
          const chars = [...line];

          const mobileFontSize = getMobileFontSize(chars.length);

          return (
            <div
              key={li}
              className="group relative"
              onClick={(e) => { e.stopPropagation(); handleLineClick(li); }}
            >
              <div
                className={`min-h-[2.5rem] flex items-center justify-center border-b transition-colors px-1 w-fit min-w-[15em] max-w-full mx-auto ${
                  immersive
                    ? 'border-transparent'
                    : active
                      ? 'border-[var(--accent)]'
                      : 'border-[var(--grid-empty-border)]'
                }`}
                style={mobileFontSize ? { fontSize: `${mobileFontSize}px` } : undefined}
              >
                {chars.length === 0 && !active && !immersive && (
                  <span className="text-[var(--text-muted)] text-sm select-none opacity-40">点击输入...</span>
                )}
                {chars.length === 0 && active && (
                  <span className={`inline-block w-0.5 h-5 animate-pulse ${immersive ? 'bg-[var(--text-muted)] opacity-40' : 'bg-[var(--accent)]'}`} />
                )}
                {chars.map((ch, ci) => {
                  const color = immersive ? undefined : rhymeColorMap.get(`${li}:${ci}`);
                  const isCursorHere = active && ci === cursorPos;
                  return (
                    <span
                      key={ci}
                      className="inline-flex items-center cursor-text select-none"
                      onClick={(e) => { e.stopPropagation(); handleCharClick(li, ci); }}
                    >
                      <span className={`inline-block w-0.5 h-5 ${isCursorHere ? (immersive ? 'bg-[var(--text-muted)] opacity-40 animate-pulse' : 'bg-[var(--accent)] animate-pulse') : ''}`} />
                      <span
                        className="inline-block text-center leading-relaxed transition-colors"
                        style={{
                          color: color ?? undefined,
                          fontWeight: color ? 600 : undefined,
                          minWidth: /[\u4e00-\u9fff\u3400-\u4dbf]/.test(ch) ? '1.25em' : '0.5em',
                        }}
                      >
                        {ch}
                      </span>
                    </span>
                  );
                })}
                {/* Trailing gap — always present, colored when cursor is at end */}
                {chars.length > 0 && (
                  <span className={`inline-block w-0.5 h-5 ${active && cursorPos >= chars.length ? (immersive ? 'bg-[var(--text-muted)] opacity-40 animate-pulse' : 'bg-[var(--accent)] animate-pulse') : ''}`} />
                )}
              </div>

              {/* Delete button */}
              {!immersive && lines.length > 1 && (
                <button
                  className="absolute right-0 top-1/2 -translate-y-1/2 -mr-6 w-4 h-4 rounded flex items-center justify-center text-[var(--text-muted)] opacity-0 group-hover:opacity-100 touch-show hover:text-rose-500 transition-opacity"
                  onClick={(e) => { e.stopPropagation(); deleteLine(li); }}
                  title="删除行"
                >
                  <X size={10} />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Add line */}
      {!immersive && (
      <button
        className="mt-4 w-full py-2 text-xs text-[var(--text-muted)] hover:text-[var(--accent)] hover:bg-[var(--accent-light)] rounded-lg transition-colors flex items-center justify-center gap-1"
        onClick={(e) => { e.stopPropagation(); addLine(); }}
      >
        <Plus size={12} /> 添加一行
      </button>
      )}

      {/* Hidden input for IME */}
      <input
        ref={inputRef}
        className="absolute opacity-0 w-0 h-0 pointer-events-none"
        onCompositionStart={handleCompositionStart}
        onCompositionEnd={handleCompositionEnd}
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        onFocus={() => setInputFocused(true)}
        onBlur={() => setInputFocused(false)}
        autoFocus
      />
    </div>
  );
}
