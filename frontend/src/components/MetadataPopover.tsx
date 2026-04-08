import { useState } from 'react';
import { Solar } from 'lunar-javascript';
import { useBoardContext, useActiveBoard } from '../context/BoardContext';
import { lunarToGregorian } from '../lib/dateConvert';
import type { BoardMetadata } from '../lib/types';
import { ChevronDown } from 'lucide-react';

export function MetadataPopover({ onClose }: { onClose: () => void }) {
  const { dispatch } = useBoardContext();
  const board = useActiveBoard();
  const [dateError, setDateError] = useState<string>('');
  const [dateFormatOpen, setDateFormatOpen] = useState(false);
  if (!board) return null;

  const metadata = board.metadata || {};
  const dateFormat = metadata.dateFormat || 'Gregorian';

  // 当天日期（UTC+8）
  const todayUTC8 = new Date(Date.now() + 8 * 3600_000);
  const todayStr = todayUTC8.toISOString().slice(0, 10);
  const todayLunar = (() => {
    try {
      const [y, m, d] = todayStr.split('-').map(Number);
      const lunar = Solar.fromYmd(y, m, d).getLunar();
      return `${lunar.getYearInGanZhi()}年${lunar.getMonthInChinese()}月${lunar.getDayInChinese()}`;
    } catch { return '甲辰年三月初一'; }
  })();

  const update = (field: keyof BoardMetadata, value: string) => {
    dispatch({ type: 'UPDATE_METADATA', metadata: { [field]: value } });
  };

  // ── 日期校验（增强版：校验月/日范围） ──

  const validateDate = (value: string): string => {
    if (!value.trim()) return '';

    if (dateFormat === 'Gregorian') {
      const match = value.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
      if (!match) return '格式：YYYY-MM-DD';
      const year = parseInt(match[1]);
      const month = parseInt(match[2]);
      const day = parseInt(match[3]);
      if (month < 1 || month > 12) return '月份须为 1-12';
      const daysInMonth = [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
      if ((year % 4 === 0 && year % 100 !== 0) || year % 400 === 0) daysInMonth[2] = 29;
      if (day < 1 || day > daysInMonth[month]) return `${month}月最多 ${daysInMonth[month]} 天`;
      return '';
    } else {
      // 完整结构匹配：年+月+日，锚定首尾避免子串误匹配
      // 年: 干支(甲子~癸亥) 或 4位数字
      // 月: 正/一~十/十一/十二/冬/腊
      // 日: 初一~初十/十~十九/二十~二十九(廿一~廿九)/三十
      const lunarPat = /^(\d{4}|[甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥])年(正|十一|十二|一|二|三|四|五|六|七|八|九|十|冬|腊)月(初[一二三四五六七八九十]|二十[一二三四五六七八九]?|廿[一二三四五六七八九]|十[一二三四五六七八九]?|三十)日?$/;
      const m = value.match(lunarPat);
      if (!m) return '格式：甲辰年三月初一 或 2024年三月初一';

      // 尝试实际转换，验证日期是否存在
      const converted = lunarToGregorian(value);
      if (converted === value) return '日期不存在，请检查';

      return '';
    }
  };

  // ── 公历转农历 ──

  const convertGregorianToLunar = (gregorianDate: string): string => {
    try {
      const match = gregorianDate.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
      if (!match) return gregorianDate;
      const solar = Solar.fromYmd(parseInt(match[1]), parseInt(match[2]), parseInt(match[3]));
      const lunar = solar.getLunar();
      return `${lunar.getYearInGanZhi()}年${lunar.getMonthInChinese()}月${lunar.getDayInChinese()}`;
    } catch {
      return gregorianDate;
    }
  };

  // ── 农历转公历 ──

  const convertLunarToGregorian = lunarToGregorian;

  const handleDateFormatChange = (newFormat: 'Gregorian' | 'Lunar') => {
    const currentDate = metadata.date || '';
    let convertedDate = currentDate;
    if (currentDate.trim()) {
      if (newFormat === 'Lunar' && dateFormat === 'Gregorian') {
        convertedDate = convertGregorianToLunar(currentDate);
      } else if (newFormat === 'Gregorian' && dateFormat === 'Lunar') {
        convertedDate = convertLunarToGregorian(currentDate);
      }
    }
    dispatch({
      type: 'UPDATE_METADATA',
      metadata: { dateFormat: newFormat, ...(convertedDate !== currentDate ? { date: convertedDate } : {}) }
    });
    setDateError('');
  };

  const inputClass = "w-full px-2 py-1.5 text-xs border border-[var(--border)] rounded bg-[var(--bg-input)] focus:outline-none focus:border-[var(--accent)]";

  return (
    <>
      <div className="fixed inset-0 z-30" onClick={onClose} />
      <div
        className="absolute top-10 left-0 bg-[var(--bg-card)] border border-[var(--border)] rounded-lg shadow-lg w-72 py-3 px-3 z-40 space-y-3 max-h-[60vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
        onKeyDown={e => { if (e.key === 'Escape') onClose(); }}
      >
        {/* 日期 */}
        <div>
          <label className="text-[10px] text-[var(--text-secondary)] mb-1 block">日期</label>
          <div className="flex gap-1.5">
            <input
              type="text"
              value={metadata.date || ''}
              onChange={e => {
                const value = e.target.value;
                update('date', value);
                setDateError(validateDate(value));
              }}
              onKeyDown={e => {
                if (e.key === 'Tab' && !metadata.date) {
                  e.preventDefault();
                  const placeholder = dateFormat === 'Gregorian' ? todayStr : todayLunar;
                  update('date', placeholder);
                }
              }}
              placeholder={dateFormat === 'Gregorian' ? todayStr : todayLunar}
              className={`flex-1 px-2 py-1.5 text-xs border rounded bg-[var(--bg-input)] focus:outline-none ${
                dateError ? 'border-red-400 focus:border-red-400' : 'border-[var(--border)] focus:border-[var(--accent)]'
              }`}
            />
            <div className="relative">
              <button
                className={`flex items-center gap-1 px-1.5 py-1.5 text-xs border border-[var(--border)] rounded bg-[var(--bg-input)] hover:border-[var(--accent)] transition-colors ${dateError ? 'opacity-40 cursor-not-allowed' : ''}`}
                onClick={() => { if (!dateError) setDateFormatOpen(v => !v); }}
                disabled={!!dateError}
              >
                <span>{dateFormat === 'Gregorian' ? '公历' : '农历'}</span>
                <ChevronDown size={10} className={`text-[var(--text-muted)] transition-transform ${dateFormatOpen ? 'rotate-180' : ''}`} />
              </button>
              {dateFormatOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setDateFormatOpen(false)} />
                  <div className="absolute right-0 top-full mt-1 z-50 border border-[var(--border)] rounded-lg overflow-hidden shadow-lg" style={{ backgroundColor: 'var(--bg-card)' }}>
                    {([['Gregorian', '公历'], ['Lunar', '农历']] as const).map(([val, label]) => (
                      <button
                        key={val}
                        className={`w-full text-left px-3 py-1.5 text-sm whitespace-nowrap hover:bg-[var(--accent-light)] transition-colors ${val === dateFormat ? 'bg-[var(--accent-light)] text-[var(--accent)]' : ''}`}
                        onClick={() => { handleDateFormatChange(val); setDateFormatOpen(false); }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
          {dateError && <div className="text-[10px] text-red-500 mt-0.5">{dateError}</div>}
          {dateFormat === 'Lunar' && !dateError && !metadata.date && (
            <div className="text-[10px] text-[var(--text-muted)] mt-0.5">干支年+月+日，如 甲辰年三月初一</div>
          )}
        </div>

        {/* 序 */}
        <div>
          <label className="text-[10px] text-[var(--text-secondary)] mb-1 block">序</label>
          <textarea
            value={metadata.preface || ''}
            onChange={e => update('preface', e.target.value)}
            placeholder="序言..."
            rows={3}
            className={`${inputClass} resize-none`}
          />
        </div>

        {/* 脚注 */}
        <div>
          <label className="text-[10px] text-[var(--text-secondary)] mb-1 block">脚注</label>
          <textarea
            value={metadata.footnote || ''}
            onChange={e => update('footnote', e.target.value)}
            placeholder="脚注..."
            rows={2}
            className={`${inputClass} resize-none`}
          />
        </div>
      </div>
    </>
  );
}
