import { useState } from 'react';
import { useBoardContext, useActiveBoard } from '../context/BoardContext';
import { PLACEHOLDER, resolveAuthor } from '../lib/types';
import { ensureGregorianDate } from '../lib/dateConvert';
import { submitPoem, track } from '../lib/api';
import type { SubmitResult, SubmitData } from '../lib/api';
import type { ValidationResult } from '../lib/types';
import { X, Loader, Check, AlertCircle } from 'lucide-react';

interface UploadItem {
  title: string;
  content: string;
  type: string;
  genre?: string;
  date: string;
  author: string;
  preface?: string;
  footnote?: string;
  legacyId?: string;
}

const ORDINALS = ['一','二','三','四','五','六','七','八','九','十'];

function buildSectionContent(
  genre: 'Shi' | 'Ci' | 'Free',
  sec: { poemChars: string[]; charCount: number; lines?: string[]; punctOverrides?: Record<number, string>; auxMarks?: Record<number, string[]> },
  validation: ValidationResult | null,
): string {
  if (genre === 'Free') return (sec.lines ?? []).filter(l => l.trim()).join('\n');

  const chars = sec.poemChars;
  const rhymeSet = new Set(validation?.rhyme_positions ?? []);
  const sentenceLen = genre === 'Shi' ? (sec.charCount % 7 === 0 ? 7 : 5) : 0;

  const getPunct = (gi: number): string => {
    if (sec.punctOverrides && gi in sec.punctOverrides) return sec.punctOverrides[gi];
    if (genre === 'Shi') {
      const posInCouplet = gi % (sentenceLen * 2);
      const isSentenceEnd = posInCouplet === sentenceLen - 1 || posInCouplet === sentenceLen * 2 - 1;
      if (!isSentenceEnd) return '';
      return rhymeSet.has(gi) ? '。' : '，';
    }
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
  };

  const OPENING = new Set(['「', '《', '“', '‘']);
  let text = '';
  for (let i = 0; i < chars.length; i++) {
    const am = sec.auxMarks?.[i];
    if (am) { for (const m of am) { if (OPENING.has(m)) text += m; } }
    text += chars[i] === PLACEHOLDER ? '□' : chars[i];
    if (am) { for (const m of am) { if (!OPENING.has(m)) text += m; } }
    const punct = getPunct(i);
    if (punct) text += punct;
    if (genre === 'Shi' && sentenceLen > 0) {
      const posInCouplet = i % (sentenceLen * 2);
      if (posInCouplet === sentenceLen * 2 - 1 && i < chars.length - 1) text += '\n';
    }
  }
  if (text.length > 0 && !/[，。、；：？！]$/.test(text)) text += '。';
  return text;
}

function toApiDate(metaDate: string | undefined, dateFormat: string | undefined, fallbackTs?: number): string {
  const fallback = new Date((fallbackTs ?? Date.now()) + 8 * 3600_000).toISOString().slice(0, 10);
  const greg = ensureGregorianDate(
    metaDate || fallback,
    dateFormat as 'Gregorian' | 'Lunar' | undefined,
  );
  // "2026-06-15" -> "2026.6.15"
  const parts = greg.split('-');
  return parts.map((p, i) => i === 0 ? p : String(Number(p))).join('.');
}

