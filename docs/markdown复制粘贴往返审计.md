# Markdown 复制粘贴 功能审计（创作页）

> 审计日期：2026-06（dev 分支）
> 范围：创作页「复制文字（Markdown）/ 导出 Markdown / 粘贴导入」的**往返一致性**（复制出来 → 粘贴回去 → 内容与元数据符合预期）。
> 结论：发现并修复 **6 类往返缺陷**（含 1 类数据丢失、2 类内容错乱）；2 类语义上无法无损的已知限制；无前端测试基建，本次新增可运行的回归脚本。

---

## 1. 功能与代码位置

| 环节 | 文件 | 说明 |
|---|---|---|
| 解析（粘贴入口） | `frontend/src/lib/markdownParse.ts` | `isMarkdownPaste` 判定、`parseMarkdownPaste` 解析 `###`/`####`/`>`/正文 |
| 导出 | `frontend/src/lib/markdownRoundTrip.ts` → `buildBoardMarkdown` | 单画板 → Markdown（v2.4 起从 TopBar 抽出为纯函数） |
| 导入 | 同文件 → `applyMarkdownImport` | 解析结果 → 画板（v2.4 起从 BoardContext reducer 抽出） |
| 触发点 | `TopBar.tsx`（复制/导出全部）、`GridEditor.tsx`（正文/标题 onPaste）、`FreeEditor.tsx`（正文/标题 onPaste） | |
| 类型 | `MarkdownPasteSection / MarkdownPasteResult`（现定义于 markdownRoundTrip.ts，BoardContext 转出） | |

功能入口：
- 设置面板 →「导出全部画板为 Markdown」/ 复制文字（格式切到 Markdown）
- 在律诗/词/自由诗编辑区或标题框直接粘贴 Markdown

## 2. 格式约定（导出 ⇄ 解析对称）

```
### 标题 / 作者
> 画板序
#### 小节标题          ← 组诗时每节都有（无题小节输出裸 `#### `，保证节边界）
> 本首序
正文（律诗按联换行；词/律诗标点由格律校验推导 + 手动覆盖）
> 本首注
> 本首日期
---                    ← 仅组诗且有画板级注/日期时输出，分隔小节块与画板块
> 画板注
> 画板日期
```

解析规则要点：
- 最后一个引用块若形似日期（公历 `YYYY-MM-DD` / `日期：` 前缀 / 农历 `甲辰年三月初一`）→ 日期，其余引用块 → 注
- `---` 之后、下一标题之前的引用块 → 画板级注/日期（v2.4 修复后生效，此前该字段为死字段）
- 空行保留（自由诗分节）；连续空行折叠为一行

## 3. 测试现状

- **此前：无任何测试**。frontend 无测试框架（package.json 无 test 脚本，无 vitest/jest 依赖），`markdownParse.ts` / reducer 的 IMPORT_MARKDOWN 均为不可测的闭包/内联逻辑。
- **本次：**
  - 把导出（`buildBoardMarkdown`）与导入（`applyMarkdownImport`）抽为 `markdownRoundTrip.ts` 纯函数，reducer/组件仅调用。
  - 新增回归脚本 `frontend/scripts/check-markdown-roundtrip.mjs`（`npm run check:md`）：用 esbuild 在内存打包**真实生产代码**，执行 52 条「导出→解析→导入→再导出」断言（含标点覆盖/引号往返 S22–S27），覆盖元数据状态、组诗有无/标题有无、半成品、词牌、自由诗分节、多块文件等。当前 **52 passed / 0 failed / 3 known-limitation**。
  - 未引入测试框架（保持零依赖，脚本仅用已有 devDependency esbuild）。

## 4. 已修复缺陷（复制→粘贴→不符合预期）

| # | 场景 | 原行为 | 修复 |
|---|---|---|---|
| A | 组诗无小标题，第二首起 | 裸 `#### ` 行 trim 后为 `####`，解析器 `/^####\s/` 不匹配 → 被当作正文行，**多首合并进第一节，第二首内容丢失**（粘入全新画板时整首丢失） | 解析器改为 `/^####(\s+\|$)/`，裸 `####` 视为节标题；导出侧组诗**每节**都输出 `####` 行（含首节） |
| B | 律诗/词半成品（□ 空位） | 导出写 `□`，导入过滤 `[一-鿿㐀-䶿]` 把 `□` 丢掉 → **后续字全部左移错位** | 导入过滤加入 `□` 并映射回占位符，位置不变；顺带修复 GridEditor 纯文本粘贴路径（`flushInput` 遇 `□` 前进不写入） |
| C | 短内容粘入已有长画板 | 只覆写前 N 格，**尾部残留旧诗句** | 填充后尾部统一清空为占位符（粘贴=整首替换语义） |
| D | 农历日期（甲辰年三月初一） | 被识别为脚注 → **日期丢失**、注被污染 | 解析器识别农历日期（干支/数字年 + 月 + 日）；导入时若含农历日期，画板 `dateFormat` 自动置 `Lunar` |
| E | 组诗首节带小序（首节无标题） | 首节小序与画板序同处文首无法区分 → 上浮为画板序（结构错位） | 导出侧组诗首节也输出 `#### `，小节序稳定落回小节 |
| F | 组诗带画板级注/日期 | 画板注/日期与末节注/日期全部并入末节引用块 → **末节自身日期/注被覆盖** | 导出侧画板块前输出 `---`；解析器引入「画板引用模式」，末节块与画板块分开；`boardFootnote/boardDate` 死字段启用 |
| G | 标点覆盖 / 引号不往返 | 导入只保留汉字，手动标点覆盖与「」《》“”‘’ 引号标记全部丢弃（标点退回校验默认、引号消失） | 导入侧逐字扫描正文，按字索引重建 `punctOverrides` / `auxMarks`（与导出侧对称），见 `docs/markdown标点引号往返用例.md` |

