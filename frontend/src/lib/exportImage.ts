// ============================================================================
// 诗词图片导出 — Canvas 绘制引擎
// ============================================================================

export type ThemeKey = '素白' | '朱砂' | '墨韵' | '竹青' | '藏蓝' | '烟紫' | '秋棠' | '霜灰';

interface ColorTheme {
  bg: string;
  text: string;
  accent: string;
  muted: string;
}

export const THEMES: Record<ThemeKey, ColorTheme> = {
  '素白': { bg: '#FAFAF8', text: '#2C2C2C', accent: '#E8E0D4', muted: '#BBBBBB' },
  '朱砂': { bg: '#FDF6F0', text: '#8B2500', accent: '#E8C9A5', muted: '#C4A584' },
  '墨韵': { bg: '#1A1A1A', text: '#E8E4DF', accent: '#333333', muted: '#666666' },
  '竹青': { bg: '#F4F7F0', text: '#3A5F3A', accent: '#D0DBBF', muted: '#95A783' },
  '藏蓝': { bg: '#F0F2F7', text: '#2B3A67', accent: '#C8D0E0', muted: '#7F8CA7' },
  '烟紫': { bg: '#F5F0F7', text: '#4A3560', accent: '#D4C5E0', muted: '#9585A7' },
  '秋棠': { bg: '#FBF5EE', text: '#6B4226', accent: '#E8D0B0', muted: '#B09070' },
  '霜灰': { bg: '#F2F2F0', text: '#3A3A3A', accent: '#D8D8D2', muted: '#999999' },
};

export const THEME_KEYS: ThemeKey[] = ['素白', '朱砂', '墨韵', '竹青', '藏蓝', '烟紫', '秋棠', '霜灰'];

// ============================================================================
// 布局参数
// ============================================================================

const W = 1080;
const PAD_X = 100;

function getShiLayout(charCount: number) {
  if (charCount <= 70) return { height: 1440, fontSize: 44, lineHeight: 96 };
  if (charCount <= 90) return { height: 1620, fontSize: 38, lineHeight: 84 };
  if (charCount <= 150) return { height: 1800, fontSize: 32, lineHeight: 72 };
  return { height: 1920, fontSize: 28, lineHeight: 62 };
}

function getCiLayout(lineCount: number) {
  if (lineCount <= 6) return { height: 1440, fontSize: 40, lineHeight: 88 };
  if (lineCount <= 10) return { height: 1620, fontSize: 36, lineHeight: 76 };
  if (lineCount <= 15) return { height: 1800, fontSize: 32, lineHeight: 66 };
  return { height: 1920, fontSize: 28, lineHeight: 56 };
}

/** 每列最多显示的字数 */
const MAX_COL_CHARS = 10;

function getTitleConfig(titleLen: number) {
  if (titleLen <= 4) return { fontSize: 72, spacing: 97 };
  if (titleLen <= 8) return { fontSize: 56, spacing: 76 };
  if (titleLen <= 12) return { fontSize: 44, spacing: 60 };
  return { fontSize: 36, spacing: 50 };
}

// ============================================================================
// 字体加载 (Google Fonts text 子集)
// ============================================================================

// 使用隔离的字体名称，避免污染主界面
const EXPORT_FONT = '__FangcunExport__';

// 缓存 logo 图片
let _logoImg: HTMLImageElement | null = null;

export async function loadLogo(): Promise<HTMLImageElement | null> {
  if (_logoImg) return _logoImg;
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => { _logoImg = img; resolve(img); };
    img.onerror = () => resolve(null);
    img.src = '/favicon.ico';
  });
}
let _fontsLoaded = false;

export async function loadExportFonts(text: string): Promise<void> {
  const chars = [...new Set(text)].join('');
  const encoded = encodeURIComponent(chars);
  const cssUrl = `https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@400;700&display=swap&text=${encoded}`;

  try {
    const resp = await fetch(cssUrl);
    const css = await resp.text();

    // 解析 @font-face 块，用隔离名称注册，不影响 UI
    const blocks = css.match(/@font-face\s*\{[^}]+\}/g) || [];
    const promises = blocks.map(async (block) => {
      const urlMatch = block.match(/url\(([^)]+)\)/);
      const weightMatch = block.match(/font-weight:\s*(\d+)/);
      if (!urlMatch) return;
      const url = urlMatch[1];
      const weight = weightMatch?.[1] || '400';
      const font = new FontFace(EXPORT_FONT, `url(${url})`, {
        weight,
        style: 'normal',
      });
      const loaded = await font.load();
      document.fonts.add(loaded);
    });
    await Promise.all(promises);
    _fontsLoaded = true;
  } catch {
    _fontsLoaded = false;
  }
}

