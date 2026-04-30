// ============================================================================
// 诗词图片导出 — Canvas 绘制引擎
// ============================================================================

export type ThemeKey = '素白' | '朱砂' | '墨韵' | '竹青' | '藏蓝' | '烟紫' | '秋棠' | '霜灰' | '纸感' | '棉花糖' | '鱼肚白' | '极光' | '春水' | '暮山' | '星河' | '薄荷' | '大理石' | '晨暮' | '丹霞' | '碧落' | '苍翠' | '鎏金' | '西湖' | '金乌' | '烟雨' | '枯藤' | '青瓷' | '残雪' | '芭蕉' | '蝶梦' | '桃源' | '鹊桥' | '琉璃';

interface ColorTheme {
  bg: string;
  gradient?: { colors: string[]; angle?: number };
  splitBg?: { top: string; bottom: string; blend?: number };
  blobs?: { x: number; y: number; size: number; color: string; layers?: number; seed?: number; aspect?: number }[];
  texture?: 'noise' | 'paper' | 'speckle' | 'topography';
  topoColor?: string;
  titleText?: string;
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
  '纸感': { bg: '#F5F0E8', gradient: { colors: ['#FAF7F0', '#E8DCC8', '#F2E8D4', '#EDE0CA'], angle: 155 }, texture: 'paper', text: '#3A3028', accent: '#D8CEBC', muted: '#A89880' },
  '棉花糖': { bg: '#FDF2F8', blobs: [
    { x: -0.1, y: 0.2, size: 0.6, color: '#F0C0D8', layers: 5, seed: 0 },
    { x: 1.1, y: 0.5, size: 0.55, color: '#C0D0F0', layers: 5, seed: 2.5 },
    { x: 0.5, y: -0.2, size: 0.45, color: '#E8C8F0', layers: 4, seed: 5 },
  ], text: '#5A4060', accent: '#E8D0E0', muted: '#B098B8' },
  '鱼肚白': { bg: '#FAFBFD', blobs: [
    { x: 0.3, y: 1.2, size: 0.65, color: '#D0CAE0', layers: 5, seed: 1 },
    { x: 1.0, y: 0.3, size: 0.45, color: '#D4D0E8', layers: 4, seed: 3.5 },
    { x: 0.7, y: 0.6, size: 0.25, color: '#F0DCC0', layers: 3, seed: 6 },
  ], text: '#2E3440', accent: '#D8DCE4', muted: '#8890A0' },
  '极光': { bg: '#0E1420', gradient: { colors: ['#0C1018', '#121828', '#0E1822'], angle: 165 }, text: '#C8E0D0', accent: '#1E3030', muted: '#4A6858' },
  '春水': { bg: '#F4FAF6', blobs: [
    { x: 0.2, y: 0.8, size: 0.6, color: '#B8DCC8', layers: 5, seed: 0.5 },
    { x: 0.9, y: 0.1, size: 0.4, color: '#C8E8D8', layers: 4, seed: 3 },
  ], text: '#2A4A3A', accent: '#C0D8CC', muted: '#7EA090' },
  '暮山': { bg: '#F0EEF0', blobs: [
    { x: 0.15, y: 1.1, size: 0.7, color: '#C0B8C8', layers: 5, seed: 1.8 },
    { x: 0.85, y: 0.4, size: 0.5, color: '#B8BCC8', layers: 5, seed: 4.2 },
    { x: -0.05, y: 0.1, size: 0.35, color: '#C8C2CC', layers: 3, seed: 6 },
  ], text: '#3A3450', accent: '#C0BAC8', muted: '#8880A0' },
  '星河': { bg: '#0E0E1A', blobs: [
    { x: 0.7, y: 0.15, size: 0.55, color: '#2A2050', layers: 5, seed: 2 },
    { x: 0.1, y: 0.7, size: 0.45, color: '#1A1840', layers: 4, seed: 4.5 },
  ], text: '#D0C8E0', accent: '#2A2440', muted: '#5A5078' },
  '薄荷': { bg: '#F0FAFA', gradient: { colors: ['#F4FDFC', '#E0F4F2', '#E8F8F8', '#DCF0F0'], angle: 140 }, text: '#1A3840', accent: '#BED8D8', muted: '#68A0A0' },
  '大理石': { bg: '#F5F3F2', gradient: { colors: ['#F8F6F5', '#F0EDEB', '#F5F2F0', '#EDE9E7'], angle: 160 }, texture: 'speckle', text: '#3A3638', accent: '#D8D4D2', muted: '#908888' },
  '晨暮': { bg: '#F0E8E4', splitBg: { top: '#F8F0EA', bottom: '#EDE4F0', blend: 200 }, text: '#4A3040', accent: '#D8C8D0', muted: '#988898' },
  '丹霞': { bg: '#FAF8F6', topoColor: '#9B4060', titleText: '#F8F0F2', text: '#3A2030', accent: '#7A2848', muted: '#A08898' },
  '碧落': { bg: '#F6F9FA', topoColor: '#2A5A8A', titleText: '#F0F4F8', text: '#1A3050', accent: '#1A4068', muted: '#7090A8' },
  '苍翠': { bg: '#F7FAF6', topoColor: '#2E7A50', titleText: '#F0F8F2', text: '#1A3828', accent: '#1E5A38', muted: '#609878' },
  '鎏金': { bg: '#FAF8F4', topoColor: '#A07830', titleText: '#FBF6EE', text: '#3A3018', accent: '#806020', muted: '#A89860' },
  '西湖': { bg: '#FAF8F5', blobs: [
    { x: -0.1, y: 0.5, size: 0.6, color: '#A8C8A0', layers: 5, seed: 0.7 },
    { x: 1.0, y: 0.7, size: 0.5, color: '#E8A8B0', layers: 5, seed: 3.2 },
    { x: 0.7, y: -0.05, size: 0.4, color: '#E0B0B8', layers: 4, seed: 7.8 },
  ], titleText: '#6A3040', text: '#3A3030', accent: '#D8A0A8', muted: '#908878' },
  '金乌': { bg: '#1A1020', gradient: { colors: ['#18122A', '#1E1630', '#221838', '#2A1838', '#4A1828', '#A04020', '#D88030'], angle: 180 }, titleText: '#F0D8A0', text: '#F0E0C8', accent: '#4A1828', muted: '#C89060' },
  '烟雨': { bg: '#E8EAF0', blobs: [
    { x: -0.15, y: 0.15, size: 0.7, color: '#B0B8C8', layers: 6, seed: 1.2 },
    { x: 1.1, y: 0.4, size: 0.6, color: '#A0AABB', layers: 5, seed: 3.8 },
    { x: 0.3, y: 1.15, size: 0.5, color: '#BCC4D0', layers: 4, seed: 6.5 },
    { x: -0.1, y: 0.85, size: 0.35, color: '#98A8B8', layers: 3, seed: 8.1 },
  ], text: '#2A3040', accent: '#C0C8D4', muted: '#788090' },
  '枯藤': { bg: '#E8E4DE', splitBg: { top: '#EAE4DA', bottom: '#D0C8BE', blend: 300 }, blobs: [
    { x: -0.1, y: 0.5, size: 0.5, color: '#D8CCAF', layers: 3, seed: 2.1 },
    { x: 1.0, y: 0.7, size: 0.4, color: '#D0C0A0', layers: 3, seed: 7.1 },
    { x: 0.7, y: 0.1, size: 0.35, color: '#C8B8A0', layers: 2, seed: 8.7 },
  ], text: '#4A4038', accent: '#C8C0B0', muted: '#8A8070' },
  '青瓷': { bg: '#E8F0EE', topoColor: '#5A9A8A', titleText: '#EEF4F2', text: '#1A3830', accent: '#3A7868', muted: '#78A898' },
  '残雪': { bg: '#F0F4F8', blobs: [
    { x: -0.1, y: 0.6, size: 0.65, color: '#C8D8E8', layers: 5, seed: 0.3 },
    { x: 1.1, y: -0.1, size: 0.55, color: '#D0DDE8', layers: 4, seed: 4.1 },
    { x: 0.8, y: 1.1, size: 0.4, color: '#B8CCE0', layers: 3, seed: 7.0 },
  ], text: '#1A2840', accent: '#C0D0E0', muted: '#7888A0' },
  '芭蕉': { bg: '#1A2A1A', blobs: [
    { x: -0.15, y: 0.1, size: 0.7, color: '#1A4A28', layers: 6, seed: 0.8 },
    { x: 1.1, y: 0.35, size: 0.6, color: '#285A30', layers: 5, seed: 3.5 },
    { x: 0.3, y: 1.15, size: 0.45, color: '#204A20', layers: 4, seed: 6.2 },
  ], titleText: '#C8E0B8', text: '#C0D8B0', accent: '#1A3A1A', muted: '#68A058' },
  '蝶梦': { bg: '#F0E8F6', blobs: [
    { x: -0.15, y: -0.1, size: 0.65, color: '#D0B0E8', layers: 6, seed: 1.5 },
    { x: 1.15, y: 0.35, size: 0.55, color: '#C8A0E0', layers: 5, seed: 4.0 },
    { x: 0.2, y: 1.1, size: 0.5, color: '#E0C0F0', layers: 4, seed: 7.2 },
    { x: -0.1, y: 0.6, size: 0.3, color: '#D8B8E8', layers: 3, seed: 9.0 },
  ], text: '#3A2050', accent: '#D0B8E0', muted: '#9878B0' },
  '桃源': { bg: '#FDF0F0', blobs: [
    { x: -0.15, y: 0.2, size: 0.6, color: '#F0C0B8', layers: 5, seed: 0.6 },
    { x: 1.1, y: -0.1, size: 0.55, color: '#F0D0B8', layers: 5, seed: 3.3 },
    { x: 0.8, y: 1.1, size: 0.5, color: '#E8B8B0', layers: 5, seed: 5.8 },
    { x: 1.15, y: 0.7, size: 0.35, color: '#F0C8C0', layers: 4, seed: 8.5 },
  ], text: '#5A2828', accent: '#E8C0B8', muted: '#B88080' },
  '鹊桥': { bg: '#0E1028', blobs: [
    { x: -0.15, y: 0.15, size: 0.6, color: '#2A1848', layers: 5, seed: 1.0 },
    { x: 1.1, y: 0.55, size: 0.55, color: '#482040', layers: 5, seed: 3.7 },
    { x: 0.7, y: -0.15, size: 0.4, color: '#1A1840', layers: 4, seed: 6.8 },
    { x: 1.05, y: 1.1, size: 0.35, color: '#401838', layers: 3, seed: 9.3 },
  ], titleText: '#E8C0D8', text: '#D8C0E0', accent: '#2A1840', muted: '#7858A0' },
  '琉璃': { bg: '#F2F0F8', gradient: { colors: ['#E8D8F0', '#D8E0F8', '#D0F0F0', '#E0F0D8', '#F0E8D0', '#F0D8E0', '#E8D8F0'], angle: 150 }, text: '#3A3050', accent: '#D0C8E0', muted: '#8878A0' },
};

