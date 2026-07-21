// ============================================================================
// 诗词图片导出 — Canvas 绘制引擎
// ============================================================================

export type ThemeKey = '素白' | '朱砂' | '墨韵' | '竹青' | '藏蓝' | '烟紫' | '秋棠' | '霜灰' | '纸感' | '棉花糖' | '鱼肚白' | '极光' | '春水' | '暮山' | '星河' | '薄荷' | '大理石' | '晨暮' | '丹霞' | '碧落' | '苍翠' | '鎏金' | '西湖' | '金乌' | '烟雨' | '枯藤' | '青瓷' | '残雪' | '芭蕉' | '蝶梦' | '桃源' | '鹊桥' | '琉璃' | '草纸' | '白叶' | '卡纸' | '藕纸' | '青纹' | '樱花' | '墨荷' | '红梅' | '巴山' | '天净沙' | '烟柳';

export type AspectRatio = '3:4' | '9:16' | '9:18' | 'long';

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
  allowedRatios?: AspectRatio[];
  bgImage?: string;
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
  '草纸': { bg: '#F0EDE6', bgImage: '/bg/草纸.webp', allowedRatios: ['3:4', '9:16'], text: '#2C2C2C', accent: '#D8D0C4', muted: '#706860' },
  '白叶': { bg: '#F8F8F6', bgImage: '/bg/白叶.webp', allowedRatios: ['3:4', '9:16'], text: '#2C2C2C', accent: '#E0DDD6', muted: '#A0A098' },
  '卡纸': { bg: '#F5F0EA', bgImage: '/bg/卡纸.webp', allowedRatios: ['3:4', '9:16', '9:18'], text: '#3A3530', accent: '#DDD5CA', muted: '#A09888' },
  '藕纸': { bg: '#D8C8C0', bgImage: '/bg/藕纸.webp', allowedRatios: ['3:4', '9:16', '9:18'], text: '#4A3038', accent: '#C0A8A0', muted: '#907078' },
  '青纹': { bg: '#8FAEA8', bgImage: '/bg/青纹.webp', allowedRatios: ['3:4', '9:16', '9:18'], text: '#0A2020', accent: '#5A8880', muted: '#2A4A48' },
  '樱花': { bg: '#FDE8EE', bgImage: '/bg/樱花.webp', allowedRatios: ['3:4', '9:16'], text: '#5A2838', accent: '#E8B0C0', muted: '#8A5068' },
  '墨荷': { bg: '#F2EDE6', bgImage: '/bg/墨荷.webp', allowedRatios: ['3:4', '9:16'], text: '#2A2A28', accent: '#D0C8B8', muted: '#706858' },
  '红梅': { bg: '#F5F0EA', bgImage: '/bg/红梅.webp', allowedRatios: ['3:4', '9:16'], text: '#3A1818', accent: '#D8C0B0', muted: '#8A6050' },
  '巴山': { bg: '#D0D4D8', bgImage: '/bg/巴山.webp', allowedRatios: ['3:4', '9:16'], text: '#1E2A2A', accent: '#90A0A0', muted: '#3A4848' },
  '天净沙': { bg: '#EDE8E0', bgImage: '/bg/天净沙.webp', allowedRatios: ['3:4', '9:16'], text: '#2A2520', accent: '#C8BEB0', muted: '#6A5E50' },
  '烟柳': { bg: '#F0F0E8', bgImage: '/bg/烟柳.webp', allowedRatios: ['3:4', '9:16'], text: '#2A3028', accent: '#C8D0B8', muted: '#5A6850' },
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
  // ---- 图片背景 ----
  '草纸', '白叶', '卡纸', '藕纸', '青纹', '樱花', '墨荷', '红梅', '巴山', '天净沙', '烟柳',
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

/** 根据画布高度确定纵横比标签 */
export function resolveAspectRatio(minH: number): AspectRatio {
  const h = pickCanvasHeight(minH);
  if (h <= ASPECT_HEIGHTS[0]) return '3:4';
  if (h <= ASPECT_HEIGHTS[1]) return '9:16';
  if (h <= ASPECT_HEIGHTS[2]) return '9:18';
  return 'long';
}