function serifFont(weight: number, size: number): string {
  const family = _fontsLoaded
    ? `"${EXPORT_FONT}"`
    : '"Source Han Serif SC", "SimSun", "STSong", serif';
  return `${weight} ${size}px ${family}`;
}

// ============================================================================
// 绘制工具
// ============================================================================

/** 居中绘制带字间距的文本 */
function drawTextCentered(
  ctx: CanvasRenderingContext2D,
  text: string,
  centerX: number,
  y: number,
  spacing: number,
) {
  const chars = [...text];
  if (chars.length === 0) return;

  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';

  let totalW = 0;
  const widths = chars.map((ch) => {
    const w = ctx.measureText(ch).width;
    totalW += w;
    return w;
  });
  totalW += spacing * (chars.length - 1);

  let x = centerX - totalW / 2;
  for (let i = 0; i < chars.length; i++) {
    ctx.fillText(chars[i], x, y);
    x += widths[i] + spacing;
  }
}

/** 竖排文字，返回底部 Y 坐标 */
function drawVerticalText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  startY: number,
  spacing: number,
): number {
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const chars = [...text];
  chars.forEach((ch, i) => {
    ctx.fillText(ch, x, startY + i * spacing);
  });
  return startY + (chars.length - 1) * spacing;
}

// ============================================================================
// 元数据绘制（序言 → 作品上方，日期/脚注 → 作品下方）
// ============================================================================

interface MetadataInfo {
  date?: string;
  preface?: string;
  footnote?: string;
}

// 元数据布局常量
const META_PREFACE_FONT = 28;
const META_PREFACE_LH = 44;
const META_FOOTER_FONT = 24;
const META_FOOTER_LH = 38;
const META_GAP = 40;          // 元数据区与诗句区间距
const META_MAX_W = W - PAD_X * 2; // 折行宽度

/** 按画布宽度折行文本，支持 \n，计入字间距 */
function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, charSpacing: number = 0): string[] {
  const result: string[] = [];
  for (const paragraph of text.split('\n')) {
    if (!paragraph) { result.push(''); continue; }
    let line = '';
    let lineW = 0;
    for (const ch of paragraph) {
      const chW = ctx.measureText(ch).width;
      const newW = line ? lineW + charSpacing + chW : chW;
      if (newW > maxWidth && line) {
        result.push(line);
        line = ch;
        lineW = chW;
      } else {
        line += ch;
        lineW = newW;
      }
    }
    if (line) result.push(line);
  }
  return result;
}

/** 测量元数据占用的额外高度（需要 ctx 来测量文本宽度） */
function measureMetaHeight(
  ctx: CanvasRenderingContext2D,
  metadata: MetadataInfo,
  maxW: number,
): { prefaceH: number; footerH: number } {
  let prefaceH = 0;
  let footerH = 0;

  if (metadata.preface) {
    ctx.font = serifFont(400, META_PREFACE_FONT);
    const lines = wrapText(ctx, metadata.preface, maxW, META_PREFACE_FONT * 0.08);
    prefaceH = lines.length * META_PREFACE_LH + META_GAP;
  }

  if (metadata.date || metadata.footnote) {
    ctx.font = serifFont(400, META_FOOTER_FONT);
    let lines = 0;
    if (metadata.date) lines += 1;
    if (metadata.footnote) {
      lines += wrapText(ctx, metadata.footnote, maxW, META_FOOTER_FONT * 0.08).length;
    }
    footerH = lines * META_FOOTER_LH + META_GAP;
  }

  return { prefaceH, footerH };
}

/** 横排绘制序言（作品上方）；诗：始终居中，词：单行居中、多行左对齐 */
function drawPreface(
  ctx: CanvasRenderingContext2D,
  text: string,
  colors: ColorTheme,
  startY: number,
  genre: 'Shi' | 'Ci',
  centerX: number,
  maxW: number,
) {
  ctx.fillStyle = colors.muted;
  ctx.font = serifFont(400, META_PREFACE_FONT);
  const spacing = META_PREFACE_FONT * 0.08;
  const lines = wrapText(ctx, text, maxW, spacing);
  // 诗：始终居中（与正文对齐）；词：单行居中、多行左对齐
  const centered = genre === 'Shi' || lines.length === 1;

  lines.forEach((line, i) => {
    const y = startY + i * META_PREFACE_LH + META_PREFACE_LH / 2;
    if (centered) {
      drawTextCentered(ctx, line, centerX, y, spacing);
    } else {
      drawTextLeft(ctx, line, PAD_X, y, spacing);
    }
  });
}

