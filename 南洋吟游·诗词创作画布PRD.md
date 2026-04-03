# **产品需求文档 (PRD)：南洋吟游·沉浸式诗词创作画布**

**版本**：v1.4

**状态**：Draft

**作者**：Coconut (椰椰)

**立项日期**：2026-02-09

**最后修改日期**：2026-02-12

## **1\. 项目背景与目标**

### **1.1 背景**

目前"南洋吟游"社员在创作诗词时，需要在韵书工具、格律检测网、字典和记事本之间频繁切换。这种割裂的体验打断了创作思维（Flow），且移动端适配较差，无法满足随时随地记录灵感的需求。

### **1.2 目标**

构建一个**Web端三栏一体、移动端适配**的"诗词创作画布"。核心价值在于：

首先，**所见即所得**：格律、韵部、正文在同一视窗，消除工具切换的割裂感。

其次，**深度推敲**：支持非线性的单字/词组输入，以及候选项管理（推敲炼字）。

最后，**实时辅助**：输入即检测，提供智能的韵部推荐和格律反馈。

## **2\. 用户角色 (Persona)**

* **核心用户**：诗社成员，具有一定的格律基础，追求严谨的创作，习惯在碎片时间（移动端）和整块时间（PC端）进行创作。  
* **痛点**：  
  * 写到一半忘记哪个字出律了。  
  * 为了押韵，需要反复查韵书，查完忘了刚才想写的句子。  
  * 纠结"推敲"两个字时，没有地方暂存备选字。

## **3\. 功能模块详解**

### **3.1 核心布局 (The Canvas)**

页面采用 **Fluid Layout (流式布局)**，背景色 \#FBFBF6。

#### **Web 端 (Landscape)**

采用 **100% 宽度的三栏布局**，高度占满屏幕（100vh），无页面级滚动条。

| 区域 | 占比 | 内容 | 交互逻辑 |
| :---- | :---- | :---- | :---- |
| **左侧栏** | 20% | **灵感板** | 多条灵感卡片纵向堆叠，支持文本/图片/语音三种类型。详见 F5。 |
| **中栏** | 50% | **核心创作画布** | 标题、参考范例、**正文网格**、**底部多功能字典**。 |
| **右侧栏** | 30% | **韵律辅助** | 选定韵部后的同韵字展示、平仄谱展示。 |

#### **Mobile 端 (Portrait)**

受限于屏幕宽度，采用 **垂直堆叠** 模式，需保持核心创作体验的连贯性。

* **顶部**：正文网格区（可滑动）。  
* **底部**：固定展示 **"多功能字典/检索区"**，与Web端逻辑保持一致。  
* 左右滑动正文区可唤出"灵感板"（左滑）或"韵律设置"（右滑）。

### **3.2 核心功能点**

#### **F1. 正文网格编辑器 (The Grid Editor)**

核心交互逻辑采用 **Index-based Virtual Cursor (基于索引的虚拟光标)**。

* **输入体验 (Non-sequential Input)**：  
  * **点击定位**：用户可点击行内的任意空格（例如直接点击第5个字）。  
  * **光标逻辑**：系统记录当前焦点的 (lineIndex, charIndex)。  
  * **流式输入**：用户输入时，字符依次填入 index, index+1。若遇行尾，光标自动跳到下一行首位。  
  * **删除逻辑**：Backspace 键清除当前字并前移光标。  
* **网格结构（诗 vs 词）**：  
  * **诗**：规整矩形网格。五言 = 4/8 行 x 5 列，七言 = 4/8 行 x 7 列。行列数由画板体裁的 `charCount` 直接推算。  
  * **词**：变长行布局，每行列数不同（如卜算子首句 5 字、第三句 7 字）。首次创建词画板时，前端向后端发送全占位符文本（`charCount` 个 `□`），从返回的 `display_segments` 获取每行的字数（即每段 `text_chars.length`），据此初始化变长网格。短行后面不填充，行与行左对齐。  
