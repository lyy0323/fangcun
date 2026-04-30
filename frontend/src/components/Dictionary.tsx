import { useState, useEffect, useCallback, useRef } from 'react';
import { useActiveBoard, useBoardContext } from '../context/BoardContext';
import { charLookup, dictionarySearch, allusionSearch, type AllusionEntry } from '../lib/api';
import { SendHorizontal, ChevronsDown, ChevronsUp } from 'lucide-react';
import { AllusionPopup } from './AllusionPopup';

type TabId = 'rhyme' | 'head' | 'tail' | 'allusion' | 'pair' | 'tongwei';

const LENGTH_CONFIGS = [
  { value: '2', count: 2 },
  { value: '3', count: 3 },
  { value: '4', count: 4 },
];

function DotPattern({ count, mode }: { count: number; mode: 'head' | 'tail' }) {
  return (
    <span className="inline-flex gap-[2px] items-center">
      {Array.from({ length: count }, (_, i) => {
        const filled = mode === 'head' ? i === 0 : i === count - 1;
        return (
          <span
            key={i}
            className={`inline-block w-[6px] h-[6px] rounded-full ${filled ? 'bg-current' : 'border border-current'}`}
          />
        );
      })}
    </span>
  );
}

// 邻字平仄符号（与正文平仄标记一致: — | ○）
function ToneSymbol({ type }: { type: 'all' | 'P' | 'Z' }) {
  if (type === 'P') return <span className="font-mono text-[11px]">{'\u2014'}</span>;  // —
  if (type === 'Z') return <span className="font-mono text-[11px]">|</span>;
  return <span className="font-mono text-[11px]">{'\u25cb'}</span>;  // ○
}

const TONE_OPTIONS: { value: string; type: 'all' | 'P' | 'Z' }[] = [
  { value: 'all', type: 'all' },
  { value: 'P', type: 'P' },
  { value: 'Z', type: 'Z' },
];

const TAB_LABELS: Record<TabId, string> = {
  rhyme: '韵部', head: '词首', tail: '词末', allusion: '典故', pair: '对语', tongwei: '同位',
};