/** 横排绘制脚注+日期（作品下方）；诗：始终居中，词：单行居中、多行左对齐 */
function drawFooter(
  ctx: CanvasRenderingContext2D,
  date: string | undefined,
  footnote: string | undefined,
  colors: ColorTheme,
  startY: number,
  genre: 'Shi' | 'Ci',
  centerX: number,
  maxW: number,
) {
  ctx.fillStyle = colors.muted;
  ctx.font = serifFont(400, META_FOOTER_FONT);
  const spacing = META_FOOTER_FONT * 0.08;
  let y = startY;

  // 脚注（在日期上方）
  if (footnote) {
    const lines = wrapText(ctx, footnote, maxW, spacing);
    // 诗：始终居中（与正文对齐）；词：单行居中、多行左对齐
    const centered = genre === 'Shi' || lines.length === 1;
    lines.forEach((line, i) => {
      const lineY = y + i * META_FOOTER_LH + META_FOOTER_LH / 2;
      if (centered) {
        drawTextCentered(ctx, line, centerX, lineY, spacing);
      } else {
        drawTextLeft(ctx, line, PAD_X, lineY, spacing);
      }
    });
    y += lines.length * META_FOOTER_LH;
  }

  // 日期（诗居中，词左对齐）
  if (date) {
    const lineY = y + META_FOOTER_LH / 2;
    if (genre === 'Ci') {
      drawTextLeft(ctx, date, PAD_X, lineY, spacing);
    } else {
      drawTextCentered(ctx, date, centerX, lineY, spacing);
    }
  }
}

// ============================================================================
// 主绘制
// ============================================================================

export interface ExportData {
  title: string;
  lines: string[];
  charCount: number;
  genre: 'Shi' | 'Ci';
  theme: ThemeKey;
  logo?: HTMLImageElement | null;
  date?: string;
  preface?: string;
  footnote?: string;
}

export function renderToCanvas(data: ExportData): HTMLCanvasElement {
  const { title, lines, charCount, genre, theme, date, preface, footnote } = data;
  const colors = THEMES[theme];
  const { height: baseHeight, fontSize, lineHeight } =
    genre === 'Ci' ? getCiLayout(lines.length) : getShiLayout(charCount);

  // ---- 元数据折行宽度：诗按正文行宽，词用默认边距 ----
  let metaMaxW = META_MAX_W;
  if (genre === 'Shi') {
    const sentenceLen = charCount % 7 === 0 ? 7 : 5;
    const charsPerLine = sentenceLen * 2 + 2; // 一联 + 标点
    const letterSpacing = fontSize * 0.12;
    metaMaxW = charsPerLine * fontSize + (charsPerLine - 1) * letterSpacing;
  }

  // ---- 测量元数据额外高度 ----
  const measureCanvas = document.createElement('canvas');
  const measureCtx = measureCanvas.getContext('2d')!;
  const { prefaceH, footerH } = measureMetaHeight(measureCtx, { date, preface, footnote }, metaMaxW);
  const height = baseHeight + prefaceH + footerH;

  const scale = 2;
  const canvas = document.createElement('canvas');
  canvas.width = W * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(scale, scale);

  // ---- 背景 ----
  ctx.fillStyle = colors.bg;
  ctx.fillRect(0, 0, W, height);

  // ---- 标题色块（先画，标题文字叠在上面） ----
  const titleInfo = measureTitle(title, height);
  drawTitleBlock(ctx, colors, titleInfo);

  // ---- 标题文字 ----
  const titleResult = drawTitle(ctx, title, colors, height);

  // ---- 计算诗句实际位置 ----
  const poemTopBound = Math.max(titleResult.bottomY + 80, height * 0.48);
  const watermarkY = height - 70;
  const poemBottomLimit = genre === 'Shi'
    ? watermarkY - lineHeight - footerH
    : watermarkY - 40 - footerH;

  const totalPoemH = lines.length * lineHeight;
  const availableH = poemBottomLimit - poemTopBound;
  const actualLineH = totalPoemH > availableH ? availableH / lines.length : lineHeight;
  const actualTotalH = lines.length * actualLineH;
  // 诗：沉底；词：居中
  const poemStartY = genre === 'Shi'
    ? poemBottomLimit - actualTotalH
    : poemTopBound + (availableH - actualTotalH) / 2;

  // 元数据居中点：诗略右偏（比正文偏移量小，因为元数据无末尾标点），词用画布中心
  const metaCenterX = genre === 'Shi' ? W / 2 + fontSize * 0.2 : W / 2;

  // ---- 序言（紧贴诗句上方） ----
  if (preface) {
    const prefaceY = poemStartY - prefaceH;
    drawPreface(ctx, preface, colors, prefaceY, genre, metaCenterX, metaMaxW);
  }

  // ---- 诗句 ----
  drawPoemLines(ctx, lines, colors, fontSize, lineHeight, poemTopBound, poemBottomLimit, genre);

  // ---- 日期 / 脚注（作品下方） ----
  if (date || footnote) {
    const footerY = poemBottomLimit + 20;
    drawFooter(ctx, date, footnote, colors, footerY, genre, metaCenterX, metaMaxW);
  }

  // ---- 水印（logo + 文字） ----
  const wmText = '方寸 · 诗词画布';
  const wmFontSize = 18;
  const logoSize = 22;
  const logoGap = 6;
  ctx.fillStyle = colors.muted;
  ctx.font = `${wmFontSize}px system-ui, -apple-system, "Helvetica Neue", sans-serif`;
  ctx.textBaseline = 'middle';

  const textW = ctx.measureText(wmText).width;
  const hasLogo = !!data.logo;
  const totalWmW = hasLogo ? logoSize + logoGap + textW : textW;

  let wmX: number;
  if (genre === 'Ci') {
    wmX = PAD_X;
  } else {
    wmX = (W - totalWmW) / 2;
  }

  if (hasLogo) {
    // 深色主题反色 logo（原 logo 主体为黑色）
    const isDark = theme === '墨韵';
    if (isDark) ctx.filter = 'invert(1) hue-rotate(180deg)';
    ctx.drawImage(data.logo!, wmX, watermarkY - logoSize / 2, logoSize, logoSize);
    if (isDark) ctx.filter = 'none';
    wmX += logoSize + logoGap;
  }
  ctx.textAlign = 'left';
  ctx.fillText(wmText, wmX, watermarkY);

  return canvas;
}