export const THEME_KEYS: ThemeKey[] = [
  // ---- 浅色纯色 ----
  '素白', '朱砂', '竹青', '藏蓝', '烟紫', '秋棠', '霜灰',
  // ---- 浅色渐变/纹理 ----
  '纸感', '大理石', '薄荷', '晨暮', '琉璃',
  // ---- 浅色等高线 ----
  '丹霞', '碧落', '苍翠', '鎏金', '青瓷',
  // ---- 浅色 blob ----
  '棉花糖', '蝶梦', '桃源', '鱼肚白', '春水', '西湖', '暮山', '烟雨', '残雪', '枯藤',
  // ---- 深色 ----
  '墨韵', '极光', '金乌', '星河', '鹊桥', '芭蕉',
];

// ============================================================================
// 布局参数
// ============================================================================

const W = 1080;
const PAD_X = 100;
const TITLE_PAD_TOP = 150;   // 标题距画布顶部（固定，不随画布高度变化）
const MIN_GAP = 50;          // 标题与内容之间最小间距

function getShiFontConfig(charCount: number) {
  if (charCount <= 70)  return { fontSize: 44, lineHeight: 96 };
  if (charCount <= 90)  return { fontSize: 38, lineHeight: 84 };
  if (charCount <= 150) return { fontSize: 32, lineHeight: 72 };
  return { fontSize: 28, lineHeight: 62 };
}

