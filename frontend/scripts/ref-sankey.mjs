#!/usr/bin/env node
/**
 * ref-sankey.mjs — 五部韵书全库韵部流变桑基图（统计口径：按字 + 等权分摊）
 *
 * 数据源：static/config/rhyme_books.json 的权威韵字表（各书 categories[*].characters）。
 *   Universe = 五书字表交集（每书每字取出现过的全部韵部集合）。
 *   结点权重：一个字在某书归属 k 个韵部时，权重 1/k 均分到各部（按字等权）。
 *   链路权重：相邻两层同字连接，字在两层的韵部集合 A、B 间两两均分 1/(|A|·|B|)，
 *   使每一层结点总流量 = 全库字数、逐结点进出守恒。
 *
 * 输出：buildSankey({ rhymeBooks, colors, orders }) → HTML 字符串（可内嵌于 ref 页面顶部）。
 */

export function buildSankey({ rhymeBooks, colors, orders }) {
  const BOOKS = [
    { key: 'ShangguyunShijing', label: '上古诗经韵', order: orders.ShangguyunShijing },
    { key: 'ShangguyunChuci', label: '上古楚辞韵', order: orders.ShangguyunChuci },
    { key: 'Pingshuiyun', label: '平水韵', order: orders.Pingshuiyun },
    { key: 'Cilinzhengyun', label: '词林正韵', order: orders.Cilinzhengyun },
    { key: 'Zhonghua_Tongyun', label: '中华通韵', order: orders.Zhonghua_Tongyun },
  ];
  const N = BOOKS.length;

  /* 1. Universe 与逐字归属（rhyme_books 权威字表） */
  const memberships = BOOKS.map((b) => {
    const m = new Map(); // char -> [cat,...]
    for (const [name, cat] of Object.entries(rhymeBooks[b.key].categories || {})) {
      for (const ch of cat.characters || []) {
        if (!m.has(ch)) m.set(ch, []);
        m.get(ch).push(name);
      }
    }
    return m;
  });
  let universe = null;
  for (const m of memberships) {
    const s = new Set(m.keys());
    universe = universe === null ? s : new Set([...universe].filter((x) => s.has(x)));
  }
  const chars = [...universe];
  const totalChars = chars.length;

  /* 2. 按 canonical 序的原始索引：结点权重 + 链路 */
  const catId = BOOKS.map((b) => b.order.map((_, i) => i)); // 本模块用 canonical idx
  const nameOf = (bi, id) => BOOKS[bi].order[id];
  const weight = BOOKS.map((b) => b.order.map(() => 0)); // [book][canonicalIdx]
  const linkMap = BOOKS.slice(0, -1).map(() => new Map()); // "<s>|<t>" -> w

  for (const ch of chars) {
    const sets = memberships.map((m) => m.get(ch) || []);
    // 结点权重（每书：字在 k 部则 1/k）
    sets.forEach((cats, bi) => {
      const w = 1 / cats.length;
      for (const c of cats) weight[bi][BOOKS[bi].order.indexOf(c)] += w;
    });
    // 链路（相邻书同字，两两均分）
    for (let bi = 0; bi < N - 1; bi++) {
      const A = sets[bi], B = sets[bi + 1];
      if (!A.length || !B.length) continue;
      const base = 1 / (A.length * B.length);
      for (const a of A) {
        for (const b of B) {
          const k = BOOKS[bi].order.indexOf(a) + '|' + BOOKS[bi + 1].order.indexOf(b);
          linkMap[bi].set(k, (linkMap[bi].get(k) || 0) + base);
        }
      }
    }
  }

  // 各列在用的结点（权重>0 的 canonical idx），初始按韵书序
  const activeCol = BOOKS.map((b, bi) => catId[bi].filter((id) => weight[bi][id] > 0));
  const linkArr = linkMap.map((m) =>
    [...m.entries()].map(([k, w]) => {
      const [s, t] = k.split('|').map(Number);
      return { s, t, w };
    })
  );

  /* 3. 排序：barycenter 迭代降交叉（保持各自韵书语义序打底，链路的权重引导） */
  function medianSort(iterations) {
    // posOf[c][id]
    for (let it = 0; it < iterations; it++) {
      // 左→右：用第 c 列排第 c+1 列
      for (let c = 0; c < N - 1; c++) {
        const posL = new Map(activeCol[c].map((id, i) => [id, i]));
        const colR = activeCol[c + 1];
        const avg = new Map(colR.map((id) => [id, 0]));
        const cnt = new Map(colR.map((id) => [id, 0]));
        for (const l of linkArr[c]) {
          if (!posL.has(l.s) || !avg.has(l.t)) continue;
          avg.set(l.t, avg.get(l.t) + posL.get(l.s) * l.w);
          cnt.set(l.t, cnt.get(l.t) + l.w);
        }
        const order = colR.map((id) => {
          const a = cnt.get(id) || 0;
          return [id, a > 0 ? avg.get(id) / a : 0];
        });
        // 无链路的结点（cnt=0）保持原位，简单起见放最后
        const connected = order.filter(([, a]) => a > 0).sort((x, y) => x[1] - y[1]);
        const isolated = order.filter(([, a]) => a === 0).sort((x, y) => x[0] - y[0]);
        activeCol[c + 1] = connected.concat(isolated).map(([id]) => id);
      }
      // 右→左：用第 c+1 列排第 c 列
      for (let c = N - 2; c >= 0; c--) {
        const posR = new Map(activeCol[c + 1].map((id, i) => [id, i]));
        const colL = activeCol[c];
        const avg = new Map(colL.map((id) => [id, 0]));
        const cnt = new Map(colL.map((id) => [id, 0]));
        for (const l of linkArr[c]) {
          if (!posR.has(l.t) || !avg.has(l.s)) continue;
          avg.set(l.s, avg.get(l.s) + posR.get(l.t) * l.w);
          cnt.set(l.s, cnt.get(l.s) + l.w);
        }
        const order = colL.map((id) => {
          const a = cnt.get(id) || 0;
          return [id, a > 0 ? avg.get(id) / a : 0];
        });
        const connected = order.filter(([, a]) => a > 0).sort((x, y) => x[1] - y[1]);
        const isolated = order.filter(([, a]) => a === 0).sort((x, y) => x[0] - y[0]);
        activeCol[c] = connected.concat(isolated).map(([id]) => id);
      }
    }
  }
  medianSort(12);

  // 由 activeCol 建立 posOf（本列内第几个）
  const posOf = activeCol.map((col) => new Map(col.map((id, i) => [id, i])));

  /* 4. 布局参数 */
  const M = { left: 66, right: 110, top: 34, bottom: 10 };
  const BAR_W = 16;
  const GAP_COL = 128; // 列间距（标签/流道空间）
  const gapNode = 1; // 结点间隙 px
  const unitPx = 0.11; // 每单位字数的像素
  const colX = [];
  let x = M.left;
  for (let bi = 0; bi < N; bi++) {
    colX.push(x);
    x += BAR_W + GAP_COL;
  }
  const width = M.left + N * BAR_W + (N - 1) * GAP_COL + M.right;

  /* 5. 竖向布局：各列底边对齐（结点多的列决定总高，少的摊开间隙） */
  const barH = (bi, id) => weight[bi][id] * unitPx;
  const colBarSum = activeCol.map((col, bi) => col.reduce((a, id) => a + barH(bi, id), 0));
  const desiredColH = Math.max(...activeCol.map((col, bi) => colBarSum[bi] + gapNode * (col.length - 1)));
  const yTop = activeCol.map((col, bi) => {
    const extra = Math.max(0, desiredColH - colBarSum[bi] - gapNode * (col.length - 1));
    const gap = col.length > 1 ? gapNode + extra / (col.length - 1) : 0;
    const ys = [];
    let y = M.top;
    for (let i = 0; i < col.length; i++) {
      ys.push(y);
      y += barH(bi, col[i]) + gap;
    }
    return ys;
  });
  const height = M.top + desiredColH + M.bottom;

  /* 6. 每结点入/出链路分配（端面厚度一致 → 两边 y 区间同长） */
  // nodePorts[bi][row] = { in:[link...], out:[link...] }
  const nodePorts = activeCol.map((col) => col.map(() => ({ in: [], out: [] })));
  linkArr.forEach((links, bi) => {
    for (const l of links) {
      const rL = posOf[bi].get(l.s);
      const rR = posOf[bi + 1].get(l.t);
      if (rL == null || rR == null) continue;
      nodePorts[bi][rL].out.push(l);
      nodePorts[bi + 1][rR].in.push(l);
    }
  });
  const yMid = (bi, row) => yTop[bi][row] + barH(bi, activeCol[bi][row]) / 2;
  const alloc = (ports, bi, row, key, side) => {
    ports.sort((a, b) => {
      const pa = key(a), pb = key(b);
      return pa - pb;
    });
    let acc = yTop[bi][row];
    for (const l of ports) {
      l[side + '0'] = acc;
      l[side + '1'] = acc + l.w * unitPx;
      acc = l[side + '1'];
    }
  };
  for (let bi = 0; bi < N; bi++) {
    for (let row = 0; row < activeCol[bi].length; row++) {
      const id = activeCol[bi][row];
      const ports = nodePorts[bi][row];
      if (ports.out.length && bi < N - 1) {
        alloc(ports.out, bi, row, (l) => yMid(bi + 1, posOf[bi + 1].get(l.t)), 'yL');
      }
      if (ports.in.length && bi > 0) {
        alloc(ports.in, bi, row, (l) => yMid(bi - 1, posOf[bi - 1].get(l.s)), 'yR');
      }
      void id;
    }
  }

  /* 7. 颜色 */
  const colorOf = (bi, id) => {
    const map = colors[BOOKS[bi].key];
    return map ? map[nameOf(bi, id)] : null;
  };
  const nodeFill = (bi, id) => {
    const c = colorOf(bi, id);
    return c ? `hsl(${c.h},${c.s}%,${Math.min(c.l, 88)}%)` : '#cfc8be';
  };
  // 链路 = 左侧源结点色（fill 半透明；整体明暗靠 opacity 控制，便于悬停高亮对比）
  const linkFill = (bi, l) => {
    const c = colorOf(bi, l.s);
    if (!c) return 'rgba(150,140,128,.55)';
    return `hsla(${c.h},${c.s}%,${Math.min(c.l, 84)}%,.55)`;
  };
  const fmt = (v) => {
    const r = Math.round(v * 10) / 10;
    return String(r).replace(/\.0$/, '');
  };

  /* 8. SVG 组装 */
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const rid = (bi, row) => `l${bi}_${row}`;

  // 链路 path
  let paths = '';
  let linkCnt = 0;
  for (let bi = 0; bi < N - 1; bi++) {
    const x0 = colX[bi] + BAR_W;
    const x1 = colX[bi + 1];
    const cx = (x1 - x0) * 0.5;
    for (const l of linkArr[bi]) {
      const rL = posOf[bi].get(l.s);
      const rR = posOf[bi + 1].get(l.t);
      const out = nodePorts[bi][rL].out.find((o) => o === l);
      const inn = nodePorts[bi + 1][rR].in.find((o) => o === l);
      if (!out || !inn) continue;
      const d = `M${x0},${out.yL0} C${x0 + cx},${out.yL0} ${x1 - cx},${inn.yR0} ${x1},${inn.yR0} L${x1},${inn.yR1} C${x1 - cx},${inn.yR1} ${x0 + cx},${out.yL1} ${x0},${out.yL1} Z`;
      paths += `<path class="sk-l" data-s="${rid(bi, rL)}" data-t="${rid(bi + 1, rR)}" data-w="${Math.round(l.w * 10) / 10}" d="${d}" fill="${linkFill(bi, l)}"></path>`;
      linkCnt++;
    }
  }

  // 结点与标签
  let nodesSvg = '';
  let labelsSvg = '';
  for (let bi = 0; bi < N; bi++) {
    const col = activeCol[bi];
    for (let row = 0; row < col.length; row++) {
      const id = col[row];
      const y = yTop[bi][row];
      const h = Math.max(barH(bi, id), 0.9);
      const name = nameOf(bi, id);
      const x = colX[bi];
      const title = `${name} · ${fmt(weight[bi][id])} 字`;
      nodesSvg += `<g class="sk-n" data-id="${rid(bi, row)}"><title>${esc(title)}</title><rect x="${x}" y="${y}" width="${BAR_W}" height="${h}" rx="1" fill="${nodeFill(bi, id)}" stroke="rgba(0,0,0,.06)"></rect></g>`;
      // 韵部名：空间足够再显示
      if (h >= 11) {
        const cy = y + h / 2;
        const right = bi === N - 1;
        const lx = right ? x + BAR_W + 6 : x - 6;
        labelsSvg += `<text class="sk-label" x="${lx}" y="${cy + 3.5}" text-anchor="${right ? 'start' : 'end'}" fill="#6b6360">${esc(name)}</text>`;
      }
    }
  }

  // 列头 + 各列韵部数
  let heads = '';
  BOOKS.forEach((b, bi) => {
    const cx = colX[bi] + BAR_W / 2;
    heads += `<text class="sk-head" x="${cx}" y="${M.top - 16}" text-anchor="middle">${b.label}</text>`;
    heads += `<text class="sk-head-sub" x="${cx}" y="${M.top - 3}" text-anchor="middle">${activeCol[bi].length} 部</text>`;
  });

  // 交互：悬停某结点——按链路权重分级高亮
  //   粗流（≥可见阈值，≈>2 字）→ 提亮弧 + 点亮对端结点；
  //   细流（仍相连但肉眼难辨）→ 弧微亮、对端结点不强亮；
  //   其余 → 压暗。悬停结束后全部复原。
  const script = `
  <script>
  (function () {
    var svg = document.getElementById('sk-svg');
    if (!svg) return;
    var nodes = Array.prototype.slice.call(svg.querySelectorAll('.sk-n'));
    var links = Array.prototype.slice.call(svg.querySelectorAll('.sk-l'));
    var unitPx = 0.11;
    var linkDefault = 0.34;
    var linkStrong = 1;     // 可见强流的弧
    var linkWeak = 0.5;     // 细流的弧（仍相连但更淡）
    var linkDim = 0.04;     // 无关
    var strongMin = 2.5;    // 权重大于此的链路视为「可见强流」（≈0.28px 以上）
    function paint() { links.forEach(function (l) { l.style.opacity = String(linkDefault); }); }
    function reset() {
      nodes.forEach(function (n) { n.classList.remove('hl', 'dim'); });
      paint();
    }
    nodes.forEach(function (n) {
      n.addEventListener('mouseenter', function () {
        reset();
        var id = n.getAttribute('data-id');
        var strong = {};  // 通过强流相连的对端
        var weak = {};    // 仅细流相连的对端
        strong[id] = 1;
        links.forEach(function (l) {
          var a = l.getAttribute('data-s'), b = l.getAttribute('data-t');
          var w = parseFloat(l.getAttribute('data-w')) || 0;
          if (a === id || b === id) {
            var other = a === id ? b : a;
            if (w >= strongMin) { strong[other] = 1; l.style.opacity = String(linkStrong); }
            else { weak[other] = 1; l.style.opacity = String(linkWeak); }
          } else {
            l.style.opacity = String(linkDim);
          }
        });
        nodes.forEach(function (m) {
          var mid = m.getAttribute('data-id');
          if (strong[mid]) m.classList.add('hl');
          else if (weak[mid]) m.classList.add('wink');
          else m.classList.add('dim');
        });
      });
    });
    svg.addEventListener('mouseleave', reset);
  })();
  </script>`;

  const svg = `<svg id="sk-svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="五部韵书全库韵部流变桑基图">
<style>
.sk-l { transition: opacity .12s; }
.sk-n { cursor: default; }
.sk-n rect { transition: opacity .12s; }
.sk-n.hl rect { stroke: rgba(0,0,0,.35); stroke-width: 1.2; filter: saturate(1.25); }
.sk-n.dim rect { opacity: .22; }
.sk-n.wink rect { opacity: .6; }
.sk-label { font-size: 10.5px; font-family: "Noto Serif SC","Songti SC",serif; paint-order: stroke; stroke: #faf8f5; stroke-width: 3px; stroke-linejoin: round; }
.sk-head { font-size: 13px; font-weight: 600; font-family: "ml","Noto Serif SC",serif; letter-spacing: 1px; }
.sk-head-sub { font-size: 10px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
</style>
${heads}${paths}${nodesSvg}${labelsSvg}</svg>`;

  const section = `
<div class="sk-wrap">
  <div class="sk-title">五部韵书全库韵部流变 · 按字等权统计（${totalChars} 字）</div>
  ${svg}
  <div class="sk-note">口径：取五部韵书<b>兼收</b>的字作全集；每字在某书归入若干韵部时权重均分，相邻两书同字连接、两两均分，故各层总流量 = 全库字数、逐结点进出守恒。悬停结点可高亮其全部流向并查看韵部名与等权字数。</div>
  ${script}
</div>`;
  return { html: section, totalChars, links: linkCnt };
}

