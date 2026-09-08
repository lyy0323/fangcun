// ============================================================================
// Markdown 复制粘贴 往返回归检查
//
// 用法：node scripts/check-markdown-roundtrip.mjs （或 npm run check:md）
//
// 说明：方寸无前端测试框架（无 vitest/jest）。本脚本用 esbuild（devDependency）
// 在内存中打包真实生产代码（markdownParse.ts + markdownRoundTrip.ts），再执行
// 「导出 → 解析 → 导入 → 再导出」的往返断言，覆盖：
//   - 元数据状态：作者/序/注/日期（公历/农历）/隐藏日期
//   - 组诗有无：单首 / 组诗（有题 / 无题）
//   - 边界：半成品 □ 空位、短内容粘入长画板、自由诗分节空行、词牌标点、
//           画板级 vs 小节级注/日期、多块导出文件
//
// 已知限制（语义上无法无损往返，断言标记为 KNOWN 而非失败）：
//   - 标题本身含「 / 」且导出不带作者 → 会被拆成 标题/作者
//   - 单节画板同时携带「本首注/日期」与「画板注/日期」→ 合并为画板级注
// ============================================================================
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const srcDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src');

// ── 打包真实生产代码 ────────────────────────────────────────────────────────
const result = await build({
  stdin: {
    contents: `
      export { parseMarkdownPaste, isMarkdownPaste } from '${srcDir}/lib/markdownParse.ts';
      export { buildBoardMarkdown, applyMarkdownImport } from '${srcDir}/lib/markdownRoundTrip.ts';
    `,
    resolveDir: srcDir,
    loader: 'ts',
  },
  bundle: true,
  format: 'esm',
  platform: 'node',
  write: false,
});
const mod = await import('data:text/javascript;base64,' + Buffer.from(result.outputFiles[0].text).toString('base64'));
const { parseMarkdownPaste, buildBoardMarkdown, applyMarkdownImport } = mod;

// localStorage shim（types.resolveAuthor 在 node 下无 localStorage）
globalThis.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };

const PLACEHOLDER = '\u25a1';
let pass = 0, fail = 0, known = 0;
const check = (name, cond, detail) => {
  if (cond) { pass++; }
  else { fail++; console.log(`FAIL  ${name}${detail ? '\n      ' + detail : ''}`); }
};
const knownLim = (name) => { known++; console.log(`KNOWN ${name}`); };

const mk = (over = {}) => ({
  id: 'b1', title: '静夜思', genre: 'Shi', rhymeBookName: 'Pingshuiyun',
  sections: [{ id: 's1', title: '', ruleName: '五绝', charCount: 20, poemChars: Array(20).fill(PLACEHOLDER), candidatesMap: {} }],
  inspirationCards: [], createdAt: 1, updatedAt: 2, metadata: { dateFormat: 'Gregorian' },
  ...over,
});

const SHI_VALIDATION = {
  rhyme_positions: [9, 19],
  display_segments: [{ start_index: 0, text_chars: [], rule_items: Array(20).fill(null).map((_, i) => ({ tone: 'P', comment: i % 10 === 9 ? '句' : i % 10 === 4 ? '句' : null })) }],
};

const P1 = '床前明月光疑是地上霜举头望明月低头思故乡';
const P2 = '白日依山尽黄河入海流欲穷千里目更上一层楼';

// ── 单首 ───────────────────────────────────────────────────────────────────
// S1 完整五绝往返
{
  const b = mk({ sections: [{ id: 's1', title: '', ruleName: '五绝', charCount: 20, poemChars: [...P1], candidatesMap: {} }] });
  const md = buildBoardMarkdown(b, { author: 'off', date: false }, [SHI_VALIDATION]);
  const i = applyMarkdownImport(mk(), parseMarkdownPaste(md));
  check('S1 完整五绝往返', i.sections[0].poemChars.join('') === P1, i.sections[0].poemChars.join(''));
}

// S2 半成品 □ 空位位置保留
{
  const chars = [...'床前明月光', ...Array(10).fill(PLACEHOLDER), ...'举头望明月'];
  const b = mk({ sections: [{ id: 's1', title: '', ruleName: '五绝', charCount: 20, poemChars: chars, candidatesMap: {} }] });
  const md = buildBoardMarkdown(b, { author: 'off', date: false }, [SHI_VALIDATION]);
  const i = applyMarkdownImport(mk(), parseMarkdownPaste(md));
  check('S2 半成品保留 □ 空位', i.sections[0].poemChars.join('') === chars.join(''), JSON.stringify(i.sections[0].poemChars.join('')));
}