function getCiFontConfig(lineCount: number, maxLineLen: number) {
  if (lineCount < 8) {
    if (maxLineLen < 16) return { fontSize: 44, lineHeight: 96 };
    if (lineCount <= 6)  return { fontSize: 40, lineHeight: 88 };
    return { fontSize: 36, lineHeight: 76 };
  }
  // >= 8 行：由最长行字数决定字号，上限 44px（等价 <=15 字/行）
  const contentW = W - PAD_X * 2;
  const spacing = 0.12;
  const idealSize = contentW / (maxLineLen * (1 + spacing));
  const fontSize = Math.min(44, Math.max(22, Math.floor(idealSize)));
  const lineHeight = Math.round(fontSize * 2.1);
  return { fontSize, lineHeight };
}

/** 每列最多显示的字数 */
const MAX_COL_CHARS = 10;

function drawTexture(ctx: CanvasRenderingContext2D, w: number, h: number, type: 'noise' | 'paper' | 'speckle') {
  const imgData = ctx.getImageData(0, 0, w, h);
  const d = imgData.data;
  if (type === 'noise') {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const size = 1 + Math.floor(Math.random() * 3);
        if (Math.random() > 0.3) continue;
        const n = (Math.random() - 0.5) * 40;
        for (let dy = 0; dy < size && y + dy < h; dy++) {
          for (let dx = 0; dx < size && x + dx < w; dx++) {
            const i = ((y + dy) * w + (x + dx)) * 4;
            d[i]     = Math.min(255, Math.max(0, d[i] + n));
            d[i + 1] = Math.min(255, Math.max(0, d[i + 1] + n));
            d[i + 2] = Math.min(255, Math.max(0, d[i + 2] + n));
          }
        }
      }
    }
  } else if (type === 'paper') {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (Math.random() > 0.15) continue;
        const size = 1 + Math.floor(Math.random() * 4);
        const isFiber = Math.random() < 0.02;
        const n = isFiber
          ? (Math.random() - 0.5) * 45
          : (Math.random() - 0.5) * 18;
        const lenX = isFiber ? size + Math.floor(Math.random() * 6) : size;
        const lenY = isFiber ? 1 + Math.floor(Math.random() * 2) : size;
        for (let dy = 0; dy < lenY && y + dy < h; dy++) {
          for (let dx = 0; dx < lenX && x + dx < w; dx++) {
            const fade = 1 - Math.max(dx / lenX, dy / lenY) * 0.5;
            const v = n * fade;
            const i = ((y + dy) * w + (x + dx)) * 4;
            d[i]     = Math.min(255, Math.max(0, d[i] + v));
            d[i + 1] = Math.min(255, Math.max(0, d[i + 1] + v));
            d[i + 2] = Math.min(255, Math.max(0, d[i + 2] + v));
          }
        }
      }
    }
  } else {
    const count = Math.floor(w * h * 0.00012);
    for (let s = 0; s < count; s++) {
      const cx = Math.random() * w;
      const cy = Math.random() * h;
      const r = 3 + Math.random() * 18;
      const darker = Math.random() < 0.6;
      const intensity = darker ? -(6 + Math.random() * 14) : (6 + Math.random() * 14);
      const tintR = Math.random() * 12;
      const tintB = (Math.random() - 0.5) * 6;
      const x0 = Math.max(0, Math.floor(cx - r));
      const x1 = Math.min(w - 1, Math.ceil(cx + r));
      const y0 = Math.max(0, Math.floor(cy - r));
      const y1 = Math.min(h - 1, Math.ceil(cy + r));
      const r2 = r * r;
      const inner2 = (r * 0.7) * (r * 0.7);
      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
          const dist2 = (x - cx) * (x - cx) + (y - cy) * (y - cy);
          if (dist2 > r2) continue;
          const fade = dist2 < inner2 ? 1.0 : 1 - (Math.sqrt(dist2) - r * 0.7) / (r * 0.3);
          const v = intensity * fade;
          const i = (y * w + x) * 4;
          d[i]     = Math.min(255, Math.max(0, d[i] + v + tintR * fade));
          d[i + 1] = Math.min(255, Math.max(0, d[i + 1] + v));
          d[i + 2] = Math.min(255, Math.max(0, d[i + 2] + v + tintB * fade));
        }
      }
    }
  }
  ctx.putImageData(imgData, 0, 0);
}

