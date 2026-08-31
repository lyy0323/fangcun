import { useState, useEffect } from 'react';
import { useBoardContext } from '../context/BoardContext';
import { track } from '../lib/api';
import { PenLine, SquarePlus, BookOpen, ImageDown, ChevronRight, ChevronLeft } from 'lucide-react';

// ============================================================================
// 新手引导（首次 0 作品时展示一次，可跳过）
//
// 展示条件（响应式，每次渲染派生）：boards.length === 0 且未「已看过」
// 置位「已看过」（localStorage fangcun_onboarding_dismissed）：
//   - 点「跳过」
//   - 走完引导点「开始创作」
//   - 自动：首次出现作品（经导入/次韵 URL 等旁路获得画板，删光后不再打扰）
// 淡入用 CSS 动画（onboarding-in），避免 effect 内 setState。
// ============================================================================

const KEY = 'fangcun_onboarding_dismissed';

const STEPS = [
  {
    icon: PenLine,
    title: '欢迎使用方寸',
    body: '方寸是诗词创作画布：输入诗句即实时校验平仄与押韵，写完一键出图分享。',
  },
  {
    icon: SquarePlus,
    title: '新建画板',
    body: '点击右上角「+」或下方「诗 / 词 / 文」选择体裁开始创作；一首诗可写多首组成组诗。',
  },
  {
    icon: BookOpen,
    title: '格律与韵书',
    body: '正文区实时标注平仄与韵脚；顶部可切换韵书（平水韵、词林正韵、中华通韵、上古韵），韵部面板可查同韵字。',
  },
  {
    icon: ImageDown,
    title: '出图分享',
    body: '写完从右上角菜单导出图片、复制文字或导出 Markdown，多种主题可选。',
  },
];

function readDismissed(): boolean {
  try { return localStorage.getItem(KEY) === '1'; } catch { return false; }
}

export function Onboarding() {
  const { state } = useBoardContext();
  const [step, setStep] = useState(0);
  // 仅用于「跳过/完成」后强制重渲染（dismissed 每次渲染从 localStorage 派生）
  const [, setTick] = useState(0);

  const dismissed = readDismissed();
  const hasBoards = state.boards.length > 0;
  const show = !dismissed && !hasBoards;

  // 每次真正展示计一次 show 埋点（外部系统调用，不 setState）
  useEffect(() => {
    if (show) track('onboarding_show');
  }, [show]);

  // 首次出现作品（导入/次韵 URL 等旁路）→ 自动置位，删光作品后不再弹
  useEffect(() => {
    if (!dismissed && hasBoards) {
      try { localStorage.setItem(KEY, '1'); } catch { /* ignore */ }
    }
  }, [hasBoards, dismissed]);

  const dismiss = () => {
    try { localStorage.setItem(KEY, '1'); } catch { /* ignore */ }
    setTick(t => t + 1);
  };

  if (!show) return null;

  const isLast = step === STEPS.length - 1;
  const { icon: Icon, title, body } = STEPS[step];

  const handleSkip = () => {
    dismiss();
    track('onboarding_skip');
  };

  const handleDone = () => {
    dismiss();
    track('onboarding_done');
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 animate-[onboarding-in_0.2s_ease-out]"
      style={{ backgroundColor: 'var(--overlay)' }}
      onClick={handleSkip}
    >
      <div
        className="w-full max-w-sm sm:max-w-md bg-[var(--bg-card)] rounded-2xl shadow-[var(--shadow)] animate-[onboarding-in_0.2s_ease-out]"
        onClick={e => e.stopPropagation()}
      >
        {/* 头部：步数 + 跳过 */}
        <div className="flex items-center justify-between px-5 pt-4">
          <span className="text-[11px] text-[var(--text-muted)]">{step + 1} / {STEPS.length}</span>
          <button
            className="text-xs text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors"
            onClick={handleSkip}
          >
            跳过
          </button>
        </div>

        {/* 内容 */}
        <div className="px-6 py-5 flex flex-col items-center text-center">
          <Icon size={28} className="text-[var(--accent)] mb-3" strokeWidth={1.75} />
          <h3 className="text-base font-semibold text-[var(--text)]">{title}</h3>
          <p className="mt-2 text-sm text-[var(--text-secondary)] leading-relaxed">{body}</p>
        </div>

        {/* 步骤指示 */}
        <div className="flex justify-center gap-1.5 pb-1">
          {STEPS.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all duration-200 ${i === step ? 'w-4 bg-[var(--accent)]' : 'w-1.5 bg-[var(--border)]'}`}
            />
          ))}
        </div>

        {/* 底部操作 */}
        <div className="flex items-center justify-between px-5 py-4 gap-3">
          {step > 0 ? (
            <button
              className="flex items-center gap-1 px-3 py-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text)] hover:bg-[var(--accent-light)] rounded-lg transition-colors"
              onClick={() => setStep(s => s - 1)}
            >
              <ChevronLeft size={14} /> 上一步
            </button>
          ) : <span className="w-14" />}
          {isLast ? (
            <button
              className="px-5 py-1.5 rounded-lg text-sm font-medium bg-[var(--accent)] text-white hover:opacity-90 transition-opacity"
              onClick={handleDone}
            >
              开始创作
            </button>
          ) : (
            <button
              className="flex items-center gap-1 px-5 py-1.5 rounded-lg text-sm font-medium bg-[var(--accent)] text-white hover:opacity-90 transition-opacity"
              onClick={() => setStep(s => s + 1)}
            >
              下一步 <ChevronRight size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