* **实时格律检测 (Real-time Validation)**：  
  * **触发机制**：全篇检测。前端防抖 (Debounce 500ms) 后，将网格中所有字符（含占位符 `□`）按行拼接为纯文本字符串，调用 `POST /api/validate_meter`。  
  * **规则匹配模式**：支持两种模式，由前端根据用户是否指定体裁决定：  
    * **自动匹配**（默认）：不传 `rule_name`，后端根据 genre + 汉字总数自动在所有同字数的候选规则中逐一尝试，选择错误最少的作为 `closest_rule` 返回。  
    * **显式指定**：传 `rule_name` 参数，支持全名精确匹配（如 `"七律仄起首句入韵"`）或前缀模糊匹配（如 `"五律"` 匹配所有以"五律"开头的规则，从中选错误最少的）。详见 4.3 节 API 说明。  
  * **空缺处理**：前端将所有未填写的空格替换为占位符 **`□`**（U+25A1），以保持总字数与目标体裁一致。后端 `checker.py` 已修改：提取字符时保留 `□`，在平仄检测 (`_check_tone`) 中遇到 `□` 跳过，在押韵检测 (`_check_same_category`) 中遇到 `□` 跳过。注意：不使用汉字"中"作为占位符，因为"中"有自身的韵部归属（平水韵"一东"），会导致押韵误判。  
  * **报错逻辑**：后端返回 `errors` 数组（非矩阵），每项包含 `position`（0-based 扁平索引）、`error_type`（"Tone" 或 "Rhyme"）、`message`（如"应为平, 实为仄"）。前端根据 `position` 映射到对应网格坐标 `(lineIndex, charIndex)` 进行高亮标红。  
  * **韵脚检测**：后端返回 `rhyme_positions`（所有押韵位置索引）和 `rhyme_chars`（对应的韵脚字）。占位符位置的韵脚由后端自动跳过；仅当用户填入真实字符且出韵时，才在 `errors` 中报告 "Rhyme" 类型错误。

#### **F2. 纵向候选项 (Vertical Candidates)**

* **交互**：每个字的格子下方，有一个"+"号或空白槽位。  
* **功能**：用户可以点击槽位输入备选字，支持一键替换正文。替换后自动触发格律重检。  
* **限制**：每个位置最多 5 个候选字。  
* **持久化**：候选项数据存储在 Board 的 `candidatesMap` 字段中（详见 F6）。

#### **F3. 智能韵书 (Smart Rhyme Book)**

* **韵书标准**：  
  * 默认逻辑：诗体自动采用《平水韵》（标识符 `"Pingshuiyun"`），词牌自动采用《词林正韵》（标识符 `"Cilinzhengyun"`）。前端根据用户选择的体裁大类（诗/词）自动填充 `rhyme_book_name` 参数传给后端。  
  * 扩展性：预留《中华新韵》切换入口。  
  * 韵书中内置了韵部间的 **关系数据**（如邻韵 `neighbor`、叶仄 `ye_ze`、叶平 `ye_ping`），后端会在押韵检测中自动使用这些关系（如律诗首句允许邻韵）。  
* **韵部推导逻辑 (Rhyme Inference)**：  
  后端在格律检测时会自动推断韵部，结果通过 `rhyme_name`、`rhyme_positions`、`rhyme_chars` 三个字段返回。推导流程如下：  
  1. **提取韵脚位置**：后端从匹配规则的 `rhyme_rule`（递归 AST 结构）中提取所有 `SAME_CATEGORY` 节点记录的押韵位置。  
  2. **换韵检测**：若规则的 AST 中存在多个独立的 `SAME_CATEGORY` 节点（常见于词牌），判定为"换韵"，`rhyme_name` 返回 "(换韵)"。  
  3. **首句入韵处理**：对于律诗首句入韵的 `OR` 规则，推断韵部时排除首句韵脚，仅用后续韵脚字推断。  
  4. **韵部交集推断**：取所有有效韵脚字在韵书中的韵部，求**交集**。若交集非空，`rhyme_name` 返回韵部名称（如 "五微"）；若交集为空（说明作者可能出韵），返回 `null`。  
