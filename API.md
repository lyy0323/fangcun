# 方寸 API 文档

格律诗词校验与辅助创作接口。

Base URL: `http://localhost:5050` (本地开发) 或你的部署地址。

---

## 认证

所有 `/api/*` 请求需通过 `X-API-Key` Header 传递 API Key。

```
X-API-Key: fc_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

**管理 Key：**

```bash
fangcun key create --name "my-bot"     # 创建（仅显示一次）
fangcun key list                        # 列出所有 Key
fangcun key revoke --key "fc_xxx..."    # 吊销
```

本地开发可设置环境变量 `FANGCUN_AUTH_DISABLED=1` 跳过认证。

## 限流

| 端点 | 限制 |
|------|------|
| `/api/validate_meter` | 30 次/分钟 |
| `/api/dictionary/search` | 120 次/分钟 |
| 其他所有端点 | 60 次/分钟 |

超限返回 `429 Too Many Requests`。

## 通用错误格式

```json
{ "error": "错误描述" }
```

| 状态码 | 含义 |
|--------|------|
| 400 | 参数校验失败（无效枚举值、参数过长等） |
| 401 | 缺失或无效 API Key |
| 404 | 资源不存在（如韵部名不存在） |
| 429 | 请求频率超限 |

## 通用参数约束

- 所有查询参数长度上限 2000 字符
- 请求体上限 50 KB
- `genre` 可选值：`Shi`（诗）、`Ci`（词）
- `book` / `rhyme_book_name` 可选值：`Pingshuiyun`（平水韵）、`Cilinzhengyun`（词林正韵）
- `mode` 可选值：`head`、`tail`、`pair`
- `tone` 可选值：`P`（平）、`Z`（仄）

---

## 1. 校验格律

检测诗词的平仄和押韵是否符合规则。这是核心接口。

```
POST /api/validate_meter
```

**请求体 (JSON)：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `poem_text` | string | 是 | 诗词文本（标点、空格会被自动忽略，只提取汉字） |
| `genre` | string | 否 | `Shi` 或 `Ci`，默认 `Shi` |
| `rhyme_book_name` | string | 否 | 韵书名，默认 `Pingshuiyun` |
| `rule_name` | string | 否 | 指定规则名（如 `五绝仄起`），不传则自动匹配最接近的规则 |
| `ensure_longpu` | bool | 否 | 仅匹配龙谱规则，默认 `false` |

**请求示例：**

```bash
curl -X POST http://localhost:5050/api/validate_meter \
  -H "X-API-Key: fc_xxx" \
  -H "Content-Type: application/json" \
  -d '{
    "poem_text": "白日依山尽，黄河入海流。欲穷千里目，更上一层楼。",
    "genre": "Shi",
    "rhyme_book_name": "Pingshuiyun"
  }'