function hexToRgb(hex: string) {
  const v = parseInt(hex.slice(1), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

function drawBlob(ctx: CanvasRenderingContext2D, cx: number, cy: number, maxR: number, layers: number, color: string, bg: string, seedOffset: number, aspect = 1) {
  const [cr, cg, cb] = hexToRgb(color);
  const [br, bg2, bb] = hexToRgb(bg);
  const seeds = [1.3, 2.1, 0.7, 1.9, 3.1, 0.4, 2.7, 1.5, 0.9];

  for (let i = layers; i >= 0; i--) {
    const t = i / layers;
    const r = maxR * (0.45 + t * 0.55);
    const mix = t * 0.85;
    const fr = Math.round(cr * (1 - mix) + br * mix);
    const fg = Math.round(cg * (1 - mix) + bg2 * mix);
    const fb = Math.round(cb * (1 - mix) + bb * mix);

    const pts = 8;
    const angles: number[] = [];
    const radii: number[] = [];
    for (let p = 0; p < pts; p++) {
      const a = (p / pts) * Math.PI * 2;
      angles.push(a);
      const wobble = 0.85 + 0.3 * Math.sin(seeds[p % seeds.length] * (i + 1) * 1.7 + p * 0.8 + seedOffset);
      radii.push(r * wobble);
    }

    const yScale = 1 / aspect;
    const ptX = (a: number, ri: number) => cx + Math.cos(a) * ri;
    const ptY = (a: number, ri: number) => cy + Math.sin(a) * ri * yScale;

    ctx.beginPath();
    for (let p = 0; p <= pts; p++) {
      const ai = p % pts;
      const ax = ptX(angles[ai], radii[ai]);
      const ay = ptY(angles[ai], radii[ai]);
      if (p === 0) { ctx.moveTo(ax, ay); continue; }
      const prevI = (p - 1) % pts;
      const a1 = angles[prevI] + 0.5 / pts * Math.PI * 2;
      const a2 = angles[ai] - 0.5 / pts * Math.PI * 2;
      ctx.bezierCurveTo(
        ptX(a1, radii[prevI] * 1.05), ptY(a1, radii[prevI] * 1.05),
        ptX(a2, radii[ai] * 1.05), ptY(a2, radii[ai] * 1.05),
        ax, ay,
      );
    }
    ctx.closePath();
    ctx.fillStyle = `rgb(${fr},${fg},${fb})`;
    ctx.fill();
  }
}

function drawTopography(ctx: CanvasRenderingContext2D, w: number, _h: number, color: string, bg: string) {
  drawBlob(ctx, w * 0.92, w * 0.08, w * 0.7, 8, color, bg, 0);
}

function drawBlobs(ctx: CanvasRenderingContext2D, w: number, blobs: NonNullable<ColorTheme['blobs']>, bg: string) {
  for (const b of blobs) {
    drawBlob(ctx, b.x * w, b.y * w, b.size * w, b.layers ?? 6, b.color, bg, b.seed ?? 0, b.aspect ?? 1);
  }
}

/** 标准画布比例（从小到大尝试） */
const ASPECT_HEIGHTS = [
  W * 4 / 3,    // 3:4  → 1440
  W * 16 / 9,   // 9:16 → 1920
  W * 2,        // 9:18 → 2160
];

/** 选择能容纳 minH 的最小标准比例画布高度 */
function pickCanvasHeight(minH: number): number {
  for (const h of ASPECT_HEIGHTS) {
    if (h >= minH) return h;
  }
  return Math.ceil(minH / 60) * 60;
}

/** 测量标题竖排区域高度（不含顶部 padding） */
function measureTitleBlockHeight(title: string): number {
  const dotIdx = title.search(/[·•·]/);
  const cipai = dotIdx > 0 ? title.slice(0, dotIdx) : title;
  const subtitle = dotIdx > 0 ? title.slice(dotIdx + 1) : '';
  const configKey = dotIdx > 0 ? Math.max(cipai.length, subtitle.length) : cipai.length;
  const config = getTitleConfig(configKey);

  const visibleChars = Math.min(cipai.length, MAX_COL_CHARS);
  let h = (visibleChars - 1) * config.spacing + config.fontSize;

  if (subtitle) {
    const subSpacing = Math.round(config.spacing * 0.78);
    const subFontSize = Math.round(config.fontSize * 0.75);
    const subChars = Math.min(subtitle.length, MAX_COL_CHARS);
    const subStartOffset = config.spacing * 1.6;
    const subH = subStartOffset + (subChars - 1) * subSpacing + subFontSize;
    h = Math.max(h, subH);
  }

  return h;
}

function getTitleConfig(titleLen: number) {
  if (titleLen <= 4) return { fontSize: 72, spacing: 97 };
  if (titleLen <= 8) return { fontSize: 56, spacing: 76 };
  if (titleLen <= 12) return { fontSize: 44, spacing: 60 };
  return { fontSize: 36, spacing: 50 };
}

// ============================================================================
// 字体加载（自托管 woff2 切片，unicode-range 按需加载）
// ============================================================================

import { signCdnUrl } from './cdnSign';

// CDN 配置（生产环境通过 Vite env 注入）
const FONT_CDN_BASE = (import.meta.env.VITE_FONT_CDN_BASE as string | undefined)?.trim();
const FONT_CDN_KEY = (import.meta.env.VITE_FONT_CDN_KEY as string | undefined)?.trim();

// 使用隔离的字体名称，避免污染主界面
const EXPORT_FONT_FAMILY = '__FangcunExport__';

// 字体注册表
export type FontKey = 'NotoSerifSC' | 'NotoSansSC' | 'HuiwenMincho' | 'SongKeBenXiuKai' | 'LXGWWenKai' | 'ML';

export interface FontOption {
  key: FontKey;
  label: string;
  cssDir: string;        // cn-font-split 输出目录名
  boldDir?: string;      // Bold 版本目录名（可选）
}

export const FONT_OPTIONS: FontOption[] = [
  { key: 'NotoSerifSC', label: '思源宋体', cssDir: 'NotoSerifSC-Regular', boldDir: 'NotoSerifSC-Bold' },
  { key: 'NotoSansSC', label: '思源黑体', cssDir: 'NotoSansSC-Regular' },
  { key: 'HuiwenMincho', label: '汇文明朝体', cssDir: '汇文明朝体' },
  { key: 'SongKeBenXiuKai', label: '宋刻本秀楷', cssDir: '方正宋刻本秀楷简体' },
  { key: 'LXGWWenKai', label: '霞鹜文楷', cssDir: 'LXGWWenKaiLite-Regular' },
  { key: 'ML', label: '沐瓴体', cssDir: 'ml' },
];

export const DEFAULT_FONT: FontKey = 'NotoSerifSC';

// 缓存 logo 图片
let _logoImg: HTMLImageElement | null = null;

/** 为字体选择器预加载各字体的"文"字，使预览圆圈能正确显示 */
export async function loadFontPreviews(): Promise<void> {
  const charCps = new Set(['文'.codePointAt(0)!]);
  const previewFamily = (dir: string) => `__Preview_${dir}__`;

  await Promise.all(FONT_OPTIONS.map(async (f) => {
    const family = previewFamily(f.cssDir);
    // 已加载则跳过
    let exists = false;
    document.fonts.forEach(ff => { if (ff.family === family) exists = true; });
    if (exists) return;

    try {
      const cssUrl = fontCssUrl(f.cssDir);
      const resp = await fetch(cssUrl);
      const css = await resp.text();
      const blocks = css.match(/@font-face\{[^}]+\}/g) || [];
      const matched = blocks.filter(b => matchesUnicodeRange(b, charCps));
      await Promise.all(matched.map(async (block) => {
        const urlMatch = block.match(/url\("\.\/([^"]+)"\)/);
        if (!urlMatch) return;
        const url = fontFileUrl(f.cssDir, urlMatch[1]);
        const font = new FontFace(family, `url("${url}")`, { weight: '400', style: 'normal' });
        document.fonts.add(await font.load());
      }));
    } catch { /* ignore preview load failures */ }
  }));
}

/** 获取预览字体 family 名 */
export function previewFontFamily(dir: string): string {
  return `"__Preview_${dir}__", serif`;
}

export async function loadLogo(): Promise<HTMLImageElement | null> {
  if (_logoImg) return _logoImg;
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => { _logoImg = img; resolve(img); };
    img.onerror = () => resolve(null);
    img.src = '/favicon.ico';
  });
}