// S7 短内容粘入长画板 → 尾部清空
{
  const b = mk({ sections: [{ id: 's1', title: '', ruleName: '五绝', charCount: 20, poemChars: [...P1], candidatesMap: {} }] });
  const i = applyMarkdownImport(b, parseMarkdownPaste('### 新题 / 作者\n\n床前明月光，\n疑是地上霜。\n'));
  check('S7 短内容粘入尾部清空', i.sections[0].poemChars.slice(10).every(c => c === PLACEHOLDER), JSON.stringify(i.sections[0].poemChars.slice(10).join('')));
  check('S7 短内容前部正确', i.sections[0].poemChars.slice(0, 10).join('') === '床前明月光疑是地上霜');
}

// ── 元数据 ─────────────────────────────────────────────────────────────────
// S5 画板作者/序/注/日期
{
  const b = mk({ metadata: { author: '李白', date: '2024-01-05', dateFormat: 'Gregorian', preface: '月夜', footnote: '作于床前' } });
  const md = buildBoardMarkdown(b, { author: 'all', date: true }, [SHI_VALIDATION]);
  const i = applyMarkdownImport(mk(), parseMarkdownPaste(md));
  const m = i.metadata;
  check('S5 作者保留', m.author === '李白', JSON.stringify(m.author));
  check('S5 画板序保留', m.preface === '月夜', JSON.stringify(m.preface));
  check('S5 画板注保留', m.footnote === '作于床前', JSON.stringify(m.footnote));
  check('S5 画板日期保留', m.date === '2024-01-05', JSON.stringify(m.date));
}

// S6 农历日期识别（而非脚注）
{
  const b = mk({ metadata: { author: '李白', date: '甲辰年三月初一', dateFormat: 'Lunar', footnote: '灯下' } });
  const md = buildBoardMarkdown(b, { author: 'all', date: true }, [SHI_VALIDATION]);
  const i = applyMarkdownImport(mk(), parseMarkdownPaste(md));
  check('S6 农历日期识别', i.metadata.date === '甲辰年三月初一', JSON.stringify(i.metadata.date));
  check('S6 农历日期未吞并注', i.metadata.footnote === '灯下', JSON.stringify(i.metadata.footnote));
  check('S6 dateFormat=Lunar', i.metadata.dateFormat === 'Lunar', JSON.stringify(i.metadata.dateFormat));
}

// S14 单首 + 本首注/日期 → 上浮画板级
{
  const b = mk({ sections: [{ id: 's1', title: '', ruleName: '五绝', charCount: 20, poemChars: [...P1], candidatesMap: {}, sectionDate: '2024-06-01', sectionFootnote: '自注' }] });
  const md = buildBoardMarkdown(b, { author: 'off', date: true }, [SHI_VALIDATION]);
  const i = applyMarkdownImport(mk(), parseMarkdownPaste(md));
  check('S14 单首本首日期上浮', i.metadata.date === '2024-06-01', JSON.stringify(i.metadata.date));
  check('S14 单首本首注上浮', i.metadata.footnote === '自注', JSON.stringify(i.metadata.footnote));
}

// S17 隐藏日期不导出 → 导入后无日期（预期行为）
{
  const b = mk({ metadata: { date: '2024-08-08', dateHidden: true } });
  const md = buildBoardMarkdown(b, { author: 'off', date: true }, [SHI_VALIDATION]);
  const i = applyMarkdownImport(mk(), parseMarkdownPaste(md));
  check('S17 隐藏日期不导出', !md.includes('2024-08-08'));
  check('S17 隐藏日期导入后无', !i.metadata.date);
}

// ── 组诗 ───────────────────────────────────────────────────────────────────
// S3 无题组诗 → 粘入全新画板，两节独立
{
  const b = mk({ title: '组诗', sections: [
    { id: 's1', title: '', ruleName: '五绝', charCount: 20, poemChars: [...P1], candidatesMap: {} },
    { id: 's2', title: '', ruleName: '五绝', charCount: 20, poemChars: [...P2], candidatesMap: {} },
  ] });
  const md = buildBoardMarkdown(b, { author: 'off', date: false }, [SHI_VALIDATION, SHI_VALIDATION]);
  const i = applyMarkdownImport(mk(), parseMarkdownPaste(md));
  check('S3 无题组诗节数=2', i.sections.length === 2, `got ${i.sections.length}\n${md}`);
  check('S3 第一首正确', i.sections[0].poemChars.join('') === P1);
  check('S3 第二首正确', i.sections[1]?.poemChars.join('') === P2, JSON.stringify(i.sections[1]?.poemChars.join('')));
}

