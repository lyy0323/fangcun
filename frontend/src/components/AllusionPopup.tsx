import { useEffect, useRef } from 'react';
import type { AllusionEntry } from '../lib/api';
import { X } from 'lucide-react';

interface Props {
  entry: AllusionEntry;
  onClose: () => void;
  onClickWord: (word: string) => void;
}

export function AllusionPopup({ entry, onClose, onClickWord }: Props) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  // 同源列表: 当前典形词置首并高亮
  const relatedWords = [
    { w: entry.w, d: entry.d, isCurrent: true },
    ...entry.related
      .filter(r => r.w !== entry.w)
      .map(r => ({ ...r, isCurrent: false })),
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      onClick={onClose}
    >
      {/* 蒙层 */}
      <div className="absolute inset-0 bg-black/20" />

      {/* 弹窗主体 */}
      <div
        ref={panelRef}
        className="relative mx-3 mb-3 w-full max-w-md max-h-[70vh] overflow-y-auto rounded-2xl shadow-lg border border-[var(--border)]"
        style={{ backgroundColor: 'color-mix(in srgb, var(--bg-card) 85%, transparent)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* 关闭按钮 */}
        <button
          className="absolute top-3 right-3 w-6 h-6 flex items-center justify-center rounded-full text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--accent-light)] transition-colors z-10"
          onClick={onClose}
        >
          <X size={14} />
        </button>

        <div className="p-4 space-y-3">
          {/* 标题 + 释义 */}
          <div>
            <span className="text-base font-semibold text-[var(--text)]">{entry.w}</span>
            <p className="text-xs text-[var(--text-secondary)] mt-1 leading-relaxed">{entry.d}</p>
          </div>

          {/* 典源 */}
          <div>
            <div className="text-[11px] font-medium text-[var(--text-muted)] mb-1">典源 · {entry.src}</div>
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">{entry.src_text}</p>
          </div>

          {/* 同源典形 — 始终显示 */}
          <div>
            <div className="text-[11px] font-medium text-[var(--text-muted)] mb-1.5">
              同源典形
              <span className="ml-1.5 font-normal">点击填入画布</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {relatedWords.map((r, i) => (
                <button
                  key={r.w + i}
                  className={`px-2 py-0.5 rounded text-xs border transition-colors ${
                    r.isCurrent
                      ? 'border-[var(--accent)] text-[var(--accent)] bg-[var(--accent-light)]'
                      : 'border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--accent)] hover:text-[var(--accent)]'
                  }`}
                  onClick={() => onClickWord(r.w)}
                  title={r.d || undefined}
                >
                  {r.w}
                </button>
              ))}
            </div>
          </div>

          {/* 例句 */}
          {entry.examples.length > 0 && (
            <div>
              <div className="text-[11px] font-medium text-[var(--text-muted)] mb-1">例句</div>
              <div className="space-y-1">
                {entry.examples.map((ex, i) => (
                  <p key={i} className="text-xs text-[var(--text-secondary)] leading-relaxed pl-2 border-l-2 border-[var(--border)]">
                    {ex}
                  </p>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
