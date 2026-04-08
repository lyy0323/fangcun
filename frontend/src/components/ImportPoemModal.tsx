import { useState } from 'react';
import { X, ArrowLeft, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { poemsSearchText, poemsGetPoem } from '../lib/api';
import { createBoard, useBoardContext } from '../context/BoardContext';
import { SHI_CHAR_COUNTS, type PoemBrief, type PoemFull } from '../lib/types';

const DYNASTIES = ['先秦', '秦', '汉', '魏晋', '南北朝', '隋', '唐', '五代', '宋', '金', '元', '明', '清', '近现代', '当代'];
const LIMIT = 20;

function SkeletonCard() {
  return (
    <div className="rounded-lg border border-[var(--border)] p-3 space-y-2 animate-pulse">
      <div className="flex items-center gap-2">
        <div className="h-4 w-24 rounded bg-[var(--border)]" />
        <div className="h-3 w-16 rounded bg-[var(--border)] opacity-60" />
      </div>
      <div className="space-y-1.5">
        <div className="h-3 w-full rounded bg-[var(--border)] opacity-40" />
        <div className="h-3 w-3/4 rounded bg-[var(--border)] opacity-40" />
      </div>
    </div>
  );
}

function SkeletonDetail() {
  return (
    <div className="space-y-4 animate-pulse">
      <div>
        <div className="h-6 w-32 rounded bg-[var(--border)]" />
        <div className="mt-2 h-3 w-24 rounded bg-[var(--border)] opacity-60" />
      </div>
      <div className="space-y-2">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="h-4 rounded bg-[var(--border)] opacity-40" style={{ width: `${85 - i * 10}%` }} />
        ))}
      </div>
      <div className="border-t border-[var(--border)] pt-4 space-y-2">
        <div className="h-3 w-40 rounded bg-[var(--border)] opacity-40" />
        <div className="h-3 w-32 rounded bg-[var(--border)] opacity-40" />
      </div>
    </div>
  );
}