// ---- 标题绘制 ----

/** 竖排多列绘制（超过 maxColChars 自动换列，从右往左）
 * 返回 { maxBottom: 底部Y坐标, leftX: 最左侧列的X坐标 }
 */
function drawVerticalColumns(
  ctx: CanvasRenderingContext2D,
  text: string,
  rightX: number,
  startY: number,
  fontSize: number,
  spacing: number,
  maxColChars: number = MAX_COL_CHARS,
): { maxBottom: number; leftX: number } {
  const chars = [...text];
  const cols: string[][] = [];
  for (let i = 0; i < chars.length; i += maxColChars) {
    cols.push(chars.slice(i, i + maxColChars));
  }
  const colGap = fontSize * 1.5;
  let maxBottom = startY;
  let leftX = rightX;

  // 从右往左排列各列
  cols.forEach((col, ci) => {
    const x = rightX - ci * colGap;
    leftX = Math.min(leftX, x);
    const bottom = drawVerticalText(ctx, col.join(''), x, startY, spacing);
    maxBottom = Math.max(maxBottom, bottom);
  });

  return { maxBottom, leftX };
}

function drawTitle(
  ctx: CanvasRenderingContext2D,
  title: string,
  colors: ColorTheme,
  canvasHeight: number,
): { bottomY: number; leftX: number } {
  ctx.fillStyle = colors.text;

  // 处理词牌 · 分隔符
  const dotIdx = title.search(/[·•·]/);
  const hasDot = dotIdx > 0;

  if (hasDot) {
    return drawCiTitle(ctx, title, dotIdx, colors, canvasHeight);
  }

  const config = getTitleConfig(title.length);
  const titleX = W * 0.85;
  const startY = canvasHeight * 0.13;

  ctx.font = serifFont(700, config.fontSize);
  const result = drawVerticalColumns(ctx, title, titleX, startY, config.fontSize, config.spacing);
  return {
    bottomY: result.maxBottom + config.fontSize * 0.5,
    leftX: result.leftX
  };
}

function drawCiTitle(
  ctx: CanvasRenderingContext2D,
  title: string,
  dotIdx: number,
  colors: ColorTheme,
  canvasHeight: number,
): { bottomY: number; leftX: number } {
  const cipai = title.slice(0, dotIdx);
  const subtitle = title.slice(dotIdx + 1);
  const config = getTitleConfig(Math.max(cipai.length, subtitle.length));

  const baseX = W * 0.85;
  const startY = canvasHeight * 0.13;

  // 词牌名右列（大字）
  ctx.fillStyle = colors.text;
  ctx.font = serifFont(700, config.fontSize);
  const cipaiResult = drawVerticalColumns(ctx, cipai, baseX, startY, config.fontSize, config.spacing);

  // 题目左列（略小）
  const subFontSize = Math.round(config.fontSize * 0.75);
  const subSpacing = Math.round(config.spacing * 0.78);
  ctx.font = serifFont(400, subFontSize);
  ctx.fillStyle = colors.text;
  const subX = baseX - config.fontSize * 1.6;
  const subStartY = startY + config.spacing * 1.6;
  const subResult = drawVerticalColumns(ctx, subtitle, subX, subStartY, subFontSize, subSpacing);

  return {
    bottomY: Math.max(cipaiResult.maxBottom, subResult.maxBottom) + config.fontSize * 0.5,
    leftX: Math.min(cipaiResult.leftX, subResult.leftX)
  };
}