* **右侧栏韵部展示**：  
  * 若 `rhyme_name` 有值且非"(换韵)"：调用 `GET /api/rhyme/lookup` 获取该韵部下所有同韵字（含邻韵以灰色展示），在右侧栏展示供用户参考选字。  
  * 若 `rhyme_name` 为 `null`：用户尚未填入足够韵脚字，或韵脚字之间无共同韵部。此时提供"韵部下拉菜单"（通过 `GET /api/rhyme/list` 获取完整韵部列表）+ "单字搜索框"（通过 `GET /api/char/lookup` 查询单字所属韵部）供手动选择。用户输入某字后，若该字仅属一个韵部则直接切换显示；若属多韵部，弹出列表供用户选择。  
  * 若为"(换韵)"：分段展示各段的韵部信息。  
* **韵字查找的数据基础**：  
  * **正向查找（字 → 韵部）**：基于 `char_dict.json`（20,751 字），查询单字在指定韵书下的所有韵部归属。注意一个字可能属于多个韵部（约 3,500+ 字存在此情况），原因包括多音字和声调分韵。  
  * **逆向查找（韵部 → 所有同韵字）**：基于 `rhyme_books.json`，返回指定韵部下的全部汉字列表，支持按声调过滤（仅平/仅仄）和邻韵扩展。  
  * **性能优化**：可选方案为前端启动时全量加载 `char_dict.json`（约 3~4 MB）到内存，之后所有正向查找为纯前端零延迟操作，仅逆向查找需请求后端。韵部列表在页面加载时一次性获取并缓存。

#### **F4. 底部多功能字典 (Contextual Dictionary)**

位于中栏底部（Web）或屏幕底部（Mobile），高度固定或自适应。

**界面布局设计**：

* **第一行 (Input)**：输入框 和 搜索 按钮。  
* **第二行 (Function Tabs)**：  
  * 逻辑：若输入字数 > 1，仅显示 **对语** Tab。若字数 == 1，显示 **韵部**、**词首**、**词末**、**对语** 四个 Tab。  
* **第三行 (Filters \- 仅针对词首/词末)**：两组垂直筛选器。  
  * **字数筛选器**：使用圆点符号表示。  
    * 2字词：●◦ (词首) / ◦● (词末)  
    * 3字词：●◦◦ / ◦◦●  
    * 4字词：●◦◦◦ / ◦◦◦●  
  * **邻字平仄筛选器**：按查询字的邻字（词首=第2字，词末=倒数第2字）平仄分类。  
    * 选项：**\[平\]** / **\[仄\]** / **\[全部\]**  
    * 示例：查"花"词末，选\[平\]→ 梅花(342), 桃花(160)；选\[仄\]→ 落花(172), 杏花(78)  
    * 可平可仄的词（如"花间"，"间"可平可仄）同时出现在平、仄两组中  
* **第四区域 (Results)**：滚动展示检索结果（按出现频次降序排列，每组最多 50 条）。

**各 Tab 的数据来源与 API**：

| Tab | 触发 | API | 数据来源 |
|-----|------|-----|----------|
| **韵部** | 输入 1 字 | `GET /api/char/lookup?char=花&book=Pingshuiyun` | `char_dict.json`，返回该字所属韵部列表 |
| **词首** | 输入 1 字 | `GET /api/dictionary/search?term=花&mode=head&length=2&tone=P` | `phrase_head.json`（3.8 MB），按邻字平仄分桶，每桶 top 50 |
| **词末** | 输入 1 字 | `GET /api/dictionary/search?term=花&mode=tail&length=2&tone=Z` | `phrase_tail.json`（4.4 MB），按邻字平仄分桶，每桶 top 50 |
| **对语** | 输入 1~4 字 | `GET /api/dictionary/search?term=明月&mode=pair` | `phrase_pairs.json`（3.3 MB），仅基于律诗颔联/颈联（95,992 首律诗, 191,984 个对仗行对） |