export function ImportPoemModal({ onClose }: { onClose: () => void }) {
  const { dispatch } = useBoardContext();

  // 搜索状态
  const [query, setQuery] = useState('');
  const [field, setField] = useState('all');
  const [dynasty, setDynasty] = useState('');
  const [poemType, setPoemType] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searched, setSearched] = useState(false);

  // 结果 + 分页
  const [results, setResults] = useState<PoemBrief[]>([]);
  const [total, setTotal] = useState(0);
  const [totalCapped, setTotalCapped] = useState(false);
  const [offset, setOffset] = useState(0);

  // 详情
  const [selectedPoem, setSelectedPoem] = useState<PoemFull | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const doSearch = async (newOffset = 0) => {
    if (!query.trim()) return;
    setLoading(true);
    setError('');
    setOffset(newOffset);
    setSearched(true);
    setSelectedPoem(null);
    try {
      const data = await poemsSearchText(query, { field, dynasty, type: poemType, limit: LIMIT, offset: newOffset });
      setResults(data.results);
      setTotal(data.total);
      setTotalCapped(!!data.total_capped);
    } catch {
      setError('搜索失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && query.trim()) doSearch(0);
  };

  const openDetail = async (id: number) => {
    setLoadingDetail(true);
    setError('');
    try {
      const poem = await poemsGetPoem(id);
      setSelectedPoem(poem);
    } catch {
      setError('获取详情失败');
    } finally {
      setLoadingDetail(false);
    }
  };

  const doImport = (poem: PoemFull) => {
    const chars = [...poem.content].filter(c => c >= '\u4e00' && c <= '\u9fff');
    const charCount = chars.length;

    let genre: 'Shi' | 'Ci';
    let ruleName: string;
    if (poem.type === '词') {
      genre = 'Ci';
      ruleName = poem.closest_rule!;
    } else {
      genre = 'Shi';
      const shiLabel = Object.entries(SHI_CHAR_COUNTS).find(([, c]) => c === charCount)?.[0];
      ruleName = shiLabel ?? poem.closest_rule!;
    }

    const board = createBoard(genre, ruleName, charCount);
    board.title = poem.title;
    board.poemChars = chars;
    board.metadata = { ...board.metadata, author: poem.author };
    dispatch({ type: 'ADD_BOARD', board });
  };

  const totalPages = Math.ceil(total / LIMIT);
  const currentPage = Math.floor(offset / LIMIT) + 1;

  return (
    <div className="fixed inset-0 bg-[var(--overlay)] z-[60] flex items-center justify-center p-4">
      <div className="bg-[var(--bg-card)] rounded-2xl shadow-[var(--shadow)] w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
        {/* 头部 */}
        <div className="p-4 border-b border-[var(--border)] flex items-center shrink-0">
          <div className="w-8">
            {(selectedPoem || loadingDetail) && (
              <button
                className="w-6 h-6 rounded-full flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--accent-light)]"
                onClick={() => { setSelectedPoem(null); setLoadingDetail(false); }}
              >
                <ArrowLeft size={14} />
              </button>
            )}
          </div>
          <h3 className="flex-1 text-center font-semibold text-base">导入前人作品</h3>
          <div className="w-8 flex justify-end">
            <button
              className="w-6 h-6 rounded-full flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--accent-light)]"
              onClick={onClose}
            >
              <X size={14} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {/* 详情视图 */}
          {loadingDetail ? (
            <SkeletonDetail />
          ) : selectedPoem ? (
            <div className="space-y-4">
              <div>
                <h2 className="text-xl font-semibold text-[var(--text)]">{selectedPoem.title}</h2>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">
                  {selectedPoem.author}
                  {selectedPoem.dynasty && <span className="ml-1 text-[var(--text-muted)]">({selectedPoem.dynasty})</span>}
                  {selectedPoem.type && selectedPoem.type !== '未定' && (
                    <span className="ml-1.5 rounded bg-[var(--accent-light)] px-1.5 py-0.5 text-xs text-[var(--accent)]">
                      {selectedPoem.type}
                    </span>
                  )}
                </p>
              </div>

              <div className="whitespace-pre-wrap text-base leading-loose text-[var(--text)]">
                {selectedPoem.paragraphs?.length > 0
                  ? selectedPoem.paragraphs.join('\n')
                  : selectedPoem.content}
              </div>

              {/* 格律信息 */}
              <div className="space-y-2 border-t border-[var(--border)] pt-4 text-xs text-[var(--text-secondary)]">
                {selectedPoem.closest_rule && (
                  <p>
                    <span className="text-[var(--text-muted)]">格律：</span>
                    {selectedPoem.closest_rule}
                    {selectedPoem.error_count >= 0 && (
                      <span className={selectedPoem.error_count === 0 ? 'ml-2 text-green-600' : 'ml-2 text-amber-500'}>
                        {selectedPoem.error_count === 0 ? '合律' : `${selectedPoem.error_count} 处出律`}
                      </span>
                    )}
                  </p>
                )}
                {selectedPoem.rhyme_name && (
                  <p>
                    <span className="text-[var(--text-muted)]">韵部：</span>
                    {selectedPoem.rhyme_name}
                    {selectedPoem.rhyme_chars?.length > 0 && (
                      <span className="ml-2">韵字：{selectedPoem.rhyme_chars.join('、')}</span>
                    )}
                  </p>
                )}
              </div>

              {/* 导入按钮 */}
              <div className="pt-2">
                {selectedPoem.closest_rule ? (
                  <button
                    className="w-full rounded-lg bg-[var(--accent)] px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-80"
                    onClick={() => doImport(selectedPoem)}
                  >
                    导入此作品
                  </button>
                ) : (
                  <p className="text-center text-sm text-[var(--text-muted)] py-2">
                    此作品未匹配到格律规则，无法导入
                  </p>
                )}
              </div>
            </div>
          ) : (
            <>
              {/* 搜索栏 */}
              <div className="space-y-3 mb-4">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                    <input
                      type="text"
                      value={query}
                      onChange={e => setQuery(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="输入关键词，如「明月」「李白」..."
                      className="w-full rounded-lg border border-[var(--border)] bg-transparent py-2.5 pl-9 pr-3 text-sm outline-none transition-colors placeholder:text-[var(--text-muted)] focus:border-[var(--accent)]"
                      autoFocus
                    />
                  </div>
                  <button
                    onClick={() => doSearch(0)}
                    disabled={!query.trim() || loading}
                    className="rounded-lg bg-[var(--accent)] px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-80 disabled:opacity-40"
                  >
                    {loading ? '...' : '搜索'}
                  </button>
                </div>
                <div className="flex flex-wrap gap-2 text-xs">
                  <select value={field} onChange={e => setField(e.target.value)} className="rounded border border-[var(--border)] bg-transparent px-2 py-1 text-[var(--text-secondary)] outline-none">
                    <option value="all">全部字段</option>
                    <option value="title">标题</option>
                    <option value="author">作者</option>
                    <option value="content">内容</option>
                  </select>
                  <select value={dynasty} onChange={e => setDynasty(e.target.value)} className="rounded border border-[var(--border)] bg-transparent px-2 py-1 text-[var(--text-secondary)] outline-none">
                    <option value="">全部朝代</option>
                    {DYNASTIES.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                  <select value={poemType} onChange={e => setPoemType(e.target.value)} className="rounded border border-[var(--border)] bg-transparent px-2 py-1 text-[var(--text-secondary)] outline-none">
                    <option value="">全部体裁</option>
                    <option value="诗">诗</option>
                    <option value="词">词</option>
                  </select>
                </div>
              </div>

              {/* 错误 */}
              {error && <p className="text-center text-sm text-red-500 mb-3">{error}</p>}

              {/* 结果数 */}
              {total > 0 && (
                <p className="text-sm text-[var(--text-muted)] mb-3">
                  {totalCapped ? `超过 ${total.toLocaleString()} 条结果` : `共 ${total.toLocaleString()} 条结果`}
                </p>
              )}

              {/* 加载中 */}
              {loading && (
                <div className="space-y-2">
                  {[1, 2, 3].map(i => <SkeletonCard key={i} />)}
                </div>
              )}

              {/* 结果列表 */}
              {!loading && results.length > 0 && (
                <div className="space-y-2">
                  {results.map(p => (
                    <button
                      key={p.id}
                      onClick={() => openDetail(p.id)}
                      className="w-full cursor-pointer rounded-lg border border-[var(--border)] p-3 text-left transition-colors hover:border-[var(--accent)]"
                    >
                      <div className="mb-1 flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h3 className="truncate text-sm font-semibold text-[var(--text)]">{p.title}</h3>
                          <p className="text-xs text-[var(--text-secondary)]">
                            {p.author}
                            {p.dynasty && <span className="ml-1 text-[var(--text-muted)]">({p.dynasty})</span>}
                            {p.type && p.type !== '未定' && (
                              <span className="ml-1.5 rounded bg-[var(--accent-light)] px-1.5 py-0.5 text-[var(--accent)]">
                                {p.type}
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                      <p className="text-xs leading-relaxed text-[var(--text-muted)]">
                        {p.content.length > 80 ? p.content.slice(0, 80) + '...' : p.content}
                      </p>
                    </button>
                  ))}
                </div>
              )}

              {/* 分页 */}
              {!loading && totalPages > 1 && (
                <div className="flex items-center justify-center gap-3 text-sm text-[var(--text-secondary)] mt-4">
                  <button
                    onClick={() => doSearch(Math.max(0, offset - LIMIT))}
                    disabled={currentPage <= 1}
                    className="flex items-center gap-1 rounded-lg px-3 py-1.5 transition-colors hover:bg-[var(--accent-light)] hover:text-[var(--accent)] disabled:opacity-30"
                  >
                    <ChevronLeft size={14} /> 上一页
                  </button>
                  <span className="text-[var(--text-muted)]">{currentPage} / {totalPages}</span>
                  <button
                    onClick={() => doSearch(offset + LIMIT)}
                    disabled={currentPage >= totalPages}
                    className="flex items-center gap-1 rounded-lg px-3 py-1.5 transition-colors hover:bg-[var(--accent-light)] hover:text-[var(--accent)] disabled:opacity-30"
                  >
                    下一页 <ChevronRight size={14} />
                  </button>
                </div>
              )}

              {/* 空状态 */}
              {!loading && !loadingDetail && !error && results.length === 0 && (
                <div className="text-center text-sm text-[var(--text-muted)] py-12">
                  {searched ? '无结果' : '搜索历代诗词，导入到画板'}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