/** 预计算内容所需最小高度（不含 canvas 对齐） */
export function computeMinHeight(data: ExportData): number {
  const { lines, charCount, genre, date, preface, footnote, author } = data;
  const maxLineLen = genre !== 'Shi' ? Math.max(...lines.map(l => [...l].length), 1) : 0;
  const { fontSize, lineHeight } =
    genre !== 'Shi' ? getCiFontConfig(lines.length, maxLineLen) : getShiFontConfig(charCount);

  let metaMaxW = META_MAX_W;
  if (genre === 'Shi') {
    const sentenceLen = charCount % 7 === 0 ? 7 : 5;
    const charsPerLine = sentenceLen * 2 + 2;
    const letterSpacing = fontSize * 0.12;
    metaMaxW = charsPerLine * fontSize + (charsPerLine - 1) * letterSpacing;
  }

  const measureCanvas = document.createElement('canvas');
  const measureCtx = measureCanvas.getContext('2d')!;
  const { prefaceH, footerH } = measureMetaHeight(measureCtx, { date, preface, footnote }, metaMaxW);

  const titleBlockH = measureTitleBlockHeight(data.title);
  const titleRegionH = TITLE_PAD_TOP + titleBlockH;
  const paraBreaks = data.align === 'justify' ? lines.filter(l => l === '').length : 0;
  const poemTotalH = lines.length * lineHeight - paraBreaks * lineHeight * 0.2;
  const authorH = author ? 40 : 0;
  const belowPoemPad = lineHeight + footerH + authorH + 70;
  const contentH = prefaceH + poemTotalH + belowPoemPad;
  const minGap = MIN_GAP + ((data.sectionCount ?? 1) > 1 || genre === 'Free' ? lineHeight * 2 : 0);
  return titleRegionH + minGap + contentH;
}

