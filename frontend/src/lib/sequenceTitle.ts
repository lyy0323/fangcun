// 移植自南洋吟游 app/utils/sequence_title.py。
// 保持同一套序数与标题边界规则；分首标题通过补一个临时总题复用解析器。
const DIGITS = '零一二三四五六七八九';
const DIGIT_VALUES: Record<string, number> = {
  零: 0, 〇: 0,
  一: 1, 壹: 1, 二: 2, 两: 2, 贰: 2,
  三: 3, 叁: 3, 四: 4, 肆: 4,
  五: 5, 伍: 5, 六: 6, 陆: 6,
  七: 7, 柒: 7, 八: 8, 捌: 8, 九: 9, 玖: 9,
};
const UNIT_VALUES: Record<string, number> = {
  十: 10, 拾: 10, 百: 100, 佰: 100, 千: 1000, 仟: 1000,
};
const CIRCLED_VALUES: Record<string, number> = Object.fromEntries([
  ...Array.from({ length: 20 }, (_, i) => [String.fromCharCode(0x2460 + i), i + 1]),
  ...Array.from({ length: 15 }, (_, i) => [String.fromCharCode(0x3251 + i), i + 21]),
]);
const NUMERAL_CHARS = Object.keys(DIGIT_VALUES).join('') + Object.keys(UNIT_VALUES).join('')
  + '廿卅' + Object.keys(CIRCLED_VALUES).join('');
const SEQ = `[${NUMERAL_CHARS}]+`;
const DIRECT_SEQ = '(?:[①-⑳㉑-㉟]|[壹贰叁肆伍陆柒捌玖拾佰仟]+)';
const NUMERAL_PATTERN = new RegExp(`^[${NUMERAL_CHARS}]+$`);
const PATTERNS = [
  // aaa（其一） / aaa(其一) / aaa（其一）bb
  new RegExp(`^(?<base>.*?)\\s*[（(]\\s*(?<seq>其?${SEQ})\\s*[）)]\\s*(?<sub>.*)$`),
  // aaa 其一 bb / aaa 一 bb
  new RegExp(`^(?<base>.*?)\\s+(?<seq>其${SEQ})\\s+(?<sub>.+)$`),
  new RegExp(`^(?<base>.*?)\\s+(?<seq>${SEQ})\\s+(?<sub>.+)$`),
  // aaa 其一 / aaa 一
  new RegExp(`^(?<base>.*?)\\s+(?<seq>其?${SEQ})$`),
  // aaa③：bb / aaa 肆（bb
  new RegExp(`^(?<base>.+?)\\s*(?<seq>其?${DIRECT_SEQ})\\s*[：:·、.\\-（(]\\s*(?<sub>.*)$`),
];

export interface SequenceTitle {
  base: string;
  ordinal: number;
  subtitle: string;
  matched: boolean;
}

export function chineseNumeralValue(text: string): number {
  let value = text.trim().replace(/^其/, '');
  if (!value) return 0;
  if (value.length === 1 && value in CIRCLED_VALUES) return CIRCLED_VALUES[value];
  value = value.replaceAll('廿', '二十').replaceAll('卅', '三十')
    .replaceAll('两', '二').replaceAll('〇', '零');
  if (!NUMERAL_PATTERN.test(value)) return 0;

  let total = 0, current = 0, lastUnit = 10000;
  for (const char of value) {
    if (char in DIGIT_VALUES) {
      current = DIGIT_VALUES[char];
    } else {
      const unit = UNIT_VALUES[char];
      // 圆圈数字只接受单字；十十、十百等组合无效。
      if (!unit || unit >= lastUnit) return 0;
      lastUnit = unit;
      total += (current || 1) * unit;
      current = 0;
    }
  }
  return total + current;
}

export function chineseNumberLabel(number: number): string {
  if (!Number.isInteger(number) || number < 0 || number >= 10000) return String(number);
  if (number === 0) return DIGITS[0];
  let result = '', pendingZero = false;
  for (const [divisor, unit] of [[1000, '千'], [100, '百'], [10, '十'], [1, '']] as const) {
    const digit = Math.floor(number / divisor);
    number %= divisor;
    if (digit) {
      if (pendingZero) result += '零';
      result += (digit === 1 && divisor === 10 && !result ? '' : DIGITS[digit]) + unit;
      pendingZero = false;
    } else if (result && number) {
      pendingZero = true;
    }
  }
  return result;
}

export function parseSequenceTitle(title: string): SequenceTitle {
  const text = title.trim();
  for (const pattern of PATTERNS) {
    const groups = pattern.exec(text)?.groups;
    if (!groups) continue;
    const base = groups.base.trim();
    const ordinal = chineseNumeralValue(groups.seq);
    if (!base || ordinal < 1) continue;
    return { base, ordinal, subtitle: (groups.sub ?? '').trim(), matched: true };
  }
  return { base: text, ordinal: 0, subtitle: '', matched: false };
}

export function hasSequenceOrdinal(subtitle: string): boolean {
  // 原解析器要求存在总题；临时前缀让「其二 登楼」「二」「②」也能被识别。
  return parseSequenceTitle(`分首 ${subtitle.trim()}`).matched;
}

/** ordinal 从 1 开始；已有序数保持用户原文，不随画板顺序重编号。 */
export function formatSequenceTitle(
  title: string,
  subtitle: string | null | undefined,
  ordinal: number,
  style: 'space' | 'paren',
): string {
  const base = title.trim();
  const sub = subtitle?.trim() ?? '';
  const hasOrdinal = hasSequenceOrdinal(sub);
  const label = `其${chineseNumberLabel(ordinal)}`;
  if (style === 'paren') {
    return hasOrdinal ? `${base}（${sub}）` : `${base}（${label}）${sub}`;
  }
  return [base, ...(hasOrdinal ? [] : [label]), sub].filter(Boolean).join(' ');
}