**对语数据说明**：对语结果的**查询词与返回结果等长**（查 1 字返回 1 字对、查 2 字返回 2 字对），因为对仗要求同位置同长度。双向存储，无论用户输入哪一侧都能查到对方。

#### **F5. 灵感板 (Inspiration Board)**

位于左侧栏（Web）或左滑唤出（Mobile），用于随手记录创作过程中的碎片灵感。**每个画板拥有独立的灵感板**，切换画板时灵感内容跟随切换。

**核心交互**：

* **添加灵感**：区域底部固定一个虚线灰色圆角矩形，中间显示 **"+"** 号。点击后显示类型选择：  
  * **文本** (P00)：直接在卡片内输入，默认保持可编辑状态（`contenteditable`），无需额外点击进入编辑。  
  * **图片** (P0)：从相册选择或拍照上传。  
  * **语音条** (P1)：按住录音，松手结束，生成一条语音条卡片。  
* **卡片布局**：所有灵感卡片从上到下纵向堆叠，最新的在底部（紧贴"+"按钮上方）。每张卡片为白色圆角矩形，右上角有删除按钮（x）。  
* **删除**：点击卡片右上角 x，二次确认后删除。  
* **拖拽到正文**：文本卡片中的文字支持选中后拖拽到中栏正文网格区（Web 端）。

**图片压缩逻辑** (P0)：

* 上传前在前端使用 Canvas API 进行压缩：  
  * 最大尺寸：长边不超过 **1200px**，等比缩放。  
  * 格式：统一转为 **JPEG**，quality = **0.7**。  
  * 压缩后以 Base64 DataURL 形式存入 Board 数据。  
* 单张图片压缩后目标大小 < **200KB**。

**存储方案**：

* 灵感卡片数据存储在所属 Board 对象的 `inspirationCards` 字段中（详见 F6 Board 数据结构），随画板一同持久化到 localStorage。  
* 数据结构：

```typescript
interface InspirationCard {
  id: string;           // UUID
  type: 'text' | 'image' | 'audio';
  content: string;      // 文本内容 / 图片 Base64 DataURL / 音频 Base64 DataURL
  createdAt: number;    // 时间戳
}
```

* localStorage 容量上限约 5~10 MB（视浏览器），需在添加时检查剩余空间，空间不足时提示用户清理旧灵感或删除不需要的画板。

#### **F6. 画板管理 (Board Management)**

每个创作实例为一个**画板 (Board)**，包含独立的正文网格、灵感板、韵律状态。

**核心操作**：

* **新建画板**：点击顶部"+"按钮，进入体裁选择流程（见下方），完成后创建空白画板。  
* **切换画板**：顶部显示当前画板标题（可编辑），点击下拉可切换到其他画板。  
* **删除画板**：在画板列表中左滑（Mobile）或悬浮出现删除按钮（Web），二次确认后删除。

**首次打开体验**：用户首次访问时（localStorage 为空），自动进入体裁选择流程创建第一个画板。不显示空白引导页，直接进入创作状态。

**新建画板 — 体裁选择流程**：