另：自由诗分节空行此前被导出过滤 + 导入折叠 → 分节结构丢失，本次导出保留空行、导入保留单空行（律诗/词不受影响，空行不参与填字）。

## 5. 已知限制（语义上无法无损往返，`npm run check:md` 标记为 KNOWN）

1. **标题本身含「 / 」且导出不带作者**：`### 春 / 秋` 会被拆为 标题「春」/ 作者「秋」。导出带作者（`### 春 / 秋 / 李白`）时无此问题。不建议用 `/` 作为标题字符。
2. **单节画板同时携带「本首注/日期」与「画板注/日期」**（UI 下小节元数据仅组诗可见，此状态仅删节残留可达）：四段引用合并为画板级注（文本全保留，层级展平）。
3. **隐藏日期（dateHidden）不导出**：粘贴回来日期整体缺失（符合「导出时隐藏」意图，但注意是删除而非仅隐藏）。
4. **多块导出文件（导出全部画板）不可整文件粘贴**：粘贴会被当作单画板处理，所有诗合并为组诗、标题取最后一块。粘贴导入按「单画板」设计，多块文件请勿整贴。
5. **多余节不截断**：把 2 节组诗粘入 3 节画板，第 3 节旧内容保留（避免静默删数据）。如需「粘贴即整板替换」，可后续在 `applyMarkdownImport` 增加截断。
6. **抑制标点（覆盖为空串）不往返**：导出文本无对应标点可还原，粘贴后恢复校验默认。引号仅支持「」《》“”‘’（UI 8 个标记），`『』` 等不在支持集。
7. **sectionLegacyId（编号）不参与往返**：仅导出全部 JSON 保留。

## 6. 待确认 / 建议

- [ ] 已知限制 5（多余节截断）是否改为「粘贴即替换整板」——涉及静默删除，需产品决策。
- [ ] 标题含 `/`：可在导出时对无作者场景转义（如 `### 春 / 秋（无作者）`）或解析侧启发式，建议观察实际使用频率再定。
- [ ] 若后续引入测试框架，建议把 `check-markdown-roundtrip.mjs` 迁移为 vitest 用例并纳入 CI。

## 7. Debug / 复现指南

```bash
# 回归脚本（52 断言 + 3 已知限制，打包真实生产代码，不依赖服务）
cd frontend && npm run check:md

# 手工复现：Node 里跑任意往返
node --input-type=module -e "
import('esbuild').then(async ({build}) => {
  const r = await build({ stdin: { contents: \`
    export { parseMarkdownPaste } from './src/lib/markdownParse.ts';
    export { buildBoardMarkdown, applyMarkdownImport } from './src/lib/markdownRoundTrip.ts';
  \`, resolveDir: '.', loader: 'ts' }, bundle: true, format: 'esm', platform: 'node', write: false });
  globalThis.localStorage = { getItem: () => null };
  const m = await import('data:text/javascript;base64,' + Buffer.from(r.outputFiles[0].text).toString('base64'));
  // 例：无题组诗往返
  const md = m.buildBoardMarkdown({ id:'b', title:'组诗', genre:'Shi', rhymeBookName:'Pingshuiyun',
    sections: [{id:'s1',title:'',ruleName:'五绝',charCount:20,poemChars:[...'床前明月光疑是地上霜举头望明月低头思故乡'],candidatesMap:{}},
               {id:'s2',title:'',ruleName:'五绝',charCount:20,poemChars:[...'白日依山尽黄河入海流欲穷千里目更上一层楼'],candidatesMap:{}}],
    inspirationCards:[], createdAt:1, updatedAt:2, metadata:{} },
    { author:'off', date:false }, [null,null]);
  console.log(md);
  console.log(JSON.stringify(m.parseMarkdownPaste(md), null, 1));
})
"
```

浏览器联调：粘贴入口在 `GridEditor.handlePaste`（正文）与 `handleTitlePaste`（标题），`isMarkdownPaste` 判定为 true 即走 `IMPORT_MARKDOWN`；可在解析前后 `console.log` `parsed`/`board` 观察。自由诗走 `FreeEditor.handlePaste`。

## 8. 变更文件（dev 分支，未推送）

- `frontend/src/lib/markdownRoundTrip.ts`（新增：导出/导入纯函数 + 类型；导入侧重建标点覆盖/引号标记）
- `frontend/src/lib/markdownParse.ts`（裸 `####`、农历日期、画板引用块、空行保留）
- `frontend/src/context/BoardContext.tsx`（reducer 改用 `applyMarkdownImport`；类型转出）
- `frontend/src/components/TopBar.tsx`（改用 `buildBoardMarkdown`，删内联实现）
- `frontend/src/components/GridEditor.tsx`（纯文本粘贴 `□` 前进不写入）
- `frontend/scripts/check-markdown-roundtrip.mjs`（新增回归脚本，52 断言 + 3 已知限制）
- `frontend/package.json`（`check:md` 脚本）
- `docs/markdown标点引号往返用例.md`（标点/引号往返用例文档）