// S28 无题小节标题不得变成字面 "####"（粘贴回填时抹掉 ####）
{
  const md = '### 组诗 / 作者\n\n第一首正文。\n\n#### \n\n第二首正文。\n';
  const i = applyMarkdownImport(mk(), parseMarkdownPaste(md));
  check('S28 裸 #### 不产生标题', i.sections.length === 2 && !i.sections[1]?.title,
    `sections=${i.sections.length} 标题=${JSON.stringify(i.sections[1]?.title)}`);
  const i2 = applyMarkdownImport(mk(), parseMarkdownPaste('### 题\n\n#### 其一\n\n床前明月光。\n'));
  check('S28 有题小节标题正常', i2.sections[0]?.title === '其一', JSON.stringify(i2.sections[0]?.title));
}

// S4 有题组诗
{
  const b = mk({ title: '组诗', sections: [
    { id: 's1', title: '其一', ruleName: '五绝', charCount: 20, poemChars: [...P1], candidatesMap: {} },
    { id: 's2', title: '其二', ruleName: '五绝', charCount: 20, poemChars: [...P2], candidatesMap: {} },
  ] });
  const md = buildBoardMarkdown(b, { author: 'off', date: false }, [SHI_VALIDATION, SHI_VALIDATION]);
  const i = applyMarkdownImport(mk(), parseMarkdownPaste(md));
  check('S4 小节标题保留', i.sections[0].title === '其一' && i.sections[1].title === '其二', JSON.stringify(i.sections.map(s => s.title)));
  check('S4 正文正确', i.sections[1].poemChars.join('') === P2);
}

// S10 组诗首节小序 → 落在首节，不上浮画板
{
  const b = mk({ title: '组诗', sections: [
    { id: 's1', title: '', ruleName: '五绝', charCount: 20, poemChars: [...P1], candidatesMap: {}, sectionPreface: '第一首序' },
    { id: 's2', title: '', ruleName: '五绝', charCount: 20, poemChars: [...P2], candidatesMap: {} },
  ] });
  const md = buildBoardMarkdown(b, { author: 'off', date: false }, [SHI_VALIDATION, SHI_VALIDATION]);
  const i = applyMarkdownImport(mk({ title: '组诗', sections: [{ id: 's1', title: '', ruleName: '五绝', charCount: 20, poemChars: Array(20).fill(PLACEHOLDER), candidatesMap: {} }] }), parseMarkdownPaste(md));
  check('S10 首节小序落首节', i.sections[0].sectionPreface === '第一首序', JSON.stringify(i.sections[0].sectionPreface));
  check('S10 未上浮为画板序', !i.metadata.preface);
}

// S16 两节各自注/日期 + 画板注/日期（--- 分隔）
{
  const b = mk({ title: '组诗', metadata: { date: '2024-07-07', footnote: '画板注' }, sections: [
    { id: 's1', title: '其一', ruleName: '五绝', charCount: 20, poemChars: [...P1], candidatesMap: {}, sectionDate: '2024-06-01', sectionFootnote: '一注' },
    { id: 's2', title: '其二', ruleName: '五绝', charCount: 20, poemChars: [...P2], candidatesMap: {}, sectionDate: '2024-06-02', sectionFootnote: '二注' },
  ] });
  const md = buildBoardMarkdown(b, { author: 'off', date: true }, [SHI_VALIDATION, SHI_VALIDATION]);
  const i = applyMarkdownImport(mk({ title: '组诗', sections: [{ id: 's1', title: '', ruleName: '五绝', charCount: 20, poemChars: Array(20).fill(PLACEHOLDER), candidatesMap: {} }] }), parseMarkdownPaste(md));
  check('S16 第一节日期', i.sections[0].sectionDate === '2024-06-01', JSON.stringify(i.sections[0].sectionDate));
  check('S16 第一节注', i.sections[0].sectionFootnote === '一注', JSON.stringify(i.sections[0].sectionFootnote));
  check('S16 第二节日期', i.sections[1].sectionDate === '2024-06-02', JSON.stringify(i.sections[1].sectionDate));
  check('S16 第二节注', i.sections[1].sectionFootnote === '二注', JSON.stringify(i.sections[1].sectionFootnote));
  check('S16 画板日期', i.metadata.date === '2024-07-07', JSON.stringify(i.metadata.date));
  check('S16 画板注', i.metadata.footnote === '画板注', JSON.stringify(i.metadata.footnote));
}

