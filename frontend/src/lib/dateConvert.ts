import { Lunar } from 'lunar-javascript';

/** 农历文本 → 公历 YYYY-MM-DD（转换失败则原样返回） */
export function lunarToGregorian(lunarDate: string): string {
  try {
    // 完整结构匹配，锚定首尾
    const pat = /^(\d{4}|[甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥])年(正|十一|十二|一|二|三|四|五|六|七|八|九|十|冬|腊)月(初[一二三四五六七八九十]|二十[一二三四五六七八九]?|廿[一二三四五六七八九]|十[一二三四五六七八九]?|三十)日?$/;
    const m = lunarDate.match(pat);
    if (!m) return lunarDate;

    // ── 年 ──
    let year: number;
    if (/^\d{4}$/.test(m[1])) {
      year = parseInt(m[1]);
    } else {
      const ganZhiTarget = m[1];
      const currentYear = new Date().getFullYear();
      let foundYear = currentYear;
      let minDiff = 999;
      for (let y = currentYear - 30; y <= currentYear + 30; y++) {
        try {
          const testLunar = Lunar.fromYmd(y, 1, 1);
          if (testLunar.getYearInGanZhi() === ganZhiTarget) {
            const diff = Math.abs(y - currentYear);
            if (diff < minDiff) { minDiff = diff; foundYear = y; }
          }
        } catch { continue; }
      }
      year = foundYear;
    }

    // ── 月 ──
    const monthMap: Record<string, number> = {
      '正': 1, '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6,
      '七': 7, '八': 8, '九': 9, '十': 10, '十一': 11, '十二': 12, '冬': 11, '腊': 12,
    };
    const month = monthMap[m[2]] || 1;

    // ── 日 ──
    const dayMap: Record<string, number> = {
      '初一': 1, '初二': 2, '初三': 3, '初四': 4, '初五': 5,
      '初六': 6, '初七': 7, '初八': 8, '初九': 9, '初十': 10,
      '十': 10, '十一': 11, '十二': 12, '十三': 13, '十四': 14, '十五': 15,
      '十六': 16, '十七': 17, '十八': 18, '十九': 19,
      '二十': 20, '廿一': 21, '廿二': 22, '廿三': 23, '廿四': 24, '廿五': 25,
      '廿六': 26, '廿七': 27, '廿八': 28, '廿九': 29,
      '二十一': 21, '二十二': 22, '二十三': 23, '二十四': 24, '二十五': 25,
      '二十六': 26, '二十七': 27, '二十八': 28, '二十九': 29, '三十': 30,
    };
    const day = dayMap[m[3]] || 1;

    const lunar = Lunar.fromYmd(year, month, day);
    return lunar.getSolar().toYmd();
  } catch {
    return lunarDate;
  }
}

/** 确保日期为公历 YYYY-MM-DD 格式（已是公历则直接返回，农历则转换） */
export function ensureGregorianDate(date: string, format?: 'Gregorian' | 'Lunar'): string {
  if (!date.trim()) return '';
  // 已经是 YYYY-MM-DD 格式
  if (/^\d{4}[-/.]\d{1,2}[-/.]\d{1,2}$/.test(date)) {
    return date.replace(/[/.]/g, '-');
  }
  // 农历格式，转换
  if (format === 'Lunar' || /[\u4e00-\u9fa5]/.test(date)) {
    return lunarToGregorian(date);
  }
  return date;
}