/** 筛选支持指定纵横比的主题 */
export function filterThemesByRatio(ratio: AspectRatio): ThemeKey[] {
  return THEME_KEYS.filter(k => {
    const t = THEMES[k];
    return !t.allowedRatios || t.allowedRatios.includes(ratio);
  });
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
const EXPORT_WATERMARK_TEXT = '方寸 · 诗词画布';
const FONT_CACHE_NAME = 'fangcun-fonts-v1';
const FONT_CACHE_PREFIX = '/__fangcun_font_cache__/';

let fontCache: Cache | null | undefined;

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

export interface FontLoadOptions {
  onProgress?: (loaded: number, total: number) => void;
  signal?: AbortSignal;
}

export type FontProgressCallback = (loaded: number, total: number) => void;

export interface FontLoadResult {
  failedChunks: number;
  aborted: boolean;
}

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
      const resp = await cachedFetch(`${f.cssDir}/result.css`, cssUrl);
      const css = await resp.text();
      const blocks = css.match(/@font-face\{[^}]+\}/g) || [];
      const matched = blocks.filter(b => matchesUnicodeRange(b, charCps));
      await Promise.all(matched.map(async (block) => {
        const urlMatch = block.match(/url\("\.\/([^"]+)"\)/);
        if (!urlMatch) return;
        const file = urlMatch[1];
        const resp = await cachedFetch(`${f.cssDir}/${file}`, fontFileUrl(f.cssDir, file));
        const unicodeRange = getUnicodeRange(block);
        const font = new FontFace(family, await resp.arrayBuffer(), {
          weight: '400',
          style: 'normal',
          ...(unicodeRange ? { unicodeRange } : {}),
        });
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

/** 提取 @font-face 的 unicode-range，注册 FontFace 时必须原样保留。 */
function getUnicodeRange(block: string): string | undefined {
  return block.match(/unicode-range:\s*([^;}]+)/)?.[1].trim();
}

/** 判断 @font-face 块的 unicode-range 是否命中任何文本字符 */
function matchesUnicodeRange(block: string, charCodepoints: Set<number>): boolean {
  const unicodeRange = getUnicodeRange(block);
  if (!unicodeRange) return true;
  const rangeCps = parseUnicodeRange(unicodeRange);
  for (const cp of charCodepoints) {
    if (rangeCps.has(cp)) return true;
  }
  return false;
}

async function getFontCache(): Promise<Cache | null> {
  if (fontCache !== undefined) return fontCache;
  if (typeof caches === 'undefined') {
    fontCache = null;
    return fontCache;
  }
  try {
    fontCache = await caches.open(FONT_CACHE_NAME);
  } catch {
    fontCache = null;
  }
  return fontCache;
}

async function cachedFetch(canonicalKey: string, signedUrl: string, signal?: AbortSignal): Promise<Response> {
  const cache = await getFontCache();
  const cacheKey = `${FONT_CACHE_PREFIX}${encodeURIComponent(canonicalKey)}`;

  if (cache) {
    try {
      const hit = await cache.match(cacheKey);
      if (hit) return hit;
    } catch {
      // 某些隐私模式下 caches.open 可成功，但 match 仍会被禁用；
      // 忽略缓存错误，继续走普通 fetch。
    }
  }

  const response = await fetch(signedUrl, signal ? { signal } : undefined);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  if (cache) {
    try {
      const cacheResponse = new Response(await response.clone().arrayBuffer(), {
        headers: { 'Content-Type': response.headers.get('Content-Type') || 'application/octet-stream' },
      });
      await cache.put(cacheKey, cacheResponse);
    } catch {
      // 缓存失败不应阻断本次资源加载。
    }
  }
  return response;
}

async function mapWithConcurrency<T>(
  items: T[],
  worker: (item: T) => Promise<void>,
  concurrency: number,
  signal?: AbortSignal,
): Promise<PromiseSettledResult<void>[]> {
  const results: PromiseSettledResult<void>[] = [];
  let nextIndex = 0;

  async function runWorker() {
    while (!signal?.aborted) {
      const index = nextIndex++;
      if (index >= items.length) return;
      try {
        await worker(items[index]);
        results[index] = { status: 'fulfilled', value: undefined };
      } catch (reason) {
        results[index] = { status: 'rejected', reason };
      }
    }
  }

  const workerCount = Math.min(Math.max(concurrency, 1), items.length);
  await Promise.all(Array.from({ length: workerCount }, () => runWorker()));
  return results;
}

let _fontsLoaded = false;
let _loadedFontKey: FontKey | null = null;
let _loadedFontTextKey = '';

/** 构造字体文件 URL（CDN 签名 或 本地路径） */
function fontFileUrl(dir: string, file: string): string {
  if (FONT_CDN_BASE && FONT_CDN_KEY) {
    const url = `${FONT_CDN_BASE}/${encodeURIComponent(dir)}/${file}`;
    // 签名 URL 有效期有限；Cache API 使用 canonicalKey 做缓存索引，
    // 每次缓存未命中时重新签名，避免长驻页面复用过期签名。
    return signCdnUrl(url, FONT_CDN_KEY, 3600);
  }
  return `/fonts/${dir}/${file}`;
}

/** 构造 CDN 资源 URL（背景图等） */
function cdnAssetUrl(path: string): string | null {
  if (!FONT_CDN_BASE || !FONT_CDN_KEY) return null;
  const url = `${FONT_CDN_BASE}${path}`;
  return signCdnUrl(url, FONT_CDN_KEY, 3600);
}

/** 加载背景图片 */
export function loadBgImage(path: string, signal?: AbortSignal): Promise<HTMLImageElement | null> {
  const url = cdnAssetUrl(path);
  if (!url) return Promise.resolve(null);
  return new Promise(resolve => {
    if (signal?.aborted) { resolve(null); return; }
    const img = new Image();
    let settled = false;
    const finish = (value: HTMLImageElement | null) => {
      if (settled) return;
      settled = true;
      signal?.removeEventListener('abort', onAbort);
      resolve(value);
    };
    const onAbort = () => {
      img.onload = null;
      img.onerror = null;
      img.src = '';
      finish(null);
    };
    signal?.addEventListener('abort', onAbort, { once: true });
    img.crossOrigin = 'anonymous';
    img.onload = () => finish(img);
    img.onerror = () => finish(null);
    img.src = url;
  });
}

/** 构造字体 CSS URL */
function fontCssUrl(dir: string): string {
  return fontFileUrl(dir, 'result.css');
}

export async function loadExportFonts(
  text: string,
  fontKey: FontKey = DEFAULT_FONT,
  options: FontLoadOptions | FontProgressCallback = {},
  signalArg?: AbortSignal,
): Promise<FontLoadResult> {
  // 同时兼容导出模块早期的 (onProgress, signal) 调用形式，
  // 新代码可使用更明确的 { onProgress, signal } options 对象。
  const onProgress = typeof options === 'function' ? options : options.onProgress;
  const signal = signalArg ?? (typeof options === 'function' ? undefined : options.signal);
  if (signal?.aborted) return { failedChunks: 0, aborted: true };

  // 标题是竖排绘制的，标点会转换成另一组 Unicode 码点；按实际绘制字符
  // 计算 fetch 集合，避免标题的竖排标点漏掉对应的字体切片。
  const renderText = `${text}${EXPORT_WATERMARK_TEXT}`;
  const fontText = `${renderText}${[...renderText].map(toVerticalChar).join('')}`;
  const fontTextKey = [...new Set([...fontText])]
    .map(ch => ch.codePointAt(0)!)
    .sort((a, b) => a - b)
    .join(',');

  // 同一字体且字符集合未变化时才跳过；切换画板/标题时需要补抓新切片。
  if (_fontsLoaded && _loadedFontKey === fontKey && _loadedFontTextKey === fontTextKey) {
    onProgress?.(0, 0);
    return { failedChunks: 0, aborted: false };
  }

  // 切换字体时清除旧 FontFace
  if (_loadedFontKey !== fontKey) {
    // FontFaceSet 在遍历期间修改可能跳过相邻条目（尤其是 400/700 两个字重），
    // 先快照再删除，确保标题和正文的旧字体都被清理。
    Array.from(document.fonts)
      .filter(f => f.family === EXPORT_FONT_FAMILY)
      .forEach(f => document.fonts.delete(f));
    _fontsLoaded = false;
    _loadedFontTextKey = '';
  }

  const charCps = new Set([...fontText].map(ch => ch.codePointAt(0)!));
  const option = FONT_OPTIONS.find(o => o.key === fontKey) ?? FONT_OPTIONS[0];
  const dirs = [option.cssDir];
  if (option.boldDir) dirs.push(option.boldDir);

  let failedChunks = 0;
  try {
    const sources: { dir: string; weight: string; blocks: string[] }[] = [];
    for (const dir of dirs) {
      if (signal?.aborted) return { failedChunks, aborted: true };
      const cssUrl = fontCssUrl(dir);
      const resp = await cachedFetch(`${dir}/result.css`, cssUrl, signal);
      const css = await resp.text();
      const blocks = css.match(/@font-face\{[^}]+\}/g) || [];
      const weight = dir === option.boldDir ? '700' : '400';
      const matched = blocks.filter(block => matchesUnicodeRange(block, charCps));
      sources.push({ dir, weight, blocks: matched });
    }

    const totalChunks = sources.reduce((total, source) => total + source.blocks.length, 0);
    const completedChunks = new Set<string>();
    onProgress?.(0, totalChunks);

    for (const source of sources) {
      if (signal?.aborted) return { failedChunks, aborted: true };

      const loadChunk = async (block: string) => {
        const urlMatch = block.match(/url\("\.\/([^"]+)"\)/);
        if (!urlMatch) return;
        const file = urlMatch[1];
        const canonicalKey = `${source.dir}/${file}`;
        const response = await cachedFetch(canonicalKey, fontFileUrl(source.dir, file), signal);
        const fontData = await response.arrayBuffer();
        if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
        const unicodeRange = getUnicodeRange(block);
        const font = new FontFace(EXPORT_FONT_FAMILY, fontData, {
          weight: source.weight,
          style: 'normal',
          ...(unicodeRange ? { unicodeRange } : {}),
        });
        const loaded = await font.load();
        // FontFace.load() 本身不支持 AbortSignal；在写入全局 FontFaceSet
        // 前再次检查，防止已取消的旧请求污染最新请求的字体集合。
        if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
        document.fonts.add(loaded);
        if (!completedChunks.has(canonicalKey)) {
          completedChunks.add(canonicalKey);
          onProgress?.(completedChunks.size, totalChunks);
        }
      };

      const results = await mapWithConcurrency(source.blocks, loadChunk, 4, signal);
      if (signal?.aborted) return { failedChunks, aborted: true };
      const failedBlocks = source.blocks.filter((_, index) => results[index]?.status === 'rejected');
      if (failedBlocks.length > 0) {
        console.warn(`[Font] retrying ${failedBlocks.length} failed chunks...`);
        const retryResults = await mapWithConcurrency(failedBlocks, loadChunk, 2, signal);
        if (signal?.aborted) return { failedChunks, aborted: true };
        const stillFailed = retryResults.filter(result => result.status === 'rejected').length;
        failedChunks += stillFailed;
        if (stillFailed) console.warn(`[Font] ${stillFailed} chunks still failed after retry`);
      }
    }
    if (signal?.aborted) return { failedChunks, aborted: true };
    _fontsLoaded = true;
    _loadedFontKey = fontKey;
    _loadedFontTextKey = fontTextKey;
    return { failedChunks, aborted: false };
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') {
      return { failedChunks, aborted: true };
    }
    console.error('[Font] load error:', e);
    _fontsLoaded = false;
    _loadedFontTextKey = '';
    return { failedChunks: Math.max(failedChunks, 1), aborted: false };
  }
}