/** 解析 unicode-range 值为码点集合 */
function parseUnicodeRange(rangeStr: string): Set<number> {
  const codepoints = new Set<number>();
  for (const part of rangeStr.split(',')) {
    const trimmed = part.trim().replace(/^U\+/i, '');
    if (trimmed.includes('-')) {
      const [startStr, endStr] = trimmed.split('-');
      const start = parseInt(startStr, 16);
      const end = parseInt(endStr, 16);
      for (let cp = start; cp <= end; cp++) codepoints.add(cp);
    } else if (trimmed.includes('?')) {
      const base = trimmed.replace(/\?/g, '0');
      const top = trimmed.replace(/\?/g, 'F');
      const start = parseInt(base, 16);
      const end = parseInt(top, 16);
      for (let cp = start; cp <= end; cp++) codepoints.add(cp);
    } else {
      codepoints.add(parseInt(trimmed, 16));
    }
  }
  return codepoints;
}

/** 判断 @font-face 块的 unicode-range 是否命中任何文本字符 */
function matchesUnicodeRange(block: string, charCodepoints: Set<number>): boolean {
  const rangeMatch = block.match(/unicode-range:\s*([^;}]+)/);
  if (!rangeMatch) return true;
  const rangeCps = parseUnicodeRange(rangeMatch[1]);
  for (const cp of charCodepoints) {
    if (rangeCps.has(cp)) return true;
  }
  return false;
}

