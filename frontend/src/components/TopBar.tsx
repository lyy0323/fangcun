import { useState, useEffect } from 'react';
import { useBoardContext, useActiveBoard } from '../context/BoardContext';
import { PLACEHOLDER } from '../lib/types';
import { ensureGregorianDate } from '../lib/dateConvert';
import { Layers, Plus, ClipboardType, Check, Upload, Sun, Moon, Settings, ChevronRight, X, BookOpen, Lightbulb, SendHorizontal, ExternalLink, Download, FolderUp, ImageDown, ScrollText } from 'lucide-react';
import type { Board } from '../lib/types';
import { ExportPreview } from './ExportPreview';
import { MetadataPopover } from './MetadataPopover';

function SettingsModal({ onClose }: { onClose: () => void }) {
  const { state, dispatch } = useBoardContext();
  const [openSection, setOpenSection] = useState<string | null>(null);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const [defaultAuthor, setDefaultAuthor] = useState(() => localStorage.getItem('default_author') ?? '');
  const toggle = (id: string) => setOpenSection(prev => prev === id ? null : id);

  function handleExport() {
    const data = {
      version: 1,
      app: 'fangcun',
      exportedAt: new Date().toISOString(),
      boards: state.boards,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const date = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `fangcun-boards-${date}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result as string);
        if (!data.boards || !Array.isArray(data.boards)) {
          setImportMsg('文件格式无效：缺少 boards 字段');
          return;
        }
        const incoming = data.boards as Board[];
        const existingIds = new Set(state.boards.map(b => b.id));
        const newCount = incoming.filter(b => !existingIds.has(b.id)).length;
        const skipCount = incoming.length - newCount;
        dispatch({ type: 'IMPORT_BOARDS', boards: incoming });
        const parts = [`导入 ${newCount} 个画板`];
        if (skipCount > 0) parts.push(`跳过 ${skipCount} 个重复`);
        setImportMsg(parts.join('，'));
      } catch {
        setImportMsg('文件解析失败，请检查 JSON 格式');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  const sections = [
    {
      id: 'tutorial',
      title: '教程',
      content: (
        <div className="text-sm text-[var(--text-secondary)] space-y-3 leading-relaxed">
          <div>
            <p className="font-medium text-[var(--text)] flex items-center gap-1.5">顶部按钮</p>
            <ul className="mt-1 space-y-1.5 pl-1">
              <li className="flex items-start gap-2"><span className="shrink-0 w-5 h-5 rounded border border-[var(--border)] flex items-center justify-center mt-0.5"><Layers size={11} /></span><span><b>画板切换</b> — 管理多个创作画板，可新建、切换、删除</span></li>
              <li className="flex items-start gap-2"><span className="shrink-0 w-5 h-5 rounded border border-[var(--border)] flex items-center justify-center mt-0.5"><ScrollText size={11} /></span><span><b>元数据</b> — 填写序言、脚注、日期（支持农历/公历切换），导出图片和上传时自动携带</span></li>
              <li className="flex items-start gap-2"><span className="shrink-0 w-5 h-5 rounded border border-[var(--border)] flex items-center justify-center mt-0.5"><Moon size={11} /></span><span><b>深浅模式</b> — 切换浅色/深色主题</span></li>
              <li className="flex items-start gap-2"><span className="shrink-0 w-5 h-5 rounded border border-[var(--border)] flex items-center justify-center mt-0.5"><Settings size={11} /></span><span><b>设置</b> — 教程、导入导出、关于</span></li>
              <li className="flex items-start gap-2"><span className="shrink-0 w-5 h-5 rounded border border-[var(--border)] flex items-center justify-center mt-0.5"><Upload size={11} /></span><span><b>上传</b> — 全文填写完成后，提交至南洋吟游</span></li>
              <li className="flex items-start gap-2"><span className="shrink-0 w-5 h-5 rounded border border-[var(--border)] flex items-center justify-center mt-0.5"><ImageDown size={11} /></span><span><b>导出图片</b> — 全文填写完成后，导出为图片</span></li>
              <li className="flex items-start gap-2"><span className="shrink-0 w-5 h-5 rounded border border-[var(--border)] flex items-center justify-center mt-0.5"><ClipboardType size={11} /></span><span><b>复制文本</b> — 将当前作品含标点复制到剪贴板</span></li>
              <li className="flex items-start gap-2"><span className="shrink-0 w-5 h-5 rounded border border-[var(--border)] flex items-center justify-center mt-0.5"><Plus size={11} /></span><span><b>新建</b> — 选择诗/词体裁创建新画板</span></li>
            </ul>
          </div>
          <div>
            <p className="font-medium text-[var(--text)] flex items-center gap-1.5">创作网格</p>
            <ul className="list-disc pl-4 mt-1 space-y-1">
              <li>点击格子输入汉字，光标自动前进</li>
              <li>系统实时校验平仄与韵律，错误处标红提示</li>
              <li>点击已填字可在下方字典查询该字韵部</li>
              <li>Shift+点击可多选文字，查询对语</li>
            </ul>
          </div>
          <div>
            <p className="font-medium text-[var(--text)] flex items-center gap-1.5">底部字典</p>
            <ul className="mt-1 space-y-1.5 pl-1">
              <li>输入汉字实时搜索，无需按回车</li>
              <li><b>韵部</b> — 查看字所属韵部，点击可联动右侧韵部面板</li>
              <li><b>词首/词末</b> — 按首字或末字查词组，支持按平仄和字数筛选</li>
              <li><b>对语</b> — 查找对仗词组，点击可直接填入对仗位置</li>
              <li className="flex items-start gap-2"><span className="shrink-0 w-5 h-5 rounded border border-[var(--border)] flex items-center justify-center mt-0.5"><SendHorizontal size={11} /></span><span>将输入内容发送到创作网格当前光标处</span></li>
            </ul>
          </div>
          <div>
            <p className="font-medium text-[var(--text)] flex items-center gap-1.5"><span className="shrink-0 w-5 h-5 rounded border border-[var(--border)] flex items-center justify-center"><BookOpen size={11} /></span>右侧韵部面板</p>
            <ul className="list-disc pl-4 mt-1 space-y-1">
              <li>浏览完整韵书（平水韵/词林正韵），按韵部分类查看韵字</li>
              <li>在字典中点击韵部标签可联动切换到对应韵部</li>
              <li>移动端点击右上角书本图标呼出</li>
            </ul>
          </div>
          <div>
            <p className="font-medium text-[var(--text)] flex items-center gap-1.5"><span className="shrink-0 w-5 h-5 rounded border border-[var(--border)] flex items-center justify-center"><Lightbulb size={11} /></span>左侧灵感板</p>
            <ul className="list-disc pl-4 mt-1 space-y-1">
              <li>记录创作灵感和参考素材，支持添加、编辑、删除</li>
              <li>移动端点击左上角灯泡图标呼出</li>
            </ul>
          </div>
        </div>
      ),
    },
    {
      id: 'author',
      title: '署名',
      content: (
        <div className="text-sm text-[var(--text-secondary)] space-y-2 py-2">
          <input
            type="text"
            value={defaultAuthor}
            onChange={e => {
              const v = e.target.value;
              setDefaultAuthor(v);
              if (v) localStorage.setItem('default_author', v);
              else localStorage.removeItem('default_author');
            }}
            placeholder="输入默认署名"
            className="w-full px-3 py-2 rounded-lg bg-[var(--bg)] border border-[var(--border)] text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] outline-none focus:border-[var(--accent)] transition-colors"
          />
          <p className="text-xs text-[var(--text-muted)]">设置后，导出图片将自动显示署名。可在每个画板的元数据中单独修改。</p>
        </div>
      ),
    },
    {
      id: 'import-export',
      title: '导入导出',
      content: (
        <div className="text-sm text-[var(--text-secondary)] space-y-3 py-2">
          <div className="flex gap-2">
            <button
              onClick={handleExport}
              disabled={state.boards.length === 0}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-[var(--accent-light)] text-[var(--accent)] font-medium text-sm hover:opacity-80 transition-opacity disabled:opacity-40"
            >
              <Download size={14} /> 导出全部画板
            </button>
            <label className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-[var(--accent-light)] text-[var(--accent)] font-medium text-sm hover:opacity-80 transition-opacity cursor-pointer">
              <FolderUp size={14} /> 导入画板
              <input type="file" accept=".json" onChange={handleImport} className="hidden" />
            </label>
          </div>
          <p className="text-xs text-[var(--text-muted)]">导出为 JSON 文件，可在其他设备导入恢复。导入时自动跳过已存在的画板。</p>
          {importMsg && <p className="text-xs font-medium text-[var(--accent)]">{importMsg}</p>}
        </div>
      ),
    },
    {
      id: 'about',
      title: '关于方寸',
      content: (
        <div className="text-sm text-[var(--text-secondary)] space-y-2 leading-relaxed">
          <p><b>方寸</b>是一款古典诗词创作辅助工具，提供实时格律校验、韵部查询和词语联想功能，助力诗词创作。</p>
          <p className="font-medium text-[var(--text)] pt-1">开发者</p>
          <p>上海交通大学国学社 · 技术部</p>
          <p className="font-medium text-[var(--text)] pt-1">联系方式</p>
          <p>guoxue_sjtu@163.com</p>
          <p className="font-medium text-[var(--text)] pt-1">开发者文档</p>
          <a
            href={navigator.userAgent.includes('FangcunAndroid') ? 'https://write.sjtuguoxue.space/docs' : '/docs'}
            target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[var(--accent)] hover:underline"
          >
            API 文档 <ExternalLink size={12} />
          </a>
          <p className="font-medium text-[var(--text)] pt-1">更新日志</p>
          <ul className="list-disc pl-4 space-y-1">
            <li>v1.6.4 (04-09) — Android 适配（格律修复、图片保存、外部链接），导出下载动画优化</li>
            <li>v1.6.3 (04-09) — 修复剪贴板粘贴图片、移动端候选字长按删除</li>
            <li>v1.6.2 (04-09) — 自建字体服务，引入汇文明朝体标题字体，移除 Google Fonts 依赖</li>
            <li>v1.6.1 (04-08) — 署名功能（三层优先级），产品介绍幻灯片扩展</li>
            <li>v1.6 (04-08) — 新建画板支持搜索并导入历代诗词（80万首），自动匹配格律</li>
            <li>v1.5 (04-08) — 典故检索，词分行支持叶韵，UI 统一优化</li>
            <li>v1.4 (04-06) — 元数据编辑（序/脚注/农历），韵脚跳转韵部，导出排版重构，8套配色</li>
            <li>v1.3 (2026-04-03) — 导出图片（5套配色、高清输出），画板批量导入导出</li>
            <li>v1.2 (2026-04-02) — 开放 API 及文档，CLI 工具，API Key 认证，前端免认证</li>
            <li>v1.1 (2026-03-18) — 词库扩容至45万首，字典实时搜索，重字提醒，设置面板，字典区收起/展开动画，灵感板换行修复</li>
            <li>v1.0 (2026-02-13) — 首版上线，诗词格律校验，韵部查询，词首/词末/对语字典，灵感板</li>
          </ul>
        </div>
      ),
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 backdrop-blur-sm bg-black/30" />
      <div
        className="relative bg-[var(--bg-card)] rounded-2xl shadow-[var(--shadow)] w-[90%] max-w-md max-h-[80vh] overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-[var(--border)]">
          <h2 className="text-base font-semibold text-[var(--text)]">设置</h2>
          <button
            className="w-7 h-7 rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--accent-light)] transition-colors"
            onClick={onClose}
          >
            <X size={16} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-1">
          {sections.map(s => (
            <div key={s.id}>
              <button
                className="w-full flex items-center justify-between py-2.5 text-sm font-medium text-[var(--text)] hover:text-[var(--accent)] transition-colors"
                onClick={() => toggle(s.id)}
              >
                {s.title}
                <ChevronRight
                  size={14}
                  className={`text-[var(--text-muted)] transition-transform duration-200 ${openSection === s.id ? 'rotate-90' : ''}`}
                />
              </button>
              <div
                className={`overflow-hidden transition-all duration-200 ${openSection === s.id ? 'max-h-[2000px] opacity-100 pb-3' : 'max-h-0 opacity-0'}`}
              >
                {s.content}
              </div>
              <div className="border-b border-[var(--border)]" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function TopBar() {
  const { state, dispatch } = useBoardContext();
  const board = useActiveBoard();
  const [dropOpen, setDropOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [metaOpen, setMetaOpen] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [dark, setDark] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('theme') === 'dark' || document.documentElement.classList.contains('dark');
    }
    return false;
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem('theme', dark ? 'dark' : 'light');
  }, [dark]);
  
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // --- 组装带标点的正文 ---
  const buildText = () => {
    if (!board) return '';
    const chars = board.poemChars;
    const validation = state.validation;
    const rhymeSet = new Set(validation?.rhyme_positions ?? []);
    const sentenceLen = board.genre === 'Shi' ? (board.charCount % 7 === 0 ? 7 : 5) : 0;

    const getPunct = (gi: number): string => {
      if (board.genre === 'Shi') {
        const posInCouplet = gi % (sentenceLen * 2);
        const isSentenceEnd = posInCouplet === sentenceLen - 1 || posInCouplet === sentenceLen * 2 - 1;
        if (!isSentenceEnd) return '';
        return rhymeSet.has(gi) ? '。' : '，';
      } else {
        if (!validation?.display_segments) return '';
        for (const seg of validation.display_segments) {
          const offset = gi - seg.start_index;
          if (offset >= 0 && offset < seg.rule_items.length) {
            const comment = seg.rule_items[offset].comment;
            if (rhymeSet.has(gi)) return '。';
            if (comment === '叶' || comment === '换叶') return '。';
            if (comment === '句') return '，';
            if (comment === '读') return '、';
            return '';
          }
        }
        return '';
      }
    };

    let text = '';
    for (let i = 0; i < chars.length; i++) {
      text += chars[i] === PLACEHOLDER ? '□' : chars[i];
      const punct = getPunct(i);
      if (punct) text += punct;
      if (board.genre === 'Shi' && sentenceLen > 0) {
        const posInCouplet = i % (sentenceLen * 2);
        if (posInCouplet === sentenceLen * 2 - 1 && i < chars.length - 1) text += '\n';
      }
    }
    if (text.length > 0 && !text.endsWith('。') && !text.endsWith('，')) text += '。';
    return text;
  };

  const handleCopy = () => {
    if (!board) return;
    const full = `${board.title}\n${buildText()}`;
    navigator.clipboard.writeText(full).then(() => {
      setCopied(true);
      setTimeout(() => { setCopied(false); setExportMenuOpen(false); }, 1000);
    });
  };

  const handleUpload = () => {
    if (!board) return;
    const text = buildText();
    const metadata = board.metadata || {};
    const date = ensureGregorianDate(
      metadata.date || new Date(Date.now() + 8 * 3600_000).toISOString().slice(0, 10),
      metadata.dateFormat,
    );
    const params = new URLSearchParams({
      '类型': board.genre === 'Shi' ? '诗' : '词',
      '正文': text,
      '日期': date,
      '标题': board.title,
    });
    if (metadata.preface) params.set('序', metadata.preface);
    if (metadata.footnote) params.set('脚注', metadata.footnote);
    const author = metadata.author ?? localStorage.getItem('default_author') ?? '';
    if (author) params.set('署名', author);
    window.open(`https://sjtuguoxue.space/submit/?${params.toString()}`, '_blank');
  };

  return (
    <header className="h-12 border-b border-[var(--border)] bg-[var(--bg-card)] flex items-center px-3 gap-2 shrink-0 relative z-40">
      {/* 画板切换 */}
      <div className="relative">
        <button
          onClick={() => setDropOpen(!dropOpen)}
          className="w-8 h-8 rounded-lg border border-[var(--grid-empty-border)] flex items-center justify-center text-[var(--text-secondary)] hover:bg-[var(--bg-card)] hover:text-[var(--text)]"
          title="切换画板"
        >
          <Layers size={16} />
        </button>
        {dropOpen && (
          <>
            <div className="fixed inset-0" onClick={() => setDropOpen(false)} />
            <div className="absolute top-10 left-0 bg-[var(--bg-card)] border border-[var(--border)] rounded-lg shadow-[var(--shadow)] min-w-[220px] max-w-[280px] py-1 z-40 max-h-[50vh] overflow-y-auto">
              {state.boards.map(b => (
                <div key={b.id} className="relative">
                  <div
                    className={`flex items-center justify-between px-3 py-2 text-sm cursor-pointer hover:bg-[var(--bg-card)] ${b.id === state.activeBoardId ? 'bg-[var(--accent-light)] text-[var(--accent)]' : ''}`}
                    onClick={() => { dispatch({ type: 'SWITCH_BOARD', id: b.id }); setDropOpen(false); setConfirmDeleteId(null); }}
                  >
                    <div className="truncate flex-1 mr-2">
                      <div className="truncate">{b.title}</div>
                      <div className="text-xs text-[var(--text-muted)]">{b.ruleName} · {new Date(b.updatedAt).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })}修改</div>
                    </div>
                    <button
                      className="text-[var(--text-muted)] hover:text-red-500 text-xs shrink-0"
                      onClick={e => { e.stopPropagation(); setConfirmDeleteId(b.id); }}
                    >
                      ✕
                    </button>
                  </div>
                  {confirmDeleteId === b.id && (
                    <div className="absolute inset-0 backdrop-blur-sm flex items-center justify-center gap-3 z-10 rounded" style={{ backgroundColor: 'color-mix(in srgb, var(--bg-card) 80%, transparent)' }}>
                      <button className="px-3 py-1 text-xs rounded-md border border-[var(--grid-empty-border)] text-[var(--text-secondary)] hover:bg-[var(--accent-light)]"
                        onClick={e => { e.stopPropagation(); setConfirmDeleteId(null); }}>取消</button>
                      <button className="px-3 py-1 text-xs rounded-md bg-red-500 text-white hover:bg-red-600"
                        onClick={e => { e.stopPropagation(); dispatch({ type: 'DELETE_BOARD', id: b.id }); setConfirmDeleteId(null); }}>删除</button>
                    </div>
                  )}
                </div>
              ))}
              {state.boards.length === 0 && (
                <div className="px-3 py-2 text-sm text-[var(--text-muted)]">暂无画板</div>
              )}
            </div>
          </>
        )}
      </div>

      {/* 元数据（日期/序/脚注） */}
      {board && (
        <div className="relative">
          <button
            className={`w-8 h-8 rounded-lg border flex items-center justify-center transition-colors ${metaOpen ? 'border-[var(--accent)] text-[var(--accent)] bg-[var(--accent-light)]' : 'border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--accent-light)] hover:text-[var(--accent)]'}`}
            onClick={() => setMetaOpen(v => !v)}
            title="日期 / 序 / 脚注"
          >
            <ScrollText size={15} />
          </button>
          {metaOpen && <MetadataPopover onClose={() => setMetaOpen(false)} />}
        </div>
      )}

      {/* 深色模式切换 */}
      <button
        className="w-8 h-8 rounded-lg border border-[var(--border)] flex items-center justify-center text-[var(--text-muted)] hover:bg-[var(--accent-light)] hover:text-[var(--accent)] transition-colors"
        onClick={() => setDark(d => !d)}
        title={dark ? '切换浅色模式' : '切换深色模式'}
      >
        {dark ? <Sun size={15} /> : <Moon size={15} />}
      </button>

      <div className="flex-1" />

      {/* 设置 */}
      <button
        className="w-8 h-8 rounded-lg border border-[var(--border)] flex items-center justify-center text-[var(--text-muted)] hover:bg-[var(--accent-light)] hover:text-[var(--accent)] transition-colors"
        onClick={() => setSettingsOpen(true)}
        title="设置"
      >
        <Settings size={15} />
      </button>

      {/* 导出菜单 */}
      {board && (
        <div className="relative">
          <button
            className="w-8 h-8 rounded-lg border border-[var(--grid-empty-border)] flex items-center justify-center text-[var(--text-secondary)] hover:bg-[var(--bg-card)] hover:text-[var(--text)] transition-colors"
            onClick={() => setExportMenuOpen(v => !v)}
            title="导出"
          >
            <Download size={15} />
          </button>
          {exportMenuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setExportMenuOpen(false)} />
              <div className="absolute right-0 top-10 z-50 w-40 border border-[var(--border)] rounded-lg overflow-hidden shadow-lg" style={{ backgroundColor: 'var(--bg-card)' }}>
                <button
                  className="w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-[var(--accent-light)] transition-colors"
                  onClick={() => { handleCopy(); }}
                >
                  {copied ? <Check size={14} className="text-emerald-600" /> : <ClipboardType size={14} />}
                  <span>复制文字</span>
                </button>
                {!board.poemChars.includes(PLACEHOLDER) && (
                  <>
                    <button
                      className="w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-[var(--accent-light)] transition-colors"
                      onClick={() => { setShowExport(true); setExportMenuOpen(false); }}
                    >
                      <ImageDown size={14} />
                      <span>导出图片</span>
                    </button>
                    {!navigator.userAgent.includes('FangcunAndroid') && (
                      <button
                        className="w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-[var(--accent-light)] transition-colors"
                        onClick={() => { handleUpload(); setExportMenuOpen(false); }}
                      >
                        <Upload size={14} />
                        <span>上传南洋吟游</span>
                      </button>
                    )}
                  </>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* 新建按钮 */}
      <button
        className="w-8 h-8 rounded-lg border border-[var(--grid-empty-border)] flex items-center justify-center text-[var(--text-secondary)] hover:bg-[var(--accent-light)] hover:text-[var(--accent)] hover:border-[var(--accent)]"
        onClick={() => dispatch({ type: 'SHOW_GENRE_SELECTOR', show: true })}
        title="新建画板"
      >
        <Plus size={18} />
      </button>
      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}
      {showExport && <ExportPreview onClose={() => setShowExport(false)} />}
    </header>
  );
}
