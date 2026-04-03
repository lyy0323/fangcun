import { useState, useEffect } from 'react';
import { BoardProvider } from './context/BoardContext';
import { TopBar } from './components/TopBar';
import { GridEditor } from './components/GridEditor';
import { RhymePanel } from './components/RhymePanel';
import { GenreSelector } from './components/GenreSelector';
import { InspirationBoard } from './components/InspirationBoard';
import { Dictionary } from './components/Dictionary';
import { useBoardContext, useActiveBoard } from './context/BoardContext';
import { Lightbulb, BookOpen, PanelLeftClose, PanelRightClose } from 'lucide-react';
import Slides from './slides/Slides';

function MobileDrawer({ side, open, onClose, title, children }: {
  side: 'left' | 'right';
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  const isLeft = side === 'left';
  return (
    <>
      {/* 半透明遮罩 */}
      <div
        className={`lg:hidden fixed inset-0 bg-[var(--overlay)] z-40 transition-opacity duration-200 ${open ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />
      {/* 抽屉面板 */}
      <div
        className={`lg:hidden fixed top-12 bottom-0 z-50 w-[55%] max-w-[280px] bg-[var(--bg-card)] shadow-[var(--shadow)] flex flex-col transition-transform duration-250 ease-out
          ${isLeft ? 'left-0 rounded-r-xl' : 'right-0 rounded-l-xl'}
          ${open
            ? 'translate-x-0'
            : isLeft ? '-translate-x-full' : 'translate-x-full'
          }`}
      >
        {/* 头部 */}
        <div className={`flex items-center gap-2 px-3 py-2 border-b border-[var(--border)] shrink-0 ${isLeft ? '' : 'flex-row-reverse'}`}>
          <button className="w-5 h-5 rounded flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text)] shrink-0" onClick={onClose}>
            {isLeft ? <PanelLeftClose size={14} /> : <PanelRightClose size={14} />}
          </button>
          <span className="text-xs font-medium text-[var(--text)]">{title}</span>
        </div>
        {/* 内容 */}
        <div className="flex-1 overflow-y-auto p-3">
          {children}
        </div>
      </div>
    </>
  );
}

function Layout() {
  const { state } = useBoardContext();
  const board = useActiveBoard();
  const [mobilePanel, setMobilePanel] = useState<'left' | 'right' | null>(null);

  const togglePanel = (p: 'left' | 'right') => setMobilePanel(prev => prev === p ? null : p);

  // 字典韵部点击联动：移动端自动打开韵部面板
  useEffect(() => {
    if (state.rhymeOverride) setMobilePanel('right');
  }, [state.rhymeOverride]);

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <TopBar />
      {state.showGenreSelector && <GenreSelector />}
      {board && (
        <div className="flex flex-1 min-h-0 relative">
          {/* 左侧栏 — 桌面端常驻 */}
          <aside className="w-[20%] border-r border-[var(--border)] p-3 hidden lg:flex flex-col shrink-0">
            <InspirationBoard />
          </aside>

          {/* 中栏 */}
          <main className="flex-1 flex flex-col min-h-0 min-w-0">
            {/* 正文网格区 */}
            <div className="flex-1 flex flex-col items-center overflow-y-auto p-4 lg:p-6 relative">
              {/* 移动端侧边触发按钮 */}
              <button
                className="lg:hidden fixed left-3 top-14 z-20 w-8 h-8 rounded-lg bg-[var(--bg-card)] border border-[var(--border)]  flex items-center justify-center text-[var(--text-secondary)] hover:bg-[var(--accent-light)] hover:text-[var(--accent)]"
                onClick={() => togglePanel('left')}
                title="灵感板"
              >
                <Lightbulb size={16} />
              </button>
              <button
                className="lg:hidden fixed right-3 top-14 z-20 w-8 h-8 rounded-lg bg-[var(--bg-card)] border border-[var(--border)]  flex items-center justify-center text-[var(--text-secondary)] hover:bg-[var(--accent-light)] hover:text-[var(--accent)]"
                onClick={() => togglePanel('right')}
                title="韵部"
              >
                <BookOpen size={16} />
              </button>
              <GridEditor />
            </div>
            <Dictionary />
          </main>

          {/* 右侧栏 — 桌面端常驻 */}
          <aside className="w-[30%] border-l border-[var(--border)] overflow-y-auto hidden lg:block shrink-0">
            <RhymePanel />
          </aside>

          {/* 移动端侧滑抽屉 */}
          <MobileDrawer side="left" open={mobilePanel === 'left'} onClose={() => setMobilePanel(null)} title="灵感板">
            <InspirationBoard />
          </MobileDrawer>
          <MobileDrawer side="right" open={mobilePanel === 'right'} onClose={() => setMobilePanel(null)} title="韵部">
            <RhymePanel />
          </MobileDrawer>
        </div>
      )}
      {!board && !state.showGenreSelector && (
        <div className="flex-1 flex items-center justify-center text-[var(--text-muted)]">
          无画板，请点击右上角"+"新建
        </div>
      )}
    </div>
  );
}

/** 简单 hash 路由：#slides 显示产品介绍幻灯片 */
function useHashRoute() {
  const [hash, setHash] = useState(window.location.hash);
  useEffect(() => {
    const onHash = () => setHash(window.location.hash);
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  return hash;
}

export default function App() {
  const hash = useHashRoute();

  if (hash === '#slides') {
    return <Slides />;
  }

  return (
    <BoardProvider>
      <Layout />
    </BoardProvider>
  );
}