// S19 三节粘入单节画板 → 按首节体裁补齐
{
  const md = '### 组诗 / 作者\n\n#### 其一\n\n床前明月光，\n疑是地上霜。\n\n#### 其二\n\n白日依山尽，\n黄河入海流。\n\n#### 其三\n\n千山鸟飞绝，\n万径人踪灭。\n';
  const i = applyMarkdownImport(mk(), parseMarkdownPaste(md));
  check('S19 三节补齐', i.sections.length === 3, 'got ' + i.sections.length);
  check('S19 标题与作者', i.title === '组诗' && i.metadata.author === '作者', JSON.stringify([i.title, i.metadata.author]));
  check('S19 第二节正文', i.sections[1].poemChars.slice(0, 10).join('') === '白日依山尽黄河入海流');
  check('S19 第二节标题', i.sections[1].title === '其二', JSON.stringify(i.sections[1].title));
}

// ── 自由诗 / 词 ────────────────────────────────────────────────────────────
// S8 自由诗分节空行保留
{
  const b = { id: 'b1', title: '自由', genre: 'Free', rhymeBookName: 'Zhonghua_Tongyun',
    sections: [{ id: 's1', title: '', ruleName: '自由', charCount: 0, poemChars: [], candidatesMap: {}, lines: ['第一段', '', '第二段'] }],
    inspirationCards: [], createdAt: 1, updatedAt: 2, metadata: {} };
  const md = buildBoardMarkdown(b, { author: 'off', date: true }, []);
  const i = applyMarkdownImport(b, parseMarkdownPaste(md));
  check('S8 自由诗空行保留', JSON.stringify(i.sections[0].lines) === JSON.stringify(['第一段', '', '第二段']), JSON.stringify(i.sections[0].lines));
}

// S15 词（浣溪沙）标点往返
{
  const ciChars = [...'一曲新词酒一杯去年天气旧亭台夕阳西下几时回无可奈何花落去似曾相识燕归来小园香径独徘徊'];
  const ciV = { rhyme_positions: [6, 13, 20, 34, 41], display_segments: [{ start_index: 0, text_chars: [], rule_items: Array(42).fill(null).map((_, i) => ({ tone: 'P', comment: i % 7 === 6 ? '句' : null })) }] };
  const b = mk({ genre: 'Ci', title: '浣溪沙', sections: [{ id: 's1', title: '', ruleName: '浣溪沙', charCount: 42, poemChars: ciChars, candidatesMap: {} }] });
  const md = buildBoardMarkdown(b, { author: 'off', date: true }, [ciV]);
  const i = applyMarkdownImport(mk({ genre: 'Ci', title: '浣溪沙', sections: [{ id: 's1', title: '', ruleName: '浣溪沙', charCount: 42, poemChars: Array(42).fill(PLACEHOLDER), candidatesMap: {} }] }), parseMarkdownPaste(md));
  check('S15 词往返字序', i.sections[0].poemChars.join('') === ciChars.join(''));
  check('S15 词 md 含标点', md.includes('，') && md.includes('。'));
}

// ── 外部粘贴 / 多块 ────────────────────────────────────────────────────────
// S18 外部纯正文 + 日期：前缀
{
  const i = applyMarkdownImport(mk(), parseMarkdownPaste('床前明月光，\n疑是地上霜。\n\n> 日期：2024-09-09\n'));
  check('S18 日期：前缀识别', i.metadata.date === '2024-09-09', JSON.stringify(i.metadata.date));
  check('S18 外部正文填入', i.sections[0].poemChars.slice(0, 10).join('') === '床前明月光疑是地上霜');
}

