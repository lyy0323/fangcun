import { useState, useEffect, useCallback, useRef } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Waves,
  Route,
  History,
  ScrollText,
  BookMarked,
  Smartphone,
  Sparkles,
  PenTool,
  Globe,
  Search,
  LibraryBig,
  GraduationCap,
  AudioLines,
  ExternalLink,
  ArrowRight,
  Feather,
} from 'lucide-react';

/* ───────────── 常量 ───────────── */
const TOTAL_SLIDES = 11;
const TRANSITION_MS = 500;
const SLOGAN = '在水一方';
const SITE_URL = 'https://write.sjtuguoxue.space';
const SOCIETY_URL = 'https://sjtuguoxue.space/';
const REF_URL = '/ref/index.html';

/* v3 专属水青色（浅/深主题各自收敛） */
const SV3_CSS = `
.sv3 {
  --aq: #2e7387;
  --aq-deep: #225a6d;
  --aq-soft: rgba(46, 115, 135, 0.12);
  --aq-faint: rgba(46, 115, 135, 0.06);
  --aq-line: rgba(46, 115, 135, 0.4);
}
.dark .sv3 {
  --aq: #6fb8d0;
  --aq-deep: #a4d9ea;
  --aq-soft: rgba(111, 184, 208, 0.15);
  --aq-faint: rgba(111, 184, 208, 0.07);
  --aq-line: rgba(111, 184, 208, 0.45);
}
.sv3-water-text {
  background: linear-gradient(100deg, var(--aq-deep), var(--aq) 55%, var(--aq-deep));
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}
.sv3-bg-tint {
  background:
    radial-gradient(1100px 460px at 88% -12%, var(--aq-faint), transparent 62%),
    radial-gradient(900px 420px at -8% 112%, var(--aq-faint), transparent 58%);
}
`;

/* ───────────── 小工具组件 ───────────── */

/** 淡入上移（沿用产品介绍幻灯片的动效语言） */
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