export function Dictionary() {
  const { state, dispatch } = useBoardContext();
  const board = useActiveBoard();
  const [term, setTerm] = useState('');
  const [tab, setTab] = useState<TabId>('rhyme');
  const [length, setLength] = useState('2');
  const [tone, setTone] = useState('all');
  const pendingQuery = useRef(false);

  // 结果
  const [rhymeResult, setRhymeResult] = useState<{
    tones: string[];
    categories: { name: string; tone_type: string }[];
    definitions: { py: string; defs: { d: string; c?: string }[] }[];
  } | null>(null);
  const [phraseResult, setPhraseResult] = useState<[string, number][]>([]);
  const [allusionResult, setAllusionResult] = useState<AllusionEntry[]>([]);
  const [loading, setLoading] = useState(false);

  // 典故弹窗
  const [allusionPopup, setAllusionPopup] = useState<AllusionEntry | null>(null);

  // 锚定填充: 记住从画布点击触发的查询字和光标位置
  const [lastDictQuery, setLastDictQuery] = useState<string | null>(null);
  const [lastDictCursor, setLastDictCursor] = useState<number | null>(null);

  const bookName = board?.rhymeBookName ?? 'Pingshuiyun';
  const isSingle = term.length <= 1;
  const visibleTabs: TabId[] = isSingle
    ? ['rhyme', 'head', 'tail', 'allusion', 'pair', 'tongwei']
    : ['allusion', 'pair', 'tongwei'];

  // 当前 tab 不在可见列表中时，自动校正到第一个可见 tab
  const effectiveTab = visibleTabs.includes(tab) ? tab : visibleTabs[0];

  useEffect(() => {
    if (effectiveTab !== tab) setTab(effectiveTab);
  }, [effectiveTab, tab]);

  // 搜索词记录（上次搜索时的 term，用于 tab/filter 切换时重搜）
  const [searchedTerm, setSearchedTerm] = useState('');

  const doSearch = useCallback(async (overrideTerm?: string) => {
    const q = overrideTerm ?? term;
    if (!q) {
      setRhymeResult(null);
      setPhraseResult([]);
      setAllusionResult([]);
      setSearchedTerm('');
      return;
    }
    // 根据输入长度决定实际使用的 tab（多字时只有 allusion 和 pair 可见）
    const curTab = (q.length > 1 && !['allusion', 'pair', 'tongwei'].includes(tab)) ? 'pair' : tab;
    setSearchedTerm(q);
    setLoading(true);
    try {
      if (curTab === 'rhyme') {
        const r = await charLookup(q, bookName);
        setRhymeResult({ tones: r.tones, categories: r.rhyme_categories, definitions: r.definitions ?? [] });
        setPhraseResult([]);
        setAllusionResult([]);
      } else if (curTab === 'allusion') {
        const r = await allusionSearch(q);
        setAllusionResult(r);
        setRhymeResult(null);
        setPhraseResult([]);
      } else if (curTab === 'pair' || curTab === 'tongwei') {
        const r = await dictionarySearch({ term: q, mode: curTab });
        setPhraseResult(r as [string, number][]);
        setRhymeResult(null);
        setAllusionResult([]);
      } else if (curTab === 'head' || curTab === 'tail') {
        const r = await dictionarySearch({ term: q, mode: curTab, length, tone });
        setPhraseResult(r as [string, number][]);
        setRhymeResult(null);
        setAllusionResult([]);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, [term, tab, length, tone, bookName]);

  // tab/filter 切换时：如果之前已搜索过，用上次的搜索词重搜
  useEffect(() => {
    if (searchedTerm) doSearch(searchedTerm);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, length, tone]);

  // 联动：网格点击已填字时触发搜索
  useEffect(() => {
    if (state.dictQuery) {
      setTerm(state.dictQuery);
      setLastDictQuery(state.dictQuery);
      setLastDictCursor(state.dictQueryCursor);
      setTab('rhyme');
      pendingQuery.current = true;
      dispatch({ type: 'SET_DICT_QUERY', query: null });
    }
  }, [state.dictQuery, state.dictQueryCursor, dispatch]);

  // 联动：多选对语查询
  useEffect(() => {
    if (state.pairQuery) {
      setTerm(state.pairQuery.text);
      setTab('pair');
      pendingQuery.current = true;
    }
  }, [state.pairQuery]);

  // term 更新后执行搜索（由联动触发，或实时搜索）
  useEffect(() => {
    if (pendingQuery.current && term) {
      pendingQuery.current = false;
      doSearch();
      return;
    }
    const timer = setTimeout(() => doSearch(), 300);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [term]);

  // 典故锚定填充
  const handleAllusionClick = useCallback((word: string) => {
    if (lastDictQuery && lastDictCursor !== null && word.includes(lastDictQuery)) {
      // 锚定填充: 将查询字对齐到画布原位置
      const charIdx = word.indexOf(lastDictQuery);
      const startPos = lastDictCursor - charIdx;
      const chars = [...word];
      for (let i = 0; i < chars.length; i++) {
        const pos = startPos + i;
        if (pos >= 0 && pos < (board?.sections[0].charCount ?? 0)) {
          dispatch({ type: 'UPDATE_CHAR', index: pos, char: chars[i] });
        }
      }
    } else {
      // fallback: 从光标向后填充
      state.insertCharFn?.(word, 'forward');
    }
  }, [lastDictQuery, lastDictCursor, board?.sections[0].charCount, dispatch, state.insertCharFn]);

  const showFilters = effectiveTab === 'head' || effectiveTab === 'tail';
  const [expanded, setExpanded] = useState(true);
  const hasAllusionResults = allusionResult.length > 0;
  const noResult = !loading && term &&
    tab !== 'rhyme' && tab !== 'allusion' && phraseResult.length === 0;
  const noAllusionResult = !loading && term && tab === 'allusion' && !hasAllusionResults;

  return (
    <div className={`border-t border-[var(--border)] bg-[var(--bg-card)] flex flex-col overflow-hidden transition-[height] duration-200 ease-in-out ${expanded ? 'h-[255px]' : 'h-[65px]'}`}>
      {/* 抽拉控件 */}
      <button
        className="w-full h-5 flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-secondary)] cursor-row-resize transition-colors"
        onClick={() => setExpanded(v => !v)}
        title={expanded ? '收起字典' : '展开字典'}
      >
        {expanded ? <ChevronsDown size={14} /> : <ChevronsUp size={14} />}
      </button>
      {/* 第一行: 输入 */}
      <div className="flex gap-1.5 px-3 pb-3">
        <input
          className="flex-1 h-8 border border-[var(--grid-empty-border)] rounded-md px-2.5 text-sm outline-none focus:border-[var(--accent)] bg-transparent"
          placeholder="输入汉字查询..."
          value={term}
          onChange={e => {
            // 仅保留汉字（但 IME 组合中允许临时英文）
            const raw = e.target.value;
            const filtered = raw.replace(/[^\u4e00-\u9fff]/g, '');
            // 如果正在 IME 组合，保留原始值（含拼音）
            if (e.nativeEvent instanceof InputEvent && e.nativeEvent.isComposing) {
              setTerm(raw);
            } else {
              setTerm(filtered.slice(0, 4));
            }
            // 手动编辑时清除锚定状态
            setLastDictQuery(null);
            setLastDictCursor(null);
          }}
          onCompositionEnd={e => {
            const val = (e.target as HTMLInputElement).value.replace(/[^\u4e00-\u9fff]/g, '').slice(0, 4);
            setTerm(val);
          }}
          maxLength={8}
        />
        <button
          className="w-8 h-8 rounded-md border border-[var(--border)] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--accent)] hover:bg-[var(--accent-light)] transition-colors shrink-0"
          onClick={() => { if (term) state.insertCharFn?.(term, 'forward'); }}
          title="发送到创作区"
        >
          <SendHorizontal size={14} />
        </button>
      </div>

      <div className={`flex flex-col flex-1 min-h-0 transition-opacity duration-200 ${expanded ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
      {/* 第二行: Tabs */}
      <div className="flex gap-1 px-3 pb-1">
        {visibleTabs.map(t => (
          <button
            key={t}
            className={`px-2.5 py-0.5 rounded-full text-xs transition-colors ${t === tab ? 'text-white' : 'text-[var(--text-secondary)] hover:bg-[var(--accent-light)]'}`}
            style={t === tab ? { background: 'var(--accent)' } : undefined}
            onClick={() => setTab(t)}
          >
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      {/* 第三行: Filters (词首/词末) — 紧凑切换式 */}
      {showFilters && (
        <div className="flex gap-2 px-3 pb-1 items-center">
          {/* 字数切换 */}
          <div className="flex rounded-md border border-[var(--border)] overflow-hidden h-6">
            {LENGTH_CONFIGS.map(o => (
              <button
                key={o.value}
                className={`px-2.5 flex items-center justify-center transition-colors ${o.value === length ? 'bg-[var(--accent-light)] text-[var(--accent)]' : 'text-[var(--text-muted)] hover:bg-[var(--bg-card)]'}`}
                onClick={() => setLength(o.value)}
              >
                <DotPattern count={o.count} mode={effectiveTab as 'head' | 'tail'} />
              </button>
            ))}
          </div>
          {/* 邻字平仄切换 */}
          <div className="flex rounded-md border border-[var(--border)] overflow-hidden h-6">
            {TONE_OPTIONS.map(o => (
              <button
                key={o.value}
                className={`px-2.5 flex items-center justify-center transition-colors ${o.value === tone ? 'bg-[var(--accent-light)] text-[var(--accent)]' : 'text-[var(--text-muted)] hover:bg-[var(--bg-card)]'}`}
                onClick={() => setTone(o.value)}
              >
                <ToneSymbol type={o.type} />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 第四区域: 结果 */}
      <div className={`px-3 pb-2 flex-1 min-h-0 overflow-y-auto transition-opacity ${loading ? 'opacity-40 pointer-events-none' : ''}`}>

        {/* 韵部结果 */}
        {tab === 'rhyme' && rhymeResult && (
          <div className="py-1">
            {rhymeResult.categories.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {rhymeResult.categories.map(c => (
                  <span
                    key={c.name}
                    className="inline-block px-2 py-0.5 rounded text-xs border cursor-pointer transition-colors hover:opacity-80"
                    style={{
                      color: c.tone_type === 'P' ? '#559977' : '#557799',
                      borderColor: (c.tone_type === 'P' ? '#559977' : '#557799') + '40',
                      backgroundColor: (c.tone_type === 'P' ? '#559977' : '#557799') + '10',
                    }}
                    onClick={() => dispatch({ type: 'SET_RHYME_OVERRIDE', category: c.name })}
                    title="点击切换右侧韵部面板"
                  >
                    {c.name}
                  </span>
                ))}
              </div>
            ) : (
              <div className="text-xs text-[var(--text-muted)]">无韵部信息</div>
            )}
            {rhymeResult.definitions.length > 0 && (
              <div className="mt-2 border-t border-[var(--border)] pt-1.5 space-y-1.5">
                {rhymeResult.definitions.map((reading, ri) => (
                  <div key={ri}>
                    <div className="text-[11px] text-[var(--text-muted)] font-mono">{reading.py}</div>
                    {reading.defs.map((def, di) => (
                      <div key={di} className="text-xs leading-relaxed pl-1">
                        <span className="text-[var(--text-muted)]">{'①②③④'[di] ?? `${di + 1}.`} </span>
                        <span>{def.d}</span>
                        {def.c && (
                          <div className="text-[11px] text-[var(--text-muted)] pl-3 mt-0.5 leading-snug">{def.c}</div>
                        )}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 词首/词末/对语结果（可点击填入网格） */}
        {tab !== 'rhyme' && tab !== 'allusion' && phraseResult.length > 0 && (() => {
          const isPairDisabled = (effectiveTab === 'pair' || effectiveTab === 'tongwei') && board?.genre !== 'Shi';
          // 对语点击：如果有 pairQuery.insertAt，直接写入该位置
          const handlePairClick = (word: string) => {
            if (state.pairQuery && board) {
              const start = state.pairQuery.insertAt;
              for (let i = 0; i < word.length; i++) {
                const pos = start + i;
                if (pos >= 0 && pos < board.sections[0].charCount) {
                  dispatch({ type: 'UPDATE_CHAR', index: pos, char: word[i] });
                }
              }
            } else {
              state.insertCharFn?.(word, 'pair');
            }
          };
          const clickMode = effectiveTab === 'tail' ? 'backward' as const
            : (effectiveTab === 'pair' || effectiveTab === 'tongwei') ? 'pair' as const
            : 'forward' as const;
          return (
            <div className="py-1 leading-7 text-sm break-all">
              {phraseResult.map(([word, count]) => (
                <span
                  key={word}
                  className={`inline mr-2 whitespace-nowrap rounded px-0.5 transition-colors ${isPairDisabled ? 'text-[var(--text)]' : 'cursor-pointer hover:text-[var(--accent)] hover:bg-[var(--accent-light)]'}`}
                  onClick={isPairDisabled ? undefined : () => {
                    if (effectiveTab === 'pair' || effectiveTab === 'tongwei') handlePairClick(word);
                    else state.insertCharFn?.(word, clickMode);
                  }}
                >
                  {word}<span className="text-[11px] text-[var(--text-muted)] ml-0.5">{count}</span>
                </span>
              ))}
            </div>
          );
        })()}

        {/* 典故结果 */}
        {tab === 'allusion' && hasAllusionResults && (
          <div className="py-1 leading-7 text-sm break-all">
            {allusionResult.map(entry => (
              <span
                key={entry.id}
                className="inline mr-2 whitespace-nowrap rounded px-0.5 transition-colors cursor-pointer hover:text-[var(--accent)] hover:bg-[var(--accent-light)]"
                onClick={() => setAllusionPopup(entry)}
              >
                {entry.w}
                {entry.rc > 0 && (
                  <span className="text-[11px] text-[var(--text-muted)] ml-0.5">{entry.rc}</span>
                )}
              </span>
            ))}
          </div>
        )}

        {(noResult || noAllusionResult) && (
          <div className="text-xs text-[var(--text-muted)] py-2 text-center">无结果</div>
        )}

        {!term && !loading && !rhymeResult && phraseResult.length === 0 && !hasAllusionResults && (
          <div className="text-xs text-[var(--text-muted)] py-2 text-center">输入汉字后搜索</div>
        )}
      </div>
      </div>

      {/* 典故详情弹窗 */}
      {allusionPopup && (
        <AllusionPopup
          entry={allusionPopup}
          onClose={() => setAllusionPopup(null)}
          onClickWord={(w) => {
            handleAllusionClick(w);
            setAllusionPopup(null);
          }}
        />
      )}
    </div>
  );
}