```
一级选择: [诗] / [词]
    │
    ├── 选"诗" ──────────────────────────────────────┐
    │   二级选择: [五律] [七律] [五绝] [七绝]         │
    │   选中即完成，无需进一步指定平起/仄起。          │
    │   rule_name 传前缀（如 "五律"），               │
    │   后端检测时在 4 种变体中自动匹配最优。         │
    │                                                 │
    ├── 选"词" ──────────────────────────────────────┐
    │   二级: 可搜索的词牌列表                         │
    │   ┌─────────────────────────────┐               │
    │   │ 搜索词牌...                  │               │
    │   │ 卜算子_龙谱_格一      44字  │               │
    │   │ 卜算子_龙谱_格二      44字  │               │
    │   │ 卜算子_钦谱_格一      44字  │               │
    │   │ 菩萨蛮_龙谱_正格      44字  │               │
    │   │ 水调歌头_钦谱_格一    95字  │               │
    │   │ 水调歌头_钦谱_格二    95字  │               │
    │   │ ...                         │               │
    │   └─────────────────────────────┘               │
    │   列表项显示: 格式全名 + 字数                    │
    │   建议 specify 到具体格式（与 rule name 一致），  │
    │   因为同一词牌的不同格式可能字数不同              │
    │   （819 词牌中 317 个存在字数歧义）。            │
    │   选中后 rule_name 传格式全名                    │
    │   （如 "卜算子_龙谱_格一"）。                    │
    └─────────────────────────────────────────────────┘
```

**词牌列表数据源**：前端启动时通过 `GET /api/rules/list?genre=Ci` 获取轻量摘要（仅 `name` + `char_count`，约 50 KB），用于搜索候选项渲染。

**画板与检测的关联**：画板创建时记录的体裁信息（`genre` + `rule_name`）会在每次格律检测时传给后端 `POST /api/validate_meter`。诗体传 `rule_name` 前缀（如 `"五律"`），词牌传精确格式名（如 `"卜算子_龙谱_格一"`）。`ensure_longpu` 由前端根据 `genre` 自动设置（`Ci` 时传 `true`，`Shi` 时传 `false`），不存储在 Board 中。

**画板数据结构**（持久化存储在 localStorage）：

```typescript
interface Board {
  id: string;                 // UUID
  title: string;              // 用户自定义标题，默认 "新建·{体裁}"
  genre: 'Shi' | 'Ci';       // 体裁大类
  ruleName: string;           // 体裁名称/前缀（如 "五律" 或 "卜算子_龙谱_格一"）
  charCount: number;          // 目标字数（由规则决定，用于初始化网格）
  rhymeBookName: string;      // 韵书（自动: Shi→Pingshuiyun, Ci→Cilinzhengyun）
  poemChars: string[];        // 扁平字符数组，空位存 "□"，长度 = charCount
  candidatesMap: Record<number, string[]>;  // 候选项，key 为 globalIndex
  inspirationCards: InspirationCard[];  // 灵感板数据（每画板独立）
  createdAt: number;
  updatedAt: number;
}
```

localStorage key: `boards`（Board 数组）+ `active_board_id`（当前激活画板 ID）。自动保存策略：每次用户输入后立即写入 localStorage。

**Board 与 PoemState 的关系**：Board 是持久化快照（仅存用户输入数据），PoemState 是运行时状态（含后端检测结果如 errors、displaySegments 等）。每次用户输入或切换画板时：(1) 从 Board 读取 `poemChars` 初始化网格；(2) 调用后端检测获得 PoemState 中的 errors/rhyme 信息；(3) 用户修改后写回 Board。PoemState 中的检测结果不持久化，每次打开画板时重新请求后端获取。

## **4\. 技术实现方案**

### **4.1 技术栈**

* **Frontend**: React.js, Tailwind CSS.  
* **Backend**: Python Flask (flask-cors 处理跨域).  
* **Deployment**: Vercel (前端) \+ 阿里云/Render (Flask 后端独立部署). 后端需配置 CORS 允许前端域名 `write.sjtuguoxue.space` 的跨域请求.

### **4.2 数据结构设计 (Frontend State)**