/** 水青色小标签 */
function Pill({ icon, children, active }: { icon?: React.ReactNode; children: React.ReactNode; active?: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-colors
        ${active ? 'text-white' : 'bg-[var(--aq-soft)] text-[var(--aq)]'}`}
      style={active ? { background: 'var(--aq)' } : undefined}
    >
      {icon}
      {children}
    </span>
  );
}

/** 特性卡片 */
function FeatureCard({ icon, title, desc, delay = 0, tone = 'aq' }: { icon: React.ReactNode; title: string; desc: string; delay?: number; tone?: 'aq' | 'accent' }) {
  const bg = tone === 'aq' ? 'var(--aq-soft)' : 'var(--accent-light)';
  const fg = tone === 'aq' ? 'var(--aq)' : 'var(--accent)';
  return (
    <FadeUp delay={delay} className="flex-1 min-w-[220px] max-w-[380px]">
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5 h-full shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ background: bg, color: fg }}>
          {icon}
        </div>
        <h3 className="text-sm font-semibold text-[var(--text)] mb-1.5">{title}</h3>
        <p className="text-xs text-[var(--text-secondary)] leading-relaxed">{desc}</p>
      </div>
    </FadeUp>
  );
}

/** 每页统一排版容器：内容不足一屏时居中，超高时可从顶部滚动（不裁剪） */
function SlideFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-full min-h-full flex flex-col items-center px-4 sm:px-8 py-6 text-center">
      <div className="flex flex-col items-center w-full my-auto">{children}</div>
    </div>
  );
}

/** 小标题（带主题色竖线） */
function SlideHeading({ pillIcon, pillText, title, sub }: { pillIcon?: React.ReactNode; pillText: string; title: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <FadeUp>
      <div className="mb-5 flex flex-col items-center">
        {pillText && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--aq-soft)] text-[var(--aq)] text-xs font-medium mb-3">
            {pillIcon}
            {pillText}
          </span>
        )}
        <h2 className="text-xl sm:text-2xl md:text-[26px] font-bold text-[var(--text)] tracking-wide">{title}</h2>
        {sub && <p className="mt-2 text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed max-w-2xl">{sub}</p>}
      </div>
    </FadeUp>
  );
}

/** 装饰性水纹（封面/结尾用） */
function WaterWaves({ className = '', style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg
      viewBox="0 0 1440 160"
      preserveAspectRatio="none"
      className={`pointer-events-none ${className}`}
      style={style}
      aria-hidden
    >
      <path
        d="M0,80 C180,20 360,140 540,90 C720,40 900,130 1080,85 C1260,40 1350,90 1440,70 L1440,160 L0,160 Z"
        fill="var(--aq-soft)"
      />
      <path
        d="M0,105 C200,60 400,150 620,110 C840,70 1040,150 1240,105 C1320,85 1390,100 1440,95 L1440,160 L0,160 Z"
        fill="var(--aq-faint)"
      />
    </svg>
  );
}

/* ───────────── 逐页幻灯片 ───────────── */

/** 0. 封面 —— 在水一方 */
function SlideCover() {
  return (
    <div className="relative w-full min-h-full flex flex-col items-center justify-center text-center px-6 sv3-bg-tint">
      {/* 水纹底饰 */}
      <WaterWaves className="absolute bottom-0 inset-x-0 w-full h-24 sm:h-32 opacity-70" />
      <FadeUp>
        <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-[var(--aq-line)] text-[var(--aq)] text-xs sm:text-sm tracking-widest bg-[var(--bg-card)]/70">
          <Waves size={14} />
          方寸 v3.0 · 上古音韵 · 新品发布
        </span>
      </FadeUp>

      <FadeUp delay={150}>
        <p className="mt-7 text-xs sm:text-sm text-[var(--text-secondary)] italic tracking-widest">
          《诗经 · 秦风 · 蒹葭》 —— “所谓伊人，在水一方。”
        </p>
      </FadeUp>

      <FadeUp delay={300}>
        <h1 className="mt-3 text-5xl sm:text-7xl md:text-8xl font-bold sv3-water-text tracking-[0.18em] pl-[0.18em] select-none">
          {SLOGAN}
        </h1>
      </FadeUp>

      <FadeUp delay={480}>
        <p className="mt-6 text-sm sm:text-base text-[var(--text)] max-w-xl leading-relaxed">
          溯洄三千年，去听一首诗<span className="sv3-water-text font-semibold">最初的声音</span>。
          <br />
          方寸 3.0 —— 把《诗经》《楚辞》的韵与音，请进你的创作画布。
        </p>
      </FadeUp>

      <FadeUp delay={660}>
        <div className="mt-8 flex items-center gap-2 text-xs text-[var(--text-muted)]">
          <span>按</span>
          <kbd className="px-2 py-0.5 rounded bg-[var(--bg-card)] border border-[var(--border)] text-[var(--text-secondary)] font-mono">→</kbd>
          <span>或点击箭头，开始这场溯洄</span>
        </div>
      </FadeUp>

      <FadeUp delay={800}>
        <div className="mt-6 text-[11px] text-[var(--text-muted)] flex items-center gap-1.5">
          <span className="text-[var(--aq)]">南洋吟游</span>
          <span>·</span>
          <span>方寸</span>
          <span>·</span>
          <span>诗词创作画布</span>
        </div>
      </FadeUp>
    </div>
  );
}

/** 1. 千年之问（悬念） */
function SlideQuestion() {
  const items = [
    {
      icon: <Waves size={16} />,
      title: '韵脚，千年不散',
      text: '《秦风 · 蒹葭》的韵脚“苍、霜、方、长、央”，三千年前同收 -aŋ（阳部），今天读来依旧相和——有些韵，比想象中更长寿。',
    },
    {
      icon: <History size={16} />,
      title: '也有诗，今读“失谐”',
      text: '一些《诗经》句子今天读着不押韵，并非古人将就——而是语音早已改道。用今天的耳朵，听不见三千年前的叶韵。',
    },
    {
      icon: <Route size={16} />,
      title: '一个字，五世音容',
      text: '同一个“命”：诗经音 mriŋ、楚辞音 mreŋ，再经平水、词林到中华通韵，各归其部。语音像一条河，五部韵书是五次改道。',
    },
  ];
  return (
    <SlideFrame>
      <FadeUp>
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--aq-soft)] text-[var(--aq)] text-xs font-medium mb-4">
          <Feather size={13} />
          写在前面
        </span>
      </FadeUp>
      <FadeUp delay={120}>
        <h2 className="text-xl sm:text-2xl md:text-[26px] font-bold text-[var(--text)] leading-snug">
          我们与三千年前的诗，
          <br className="sm:hidden" />
          隔着的，不只是时间
        </h2>
      </FadeUp>
      <FadeUp delay={300}>
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl w-full text-left">
          {items.map((it, i) => (
            <FadeUp key={i} delay={420 + i * 160} className="flex-1">
              <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-4 h-full shadow-sm hover:-translate-y-1 transition-transform duration-300">
                <div className="w-8 h-8 rounded-lg bg-[var(--aq-soft)] text-[var(--aq)] flex items-center justify-center mb-2.5">{it.icon}</div>
                <div className="text-sm font-semibold text-[var(--text)] mb-1">{it.title}</div>
                <p className="text-xs text-[var(--text-secondary)] leading-relaxed">{it.text}</p>
              </div>
            </FadeUp>
          ))}
        </div>
      </FadeUp>
      <FadeUp delay={1100}>
        <p className="mt-8 text-sm text-[var(--aq)] font-medium text-center">
          于是，有了方寸 3.0 —— 一张三千年的“韵”的地图 →
        </p>
      </FadeUp>
    </SlideFrame>
  );
}

/** 2. v3 一览 */
function SlideOverview() {
  return (
    <SlideFrame>
      <FadeUp>
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--aq-soft)] text-[var(--aq)] text-xs font-medium mb-4">
          <Sparkles size={13} />
          v3.0 新功能一览
        </span>
      </FadeUp>
      <FadeUp delay={120}>
        <h2 className="text-xl sm:text-2xl md:text-[26px] font-bold text-[var(--text)] tracking-wide">
          这一版，把“韵”的版图推进到三千年前
        </h2>
      </FadeUp>

      <FadeUp delay={300}>
        <div className="mt-7 flex flex-wrap gap-3.5 justify-center max-w-3xl w-full">
          <FeatureCard
            icon={<AudioLines size={20} />}
            title="上古韵 · 诗经 / 楚辞双套"
            desc="诗经韵 51 部（鱼 a、铎 ak、阳 aŋ…）与楚辞韵 36 部（耕真、之幽…）并立，国际音标 + 拼音双注，韵脚实时匹配上古韵部"
            delay={200}
          />
          <FeatureCard
            icon={<Route size={20} />}
            title="韵部流变 · 桑基图"
            desc="参考站首页新图：五部韵书 × 5772 个共有字，看一个韵如何从《诗经》一路流到《中华通韵》（Beta）"
            delay={350}
          />
          <FeatureCard
            icon={<ScrollText size={20} />}
            title="上古释义"
            desc="字典与参考站查字新增上古义项，对照《汉语大字典》，繁体原文逐条呈现"
            delay={500}
          />
          <FeatureCard
            icon={<BookMarked size={20} />}
            title="参考站 /ref 全新上线"
            desc="韵书总览 · 查字 · 词谱 · 诗格 · 教程——网页版诗学书房，即开即用、可分享"
            delay={650}
          />
          <FeatureCard
            icon={<Sparkles size={20} />}
            title="创作体验焕新"
            desc="Markdown 往返无损、8 步聚光灯引导、导出默认汇文明朝体、Android 3.0 同步"
            delay={800}
          />
        </div>
      </FadeUp>
    </SlideFrame>
  );
}

/** 3. 上古韵双套 */
function SlideDualSystem() {
  return (
    <SlideFrame>
      <SlideHeading
        pillIcon={<AudioLines size={13} />}
        pillText="上古韵 · 双套并立"
        title={<>同一个字，两副腔调</>}
        sub={<>上古不是一个静止的时代。以《诗经》韵系（西周—春秋）与《楚辞》韵系（战国）分别建部，两套音系同时收录、随时切换。</>}
      />

      {/* 双栏字卡 */}
      <FadeUp delay={320}>
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 items-stretch justify-center max-w-2xl w-full">
          {/* 诗经音 */}
          <div className="flex-1 rounded-2xl border-2 p-4 sm:p-5 text-left" style={{ borderColor: 'var(--aq-line)', background: 'var(--aq-faint)' }}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold tracking-widest text-[var(--aq)]">《诗经》音</span>
              <span className="text-[10px] text-[var(--text-muted)]">西周—春秋</span>
            </div>
            <div className="text-5xl sm:text-6xl font-bold text-[var(--text)] text-center select-none">命</div>
            <div className="mt-3 text-center space-y-1">
              <div className="text-base sm:text-lg font-mono text-[var(--aq)]">[mriŋ]</div>
              <div className="text-xs text-[var(--text-muted)] font-mono">mring</div>
            </div>
            <div className="mt-3 flex justify-center">
              <span className="px-2.5 py-0.5 rounded-md text-xs bg-[var(--bg-card)] border text-[var(--aq)]" style={{ borderColor: 'var(--aq-line)' }}>韵部 · 真 iŋ</span>
            </div>
          </div>

          <div className="hidden sm:flex items-center justify-center">
            <ArrowRight size={18} className="text-[var(--aq)] opacity-60" />
          </div>

          {/* 楚辞音 */}
          <div className="flex-1 rounded-2xl border p-4 sm:p-5 text-left" style={{ borderColor: 'var(--border)', background: 'var(--bg-card)' }}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold tracking-widest text-[var(--text-secondary)]">《楚辞》音</span>
              <span className="text-[10px] text-[var(--text-muted)]">战国</span>
            </div>
            <div className="text-5xl sm:text-6xl font-bold text-[var(--text)] text-center select-none">命</div>
            <div className="mt-3 text-center space-y-1">
              <div className="text-base sm:text-lg font-mono text-[var(--text)]">[mreŋ]</div>
              <div className="text-xs text-[var(--text-muted)] font-mono">mreng</div>
            </div>
            <div className="mt-3 flex justify-center">
              <span className="px-2.5 py-0.5 rounded-md text-xs bg-[var(--bg)] border border-[var(--border)] text-[var(--text-secondary)]">韵部 · 耕真</span>
            </div>
          </div>
        </div>
      </FadeUp>

      <FadeUp delay={600}>
        <p className="mt-4 text-xs sm:text-sm text-[var(--aq)] text-center">
          韵母 iŋ → eŋ：主元音变化，正是西周到战国的语音流变（拟音方案：Nulll · PBOC）
        </p>
      </FadeUp>

      {/* 部数对照 */}
      <FadeUp delay={760}>
        <div className="mt-6 grid grid-cols-2 gap-3 max-w-xl w-full">
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl px-4 py-3">
            <div className="text-xl font-bold text-[var(--aq)]">51 部</div>
            <div className="text-xs text-[var(--text-secondary)] mt-0.5">诗经韵——按主元音 × 韵尾细分：鱼 a · 铎 ak · 阳 aŋ…</div>
          </div>
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl px-4 py-3">
            <div className="text-xl font-bold text-[var(--text)]">36 部</div>
            <div className="text-xs text-[var(--text-secondary)] mt-0.5">楚辞韵——依战国音系归并：耕真 · 之幽 · 职觉…</div>
          </div>
        </div>
      </FadeUp>

      <FadeUp delay={920}>
        <div className="mt-5 flex flex-wrap justify-center gap-2 text-xs">
          <Pill active>诗经 · 楚辞随时切换</Pill>
          <Pill>句末语气词（兮乎也矣）不误作韵脚</Pill>
          <Pill>韵脚自动匹配同部字</Pill>
        </div>
      </FadeUp>
    </SlideFrame>
  );
}

/** 4. 查字 · 五段音史（时间线胶囊） */
function SlideTimeline() {
  const stops = [
    { era: '诗经', span: '西周—春秋', cat: '真 iŋ', ipa: '[mriŋ]', hint: '上古拟音' },
    { era: '楚辞', span: '战国', cat: '耕真', ipa: '[mreŋ]', hint: '战国拟音' },
    { era: '平水韵', span: '宋', cat: '二十四敬', ipa: null, hint: '近体诗韵' },
    { era: '词林正韵', span: '清', cat: '第 11 部 · 仄', ipa: null, hint: '填词用韵' },
    { era: '中华通韵', span: '当代', cat: '十四英 · 仄', ipa: null, hint: '新诗新韵' },
  ];
  return (
    <SlideFrame>
      <SlideHeading
        pillIcon={<Search size={13} />}
        pillText="查字 · 时间线"
        title={<>一个字，五段音史</>}
        sub={<>在字典输入「命」，五部韵书同屏呈现——像五枚时间胶囊，一字贯穿三千年。</>}
      />

      <FadeUp delay={320}>
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-4 sm:p-6 shadow-lg max-w-3xl w-full">
          {/* 仿字典搜索行 */}
          <div className="flex items-center gap-2 bg-[var(--bg)] rounded-lg px-3 py-2 border border-[var(--border)] mb-5 max-w-[220px]">
            <Search size={13} className="text-[var(--aq)]" />
            <span className="text-sm text-[var(--text)] font-medium">命</span>
            <span className="ml-auto text-[10px] text-[var(--text-muted)]">mìng · 去</span>
          </div>

          {/* 时间线胶囊 */}
          <div className="flex flex-col sm:flex-row gap-2.5 sm:gap-0 sm:items-stretch justify-between">
            {stops.map((s, i) => (
              <FadeUp key={i} delay={450 + i * 150} className="flex-1 sm:mx-1">
                <div className={`relative rounded-xl border px-3 py-3 text-center h-full
                  ${i === 0 ? 'bg-[var(--aq-faint)]' : 'bg-[var(--bg)]'} ${i === 0 ? '' : 'border-[var(--border)]'}`}
                  style={i === 0 ? { borderColor: 'var(--aq-line)' } : undefined}
                >
                  {i > 0 && (
                    <span className="hidden sm:block absolute -left-3 top-1/2 -translate-y-1/2 text-[var(--aq)] opacity-50">
                      <ChevronRight size={12} />
                    </span>
                  )}
                  <div className="text-xs font-semibold text-[var(--text)]">{s.era}</div>
                  <div className="text-[10px] text-[var(--text-muted)] mb-1.5">{s.span}</div>
                  <div className={`text-sm font-mono font-medium ${i <= 1 ? 'text-[var(--aq)]' : 'text-[var(--text-secondary)]'}`}>{s.cat}</div>
                  {s.ipa && <div className="text-xs font-mono text-[var(--text)] mt-0.5">{s.ipa}</div>}
                  <div className="text-[10px] text-[var(--text-muted)] mt-1">{s.hint}</div>
                </div>
              </FadeUp>
            ))}
          </div>
        </div>
      </FadeUp>

      <FadeUp delay={1000}>
        <div className="mt-5 flex flex-wrap gap-2 justify-center text-xs">
          <Pill>上古两套附拟音 + 拼音</Pill>
          <Pill>韵字颜色随韵部自动取色</Pill>
          <Pill>参考站同款 · 时间线胶囊</Pill>
        </div>
      </FadeUp>
    </SlideFrame>
  );
}

/** 5. 《蒹葭》现场：诗经音 */
function SlideJianjia() {
  const feet = [
    { c: '苍', ipa: 'tsʰˤaŋ' },
    { c: '霜', ipa: 'sraŋ' },
    { c: '方', ipa: 'paŋ' },
    { c: '长', ipa: 'draŋ' },
    { c: '央', ipa: 'ʔaŋ' },
  ];
  const Hl = ({ children }: { children: React.ReactNode }) => (
    <span className="px-1 rounded-md text-white" style={{ background: 'var(--aq)' }}>{children}</span>
  );
  return (
    <SlideFrame>
      <SlideHeading
        pillIcon={<Feather size={13} />}
        pillText="诗经用例 · 手把手"
        title={<>把《蒹葭》，唱回三千年前</>}
        sub={<>在上古诗经韵下输入韵脚字，看看三千年前的韵，是否与你此刻的耳朵同频。</>}
      />

      {/* 诗卡 */}
      <FadeUp delay={300}>
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl px-5 py-4 shadow-lg w-full max-w-xl">
          <p className="text-[13px] sm:text-sm leading-loose text-[var(--text)] tracking-wide">
            <span className="text-[var(--text-secondary)]">蒹葭</span>
            <Hl>苍苍</Hl>
            <span className="text-[var(--text-secondary)]">，白露为</span>
            <Hl>霜</Hl>
            <span className="text-[var(--text-secondary)]">。</span>
            <br />
            <span className="text-[var(--text-secondary)]">所谓伊人，在水一</span>
            <Hl>方</Hl>
            <span className="text-[var(--text-secondary)]">。</span>
            <br />
            <span className="text-[var(--text-secondary)]">溯洄从之，道阻且</span>
            <Hl>长</Hl>
            <span className="text-[var(--text-secondary)]">。溯游从之，宛在水中</span>
            <Hl>央</Hl>
            <span className="text-[var(--text-secondary)]">。</span>
          </p>
          <p className="mt-2 text-[10px] text-[var(--text-muted)] text-right">
            高亮为韵脚所在：苍 · 霜 · 方 · 长 · 央
          </p>
        </div>
      </FadeUp>

      {/* 韵脚拟音 */}
      <FadeUp delay={520}>
        <div className="mt-4 flex flex-wrap items-stretch justify-center gap-2 sm:gap-2.5 w-full max-w-2xl">
          {feet.map((f, i) => (
            <FadeUp key={i} delay={600 + i * 110}>
              <div className="w-[64px] sm:w-[76px] rounded-xl border px-1 py-2.5 text-center" style={{ borderColor: 'var(--aq-line)', background: 'var(--aq-faint)' }}>
                <div className="text-2xl font-bold text-[var(--text)] select-none">{f.c}</div>
                <div className="mt-1 text-[10px] sm:text-[11px] font-mono text-[var(--aq)]">{f.ipa}</div>
              </div>
            </FadeUp>
          ))}
        </div>
      </FadeUp>

      <FadeUp delay={1000}>
        <div className="mt-5 flex flex-col sm:flex-row items-center gap-2 text-xs">
          <Pill active>
            <Waves size={12} /> 韵脚：苍 · 霜 · 方 · 长 · 央
          </Pill>
          <Pill>皆属诗经韵「阳 aŋ」，拟音同收 -aŋ</Pill>
        </div>
      </FadeUp>
    </SlideFrame>
  );
}

/** 6. 韵部流变（五书之河） */
function SlideFlow() {
  const routes = [
    {
      label: '苍',
      tone: '平声读',
      stops: ['诗经 · 阳 aŋ', '楚辞 · 阳 aŋ', '平水 · 七阳', '词林 · 第 2 部', '通韵 · 十三昂'],
      main: true,
    },
    {
      label: '命',
      tone: '去声读',
      stops: ['诗经 · 真 iŋ', '楚辞 · 耕真', '平水 · 二十四敬', '词林 · 第 11 部', '通韵 · 十四英'],
      main: false,
    },
  ];
  return (
    <SlideFrame>
      <SlideHeading
        pillIcon={<Route size={13} />}
        pillText="韵部流变 · 参考站（Beta）"
        title={<>一条韵河，五次改道</>}
        sub={<>参考站把五部韵书叠成桑基图，用 5,772 个共有字统计全库流向——同一韵字，五本书各自归向哪里，悬停即见。</>}
      />

      {/* 模拟流变图卡 */}
      <FadeUp delay={300}>
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-4 sm:p-6 shadow-lg w-full max-w-2xl">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 text-xs font-medium text-[var(--text)]">
              <Route size={13} className="text-[var(--aq)]" />
              韵书总览 · 全库五书韵部流变
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--aq-soft)] text-[var(--aq)]">Beta</span>
          </div>

          {/* 列头 */}
          <div className="grid grid-cols-5 gap-1 sm:gap-2 mb-2 text-[10px] sm:text-[11px] text-[var(--text-muted)]">
            {['诗经韵', '楚辞韵', '平水韵', '词林正韵', '中华通韵'].map((b, i) => (
              <div key={i} className="text-center">{b}</div>
            ))}
          </div>

          {/* 两条真实路线 */}
          <div className="space-y-3">
            {routes.map((r, ri) => (
              <div key={ri} className="relative">
                {/* 底纹：示意大量暗流 */}
                <div
                  className="absolute inset-x-0 top-1/2 h-[26px] -translate-y-1/2 rounded-full opacity-25"
                  style={{ background: 'linear-gradient(90deg, var(--aq-faint), var(--aq-soft) 50%, var(--aq-faint))' }}
                />
                <div className="relative grid grid-cols-5 gap-1 sm:gap-2 items-center">
                  {r.stops.map((s, si) => (
                    <div key={si} className="flex items-center justify-center">
                      <span
                        className={`text-[11px] sm:text-xs text-center px-1.5 sm:px-2 py-1.5 rounded-lg w-full leading-tight
                          ${r.main ? 'text-white' : 'text-[var(--text-secondary)] bg-[var(--bg)] border border-[var(--border)]'}`}
                        style={r.main ? { background: 'var(--aq)', boxShadow: '0 2px 8px var(--aq-soft)' } : undefined}
                      >
                        {s}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="mt-1.5 text-[10px] sm:text-[11px] text-left flex items-center gap-1.5">
                  <span className={`px-1.5 py-0.5 rounded-md font-mono ${r.main ? 'text-[var(--aq)]' : 'text-[var(--text-muted)]'}`} style={r.main ? { background: 'var(--aq-faint)' } : undefined}>
                    {r.label}
                  </span>
                  <span className="text-[var(--text-muted)]">{r.tone} · 一条真实流向</span>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 pt-3 border-t border-[var(--border)] text-[11px] text-[var(--text-muted)] leading-relaxed text-left">
            悬停任一韵部 / 流向高亮整条路径 · 按字等权统计 · 多音字的精细流向将在下一版人工标注
          </div>
        </div>
      </FadeUp>

      <FadeUp delay={800}>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5">
          <a
            href={REF_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium text-white shadow-md hover:-translate-y-0.5 transition-transform"
            style={{ background: 'var(--aq)' }}
          >
            打开参考站 · 体验完整桑基图 <ExternalLink size={12} />
          </a>
          <span className="text-xs text-[var(--text-muted)]">建议在桌面浏览器打开</span>
        </div>
      </FadeUp>
    </SlideFrame>
  );
}

/** 7. 参考站 /ref */
function SlideRefSite() {
  const pages = [
    { icon: <BookMarked size={18} />, name: '韵书总览', desc: '平水 106 · 词林 19 部 · 诗经 51 · 楚辞 36 · 通韵 16，配色与编辑器一致，韵字可点即查' },
    { icon: <Search size={18} />, name: '查字', desc: '释义 + 五部音韵同屏（时间线胶囊）；空闲时 100 常用字玻璃卡片墙' },
    { icon: <LibraryBig size={18} />, name: '词谱', desc: '常用词牌 + 钦/龙谱检索，按韵脚分行，每格“写”直达创作' },
    { icon: <ScrollText size={18} />, name: '诗格', desc: '五七言律绝 8 格式，拗救与特殊句式专节' },
    { icon: <GraduationCap size={18} />, name: '教程', desc: '平仄入门 · 律诗 · 填词 · 韵书选择 · 用典，五篇循序入门' },
  ];
  return (
    <SlideFrame>
      <SlideHeading
        pillIcon={<Globe size={13} />}
        pillText="参考站 · /ref"
        title={<>一个可以分享的「诗学书房」</>}
        sub={<>从编辑器独立出来、为网页而生的参考站——手机、桌面即开即用，创作时随取随查。</>}
      />

      <FadeUp delay={300}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 w-full max-w-4xl">
          {pages.map((p, i) => (
            <FadeUp key={i} delay={380 + i * 130}>
              <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-4 h-full shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300">
                <div className="w-9 h-9 rounded-lg bg-[var(--aq-soft)] text-[var(--aq)] flex items-center justify-center mb-2.5">{p.icon}</div>
                <div className="text-sm font-semibold text-[var(--text)] mb-1">{p.name}</div>
                <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">{p.desc}</p>
              </div>
            </FadeUp>
          ))}
        </div>
      </FadeUp>

      <FadeUp delay={1000}>
        <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-2.5 w-full">
          <a
            href={REF_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-medium text-white shadow-md hover:-translate-y-0.5 transition-transform"
            style={{ background: 'var(--aq)' }}
          >
            打开参考站 <ExternalLink size={13} />
          </a>
          <div className="flex flex-wrap justify-center gap-2 text-[11px]">
            <Pill>Android 端内置</Pill>
            <Pill>可被搜索引擎收录（OG / sitemap）</Pill>
          </div>
        </div>
      </FadeUp>
    </SlideFrame>
  );
}

/** 8. 上古释义 */
function SlideGloss() {
  return (
    <SlideFrame>
      <SlideHeading
        pillIcon={<ScrollText size={13} />}
        pillText="上古释义"
        title={<>查一个「蒹」字，回到《诗经》现场</>}
        sub={<>字典与参考站查字新增上古义项——对照《汉语大字典》，繁体原文逐条呈现，引经据典皆有出处。</>}
      />

      <FadeUp delay={300}>
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5 shadow-lg w-full max-w-xl text-left">
          <div className="flex items-center gap-2 bg-[var(--bg)] rounded-lg px-3 py-2 border border-[var(--border)] mb-4 max-w-[200px]">
            <Search size={13} className="text-[var(--aq)]" />
            <span className="text-sm text-[var(--text)] font-medium">蒹</span>
            <span className="ml-auto text-[10px] text-[var(--text-muted)]">jiān</span>
          </div>

          {/* 现代释义 */}
          <div className="mb-4">
            <div className="text-[11px] font-semibold tracking-widest text-[var(--text-secondary)] mb-1">释义</div>
            <p className="text-sm text-[var(--text)] leading-relaxed">初生的芦苇。</p>
          </div>

          {/* 上古释义 */}
          <div className="rounded-xl p-3.5" style={{ background: 'var(--aq-faint)' }}>
            <div className="text-[11px] font-semibold tracking-widest text-[var(--aq)] mb-1.5">上古释义 · 繁体原文</div>
            <p className="text-[12.5px] leading-relaxed text-[var(--text)]">
              「沒有長穗的蘆葦。《秦風 · 蒹葭》：<em className="not-italic font-semibold">蒹葭蒼蒼，白露爲霜</em>。陸璣疏……《說文》：「雚之未秀者。」」
            </p>
          </div>
        </div>
      </FadeUp>

      <FadeUp delay={650}>
        <div className="mt-5 flex flex-col items-center gap-1.5 text-xs text-[var(--text-secondary)] leading-relaxed">
          <p>创作区点击任意已写字，画布下的查字台即刻联动：读音 · 韵部 · 释义一次看完</p>
          <div className="flex flex-wrap justify-center gap-2 mt-1">
            <Pill>义项对照《汉语大字典》</Pill>
            <Pill>引文保留繁体原文</Pill>
          </div>
        </div>
      </FadeUp>
    </SlideFrame>
  );
}

/** 9. 创作体验升级 */
function SlideExperience() {
  const cards = [
    { icon: <PenTool size={18} />, title: '编辑器更跟手', desc: '点空白或字才切换选择；填入候选字后，光标自动推进到下一字位并保持输入焦点' },
    { icon: <Sparkles size={18} />, title: 'Markdown 往返', desc: '粘贴导入可重建标点与引号，组诗节次、日期不再丢失' },
    { icon: <GraduationCap size={18} />, title: '新手引导重做', desc: '8 步聚光灯直指真实控件，随时可从设置重看' },
    { icon: <ScrollText size={18} />, title: '导出升级', desc: '默认汇文明朝体；组诗可按 n 首/张拆图；主题横向滚动选择' },
    { icon: <Smartphone size={18} />, title: 'Android 3.0', desc: '与 Web 同步：内置参考站、禁用双指缩放、外链跳系统浏览器' },
  ];
  return (
    <SlideFrame>
      <SlideHeading
        pillIcon={<Sparkles size={13} />}
        pillText="不止音韵"
        title={<>从格律到体验，处处焕新</>}
        sub={<>v3.0 不只是“上古韵”——日常创作的每个环节，也都悄悄变得更顺。</>}
      />

      <FadeUp delay={300}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 w-full max-w-4xl">
          {cards.map((c, i) => (
            <FadeUp key={i} delay={380 + i * 130}>
              <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-4 h-full shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300">
                <div className="w-9 h-9 rounded-lg bg-[var(--aq-soft)] text-[var(--aq)] flex items-center justify-center mb-2.5">{c.icon}</div>
                <div className="text-sm font-semibold text-[var(--text)] mb-1">{c.title}</div>
                <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">{c.desc}</p>
              </div>
            </FadeUp>
          ))}
        </div>
      </FadeUp>

      <FadeUp delay={1050}>
        <p className="mt-7 text-xs text-[var(--text-muted)]">
          更多细节，见 App 内「更新日志」与 <a href={REF_URL} target="_blank" rel="noopener noreferrer" className="text-[var(--aq)] hover:underline">参考站</a>
        </p>
      </FadeUp>
    </SlideFrame>
  );
}

/** 10. CTA —— 所谓伊人，在水一方 */
function SlideCTA() {
  return (
    <div className="relative w-full min-h-full flex flex-col items-center justify-center text-center px-6 sv3-bg-tint overflow-hidden">
      <WaterWaves className="absolute bottom-0 inset-x-0 w-full h-28 sm:h-36 opacity-60" />
      <FadeUp>
        <div className="text-4xl sm:text-5xl select-none">🌾</div>
      </FadeUp>
      <FadeUp delay={150}>
        <p className="mt-5 text-xs sm:text-sm text-[var(--text-secondary)] italic tracking-widest">
          《诗经 · 秦风 · 蒹葭》 · 溯洄从之，道阻且长；溯游从之，宛在水中央
        </p>
      </FadeUp>
      <FadeUp delay={320}>
        <h2 className="mt-4 text-3xl sm:text-5xl font-bold sv3-water-text tracking-[0.15em] pl-[0.15em]">
          所谓伊人，{SLOGAN}
        </h2>
      </FadeUp>
      <FadeUp delay={520}>
        <p className="mt-6 text-sm sm:text-base text-[var(--text-secondary)] max-w-xl leading-relaxed">
          三千年的声韵，我们已备好每一种读法。
          <br />
          来方寸，写下属于你的那一句——
        </p>
      </FadeUp>
      <FadeUp delay={720}>
        <div className="mt-9 flex flex-col sm:flex-row items-center justify-center gap-3">
          <a
            href={SITE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-7 py-3 rounded-2xl text-sm font-medium text-white shadow-lg hover:-translate-y-0.5 hover:shadow-xl transition-all duration-300"
            style={{ background: 'var(--aq)' }}
          >
            立即体验 · 方寸 v3.0 <ExternalLink size={14} />
          </a>
          <a
            href={REF_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl text-sm font-medium border transition-all duration-300 hover:-translate-y-0.5"
            style={{ borderColor: 'var(--aq-line)', color: 'var(--aq)', background: 'var(--bg-card)' }}
          >
            打开参考站 <ExternalLink size={14} />
          </a>
        </div>
      </FadeUp>
      <FadeUp delay={900}>
        <div className="mt-8 flex flex-col items-center gap-1.5">
          <p className="text-xs text-[var(--text-muted)]">
            支持 Web 与 Android 3.0 · 数据与创作画板完全离线可用
          </p>
          <p className="text-xs text-[var(--text-muted)]">
            <a href={SOCIETY_URL} target="_blank" rel="noopener noreferrer" className="text-[var(--aq)] hover:underline">上海交大国学社</a>
            {' '}· 南洋吟游诗社 出品
          </p>
        </div>
      </FadeUp>
    </div>
  );
}

/* ───────────── 幻灯片列表 ───────────── */
const SLIDES: (() => React.ReactNode)[] = [
  SlideCover,
  SlideQuestion,
  SlideOverview,
  SlideDualSystem,
  SlideTimeline,
  SlideJianjia,
  SlideFlow,
  SlideRefSite,
  SlideGloss,
  SlideExperience,
  SlideCTA,
];

/* ───────────── 主组件 ───────────── */
export default function SlidesV3() {
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

  const SlideComponent = SLIDES[current];

  const transitionClass = isTransitioning
    ? direction === 'next'
      ? 'opacity-0 -translate-x-8'
      : 'opacity-0 translate-x-8'
    : 'opacity-100 translate-x-0';

  return (
    <div className="sv3">
      <style>{SV3_CSS}</style>
      <div
        className="h-screen w-screen bg-[var(--bg)] flex flex-col overflow-hidden select-none sv3-bg-tint"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {/* ── 顶栏 ── */}
        <header className="flex items-center justify-between px-4 sm:px-6 h-11 border-b border-[var(--border)] bg-[var(--bg-card)]/80 shrink-0 z-10 backdrop-blur">
          <span className="text-xs font-medium text-[var(--text)]">
            <span className="sv3-water-text font-bold">v3.0</span>
            <span className="text-[var(--text-muted)]"> · 方寸新品宣传 · </span>
            {SLOGAN}
          </span>
          <span className="text-xs text-[var(--text-muted)]">
            {current + 1} / {TOTAL_SLIDES}
          </span>
        </header>

        {/* ── 进度条（水青） ── */}
        <div className="h-0.5 bg-[var(--border)] shrink-0">
          <div
            className="h-full transition-all duration-500 ease-out"
            style={{ width: `${((current + 1) / TOTAL_SLIDES) * 100}%`, background: 'var(--aq)' }}
          />
        </div>

        {/* ── 幻灯片区域 ── */}
        <div className="flex-1 relative min-h-0">
          <div
            className={`absolute inset-0 overflow-y-auto transition-all ease-out ${transitionClass}`}
            style={{ transitionDuration: `${TRANSITION_MS}ms` }}
            key={current}
          >
            <SlideComponent />
          </div>

          {/* 左右箭头 */}
          {current > 0 && (
            <button
              onClick={() => go('prev')}
              className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-[var(--bg-card)] border border-[var(--border)] flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--aq)] hover:border-[var(--aq)] shadow-sm transition-all z-10"
            >
              <ChevronLeft size={18} />
            </button>
          )}
          {current < TOTAL_SLIDES - 1 && (
            <button
              onClick={() => go('next')}
              className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-[var(--bg-card)] border border-[var(--border)] flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--aq)] hover:border-[var(--aq)] shadow-sm transition-all z-10"
            >
              <ChevronRight size={18} />
            </button>
          )}
        </div>

        {/* ── 底部导航点 ── */}
        <footer className="flex items-center justify-center gap-1.5 py-2.5 shrink-0">
          {SLIDES.map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              aria-label={`第 ${i + 1} 页`}
              className={`rounded-full transition-all duration-300
                ${i === current ? 'w-6 h-2' : 'w-2 h-2 hover:opacity-70'}`}
              style={{
                background: i === current ? 'var(--aq)' : 'var(--border)',
              }}
            />
          ))}
        </footer>
      </div>
    </div>
  );
}
