import { useState, useEffect } from 'react';
import { useBoardContext, useActiveBoard } from '../context/BoardContext';
import { rhymeLookup, rhymeList } from '../lib/api';
import type { RhymeLookupResult } from '../lib/types';
import { RefreshCw, RotateCcw, ChevronDown } from 'lucide-react';

export function RhymePanel() {
  const { state, dispatch } = useBoardContext();
  const board = useActiveBoard();
  const validation = state.validation;

  const [rhymeChars, setRhymeChars] = useState<string[]>([]);
  const [rhymeCatName, setRhymeCatName] = useState<string | null>(null);
  const [rhymeTotal, setRhymeTotal] = useState(0);
  const [allCategories, setAllCategories] = useState<{ name: string; tone_type: string; preview?: string }[]>([]);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualOverride, setManualOverride] = useState<string | null>(null); // 手动选韵覆盖

  const bookName = board?.rhymeBookName ?? 'Pingshuiyun';
  const rhymeName = validation?.rhyme_name ?? null;
  const isHuanyun = rhymeName?.includes('换韵') ?? false;

  // 加载同韵字的通用函数
  const loadCategory = (name: string) => {
    setRhymeCatName(name);
    setRhymeChars([]);
    rhymeLookup(bookName, name)
      .then(data => {
        const d = data as RhymeLookupResult;
        setRhymeChars(d.characters ?? []);
        setRhymeTotal(d.total ?? 0);
      })
      .catch(() => {});
  };

  // 画板切换时重置所有状态
  const boardId = board?.id;
  useEffect(() => {
    setManualOverride(null);
    setManualOpen(false);
    setAllCategories([]);
    setRhymeCatName(null);
    setRhymeChars([]);
    setRhymeTotal(0);
  }, [boardId]);

  // 韵部推断变化时自动加载（除非用户手动覆盖了）
  useEffect(() => {
    if (manualOverride) {
      loadCategory(manualOverride);
      return;
    }
    if (rhymeName && !isHuanyun) {
      const firstName = rhymeName.split(',')[0].trim();
      loadCategory(firstName);
    } else {
      setRhymeCatName(null);
      setRhymeChars([]);
      setRhymeTotal(0);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rhymeName, bookName, manualOverride, boardId]);

  // 加载韵部列表（打开选韵列表时，或韵书变化后重新加载）
  useEffect(() => {
    if (manualOpen && allCategories.length === 0) {
      rhymeList(bookName)
        .then(data => setAllCategories(data.categories))
        .catch(() => {});
    }
  }, [manualOpen, bookName, allCategories.length]);

  const selectCategory = (name: string) => {
    setManualOverride(name);
    setManualOpen(false);
  };

  // 联动：字典韵部点击 → 切换到对应韵部
  useEffect(() => {
    if (state.rhymeOverride) {
      setManualOverride(state.rhymeOverride);
      setManualOpen(false);
      dispatch({ type: 'SET_RHYME_OVERRIDE', category: null });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.rhymeOverride]);

  const clearOverride = () => {
    setManualOverride(null);
    setManualOpen(false);
  };

  return (
    <div className="p-3 text-sm">
      {/* 韵部名 */}
      <div className="mb-3">
        <div className="text-xs text-[var(--text-secondary)] mb-1">韵部</div>
        {rhymeCatName ? (
          <div>
            <div className="text-lg font-semibold mb-0.5" style={{ color: 'var(--accent)' }}>{rhymeCatName}</div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-[var(--text-muted)]">{rhymeTotal}字</span>
              <button
                className="w-5 h-5 rounded flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--accent)] hover:bg-[var(--accent-light)] transition-colors"
                onClick={() => setManualOpen(!manualOpen)}
                title="切换韵部"
              >
                <RefreshCw size={12} />
              </button>
              {manualOverride && (
                <button
                  className="w-5 h-5 rounded flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--accent)] hover:bg-[var(--accent-light)] transition-colors"
                  onClick={clearOverride}
                  title="恢复自动推断"
                >
                  <RotateCcw size={12} />
                </button>
              )}
            </div>
          </div>
        ) : isHuanyun ? (
          <div className="flex items-center gap-1.5">
            <span className="text-amber-600 text-sm">换韵</span>
            <button
              className="w-5 h-5 rounded flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--accent)] hover:bg-[var(--accent-light)]"
              onClick={() => setManualOpen(!manualOpen)}
              title="选择韵部查看"
            >
              <ChevronDown size={12} />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            <span className="text-[var(--text-muted)] text-sm">等待检测...</span>
            <button
              className="w-5 h-5 rounded flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--accent)] hover:bg-[var(--accent-light)]"
              onClick={() => setManualOpen(!manualOpen)}
              title="手动选择"
            >
              <ChevronDown size={12} />
            </button>
          </div>
        )}
      </div>

      {/* 韵部列表（手动选韵 / 改选） */}
      {manualOpen && (
        <div className="mb-3 max-h-48 overflow-y-auto border border-[var(--border)] rounded-lg -mx-1">
          {allCategories.map(cat => (
            <button
              key={cat.name}
              className={`w-full text-left px-3 py-1.5 hover:bg-[var(--accent-light)] ${cat.name === rhymeCatName ? 'bg-[var(--accent-light)] text-[var(--accent)]' : ''}`}
              onClick={() => selectCategory(cat.name)}
            >
              <div className="flex items-center justify-between text-sm">
                <span>{cat.name}</span>
                <span className="text-xs text-[var(--text-muted)]">{cat.tone_type === 'P' ? '平' : '仄'}</span>
              </div>
              {cat.preview && <div className="text-xs text-[var(--text-muted)] tracking-wide mt-0.5">{cat.preview}</div>}
            </button>
          ))}
        </div>
      )}

      {/* 韵脚字 */}
      {validation?.rhyme_chars && validation.rhyme_chars.length > 0 && (
        <div className="mb-3">
          <div className="text-xs text-[var(--text-secondary)] mb-1">韵脚</div>
          <div className="flex gap-1.5 flex-wrap">
            {validation.rhyme_chars.map((ch, i) => {
              if (ch === '\u25a1') return null;
              const pos = validation.rhyme_positions?.[i];
              // 获取该位置的 tone
              let tone = 'P';
              if (validation.display_segments && pos != null) {
                for (const seg of validation.display_segments) {
                  const off = pos - seg.start_index;
                  if (off >= 0 && off < seg.rule_items.length) {
                    tone = seg.rule_items[off].tone;
                    break;
                  }
                }
              }
              const color = tone === 'Z' ? '#557799' : '#559977';
              return (
                <span
                  key={i}
                  className="inline-flex items-center justify-center w-8 h-8 rounded-md border text-base font-medium"
                  style={{ color, borderColor: color + '40', backgroundColor: color + '10' }}
                >
                  {ch}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* 同韵字列表（可点击填入网格） */}
      {rhymeChars.length > 0 && (
        <div>
          <div className="text-xs text-[var(--text-secondary)] mb-1">同韵字 <span className="text-[var(--text-muted)]">点击填入</span></div>
          <div className="leading-8 text-base tracking-wider text-[var(--text)] break-all">
            {rhymeChars.map((ch, i) => (
              <span
                key={i}
                className="cursor-pointer hover:text-[var(--accent)] hover:bg-[var(--accent-light)] rounded px-0.5 transition-colors"
                onClick={() => state.insertCharFn?.(ch)}
              >
                {ch}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
