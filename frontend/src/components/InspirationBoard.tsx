import { useRef, useState } from 'react';
import { useBoardContext, useActiveBoard } from '../context/BoardContext';
import type { InspirationCard } from '../lib/types';
import { Plus, Type, Image as ImageIcon, Clipboard } from 'lucide-react';

// --- 图片压缩 ---
function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const MAX = 1200;
        let w = img.width, h = img.height;
        if (w > MAX || h > MAX) {
          if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
          else { w = Math.round(w * MAX / h); h = MAX; }
        }
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      };
      img.onerror = reject;
      img.src = reader.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function InspirationBoard() {
  const { dispatch } = useBoardContext();
  const board = useActiveBoard();
  const fileRef = useRef<HTMLInputElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  if (!board) return null;
  const cards = board.inspirationCards;

  const addText = () => {
    const card: InspirationCard = {
      id: crypto.randomUUID(),
      type: 'text',
      content: '',
      createdAt: Date.now(),
    };
    dispatch({ type: 'ADD_INSPIRATION', card });
    setMenuOpen(false);
  };

  const addImage = () => {
    fileRef.current?.click();
    setMenuOpen(false);
  };

  const addImageFromClipboard = async () => {
    setMenuOpen(false);
    try {
      // 优先使用 Clipboard API
      if (navigator.clipboard && typeof navigator.clipboard.read === 'function') {
        const items = await navigator.clipboard.read();
        for (const item of items) {
          const imageType = item.types.find((t: string) => t.startsWith('image/'));
          if (imageType) {
            const blob = await item.getType(imageType);
            const file = new File([blob], 'clipboard.png', { type: imageType });
            const dataUrl = await compressImage(file);
            const card: InspirationCard = {
              id: crypto.randomUUID(),
              type: 'image',
              content: dataUrl,
              createdAt: Date.now(),
            };
            dispatch({ type: 'ADD_INSPIRATION', card });
            return;
          }
        }
      }
      alert('剪贴板中没有图片。\n提示：先复制一张图片，或使用 Ctrl+V 直接粘贴。');
    } catch (err) {
      // Clipboard API 权限被拒绝时，提示用 Ctrl+V
      alert('无法读取剪贴板。\n请直接在灵感板区域使用 Ctrl+V / Cmd+V 粘贴图片。');
    }
  };

  // 监听粘贴事件（在灵感板区域内 Ctrl+V / Cmd+V 粘贴图片）
  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (!file) continue;
        try {
          const dataUrl = await compressImage(file);
          const card: InspirationCard = {
            id: crypto.randomUUID(),
            type: 'image',
            content: dataUrl,
            createdAt: Date.now(),
          };
          dispatch({ type: 'ADD_INSPIRATION', card });
        } catch { /* ignore */ }
        return;
      }
    }
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await compressImage(file);
      const card: InspirationCard = {
        id: crypto.randomUUID(),
        type: 'image',
        content: dataUrl,
        createdAt: Date.now(),
      };
      dispatch({ type: 'ADD_INSPIRATION', card });
    } catch {
      alert('图片加载失败');
    }
    e.target.value = '';
  };

  const doDelete = (id: string) => {
    dispatch({ type: 'DELETE_INSPIRATION', cardId: id });
    setConfirmDeleteId(null);
  };

  const TEXT_MAX = 2048;

  const updateText = (id: string, content: string) => {
    const trimmed = content.length > TEXT_MAX ? content.slice(0, TEXT_MAX) : content;
    dispatch({ type: 'UPDATE_INSPIRATION', cardId: id, content: trimmed });
  };

  return (
    <div className="h-full flex flex-col" onPaste={handlePaste}>
      {/* 卡片列表 */}
      <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
        {cards.map(card => (
          <div key={card.id} className="relative group bg-[var(--bg-card)] rounded-lg border border-[var(--border)] ">
            {/* 删除触发按钮 */}
            <button
              className="absolute top-1 right-1 w-5 h-5 rounded-full text-xs text-[var(--text-muted)] hover:text-red-500 hover:bg-red-50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10"
              onClick={() => setConfirmDeleteId(card.id)}
            >
              ✕
            </button>

            {/* 文本卡片 */}
            {card.type === 'text' && (
              <div className="relative">
                <div
                  className={[
                    'p-2.5 pr-6 text-sm min-h-[40px] outline-none whitespace-pre-wrap break-all',
                    !card.content ? 'text-[var(--text-muted)]' : '',
                  ].join(' ')}
                  contentEditable
                  suppressContentEditableWarning
                  onFocus={e => {
                    if (!card.content) {
                      e.currentTarget.innerText = '';
                      e.currentTarget.classList.remove('text-[var(--text-muted)]');
                    }
                  }}
                  onInput={e => {
                    const el = e.currentTarget;
                    const text = el.innerText ?? '';
                    if (text.length > TEXT_MAX) {
                      el.innerText = text.slice(0, TEXT_MAX);
                      const sel = window.getSelection();
                      if (sel) { sel.selectAllChildren(el); sel.collapseToEnd(); }
                    }
                  }}
                  onBlur={e => {
                    const text = e.currentTarget.innerText ?? '';
                    updateText(card.id, text);
                    if (!text) {
                      e.currentTarget.classList.add('text-[var(--text-muted)]');
                    }
                  }}
                >
                  {card.content || '写点什么...'}
                </div>
                {/* 字数提示（有内容时显示） */}
                {card.content && card.content.length > TEXT_MAX * 0.8 && (
                  <div className={`absolute bottom-1 right-2 text-[10px] ${card.content.length >= TEXT_MAX ? 'text-red-400' : 'text-[var(--text-muted)]'}`}>
                    {card.content.length}/{TEXT_MAX}
                  </div>
                )}
              </div>
            )}

            {/* 图片卡片 */}
            {card.type === 'image' && (
              <img
                src={card.content}
                alt=""
                className="w-full rounded-lg object-cover max-h-48"
              />
            )}

            {/* 删除确认遮罩 */}
            {confirmDeleteId === card.id && (
              <div className="absolute inset-0 rounded-lg backdrop-blur-sm flex items-center justify-center gap-3 z-20" style={{ backgroundColor: 'color-mix(in srgb, var(--bg-card) 70%, transparent)' }}>
                <button
                  className="px-3 py-1 text-xs rounded-md border border-[var(--grid-empty-border)] text-[var(--text-secondary)] hover:bg-[var(--accent-light)]"
                  onClick={() => setConfirmDeleteId(null)}
                >
                  取消
                </button>
                <button
                  className="px-3 py-1 text-xs rounded-md bg-red-500 text-white hover:bg-red-600"
                  onClick={() => doDelete(card.id)}
                >
                  删除
                </button>
              </div>
            )}
          </div>
        ))}

        {cards.length === 0 && (
          <div className="text-xs text-[var(--text-muted)] text-center mt-8">点击下方 + 记录灵感</div>
        )}
      </div>

      {/* 添加按钮 */}
      <div className="pt-2.5 relative">
        <button
          className="w-full h-8 border-2 border-dashed border-[var(--grid-empty-border)] rounded-md text-[var(--text-muted)] hover:border-[var(--accent)] hover:text-[var(--accent)] flex items-center justify-center transition-colors"
          onClick={() => setMenuOpen(!menuOpen)}
        >
          <Plus size={18} />
        </button>
        {menuOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
            <div className="absolute bottom-11 left-0 right-0 bg-[var(--bg-card)] border border-[var(--border)] rounded-lg shadow-[var(--shadow)] z-20 py-1">
              <button className="w-full text-left px-3 py-2 text-sm hover:bg-[var(--accent-light)] flex items-center gap-2" onClick={addText}>
                <Type size={14} className="text-[var(--text-secondary)]" /> 文本
              </button>
              <button className="w-full text-left px-3 py-2 text-sm hover:bg-[var(--accent-light)] flex items-center gap-2" onClick={addImage}>
                <ImageIcon size={14} className="text-[var(--text-secondary)]" /> 选择图片
              </button>
              <button className="w-full text-left px-3 py-2 text-sm hover:bg-[var(--accent-light)] flex items-center gap-2" onClick={addImageFromClipboard}>
                <Clipboard size={14} className="text-[var(--text-secondary)]" /> 剪贴板图片
              </button>
            </div>
          </>
        )}
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
      </div>
    </div>
  );
}
