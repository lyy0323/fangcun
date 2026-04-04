import { useState } from 'react';
import { Solar, Lunar } from 'lunar-javascript';
import { useBoardContext, useActiveBoard } from '../context/BoardContext';
import type { BoardMetadata } from '../lib/types';

export function MetadataEditor() {
  const { dispatch } = useBoardContext();
  const board = useActiveBoard();
  const [dateError, setDateError] = useState<string>('');

  if (!board) return null;

  const metadata = board.metadata || {};

  const update = (field: keyof BoardMetadata, value: string) => {
    dispatch({
      type: 'UPDATE_METADATA',
      metadata: { [field]: value }
    });
  };

  // 日期格式默认值为公历
  const dateFormat = metadata.dateFormat || 'Gregorian';

  // 韵书：直接使用 board.rhymeBookName（用于格律检测）
  const rhymeBook = board.rhymeBookName;

  // 日期校验
  const validateDate = (value: string): boolean => {
    if (!value.trim()) return true; // 空值允许
    // 公历格式：YYYY-MM-DD 或 YYYY/MM/DD 或 YYYY.MM.DD
    const gregorianPattern = /^\d{4}[-/.]\d{1,2}[-/.]\d{1,2}$/;
    // 农历格式：允许中文（如"甲辰年三月初一"）
    const lunarPattern = /[\u4e00-\u9fa5]/;

    if (dateFormat === 'Gregorian') {
      return gregorianPattern.test(value);
    } else {
      return lunarPattern.test(value) || gregorianPattern.test(value);
    }
  };

  // 公历转农历
  const convertGregorianToLunar = (gregorianDate: string): string => {
    try {
      const match = gregorianDate.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
      if (!match) return gregorianDate;

      const year = parseInt(match[1]);
      const month = parseInt(match[2]);
      const day = parseInt(match[3]);

      const solar = Solar.fromYmd(year, month, day);
      const lunar = solar.getLunar();

      console.log(`公历转农历: 输入=${gregorianDate}, 农历年=${lunar.getYear()}, 天干地支=${lunar.getYearInGanZhi()}`);

      // 格式：甲辰年三月初一（使用天干地支年份）
      return `${lunar.getYearInGanZhi()}年${lunar.getMonthInChinese()}月${lunar.getDayInChinese()}`;
    } catch (error) {
      console.error('公历转农历失败:', error);
      return gregorianDate;
    }
  };

  // 农历转公历
  const convertLunarToGregorian = (lunarDate: string): string => {
    try {
      // 尝试从农历字符串提取年月日信息
      // 格式例子：甲辰年三月初一、2024年三月初一
      const yearMatch = lunarDate.match(/(\d{4}|[一二三四五六七八九十甲乙丙丁戊己庚辛壬癸子丑寅卯辰巳午未申酉戌亥]+)年/);
      const monthMatch = lunarDate.match(/(正|一|二|三|四|五|六|七|八|九|十|冬|腊|[0-9]+)月/);
      const dayMatch = lunarDate.match(/([初十廿三]?[一二三四五六七八九十]+|[0-9]+)(?:日|$)/);

      if (!yearMatch || !monthMatch || !dayMatch) {
        return lunarDate;
      }

      // 如果年份是数字，直接使用；否则在最近60年内匹配天干地支
      let year: number;
      if (/^\d{4}$/.test(yearMatch[1])) {
        year = parseInt(yearMatch[1]);
      } else {
        // 天干地支年份，在最近60年内找到匹配的年份
        const ganZhiTarget = yearMatch[1];
        const currentYear = new Date().getFullYear();

        // 在当前年份前后30年内搜索（覆盖一个完整的60年周期）
        let foundYear = currentYear;
        let minDiff = 999;

        for (let y = currentYear - 30; y <= currentYear + 30; y++) {
          try {
            // 直接用农历年份创建正月初一，避免公历转换的年份偏差
            const testLunar = Lunar.fromYmd(y, 1, 1);
            const testGanZhi = testLunar.getYearInGanZhi();

            if (testGanZhi === ganZhiTarget) {
              const diff = Math.abs(y - currentYear);
              if (diff < minDiff) {
                minDiff = diff;
                foundYear = y;
                console.log(`找到匹配的天干地支年份: ${ganZhiTarget}, 年份=${y}, 实际农历年=${testLunar.getYear()}`);
              }
            }
          } catch {
            continue;
          }
        }

        year = foundYear;
      }

      // 转换月份
      const monthMap: Record<string, number> = {
        '正': 1, '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6,
        '七': 7, '八': 8, '九': 9, '十': 10, '冬': 11, '腊': 12
      };
      const monthStr = monthMatch[1];
      const month = monthMap[monthStr] || parseInt(monthStr) || 1;

      // 转换日期
      const dayStr = dayMatch[1];
      let day: number;
      if (/^\d+$/.test(dayStr)) {
        day = parseInt(dayStr);
      } else {
        // 中文日期转数字
        const dayMap: Record<string, number> = {
          '初一': 1, '初二': 2, '初三': 3, '初四': 4, '初五': 5,
          '初六': 6, '初七': 7, '初八': 8, '初九': 9, '初十': 10,
          '十一': 11, '十二': 12, '十三': 13, '十四': 14, '十五': 15,
          '十六': 16, '十七': 17, '十八': 18, '十九': 19, '二十': 20,
          '廿一': 21, '廿二': 22, '廿三': 23, '廿四': 24, '廿五': 25,
          '廿六': 26, '廿七': 27, '廿八': 28, '廿九': 29, '三十': 30
        };
        day = dayMap[dayStr] || 1;
      }

      const lunar = Lunar.fromYmd(year, month, day);
      const solar = lunar.getSolar();

      console.log(`农历转公历调试: 输入="${lunarDate}", 解析年=${year}, 月=${month}, 日=${day}, 天干地支=${lunar.getYearInGanZhi()}, 输出=${solar.toYmd()}`);

      return solar.toYmd();
    } catch (error) {
      console.error('农历转公历失败:', error);
      return lunarDate;
    }
  };

  return (
    <div className="flex flex-col gap-2.5 text-xs h-full">
      {/* 日期 */}
      <div>
        <label className="text-[var(--text-secondary)] mb-1 block">日期</label>
        <input
          type="text"
          value={metadata.date || ''}
          onChange={e => {
            const value = e.target.value;
            update('date', value);
            if (value.trim() && !validateDate(value)) {
              setDateError(
                dateFormat === 'Gregorian'
                  ? '公历格式：YYYY-MM-DD（如 2024-04-04）'
                  : '农历格式：需包含中文（如 甲辰年三月初一）'
              );
            } else {
              setDateError('');
            }
          }}
          placeholder={dateFormat === 'Gregorian' ? '2024-04-04' : '甲辰年三月初一'}
          className={`w-full px-2 py-1.5 text-xs border rounded bg-[var(--bg-input)] focus:outline-none ${
            dateError
              ? 'border-red-400 focus:border-red-400'
              : 'border-[var(--border)] focus:border-[var(--accent)]'
          }`}
        />
        {dateError && (
          <div className="text-[10px] text-red-500 mt-0.5">{dateError}</div>
        )}
      </div>

      {/* 日期格式 */}
      <div>
        <label className="text-[var(--text-secondary)] mb-1 block">日期格式</label>
        <select
          value={dateFormat}
          onChange={e => {
            const newFormat = e.target.value as 'Gregorian' | 'Lunar';
            const currentDate = metadata.date || '';

            // 切换格式时自动转换日期
            let convertedDate = currentDate;
            if (currentDate.trim()) {
              if (newFormat === 'Lunar' && dateFormat === 'Gregorian') {
                // 公历 -> 农历
                convertedDate = convertGregorianToLunar(currentDate);
              } else if (newFormat === 'Gregorian' && dateFormat === 'Lunar') {
                // 农历 -> 公历
                convertedDate = convertLunarToGregorian(currentDate);
              }
            }

            // 更新格式和日期
            update('dateFormat', newFormat);
            if (convertedDate !== currentDate) {
              update('date', convertedDate);
            }

            // 清除错误提示
            setDateError('');
          }}
          className="w-full px-2 py-1.5 text-xs border border-[var(--border)] rounded bg-[var(--bg-input)] focus:outline-none focus:border-[var(--accent)]"
        >
          <option value="Gregorian">公历</option>
          <option value="Lunar">农历</option>
        </select>
      </div>

      {/* 韵书 */}
      <div>
        <label className="text-[var(--text-secondary)] mb-1 block">韵书</label>
        <select
          value={rhymeBook}
          onChange={e => update('rhymeBook', e.target.value)}
          className="w-full px-2 py-1.5 text-xs border border-[var(--border)] rounded bg-[var(--bg-input)] focus:outline-none focus:border-[var(--accent)]"
        >
          {board.genre === 'Shi' ? (
            <>
              <option value="Pingshuiyun">平水韵</option>
              <option value="Zhonghua_Tongyun">中华通韵</option>
            </>
          ) : (
            <>
              <option value="Cilinzhengyun">词林正韵</option>
              <option value="Zhonghua_Tongyun">中华通韵</option>
            </>
          )}
        </select>
      </div>

      {/* 序 */}
      <div className="flex-1 flex flex-col min-h-0">
        <label className="text-[var(--text-secondary)] mb-1 block">序</label>
        <textarea
          value={metadata.preface || ''}
          onChange={e => update('preface', e.target.value)}
          placeholder="序言或说明..."
          className="flex-1 px-2 py-1.5 text-xs border border-[var(--border)] rounded bg-[var(--bg-input)] focus:outline-none focus:border-[var(--accent)] resize-none min-h-[60px]"
        />
      </div>
    </div>
  );
}
