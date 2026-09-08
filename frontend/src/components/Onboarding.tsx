import { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import { useBoardContext, createBoard } from '../context/BoardContext';
import { PLACEHOLDER } from '../lib/types';
import type { Board } from '../lib/types';
import { track } from '../lib/api';
import { type LucideIcon, PenLine, SquarePlus, LayoutGrid, BookMarked, Search, ScrollText, ImageDown, Layers, ChevronLeft, ChevronRight, X } from 'lucide-react';

// ============================================================================
// 新手引导（overlay 聚光灯式）
//
// 展示条件（每次渲染派生）：
//   - 自动：localStorage fangcun_onboarding_dismissed ≠ '1' 且当前 0 个画板（首启）
//   - 手动：state.onboardingOpen（设置里「新手引导」打开，即使已有画板）
// 自动场景会建一张示例画板（五绝 20 字），使正文网格 / 字典 / 韵部面板真实
// 出现供后续步骤高亮；引导结束（完成或跳过）时若示例板从未被改动则删除，
// 让 0 板首启流程（体裁选择弹层）照常接管。
//
// 生命周期：
//   - 置位「已看过」：点「跳过」或走完最后一步 —— 写入 dismissed，并 SET_ONBOARDING false
//   - 埋点：onboarding_show / onboarding_skip / onboarding_done
//
// 视觉：
//   - 全屏遮罩挖一个「洞」高亮当前步骤目标（四块 .onb-dim 矩形拼合，洞内可正常
//     交互），accent 描边圈住目标；目标缺失（如窄屏无右侧韵部栏）降级为纯说明卡。
//   - 引导卡浮在遮罩上：目标偏下方时卡置顶，否则置底，尽量避开高亮区。
// ============================================================================

const KEY = 'fangcun_onboarding_dismissed';

/** 自动场景示例画板：五绝（平起首句入韵，20 字），与「选择诗体」里的格式一致 */
const DEMO_RULE = '五绝平起首句入韵';
const DEMO_CHARS = 20;

interface StepDef {
  id: string;
  title: string;
  icon: LucideIcon;
  /** 一句总述 */
  lead: string;
  /** 分点说明（更详细、可操作） */
  points: string[];
  /** 高亮目标（data-onb 值）；缺省 = 无洞的全屏说明步 */
  target?: string;
}

const STEPS: StepDef[] = [
  {
    id: 'welcome',
    title: '欢迎使用方寸',
    icon: PenLine,
    lead: '方寸是古典诗词创作画布：把字填进格子里，平仄、押韵即时校验，写完整理成图片或文字分享出去。',
    points: [
      '输入即校验：每填一字，系统立刻提示是否合律、押韵，错误整句标红',
      '字典与韵部就在手边：查释义、同韵字、典故、对仗词，边写边查',
      '接下来的几步会逐个介绍界面控件，全程约一分钟，随时可点「跳过」退出',
    ],
  },
  {
    id: 'new',
    title: '新建画板',
    icon: SquarePlus,
    lead: '想写新作品时，点右上角的「+」（红圈处）新建画板。',
    points: [
      '选体裁：诗（近体／古体）、词（按词牌填）、文（自由诗）三类入口都在这里',
      '写诗再选格式：五绝、七绝、五律、七律等，各自对应不同的字数与格律',
      '写词可按词牌名搜索（例如「浣溪沙」），词牌会给出全词分段与字数',
      '一首画板可连写多首组成组诗：写完第一首，点正文下方的「添加一首」继续',
      '需要时还能从该面板「导入前人作品」或导入「方寸」画板集备份',
    ],
  },
  {
    id: 'canvas',
    title: '正文网格',
    icon: LayoutGrid,
    target: 'onb-canvas',
    lead: '这是创作的主战场（红圈内整片区域），像填字游戏一样逐字落笔。',
    points: [
      '点击格子输入汉字，光标自动前进；Tab 与方向键也可移动，回车换行',
      '未填的空位显示为 □；系统实时标注平仄、韵脚与断句标点，不合律的整句会标红',
      '点击任意已填字，下方字典立即查询它的读音、韵部与释义，可顺手取同韵字',
      '想反复推敲时点正文右上角书本按钮：左侧呼出灵感板，右侧呼出韵部面板',
    ],
  },
  {
    id: 'rhyme',
    title: '韵书与韵部',
    icon: BookMarked,
    target: 'onb-rhyme',
    lead: '右侧韵部面板帮你按韵找字：押韵不再靠死记韵书，现查现填。',
    points: [
      '面板顶部可切换韵书：平水韵、词林正韵、中华通韵、上古诗经韵、上古楚辞韵',
      '它会跟随当前句显示韵脚所属韵部与同韵字，点某个韵字即可填入正文光标处',
      '点击韵脚字、或在下方字典结果里点韵部标签，都能联动跳到对应韵部',
      '窄屏没有常驻右侧栏时，点正文右上角书本按钮呼出同样的韵部抽屉',
    ],
  },
  {
    id: 'dict',
    title: '字典查字',
    icon: Search,
    target: 'onb-dict',
    lead: '画布下方是查字台：查读音、韵部、释义与典故，还能顺藤摸瓜找词组。',
    points: [
      '输入单个汉字立即出结果：平仄、各韵书韵部、现代释义与上古释义',
      '「词首／词末」按首字或末字找词组，可按平仄与字数筛选',
      '「对语／同位」查对仗词语，点击可把下联送入网格对仗位置；「典故」给出处与例句',
      '点结果条右侧的纸飞机图标，把词送入正文当前光标处',
    ],
  },
  {
    id: 'meta',
    title: '日期·序·脚注',
    icon: ScrollText,
    target: 'onb-meta',
    lead: '红圈按钮打开「日期 / 序 / 脚注」面板，给作品补全信息与署名，导出时会自动带上。',
    points: [
      '署名：填写后导出图片、复制文字时自动带上（也可在设置里设默认署名）',
      '日期：可一键填「今天」或「最后修改」，支持公历与农历自由切换',
      '序、脚注在面板里编辑；组诗时每首另有独立小节，可单独配置日期／序言／脚注',
      '某首想单独隐藏日期也有开关；这些信息都不影响格律校验，可随时回来补',
    ],
  },
  {
    id: 'export',
    title: '出图分享',
    icon: ImageDown,
    target: 'onb-export',
    lead: '写完后点右上角「导出」（红圈处），把作品带出方寸。',
    points: [
      '复制文字：整首（含标题、组诗各首）一键拷贝，纯文本或 Markdown 可在设置里选',
      '导出图片：挑主题配色与字体、选左／居中／两端对齐；组诗可拆成多张图，长按保存',
      '还可导出 Markdown、上传南洋吟游；整包画板备份在 设置 → 导入导出',
      '导出图片要求正文完整（无 □ 空位）；想先存草稿随时回来继续写',
    ],
  },
  {
    id: 'manage',
    title: '画板管理与更多',
    icon: Layers,
    target: 'onb-boards',
    lead: '作品多了以后，用左上角「画板」（红圈处）来管理它们。',
    points: [
      '新建、切换、删除画板都在这个面板里；支持文件夹分组与自定义排序',
      '右上「设置」里有完整图文教程，也随时可点「新手引导」把这套引导再看一遍',
      '「格律参考」（书本图标）打开韵书、词谱、诗格等静态手册',
      '引导到此结束——现在就可以去正文网格写上第一句试试了',
    ],
  },
];

function readDismissed(): boolean {
  try { return localStorage.getItem(KEY) === '1'; } catch { return false; }
}

function writeDismissed() {
  try { localStorage.setItem(KEY, '1'); } catch { /* ignore */ }
}

/** 顶部按钮的 title 回退选择器（data-onb 缺失时兜底） */
const FALLBACK_TITLES: Record<string, string> = {
  'onb-boards': '切换画板',
  'onb-meta': '日期 / 序 / 脚注',
  'onb-ref': '格律参考',
  'onb-settings': '设置',
  'onb-export': '导出',
  'onb-new': '新建画板',
};

/** 选取高亮目标：优先 data-onb，再回退 header 里的按钮 title；取第一个可见且非零尺寸者 */
function pickSpotElement(key: string): HTMLElement | null {
  let nodes = Array.from(document.querySelectorAll<HTMLElement>(`[data-onb="${key}"]`));
  if (nodes.length === 0) {
    const title = FALLBACK_TITLES[key];
    if (title) {
      nodes = Array.from(document.querySelectorAll<HTMLElement>(`header button[title="${title}"]`));
    }
  }
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  return nodes.find(el => {
    const r = el.getBoundingClientRect();
    return r.width > 2 && r.height > 2 && r.left < vw - 4 && r.right > 4 && r.top < vh - 4 && r.bottom > 4;
  }) ?? null;
}

interface Spot { left: number; top: number; width: number; height: number; bottom: number; }

const sameSpot = (a: Spot, b: Spot) =>
  Math.abs(a.left - b.left) < 0.5 && Math.abs(a.top - b.top) < 0.5 &&
  Math.abs(a.width - b.width) < 0.5 && Math.abs(a.height - b.height) < 0.5;

/** 示例画板是否从未被用户改动（用于结束引导时回收） */
function isPristineDemo(b: Board): boolean {
  if (b.genre !== 'Shi' || b.sections.length !== 1) return false;
  if (!b.title.startsWith('新建·')) return false;
  const sec = b.sections[0];
  if (sec.title) return false;
  if (sec.sectionPreface || sec.sectionFootnote || sec.sectionDate) return false;
  if (sec.sectionDateHidden || sec.sectionLegacyId || sec.immersive) return false;
  if (sec.punctOverrides && Object.keys(sec.punctOverrides).length > 0) return false;
  if (sec.auxMarks && Object.keys(sec.auxMarks).length > 0) return false;
  if (Object.keys(sec.candidatesMap).length > 0) return false;
  if (!sec.poemChars.every(ch => ch === PLACEHOLDER || ch === '')) return false;
  if (b.inspirationCards.length > 0) return false;
  const md = b.metadata ?? {};
  if (md.author || md.date || md.preface || md.footnote || md.legacyId || md.dateHidden) return false;
  return true;
}

export function Onboarding() {
  const { state, dispatch } = useBoardContext();
  // 本次会话来源：'auto'（0 板首启自动弹）或 'manual'（设置里手动开启）；null = 未在展示
  const [session, setSession] = useState<'auto' | 'manual' | null>(null);
  const [step, setStep] = useState(0);
  // 当前高亮目标几何（窗口坐标）；null = 无目标或目标不可见
  const [spot, setSpot] = useState<Spot | null>(null);

  // 自动场景创建的示例画板 id（仅 auto 会话；只在 effect / 事件里读写）
  const demoIdRef = useRef<string | null>(null);

  const show = session !== null;

  // 会话开启（一次性副作用，放 rAF 回调内以避开 effect 内同步 setState 的告警）：
  //  - auto：0 板且未看过 → 建示例画板（让正文/字典/韵部真实出现）并收起体裁选择弹层
  //  - manual：设置里手动开启
  useLayoutEffect(() => {
    if (session) return;
    const auto = !readDismissed() && state.boards.length === 0;
    if (!auto && !state.onboardingOpen) return;
    const raf = requestAnimationFrame(() => {
      if (auto) {
        const board = createBoard('Shi', DEMO_RULE, DEMO_CHARS);
        setSession('auto');
        demoIdRef.current = board.id;
        // 同步标为「引导展示中」：示例画板建成后正文网格不抢焦点，
        // 避免移动端输入法自动弹出（manual 场景由设置入口先置 true）
        dispatch({ type: 'SET_ONBOARDING', open: true });
        dispatch({ type: 'ADD_BOARD', board });
        dispatch({ type: 'SHOW_GENRE_SELECTOR', show: false });
        track('onboarding_show');
      } else {
        setSession('manual');
        track('onboarding_show');
      }
    });
    return () => cancelAnimationFrame(raf);
  }, [session, state.boards.length, state.onboardingOpen, dispatch]);

  // 度量当前步骤的高亮目标
  const measure = useCallback(() => {
    const def = STEPS[step];
    if (!def.target) { setSpot(prev => prev ? null : prev); return; }
    const el = pickSpotElement(def.target);
    if (!el) { setSpot(prev => prev ? null : prev); return; }
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) { setSpot(prev => prev ? null : prev); return; }
    const next: Spot = { left: r.left, top: r.top, width: r.width, height: r.height, bottom: r.bottom };
    setSpot(prev => (prev && sameSpot(prev, next)) ? prev : next);
  }, [step]);

  // 步骤切换：先在点击回调里量好目标（元素都已挂载），再提交新步骤
  const jumpTo = useCallback((next: number) => {
    const def = STEPS[next];
    if (!def.target) {
      setSpot(null);
    } else {
      const el = pickSpotElement(def.target);
      if (el) {
        const r = el.getBoundingClientRect();
        setSpot({ left: r.left, top: r.top, width: r.width, height: r.height, bottom: r.bottom });
      } else {
        setSpot(null);
      }
    }
    setStep(next);
  }, []);

  // 步骤提交后再经双 rAF 复核一次（等异步内容/布局落定）
  useLayoutEffect(() => {
    if (!show) return;
    const raf1 = requestAnimationFrame(measure);
    const raf2 = requestAnimationFrame(() => requestAnimationFrame(measure));
    return () => { cancelAnimationFrame(raf1); cancelAnimationFrame(raf2); };
  }, [show, step, measure]);

  // 窗口 resize / 内部 scroll / 布局变化（字典展开、异步列表等）时校正高亮位置
  useEffect(() => {
    if (!show) return;
    const refresh = () => measure();
    window.addEventListener('resize', refresh);
    window.addEventListener('scroll', refresh, true);
    document.addEventListener('scroll', refresh, true);
    const timer = window.setInterval(refresh, 500);
    return () => {
      window.removeEventListener('resize', refresh);
      window.removeEventListener('scroll', refresh, true);
      document.removeEventListener('scroll', refresh, true);
      window.clearInterval(timer);
    };
  }, [show, measure]);

  const closeTour = useCallback((end: 'done' | 'skip') => {
    track(end === 'done' ? 'onboarding_done' : 'onboarding_skip');
    writeDismissed();
    dispatch({ type: 'SET_ONBOARDING', open: false });
    const demo = state.boards.find(b => b.id === demoIdRef.current);
    if (demo && isPristineDemo(demo)) {
      // 未被改动的示例画板 → 回收；DELETE_BOARD 在 0 板时会自动弹回体裁选择
      dispatch({ type: 'DELETE_BOARD', id: demo.id });
    }
    demoIdRef.current = null;
    setSession(null);
    setStep(0);
  }, [dispatch, state.boards]);

  if (!show) return null;

  const def = STEPS[step];
  const Icon = def.icon;
  const isLast = step === STEPS.length - 1;
  const hasTarget = !!def.target;

  // 卡片摆放：目标偏下方（如字典/韵部/正文）→ 置顶；否则置底；无目标步 → 垂直居中
  const spotBottom = spot?.bottom ?? 0;
  const cardTopMode = hasTarget && spot != null && spotBottom > window.innerHeight - 330;
  const cardCenter = !hasTarget || spot == null;
  const cardJustify = cardCenter ? 'center' : cardTopMode ? 'flex-start' : 'flex-end';
  const cardPadTop = cardTopMode ? 76 : undefined;
  const cardPadBottom = !cardCenter && !cardTopMode ? 20 : undefined;

  const handleNext = () => {
    if (isLast) { closeTour('done'); return; }
    jumpTo(step + 1);
  };

  return (
    <div className="fixed inset-0 z-[80] pointer-events-none animate-[onboarding-in_0.22s_ease-out]">
      {/* 遮暗层：有目标时四块挖洞矩形（洞内可交互），无目标时整屏暗色 */}
      {hasTarget && spot ? (
        <>
          <div className="onb-dim pointer-events-auto absolute left-0 right-0 top-0"
            style={{ height: spot.top, transition: 'height .18s ease' }} />
          <div className="onb-dim pointer-events-auto absolute left-0 right-0"
            style={{ top: spot.bottom, bottom: 0, transition: 'top .18s ease' }} />
          <div className="onb-dim pointer-events-auto absolute"
            style={{ top: spot.top, height: spot.height, left: 0, width: spot.left, transition: 'width .18s ease, height .18s ease' }} />
          <div className="onb-dim pointer-events-auto absolute"
            style={{ top: spot.top, height: spot.height, right: 0, left: spot.left + spot.width, transition: 'left .18s ease, width .18s ease, height .18s ease' }} />
          {/* 高亮描边 */}
          <div
            className="onb-ring absolute"
            style={{
              left: spot.left - 3, top: spot.top - 3,
              width: spot.width + 6, height: spot.height + 6,
              transition: 'left .18s ease, top .18s ease, width .18s ease, height .18s ease',
            }}
          />
        </>
      ) : (
        <div className="onb-dim pointer-events-auto absolute inset-0" />
      )}

      {/* 引导卡（自身可点击） */}
      <div
        className="absolute inset-0 flex flex-col items-center"
        style={{
          justifyContent: cardJustify,
          paddingTop: cardPadTop,
          paddingBottom: cardPadBottom,
        }}
      >
        <div
          role="dialog"
          aria-label={def.title}
          className="pointer-events-auto w-[min(25rem,calc(100vw-2rem))] bg-[var(--bg-card)] rounded-2xl onb-card-shadow overflow-hidden"
        >
          {/* 头部：步数 + 跳过 */}
          <div className="flex items-center justify-between px-5 pt-3.5">
            <span className="text-[11px] text-[var(--text-muted)] tracking-wide">
              {step + 1} / {STEPS.length}
            </span>
            <button
              className="flex items-center gap-0.5 text-xs text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors"
              onClick={() => closeTour('skip')}
            >
              跳过 <X size={12} />
            </button>
          </div>

          {/* 内容（每步切换时轻微上移淡入） */}
          <div key={def.id} className="px-5 pt-2.5 pb-4 max-h-[52vh] overflow-y-auto animate-[onboarding-in_0.25s_ease-out]">
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-lg bg-[var(--accent-light)] text-[var(--accent)] flex items-center justify-center shrink-0">
                <Icon size={16} strokeWidth={1.9} />
              </span>
              <h3 className="text-[15px] font-semibold text-[var(--text)]">{def.title}</h3>
            </div>
            <p className="mt-2.5 text-[13px] text-[var(--text-secondary)] leading-relaxed">{def.lead}</p>
            <ul className="mt-3 space-y-1.5">
              {def.points.map(p => (
                <li key={p} className="flex gap-2 text-[13px] text-[var(--text-secondary)] leading-relaxed">
                  <span className="shrink-0 w-[5px] h-[5px] rounded-full bg-[var(--accent)] mt-[7px]" />
                  <span>{p}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* 进度点 */}
          <div className="flex justify-center gap-1.5 pb-3">
            {STEPS.map((s, i) => (
              <span
                key={s.id}
                className={`h-1.5 rounded-full transition-all duration-200 ${i === step ? 'w-4 bg-[var(--accent)]' : 'w-1.5 bg-[var(--border)]'}`}
              />
            ))}
          </div>

          {/* 底部操作 */}
          <div className="flex items-center justify-between px-5 pb-4 gap-2">
            {step > 0 ? (
              <button
                className="flex items-center gap-1 px-3 py-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text)] hover:bg-[var(--accent-light)] rounded-lg transition-colors"
                onClick={() => jumpTo(step - 1)}
              >
                <ChevronLeft size={14} /> 上一步
              </button>
            ) : (
              <span className="w-14" />
            )}
            {isLast ? (
              <button
                className="px-5 py-1.5 rounded-lg text-sm font-medium bg-[var(--accent)] text-white hover:opacity-90 transition-opacity"
                onClick={() => closeTour('done')}
              >
                开始创作
              </button>
            ) : (
              <button
                className="flex items-center gap-1 px-5 py-1.5 rounded-lg text-sm font-medium bg-[var(--accent)] text-white hover:opacity-90 transition-opacity"
                onClick={handleNext}
              >
                下一步 <ChevronRight size={14} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