```typescript
interface PoemChar {
  char: string;           // 当前显示的字（空位为 "□"）
  index: number;          // 行内索引，用于光标定位
  globalIndex: number;    // 在全篇中的 0-based 扁平索引，用于与后端 errors.position 对应
  tone: '平' | '仄' | '中'; // 实际平仄（前端从 char_dict 查询，或从后端 display_segments 推导）
  requiredTone: '平' | '仄' | '中'; // 格律要求，来自后端 rule_items.tone（P→平, Z→仄, A→中）
  comment: string | null; // 格律标注，来自后端 rule_items.comment（如 "句" 表示句读标记）
  isError: boolean;       // 是否出律，通过检查后端 errors 列表中是否存在该 globalIndex 确定
  errorMessage: string;   // 错误描述，来自后端 errors.message（如 "应为平, 实为仄"）
  isRhyme: boolean;       // 是否为押韵位置，通过检查后端 rhyme_positions 确定
  candidates: string[];   // 候选项（推敲炼字用），来自 Board.candidatesMap
}

// 后端返回的分行数据（诗按联分行，词按韵脚分行）
interface DisplaySegment {
  text_chars: string[];                           // 该行的字列表
  rule_items: { tone: 'P'|'Z'|'A', comment: string|null }[];  // 对应的格律要求
  start_index: number;                            // 该行首字在全篇中的 0-based 索引
}

// 运行时状态（含后端检测结果，不持久化）
interface PoemState {
  lines: PoemChar[][];          // 网格数据（诗为规整矩阵，词为变长行）
  closestRuleName: string;      // 后端匹配的体裁名（如 "七律·仄起首句入韵"）
  rhymeName: string | null;     // 推断的韵部名
  rhymePositions: number[];     // 押韵位置索引
  rhymeChars: string[];         // 押韵字
  displaySegments: DisplaySegment[];  // 分行显示数据
}
```

### **4.3 API 接口设计 (Flask)**

#### **POST /api/validate\_meter**

格律检测主接口，对应后端 `PoetryChecker.check_auto()` 方法。

**Request Body (JSON)**：

| 参数 | 类型 | 必填 | 说明 |
| :---- | :---- | :---- | :---- |
| poem\_text | string | 是 | 诗词正文的纯文本字符串。后端会自动提取其中的汉字和占位符 `□`，忽略标点和空白。未填写的格子由前端用 `□` 标记。 |
| genre | "Shi" \| "Ci" | 是 | 体裁大类。诗（含绝句、律诗等）传 `"Shi"`，词传 `"Ci"`。 |
| rhyme\_book\_name | string | 是 | 韵书标识。诗体传 `"Pingshuiyun"`（平水韵），词牌传 `"Cilinzhengyun"`（词林正韵）。前端根据 genre 自动填充。 |
| rule\_name | string | 否 | **显式指定体裁名称**。不传时后端按字数自动匹配最优规则。传入时支持两种模式：**全名精确匹配**（如 `"七律仄起首句入韵"`，仅用该条规则检测）和**前缀模糊匹配**（如 `"五律"`，后端筛选所有 name 以该前缀开头的规则，从中选错误最少的返回）。详见下方"规则匹配逻辑"。 |
| ensure\_longpu | boolean | 否 | 默认 `false`。前端约定：`genre === "Ci"` 时自动传 `true`，仅匹配龙谱规则。无需用户手动设置。 |

**规则匹配逻辑**（后端 checker 已实现）：

```
                  rule_name 参数是否传入？
                 ┌──── 否 ────┐──── 是 ────┐
                 ▼                          ▼
          自动匹配模式                rule_name 是否精确命中某条规则？
     按 genre + 字数                ┌──── 是 ────┐──── 否 ────┐
     取所有候选规则                  ▼                          ▼
     逐一尝试                   精确匹配模式              前缀匹配模式
     选错误最少的                仅用该条规则             筛选 name.startswith(rule_name)
                                检测并返回               的所有候选规则
                                                        逐一尝试，选错误最少的
```