export function UploadModal({ onClose }: { onClose: () => void }) {
  const { state } = useBoardContext();
  const board = useActiveBoard();
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('fangcun_sk') || '');
  const [items, setItems] = useState<UploadItem[]>(() => {
    if (!board) return [];
    const metadata = board.metadata || {};
    const author = resolveAuthor(metadata);
    const date = toApiDate(metadata.date, metadata.dateFormat, board.updatedAt);
    const genre = board.genre;
    const typeStr = genre === 'Shi' ? '诗' : genre === 'Ci' ? '词' : '现代韵文';

    return board.sections.map((sec, idx) => {
      const v = state.validations[idx] ?? null;
      const content = buildSectionContent(genre, sec, v);
      const ord = ORDINALS[idx] ?? idx + 1;
      const sty = localStorage.getItem('fangcun_seq_style') || 'space';
      const autoTitle = sty === 'paren' ? `${board.title}（其${ord}）` : `${board.title} 其${ord}`;
      const title = board.sections.length > 1
        ? (sec.title || autoTitle)
        : board.title;
      return {
        title,
        content,
        type: typeStr,
        genre: undefined,
        date: sec.sectionDate ? toApiDate(sec.sectionDate, metadata.dateFormat, board.updatedAt) : date,
        author,
        preface: sec.sectionPreface || undefined,
        footnote: sec.sectionFootnote || undefined,
        legacyId: board.sections.length > 1
          ? (sec.sectionLegacyId || undefined)
          : (metadata.legacyId || undefined),
      };
    });
  });
  const [uploading, setUploading] = useState(false);
  const [results, setResults] = useState<(SubmitResult | null)[]>(() => items.map(() => null));
  const [done, setDone] = useState(false);

  if (!board) return null;

  const updateItem = (idx: number, patch: Partial<UploadItem>) => {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, ...patch } : it));
  };

  const handleUpload = async () => {
    if (uploading || done) return;
    if (!apiKey.trim()) return;
    localStorage.setItem('fangcun_sk', apiKey.trim());
    setUploading(true);
    const newResults: (SubmitResult | null)[] = [...results];
    let prevUuid: string | undefined;

    for (let i = 0; i < items.length; i++) {
      if (newResults[i]?.ok) { prevUuid = newResults[i]!.uuid; continue; }
      const item = items[i];
      const data: SubmitData = {
        author: item.author,
        title: item.title,
        content: item.content,
        date: item.date,
        type: item.type,
        genre: item.genre,
        preface: item.preface,
        footnote: item.footnote,
        legacy_id: item.legacyId || undefined,
      };
      if (items.length > 1 && prevUuid && i > 0) {
        data.relations = [{ id: prevUuid, type: 'sequence' }];
      }
      try {
        const res = await submitPoem(data, apiKey.trim());
        newResults[i] = res;
        if (res.ok && res.uuid) prevUuid = res.uuid;
      } catch (e) {
        newResults[i] = { ok: false, error: String(e) };
      }
      setResults([...newResults]);
    }
    setUploading(false);
    if (newResults.every(r => r?.ok)) setDone(true);
    track('upload_poem', { count: items.length, genre: board.genre });
  };

  const hasKey = apiKey.trim().length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 backdrop-blur-sm bg-black/30" />
      <div
        className="relative bg-[var(--bg-card)] rounded-2xl shadow-[var(--shadow)] w-[90%] max-w-lg max-h-[85vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-[var(--border)]">
          <h2 className="text-base font-semibold text-[var(--text)]">
            上传到南洋吟游
          </h2>
          <button className="w-7 h-7 rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--accent-light)] transition-colors" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        {/* SK input */}
        <div className="px-5 pt-3 pb-2">
          <input
            type="password"
            value={apiKey}
            onChange={e => setApiKey(e.target.value)}
            placeholder="API Key (sk-nyyy-...)"
            className="w-full px-3 py-1.5 text-xs border border-[var(--border)] rounded-lg bg-[var(--bg-input)] focus:outline-none focus:border-[var(--accent)] font-mono"
          />
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto px-5 py-2 space-y-3">
          {items.map((item, idx) => {
            const res = results[idx];
            return (
              <div key={idx} className={`rounded-lg p-3 ${res?.ok ? 'bg-emerald-50/50' : res && !res.ok ? 'bg-red-50/50' : ''}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-semibold text-[var(--accent)]">{item.legacyId ? <span className="text-[var(--text-muted)] font-mono font-normal mr-1">{item.legacyId}</span> : null}{item.title}</div>
                  <div className="flex items-center gap-1.5 text-[10px] text-[var(--text-muted)]">
                    {board.genre === 'Free' ? (
                      <div className="flex gap-0 border border-[var(--border)] rounded-full overflow-hidden">
                        {['诗', '现代韵文'].map(t => (
                          <button key={t}
                            className={`px-1.5 py-px transition-colors ${item.type === t ? 'bg-[var(--accent)] text-white' : 'hover:bg-[var(--accent-light)]'}`}
                            onClick={() => updateItem(idx, { type: t })}
                          >{t}</button>
                        ))}
                      </div>
                    ) : (
                      <span>{item.type}</span>
                    )}
                    <span>{item.date}</span>
                    <span>{item.author}</span>
                    {res?.ok && <Check size={12} className="text-emerald-600" />}
                    {res && !res.ok && <AlertCircle size={12} className="text-red-500" />}
                  </div>
                </div>
                <textarea
                  value={item.content}
                  onChange={e => updateItem(idx, { content: e.target.value })}
                  rows={Math.min(8, Math.max(3, item.content.split('\n').length + 1))}
                  disabled={!!res?.ok}
                  className="w-full px-2 py-1.5 text-xs border border-[var(--border)] rounded bg-[var(--bg-input)] focus:outline-none focus:border-[var(--accent)] resize-none font-mono disabled:opacity-50"
                />
                {item.type === '词' && (
                  <div className="text-[10px] text-[var(--text-muted)] mt-1">请检查分段，阙间以空行分隔</div>
                )}
                {res && !res.ok && (
                  <div className="text-[10px] text-red-500 mt-1">{res.error}</div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[var(--border)]">
          <button
            onClick={handleUpload}
            disabled={uploading || done || !hasKey}
            className={[
              'w-full py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-40',
              done ? 'bg-emerald-100 text-emerald-700' : 'bg-[var(--accent)] text-white hover:opacity-90',
            ].join(' ')}
          >
            {uploading ? <Loader size={16} className="animate-spin mx-auto" /> :
              done ? '✓ 上传成功' :
              `上传 ${items.length} 首`}
          </button>
        </div>
      </div>
    </div>
  );
}