/** CLI 预览：node ref-sankey.mjs（独立目检用；配色为按序色相占位，真色表由 gen-ref 传入） */
const isMain = process.argv[1] && import.meta.url === new URL('file://' + process.argv[1]).href;
if (isMain) {
  const { readFileSync, writeFileSync } = await import('node:fs');
  const { dirname, join } = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const ROOT = join(__dirname, '..', '..');
  const CFG = join(ROOT, 'static', 'config');
  const rhymeBooks = JSON.parse(readFileSync(join(CFG, 'rhyme_books.json'), 'utf8'));
  const sortByName = (names) => {
    const cnNum = { 一:1,二:2,三:3,四:4,五:5,六:6,七:7,八:8,九:9,十:10,十一:11,十二:12,十三:13,十四:14,十五:15,十六:16,十七:17,十八:18,十九:19,二十:20 };
    const toneRank = { 平: 0, 仄: 1, 入: 2 };
    const numOf = (s) => (/^\d+$/.test(s) ? parseInt(s, 10) : cnNum[s] ?? 99);
    return [...names].sort((a, b) => {
      const ma = a.match(/(?:第)?(\d+|[一二三四五六七八九十]+)(?:部)?(?:_([平仄入]))?/);
      const mb = b.match(/(?:第)?(\d+|[一二三四五六七八九十]+)(?:部)?(?:_([平仄入]))?/);
      const na = numOf(ma?.[1]), nb = numOf(mb?.[1]);
      return na !== nb ? na - nb : (toneRank[ma?.[2]] ?? 0) - (toneRank[mb?.[2]] ?? 0);
    });
  };
  const PINGSHUI_GROUPS = [
    ['上平', ['一东','二冬','三江','四支','五微','六鱼','七虞','八齐','九佳','十灰','十一真','十二文','十三元','十四寒','十五删']],
    ['下平', ['一先','二萧','三肴','四豪','五歌','六麻','七阳','八庚','九青','十蒸','十一尤','十二侵','十三覃','十四盐','十五咸']],
    ['上声', ['一董','二肿','三讲','四纸','五尾','六语','七麌','八荠','九蟹','十贿','十一轸','十二吻','十三阮','十四旱','十五潸','十六铣','十七筱','十八巧','十九皓','二十哿','二十一马','二十二养','二十三梗','二十四迥','二十五有','二十六寝','二十七感','二十八俭','二十九豏']],
    ['去声', ['一送','二宋','三绛','四寘','五未','六御','七遇','八霁','九泰','十卦','十一队','十二震','十三问','十四愿','十五翰','十六谏','十七霰','十八啸','十九效','二十号','二十一个','二十二祃','二十三漾','二十四敬','二十五径','二十六宥','二十七沁','二十八勘','二十九艳','三十陷']],
    ['入声', ['一屋','二沃','三觉','四质','五物','六月','七曷','八黠','九屑','十药','十一陌','十二锡','十三职','十四缉','十五合','十六叶','十七洽']],
  ];
  const orders = {
    ShangguyunShijing: Object.keys(rhymeBooks.ShangguyunShijing.categories),
    ShangguyunChuci: Object.keys(rhymeBooks.ShangguyunChuci.categories),
    Pingshuiyun: PINGSHUI_GROUPS.flatMap(([, names]) => names),
    Cilinzhengyun: sortByName(Object.keys(rhymeBooks.Cilinzhengyun.categories)),
    Zhonghua_Tongyun: sortByName(Object.keys(rhymeBooks.Zhonghua_Tongyun.categories)),
  };
  // 占位配色：按各书韵部序取色相，验证布局（真色表见 gen-ref.mjs 集成处）
  const colors = {};
  for (const b of Object.keys(orders)) {
    const list = orders[b];
    const m = {};
    list.forEach((n, i) => {
      const h = Math.round((i * 360) / Math.max(list.length, 1));
      m[n] = { h, s: 62, l: 60 };
    });
    colors[b] = m;
  }
  const out = buildSankey({ rhymeBooks, colors, orders });
  const html = `<!DOCTYPE html><html lang="zh"><head><meta charset="utf-8"><style>body{margin:20px;background:#faf8f5;font-family:"PingFang SC","Noto Serif SC",serif}.sk-note{font-size:12.5px;color:#8a8178;margin:0 0 10px}</style></head><body>${out.html}</body></html>`;
  console.log(out.totalChars, 'chars |', out.links, 'links | svg len', out.html.length);
  writeFileSync(join(__dirname, 'sankey-preview.html'), html);
}