// S21 多块导出文件：标题为最后一块、块间注不串
{
  const b1 = mk({ title: '第一块', metadata: { footnote: '板1注' } });
  const b2 = mk({ title: '第二块', sections: [{ id: 's1', title: '', ruleName: '五绝', charCount: 20, poemChars: [...P2], candidatesMap: {} }] });
  const fileMd = [buildBoardMarkdown(b1, { author: 'off', date: true }, [SHI_VALIDATION]), '---', buildBoardMarkdown(b2, { author: 'off', date: true }, [SHI_VALIDATION])].join('\n\n');
  const p = parseMarkdownPaste(fileMd);
  check('S21 标题为最后一块', p.title === '第二块', JSON.stringify(p.title));
  check('S21 板1注未串入画板级', p.boardFootnote === undefined, JSON.stringify(p.boardFootnote));
  check('S21 板1注落首节（组诗化）', p.sections[0]?.footnote === '板1注', JSON.stringify(p.sections[0]?.footnote));
}

// ── 标点覆盖 / 引号往返 ────────────────────────────────────────────────────
// S22 手动标点覆盖往返（韵脚处改逗号，与校验推导不同）
{
  const b = mk({ sections: [{ id: 's1', title: '', ruleName: '五绝', charCount: 20, poemChars: [...P1], candidatesMap: {}, punctOverrides: { 9: '，' } }] });
  const md = buildBoardMarkdown(b, { author: 'off', date: false }, [SHI_VALIDATION]);
  const i = applyMarkdownImport(mk(), parseMarkdownPaste(md));
  check('S22 手动标点覆盖往返', i.sections[0].punctOverrides?.[9] === '，', JSON.stringify(i.sections[0].punctOverrides));
  check('S22 正文不变', i.sections[0].poemChars.join('') === P1);
}

// S23 引号标记往返（含嵌套、跨联换行）
{
  // 「床前明月光，\n疑是地上霜」——开引号在字 0，关引号在字 9（跨联）
  const b = mk({ sections: [{ id: 's1', title: '', ruleName: '五绝', charCount: 20, poemChars: [...P1], candidatesMap: {}, auxMarks: { 0: ['「'], 9: ['」'] } }] });
  const md = buildBoardMarkdown(b, { author: 'off', date: false }, [SHI_VALIDATION]);
  const i = applyMarkdownImport(mk(), parseMarkdownPaste(md));
  check('S23 开引号落首字', JSON.stringify(i.sections[0].auxMarks?.[0]) === JSON.stringify(['「']), JSON.stringify(i.sections[0].auxMarks));
  check('S23 关引号落末字', JSON.stringify(i.sections[0].auxMarks?.[9]) === JSON.stringify(['」']), JSON.stringify(i.sections[0].auxMarks));
  check('S23 正文不变', i.sections[0].poemChars.join('') === P1);

  // 嵌套「“X”」（外层「」内层“”，均为受支持标记）
  const b2 = mk({ sections: [{ id: 's1', title: '', ruleName: '五绝', charCount: 20, poemChars: [...'床前明月光'.padEnd(20, '□')].map(c => c === '□' ? PLACEHOLDER : c), candidatesMap: {}, auxMarks: { 0: ['「', '“'], 4: ['”', '」'] } }] });
  const md2 = buildBoardMarkdown(b2, { author: 'off', date: false }, [SHI_VALIDATION]);
  const i2 = applyMarkdownImport(mk(), parseMarkdownPaste(md2));
  check('S23 嵌套引号顺序', JSON.stringify(i2.sections[0].auxMarks?.[0]) === JSON.stringify(['「', '“']) && JSON.stringify(i2.sections[0].auxMarks?.[4]) === JSON.stringify(['”', '」']), JSON.stringify(i2.sections[0].auxMarks));
}

// S24 □ 空位 + 标点 + 引号 混合落位
{
  const chars = [...'床前明月光', ...Array(10).fill(PLACEHOLDER), ...'举头望明月'];
  const b = mk({ sections: [{ id: 's1', title: '', ruleName: '五绝', charCount: 20, poemChars: chars, candidatesMap: {}, punctOverrides: { 4: '，', 9: '。' }, auxMarks: { 3: ['《'], 4: ['》'] } }] });
  const md = buildBoardMarkdown(b, { author: 'off', date: false }, [SHI_VALIDATION]);
  const i = applyMarkdownImport(mk(), parseMarkdownPaste(md));
  check('S24 □ 位置保留', i.sections[0].poemChars.join('') === chars.join(''), JSON.stringify(i.sections[0].poemChars.join('')));
  check('S24 标点落位', i.sections[0].punctOverrides?.[4] === '，' && i.sections[0].punctOverrides?.[9] === '。', JSON.stringify(i.sections[0].punctOverrides));
  check('S24 引号落位', JSON.stringify(i.sections[0].auxMarks?.[3]) === JSON.stringify(['《']) && JSON.stringify(i.sections[0].auxMarks?.[4]) === JSON.stringify(['》']), JSON.stringify(i.sections[0].auxMarks));
}