// ---- 标题色块 ----

interface TitleMeasure {
  titleX: number;      // 标题中心 X
  startY: number;      // 第一个字中心 Y
  bottomY: number;     // 最后一个字底部 Y
  fontSize: number;
}

/** 预计算标题位置（不绘制），用于色块定位 */
function measureTitle(title: string, canvasHeight: number): TitleMeasure {
  const dotIdx = title.search(/[·•·]/);
  const cipai = dotIdx > 0 ? title.slice(0, dotIdx) : title;
  // Ci 标题时 config 由 max(cipai, subtitle) 决定，与 drawCiTitle 一致
  const configKey = dotIdx > 0
    ? Math.max(cipai.length, title.slice(dotIdx + 1).length)
    : cipai.length;
  const config = getTitleConfig(configKey);

  const titleX = W * 0.85;
  const startY = canvasHeight * 0.13;
  // 色块只覆盖词牌名（右列）高度，不含题目
  const visibleChars = Math.min(cipai.length, MAX_COL_CHARS);
  const bottomY = startY + (visibleChars - 1) * config.spacing + config.fontSize * 0.5;
  return { titleX, startY, bottomY, fontSize: config.fontSize };
}

/** 在标题第一个字下方绘制色块，向右延伸出画布 */
function drawTitleBlock(
  ctx: CanvasRenderingContext2D,
  colors: ColorTheme,
  info: TitleMeasure,
) {
  // 色块从第一个字中间开始，到标题底部 + 余量
  const blockTop = info.startY;
  const blockBottom = info.bottomY + info.fontSize * 0.5;
  const blockLeft = info.titleX;
  const blockHeight = blockBottom - blockTop;

  ctx.fillStyle = colors.accent;
  // 改为1.0字宽
  const blockWidth = info.fontSize * 1.0;
  ctx.fillRect(blockLeft, blockTop, blockWidth, blockHeight);
}

// ---- 诗句绘制 ----

/** 左对齐绘制带字间距的文本 */
function drawTextLeft(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  spacing: number,
) {
  const chars = [...text];
  if (chars.length === 0) return;

  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';

  let curX = x;
  for (const ch of chars) {
    const w = ctx.measureText(ch).width;
    ctx.fillText(ch, curX, y);
    curX += w + spacing;
  }
}

function drawPoemLines(
  ctx: CanvasRenderingContext2D,
  lines: string[],
  colors: ColorTheme,
  fontSize: number,
  lineHeight: number,
  topY: number,
  bottomLimit: number,
  genre: 'Shi' | 'Ci',
) {
  if (lines.length === 0) return;

  const totalH = lines.length * lineHeight;
  const available = bottomLimit - topY;

  // 如果诗句太多放不下，压缩行高
  const actualLineH = totalH > available ? available / lines.length : lineHeight;

  const actualTotalH = lines.length * actualLineH;
  // 诗：沉底（绝句留白在上方更好看）；词：居中
  const startY = genre === 'Shi'
    ? bottomLimit - actualTotalH
    : topY + (available - actualTotalH) / 2;

  ctx.fillStyle = colors.text;
  ctx.font = serifFont(400, fontSize);

  const letterSpacing = fontSize * 0.12;

  if (genre === 'Ci') {
    // 词：左对齐
    lines.forEach((line, i) => {
      const y = startY + i * actualLineH + actualLineH / 2;
      drawTextLeft(ctx, line, PAD_X, y, letterSpacing);
    });
  } else {
    // 诗：居中，右移半字宽补偿末尾标点
    const centerX = W / 2 + fontSize * 0.5;
    lines.forEach((line, i) => {
      const y = startY + i * actualLineH + actualLineH / 2;
      drawTextCentered(ctx, line, centerX, y, letterSpacing);
    });
  }
}

// ============================================================================
// 下载
// ============================================================================

export function downloadCanvas(canvas: HTMLCanvasElement, title: string): void {
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title || '诗'}.png`;
    a.click();
    URL.revokeObjectURL(url);
  }, 'image/png');
}
