import { useState, useEffect, useCallback, useRef } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Music,
  BookOpen,
  Sparkles,
  PenTool,
  Lightbulb,
  Layers,
  Smartphone,
  Zap,
  ExternalLink,
  AlertCircle,
  Search,
  Replace,
  Clock,
  Image,
  Calendar,
  BookMarked,
  Globe,
  Download,
} from 'lucide-react';

/* ───────────── 常量 ───────────── */
const TOTAL_SLIDES = 16;
const TRANSITION_MS = 500;
const SITE_URL = 'http://write.sjtuguoxue.space';
const SOCIETY_URL = 'http://sjtuguoxue.space/';

/* ───────────── 辅助组件 ───────────── */

/** 韵部标签 */
function RhymeTag({ label, active }: { label: string; active?: boolean }) {
  return (
    <span
      className={`px-2 py-0.5 rounded-full text-xs transition-all duration-300
        ${active
          ? 'bg-[var(--accent)] text-white scale-105'
          : 'bg-[var(--accent-light)] text-[var(--accent)]'
        }`}
    >
      {label}
    </span>
  );
}

/** 动画包裹器：元素进入时从下方淡入 */
function FadeUp({ delay = 0, children, className = '' }: { delay?: number; children: React.ReactNode; className?: string }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setShow(true), delay);
    return () => clearTimeout(t);
  }, [delay]);
  return (
    <div
      className={`transition-all duration-700 ease-out ${className} ${show ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}
    >
      {children}
    </div>
  );
}

/** 特性卡片 */
function FeatureCard({ icon, title, desc, delay = 0 }: { icon: React.ReactNode; title: string; desc: string; delay?: number }) {
  return (
    <FadeUp delay={delay} className="flex-1 min-w-[200px]">
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-5 h-full shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300">
        <div className="w-10 h-10 rounded-lg bg-[var(--accent-light)] flex items-center justify-center text-[var(--accent)] mb-3">
          {icon}
        </div>
        <h3 className="text-sm font-semibold text-[var(--text)] mb-1.5">{title}</h3>
        <p className="text-xs text-[var(--text-secondary)] leading-relaxed">{desc}</p>
      </div>
    </FadeUp>
  );
}

/** 带数字高亮的统计项 */
function StatItem({ number, label, delay = 0 }: { number: string; label: string; delay?: number }) {
  return (
    <FadeUp delay={delay} className="text-center">
      <div className="text-3xl sm:text-4xl font-bold text-[var(--accent)] mb-1">{number}</div>
      <div className="text-xs text-[var(--text-secondary)]">{label}</div>
    </FadeUp>
  );
}

/* ───────────── 各页幻灯片 ───────────── */

/** 0. 封面 */
function SlideCover() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-6">
      <FadeUp>
        <div className="text-5xl sm:text-7xl mb-2 select-none">🖊️</div>
      </FadeUp>
      <FadeUp delay={200}>
        <h1 className="text-2xl sm:text-4xl font-bold text-[var(--text)] tracking-wide">
          南洋吟游 <span className="text-[var(--accent)]">·</span> 方寸 <span className="text-[var(--accent)]">·</span> 诗词创作画布
        </h1>
      </FadeUp>
      <FadeUp delay={400}>
        <p className="mt-4 text-sm sm:text-base text-[var(--text-secondary)] max-w-md leading-relaxed">
          一个专为古典诗词创作者打造的沉浸式写作工具
        </p>
      </FadeUp>
      <FadeUp delay={600}>
        <p className="mt-8 text-xs text-[var(--text-muted)] italic">
          落花风雨更伤春，不如怜取眼前人。
        </p>
      </FadeUp>
      <FadeUp delay={800}>
        <div className="mt-8 flex items-center gap-2 text-xs text-[var(--text-muted)]">
          <span>按</span>
          <kbd className="px-2 py-0.5 rounded bg-[var(--bg-card)] border border-[var(--border)] text-[var(--text-secondary)] font-mono">→</kbd>
          <span>或点击右侧箭头开始</span>
        </div>
      </FadeUp>
    </div>
  );
}

/** 1. 痛点 */
function SlidePainPoints() {
  const pains = [
    { icon: <AlertCircle size={18} />, text: '写到一半忘了哪个字出律，翻来覆去数平仄' },
    { icon: <BookOpen size={18} />, text: '为了查韵书来回切换，回来已经忘了灵感' },
    { icon: <PenTool size={18} />, text: '想推敲一个字，却没有趁手的暂存方案' },
    { icon: <Smartphone size={18} />, text: '手机上偶得佳句，苦于没有好用的移动端工具' },
  ];
  return (
    <div className="flex flex-col items-center justify-center h-full px-6">
      <FadeUp>
        <h2 className="text-xl sm:text-2xl font-bold text-[var(--text)] mb-2 text-center">
          写诗填词时，你是否经历过……
        </h2>
      </FadeUp>
      <FadeUp delay={200}>
        <p className="text-sm text-[var(--text-secondary)] mb-8 text-center">创作者的四大烦恼</p>
      </FadeUp>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-xl w-full">
        {pains.map((p, i) => (
          <FadeUp key={i} delay={300 + i * 150}>
            <div className="flex items-start gap-3 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-4 shadow-sm">
              <div className="w-8 h-8 rounded-lg bg-red-50 dark:bg-red-950/40 flex items-center justify-center text-red-500 dark:text-red-400 shrink-0 mt-0.5">
                {p.icon}
              </div>
              <p className="text-sm text-[var(--text)] leading-relaxed">{p.text}</p>
            </div>
          </FadeUp>
        ))}
      </div>
      <FadeUp delay={1000}>
        <p className="mt-8 text-sm text-[var(--accent)] font-medium text-center">
          我们把这一切，融合到了同一个界面里 →
        </p>
      </FadeUp>
    </div>
  );
}

/** 2. 一览功能 */
function SlideOverview() {
  return (
    <div className="flex flex-col items-center justify-center h-full px-6">
      <FadeUp>
        <h2 className="text-xl sm:text-2xl font-bold text-[var(--text)] mb-6 text-center">一个界面，所有你需要的</h2>
      </FadeUp>
      <div className="flex flex-wrap gap-4 justify-center max-w-2xl">
        <FeatureCard icon={<Music size={20} />} title="实时格律检测" desc="每输入一字即刻校验，出律标红" delay={200} />
        <FeatureCard icon={<BookOpen size={20} />} title="智能韵部推断" desc="填入韵脚字，自动匹配韵部和同韵字" delay={350} />
        <FeatureCard icon={<Search size={20} />} title="多功能字典" desc="韵部·词首·词末·对语，四合一查询" delay={500} />
        <FeatureCard icon={<Replace size={20} />} title="推敲炼字" desc="为每个字位添加备选，一键替换" delay={650} />
        <FeatureCard icon={<Lightbulb size={20} />} title="灵感板" desc="文字+图片碎片随手记录" delay={800} />
        <FeatureCard icon={<Layers size={20} />} title="多画板管理" desc="多首作品并行创作，一键切换" delay={950} />
      </div>
    </div>
  );
}

/** 3. 实时格律检测 */
function SlideMeter() {
  return (
    <div className="flex flex-col items-center justify-center h-full px-6">
      <FadeUp>
        <h2 className="text-xl sm:text-2xl font-bold text-[var(--text)] mb-2 text-center">实时格律检测</h2>
      </FadeUp>
      <FadeUp delay={150}>
        <p className="text-sm text-[var(--text-secondary)] mb-6 text-center max-w-md">
          每输入一个字，系统即刻检测全篇格律。出律的字<span className="text-red-500 font-medium">标红</span>显示，每个位置上方标注应有的平仄。
        </p>
      </FadeUp>

      {/* 真实截图 */}
      <FadeUp delay={350}>
        <div className="rounded-2xl overflow-hidden shadow-2xl border border-[var(--border)] max-w-2xl">
          <img
            src="/slides/desktop-demo.png"
            alt="格律检测真实界面"
            className="w-full h-auto"
          />
        </div>
      </FadeUp>

      <FadeUp delay={600}>
        <div className="mt-5 flex flex-wrap justify-center gap-3 text-xs">
          <span className="px-3 py-1 rounded-full bg-[var(--accent-light)] text-[var(--accent)]">五绝 / 七绝</span>
          <span className="px-3 py-1 rounded-full bg-[var(--accent-light)] text-[var(--accent)]">五律 / 七律</span>
          <span className="px-3 py-1 rounded-full bg-[var(--accent-light)] text-[var(--accent)]">819 词牌</span>
          <span className="px-3 py-1 rounded-full bg-[var(--accent-light)] text-[var(--accent)]">2536 种格式</span>
        </div>
      </FadeUp>
    </div>
  );
}

/** 4. 智能韵部 */
function SlideRhyme() {
  const rhymeChars = ['心', '金', '任', '南', '今', '深', '林', '参', '临', '音', '禁', '森', '沉', '阴', '针', '琴', '寻', '侵'];
  return (
    <div className="flex flex-col items-center justify-center h-full px-6">
      <FadeUp>
        <h2 className="text-xl sm:text-2xl font-bold text-[var(--text)] mb-2 text-center">智能韵部推断</h2>
      </FadeUp>
      <FadeUp delay={150}>
        <p className="text-sm text-[var(--text-secondary)] mb-8 text-center max-w-md">
          填入韵脚字后，自动显示韵部和全部同韵字——按词频排序，常用字在前。
        </p>
      </FadeUp>

      <FadeUp delay={350}>
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5 sm:p-8 shadow-lg max-w-sm w-full">
          {/* 模拟韵部面板 */}
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xs text-[var(--text-muted)]">检测到韵脚字：</span>
            <span className="w-8 h-8 rounded-md bg-[var(--accent-light)] border border-[var(--accent)] text-[var(--accent)] flex items-center justify-center text-sm font-medium">南</span>
          </div>
          <div className="flex items-center gap-2 mb-4">
            <RhymeTag label="十二侵" active />
            <RhymeTag label="十三覃" />
            <RhymeTag label="邻韵" />
          </div>
          <div className="border-t border-[var(--border)] pt-3">
            <p className="text-xs text-[var(--text-muted)] mb-2">十二侵 · 同韵字（按词频）：</p>
            <div className="flex flex-wrap gap-1.5">
              {rhymeChars.map((c, i) => (
                <FadeUp key={i} delay={450 + i * 50}>
                  <span
                    className={`w-7 h-7 rounded text-xs flex items-center justify-center cursor-pointer transition-all duration-200
                      ${c === '南'
                        ? 'bg-[var(--accent)] text-white shadow-sm'
                        : 'bg-[var(--bg)] border border-[var(--border)] text-[var(--text)] hover:border-[var(--accent)] hover:text-[var(--accent)]'
                      }`}
                  >
                    {c}
                  </span>
                </FadeUp>
              ))}
              <span className="w-7 h-7 rounded text-xs flex items-center justify-center text-[var(--text-muted)]">…</span>
            </div>
          </div>
        </div>
      </FadeUp>

      <FadeUp delay={1100}>
        <div className="mt-6 flex gap-6 text-center">
          <div>
            <div className="text-lg font-bold text-[var(--accent)]">106</div>
            <div className="text-xs text-[var(--text-secondary)]">平水韵韵部</div>
          </div>
          <div>
            <div className="text-lg font-bold text-[var(--accent)]">18</div>
            <div className="text-xs text-[var(--text-secondary)]">词林正韵韵部</div>
          </div>
        </div>
      </FadeUp>
    </div>
  );
}

/** 5. 多功能字典 */
function SlideDictionary() {
  const modes = [
    { name: '韵部', example: '"花" → 下平六麻', color: 'bg-purple-50 dark:bg-purple-950/30 text-purple-600 dark:text-purple-400' },
    { name: '词首', example: '"花" → 花开、花落、花间…', color: 'bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400' },
    { name: '词末', example: '"花" → 梅花、落花、桃花…', color: 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400' },
    { name: '对语', example: '"明月" → 白云、清风、夕阳…', color: 'bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400' },
  ];
  return (
    <div className="flex flex-col items-center justify-center h-full px-6">
      <FadeUp>
        <h2 className="text-xl sm:text-2xl font-bold text-[var(--text)] mb-2 text-center">多功能字典</h2>
      </FadeUp>
      <FadeUp delay={150}>
        <p className="text-sm text-[var(--text-secondary)] mb-8 text-center max-w-md">
          四种查询模式一体化，结果可点击直接填入正文。
        </p>
      </FadeUp>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-lg w-full">
        {modes.map((m, i) => (
          <FadeUp key={i} delay={300 + i * 150}>
            <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
              <div className={`inline-block px-2 py-0.5 rounded-md text-xs font-medium mb-2 ${m.color}`}>
                {m.name}
              </div>
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed">{m.example}</p>
            </div>
          </FadeUp>
        ))}
      </div>

      <FadeUp delay={1100}>
        <div className="mt-6 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl px-4 py-3 flex items-center gap-3 text-xs text-[var(--text-secondary)] shadow-sm">
          <Sparkles size={14} className="text-[var(--accent)] shrink-0" />
          <span>
            对语数据来自 <strong className="text-[var(--text)]">95,992</strong> 首唐宋律诗，确保每条对仗都有真实诗作背书
          </span>
        </div>
      </FadeUp>
    </div>
  );
}

/** 6. 推敲炼字 */
function SlideRefine() {
  const candidates = ['寒', '冷', '秋', '清', '凉'];
  return (
    <div className="flex flex-col items-center justify-center h-full px-6">
      <FadeUp>
        <h2 className="text-xl sm:text-2xl font-bold text-[var(--text)] mb-2 text-center">推敲炼字</h2>
      </FadeUp>
      <FadeUp delay={150}>
        <p className="text-sm text-[var(--text-secondary)] mb-8 text-center max-w-md">
          为任何一个字位添加备选方案，点击即可替换，原字自动进入候选列表。
        </p>
      </FadeUp>

      <FadeUp delay={350}>
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-6 sm:p-8 shadow-lg">
          {/* 正文字 */}
          <div className="flex items-end gap-2 mb-3">
            <span className="text-xs text-[var(--text-muted)] self-center mr-1">正文</span>
            {['独', '钓'].map((c, i) => (
              <span key={i} className="w-11 h-11 rounded-md bg-[var(--bg)] border border-[var(--border)] flex items-center justify-center text-lg font-medium text-[var(--text)]">
                {c}
              </span>
            ))}
            <span className="w-11 h-11 rounded-md bg-[var(--accent-light)] border-2 border-[var(--accent)] flex items-center justify-center text-lg font-medium text-[var(--accent)] relative">
              寒
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-[var(--accent)] rounded-full animate-ping opacity-75" />
            </span>
            {['江', '雪'].map((c, i) => (
              <span key={i} className="w-11 h-11 rounded-md bg-[var(--bg)] border border-[var(--border)] flex items-center justify-center text-lg font-medium text-[var(--text)]">
                {c}
              </span>
            ))}
          </div>
          {/* 候选字 */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--text-muted)] mr-1">候选</span>
            <div className="w-[88px]" /> {/* 占位 */}
            <div className="flex gap-1.5">
              {candidates.map((c, i) => (
                <FadeUp key={i} delay={700 + i * 100}>
                  <span
                    className={`w-8 h-8 rounded text-sm flex items-center justify-center cursor-pointer transition-all duration-200
                      ${i === 0
                        ? 'bg-[var(--accent)] text-white ring-2 ring-[var(--accent)] ring-offset-1 ring-offset-[var(--bg-card)]'
                        : 'bg-[var(--bg)] border border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--accent)] hover:text-[var(--accent)]'
                      }`}
                  >
                    {c}
                  </span>
                </FadeUp>
              ))}
            </div>
          </div>
          <div className="mt-4 text-center text-xs text-[var(--text-muted)]">
            ↕ 点击候选字即可替换正文，原字自动归入候选
          </div>
        </div>
      </FadeUp>

      <FadeUp delay={1300}>
        <p className="mt-6 text-xs text-[var(--text-secondary)]">
          每个位置最多 <strong className="text-[var(--text)]">5</strong> 个候选字
        </p>
      </FadeUp>
    </div>
  );
}

/** 7. 灵感板 */
function SlideInspiration() {
  return (
    <div className="flex flex-col items-center justify-center h-full px-6">
      <FadeUp>
        <h2 className="text-xl sm:text-2xl font-bold text-[var(--text)] mb-2 text-center">灵感板</h2>
      </FadeUp>
      <FadeUp delay={150}>
        <p className="text-sm text-[var(--text-secondary)] mb-8 text-center max-w-md">
          创作过程中的碎片想法随手记录，文字+图片，永远不怕灵感溜走。
        </p>
      </FadeUp>

      <FadeUp delay={350}>
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5 shadow-lg max-w-sm w-full">
          {/* 模拟灵感板 */}
          <div className="text-xs font-medium text-[var(--text)] mb-3 flex items-center gap-1.5">
            <Lightbulb size={12} className="text-[var(--accent)]" />
            灵感板
          </div>

          <div className="space-y-2.5">
            {/* 文本笔记 */}
            <FadeUp delay={600}>
              <div className="bg-[var(--bg)] rounded-lg p-3 text-xs text-[var(--text-secondary)] leading-relaxed border border-[var(--border)]">
                秋日登高远望，层林尽染，<br />
                可用"霜叶红于二月花"意象。<br />
                <span className="text-[var(--text-muted)] italic">——白居易诗中也有类似意境</span>
              </div>
            </FadeUp>

            {/* 图片笔记模拟 */}
            <FadeUp delay={800}>
              <div className="bg-[var(--bg)] rounded-lg p-3 border border-[var(--border)]">
                <div className="w-full h-20 rounded-md bg-gradient-to-br from-amber-100 to-orange-200 dark:from-amber-900/30 dark:to-orange-800/30 flex items-center justify-center text-3xl">
                  🍂
                </div>
                <p className="text-xs text-[var(--text-muted)] mt-2">Ctrl+V 粘贴 / 点击上传</p>
              </div>
            </FadeUp>

            {/* 另一条文本 */}
            <FadeUp delay={1000}>
              <div className="bg-[var(--bg)] rounded-lg p-3 text-xs text-[var(--text-secondary)] leading-relaxed border border-[var(--border)]">
                韵脚备选：风/松/空/翁/中
              </div>
            </FadeUp>
          </div>
        </div>
      </FadeUp>

      <FadeUp delay={1200}>
        <p className="mt-6 text-xs text-[var(--text-secondary)] text-center">
          每个画板拥有独立的灵感板，切换时自动跟随
        </p>
      </FadeUp>
    </div>
  );
}

/** 8. 多画板 */
function SlideMultiBoard() {
  const boards = [
    { name: '秋思', genre: '七律', chars: '4/56', active: true },
    { name: '咏梅', genre: '七绝', chars: '28/28', active: false },
    { name: '水调歌头', genre: '词', chars: '12/95', active: false },
  ];
  return (
    <div className="flex flex-col items-center justify-center h-full px-6">
      <FadeUp>
        <h2 className="text-xl sm:text-2xl font-bold text-[var(--text)] mb-2 text-center">多画板管理</h2>
      </FadeUp>
      <FadeUp delay={150}>
        <p className="text-sm text-[var(--text-secondary)] mb-8 text-center max-w-md">
          同时维护多首作品，独立保存体裁、正文、候选项和灵感，一键切换。
        </p>
      </FadeUp>

      <div className="flex flex-col gap-2.5 max-w-xs w-full">
        {boards.map((b, i) => (
          <FadeUp key={i} delay={400 + i * 200}>
            <div
              className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all duration-300
                ${b.active
                  ? 'bg-[var(--accent-light)] border-[var(--accent)] shadow-md'
                  : 'bg-[var(--bg-card)] border-[var(--border)] shadow-sm hover:shadow-md'
                }`}
            >
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold
                  ${b.active ? 'bg-[var(--accent)] text-white' : 'bg-[var(--bg)] text-[var(--text-secondary)]'}`}
              >
                {b.name[0]}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-[var(--text)] truncate">{b.name}</div>
                <div className="text-xs text-[var(--text-muted)]">{b.genre} · {b.chars} 字</div>
              </div>
              {b.active && (
                <span className="w-2 h-2 rounded-full bg-[var(--accent)] animate-pulse" />
              )}
            </div>
          </FadeUp>
        ))}

        <FadeUp delay={1000}>
          <div className="flex items-center justify-center gap-1.5 py-2 rounded-xl border border-dashed border-[var(--border)] text-[var(--text-muted)] text-xs cursor-pointer hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors">
            + 新建画板
          </div>
        </FadeUp>
      </div>
    </div>
  );
}

/** 9. 移动端 */
function SlideMobile() {
  return (
    <div className="flex flex-col items-center justify-center h-full px-6">
      <FadeUp>
        <h2 className="text-xl sm:text-2xl font-bold text-[var(--text)] mb-2 text-center">移动端完美适配</h2>
      </FadeUp>
      <FadeUp delay={150}>
        <p className="text-sm text-[var(--text-secondary)] mb-6 text-center max-w-md">
          手机和平板上完整可用，随时随地捕捉灵感。
        </p>
      </FadeUp>

      {/* 手机真实截图 */}
      <FadeUp delay={350}>
        <div className="relative w-52 sm:w-64 bg-[var(--text)] rounded-[2.5rem] p-2.5 shadow-2xl">
          {/* 刘海 */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-6 bg-[var(--text)] rounded-b-2xl z-10" />
          {/* 屏幕 */}
          <div className="w-full rounded-[2rem] overflow-hidden">
            <img
              src="/slides/mobile-demo.png"
              alt="移动端真实界面"
              className="w-full h-auto block"
            />
          </div>
        </div>
      </FadeUp>

      <FadeUp delay={700}>
        <div className="mt-5 flex flex-wrap gap-3 justify-center text-xs">
          <span className="px-3 py-1 rounded-full bg-[var(--bg-card)] border border-[var(--border)] text-[var(--text-secondary)]">
            自适应网格缩放
          </span>
          <span className="px-3 py-1 rounded-full bg-[var(--bg-card)] border border-[var(--border)] text-[var(--text-secondary)]">
            侧滑抽屉面板
          </span>
          <span className="px-3 py-1 rounded-full bg-[var(--bg-card)] border border-[var(--border)] text-[var(--text-secondary)]">
            拼音输入法支持
          </span>
        </div>
      </FadeUp>
    </div>
  );
}

/** 10. 技术亮点 + 数据 */
function SlideTech() {
  return (
    <div className="flex flex-col items-center justify-center h-full px-6">
      <FadeUp>
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--accent-light)] text-[var(--accent)] text-xs font-medium mb-4">
          <Zap size={14} /> 技术亮点
        </div>
      </FadeUp>
      <FadeUp delay={150}>
        <h2 className="text-xl sm:text-2xl font-bold text-[var(--text)] mb-8 text-center">匠心打造的底层技术</h2>
      </FadeUp>

      {/* 数据统计 */}
      <div className="flex flex-wrap gap-8 sm:gap-12 justify-center mb-10">
        <StatItem number="185,873" label="首诗词语料" delay={300} />
        <StatItem number="819" label="个词牌" delay={450} />
        <StatItem number="95,992" label="首对仗来源" delay={600} />
        <StatItem number="~260KB" label="前端体积" delay={750} />
      </div>

      {/* 技术特性 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-lg w-full">
        {[
          { title: '递归 AST 格律引擎', desc: '支持邻韵、叶韵、换韵等复杂规则' },
          { title: '零延迟输入', desc: '隐藏 input + 虚拟光标，完美支持 IME' },
          { title: '纯前端持久化', desc: 'localStorage 存储，无需注册账号' },
          { title: '轻量部署', desc: 'Vercel Serverless，数据预处理零重型依赖' },
        ].map((t, i) => (
          <FadeUp key={i} delay={800 + i * 150}>
            <div className="flex items-start gap-2.5 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-3.5 shadow-sm">
              <Zap size={14} className="text-[var(--accent)] mt-0.5 shrink-0" />
              <div>
                <div className="text-xs font-semibold text-[var(--text)] mb-0.5">{t.title}</div>
                <div className="text-xs text-[var(--text-secondary)]">{t.desc}</div>
              </div>
            </div>
          </FadeUp>
        ))}
      </div>
    </div>
  );
}

/** 11. CTA */
function SlideCTA() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-6">
      <FadeUp>
        <div className="text-5xl sm:text-7xl mb-4 select-none">✨</div>
      </FadeUp>
      <FadeUp delay={200}>
        <h2 className="text-2xl sm:text-3xl font-bold text-[var(--text)] mb-3">开始你的创作之旅</h2>
      </FadeUp>
      <FadeUp delay={400}>
        <p className="text-sm text-[var(--text-secondary)] max-w-md leading-relaxed mb-8">
          把格律检测、韵书查阅、用词参考和灵感记录融合在同一个界面，
          <br />
          让你专注于创作本身。
        </p>
      </FadeUp>
      <FadeUp delay={600}>
        <a
          href={SITE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[var(--accent)] text-white text-sm font-medium shadow-lg hover:bg-[var(--accent-hover)] hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300"
        >
          立即体验 <ExternalLink size={14} />
        </a>
      </FadeUp>
      <FadeUp delay={700}>
        <p className="mt-2 text-xs text-[var(--text-muted)]">
          {SITE_URL}
        </p>
      </FadeUp>
      <FadeUp delay={900}>
        <div className="mt-10 flex flex-col items-center gap-1.5">
          <p className="text-xs text-[var(--text-muted)]">
            <a href={SOCIETY_URL} target="_blank" rel="noopener noreferrer" className="text-[var(--accent)] hover:underline">上海交大国学社</a>
            {' '}· 南洋吟游诗社 出品
          </p>
        </div>
      </FadeUp>
    </div>
  );
}

/** 12. 近期更新总览 (v1.2–v1.6) */
function SlideRecentUpdates() {
  const updates = [
    { ver: 'v1.2', title: '开放 API & CLI', desc: '7 个 HTTP 端点 + fangcun 命令行工具', icon: <Globe size={16} /> },
    { ver: 'v1.3', title: '图片导出', desc: 'Canvas 渲染诗词卡片，8 套配色方案', icon: <Image size={16} /> },
    { ver: 'v1.4', title: '元数据 & 中华通韵', desc: '序·脚注·农历日期 + 第三套韵书接入', icon: <Calendar size={16} /> },
    { ver: 'v1.5', title: '典故检索 & UI 统一', desc: '13,000 条典形词 + 全局样式统一', icon: <BookMarked size={16} /> },
    { ver: 'v1.6', title: '导入前人作品', desc: '80 万首历代诗词库搜索导入', icon: <Download size={16} /> },
  ];
  return (
    <div className="flex flex-col items-center justify-center h-full px-6">
      <FadeUp>
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--accent-light)] text-[var(--accent)] text-xs font-medium mb-4">
          <Clock size={14} /> 近期更新
        </div>
      </FadeUp>
      <FadeUp delay={150}>
        <h2 className="text-xl sm:text-2xl font-bold text-[var(--text)] mb-8 text-center">v1.2 – v1.6 功能速览</h2>
      </FadeUp>
      <div className="flex flex-col gap-3 max-w-md w-full">
        {updates.map((u, i) => (
          <FadeUp key={i} delay={300 + i * 150}>
            <div className="flex items-center gap-3 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl px-4 py-3 shadow-sm hover:shadow-md transition-shadow">
              <div className="w-8 h-8 rounded-lg bg-[var(--accent-light)] flex items-center justify-center text-[var(--accent)] shrink-0">
                {u.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-[var(--accent)]">{u.ver}</span>
                  <span className="text-sm font-semibold text-[var(--text)]">{u.title}</span>
                </div>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">{u.desc}</p>
              </div>
            </div>
          </FadeUp>
        ))}
      </div>
    </div>
  );
}

/** 13. 诗词卡片导出 */
function SlideExport() {
  /* 复用 exportImage.ts 的 8 套真实配色 */
  const themes: { name: string; bg: string }[] = [
    { name: '素白', bg: '#FAFAF8' },
    { name: '朱砂', bg: '#FDF6F0' },
    { name: '墨韵', bg: '#1A1A1A' },
    { name: '竹青', bg: '#F4F7F0' },
    { name: '藏蓝', bg: '#F0F2F7' },
    { name: '烟紫', bg: '#F5F0F7' },
    { name: '秋棠', bg: '#FBF5EE' },
    { name: '霜灰', bg: '#F2F2F0' },
  ];
  return (
    <div className="flex flex-col items-center justify-center h-full px-6">
      <FadeUp>
        <h2 className="text-xl sm:text-2xl font-bold text-[var(--text)] mb-2 text-center">诗词卡片导出</h2>
      </FadeUp>
      <FadeUp delay={150}>
        <p className="text-sm text-[var(--text-secondary)] mb-8 text-center max-w-md">
          Canvas 渲染精美诗词卡片，一键导出，带 logo 水印。
        </p>
      </FadeUp>

      <FadeUp delay={350}>
        <div className="rounded-2xl overflow-hidden shadow-2xl border border-[var(--border)] max-w-[220px] sm:max-w-[260px]">
          <img
            src="/slides/export-demo.png"
            alt="诗词卡片导出示例 — 破阵子"
            className="w-full h-auto"
          />
        </div>
      </FadeUp>

      <FadeUp delay={700}>
        <div className="mt-4 flex items-center gap-2 justify-center">
          {themes.map((t, i) => (
            <div
              key={i}
              className={`w-5 h-5 rounded-full border border-[var(--border)] cursor-pointer hover:scale-110 transition-transform ${i === 2 ? 'ring-2 ring-[var(--accent)] ring-offset-1 ring-offset-[var(--bg)]' : ''}`}
              style={{ backgroundColor: t.bg }}
              title={t.name}
            />
          ))}
        </div>
      </FadeUp>

      <FadeUp delay={1100}>
        <div className="mt-5 flex flex-wrap gap-3 justify-center text-xs">
          <span className="px-3 py-1 rounded-full bg-[var(--accent-light)] text-[var(--accent)]">自适应画布比例</span>
          <span className="px-3 py-1 rounded-full bg-[var(--accent-light)] text-[var(--accent)]">2x 高清输出</span>
          <span className="px-3 py-1 rounded-full bg-[var(--accent-light)] text-[var(--accent)]">序 · 日期 · 脚注</span>
        </div>
      </FadeUp>
    </div>
  );
}

/** 14. 典故检索 */
function SlideAllusion() {
  /* 真实数据：搜索「柳」返回的典形词（按同源丰富度排序） */
  const results = [
    { w: '细柳营', d: '帝亲自劳军，至营，因无军令不得入' },
    { w: '陶潜柳', d: '咏柳典故，亦比喻隐居之地或人' },
    { w: '蒲柳姿', d: '体质衰弱或未老先衰的典故' },
    { w: '折柳', d: '表示赠别或送别' },
    { w: '张绪柳', d: '美称飘舞的垂柳' },
    { w: '灵和柳', d: '指潇洒飘逸的垂柳' },
  ];
  /* 真实数据：「折柳」的同源典形词 */
  const related = ['折杨柳', '灞桥柳', '灞陵柳', '攀柳'];
  return (
    <div className="flex flex-col items-center justify-center h-full px-6">
      <FadeUp>
        <h2 className="text-xl sm:text-2xl font-bold text-[var(--text)] mb-2 text-center">典故检索</h2>
      </FadeUp>
      <FadeUp delay={150}>
        <p className="text-sm text-[var(--text-secondary)] mb-8 text-center max-w-md">
          输入单字即可检索相关典形词，点击查看释义、典源出处与古诗例句。
        </p>
      </FadeUp>

      <div className="flex flex-col sm:flex-row gap-4 max-w-xl w-full">
        {/* 左：搜索结果列表 */}
        <FadeUp delay={300} className="flex-1">
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-4 shadow-sm h-full">
            <div className="bg-[var(--bg)] rounded-lg px-3 py-2 border border-[var(--border)] mb-3 flex items-center gap-2">
              <Search size={12} className="text-[var(--text-muted)]" />
              <span className="text-xs text-[var(--text)]">柳</span>
            </div>
            <div className="space-y-1.5">
              {results.map((r, i) => (
                <FadeUp key={i} delay={450 + i * 100}>
                  <div className={`flex items-baseline gap-2 px-2.5 py-1.5 rounded-lg text-xs transition-colors cursor-pointer ${i === 3 ? 'bg-[var(--accent-light)] border border-[var(--accent)]' : 'bg-[var(--bg)] border border-[var(--border)] hover:border-[var(--accent)]'}`}>
                    <span className={`font-medium shrink-0 ${i === 3 ? 'text-[var(--accent)]' : 'text-[var(--text)]'}`}>{r.w}</span>
                    <span className="text-[var(--text-muted)] truncate">{r.d}</span>
                  </div>
                </FadeUp>
              ))}
            </div>
          </div>
        </FadeUp>

        {/* 右：典故详情卡片 */}
        <FadeUp delay={800} className="flex-1">
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-4 shadow-sm h-full">
            <div className="text-sm font-semibold text-[var(--text)] mb-1">折柳</div>
            <p className="text-xs text-[var(--text-secondary)] mb-3">表示赠别或送别。</p>
            <div className="text-xs text-[var(--text-muted)] mb-1.5">典源</div>
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed mb-3 line-clamp-2">
              《三辅黄图·桥》："灞桥在长安东，跨水作桥，汉人送客至此，折柳赠别。"
            </p>
            <div className="text-xs text-[var(--text-muted)] mb-1.5">同源典形词</div>
            <div className="flex flex-wrap gap-1.5 mb-3">
              {related.map((r, i) => (
                <span key={i} className="px-2 py-0.5 rounded-md text-xs bg-[var(--bg)] border border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--accent)] hover:text-[var(--accent)] cursor-pointer transition-colors">
                  {r}
                </span>
              ))}
            </div>
            <div className="text-xs text-[var(--text-muted)] mb-1">例句</div>
            <p className="text-xs text-[var(--text-secondary)] italic leading-relaxed">
              唐李白《春夜洛城闻笛》："此夜曲中闻折柳，何人不起故园情。"
            </p>
          </div>
        </FadeUp>
      </div>

      <FadeUp delay={1300}>
        <p className="mt-5 text-xs text-[var(--text-secondary)]">
          收录 <strong className="text-[var(--text)]">13,000+</strong> 条典形词，点击可直接填入画布
        </p>
      </FadeUp>
    </div>
  );
}

/** 15. 导入前人作品 */
function SlideImportPoem() {
  /* 真实数据：搜索「登高」唐·诗 的结果 */
  const results = [
    { title: '九日登高', author: '王昌龄', dynasty: '唐' },
    { title: '奉和九日幸临渭亭登高应制得月字', author: '韦元旦', dynasty: '唐' },
    { title: '九月九日幸临渭亭登高得秋字', author: '李显', dynasty: '唐' },
    { title: '九日幸临渭亭登高应制得酒字', author: '马怀素', dynasty: '唐' },
  ];
  const filters = [
    { label: '标题', active: true },
    { label: '作者', active: false },
    { label: '内容', active: false },
  ];
  const dynastyFilters = ['唐', '宋', '明', '清'];
  return (
    <div className="flex flex-col items-center justify-center h-full px-6">
      <FadeUp>
        <h2 className="text-xl sm:text-2xl font-bold text-[var(--text)] mb-2 text-center">导入前人作品</h2>
      </FadeUp>
      <FadeUp delay={150}>
        <p className="text-sm text-[var(--text-secondary)] mb-8 text-center max-w-md">
          搜索 80 万首历代诗词，一键导入画板并自动触发格律校验。
        </p>
      </FadeUp>

      <FadeUp delay={300}>
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-4 sm:p-5 shadow-lg max-w-md w-full">
          {/* 搜索框 */}
          <div className="bg-[var(--bg)] rounded-lg px-3 py-2 border border-[var(--border)] mb-3 flex items-center gap-2">
            <Search size={13} className="text-[var(--text-muted)]" />
            <span className="text-sm text-[var(--text)]">登高</span>
            <span className="ml-auto text-xs text-[var(--text-muted)]">48 首</span>
          </div>

          {/* 筛选条件 */}
          <div className="flex items-center gap-2 mb-3">
            <div className="flex gap-1.5">
              {filters.map((f, i) => (
                <FadeUp key={i} delay={400 + i * 60}>
                  <span className={`px-2 py-0.5 rounded-md text-xs cursor-pointer transition-colors ${f.active ? 'bg-[var(--accent)] text-white' : 'bg-[var(--bg)] border border-[var(--border)] text-[var(--text-secondary)]'}`}>
                    {f.label}
                  </span>
                </FadeUp>
              ))}
            </div>
            <span className="text-[var(--border)]">|</span>
            <div className="flex gap-1.5">
              {dynastyFilters.map((d, i) => (
                <FadeUp key={i} delay={500 + i * 60}>
                  <span className={`px-2 py-0.5 rounded-md text-xs cursor-pointer transition-colors ${i === 0 ? 'bg-[var(--accent-light)] text-[var(--accent)] border border-[var(--accent)]' : 'bg-[var(--bg)] border border-[var(--border)] text-[var(--text-muted)]'}`}>
                    {d}
                  </span>
                </FadeUp>
              ))}
            </div>
          </div>

          {/* 搜索结果 */}
          <div className="space-y-1.5">
            {results.map((r, i) => (
              <FadeUp key={i} delay={650 + i * 120}>
                <div className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs border transition-all cursor-pointer ${i === 0 ? 'bg-[var(--accent-light)] border-[var(--accent)]' : 'bg-[var(--bg)] border-[var(--border)] hover:border-[var(--accent)]'}`}>
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`font-medium truncate ${i === 0 ? 'text-[var(--accent)]' : 'text-[var(--text)]'}`}>{r.title}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    <span className="text-[var(--text-muted)]">{r.dynasty}·{r.author}</span>
                  </div>
                </div>
              </FadeUp>
            ))}
          </div>
        </div>
      </FadeUp>

      <FadeUp delay={1200}>
        <div className="mt-5 flex flex-wrap gap-3 justify-center text-xs">
          <span className="px-3 py-1 rounded-full bg-[var(--accent-light)] text-[var(--accent)]">关键词 · 字段 · 朝代 · 体裁</span>
          <span className="px-3 py-1 rounded-full bg-[var(--accent-light)] text-[var(--accent)]">自动匹配格律规则</span>
          <span className="px-3 py-1 rounded-full bg-[var(--accent-light)] text-[var(--accent)]">导入即创建画板</span>
        </div>
      </FadeUp>
    </div>
  );
}

