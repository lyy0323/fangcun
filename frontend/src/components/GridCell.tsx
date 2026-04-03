import { PLACEHOLDER, type RuleItem } from '../lib/types';

interface Props {
  char: string;
  globalIndex: number;
  isCursor: boolean;
  isError: boolean;
  isRhyme: boolean;
  rhymeColor?: string;   // 韵脚颜色（平/仄/叶韵分色）
  ruleItem: RuleItem | null;
  hasSepAfter?: boolean;
  sepWidth?: number;
  punctuation?: string;
  candidates?: string[];
  cellW?: number;
  charBoxSize?: number;
  fontSize?: number;
  punctW?: number;
  candidateSize?: number;
  isSelected?: boolean;
  onClickCell: (e: React.MouseEvent) => void;
  onClickCandidate?: (char: string) => void;
  onAddCandidate?: () => void;
  onRemoveCandidate?: (char: string) => void;
}

const TONE_SYMBOL: Record<string, string> = {
  P: '\u2014',
  Z: '|',
  A: '\u25cb',
};

export function GridCell({
  char, globalIndex, isCursor, isError, isRhyme, rhymeColor, isSelected,
  ruleItem,
  hasSepAfter, sepWidth = 12, punctuation, candidates,
  cellW = 30, charBoxSize = 28, fontSize = 14, punctW = 14, candidateSize = 24,
  onClickCell, onClickCandidate, onAddCandidate, onRemoveCandidate,
}: Props) {
  const isEmpty = char === PLACEHOLDER;
  const hasCandidates = candidates && candidates.length > 0;
  const toneSize = Math.max(8, fontSize - 4);

  return (
    <div
      className="flex items-start select-none"
      style={hasSepAfter ? { marginRight: sepWidth } : undefined}
      data-gi={globalIndex}
    >
      <div className="flex flex-col items-center" style={{ width: cellW, marginBottom: 2 }}>
        {/* 平仄符号（平=#559977 仄=#557799） */}
        <div className="font-mono leading-none" style={{
          height: toneSize + 4, fontSize: toneSize,
          color: ruleItem?.tone === 'P' ? '#559977' : ruleItem?.tone === 'Z' ? '#557799' : 'var(--text-muted)',
        }}>
          {ruleItem ? TONE_SYMBOL[ruleItem.tone] ?? '' : ''}
        </div>
        {/* 字格 */}
        <div
          className={[
            'flex items-center justify-center rounded transition-all cursor-pointer',
            isEmpty ? 'bg-[var(--grid-empty)] border border-dashed border-[var(--grid-empty-border)]' : '',
            isCursor ? 'ring-2 ring-offset-1' : '',
            isError && !isEmpty ? 'font-bold' : '',
          ].join(' ')}
          style={{
            width: charBoxSize, height: charBoxSize, fontSize,
            ...(isCursor ? { '--tw-ring-color': 'var(--accent)' } as React.CSSProperties : {}),
            ...(!isEmpty && isSelected ? { backgroundColor: 'var(--accent-light)' } : {}),
            ...(isError && !isEmpty ? { color: '#E11D48' } : {}),
            ...(isRhyme && !isEmpty && !isError && rhymeColor ? { color: rhymeColor, fontWeight: 600 } : {}),
          }}
          onClick={(e) => onClickCell(e)}
        >
          {isEmpty ? '' : char}
        </div>
        {/* 韵脚标记 */}
        {isRhyme && (
          <div className="rounded-full mt-px" style={{ width: Math.max(6, charBoxSize * 0.35), height: 2, background: rhymeColor ?? '#559977' }} />
        )}
        {!isRhyme && <div style={{ height: 2 }} className="mt-px" />}

        {/* 候选项：灰色无框 */}
        <div className="flex flex-col items-center gap-0.5 mt-1" style={{ minHeight: candidateSize + 4 }}>
        {(hasCandidates || isCursor) && (<>
            {hasCandidates && candidates!.map(c => (
              <div key={c} className="relative group">
                <div
                  className="flex items-center justify-center text-[var(--text-muted)] cursor-pointer hover:text-[var(--text)] transition-colors"
                  style={{ width: candidateSize, height: candidateSize, fontSize: Math.max(10, fontSize - 2) }}
                  onClick={e => { e.stopPropagation(); onClickCandidate?.(c); }}
                  title="点击替换正文"
                >
                  {c}
                </div>
                <button
                  className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-gray-400 text-white text-[8px] leading-3 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={e => { e.stopPropagation(); onRemoveCandidate?.(c); }}
                >
                  ✕
                </button>
              </div>
            ))}
            {isCursor && (!candidates || candidates.length < 5) && (
              <div
                className="flex items-center justify-center rounded border border-dashed border-[var(--grid-empty-border)] text-[var(--text-muted)] cursor-pointer hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
                style={{ width: candidateSize, height: candidateSize, fontSize: Math.max(10, fontSize - 2) }}
                onClick={e => { e.stopPropagation(); onAddCandidate?.(); }}
                title="添加候选字"
              >
                +
              </div>
            )}
          </>)}
        </div>
      </div>

      {/* 标点 */}
      {punctuation && (
        <div className="flex flex-col items-center" style={{ width: punctW, marginBottom: 2 }}>
          <div style={{ height: toneSize + 4 }} />
          <div className="flex items-center justify-center text-[var(--text-secondary)]" style={{ height: charBoxSize, fontSize }}>
            {punctuation}
          </div>
          <div style={{ height: 2 }} className="mt-px" />
        </div>
      )}
    </div>
  );
}