**前端使用场景示例**：
- 用户未指定体裁 → 不传 `rule_name`，后端自动推断（如 56 字诗自动匹配七律）
- 用户从下拉菜单选了"五律" → 传 `rule_name="五律"`，后端在五律平起/五律仄起/五律平起首句入韵/五律仄起首句入韵 4 种变体中选最优
- 用户明确选了"卜算子\_龙谱\_格一" → 传 `rule_name="卜算子_龙谱_格一"`，精确匹配

**Response Body (JSON)**：

| 字段 | 类型 | 说明 |
| :---- | :---- | :---- |
| is\_valid | boolean | 格律是否完全通过 |
| closest\_rule | object \| null | 最佳匹配的规则对象，含 `name`（如"七律仄起首句入韵"）、`genre`、`cipai`、`char_count` |
| errors | array | 错误列表，每项含 `position`（0-based 扁平索引）、`character`（出错的字）、`error_type`（`"Tone"` / `"Rhyme"`）、`message`（如"应为平, 实为仄"） |
| display\_segments | array | 分行显示数据。每项含 `text_chars`（该行的字列表）、`rule_items`（对应格律要求，每项为 `{"tone": "P"\|"Z"\|"A", "comment": "句"\|null}`）、`start_index`（首字在全篇的 0-based 索引）。**诗按联（每两句）分行，词按韵脚分行。** |
| rhyme\_name | string \| null | 后端自动推断的韵部名称（如 `"五微"`），换韵词牌返回 `"(换韵)"`，无法推断时为 `null` |
| rhyme\_positions | array\[int\] | 所有押韵位置的 0-based 扁平索引列表 |
| rhyme\_chars | array\[string\] | 对应押韵位置上的实际汉字列表 |

**说明**：`errors` 是扁平列表而非矩阵。前端需根据每个 error 的 `position` 值映射到对应网格坐标 `(lineIndex, charIndex)` 进行高亮。`display_segments` 可直接用于构建右侧栏的平仄谱展示。

#### **GET /api/char/lookup**

单字韵部查找（正向查找）。基于 `char_dict.json`。

| 参数 | 类型 | 说明 |
| :---- | :---- | :---- |
| char | string | 单个汉字 |
| book | string | 韵书标识（`"Pingshuiyun"` 或 `"Cilinzhengyun"`） |

Response 示例（多韵部字）：
```json
{
  "char": "行",
  "tones": ["平", "去"],
  "rhyme_categories": [
    { "name": "八庚", "tone_type": "P" },
    { "name": "七阳", "tone_type": "P" },
    { "name": "二十四敬", "tone_type": "Z" },
    { "name": "二十三漾", "tone_type": "Z" }
  ]
}
```

#### **GET /api/rhyme/lookup**

韵部同韵字查找（逆向查找）。基于 `rhyme_books.json`。

| 参数 | 类型 | 说明 |
| :---- | :---- | :---- |
| book | string | 韵书标识 |
| category | string | 韵部名（如 `"六麻"`） |
| include | string | 可选，要包含的关系类型（如 `"neighbor"` 邻韵） |

Response 示例（含邻韵扩展）：
```json
{
  "primary": {
    "category_name": "六麻", "tone_type": "P",
    "total": 158, "characters": ["花", "家", "霞", "..."]
  },
  "related": [{
    "relation": "neighbor",
    "category": { "category_name": "五歌", "tone_type": "P", "total": 93, "characters": ["歌", "河", "..."] }
  }]
}
```

#### **GET /api/rhyme/list**

韵部列表查询。用于韵部下拉菜单。

| 参数 | 类型 | 说明 |
| :---- | :---- | :---- |
| book | string | 韵书标识 |
| tone | string | 可选，`"P"` 仅平声韵部，`"Z"` 仅仄声韵部 |

Response 示例：
```json
{
  "book": "Pingshuiyun",
  "categories": [
    { "name": "一东", "tone_type": "P", "char_count": 182 },
    { "name": "二冬", "tone_type": "P", "char_count": 105 }
  ]
}
```

#### **GET /api/rules/list**

规则列表查询。用于 F6 体裁选择的词牌搜索列表。