let _fontsLoaded = false;
let _loadedFontKey: FontKey | null = null;

/** 构造字体文件 URL（CDN 签名 或 本地路径） */
function fontFileUrl(dir: string, file: string): string {
  if (FONT_CDN_BASE && FONT_CDN_KEY) {
    const url = `${FONT_CDN_BASE}/${encodeURIComponent(dir)}/${file}`;
    return signCdnUrl(url, FONT_CDN_KEY, 3600);
  }
  return `/fonts/${dir}/${file}`;
}

/** 构造字体 CSS URL */
function fontCssUrl(dir: string): string {
  return fontFileUrl(dir, 'result.css');
}

export async function loadExportFonts(text: string, fontKey: FontKey = DEFAULT_FONT): Promise<void> {
  // 已加载相同字体则跳过
  if (_fontsLoaded && _loadedFontKey === fontKey) return;

  // 切换字体时清除旧 FontFace
  if (_loadedFontKey !== fontKey) {
    document.fonts.forEach(f => {
      if (f.family === EXPORT_FONT_FAMILY) document.fonts.delete(f);
    });
    _fontsLoaded = false;
  }

  const charCps = new Set([...new Set(text)].map(ch => ch.codePointAt(0)!));
  const option = FONT_OPTIONS.find(o => o.key === fontKey) ?? FONT_OPTIONS[0];
  const dirs = [option.cssDir];
  if (option.boldDir) dirs.push(option.boldDir);

  try {
    for (const dir of dirs) {
      const cssUrl = fontCssUrl(dir);
      const resp = await fetch(cssUrl);
      if (!resp.ok) { console.warn('[Font] CSS fetch failed:', resp.status, dir); continue; }
      const css = await resp.text();
      const blocks = css.match(/@font-face\{[^}]+\}/g) || [];
      const weight = dir === option.boldDir ? '700' : '400';
      const matched = blocks.filter(block => matchesUnicodeRange(block, charCps));

      const results = await Promise.allSettled(matched.map(async (block) => {
        const urlMatch = block.match(/url\("\.\/([^"]+)"\)/);
        if (!urlMatch) return;
        const url = fontFileUrl(dir, urlMatch[1]);
        const font = new FontFace(EXPORT_FONT_FAMILY, `url("${url}")`, {
          weight,
          style: 'normal',
        });
        const loaded = await font.load();
        document.fonts.add(loaded);
      }));
      const failed = results.filter(r => r.status === 'rejected');
      if (failed.length) console.warn(`[Font] ${failed.length}/${results.length} chunks failed:`, (failed[0] as PromiseRejectedResult).reason);
    }
    _fontsLoaded = true;
    _loadedFontKey = fontKey;
  } catch (e) {
    console.error('[Font] load error:', e);
    _fontsLoaded = false;
  }
}

function exportFont(weight: number, size: number): string {
  const family = _fontsLoaded
    ? `"${EXPORT_FONT_FAMILY}"`
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
    ctx.font = exportFont(400, META_PREFACE_FONT);
    const lines = wrapText(ctx, metadata.preface, maxW, META_PREFACE_FONT * 0.08);
    prefaceH = lines.length * META_PREFACE_LH + META_GAP;
  }

  if (metadata.date || metadata.footnote) {
    ctx.font = exportFont(400, META_FOOTER_FONT);
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
  genre: 'Shi' | 'Ci' | 'Free',
  centerX: number,
  maxW: number,
) {
  ctx.fillStyle = colors.muted;
  ctx.font = exportFont(400, META_PREFACE_FONT);
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
  genre: 'Shi' | 'Ci' | 'Free',
  centerX: number,
  maxW: number,
) {
  ctx.fillStyle = colors.muted;
  ctx.font = exportFont(400, META_FOOTER_FONT);
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
  genre: 'Shi' | 'Ci' | 'Free' | 'Free';
  theme: ThemeKey;
  fontKey?: FontKey;
  logo?: HTMLImageElement | null;
  date?: string;
  preface?: string;
  footnote?: string;
  author?: string;
  sectionCount?: number;
  titleLines?: Set<number>;
}

