import { useState, useEffect } from 'react';
import { useBoardContext, createBoard } from '../context/BoardContext';
import { rulesList } from '../lib/api';
import { SHI_CHAR_COUNTS, type RuleListItem } from '../lib/types';
import { X, ArrowLeft } from 'lucide-react';
import { ImportPoemModal } from './ImportPoemModal';

export function GenreSelector() {
  const { state, dispatch } = useBoardContext();
  const [step, setStep] = useState<'genre' | 'shi' | 'ci'>('genre');
  const [ciRules, setCiRules] = useState<RuleListItem[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [showImport, setShowImport] = useState(false);

  useEffect(() => {
    if (step === 'ci' && ciRules.length === 0) {
      setLoading(true);
      rulesList('Ci').then(r => { setCiRules(r); setLoading(false); }).catch(() => setLoading(false));
    }
  }, [step, ciRules.length]);

  const selectShi = (label: string) => {
    const charCount = SHI_CHAR_COUNTS[label];
    const board = createBoard('Shi', label, charCount);
    dispatch({ type: 'ADD_BOARD', board });
  };

  const selectCi = (rule: RuleListItem) => {
    const board = createBoard('Ci', rule.name, rule.char_count);
    dispatch({ type: 'ADD_BOARD', board });
  };

  const [showCount, setShowCount] = useState(100);
  const filtered = ciRules.filter(r => r.name.includes(search));
  const hasMore = filtered.length > showCount;

  // 搜索词变化时重置显示数量
  const handleSearchChange = (val: string) => {
    setSearch(val);
    setShowCount(100);
  };

  const randomLongpu = () => {
    const longpu = ciRules.filter(r => r.name.includes('龙谱'));
    if (longpu.length === 0) return;
    const pick = longpu[Math.floor(Math.random() * longpu.length)];
    // 提取词牌名前缀（去掉 _龙谱_格X）填入搜索框，让用户自行选择
    const cipai = pick.name.split('_')[0];
    handleSearchChange(cipai);
  };

  return (
    <div className="fixed inset-0 bg-[var(--overlay)] z-50 flex items-center justify-center p-4">
      <div className="bg-[var(--bg-card)] rounded-2xl shadow-[var(--shadow)] w-full max-w-md max-h-[80vh] flex flex-col overflow-hidden">
        {/* 头部 */}
        <div className="p-4 border-b border-[var(--border)] flex items-center">
          {/* 左侧：返回或占位 */}
          <div className="w-8">
            {step !== 'genre' && (
              <button className="w-6 h-6 rounded-full flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--accent-light)]" onClick={() => setStep('genre')}>
                <ArrowLeft size={14} />
              </button>
            )}
          </div>
          {/* 标题居中 */}
          <h3 className="flex-1 text-center font-semibold text-base">
            {step === 'genre' ? '选择体裁' : step === 'shi' ? '选择诗体' : '选择词牌'}
          </h3>
          {/* 右侧：关闭或占位 */}
          <div className="w-8 flex justify-end">
            {state.boards.length > 0 && (
              <button
                className="w-6 h-6 rounded-full flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--accent-light)]"
                onClick={() => dispatch({ type: 'SHOW_GENRE_SELECTOR', show: false })}
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        <div className="p-4 flex-1 overflow-y-auto">
          {/* 第一步: 诗/词 */}
          {step === 'genre' && (
            <div className="flex flex-col items-center py-8">
              <div className="flex gap-3 justify-center flex-wrap">
                <button
                  className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl border-2 border-[var(--border)] hover:border-[var(--accent)] hover:bg-[var(--accent-light)] flex flex-col items-center justify-center gap-2 transition-all"
                  onClick={() => setStep('shi')}
                >
                  <span className="text-3xl">诗</span>
                  <span className="text-xs text-[var(--text-secondary)]">绝句·律诗</span>
                </button>
                <button
                  className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl border-2 border-[var(--border)] hover:border-[var(--accent)] hover:bg-[var(--accent-light)] flex flex-col items-center justify-center gap-2 transition-all"
                  onClick={() => setStep('ci')}
                >
                  <span className="text-3xl">词</span>
                  <span className="text-xs text-[var(--text-secondary)]">词牌</span>
                </button>
                <button
                  className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl border-2 border-[var(--border)] hover:border-[var(--accent)] hover:bg-[var(--accent-light)] flex flex-col items-center justify-center gap-2 transition-all"
                  onClick={() => {
                    const board = createBoard('Free', '自由', 0);
                    dispatch({ type: 'ADD_BOARD', board });
                  }}
                >
                  <span className="text-3xl">文</span>
                  <span className="text-xs text-[var(--text-secondary)]">自由诗</span>
                </button>
              </div>
              <button
                className="mt-6 text-xs text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors"
                onClick={() => setShowImport(true)}
              >
                导入前人作品
              </button>
            </div>
          )}

          {/* 第二步(诗): 五律/七律/五绝/七绝 */}
          {step === 'shi' && (
            <div className="grid grid-cols-2 gap-3 py-4">
              {Object.entries(SHI_CHAR_COUNTS).map(([label, count]) => (
                <button
                  key={label}
                  className="h-16 rounded-xl border-2 border-[var(--border)] hover:border-[var(--accent)] hover:bg-[var(--accent-light)] flex flex-col items-center justify-center transition-all"
                  onClick={() => selectShi(label)}
                >
                  <span className="font-semibold">{label}</span>
                  <span className="text-xs text-[var(--text-muted)]">{count}字</span>
                </button>
              ))}
              <button
                className="h-16 rounded-xl border-2 border-dashed border-[var(--border)] hover:border-[var(--accent)] hover:bg-[var(--accent-light)] flex flex-col items-center justify-center transition-all"
                onClick={() => {
                  const board = createBoard('Free', '古体诗', 0, '古体诗');
                  dispatch({ type: 'ADD_BOARD', board });
                }}
              >
                <span className="font-semibold">古体诗</span>
                <span className="text-xs text-[var(--text-muted)]">不限格律</span>
              </button>
            </div>
          )}

          {/* 第二步(词): 搜索 + 列表 */}
          {step === 'ci' && (
            <>
              <input
                className="w-full h-10 border border-[var(--grid-empty-border)] rounded-lg px-3 text-sm mb-3 outline-none focus:border-[var(--accent)]"
                placeholder="搜索词牌名..."
                value={search}
                onChange={e => handleSearchChange(e.target.value)}
                autoFocus
              />
              {loading && <div className="text-center text-[var(--text-muted)] py-8">加载中...</div>}
              <div className="space-y-1 max-h-[50vh]">
                {/* 随机一个（仅搜索框为空时显示） */}
                {!loading && !search && ciRules.length > 0 && (
                  <button
                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-amber-50 flex items-center gap-2 text-sm border border-dashed border-amber-300 mb-2"
                    onClick={randomLongpu}
                  >
                    <span className="text-amber-500">🎲</span>
                    <span className="text-amber-700">随机一个词牌</span>
                  </button>
                )}
                {filtered.slice(0, showCount).map(r => (
                  <button
                    key={r.name}
                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-[var(--accent-light)] flex justify-between items-center text-sm"
                    onClick={() => selectCi(r)}
                  >
                    <span>{r.name}</span>
                    <span className="text-[var(--text-muted)] text-xs">{r.char_count}字</span>
                  </button>
                ))}
                {/* 加载更多 */}
                {!loading && hasMore && (
                  <button
                    className="w-full py-2 text-center text-sm text-[var(--accent)] hover:text-[var(--accent)] hover:bg-[var(--accent-light)] rounded-lg"
                    onClick={() => setShowCount(prev => prev + 100)}
                  >
                    加载更多（还有 {filtered.length - showCount} 个）
                  </button>
                )}
                {!loading && filtered.length === 0 && (
                  <div className="text-center text-[var(--text-muted)] py-4">未找到匹配词牌</div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
      {showImport && <ImportPoemModal onClose={() => setShowImport(false)} />}
    </div>
  );
}