/* ───────────── 幻灯片列表 ───────────── */
const SLIDES: (() => React.ReactNode)[] = [
  SlideCover,
  SlidePainPoints,
  SlideOverview,
  SlideMeter,
  SlideRhyme,
  SlideDictionary,
  SlideRefine,
  SlideInspiration,
  SlideMultiBoard,
  SlideMobile,
  SlideTech,
  SlideRecentUpdates,
  SlideExport,
  SlideAllusion,
  SlideImportPoem,
  SlideCTA,
];

/* ───────────── 主组件 ───────────── */
export default function Slides() {
  const [current, setCurrent] = useState(0);
  const [direction, setDirection] = useState<'next' | 'prev'>('next');
  const [isTransitioning, setIsTransitioning] = useState(false);
  const touchStartX = useRef(0);

  const go = useCallback(
    (dir: 'next' | 'prev') => {
      if (isTransitioning) return;
      const next = dir === 'next' ? current + 1 : current - 1;
      if (next < 0 || next >= TOTAL_SLIDES) return;
      setDirection(dir);
      setIsTransitioning(true);
      setTimeout(() => {
        setCurrent(next);
        setIsTransitioning(false);
      }, TRANSITION_MS);
    },
    [current, isTransitioning],
  );

  const goTo = useCallback(
    (idx: number) => {
      if (isTransitioning || idx === current) return;
      setDirection(idx > current ? 'next' : 'prev');
      setIsTransitioning(true);
      setTimeout(() => {
        setCurrent(idx);
        setIsTransitioning(false);
      }, TRANSITION_MS);
    },
    [current, isTransitioning],
  );

  /* 键盘导航 */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === ' ') {
        e.preventDefault();
        go('next');
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        go('prev');
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [go]);

  /* 触摸滑动 */
  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) {
      go(diff > 0 ? 'next' : 'prev');
    }
  };

  /* 当前幻灯片 */
  const SlideComponent = SLIDES[current];

  /* 进出动画类 */
  const transitionClass = isTransitioning
    ? direction === 'next'
      ? 'opacity-0 -translate-x-8'
      : 'opacity-0 translate-x-8'
    : 'opacity-100 translate-x-0';

  return (
    <div
      className="h-screen w-screen bg-[var(--bg)] flex flex-col overflow-hidden select-none"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* ── 顶栏 ── */}
      <header className="flex items-center justify-between px-4 sm:px-6 h-11 border-b border-[var(--border)] bg-[var(--bg-card)] shrink-0 z-10">
        <span className="text-xs font-medium text-[var(--text)]">
          南洋吟游 <span className="text-[var(--accent)]">·</span> 方寸 <span className="text-[var(--accent)]">·</span> 产品介绍
        </span>
        <span className="text-xs text-[var(--text-muted)]">
          {current + 1} / {TOTAL_SLIDES}
        </span>
      </header>

      {/* ── 进度条 ── */}
      <div className="h-0.5 bg-[var(--border)] shrink-0">
        <div
          className="h-full bg-[var(--accent)] transition-all duration-500 ease-out"
          style={{ width: `${((current + 1) / TOTAL_SLIDES) * 100}%` }}
        />
      </div>

      {/* ── 幻灯片区域 ── */}
      <div className="flex-1 relative min-h-0">
        <div
          className={`absolute inset-0 transition-all ease-out ${transitionClass}`}
          style={{ transitionDuration: `${TRANSITION_MS}ms` }}
          key={current}
        >
          <SlideComponent />
        </div>

        {/* ── 左右箭头 ── */}
        {current > 0 && (
          <button
            onClick={() => go('prev')}
            className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-[var(--bg-card)] border border-[var(--border)] flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--accent)] hover:border-[var(--accent)] shadow-sm transition-all z-10"
          >
            <ChevronLeft size={18} />
          </button>
        )}
        {current < TOTAL_SLIDES - 1 && (
          <button
            onClick={() => go('next')}
            className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-[var(--bg-card)] border border-[var(--border)] flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--accent)] hover:border-[var(--accent)] shadow-sm transition-all z-10"
          >
            <ChevronRight size={18} />
          </button>
        )}
      </div>

      {/* ── 底部导航点 ── */}
      <footer className="flex items-center justify-center gap-1.5 py-3 shrink-0">
        {SLIDES.map((_, i) => (
          <button
            key={i}
            onClick={() => goTo(i)}
            className={`rounded-full transition-all duration-300
              ${i === current
                ? 'w-6 h-2 bg-[var(--accent)]'
                : 'w-2 h-2 bg-[var(--border)] hover:bg-[var(--text-muted)]'
              }`}
          />
        ))}
      </footer>
    </div>
  );
}