| 参数 | 类型 | 说明 |
| :---- | :---- | :---- |
| genre | string | `"Shi"` 或 `"Ci"` |

Response 示例：
```json
[
  { "name": "卜算子_龙谱_格一", "char_count": 44 },
  { "name": "卜算子_龙谱_格二", "char_count": 44 },
  { "name": "水调歌头_钦谱_格一", "char_count": 95 }
]
```

#### **GET /api/dictionary/search**

底部多功能字典查询。基于预构建的 `phrase_head.json`、`phrase_tail.json`、`phrase_pairs.json`。

| 参数 | 类型 | 说明 |
| :---- | :---- | :---- |
| term | string | 查询词（1~4 个字） |
| mode | string | `"head"`（词首）/ `"tail"`（词末）/ `"pair"`（对语） |
| length | string | 仅 head/tail 有效，可选 `"2"` / `"3"` / `"4"` / `"all"` |
| tone | string | 仅 head/tail 有效，按邻字平仄筛选。可选 `"P"`（邻字为平）/ `"Z"`（邻字为仄）/ `"all"`（合并两桶）。邻字 = 紧邻查询字的那个字（词首为第2字，词末为倒数第2字）。 |

Response 示例（词首查"花"，2字，邻字平声）：
```json
[["花开", 253], ["花前", 116], ["花间", 113], ["花时", 107]]
```

Response 示例（对语查"明月"）：
```json
[["白云", 63], ["清风", 39], ["夕阳", 20], ["青山", 17]]
```

## **5\. UI/UX 细节 (Visuals)**

* **配色方案**：  
  * 主背景：\#FBFBF6  
  * 激活选区：  
  * 错误高亮：\#E11D48 (Rose-600)  
  * 字体：  
*  **无干扰模式**：支持折叠侧栏。

## **6\. 部署架构 (Deployment)**

* **Frontend**: Vercel App 托管 React 构建产物。  
* **Backend**: Flask 独立部署于阿里云或 Render，配置 `flask-cors` 允许 `write.sjtuguoxue.space` 的跨域请求。  
* **Domain**: write.sjtuguoxue.space (CNAME 记录指向 Vercel).  
* **API Proxy**: 前端通过环境变量 `REACT_APP_API_BASE` 配置后端地址。

## **7\. 开发排期 (建议)**

* **P0 (MVP)**: 画板管理（新建/删除/切换 + 体裁选择），三栏布局，网格点击输入（虚拟光标），整首格律检测（占位符法 + 显式指定体裁），基础韵书逻辑（正向/逆向查找），灵感板文本卡片 + 图片卡片（含压缩）。  
* **P1**: 底部多功能字典（词首/词末/对语），移动端适配，灵感板语音条。  
* **P2**: 与主站衔接。

## **8\. 静态数据文件清单**

以下文件位于 `static/config/` 目录，由构建脚本一次性生成：

| 文件 | 大小 | 说明 | 构建脚本 |
|------|------|------|----------|
| `char_dict.json` | ~3.5 MB | 汉字字典（20,751 字的平仄与韵部） | `build_config.py` |
| `rhyme_books.json` | ~2 MB | 韵书（平水韵 106 韵部 + 词林正韵 33 韵部） | `build_config.py` |
| `shi_rules.json` | ~0.5 MB | 诗体格律规则 | `build_config.py` |
| `ci_rules.json` | ~8 MB | 词牌格律规则 | `build_config.py` |
| `phrase_head.json` | 3.8 MB | 词首索引（4,694 个首字，按邻字平仄分桶） | `build_phrase_db.py` |
| `phrase_tail.json` | 4.4 MB | 词末索引（4,666 个末字，按邻字平仄分桶） | `build_phrase_db.py` |
| `phrase_pairs.json` | 3.3 MB | 对语索引（85,747 个词条，仅律诗颔联/颈联） | `build_phrase_db.py` |
