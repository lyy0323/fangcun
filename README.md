# 方寸 · 诗词创作画布

古典诗词创作工具。实时格律校验、韵部查询、词语联想、典故检索，一页完成查韵选词填字出图。

**在线使用：** [write.sjtuguoxue.space](https://write.sjtuguoxue.space)
**格律检测 API：** [checker.sjtuguoxue.space](https://checker.sjtuguoxue.space)
**API 文档：** [write.sjtuguoxue.space/docs](https://write.sjtuguoxue.space/docs)
**Android APK：** [GitHub Release 下载](https://github.com/lyy0323/fangcun/releases/latest)

![desktop-demo](frontend/public/slides/desktop-demo.png)

## 功能

- **格律校验** — 五/七言律诗绝句 + 2500+ 词牌，实时标注平仄错误与韵脚问题，支持占位符 □ 填词
- **自由韵脚检测** — 古体诗 / 自由诗韵脚自动识别与分组
- **韵部查询** — 平水韵 / 词林正韵 / 中华通韵，按词频排序，邻韵关联
- **字典联想** — 词首、词末、对仗、同位语查询，80 万首古诗词语料
- **典故检索** — 1.3 万条典故，按匹配度排序
- **导入诗词** — 搜索并导入历代诗词（80 万首），自动匹配格律
- **组诗创作** — 多首诗词组合为一组，统一管理
- **创作画布** — 网格编辑器、灵感板、多画板管理、文件夹、深色/浅色主题
- **元数据编辑** — 序言、脚注、日期（农历/公历），署名（三层优先级）
- **导出图片** — Canvas 渲染诗词卡片，33 款主题（渐变/等高线/有机曲线/纹理），2x 高清输出，水印亮度自适应
- **CLI 工具** — `fangcun` 命令行，6 个子命令，调用线上 checker 服务，零本地依赖
- **Android** — WebView + Chaquopy 内嵌 Python，词库离线，格律检测走线上服务

## 架构

```
checker.sjtuguoxue.space        ← 格律检测独立服务（check_rhyme 仓库）
├── POST /api/validate_meter       格律检测
├── POST /api/free_rhyme           自由韵脚
├── POST /api/char/batch           批量字音查询
├── GET  /api/char/lookup          单字音韵
├── GET  /api/rhyme/lookup         韵部同韵字
├── GET  /api/rhyme/list           韵部列表
└── GET  /api/rules/list           格律规则列表

write.sjtuguoxue.space           ← 本项目
├── Vercel rewrite → checker（音韵路由透明代理）
├── GET  /api/char/definitions     单字释义
├── GET  /api/dictionary/search    词首/词末/对语/同位
├── GET  /api/dictionary/allusion  典故检索
├── /docs, /dashboard              文档与统计
└── Frontend SPA
```

## 快速开始

### 本地开发

```bash
# 后端（释义 + 词库服务）
pip install -r requirements.txt
python app.py                    # Flask on :5050

# 前端
cd frontend && npm install
npm run dev                      # Vite on :3000, 格律请求代理到线上 checker
```

格律检测由 checker.sjtuguoxue.space 提供，本地开发无需额外启动。

### CLI

```bash
pip install -e .

fangcun validate --text "白日依山尽，黄河入海流。欲穷千里目，更上一层楼。" --genre Shi
fangcun validate --text "..." --genre Ci --rhyme-book Cilinzhengyun --longpu --pretty
fangcun rules --genre Shi --search 五绝
fangcun char --char 明月 --book Pingshuiyun
fangcun rhyme --book Pingshuiyun --category 一东
fangcun suggest --term 明月 --mode pair --with-tones
fangcun free-rhyme --text "卖炭翁，伐薪烧炭南山中。满面尘灰烟火色，两鬓苍苍十指黑。" --pretty
```

所有查询通过线上 checker/dict 服务完成，无需本地数据文件。
可通过 `FANGCUN_CHECKER_URL` / `FANGCUN_DICT_URL` 环境变量指向自建服务。

### Android APK

```bash
cd frontend && npm install && npm run build && cd ..
cd android
KEYSTORE_PASSWORD=xxx KEY_PASSWORD=xxx ./gradlew assembleRelease
```

### API

```bash
# 格律检测（无需认证）
curl -X POST https://write.sjtuguoxue.space/api/validate_meter \
  -H "Content-Type: application/json" \
  -d '{"poem_text":"床前明月光，疑是地上霜。举头望明月，低头思故乡。","genre":"Shi"}'

# 字典搜索
curl "https://write.sjtuguoxue.space/api/dictionary/search?term=明月&mode=pair"
```

详见 [API 文档](https://write.sjtuguoxue.space/docs) 和 [格律检测 API 文档](https://checker.sjtuguoxue.space)。

## 技术栈

| 层 | 技术 |
|---|------|
| 前端 | React 19 · TypeScript · Vite · Tailwind CSS 4 |
| 后端 | Python · Flask |
| 格律检测 | 独立服务 · [check_rhyme](https://github.com/lyy0323/check_rhyme) |
| 数据 | 平水韵 / 词林正韵 / 中华通韵 · 80 万首诗词 · 1.3 万典故 |
| 数据库 | Neon PostgreSQL (线上) · JSON fallback (本地) |
| 部署 | Vercel Serverless · Android (Chaquopy + WebView) |

## 项目结构

```
├── app.py              # Flask 主服务（释义 + 词库 + 统计）
├── dict_db.py          # 词库数据库访问层（Neon PostgreSQL / JSON fallback）
├── cli.py              # CLI 入口 (fangcun)，调用线上 checker 服务
├── api_keys.py         # 调用统计（可选）
├── static/
│   ├── config/         # 词库数据 JSON
│   ├── docs.html       # API 文档页
│   └── dashboard.html  # 调用统计看板
├── frontend/src/       # React 前端
├── android/            # WebView + Chaquopy 打包
├── api/index.py        # Vercel serverless 入口
├── vercel.json         # Vercel 路由 + checker rewrite
├── LICENSE             # AGPL-3.0
└── .env.example        # 环境变量模板
```

## License

[AGPL-3.0](LICENSE)，附加条款：导出图片中的水印（项目名"方寸"）须保留。

## 开发者

上海交通大学国学社 · 技术部

联系：guoxue_sjtu@163.com
