/**
 * 字体切片脚本
 * 输入: fonts/src/ 下的 TTF/OTF 文件
 * 输出: frontend/public/fonts/{fontName}/ 下的 woff2 chunks + CSS
 *
 * 用法: node fonts/split.mjs
 */
import { fontSplit } from 'cn-font-split';
import { readdirSync, rmSync, existsSync } from 'fs';
import { basename, join, extname } from 'path';

const SRC_DIR = 'fonts/src';
const OUT_DIR = 'frontend/public/fonts';

const fonts = readdirSync(SRC_DIR).filter(f => /\.(ttf|otf)$/i.test(f));

if (fonts.length === 0) {
  console.error('未找到字体文件，请将 TTF/OTF 放入 fonts/src/');
  process.exit(1);
}

for (const font of fonts) {
  const name = basename(font, extname(font));
  const destDir = join(OUT_DIR, name);

  // 清理旧产物
  if (existsSync(destDir)) {
    rmSync(destDir, { recursive: true });
  }

  console.log(`→ 正在切片: ${font}`);

  await fontSplit({
    input: join(SRC_DIR, font),
    outDir: destDir,
    targetType: 'woff2',
    chunkSize: 70 * 1024,
    css: { fontFamily: name },
  });

  console.log(`✓ ${name}: 切片完成 → ${destDir}`);
}

console.log(`\n全部完成，共处理 ${fonts.length} 个字体`);