```

**响应示例（格律通过）：**

```json
{
  "is_valid": true,
  "closest_rule": {
    "name": "五绝仄起",
    "genre": "Shi",
    "cipai": "Wujue",
    "char_count": 20
  },
  "errors": [],
  "warnings": [],
  "rhyme_name": "十一尤",
  "rhyme_positions": [9, 19],
  "rhyme_chars": ["流", "楼"],
  "rhyme_groups": [
    { "positions": [9, 19], "type": "same" }
  ],
  "rhyme_relations": [],
  "display_segments": [
    {
      "start_index": 0,
      "text_chars": ["白", "日", "依", "山", "尽", "黄", "河", "入", "海", "流"],
      "rule_items": [
        { "tone": "A", "comment": null },
        { "tone": "Z", "comment": null },
        { "tone": "A", "comment": null },
        { "tone": "P", "comment": null },
        { "tone": "Z", "comment": null },
        { "tone": "P", "comment": null },
        { "tone": "P", "comment": null },
        { "tone": "A", "comment": null },
        { "tone": "Z", "comment": null },
        { "tone": "P", "comment": null }
      ]
    }
  ]
}
```

**响应示例（有错误）：**

```json
{
  "is_valid": false,
  "closest_rule": {
    "name": "五绝仄起首句入韵",
    "genre": "Shi",
    "cipai": "Wujue",
    "char_count": 20
  },
  "errors": [
    {
      "position": 1,
      "character": "风",
      "error_type": "Tone",
      "message": "应为仄, 实为平"
    },
    {
      "position": 6,
      "character": "雨",
      "error_type": "Tone",
      "message": "应为平, 实为仄"
    }
  ],
  "warnings": [],
  "rhyme_name": "五微",
  "rhyme_positions": [4, 9, 19],
  "rhyme_chars": ["开", "飞", "归"]
}
```

**响应字段说明：**

| 字段 | 说明 |
|------|------|
| `is_valid` | 是否完全通过校验 |
| `closest_rule` | 匹配到的最接近规则（名称、体裁、词牌、字数） |
| `errors[]` | 错误列表，每项包含出错位置 (0-indexed)、字符、错误类型 (`Tone`/`Rhyme`)、描述 |
| `warnings[]` | 警告列表（如重复用字） |
| `rhyme_name` | 推断的韵部名（一韵到底时） |
| `rhyme_positions` | 押韵位置（0-indexed） |
| `rhyme_chars` | 押韵字列表 |
| `display_segments[]` | 分段显示数据，每段包含字列表和对应谱面。`tone` 值：`P`=平、`Z`=仄、`A`=中（可平可仄） |

---

## 2. 查字

查询单个汉字的声调和所属韵部。支持繁体自动转简体。

```
GET /api/char/lookup
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `char` | string | 是 | 单个汉字 |
| `book` | string | 否 | 韵书名。不传则返回所有韵书的韵部 |

**示例 — 指定韵书：**

```bash
curl "http://localhost:5050/api/char/lookup?char=花&book=Pingshuiyun" \
  -H "X-API-Key: fc_xxx"
```

```json
{
  "char": "花",
  "tones": ["平", "上"],
  "rhyme_categories": [
    { "name": "六麻", "tone_type": "P" }
  ]
}
```

**示例 — 不指定韵书（返回所有）：**

```bash
curl "http://localhost:5050/api/char/lookup?char=花" \
  -H "X-API-Key: fc_xxx"
```

```json
{
  "char": "花",
  "tones": ["平", "上"],
  "rhyme_categories": {
    "Pingshuiyun": ["六麻"],
    "Cilinzhengyun": ["第3部_仄", "第10部_平"]
  }
}
```

> `tones` 为原始声调（平、上、去、入），`rhyme_categories` 为韵书中的韵部归属。

---

## 3. 查韵部字表

查看某个韵部包含哪些字。

```
GET /api/rhyme/lookup
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `book` | string | 否 | 韵书名，默认 `Pingshuiyun` |
| `category` | string | 是 | 韵部名，如 `一东` |
| `include` | string | 否 | 包含关联韵部，逗号分隔（如 `neighbor`） |

**示例：**

```bash
curl "http://localhost:5050/api/rhyme/lookup?book=Pingshuiyun&category=一东" \
  -H "X-API-Key: fc_xxx"
```

```json
{
  "category_name": "一东",
  "tone_type": "P",
  "total": 392,
  "characters": ["中", "总", "种", "同", "东", "红", "风", "..."],
  "relations": {
    "neighbor": ["二冬"]
  }
}
```

> 字表按词频降序排列（常用字在前）。`relations` 标注邻韵等关系。

传入 `include=neighbor` 时，响应结构变为 `{ "primary": {...}, "related": [...] }`，同时返回邻韵字表。

---

## 4. 韵部列表

列出韵书中的所有韵部概览。

```
GET /api/rhyme/list
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `book` | string | 否 | 韵书名，默认 `Pingshuiyun` |
| `tone` | string | 否 | 按声调过滤：`P`（平声韵）、`Z`（仄声韵） |

