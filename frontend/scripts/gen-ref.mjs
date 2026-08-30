#!/usr/bin/env node
/**
 * gen-ref.mjs — 生成 /ref/ 静态参考页（韵书总览 · 词谱格律 · 诗格速查 · 教程）
 *
 * 输出: frontend/public/ref/**   （vite dev 直接服务；build 时随 public 拷入 dist）
 * 数据源: static/config/{rhyme_books,ci_rules,shi_rules}.json
 *
 * 页面清单：
 *   index.html            韵书总览 · 平水韵（默认）
 *   cilinzhengyun.html    韵书总览 · 词林正韵
 *   shangguyun.html       韵书总览 · 上古韵
 *   zhonghua.html         韵书总览 · 中华通韵
 *   cipai.html           词谱格律（列表 + JS 搜索/展开）＋ cipai-data.js
 *   shi.html             诗格速查（五七言 × 律绝 × 平仄起 8 格式）
 *   tutorial.html        格律入门教程（5 篇）
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const CFG = join(ROOT, 'static', 'config');
const OUT = join(ROOT, 'frontend', 'public', 'ref');

const rhymeBooks = JSON.parse(readFileSync(join(CFG, 'rhyme_books.json'), 'utf8'));
const ciRules = JSON.parse(readFileSync(join(CFG, 'ci_rules.json'), 'utf8'));
const shiRules = JSON.parse(readFileSync(join(CFG, 'shi_rules.json'), 'utf8'));

/* ---------------------------------- 工具 ---------------------------------- */

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const TONE_CHAR = { P: '平', Z: '仄', A: '中' };

/** 从押韵规则 AST 收集韵脚位置（0 基字符下标；SAME_CATEGORY + RELATION，与 checker 一致） */
function collectRhymePositions(node, out = new Set()) {
  if (!node) return out;
  if (node.type === 'SAME_CATEGORY') (node.positions || []).forEach((p) => out.add(p));
  else if (node.type === 'RELATION') {
    out.add(node.pos1);
    (Array.isArray(node.pos2) ? node.pos2 : [node.pos2]).forEach((p) => out.add(p));
  } else if (node.rules) node.rules.forEach((r) => collectRhymePositions(r, out));
  return out;
}

/* 韵脚配色 —— 与方寸编辑器 GridEditor 完全一致 */
const PING_COLORS = ['#559977', '#779955', '#888855', '#669966'];
const ZE_COLORS = ['#557799', '#775599', '#885588', '#666699'];
const YE_COLOR = '#d97706';

/** 复刻编辑器 buildRhymeColorMap：SAME_CATEGORY 分组 + neighbor 合并，平韵/仄韵分色板，叶韵橙色 */
function buildRhymeColorMap(tonePattern, rhymeRule) {
  const map = new Map();
  const sameCatGroups = [];
  const relations = [];
  const walk = (node) => {
    const t = node && node.type;
    if (!t) return;
    if (t === 'OR') { if (node.rules && node.rules[0]) walk(node.rules[0]); }
    else if (t === 'AND') (node.rules || []).forEach(walk);
    else if (t === 'SAME_CATEGORY') sameCatGroups.push(node.positions || []);
    else if (t === 'RELATION') relations.push(node);
  };
  walk(rhymeRule);

  const groups = sameCatGroups
    .map((g) => ({ positions: g, posSet: new Set(g) }))
    .filter((g, i, arr) => !arr.some((other, j) => j !== i && other.posSet.size > g.posSet.size && g.positions.every((p) => other.posSet.has(p))));

  const groupOf = groups.map((_, i) => i);
  const find = (i) => (groupOf[i] === i ? i : (groupOf[i] = find(groupOf[i])));
  const union = (a, b) => { groupOf[find(a)] = find(b); };
  const posToGroup = new Map();
  groups.forEach((g, gi) => g.positions.forEach((p) => posToGroup.set(p, gi)));
  for (const rel of relations) {
    if (rel.relation === 'neighbor') {
      const ga = posToGroup.get(rel.pos1);
      const p2list = Array.isArray(rel.pos2) ? rel.pos2 : [rel.pos2];
      for (const p2 of p2list) {
        const gb = posToGroup.get(p2);
        if (ga != null && gb != null) union(ga, gb);
      }
    }
  }

  const rootToColorIdx = new Map();
  let colorCounter = 0;
  groups.forEach((_, i) => { const root = find(i); if (!rootToColorIdx.has(root)) rootToColorIdx.set(root, colorCounter++); });
  const totalGroups = rootToColorIdx.size;

  const flat = [];
  for (const t of tonePattern || []) {
    if (Array.isArray(t)) flat.push(...t[0]);
    else flat.push(t);
  }
  const toneOf = (pos) => flat[pos]?.tone ?? 'P';

  groups.forEach((g, gi) => {
    const cIdx = rootToColorIdx.get(find(gi)) ?? 0;
    const pal = totalGroups > 1 ? cIdx : 0;
    for (const pos of g.positions) {
      const tone = toneOf(pos);
      const palette = tone === 'Z' ? ZE_COLORS : PING_COLORS;
      map.set(pos, palette[totalGroups > 1 ? cIdx % palette.length : 0]);
    }
  });

  for (const rel of relations) {
    if (rel.relation.startsWith('ye_')) {
      const p2list = Array.isArray(rel.pos2) ? rel.pos2 : [rel.pos2];
      for (const p of p2list) map.set(p, YE_COLOR);
    }
  }
  return map;
}

/** 变体谱源：龙谱/钦谱/其他 */
const SRC_RANK = { 龙谱: 0, 钦谱: 1, 其他: 2 };
function variantSource(name, cipai) {
  const rest = name.startsWith(cipai + '_') ? name.slice(cipai.length + 1) : name;
  const src = rest.split('_')[0];
  return src === '钦谱' || src === '龙谱' ? src : '其他';
}
function sourceBadge(src) {
  const cls = src === '钦谱' ? 'badge badge-qin' : src === '龙谱' ? 'badge badge-long' : 'badge badge-other';
  const label = src === '其他' ? '他谱' : src;
  return `<span class="${cls}">${label}</span>`;
}

/** 词牌平仄渲染：韵脚后句号、非韵脚句末逗号、读顿号（与 checker 可读词谱一致） */
function renderCiPattern(tp, rhymes, rhymeColors) {
  let out = '';
  let row = '';
  let idx = 0;
  const flush = () => { if (row) { out += `<div class="tp-row">${row}</div>`; row = ''; } };
  for (const t of tp) {
    if (Array.isArray(t)) {
      row += `<span class="alt">(${t.map((opt) => opt.map((x) => TONE_CHAR[x.tone] || '·').join('')).join('|')})</span>`;
      idx += t[0].length;
      continue;
    }
    const ch = TONE_CHAR[t.tone] || '·';
    const color = rhymeColors?.get(idx);
    row += color ? `<span style="color:${color};font-weight:600">${ch}</span>` : `<span>${ch}</span>`;
    if (rhymes.has(idx)) { row += '<span class="punc">。</span>'; flush(); }
    else if (t.comment === '句') row += '<span class="punc">，</span>';
    else if (t.comment === '读') row += '<span class="punc">、</span>';
    idx++;
  }
  flush();
  return out;
}

/** 诗格平仄渲染：与 checker 可读词谱一致——变体块取第一选项，按行断句（韵脚句末句号，其余句末逗号） */
function renderShiPattern(tp, rhymes, lineLen, rhymeColors) {
  const flat = [];
  for (const t of tp) {
    if (Array.isArray(t)) flat.push(...t[0]);
    else flat.push(t);
  }
  let out = '';
  flat.forEach((t, idx) => {
    const ch = TONE_CHAR[t.tone] || '·';
    const color = rhymeColors?.get(idx);
    out += color ? `<span style="color:${color};font-weight:600">${ch}</span>` : `<span>${ch}</span>`;
    if (lineLen > 0 && (idx + 1) % lineLen === 0) {
      out += rhymes.has(idx) ? '<span class="punc">。</span>' : '<span class="punc">，</span>';
    }
  });
  return out;
}

/** 词牌名简写：去掉 "词牌_谱_格" 前缀 */
function shortName(full, cipai) {
  if (full.startsWith(cipai + '_')) return full.slice(cipai.length + 1);
  return full;
}

const ciyun = (genre, rule, chars, title) =>
  `/?ciyun=1&genre=${genre}&rule=${encodeURIComponent(rule)}&chars=${chars}&title=${encodeURIComponent(title)}`;

/* ------------------------------- 页面骨架 -------------------------------- */

const TABS = [
  { href: '/ref/index.html', label: '韵书' },
  { href: '/ref/char.html', label: '查字' },
  { href: '/ref/cipai.html', label: '词谱' },
  { href: '/ref/shi.html', label: '诗格' },
  { href: '/ref/tutorial.html', label: '教程' },
];

const BOOK_NAV = [
  { href: '/ref/index.html', key: 'Pingshuiyun', label: '平水韵', desc: '106 韵' },
  { href: '/ref/cilinzhengyun.html', key: 'Cilinzhengyun', label: '词林正韵', desc: '19 部' },
  { href: '/ref/shangguyun.html', key: 'Shangguyun', label: '上古韵', desc: '23 部' },
  { href: '/ref/zhonghua.html', key: 'Zhonghua_Tongyun', label: '中华通韵', desc: '16 韵' },
];