function exportFont(weight: number, size: number): string {
  const family = _fontsLoaded
    ? `"${EXPORT_FONT_FAMILY}"`
    : '"Source Han Serif SC", "SimSun", "STSong", serif';
  // 没有独立 700 face 时保留 700 请求，让浏览器基于已注册的 400 face
  // 合成粗体；每个切片的 unicode-range 已保留，不再因切片竞争而 fallback。
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


// 横排标点 → 竖排标点映射（用于标题竖排绘制）
const VERTICAL_PUNCT: Record<string, string> = {
  '，': '︐', '。': '︒', '？': '︖', '！': '︕',
  '、': '︑', '：': '︓', '；': '︔',
  '（': '︵', '）': '︶', '〔': '︹', '〕': '︺',
  '《': '︽', '》': '︾', '〈': '︿', '〉': '﹀',
  '「': '﹁', '」': '﹂', '『': '﹃', '』': '﹄',
  '【': '︻', '】': '︼', '〖': '︗', '〗': '︘',
  '—': '︱', '…': '︙',
  '\u201c': '﹃', '\u201d': '﹄', '\u2018': '﹁', '\u2019': '﹂',
};

function toVerticalChar(ch: string): string {
  return VERTICAL_PUNCT[ch] ?? ch;
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
    ctx.fillText(toVerticalChar(ch), x, startY + i * spacing);
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
  align?: TextAlign,
) {
  ctx.fillStyle = colors.muted;
  ctx.font = exportFont(400, META_PREFACE_FONT);
  const spacing = META_PREFACE_FONT * 0.08;
  const lines = wrapText(ctx, text, maxW, spacing);
  // 诗：始终居中（与正文对齐）；词/自由诗：跟随对齐方式
  const centered = genre === 'Shi' || (genre === 'Free' && (!align || align === 'center'));
  const metaShift = genre === 'Shi' ? META_FOOTER_FONT * 0.333 : 0;

  lines.forEach((line, i) => {
    const y = startY + i * META_PREFACE_LH + META_PREFACE_LH / 2;
    if (centered) {
      drawTextCentered(ctx, line, centerX - metaShift, y, spacing);
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
  align?: TextAlign,
) {
  ctx.fillStyle = colors.muted;
  ctx.font = exportFont(400, META_FOOTER_FONT);
  const spacing = META_FOOTER_FONT * 0.08;
  let y = startY;

  // 脚注（在日期上方）
  if (footnote) {
    const lines = wrapText(ctx, footnote, maxW, spacing);
    // 诗：始终居中（与正文对齐）；词/自由诗：跟随对齐方式
    const centered = genre === 'Shi' || (genre === 'Free' && (!align || align === 'center'));
    const metaShift = genre === 'Shi' ? META_FOOTER_FONT * 0.333 : 0;
    lines.forEach((line, i) => {
      const lineY = y + i * META_FOOTER_LH + META_FOOTER_LH / 2;
      if (centered) {
        drawTextCentered(ctx, line, centerX - metaShift, lineY, spacing);
      } else {
        drawTextLeft(ctx, line, PAD_X, lineY, spacing);
      }
    });
    y += lines.length * META_FOOTER_LH;
  }

  // 日期（跟随对齐方式）
  if (date) {
    const lineY = y + META_FOOTER_LH / 2;
    const dateCentered = genre === 'Shi' || (genre === 'Free' && (!align || align === 'center'));
    const metaShift = genre === 'Shi' ? META_FOOTER_FONT * 0.333 : 0;
    if (dateCentered) {
      drawTextCentered(ctx, date, centerX - metaShift, lineY, spacing);
    } else {
      drawTextLeft(ctx, date, PAD_X, lineY, spacing);
    }
  }
}

// ============================================================================
// 主绘制
// ============================================================================

export type TextAlign = 'left' | 'center' | 'right' | 'justify';

export interface ExportData {
  title: string;
  lines: string[];
  charCount: number;
  genre: 'Shi' | 'Ci' | 'Free' | 'Free';
  theme: ThemeKey;
  fontKey?: FontKey;
  logo?: HTMLImageElement | null;
  bgImg?: HTMLImageElement | null;
  date?: string;
  preface?: string;
  footnote?: string;
  author?: string;
  sectionCount?: number;
  titleLines?: Set<number>;
  metaLines?: Set<number>;
  align?: TextAlign;
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
  const paraBreaks = data.align === 'justify' ? lines.filter(l => l === '').length : 0;
  const poemTotalH = lines.length * lineHeight - paraBreaks * lineHeight * 0.2;
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

  // ---- 背景图（CDN，cover 模式） ----
  if (data.bgImg) {
    const img = data.bgImg;
    const imgRatio = img.naturalWidth / img.naturalHeight;
    const canvasRatio = W / height;
    let sx = 0, sy = 0, sw = img.naturalWidth, sh = img.naturalHeight;
    if (imgRatio > canvasRatio) {
      sw = img.naturalHeight * canvasRatio;
      sx = (img.naturalWidth - sw) / 2;
    } else {
      sh = img.naturalWidth / canvasRatio;
      sy = (img.naturalHeight - sh) / 2;
    }
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, W, height);
  }

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
  const poemBottomLimit = watermarkY - 20 - footerH - authorH - lineHeight;

  // 诗：沉底；词：居中
  const poemStartY = genre === 'Shi'
    ? poemBottomLimit - poemTotalH
    : poemTopBound + prefaceH + (poemBottomLimit - poemTopBound - prefaceH - poemTotalH) / 2;

  // 元数据居中点：诗略右偏（比正文偏移量小，因为元数据无末尾标点），词用画布中心
  const metaCenterX = genre === 'Shi' ? W / 2 + fontSize * 0.2 : W / 2;

  // ---- 序言（紧贴诗句上方） ----
  if (preface) {
    const prefaceY = poemStartY - prefaceH;
    drawPreface(ctx, preface, colors, prefaceY, genre, metaCenterX, metaMaxW, data.align);
  }

  // ---- 诗句 ----
  drawPoemLines(ctx, lines, colors, fontSize, lineHeight, poemTopBound + prefaceH, poemBottomLimit, genre, data.titleLines, data.align, data.metaLines);

  // ---- 署名（底部，格式 "- 署名 -"；诗居中，词左对齐） ----
  const authorY = watermarkY - 30;
  if (author) {
    const authorFontSize = 32;
    ctx.fillStyle = colors.muted;
    ctx.font = exportFont(400, authorFontSize);
    ctx.textBaseline = 'middle';
    const a = data.align;
    if (genre === 'Ci' || a === 'left' || a === 'justify') {
      ctx.textAlign = 'left';
      ctx.fillText(`${author} /`, PAD_X, authorY);
    } else if (a === 'right') {
      ctx.textAlign = 'right';
      ctx.fillText(`/ ${author}`, W - PAD_X, authorY);
    } else {
      ctx.textAlign = 'center';
      ctx.fillText(`- ${author} -`, W / 2, authorY);
    }
  }

  // ---- 日期 / 脚注（紧贴署名上方） ----
  if (date || footnote) {
    const footerBottom = authorY - (author ? 20 : 10);
    const footerY = footerBottom - footerH;
    drawFooter(ctx, date, footnote, colors, footerY, genre, metaCenterX, metaMaxW, data.align);
  }

  // ---- 水印（右下角贴边，logo + 文字） ----
  const wmText = EXPORT_WATERMARK_TEXT;
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
  ctx.font = exportFont(400, wmFontSize);
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

function drawTextRight(
  ctx: CanvasRenderingContext2D,
  text: string,
  rightX: number,
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

  let curX = rightX - totalW;
  for (let i = 0; i < chars.length; i++) {
    ctx.fillText(chars[i], curX, y);
    curX += widths[i] + spacing;
  }
}

function drawTextJustified(
  ctx: CanvasRenderingContext2D,
  text: string,
  leftX: number,
  rightX: number,
  y: number,
) {
  const chars = [...text];
  if (chars.length <= 1) {
    drawTextLeft(ctx, text, leftX, y, 0);
    return;
  }

  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';

  let totalCharW = 0;
  const widths = chars.map((ch) => {
    const w = ctx.measureText(ch).width;
    totalCharW += w;
    return w;
  });
  const gap = (rightX - leftX - totalCharW) / (chars.length - 1);

  let curX = leftX;
  for (let i = 0; i < chars.length; i++) {
    ctx.fillText(chars[i], curX, y);
    curX += widths[i] + gap;
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
  align?: TextAlign,
  metaLines?: Set<number>,
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
    const a = align ?? 'center';
    const rightX = W - PAD_X;
    // For justify: accumulate extra offset at paragraph breaks (empty lines)
    let paraOffset = 0;
    lines.forEach((line, i) => {
      if (!line) {
        if (a === 'justify') paraOffset -= actualLineH * 0.2;
        return;
      }
      const y = startY + i * actualLineH + paraOffset + actualLineH / 2;
      if (a === 'left') {
        drawTextLeft(ctx, line, PAD_X, y, letterSpacing);
      } else if (a === 'right') {
        drawTextRight(ctx, line, rightX, y, letterSpacing);
      } else if (a === 'justify') {
        const isLastOfPara = [...line].length < 20 || i === lines.length - 1 || lines[i + 1] === '';
        if (isLastOfPara) {
          drawTextLeft(ctx, line, PAD_X, y, letterSpacing);
        } else {
          drawTextJustified(ctx, line, PAD_X, rightX, y);
        }
      } else {
        const hasPunct = /[，。！？、；：""''…—]$/.test(line);
        const cx = hasPunct ? W / 2 + fontSize * 0.5 : W / 2;
        drawTextCentered(ctx, line, cx, y, letterSpacing);
      }
    });
  } else {
    // 诗：居中，右移半字宽补偿末尾标点；小标题严格居中
    const centerX = W / 2 + fontSize * 0.5;
    lines.forEach((line, i) => {
      if (!line) return;
      const y = startY + i * actualLineH + actualLineH / 2;
      if (metaLines?.has(i)) {
        ctx.fillStyle = colors.muted;
        ctx.font = exportFont(400, fontSize * 0.75);
        drawTextCentered(ctx, line, W / 2, y, fontSize * 0.75 * 0.08);
        ctx.fillStyle = colors.text;
        ctx.font = exportFont(400, fontSize);
      } else {
        const cx = titleLines?.has(i) ? W / 2 : centerX;
        drawTextCentered(ctx, line, cx, y, letterSpacing);
      }
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

export function copyCanvasToClipboard(canvas: HTMLCanvasElement): Promise<void> {
  if (typeof ClipboardItem === 'undefined' || typeof navigator.clipboard?.write !== 'function') {
    return Promise.reject(new Error('image clipboard is not supported'));
  }

  return new Promise<void>((resolve, reject) => {
    canvas.toBlob(async (blob) => {
      if (!blob) {
        reject(new Error('failed to encode image'));
        return;
      }
      try {
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': blob }),
        ]);
        resolve();
      } catch (error) {
        reject(error);
      }
    }, 'image/png');
  });
}