export function renderToCanvas(data: ExportData): HTMLCanvasElement {
  const { title, lines, charCount, genre, theme, date, preface, footnote, author } = data;
  const colors = THEMES[theme];
  const maxLineLen = genre !== 'Shi' ? Math.max(...lines.map(l => [...l].length)) : 0;
  const { fontSize, lineHeight } =
    genre !== 'Shi' ? getCiFontConfig(lines.length, maxLineLen) : getShiFontConfig(charCount);

  // ---- 元数据折行宽度：诗按正文行宽，词用默认边距 ----
  let metaMaxW = META_MAX_W;
  if (genre === 'Shi') {
    const sentenceLen = charCount % 7 === 0 ? 7 : 5;
    const charsPerLine = sentenceLen * 2 + 2; // 一联 + 标点
    const letterSpacing = fontSize * 0.12;
    metaMaxW = charsPerLine * fontSize + (charsPerLine - 1) * letterSpacing;
  }

  // ---- 测量各区域高度 ----
  const measureCanvas = document.createElement('canvas');
  const measureCtx = measureCanvas.getContext('2d')!;
  const { prefaceH, footerH } = measureMetaHeight(measureCtx, { date, preface, footnote }, metaMaxW);

  const titleBlockH = measureTitleBlockHeight(title);
  const titleRegionH = TITLE_PAD_TOP + titleBlockH;
  const poemTotalH = lines.length * lineHeight;
  const authorH = author ? 40 : 0;  // 署名行高度
  const belowPoemPad = lineHeight + footerH + authorH + 70;
  const contentH = prefaceH + poemTotalH + belowPoemPad;
  const minGap = MIN_GAP + ((data.sectionCount ?? 1) > 1 || genre === 'Free' ? lineHeight * 2 : 0);
  const minH = titleRegionH + minGap + contentH;
  const height = pickCanvasHeight(minH);

  const scale = 2;
  const canvas = document.createElement('canvas');
  canvas.width = W * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(scale, scale);

  // ---- 背景 ----
  if (colors.splitBg) {
    const { top, bottom, blend = 120 } = colors.splitBg;
    const splitY = titleRegionH + minGap * 0.4;
    ctx.fillStyle = bottom;
    ctx.fillRect(0, 0, W, height);
    ctx.fillStyle = top;
    ctx.fillRect(0, 0, W, splitY);
    const grad = ctx.createLinearGradient(0, splitY, 0, splitY + blend);
    grad.addColorStop(0, top);
    grad.addColorStop(1, bottom);
    ctx.fillStyle = grad;
    ctx.fillRect(0, splitY, W, blend);
  } else if (colors.gradient) {
    const { colors: stops, angle = 180 } = colors.gradient;
    const rad = (angle - 90) * Math.PI / 180;
    const cx = W / 2, cy = height / 2;
    const len = Math.max(W, height);
    const dx = Math.cos(rad) * len, dy = Math.sin(rad) * len;
    const grad = ctx.createLinearGradient(cx - dx / 2, cy - dy / 2, cx + dx / 2, cy + dy / 2);
    stops.forEach((c, i) => grad.addColorStop(i / (stops.length - 1), c));
    ctx.fillStyle = grad;
  } else {
    ctx.fillStyle = colors.bg;
  }
  ctx.fillRect(0, 0, W, height);

  if (colors.texture && colors.texture !== 'topography') {
    drawTexture(ctx, W * scale, height * scale, colors.texture);
  }

  if (colors.topoColor) {
    drawTopography(ctx, W, height, colors.topoColor, colors.bg);
  }

  if (colors.blobs) {
    drawBlobs(ctx, W, colors.blobs, colors.bg);
  }

  // ---- 标题色块（先画，标题文字叠在上面） ----
  const titleInfo = measureTitle(title);
  drawTitleBlock(ctx, colors, titleInfo);

  // ---- 标题文字 ----
  drawTitle(ctx, title, colors);

  // ---- 计算诗句实际位置 ----
  const poemTopBound = titleRegionH + (height - titleRegionH - contentH);  // = height - contentH
  const watermarkY = height - 70;
  const poemBottomLimit = watermarkY - lineHeight - footerH - authorH;

  // 诗：沉底；词：居中
  const poemStartY = genre === 'Shi'
    ? poemBottomLimit - poemTotalH
    : poemTopBound + prefaceH + (poemBottomLimit - poemTopBound - prefaceH - poemTotalH) / 2;

  // 元数据居中点：诗略右偏（比正文偏移量小，因为元数据无末尾标点），词用画布中心
  const metaCenterX = genre === 'Shi' ? W / 2 + fontSize * 0.2 : W / 2;

  // ---- 序言（紧贴诗句上方） ----
  if (preface) {
    const prefaceY = poemStartY - prefaceH;
    drawPreface(ctx, preface, colors, prefaceY, genre, metaCenterX, metaMaxW);
  }

  // ---- 诗句 ----
  drawPoemLines(ctx, lines, colors, fontSize, lineHeight, poemTopBound + prefaceH, poemBottomLimit, genre, data.titleLines);

  // ---- 日期 / 脚注（作品下方） ----
  if (date || footnote) {
    const footerY = poemBottomLimit + 20;
    drawFooter(ctx, date, footnote, colors, footerY, genre, metaCenterX, metaMaxW);
  }

  // ---- 署名（底部，格式 "- 署名 -"；诗居中，词左对齐） ----
  if (author) {
    const authorFontSize = 32;
    ctx.fillStyle = colors.muted;
    ctx.font = exportFont(400, authorFontSize);
    ctx.textBaseline = 'middle';
    if (genre === 'Ci') {
      ctx.textAlign = 'left';
      ctx.fillText(`${author} /`, PAD_X, watermarkY - 30);
    } else {
      ctx.textAlign = 'center';
      ctx.fillText(`- ${author} -`, W / 2, watermarkY - 30);
    }
  }

  // ---- 水印（右下角贴边，logo + 文字） ----
  const wmText = '方寸 · 诗词画布';
  const wmFontSize = 18;
  const logoSize = 22;
  const logoGap = 6;

  // 采样水印区域背景亮度，决定水印颜色
  const sampleData = ctx.getImageData(W - 200, height - 60, 170, 35).data;
  let brightness = 0;
  for (let i = 0; i < sampleData.length; i += 16) {
    brightness += sampleData[i] * 0.299 + sampleData[i + 1] * 0.587 + sampleData[i + 2] * 0.114;
  }
  brightness /= (sampleData.length / 16);
  const isDarkBg = brightness < 128;

  ctx.fillStyle = isDarkBg ? 'rgba(255,255,255,0.45)' : colors.muted;
  ctx.font = `${wmFontSize}px system-ui, -apple-system, "Helvetica Neue", sans-serif`;
  ctx.textBaseline = 'bottom';

  const textW = ctx.measureText(wmText).width;
  const hasLogo = !!data.logo;
  const totalWmW = hasLogo ? logoSize + logoGap + textW : textW;

  const wmX = W - 30 - totalWmW;
  const wmY = height - 25;

  if (hasLogo) {
    if (isDarkBg) ctx.filter = 'invert(1) hue-rotate(180deg)';
    ctx.drawImage(data.logo!, wmX, wmY - logoSize + 2, logoSize, logoSize);
    if (isDarkBg) ctx.filter = 'none';
  }
  ctx.textAlign = 'left';
  ctx.fillText(wmText, wmX + (hasLogo ? logoSize + logoGap : 0), wmY);

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
): { bottomY: number; leftX: number } {
  ctx.fillStyle = colors.titleText ?? colors.text;

  // 处理词牌 · 分隔符
  const dotIdx = title.search(/[·•·]/);
  const hasDot = dotIdx > 0;

  if (hasDot) {
    return drawCiTitle(ctx, title, dotIdx, colors);
  }

  const config = getTitleConfig(title.length);
  const titleX = W * 0.85;
  const startY = TITLE_PAD_TOP;

  ctx.font = exportFont(700, config.fontSize);
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
): { bottomY: number; leftX: number } {
  const cipai = title.slice(0, dotIdx);
  const subtitle = title.slice(dotIdx + 1);
  const config = getTitleConfig(Math.max(cipai.length, subtitle.length));

  const baseX = W * 0.85;
  const startY = TITLE_PAD_TOP;

  // 词牌名右列（大字）
  ctx.fillStyle = colors.titleText ?? colors.text;
  ctx.font = exportFont(700, config.fontSize);
  const cipaiResult = drawVerticalColumns(ctx, cipai, baseX, startY, config.fontSize, config.spacing);

  // 题目左列（略小）
  const subFontSize = Math.round(config.fontSize * 0.75);
  const subSpacing = Math.round(config.spacing * 0.78);
  ctx.font = exportFont(400, subFontSize);
  ctx.fillStyle = colors.titleText ?? colors.text;
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
function measureTitle(title: string): TitleMeasure {
  const dotIdx = title.search(/[·•·]/);
  const cipai = dotIdx > 0 ? title.slice(0, dotIdx) : title;
  // Ci 标题时 config 由 max(cipai, subtitle) 决定，与 drawCiTitle 一致
  const configKey = dotIdx > 0
    ? Math.max(cipai.length, title.slice(dotIdx + 1).length)
    : cipai.length;
  const config = getTitleConfig(configKey);

  const titleX = W * 0.85;
  const startY = TITLE_PAD_TOP;
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
  genre: 'Shi' | 'Ci' | 'Free',
  titleLines?: Set<number>,
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
  ctx.font = exportFont(400, fontSize);

  const letterSpacing = fontSize * 0.12;

  if (genre === 'Ci') {
    // 词：左对齐
    lines.forEach((line, i) => {
      const y = startY + i * actualLineH + actualLineH / 2;
      drawTextLeft(ctx, line, PAD_X, y, letterSpacing);
    });
  } else if (genre === 'Free') {
    // 自由诗：居中，逐行判断末尾标点决定偏移
    lines.forEach((line, i) => {
      if (!line) return;
      const y = startY + i * actualLineH + actualLineH / 2;
      const hasPunct = /[，。！？、；：""''…—]$/.test(line);
      const cx = hasPunct ? W / 2 + fontSize * 0.5 : W / 2;
      drawTextCentered(ctx, line, cx, y, letterSpacing);
    });
  } else {
    // 诗：居中，右移半字宽补偿末尾标点；小标题严格居中
    const centerX = W / 2 + fontSize * 0.5;
    lines.forEach((line, i) => {
      if (!line) return;
      const y = startY + i * actualLineH + actualLineH / 2;
      const cx = titleLines?.has(i) ? W / 2 : centerX;
      drawTextCentered(ctx, line, cx, y, letterSpacing);
    });
  }
}

// ============================================================================
// 下载
// ============================================================================

declare global {
  interface Window {
    AndroidBridge?: {
      saveImage(base64: string, fileName: string): void;
      saveFile?(content: string, fileName: string, mimeType: string): void;
    };
  }
}

export function downloadCanvas(canvas: HTMLCanvasElement, title: string, theme?: string): Promise<void> {
  const ts = Math.floor(Date.now() / 1000);
  const safe = (s: string) => s.replace(/[\\/:*?"<>|·\s]/g, '_');
  const fileName = `${safe(title || '诗')}_${safe(theme || '默认')}_${ts}.png`;

  // Android: 通过 JS Bridge 保存到相册
  if (window.AndroidBridge?.saveImage) {
    const base64 = canvas.toDataURL('image/png').replace(/^data:image\/png;base64,/, '');
    window.AndroidBridge.saveImage(base64, fileName);
    return Promise.resolve();
  }

  // Web: 触发浏览器下载
  return new Promise<void>((resolve) => {
    canvas.toBlob((blob) => {
      if (!blob) { resolve(); return; }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
      resolve();
    }, 'image/png');
  });
}