const SHARED_CSS = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Noto Serif SC", "Songti SC", system-ui, serif; background: #FAF8F5; color: #5C534A; line-height: 1.8; font-size: 15px; }
  a { color: #557799; text-decoration: none; }
  a:hover { text-decoration: underline; }
  .topbar { position: sticky; top: 0; z-index: 20; background: #FAF8F5; border-bottom: 1px solid #e8e4e0; }
  .topbar-inner { max-width: 880px; margin: 0 auto; padding: 10px 20px; display: flex; align-items: center; gap: 16px; flex-wrap: wrap; }
  .brand { font-size: 17px; font-weight: 700; color: #5C534A; letter-spacing: 2px; display: flex; align-items: center; gap: 7px; }
  .brand-logo { width: 22px; height: 22px; border-radius: 6px; flex-shrink: 0; }
  .brand:hover { text-decoration: none; }
  .tabs { display: flex; gap: 4px; flex-wrap: wrap; }
  .tab { padding: 5px 12px; border-radius: 8px; font-size: 14px; color: #8a8178; }
  .tab:hover { background: #f0ece6; text-decoration: none; color: #5C534A; }
  .tab.active { background: #557799; color: #fff; }
  .back { margin-left: auto; font-size: 13px; color: #8a8178; white-space: nowrap; }
  .back:hover { color: #557799; }
  .back-short { display: none; }
  .container { max-width: 880px; margin: 0 auto; padding: 36px 20px 80px; }
  h1 { font-size: 26px; font-weight: 700; margin-bottom: 6px; line-height: 1.4; }
  .subtitle { font-size: 14px; color: #a09890; margin-bottom: 8px; }
  .intro { font-size: 14.5px; color: #6b6360; margin-bottom: 28px; }
  h2 { font-size: 20px; font-weight: 600; margin: 40px 0 14px; padding-bottom: 6px; border-bottom: 2px solid #e8e4e0; }
  h3 { font-size: 16.5px; font-weight: 600; margin: 24px 0 10px; }
  p { margin: 10px 0; }
  .book-nav { display: flex; gap: 8px; flex-wrap: wrap; margin: 18px 0 26px; }
  .book-nav a { padding: 7px 14px; border-radius: 9px; border: 1px solid #e0dad2; font-size: 14px; color: #6b6360; background: #fff; }
  .book-nav a.active { background: #557799; border-color: #557799; color: #fff; }
  .book-nav a:hover { text-decoration: none; border-color: #557799; }
  .tone-group { margin: 6px 0 22px; }
  .tone-group-title { font-size: 15px; font-weight: 600; color: #7a7066; margin: 22px 0 8px; display: flex; align-items: baseline; gap: 8px; }
  .tone-group-title .cnt { font-size: 12px; color: #a09890; font-weight: 400; }
  details.cat { background: #fff; border: 1px solid #ece7e1; border-radius: 10px; margin-bottom: 8px; overflow: hidden; position: relative; }
  details.cat > summary { cursor: pointer; padding: 9px 14px; font-size: 14.5px; display: flex; align-items: center; gap: 10px; list-style: none; user-select: none; border-radius: 10px; }
  details.cat > summary::-webkit-details-marker { display: none; }
  details.cat > summary::before { content: "▸"; color: #b9b0a6; font-size: 12px; transition: transform .15s; }
  details.cat[open] > summary::before { transform: rotate(90deg); }
  details.cat > summary:hover { background: #faf7f3; }
  details.cat > summary .name { font-weight: 600; }
  details.cat > summary .cnt { font-size: 12px; color: #a09890; margin-left: auto; }
  .cat-dot { width: 12px; height: 12px; border-radius: 50%; flex-shrink: 0; display: inline-block; box-shadow: 0 0 0 1px rgba(0,0,0,0.06); }
  .cat-ring { display: none; position: absolute; right: -46px; bottom: -46px; width: 172px; height: 172px; border-radius: 50%; border: 26px solid var(--rc-w); pointer-events: none; z-index: -1; align-items: center; justify-content: center; }
  details.cat[open] .cat-ring { display: flex; }
  .chars .cat-ring span { font-size: 80px; font-weight: 400; color: var(--rc-w); font-family: "ml", "Noto Serif SC", serif; line-height: 1; letter-spacing: 0; }
  .sw { display: inline-block; width: 12px; height: 12px; border-radius: 4px; vertical-align: -1px; margin: 0 3px; }
  .chars { padding: 4px 16px 14px; display: flex; flex-wrap: wrap; gap: 2px 10px; position: relative; z-index: 1; }
  .credit { font-size: 12.5px; color: #a09890; margin: 0 0 18px; }
  .sub-group { flex: 1 1 100%; margin: 4px 0 10px; }
  .sub-name { font-size: 12.5px; color: #557799; font-weight: 600; margin-bottom: 3px; }
  .sub-name .cnt { color: #a09890; font-weight: 400; }
  .sub-chars { display: flex; flex-wrap: wrap; gap: 2px 10px; }
  .sub-chars span { font-size: 14.5px; color: #4c443c; letter-spacing: 1px; }
  .chars span { font-size: 15px; color: #4c443c; letter-spacing: 1px; }
  .chars .dim { color: #c4bcb2; }
  .search { width: 100%; max-width: 380px; padding: 9px 14px; border-radius: 9px; border: 1px solid #e0dad2; font-size: 14px; background: #fff; color: #5C534A; margin-bottom: 18px; }
  .search:focus { outline: none; border-color: #557799; }
  .legend { font-size: 12.5px; color: #8a8178; margin: 4px 0 16px; display: flex; gap: 14px; flex-wrap: wrap; }
  .legend b { font-weight: 600; }
  .legend .yun { color: #b3543c; }
  .tp { font-size: 15px; letter-spacing: 1px; color: #4c443c; background: #fff; border: 1px solid #ece7e1; border-radius: 10px; padding: 12px 16px; margin: 8px 0 14px; line-height: 2; }
  .tp-row { display: block; }
  .tp b.yun { color: #b3543c; font-weight: 700; }
  .tp .punc { color: #c4bcb2; }
  .tp .alt { color: #557799; }
  .cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(380px, 1fr)); gap: 16px; }
  @media (max-width: 640px) { .cards { grid-template-columns: 1fr; } }
  .card { background: #fff; border: 1px solid #ece7e1; border-radius: 12px; padding: 18px 20px; }
  .card h3 { margin: 0 0 6px; font-size: 16px; }
  .card .meta { font-size: 12.5px; color: #a09890; margin-bottom: 10px; }
  .card p { margin: 8px 0; font-size: 14px; }
  .card ul { margin: 8px 0 8px 20px; }
  .card li { margin: 3px 0; font-size: 14px; }
  .card .ex { background: #faf7f3; border-left: 3px solid #d8c9b8; border-radius: 0 8px 8px 0; padding: 8px 12px; margin: 10px 0 0; font-size: 13.5px; }
  .card details { margin-top: 8px; }
  .card details > summary { cursor: pointer; font-size: 13.5px; color: #557799; display: flex; align-items: center; }
  .card details > summary .write-btn { float: none; margin-left: auto; }
  .card .tp { margin: 6px 0 0; font-size: 14px; }
  .article { background: #fff; border: 1px solid #ece7e1; border-radius: 12px; padding: 26px 28px; margin-bottom: 22px; }
  .article h2 { border: none; margin: 0 0 4px; padding: 0; font-size: 19px; }
  .article .a-meta { font-size: 12.5px; color: #a09890; margin-bottom: 12px; }
  .article ul, .article ol { margin: 8px 0 8px 22px; }
  .article li { margin: 4px 0; }
  .article code { background: #f4f0ea; border-radius: 5px; padding: 1px 6px; font-size: 13.5px; color: #6d5648; }
  .article .ex { background: #faf7f3; border-left: 3px solid #d8c9b8; border-radius: 0 8px 8px 0; padding: 10px 14px; margin: 12px 0; font-size: 14px; }
  .article .ex .yz { color: #b3543c; font-weight: 700; }
  .cta { display: inline-block; margin-top: 10px; padding: 8px 18px; border-radius: 9px; background: #557799; color: #fff; font-size: 14px; }
  .cta:hover { background: #46688a; text-decoration: none; }
  .toc { background: #fff; border: 1px solid #ece7e1; border-radius: 12px; padding: 16px 22px; margin-bottom: 26px; }
  .toc h2 { border: none; margin: 0 0 8px; padding: 0; font-size: 15px; color: #8a8178; }
  .toc ol { margin-left: 20px; }
  .toc li { margin: 3px 0; font-size: 14.5px; }
  .cipai-list .item { background: #fff; border: 1px solid #ece7e1; border-radius: 10px; margin-bottom: 8px; }
  .cipai-list .item > button { width: 100%; text-align: left; padding: 10px 16px; border: none; background: none; cursor: pointer; font-size: 14.5px; display: flex; align-items: baseline; gap: 12px; color: #4c443c; font-family: inherit; }
  .cipai-list .item > button:hover { background: #faf7f3; }
  .cipai-list .item > button .cname { font-weight: 600; }
  .cipai-list .item > button .cinfo { font-size: 12px; color: #a09890; }
  .cipai-list .item .detail { padding: 0 16px 14px; border-top: 1px dashed #ece7e1; }
  .cipai-list .variant { margin: 10px 0; }
  .cipai-list .variant .vname { font-size: 13px; color: #8a8178; margin-bottom: 4px; }
  .cipai-list .variant .tp { margin: 0; font-size: 13.5px; }
  .filters { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 16px; }
  .filters button { padding: 6px 14px; border-radius: 18px; border: 1px solid #e0dad2; background: #fff; font-size: 13px; color: #6b6360; cursor: pointer; font-family: inherit; }
  .filters button.active { background: #557799; border-color: #557799; color: #fff; }
  .filters button:hover { border-color: #557799; }
  .tabs2 { display: flex; gap: 2px; border-bottom: 2px solid #ece7e1; margin-bottom: 22px; }
  .tab2 { padding: 9px 18px; font-size: 15px; color: #8a8178; background: none; border: none; border-bottom: 2px solid transparent; margin-bottom: -2px; cursor: pointer; font-family: inherit; }
  .tab2:hover { color: #5C534A; }
  .tab2.active { color: #557799; font-weight: 600; border-bottom-color: #557799; }
  .badge { display: inline-block; padding: 1px 9px; border-radius: 10px; font-size: 11.5px; font-weight: 600; margin-right: 6px; vertical-align: 1.5px; }
  .badge-qin { background: #eef2f8; color: #4a6d94; border: 1px solid #c9d8e8; }
  .badge-long { background: #f7eef2; color: #8a4a63; border: 1px solid #e3c9d6; }
  .badge-other { background: #f4f1ec; color: #8a8178; border: 1px solid #e0d8cc; }
  .write-btn { float: right; display: inline-block; padding: 1px 14px; border-radius: 999px; font-size: 12.5px; border: 1px solid #557799; color: #557799; background: #fff; cursor: pointer; text-decoration: none; margin-left: 8px; }
  .write-btn:hover { background: #557799; color: #fff; text-decoration: none; }
  .ch-chip { padding: 4px 14px; border-radius: 18px; border: 1px solid #e0dad2; background: #fff; font-size: 13px; color: #6b6360; cursor: pointer; font-family: inherit; margin: 0 6px 6px 0; }
  .ch-chip:hover { border-color: #557799; color: #557799; }
  .example-chips { margin: 4px 0 18px; }
  .char-hero { display: flex; align-items: center; gap: 14px; margin: 8px 0 22px; }
  .char-hero .big { font-size: 54px; font-weight: 400; line-height: 1.2; color: #4c443c; font-family: "ml", "Noto Serif SC", serif; }
  .def-block { margin: 0 0 22px; }
  .def-reading { margin: 7px 0; }
  .def-py { font-size: 13px; color: #557799; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; margin-bottom: 2px; }
  .def-item { font-size: 13.5px; margin: 2px 0; color: #4c443c; }
  .def-no { color: #a09890; margin-right: 4px; font-size: 12px; }
  .def-c { font-size: 11.5px; color: #a09890; padding-left: 18px; margin-top: 2px; line-height: 1.6; }
  .chip { display: inline-block; padding: 2px 10px; border-radius: 999px; font-size: 12.5px; border: 1px solid; margin: 2px 4px 2px 0; text-decoration: none; }
  .sg-line { margin: 3px 0; }
  .sg-reading { font-size: 12.5px; color: #6b6360; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
  .loading { text-align: center; padding: 30px 0; color: #a09890; }
  .timeline { margin: 8px 0 10px; }
  .tl-item { position: relative; padding: 0 0 18px 30px; border-left: 2px solid #ece7e1; }
  .tl-item:last-child { border-left-color: transparent; padding-bottom: 0; }
  .tl-dot { position: absolute; left: -8px; top: 3px; width: 14px; height: 14px; border-radius: 50%; border: 2px solid #fff; box-shadow: 0 0 0 1px rgba(0,0,0,0.08); }
  .tl-head { font-size: 14.5px; font-weight: 600; color: #5C534A; margin: 0 0 6px; }
  .tl-body { font-size: 13.5px; }
  .more-btn { display: block; margin: 14px auto; padding: 8px 22px; border-radius: 9px; border: 1px solid #e0dad2; background: #fff; font-size: 13.5px; color: #6b6360; cursor: pointer; font-family: inherit; }
  .more-btn:hover { border-color: #557799; color: #557799; }
  .empty { color: #a09890; font-size: 14px; text-align: center; padding: 30px 0; }
  footer { border-top: 1px solid #e8e4e0; margin-top: 60px; padding: 20px; text-align: center; font-size: 12.5px; color: #b9b0a6; }
  footer a { color: #8a8178; }
  /* 移动端顶栏压缩为单行（目标 ≥375px 宽度） */
  @media (max-width: 700px) {
    .topbar-inner { padding: 8px 10px; gap: 10px; flex-wrap: nowrap; }
    .brand { font-size: 14px; letter-spacing: 1px; gap: 5px; }
    .brand-logo { width: 20px; height: 20px; }
    .tabs { gap: 2px; flex-wrap: nowrap; }
    .tab { padding: 4px 8px; font-size: 13px; }
    .back { font-size: 13px; }
    .back-long { display: none; }
    .back-short { display: inline; }
  }
`;

function page({ title, desc, activeTab, content, extraHead = '' }) {
  const tabsHtml = TABS.map((t) => `<a class="tab${t.href === activeTab ? ' active' : ''}" href="${t.href}">${t.label}</a>`).join('');
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${esc(title)} | 方寸</title>
<meta name="description" content="${esc(desc)}" />
<link rel="icon" type="image/svg+xml" href="/logo.svg" />
${extraHead}
<style>${SHARED_CSS}</style>
</head>
<body>
<header class="topbar">
  <div class="topbar-inner">
    <a class="brand" href="/"><img class="brand-logo" src="/logo.svg" alt="方寸" />方寸</a>
    <nav class="tabs">${tabsHtml}</nav>
    <a class="back" href="/"><span class="back-long">← 返回创作</span><span class="back-short">← 返回</span></a>
  </div>
</header>
<main class="container">
${content}
</main>
<footer>方寸 · 诗词创作画布 — <a href="/">写诗</a> · <a href="/ref/poetry-tools.html">工具对比</a> · <a href="/docs">API 文档</a></footer>
</body>
</html>`;
}

/* ------------------------------- 韵书页面 -------------------------------- */

/** 上古韵页首介绍（用户提供） */
const SHANGGUYUN_INTRO = '采用 nulll 拟音方案，对标王力上古韵体系设计邻韵通押，适合爱好者使用。';
const SHANGGUYUN_CREDIT = 'Contributor：上海交通大学国学社·「南洋小学」音韵学兴趣小组——@nulll @知母tr @lyy0323';

/** 上古韵小韵排序：平/上/去/入/次入，同调按小韵名 */
const SG_TONE_RANK = { 平: 0, 上: 1, 去: 2, 入: 3, 次入: 4 };
function sgSubKey(sub) {
  let tone = SG_TONE_RANK[sub.slice(-1)] ?? 5;
  let base = sub;
  if (sub.endsWith('次入')) { tone = 4; base = sub.slice(0, -2); }
  else if (SG_TONE_RANK[base.slice(-1)] !== undefined) base = base.slice(0, -1);
  return [tone, base];
}

/** 平水韵 106 韵配色（与「平水韵诗词上色器」一致：平声亮 / 上声暗 / 去声暗 / 入声浊） */
const PINGSHUI_COLORS = {"一东":[192,80,80],"二冬":[204,80,80],"三江":[36,80,80],"四支":[216,80,80],"五微":[228,80,80],"六鱼":[60,80,80],"七虞":[72,80,80],"八齐":[240,80,80],"九佳":[252,80,80],"十灰":[264,80,80],"十一真":[84,80,80],"十二文":[96,80,80],"十三元":[108,80,80],"十四寒":[120,80,80],"十五删":[132,80,80],"一先":[144,80,80],"二萧":[324,80,80],"三肴":[336,80,80],"四豪":[348,80,80],"五歌":[0,80,80],"六麻":[12,80,80],"七阳":[24,80,80],"八庚":[156,80,80],"九青":[168,80,80],"十蒸":[180,80,80],"十一尤":[48,80,80],"十二侵":[312,80,80],"十三覃":[300,80,80],"十四盐":[288,80,80],"十五咸":[276,80,80],"一董":[192,80,20],"二肿":[204,80,20],"三讲":[36,80,20],"四纸":[216,80,20],"五尾":[228,80,20],"六语":[60,80,20],"七麌":[72,80,20],"八荠":[240,80,20],"九蟹":[252,80,20],"十贿":[264,80,20],"十一轸":[84,80,20],"十二吻":[96,80,20],"十三阮":[108,80,20],"十四旱":[120,80,20],"十五潸":[132,80,20],"十六铣":[144,80,20],"十七筱":[324,80,20],"十八巧":[336,80,20],"十九皓":[348,80,20],"二十哿":[0,80,20],"二十一马":[12,80,20],"二十二养":[24,80,20],"二十三梗":[156,80,20],"二十四迥":[180,80,20],"二十五有":[48,80,20],"二十六寝":[312,80,20],"二十七感":[300,80,20],"二十八俭":[288,80,20],"二十九豏":[276,80,20],"一送":[192,80,30],"二宋":[204,80,30],"三绛":[36,80,30],"四寘":[216,80,30],"五未":[228,80,30],"六御":[60,80,30],"七遇":[72,80,30],"八霁":[240,80,30],"九泰":[252,80,30],"十卦":[264,80,30],"十一队":[84,80,30],"十二震":[96,80,30],"十三问":[108,80,30],"十四愿":[120,80,30],"十五翰":[132,80,30],"十六谏":[144,80,30],"十七霰":[324,80,30],"十八啸":[336,80,30],"十九效":[348,80,30],"二十号":[0,80,30],"二十一个":[12,80,30],"二十二祃":[24,80,30],"二十三漾":[156,80,30],"二十四敬":[168,80,30],"二十五径":[180,80,30],"二十六宥":[48,80,30],"二十七沁":[312,80,30],"二十八勘":[300,80,30],"二十九艳":[288,80,30],"三十陷":[276,80,30],"一屋":[192,30,20],"二沃":[204,30,20],"三觉":[36,30,20],"四质":[84,30,20],"五物":[96,30,20],"六月":[108,30,20],"七曷":[120,30,20],"八黠":[132,30,20],"九屑":[144,30,20],"十药":[24,30,20],"十一陌":[156,30,20],"十二锡":[168,30,20],"十三职":[180,30,20],"十四缉":[312,30,20],"十五合":[300,30,20],"十六叶":[288,30,20],"十七洽":[276,30,20]};

/** 词林正韵各分部 ↔ 平水韵韵目对应（公开资料；灰/泰/队/元 的半部分别归入相邻两部） */
const CILIN_PINGSHUI = {
  1: { 平: ['一东', '二冬'], 仄: ['一董', '二肿', '一送', '二宋'] },
  2: { 平: ['三江', '七阳'], 仄: ['三讲', '二十二养', '三绛', '二十三漾'] },
  3: { 平: ['四支', '五微', '八齐', '十灰'], 仄: ['四纸', '五尾', '八荠', '十贿', '四寘', '五未', '八霁', '九泰', '十一队'] },
  4: { 平: ['六鱼', '七虞'], 仄: ['六语', '七麌', '六御', '七遇'] },
  5: { 平: ['九佳', '十灰'], 仄: ['九蟹', '十贿', '十卦', '十一队'] },
  6: { 平: ['十一真', '十二文', '十三元'], 仄: ['十一轸', '十二吻', '十三阮', '十二震', '十三问', '十四愿'] },
  7: { 平: ['十三元', '十四寒', '十五删', '一先'], 仄: ['十三阮', '十四旱', '十五潸', '十六铣', '十四愿', '十五翰', '十六谏', '十七霰'] },
  8: { 平: ['二萧', '三肴', '四豪'], 仄: ['十七筱', '十八巧', '十九皓', '十八啸', '十九效', '二十号'] },
  9: { 平: ['五歌'], 仄: ['二十哿', '二十一个'] },
  10: { 平: ['六麻'], 仄: ['二十一马', '二十二祃'] },
  11: { 平: ['八庚', '九青', '十蒸'], 仄: ['二十三梗', '二十四迥', '二十四敬', '二十五径'] },
  12: { 平: ['十一尤'], 仄: ['二十五有', '二十六宥'] },
  13: { 平: ['十二侵'], 仄: ['二十六寝', '二十七沁'] },
  14: { 平: ['十三覃', '十四盐', '十五咸'], 仄: ['二十七感', '二十八俭', '二十九豏', '二十八勘', '二十九艳', '三十陷'] },
  15: { 入: ['一屋', '二沃'] },
  16: { 入: ['三觉', '十药'] },
  17: { 入: ['四质', '十一陌', '十二锡', '十三职', '十四缉'] },
  18: { 入: ['五物', '六月', '七曷', '八黠', '九屑', '十六叶'] },
  19: { 入: ['十五合', '十七洽'] },
};

/** HSL 均值（色相取圆均，避免 0/360 缠绕） */
function hslMean(list) {
  const n = list.length;
  let sx = 0, cx = 0;
  for (const [h] of list) { const a = h * Math.PI / 180; sx += Math.sin(a); cx += Math.cos(a); }
  let h = Math.round(Math.atan2(sx / n, cx / n) * 180 / Math.PI);
  if (h < 0) h += 360;
  const s = Math.round(list.reduce((a, c) => a + c[1], 0) / n);
  const l = Math.round(list.reduce((a, c) => a + c[2], 0) / n);
  return { h, s, l };
}

/** 词林正韵配色：每子类取对应平水韵韵部 HSL 均值；环内字取首韵目代表字 */
const CILIN_COLORS = {};
for (const [no, tones] of Object.entries(CILIN_PINGSHUI)) {
  for (const [tone, names] of Object.entries(tones)) {
    const list = names.map((n) => PINGSHUI_COLORS[n]).filter(Boolean);
    if (!list.length) continue;
    const mean = hslMean(list);
    CILIN_COLORS[`第${no}部_${tone}`] = { ...mean, ring: names[0].slice(-1) };
  }
}

const PINGSHUI_GROUPS = [
  ['上平', ['一东','二冬','三江','四支','五微','六鱼','七虞','八齐','九佳','十灰','十一真','十二文','十三元','十四寒','十五删']],
  ['下平', ['一先','二萧','三肴','四豪','五歌','六麻','七阳','八庚','九青','十蒸','十一尤','十二侵','十三覃','十四盐','十五咸']],
  ['上声', ['一董','二肿','三讲','四纸','五尾','六语','七麌','八荠','九蟹','十贿','十一轸','十二吻','十三阮','十四旱','十五潸','十六铣','十七筱','十八巧','十九皓','二十哿','二十一马','二十二养','二十三梗','二十四迥','二十五有','二十六寝','二十七感','二十八俭','二十九豏']],
  ['去声', ['一送','二宋','三绛','四寘','五未','六御','七遇','八霁','九泰','十卦','十一队','十二震','十三问','十四愿','十五翰','十六谏','十七霰','十八啸','十九效','二十号','二十一个','二十二祃','二十三漾','二十四敬','二十五径','二十六宥','二十七沁','二十八勘','二十九艳','三十陷']],
  ['入声', ['一屋','二沃','三觉','四质','五物','六月','七曷','八黠','九屑','十药','十一陌','十二锡','十三职','十四缉','十五合','十六叶','十七洽']],
];

/** 词林/中华通韵排序：第N部 或 数字序号 + 平仄入 */
function sortByName(names) {
  const cnNum = { 一:1, 二:2, 三:3, 四:4, 五:5, 六:6, 七:7, 八:8, 九:9, 十:10, 十一:11, 十二:12, 十三:13, 十四:14, 十五:15, 十六:16, 十七:17, 十八:18, 十九:19, 二十:20 };
  const toneRank = { 平: 0, 仄: 1, 入: 2 };
  const numOf = (s) => {
    if (!s) return 99;
    if (/^\d+$/.test(s)) return parseInt(s, 10);
    return cnNum[s] ?? 99;
  };
  return [...names].sort((a, b) => {
    const ma = a.match(/(?:第)?(\d+|[一二三四五六七八九十]+)(?:部)?(?:_([平仄入]))?/);
    const mb = b.match(/(?:第)?(\d+|[一二三四五六七八九十]+)(?:部)?(?:_([平仄入]))?/);
    const na = numOf(ma?.[1]);
    const nb = numOf(mb?.[1]);
    if (na !== nb) return na - nb;
    return (toneRank[ma?.[2]] ?? 0) - (toneRank[mb?.[2]] ?? 0);
  });
}

/** 渲染一个韵部的 details 块 */
function catDetails(cat, color) {
  const chars = (cat.characters || []).map((c) => `<span>${esc(c)}</span>`).join('');
  const hsl = color ? `hsl(${color.h}, ${color.s}%, ${color.l}%)` : '';
  const dot = color ? `<span class="cat-dot" style="background:${hsl}"></span>` : '';
  // 展开后右下角半透明圆环（溢出部分被卡片裁切），环内写韵部代表字（沐瓴体、放大、同色同透明）
  const ring = color ? `<div class="cat-ring" style="--rc-w:hsla(${color.h},${color.s}%,${color.l}%,0.25)"><span>${esc(color.ring || cat.name.slice(-1))}</span></div>` : '';
  return `<details class="cat"${color ? ` style="--rc:${hsl}"` : ''}><summary>${dot}<span class="name">${esc(cat.name)}</span><span class="cnt">${cat.characters?.length ?? 0} 字</span></summary><div class="chars">${chars || '<span class="dim">（无数据）</span>'}${ring}</div></details>`;
}

function buildRhymePage(bookKey, { navLabel, seoTitle, seoDesc, subtitle, legendColor, credit, groups, colorOf, catRenderer, extraHead }) {
  const book = rhymeBooks[bookKey];
  const cats = book.categories;
  const nav = BOOK_NAV.map((b) => `<a class="${b.key === bookKey ? 'active' : ''}" href="${b.href}">${b.label} ${b.desc}</a>`).join('');
  const filterJs = `
  <script>
    (function () {
      var input = document.getElementById('cat-search');
      if (!input) return;
      function apply() {
        var q = input.value.trim();
        // 按 wrapper（带 data-name/data-chars）过滤韵部卡片
        document.querySelectorAll('[data-name]').forEach(function (d) {
          var name = d.getAttribute('data-name') || '';
          var chars = d.getAttribute('data-chars') || '';
          d.style.display = (!q || name.indexOf(q) !== -1 || chars.indexOf(q) !== -1) ? '' : 'none';
        });
        // 全部隐藏的声调组连标题一起收起
        document.querySelectorAll('.tone-group').forEach(function (g) {
          var any = false;
          g.querySelectorAll('[data-name]').forEach(function (d) {
            if (d.style.display !== 'none') any = true;
          });
          g.style.display = any ? '' : 'none';
        });
      }
      input.addEventListener('input', apply);
      // ?q=字 自动查询（查字页 badge 跳转而来）：过滤、展开并滚动到首个命中韵部
      var q = new URLSearchParams(location.search).get('q');
      if (q) {
        input.value = q;
        apply();
        var first = Array.prototype.find.call(document.querySelectorAll('[data-name]'), function (d) {
          return d.style.display !== 'none';
        });
        if (first) {
          var de = first.querySelector('details.cat');
          if (de) de.setAttribute('open', '');
          first.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
    })();
  </script>`;
  let body = `<h1>${seoTitle}</h1>
<p class="subtitle">${subtitle}</p>
${credit ? `<p class="credit">${credit}</p>` : ''}
<div class="book-nav">${nav}</div>
<input id="cat-search" class="search" type="search" placeholder="搜索韵部名或韵字…" />
<div class="legend">${legendColor || ''}<span>点击展开查看韵字</span></div>`;
  for (const [gName, names] of groups) {
    let html = '';
    for (const n of names) {
      const cat = cats[n];
      if (!cat) continue;
      html += `<div data-name="${esc(cat.name)}" data-chars="${esc((cat.characters || []).join(''))}">${catRenderer ? catRenderer(cat) : catDetails(cat, colorOf?.(cat.name))}</div>`;
    }
    if (html) body += `<div class="tone-group"><div class="tone-group-title">${gName}<span class="cnt">${names.length} 韵</span></div>${html}</div>`;
  }
  body += filterJs;
  return page({ title: seoTitle, desc: seoDesc, activeTab: '/ref/index.html', content: body, extraHead });
}

function buildPingshuiPage() {
  const book = rhymeBooks.Pingshuiyun;
  const cats = book.categories;
  const groups = PINGSHUI_GROUPS.map(([g, names]) => [g, names]);
  return buildRhymePage('Pingshuiyun', {
    navLabel: '平水韵',
    seoTitle: '平水韵 106 韵部总览 — 上平·下平·上声·去声·入声韵字查询',
    seoDesc: '平水韵 106 韵部完整对照：上平 15 韵、下平 15 韵、上声 29 韵、去声 30 韵、入声 17 韵。查询各韵部韵字，写律诗绝句押韵必备。',
    subtitle: `平水韵是近体诗（律诗、绝句）押韵所依据的传统韵书。它承宋代《礼部韵略》一系韵书，因金元间刊行于平水（今山西临汾）而得名，明清以来一直是科举与格律诗创作通行的押韵标准。`,
    groups,
    colorOf: (name) => { const c = PINGSHUI_COLORS[name]; return c ? { h: c[0], s: c[1], l: c[2], ring: name.slice(-1) } : undefined; },
    extraHead: '<link rel="stylesheet" href="/fonts/ml/result.css" />',
  });
}

function buildCilinPage() {
  const cats = rhymeBooks.Cilinzhengyun.categories;
  const names = sortByName(Object.keys(cats));
  const groups = [['词林正韵 19 部（平·仄·入分部）', names]];
  return buildRhymePage('Cilinzhengyun', {
    navLabel: '词林正韵',
    seoTitle: '词林正韵 19 部韵字总览 — 填词押韵查询',
    seoDesc: '词林正韵 19 部完整对照，含平声、仄声、入声分部韵字。填词押韵标准韵书，平上去三声同部、入声独立。',
    subtitle: `词林正韵为清嘉庆年间戈载所编，是填词押韵的主要依据。全书以唐宋名家词的实际用韵为据分十九部，平、上、去三声同部相配，入声独用，为后世词家所宗。`,
    groups,
    colorOf: (name) => CILIN_COLORS[name],
    extraHead: '<link rel="stylesheet" href="/fonts/ml/result.css" />',
  });
}

function buildShangguyunPage() {
  const cats = rhymeBooks.Shangguyun.categories;
  // 从 char_dict 读音建立 部 → 小韵 → 字 映射（字序保持韵书频率序，同小韵去重）
  const charDict = JSON.parse(readFileSync(join(CFG, 'char_dict.json'), 'utf8'));
  const subMap = {};
  for (const [catName, cat] of Object.entries(cats)) {
    const m = new Map();
    for (const ch of cat.characters) {
      for (const r of charDict[ch]?.shangguyun || []) {
        if (r.cat !== catName) continue;
        if (!m.has(r.sub)) m.set(r.sub, new Set());
        m.get(r.sub).add(ch);
      }
    }
    subMap[catName] = m;
  }
  const catRenderer = (cat) => {
    const m = subMap[cat.name];
    const subs = [...m.entries()].sort((a, b) => {
      const ka = sgSubKey(a[0]);
      const kb = sgSubKey(b[0]);
      return ka[0] - kb[0] || (ka[1] < kb[1] ? -1 : ka[1] > kb[1] ? 1 : 0);
    });
    const inner = subs
      .map(([subName, set]) =>
        `<div class="sub-group"><div class="sub-name">${esc(subName)}<span class="cnt"> ${set.size} 字</span></div><div class="sub-chars">${[...set].map((c) => `<span>${esc(c)}</span>`).join('')}</div></div>`
      )
      .join('');
    return `<details class="cat"><summary><span class="name">${esc(cat.name)}</span><span class="cnt">${cat.characters.length} 字 · ${subs.length} 小韵</span></summary><div class="chars">${inner}</div></details>`;
  };
  const names = Object.keys(cats);
  const groups = [['上古韵 23 部（按小韵细分）', names]];
  return buildRhymePage('Shangguyun', {
    navLabel: '上古韵',
    seoTitle: '上古韵 23 韵部总览 — 《诗经》《楚辞》押韵查询',
    seoDesc: '上古音系 23 韵部完整对照（鱼铎、之职、幽觉、脂质至等），依据先秦音系归纳，《诗经》《楚辞》用韵查询，适合拟古体与仿先秦之作。',
    subtitle: SHANGGUYUN_INTRO,
    credit: SHANGGUYUN_CREDIT,
    groups,
    catRenderer,
  });
}

function buildZhonghuaPage() {
  const cats = rhymeBooks.Zhonghua_Tongyun.categories;
  const names = sortByName(Object.keys(cats));
  const groups = [['中华通韵 16 韵（平·仄分部）', names]];
  return buildRhymePage('Zhonghua_Tongyun', {
    navLabel: '中华通韵',
    seoTitle: '中华通韵 16 韵部总览 — 普通话押韵查询',
    seoDesc: '中华通韵 16 韵完整对照（一啊、二喔、三鹅…十六儿），按现代普通话归韵，无入声，适合现代语感创作与自由诗押韵。',
    subtitle: `中华通韵是当代通行的新韵书，由中华诗词学会组织专家依据现代汉语普通话审音归韵编订，不设入声，便于以现代语感创作旧体诗词。`,
    groups,
  });
}

/* ------------------------------- 词谱页面 -------------------------------- */

const FAMOUS_CIPAI = ['忆江南','如梦令','长相思','浣溪沙','菩萨蛮','卜算子','采桑子','清平乐','西江月','浪淘沙','鹧鸪天','虞美人','蝶恋花','临江仙','江城子','念奴娇','满江红','水调歌头','沁园春','青玉案','声声慢','一剪梅','定风波','南歌子','渔歌子','捣练子','醉花阴','鹊桥仙','踏莎行','木兰花','苏幕遮','阮郎归','天仙子','千秋岁','八声甘州','水龙吟','摸鱼儿','永遇乐','贺新郎','桂枝香','满庭芳','扬州慢','雨霖铃','兰陵王','暗香','疏影','燕山亭','多丽','望江南'];

/** 词牌平仄压成紧凑串（P/Z/A + 。韵脚/，句末/、读），供 cipai-data.js 使用 */
function compactCiTone(rule) {
  const rhymes = collectRhymePositions(rule.rhyme_rule);
  let tp = '';
  let idx = 0;
  for (const t of rule.tone_pattern || []) {
    if (Array.isArray(t)) { tp += '(' + t.map((o) => o.map((x) => x.tone).join('')).join('|') + ')'; idx += t[0].length; continue; }
    tp += t.tone || '';
    if (rhymes.has(idx)) tp += '。';
    else if (t.comment === '句') tp += '，';
    else if (t.comment === '读') tp += '、';
    idx++;
  }
  return tp;
}

function ciVariantHtml(rule) {
  const rhymes = collectRhymePositions(rule.rhyme_rule);
  const colors = buildRhymeColorMap(rule.tone_pattern, rule.rhyme_rule);
  const tp = renderCiPattern(rule.tone_pattern || [], rhymes, colors);
  const src = variantSource(rule.name, rule.cipai);
  const rk = rule.rhyme_rule?.type;
  const rhymeDesc = rk === 'AND' ? '复合押韵（多组）' : rk === 'OR' ? '多式押韵' : '同部押韵';
  const short = shortName(rule.name, rule.cipai);
  const gex = src === '其他' ? short : short.replace(src + '_', '');
  const writeHref = `/?ciyun=1&genre=Ci&rule=${encodeURIComponent(rule.name)}&chars=${rule.char_count}&title=${encodeURIComponent(rule.cipai)}`;
  return `<div class="variant">
    <div class="vname">${sourceBadge(src)}${esc(gex)} · ${rule.char_count} 字 · ${rhymeDesc} · 韵脚 ${rhymes.size} 处<a class="write-btn" href="${writeHref}" title="新建画板并跳转创作区">写</a></div>
    <div class="tp">${tp}</div>
  </div>`;
}

function buildCipaiPage() {
  // 常用词牌（服务端渲染，利于 SEO）；钦龙皆有时龙谱在前
  const famousList = FAMOUS_CIPAI.map((name) =>
    ciRules.find((r) => r.cipai === name && r.name.includes('龙谱')) || ciRules.find((r) => r.cipai === name)
  ).filter(Boolean);
  const famous = famousList
    .map((r) => `<details class="cat" open><summary><span class="name">${esc(r.cipai)}</span><span class="cnt">${r.char_count} 字 · ${shortName(r.name, r.cipai)}</span></summary><div class="detail" style="padding:0 16px 12px">${ciVariantHtml(r)}</div></details>`)
    .join('');

  const appJs = `
  <script>
  (function () {
    var data = window.CIPAI_DATA || [];
    // 按词牌聚合
    var groups = new Map();
    data.forEach(function (r) {
      var g = groups.get(r.c) || { c: r.c, v: [], min: Infinity, max: 0 };
      g.v.push(r);
      g.min = Math.min(g.min, r.ch); g.max = Math.max(g.max, r.ch);
      groups.set(r.c, g);
    });
    var all = Array.from(groups.values()).sort(function (a, b) { return (a.min - b.min) || a.c.localeCompare(b.c, 'zh'); });
    // 钦龙皆有：龙谱在前（组内变体排序）
    all.forEach(function (g) {
      g.v.sort(function (a, b) {
        var ra = a.src === '龙谱' ? 0 : a.src === '钦谱' ? 1 : 2;
        var rb = b.src === '龙谱' ? 0 : b.src === '钦谱' ? 1 : 2;
        return ra - rb;
      });
    });
    var PAGE = 100, shown = 0, filtered = all, totalEl = document.getElementById('c-total');
    var listEl = document.getElementById('c-list'), emptyEl = document.getElementById('c-empty');
    function TONE(t) { return t === 'P' ? '平' : t === 'Z' ? '仄' : t === 'A' ? '中' : '·'; }
    var PINGS = ['#559977', '#779955', '#888855', '#669966'];
    var ZES = ['#557799', '#775599', '#885588', '#666699'];
    function colorOf(code) {
      if (!code) return '#5C534A';
      if (code === 'Y') return '#d97706';
      return code.charAt(0) === 'P' ? PINGS[+code.charAt(1)] : ZES[+code.charAt(1)];
    }
    function badgeOf(src) {
      if (src === '钦谱') return '<span class="badge badge-qin">钦谱</span>';
      if (src === '龙谱') return '<span class="badge badge-long">龙谱</span>';
      return '<span class="badge badge-other">他谱</span>';
    }
    function renderVariant(r) {
      var rows = [];
      var row = '', idx = 0;
      function flush() { if (row) { rows.push(row); row = ''; } }
      for (var i = 0; i < r.tp.length; i++) {
        var ch = r.tp[i];
        if (ch === '。') { row += '<span class="punc">。</span>'; flush(); continue; }
        if (ch === '，' || ch === '、') { row += '<span class="punc">' + ch + '</span>'; continue; }
        if (ch === '(') {
          var j = r.tp.indexOf(')', i);
          var alts = r.tp.slice(i + 1, j).split('|').map(function (s) { return s.split('').map(TONE).join(''); }).join('｜');
          row += '<span class="alt">(' + alts + ')</span>';
          i = j; continue;
        }
        var yun = r.rp.indexOf(idx) !== -1;
        if (yun) {
          row += '<span style="color:' + colorOf(r.rc && r.rc[idx]) + ';font-weight:600">' + TONE(ch) + '</span>';
        } else {
          row += '<span>' + TONE(ch) + '</span>';
        }
        idx++;
      }
      flush();
      var rk = r.rk === 'AND' ? '复合押韵' : r.rk === 'OR' ? '多式押韵' : '同部押韵';
      var rest = r.n.replace(r.c + '_', '');
      var gex = (r.src === '钦谱' || r.src === '龙谱') && rest.indexOf(r.src + '_') === 0 ? rest.slice(r.src.length + 1) : rest;
      var writeHref = '/?ciyun=1&genre=Ci&rule=' + encodeURIComponent(r.n) + '&chars=' + r.ch + '&title=' + encodeURIComponent(r.c);
      var tpHtml = rows.map(function (rr) { return '<div class="tp-row">' + rr + '</div>'; }).join('');
      return '<div class="variant"><div class="vname">' + badgeOf(r.src) + gex + ' · ' + r.ch + ' 字 · ' + rk + '<a class="write-btn" href="' + writeHref + '" title="新建画板并跳转创作区">写</a></div><div class="tp">' + tpHtml + '</div></div>';
    }
    function render() {
      listEl.innerHTML = '';
      var slice = filtered.slice(0, shown);
      slice.forEach(function (g) {
        var li = document.createElement('div');
        li.className = 'item';
        var btn = document.createElement('button');
        var first = g.v[0];
        var chInfo = g.min === g.max ? g.min + ' 字' : g.min + '–' + g.max + ' 字';
        btn.innerHTML = '<span class="cname">' + g.c + '</span><span class="cinfo">' + chInfo + ' · ' + g.v.length + ' 格</span>';
        var detail = document.createElement('div');
        detail.className = 'detail';
        detail.style.display = 'none';
        detail.innerHTML = g.v.map(renderVariant).join('');
        btn.addEventListener('click', function () { detail.style.display = detail.style.display === 'none' ? '' : 'none'; });
        li.appendChild(btn); li.appendChild(detail);
        listEl.appendChild(li);
      });
      document.getElementById('c-more').style.display = shown < filtered.length ? '' : 'none';
      emptyEl.style.display = filtered.length ? 'none' : '';
    }
    var qEl = document.getElementById('c-search');
    qEl.addEventListener('input', function () {
      var q = qEl.value.trim();
      filtered = q ? all.filter(function (g) {
        if (g.c.indexOf(q) !== -1) return true;
        return g.v.some(function (r) { return r.n.indexOf(q) !== -1; });
      }) : all;
      shown = PAGE; render();
    });
    document.querySelectorAll('.filters button').forEach(function (b) {
      b.addEventListener('click', function () {
        document.querySelectorAll('.filters button').forEach(function (x) { x.classList.remove('active'); });
        b.classList.add('active');
        var k = b.getAttribute('data-k');
        filtered = k === 'all' ? all : all.filter(function (g) {
          if (k === 's') return g.max <= 58;
          if (k === 'm') return g.min >= 59 && g.max <= 90;
          return g.min >= 91;
        });
        shown = PAGE; render();
      });
    });
    document.getElementById('c-more').addEventListener('click', function () { shown += PAGE; render(); });
    // 常用词牌 | 搜索 双 Tab 切换
    document.querySelectorAll('.tabs2 .tab2').forEach(function (b) {
      b.addEventListener('click', function () {
        document.querySelectorAll('.tabs2 .tab2').forEach(function (x) { x.classList.remove('active'); });
        b.classList.add('active');
        var t = b.getAttribute('data-tab');
        document.getElementById('tab-famous').style.display = t === 'famous' ? '' : 'none';
        document.getElementById('tab-search').style.display = t === 'search' ? '' : 'none';
      });
    });
    totalEl.textContent = all.length;
    shown = PAGE; render();
  })();
  </script>`;

  const content = `<h1>词谱格律对照</h1>
<p class="subtitle">${ciRules.length} 个词牌变体（钦谱/龙谱等）· ${new Set(ciRules.map((r) => r.cipai)).size} 个词牌 · 可搜索、按字数筛选，点开查看平仄与韵脚</p>
<p class="intro">每个词牌固定字数、句数、句式与平仄。同一词牌常有多种“格”（钦谱、龙谱等谱本差异），钦谱、龙谱皆有时龙谱在前。韵脚配色与方寸编辑器一致：<span style="color:#559977;font-weight:600">平韵</span> <span style="color:#557799;font-weight:600">仄韵</span> <span style="color:#d97706;font-weight:600">叶韵</span>；「中」表示该字可平可仄。按字数分调：<b>小令 ≤58 字 · 中调 59–90 字 · 长调 ≥91 字</b>。</p>
<div class="tabs2">
  <button class="tab2 active" data-tab="famous">常用词牌</button>
  <button class="tab2" data-tab="search">搜索</button>
</div>
<div id="tab-famous">
  <p class="intro" style="margin-top:0">${famousList.length} 个常用词牌速览，点击展开查看句式与韵脚；全部 ${new Set(ciRules.map((r) => r.cipai)).size} 个词牌请在「搜索」中查找。</p>
  ${famous || '<p class="empty">暂无数据</p>'}
</div>
<div id="tab-search" style="display:none">
  <p class="intro" style="margin-top:0">共 <span id="c-total">…</span> 个词牌 · 输入词牌名搜索，或按字数筛选，点击词牌展开查看各格句式与韵脚。</p>
  <input id="c-search" class="search" type="search" placeholder="搜索词牌名，如：浣溪沙 / 水调歌头…" />
  <div class="filters">
    <button data-k="all" class="active">全部</button>
    <button data-k="s">小令 ≤58 字</button>
    <button data-k="m">中调 59–90 字</button>
    <button data-k="l">长调 ≥91 字</button>
  </div>
  <div id="c-list" class="cipai-list"></div>
  <div id="c-empty" class="empty">未找到匹配的词牌</div>
  <button id="c-more" class="more-btn">显示更多</button>
</div>
<script src="/ref/cipai-data.js"></script>
${appJs}`;
  return page({ title: '词谱格律对照 — 词牌平仄·句式·韵脚查询', desc: '词牌格律对照：1000+ 词牌（钦谱/龙谱），查字数、句式、平仄模板、韵脚位置。支持搜索与按字数筛选，在线填词必备。', activeTab: '/ref/cipai.html', content });
}

/* ------------------------------- 诗格页面 -------------------------------- */

const SHI_LABEL = { Qilyu: '七律', Qijue: '七绝', Wulyu: '五律', Wujue: '五绝' };
const SHI_LINES = { Qilyu: 8, Qijue: 4, Wulyu: 8, Wujue: 4 };

function buildShiPage() {
  // 按 格式×平仄起 分组：五绝平起 / 五绝仄起 / 五律平起 / 五律仄起 / 七绝平起 / 七绝仄起 / 七律平起 / 七律仄起
  const formats = [];
  for (const cipai of ['Wujue', 'Wulyu', 'Qijue', 'Qilyu']) {
    for (const qi of ['平起', '仄起']) {
      const rules = shiRules.filter((r) => r.cipai === cipai && r.name.includes(qi));
      if (!rules.length) continue;
      formats.push({ cipai, qi, rules });
    }
  }
  const cards = formats.map((f) => {
    const base = f.rules.find((r) => !r.name.includes('首句入韵')) || f.rules[0];
    const ruYun = f.rules.find((r) => r.name.includes('首句入韵'));
    const lineLen = Math.round((base.char_count || 0) / SHI_LINES[f.cipai]);
    const render = (r) => {
      const rhymes = collectRhymePositions(r.rhyme_rule);
      const tp = renderShiPattern(r.tone_pattern || [], rhymes, lineLen, buildRhymeColorMap(r.tone_pattern, r.rhyme_rule));
      const rk = r.rhyme_rule?.type;
      const rhymeNote = rk === 'OR' ? '二、四、六、八句押韵，首句可入韵' : '二、四、六、八句押韵';
      return `<div class="tp">${tp}</div><div style="font-size:12.5px;color:#a09890">${r.char_count} 字 · ${rhymeNote} · 韵脚 ${rhymes.size} 处</div>`;
    };
    const writeHref = (r) => `/?ciyun=1&genre=Shi&rule=${encodeURIComponent(r.name)}&chars=${r.char_count}&title=${encodeURIComponent(r.name)}`;
    const baseBlock = `<details open><summary><span class="sum-label">标准句式</span><a class="write-btn" href="${writeHref(base)}" title="新建画板并跳转创作区">写</a></summary>${render(base)}</details>`;
    const ruBlock = ruYun ? `<details><summary><span class="sum-label">首句入韵变体</span><a class="write-btn" href="${writeHref(ruYun)}" title="新建画板并跳转创作区">写</a></summary>${render(ruYun)}</details>` : '';
    return `<div class="card">
      <h3>${SHI_LABEL[f.cipai]} · ${f.qi}</h3>
      <div class="meta">${base.char_count} 字 · ${SHI_LINES[f.cipai]} 句 · 每句 ${lineLen} 字 · 平水韵押平声韵</div>
      ${baseBlock}
      ${ruBlock}
    </div>`;
  }).join('');

  const content = `<h1>诗格速查 — 五言七言律诗绝句平仄</h1>
<p class="subtitle">五绝 20 字 · 七绝 28 字 · 五律 40 字 · 七律 56 字 · 共 8 种基本格式</p>
<p class="intro">近体诗每句字数与句数固定，平仄遵循“一句之内交替、一联之内相对、联与联之间相粘”的规则。押平声韵（平水韵），二、四、六、八句押韵，首句可押可不押。韵脚配色与方寸编辑器一致（近体诗押平声韵，故韵脚为<span style="color:#559977;font-weight:600">绿色</span>）；「中」表示该字可平可仄。</p>
<div class="cards">${cards}</div>
<h2>拗救与特殊句式</h2>
<p class="intro">格律并非死板。当某字拗于标准句式时，可在本句或对句的特定位置用平声补救，称「<b>拗救</b>」；另有少数被认可的特殊句式可直接使用。方寸的校验器把这类句式编码为<b>句式变体块</b>——诗句匹配任一合法变体即通过校验；上方 8 种格式卡片展示的是标准句式，拗救变体见本节。</p>
<div class="cards">
  <div class="card">
    <h3>一三五不论，二四六分明？</h3>
    <div class="meta">宽严规律与两个铁律例外</div>
    <p>五言第 1、3 字，七言第 1、3、5 字可平可仄（模板中的「中」），第 2、4、6 字必须严守。但有两条铁律不可破：</p>
    <ul>
      <li><b>孤平</b>：五言「平平仄仄平」首字、七言「仄仄平平仄仄平」第三字若用仄，全句除韵脚外只剩一个平声字，必须补救（见下）。</li>
      <li><b>三平调</b>：句末三字皆平（如「仄仄平平平」）为近体诗大忌，任何变体都不可出现三平尾；句末三仄（三仄尾）亦当避忌。</li>
    </ul>
  </div>
  <div class="card">
    <h3>本句自救 · 孤平拗救</h3>
    <div class="meta">数据变体：平平中仄平 ⇄ 中平平仄平</div>
    <p>「平平仄仄平」句若首字用仄（仄平仄仄平，成孤平），第三字即改用平自救（仄平平仄平）。七言「仄仄平平仄仄平」同理：第三字用仄时，第五字改用平（仄仄仄平平仄平）。</p>
    <div class="ex">例：李白《宿五松山下荀媪家》<br>「寂寥无所欢」→ <b>仄平平仄平</b>：首字「寂」仄，第三字「无」平救。</div>
  </div>
  <div class="card">
    <h3>特拗句 · 锦鲤翻波</h3>
    <div class="meta">数据变体：中平平仄仄 ⇄ 平平仄平仄</div>
    <p>五言「平平平仄仄」第三字拗仄、第四字拗平，成「平平仄平仄」；七言「仄仄平平平仄仄」成「仄仄平平仄平仄」。这是律诗中<b>被认可的特定句式</b>（多用于首联或尾联），无需补救。</p>
    <div class="ex">例：王维《辋川闲居赠裴秀才迪》「寒山转苍翠」→ <b>平平仄平仄</b><br>杜甫《江南逢李龟年》「正是江南好风景」→ <b>仄仄平平仄平仄</b></div>
  </div>
  <div class="card">
    <h3>对句相救</h3>
    <div class="meta">出句拗仄 ⇄ 对句平救，两句绑定</div>
    <p>五言出句「仄仄平平仄」第四字拗仄（仄仄平仄仄），对句「平平仄仄平」第三字即改用平（平平平仄平）；七言相应为出句第六字拗、对句第五字救。两处必须成对出现——数据中两句合为一个变体块整体匹配。</p>
    <div class="ex">例：杜甫《奉济驿重送严公四韵》<br>「远送从此别」→ <b>仄仄平仄仄</b>（第四字「此」拗仄）<br>「青山空复情」→ <b>平平平仄平</b>（第三字「空」平救）</div>
  </div>
</div>
<p class="intro" style="margin-top:14px"><b>小结</b>：拗救的本质是维持句内与联内的平仄平衡——孤平句补平以保平声底线，对句相救以平补仄。在方寸中，标准句式与拗救句式都算正确，无须手工判断；输入诗句后若有平仄标红，先对照本节检查是否属合法的拗救句式。</p>`;
  return page({ title: '诗格速查 — 五绝·七绝·五律·七律平仄格式', desc: '近体诗八种基本格式速查：五绝、七绝、五律、七律的平起/仄起句式与首句入韵变体，附平仄模板、韵脚位置与拗救（孤平自救、特拗句、对句相救）讲解。', activeTab: '/ref/shi.html', content });
}

/* ------------------------------- 查字页面 -------------------------------- */

const CHAR_EXAMPLES = ['中', '白', '月', '山', '风'];

function buildCharPage() {
  const examples = CHAR_EXAMPLES.map((c) => `<button class="ch-chip" data-ch="${esc(c)}">${c}</button>`).join('');
  const appJs = `
  <script>
  (function () {
    // Android 端与 SPA 一致：checker 走远程（本地 5050 仅服务 shiva 释义/字典）
    var IS_ANDROID = /FangcunAndroid/.test(navigator.userAgent);
    var CHECKER = IS_ANDROID ? 'https://checker.sjtuguoxue.space/api' : '/api';
    var BOOKS = [
      { key: 'Shangguyun', label: '上古韵' },
      { key: 'Pingshuiyun', label: '平水韵' },
      { key: 'Cilinzhengyun', label: '词林正韵' },
      { key: 'Zhonghua_Tongyun', label: '中华通韵' }
    ];
    var BOOK_PAGE = {
      Shangguyun: '/ref/shangguyun.html',
      Pingshuiyun: '/ref/index.html',
      Cilinzhengyun: '/ref/cilinzhengyun.html',
      Zhonghua_Tongyun: '/ref/zhonghua.html'
    };
    var input = document.getElementById('ch-input');
    var resultEl = document.getElementById('ch-result');
    var timer = null;
    function enc(s) { return encodeURIComponent(s); }
    function toneColor(t) { return t === 'P' ? '#559977' : '#557799'; }
    async function query() {
      var text = input.value.trim();
      var m = text.match(/[\\u3400-\\u9fff]/);
      if (!m) { resultEl.innerHTML = '<div class="empty">请输入一个汉字</div>'; return; }
      var char = m[0];
      resultEl.innerHTML = '<div class="loading">查询中…</div>';
      try {
        var jobs = BOOKS.map(function (b) {
          return fetch(CHECKER + '/char/lookup?char=' + enc(char) + '&book=' + enc(b.key))
            .then(function (r) { return r.ok ? r.json() : null; })
            .catch(function () { return null; });
        });
        jobs.push(fetch('/api/char/definitions?char=' + enc(char))
          .then(function (r) { return r.ok ? r.json() : null; })
          .catch(function () { return null; }));
        var res = await Promise.all(jobs);
        render(char, res);
      } catch (e) {
        resultEl.innerHTML = '<div class="empty">查询失败，请检查网络后重试</div>';
      }
    }
    function render(char, res) {
      var defs = (res[4] && res[4].definitions) || [];
      var html = '<div class="char-hero"><span class="big">' + char + '</span></div>';
      // 释义（紧凑直排，无标题）
      if (defs.length) {
        html += '<div class="def-block">';
        defs.forEach(function (rd) {
          html += '<div class="def-reading"><div class="def-py">' + (rd.py || '') + '</div>';
          rd.defs.forEach(function (d, di) {
            html += '<div class="def-item"><span class="def-no">' + '①②③④⑤⑥⑦⑧⑨⑩'[di] + '</span><span>' + d.d + '</span>';
            if (d.c) html += '<div class="def-c">' + d.c + '</div>';
            html += '</div>';
          });
          html += '</div>';
        });
        html += '</div>';
      }
      // 音韵地位 · 时间线（上古 → 平水 → 词林 → 新韵）
      html += '<div class="timeline">';
      BOOKS.forEach(function (b, bi) {
        var data = res[bi];
        var cats = (data && data.rhyme_categories) || [];
        var href = BOOK_PAGE[b.key] + '?q=' + enc(char);
        var dotColor = cats.length ? toneColor(cats[0].tone_type) : '#8a8178';
        html += '<div class="tl-item"><span class="tl-dot" style="background:' + dotColor + '"></span>';
        html += '<div class="tl-head">' + b.label + '</div><div class="tl-body">';
        if (!cats.length) {
          html += '<span class="empty" style="padding:2px 0">未收录</span>';
        } else {
          cats.forEach(function (c) {
            var col = toneColor(c.tone_type);
            if (b.key === 'Shangguyun' && c.readings && c.readings.length) {
              c.readings.forEach(function (r) {
                html += '<div class="sg-line"><a class="chip" style="color:' + col + ';border-color:' + col + '40;background:' + col + '10" href="' + href + '">' + c.name + '</a>' +
                  '<span class="sg-reading">' + r.sub + ' · ' + r.py + (r.rpy ? '（' + r.rpy + '）' : '') + '</span></div>';
              });
            } else {
              html += '<a class="chip" style="color:' + col + ';border-color:' + col + '40;background:' + col + '10" href="' + href + '">' + c.name + '</a>';
            }
          });
        }
        html += '</div></div>';
      });
      html += '</div>';
      html += '</div>';
      resultEl.innerHTML = html;
    }
    input.addEventListener('input', function () { clearTimeout(timer); timer = setTimeout(query, 250); });
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') { clearTimeout(timer); query(); } });
    document.querySelectorAll('.ch-chip').forEach(function (b) {
      b.addEventListener('click', function () { input.value = b.getAttribute('data-ch'); query(); });
    });
  })();
  </script>`;
  const content = `<h1>单字查询 — 释义 · 四部韵书音韵地位</h1>
<p class="subtitle">输入一个汉字，同屏查看其释义，以及它在平水韵、词林正韵、上古韵、中华通韵下的韵部与声调（上古韵含小韵与拟音）。</p>
<input id="ch-input" class="search" type="search" placeholder="输入单字，如：中 / 白 / 月 / 山 / 风…" autofocus />
<div class="example-chips">${examples}</div>
<div id="ch-result"></div>
${appJs}`;
  return page({
    title: '单字查询 — 释义与四部韵书音韵地位',
    desc: '输入一个汉字，同屏查看释义（拼音、说文引文）与平水韵、词林正韵、上古韵（小韵、拟音）、中华通韵下的音韵地位。',
    activeTab: '/ref/char.html',
    extraHead: '<link rel="stylesheet" href="/fonts/ml/result.css" />',
    content,
  });
}

/* ------------------------------- 教程页面 -------------------------------- */

function buildTutorialPage() {
  const articles = [
    {
      id: 'pingze',
      title: '什么是平仄？四声与平仄的关系',
      meta: '入门第一课 · 5 分钟',
      body: `
<p>古汉语有<b>四声</b>：<b>平、上、去、入</b>。格律诗中把它们二分：平声字为「平」，上声、去声、入声字为「仄」。</p>
<p>现代普通话的四声（阴平、阳平、上声、去声）与古四声并不一一对应，最大的差异是<b>入声</b>：如「白、石、国、一、独」在古音里都是入声字，按格律算<b>仄声</b>，普通话里却读成了阴平/阳平。这正是初学者用普通话语感判断平仄最容易出错的地方。</p>
<p>在<b>方寸</b>中：输入诗句即实时逐字校验平仄，不合处会标出；点击任意字可查看它在当前韵书下的声调归属（平 / 仄 / 中）。词谱中常见的「中」表示该字<b>可平可仄</b>。</p>
<div class="ex">例：王之涣《登鹳雀楼》首句<br>白（仄）日（仄）依（平）山（平）尽（仄） → <b>仄仄平平仄</b><br>其中「白」「日」都是古入声字，普通话读平声，格律上仍算仄。</div>
<p>掌握平仄后，可到「诗格速查」页看八种基本格式，或直接在方寸中新建画板，边写边校验。</p>
<a class="cta" href="${ciyun('Shi', '五绝仄起', 20, '五绝试写')}">在方寸中试写一首五绝 →</a>`,
    },
    {
      id: 'lvshi',
      title: '律诗格律入门：平仄、粘对、押韵、对仗',
      meta: '律诗 / 绝句 · 10 分钟',
      body: `
<p>近体诗分<b>绝句</b>（四句）与<b>律诗</b>（八句），每句字数五言或七言：五绝 20 字、七绝 28 字、五律 40 字、七律 56 字。其格律可概括为四件事：<b>平仄、粘对、押韵、对仗</b>。</p>
<h3>平仄</h3>
<p>一句之内平仄交替（如「仄仄平平仄」），一联之内两句的平仄<b>相对</b>（相反），联与联之间相<b>粘</b>（第二句与第三句前两字平仄相同）。由此推演出八种基本格式，见「诗格速查」页。</p>
<h3>押韵</h3>
<p>近体诗押<b>平声韵</b>（平水韵），韵脚在<b>偶数句</b>（二、四、六、八句）；首句可押可不押，押则为「首句入韵」变体。一韵到底，不换韵。</p>
<h3>对仗</h3>
<p>律诗的<b>颔联</b>（三、四句）与<b>颈联</b>（五、六句）必须对仗：词性相对、结构相同。绝句不要求对仗。</p>
<div class="ex">七律仄起首句入韵，前两句示例：<br>〔仄仄平平仄仄平〕 首句入韵<br>〔平平仄仄仄平平〕 与上句相对<br>全 56 字格律模板见「诗格速查」页。</div>
<p>在方寸中新建画板时选好格式，画布会自动标出每位的平仄要求与韵脚位置，逐字填写即实时校验，非常适合练习格律。</p>
<a class="cta" href="${ciyun('Shi', '七律仄起首句入韵', 56, '七律试写')}">在方寸中试写一首七律 →</a>`,
    },
    {
      id: 'cipai',
      title: '词牌怎么填：以《浣溪沙》为例',
      meta: '填词入门 · 10 分钟',
      body: `
<p>词牌是词的曲调名。每个词牌都规定了<b>字数、句数、每句字数、平仄与韵脚位置</b>（合称“句式”）；同一词牌常有钦谱、龙谱等多个“格”（变体）。填词即按句式逐字填写，韵脚字须同韵部（填词用<b>词林正韵</b>）。</p>
<p>以《浣溪沙》钦谱格一为例：<b>42 字，6 句</b>（每句 7 字，上片 3 句、下片 3 句），押平声韵，韵脚在第 1、2、3、5、6 句末（第 4 句不押）：</p>
<div class="ex">上片：中仄中平中仄平（韵），中平中仄仄平平（韵），中平中仄仄平平（韵）<br>下片：中仄中平中仄平，中平中仄仄平平（韵），中平中仄仄平平（韵）</div>
<p>填词步骤：① 选词牌 → ② 看句式逐字填写 → ③ 韵脚字在词林正韵中查同韵部 → ④ 整体校验平仄与押韵。常见入韵字可直接在方寸的韵部面板中查找。</p>
<a class="cta" href="${ciyun('Ci', '浣溪沙_钦谱_格一', 42, '浣溪沙试填')}">在方寸中试填《浣溪沙》 →</a>`,
    },
    {
      id: 'yunshu',
      title: '平水韵 vs 中华通韵 vs 词林正韵：区别与选择',
      meta: '韵书入门 · 6 分钟',
      body: `
<p>方寸内置四部韵书，适用场景不同：</p>
<ul>
<li><b>平水韵</b>（106 韵）：明清以来近体诗押韵的通行标准，保留入声。写律诗、绝句默认用它。</li>
<li><b>词林正韵</b>（19 部）：清·戈载编，填词专用；特点是以平、上、去三声同部（每部内含三声韵字），入声独立成部。填词默认用它。</li>
<li><b>中华通韵</b>（16 韵）：按现代普通话归韵，不分入声，适合现代语感与自由诗；方寸中自由诗默认用它。</li>
<li><b>上古韵</b>（23 部）：依据先秦音系归纳（《诗经》《楚辞》用韵），适合拟古体与仿先秦之作。</li>
</ul>
<h3>怎么选</h3>
<p>写近体诗 → 平水韵；填词 → 词林正韵；现代口语 / 自由诗 → 中华通韵；拟先秦 → 上古韵。在方寸右上角设置中可随时切换韵书，同一画板可改。四部韵书的完整韵部与韵字见「韵书总览」。</p>
<p>提示：同一字在不同韵书中的归属可能不同（尤其入声字与古今音变字），切换韵书后校验结果会相应变化，这是正常现象。</p>
<a class="cta" href="/ref/index.html">查看四部韵书总览 →</a>`,
    },
    {
      id: 'diangu',
      title: '典故入诗：用方寸检索典故',
      meta: '进阶技巧 · 5 分钟',
      body: `
<p>用典能让诗句有纵深，但须准确、贴切、不堆砌。典出何处、原意如何，写之前最好先查证。</p>
<p>在<b>方寸</b>的字典区输入关键词（支持多字），切换到「<b>典故</b>」页，即可看到相关典故条目与出处；点击条目可查看典形词、释义与相关条目，点击典形词可快速入诗。</p>
<h3>使用技巧</h3>
<ul>
<li>先想<b>意象</b>再检索：如写归隐，搜「莼鲈」；写壮志难酬，搜「冯唐」「易老」。</li>
<li>化用其语，不必整句照搬；用典后检查平仄是否合律。</li>
<li>注意典故的<b>时代感</b>与读者接受度，冷僻典故慎用。</li>
</ul>
<div class="ex">例：想表达“思念家乡美食” → 检索「莼鲈」→ 得“莼鲈之思”典（晋·张翰见秋风起而思吴中莼羹鲈脍，遂辞官归乡）→ 化用为「秋风忽动莼鲈思」。</div>
<p>典故检索与词首/词末联想、对语同位等功能共同构成方寸的“推敲”体系，创作时随时点字查询。</p>`,
    },
  ];
  const toc = `<div class="toc"><h2>目录</h2><ol>${articles.map((a) => `<li><a href="#${a.id}">${a.title}</a></li>`).join('')}</ol></div>`;
  const body = articles.map((a) => `<article class="article" id="${a.id}"><h2>${a.title}</h2><p class="a-meta">${a.meta}</p>${a.body}</article>`).join('');
  const content = `<h1>格律入门教程</h1>
<p class="subtitle">从零开始学会写格律诗与填词 · 配合方寸实时校验练习</p>
${toc}
${body}`;
  return page({ title: '格律入门教程 — 平仄·律诗·填词·韵书·用典', desc: '诗词格律入门教程：什么是平仄、律诗格律（粘对押韵对仗）、词牌怎么填（浣溪沙为例）、平水韵/词林正韵/中华通韵区别、典故入诗技巧。', activeTab: '/ref/tutorial.html', content });
}

/* --------------------------------- 主流程 -------------------------------- */

mkdirSync(OUT, { recursive: true });
const COLOR_CODE = {};
PING_COLORS.forEach((c, i) => { COLOR_CODE[c] = 'P' + i; });
ZE_COLORS.forEach((c, i) => { COLOR_CODE[c] = 'Z' + i; });
COLOR_CODE[YE_COLOR] = 'Y';

const compactAll = ciRules.map((r) => {
  const rc = {};
  buildRhymeColorMap(r.tone_pattern, r.rhyme_rule).forEach((color, pos) => { rc[pos] = COLOR_CODE[color]; });
  return {
    n: r.name, c: r.cipai, ch: r.char_count, tp: compactCiTone(r), rp: [...collectRhymePositions(r.rhyme_rule)],
    rk: r.rhyme_rule?.type, src: variantSource(r.name, r.cipai), rc,
  };
});
const files = {
  'index.html': buildPingshuiPage(),
  'cilinzhengyun.html': buildCilinPage(),
  'shangguyun.html': buildShangguyunPage(),
  'zhonghua.html': buildZhonghuaPage(),
  'char.html': buildCharPage(),
  'cipai.html': buildCipaiPage(),
  'cipai-data.js': `/* 自动生成：词牌全量数据（精简字段） */\nwindow.CIPAI_DATA=${JSON.stringify(compactAll)};\n`,
  'shi.html': buildShiPage(),
  'tutorial.html': buildTutorialPage(),
};

for (const [name, html] of Object.entries(files)) {
  writeFileSync(join(OUT, name), html, 'utf8');
  console.log(`  ✓ ${name} (${(html.length / 1024).toFixed(1)} KB)`);
}
console.log(`\n生成完成 → ${OUT}`);