**示例：**

```bash
curl "http://localhost:5050/api/rhyme/list?book=Pingshuiyun&tone=P" \
  -H "X-API-Key: fc_xxx"
```

```json
{
  "book": "Pingshuiyun",
  "categories": [
    {
      "name": "一东",
      "tone_type": "P",
      "char_count": 392,
      "preview": "中总种同衕东梦红风冲"
    },
    {
      "name": "二冬",
      "tone_type": "P",
      "char_count": 262,
      "preview": "从共重龙供冲封鍾鐘钟"
    }
  ]
}
```

> `preview` 为该韵部最高频的前 10 个字。

---

## 5. 格律规则列表

列出可用的诗词格律规则/词牌。

```
GET /api/rules/list
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `genre` | string | 否 | `Shi` 或 `Ci`，默认 `Ci` |
| `search` | string | 否 | 按关键词搜索规则名或词牌名 |

**示例 — 搜索五绝：**

```bash
curl "http://localhost:5050/api/rules/list?genre=Shi&search=五绝" \
  -H "X-API-Key: fc_xxx"
```

```json
[
  { "name": "五绝仄起首句入韵", "char_count": 20 },
  { "name": "五绝仄起",         "char_count": 20 },
  { "name": "五绝平起",         "char_count": 20 },
  { "name": "五绝平起首句入韵", "char_count": 20 }
]
```

> 诗 (Shi) 约 16 条规则，词 (Ci) 约 2500+ 条词牌变体。

---

## 6. 词语联想

按首字、尾字查诗词用语，或查对仗字。数据来源于古诗词语料统计。

```
GET /api/dictionary/search
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `term` | string | 是 | 查询字（支持繁体） |
| `mode` | string | 否 | `head`（以此字开头）、`tail`（以此字结尾）、`pair`（对仗字），默认 `head` |
| `length` | string | 否 | 词语长度（`2`、`3`...），`all` 返回所有长度。默认 `2` |
| `tone` | string | 否 | 声调过滤：`P`（末字为平）、`Z`（末字为仄）、`all`（不过滤）。默认 `all` |

**示例 — 首字联想：**

```bash
curl "http://localhost:5050/api/dictionary/search?term=明&mode=head&length=2" \
  -H "X-API-Key: fc_xxx"
```

```json
[
  ["明月", 2298],
  ["明朝", 1683],
  ["明日", 1398],
  ["明年", 797],
  ["明时", 296]
]
```

> 返回 `[词语, 频次]` 数组，按频次降序排列。

**示例 — 对仗字：**

```bash
curl "http://localhost:5050/api/dictionary/search?term=月&mode=pair" \
  -H "X-API-Key: fc_xxx"
```

```json
[
  ["风", 4450],
  ["云", 3575],
  ["花", 1386],
  ["山", 1340],
  ["天", 1142]
]
```

> 对仗模式返回与查询字在古诗中常对仗的字及频次。

---

## CLI 等效命令

每个 API 端点都有对应的 CLI 命令（`pip install -e .` 后可用）：

| API | CLI |
|-----|-----|
| `POST /api/validate_meter` | `fangcun validate --text "..." --genre Shi --rhyme-book Pingshuiyun` |
| `GET /api/char/lookup` | `fangcun char --char 花 --book Pingshuiyun` |
| `GET /api/rhyme/lookup` | `fangcun rhyme --book Pingshuiyun --category 一东` |
| `GET /api/rhyme/list` | `fangcun rhyme --book Pingshuiyun --category 一东`（无直接对应，用 rhyme 查） |
| `GET /api/rules/list` | `fangcun rules --genre Shi --search 五绝` |
| `GET /api/dictionary/search` | `fangcun suggest --term 明 --mode head --length 2` |

CLI 默认输出 JSON，加 `--pretty` 输出人类可读格式（仅 validate 支持）。