// S25 粘贴无标点文本 → 旧覆盖被清空（内容替换语义）
{
  const b = mk({ sections: [{ id: 's1', title: '', ruleName: '五绝', charCount: 20, poemChars: [...P1], candidatesMap: {}, punctOverrides: { 4: '！' }, auxMarks: { 0: ['「'] } }] });
  const i = applyMarkdownImport(b, parseMarkdownPaste('### 新题\n\n床前明月光疑是地上霜\n'));
  check('S25 旧标点覆盖清空', i.sections[0].punctOverrides === undefined, JSON.stringify(i.sections[0].punctOverrides));
  check('S25 旧引号清空', i.sections[0].auxMarks === undefined, JSON.stringify(i.sections[0].auxMarks));
}

// S27 全量对称：导出 → 导入 → 再导出 文本一致
{
  const b = mk({ metadata: { author: '李白' }, sections: [{ id: 's1', title: '', ruleName: '五绝', charCount: 20, poemChars: [...P1], candidatesMap: {}, punctOverrides: { 4: '！', 9: '，' }, auxMarks: { 0: ['「'], 9: ['」'] } }] });
  const md1 = buildBoardMarkdown(b, { author: 'all', date: false }, [SHI_VALIDATION]);
  const i = applyMarkdownImport(mk(), parseMarkdownPaste(md1));
  const md2 = buildBoardMarkdown(i, { author: 'all', date: false }, [SHI_VALIDATION]);
  check('S27 再导出与首次导出一致', md1 === md2, `\n--- md1 ---\n${md1}\n--- md2 ---\n${md2}`);
}

// ── 已知限制（语义无法无损，标记 KNOWN）───────────────────────────────────
{
  const b = mk({ title: '春 / 秋' });
  const md = buildBoardMarkdown(b, { author: 'off', date: false }, [SHI_VALIDATION]);
  const p = parseMarkdownPaste(md);
  if (p.title === '春 / 秋') {
    check('S13 标题含「/」完整保留', true);
  } else {
    knownLim(`S13 标题含「/」且不带作者 → 拆分为 标题「${p.title}」/作者「${p.author}」（导出带作者时无此问题）`);
  }
}
{
  // 单节画板同时携带本首注/日期 + 画板注/日期（UI 不可达，仅删节残留可达）
  const b = mk({ metadata: { date: '2024-07-07', footnote: '画板注' }, sections: [{ id: 's1', title: '', ruleName: '五绝', charCount: 20, poemChars: [...P1], candidatesMap: {}, sectionDate: '2024-06-01', sectionFootnote: '一注' }] });
  const md = buildBoardMarkdown(b, { author: 'off', date: true }, [SHI_VALIDATION]);
  const i = applyMarkdownImport(mk(), parseMarkdownPaste(md));
  const m = i.metadata;
  if (m.date === '2024-07-07' && m.footnote === '一注\n2024-06-01\n画板注') {
    knownLim('S20 单节双元数据（本首+画板注/日期）合并为画板级（文本全保留，层级展平）');
  } else {
    check('S20 单节双元数据', false, JSON.stringify([m.date, m.footnote]));
  }
}
{
  // 覆盖为空串（抑制标点）→ 文本无标点可还原，往返后抑制丢失
  const b = mk({ sections: [{ id: 's1', title: '', ruleName: '五绝', charCount: 20, poemChars: [...P1], candidatesMap: {}, punctOverrides: { 9: '' } }] });
  const md = buildBoardMarkdown(b, { author: 'off', date: false }, [SHI_VALIDATION]);
  const i = applyMarkdownImport(mk(), parseMarkdownPaste(md));
  if (i.sections[0].punctOverrides?.[9] === '') {
    check('S26 空串覆盖（抑制标点）往返', true);
  } else {
    knownLim('S26 覆盖为空串（抑制标点）不往返：导出无标点可还原，导入后恢复默认标点');
  }
}

console.log(`\n==== ${pass} passed, ${fail} failed, ${known} known-limitation ====`);
process.exit(fail > 0 ? 1 : 0);
