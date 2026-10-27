// 内存打包真实解析器和上传组件，以假 submit 验证标题及最终 payload；不发网络请求。
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const srcDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src');
const mocks = {
  react: `export const useState = init => [typeof init === 'function' ? init() : init, () => {}];`,
  'react/jsx-runtime': `export const jsx = (type, props) => ({type, props}); export const jsxs = jsx;`,
  'lucide-react': `export const X='X', Loader='Loader', Check='Check', AlertCircle='AlertCircle';`,
  '../context/BoardContext': `
    export const useActiveBoard = () => globalThis.sequenceTitleTestBoard;
    export const useBoardContext = () => ({state: {validations: []}});
  `,
  '../lib/api': `
    export const track = () => {};
    export const submitPoem = async data => {
      globalThis.sequenceTitleTestCalls.push(JSON.parse(JSON.stringify(data)));
      return {ok: true, uuid: 'uuid-' + globalThis.sequenceTitleTestCalls.length};
    };
  `,
};
const result = await build({
  stdin: {
    contents: `export * from './lib/sequenceTitle'; export { UploadModal } from './components/UploadModal';`,
    resolveDir: srcDir,
    loader: 'ts',
  },
  bundle: true, format: 'esm', platform: 'node', jsx: 'automatic', write: false,
  plugins: [{ name: 'upload-mocks', setup(b) {
    b.onResolve({ filter: /.*/ }, args => args.path in mocks
      ? { path: args.path, namespace: 'mock' } : undefined);
    b.onLoad({ filter: /.*/, namespace: 'mock' }, args => ({ contents: mocks[args.path], loader: 'js' }));
  } }],
});
const { formatSequenceTitle, parseSequenceTitle, chineseNumeralValue, chineseNumberLabel, hasSequenceOrdinal, UploadModal } =
  await import('data:text/javascript;base64,' + Buffer.from(result.outputFiles[0].text).toString('base64'));
let checks = 0;
const equal = (actual, expected, label) => { assert.deepEqual(actual, expected, label); checks++; };

// 用户给出的八个用例。
const cases = [
  ['登楼', 'space', '秋兴 其二 登楼'],
  ['其二 登楼', 'space', '秋兴 其二 登楼'],
  ['登楼', 'paren', '秋兴（其二）登楼'],
  ['其二 登楼', 'paren', '秋兴（其二 登楼）'],
  [null, 'space', '秋兴 其二'],
  ['其二', 'space', '秋兴 其二'],
  [null, 'paren', '秋兴（其二）'],
  ['其二', 'paren', '秋兴（其二）'],
];
for (const [sub, style, expected] of cases) {
  equal(formatSequenceTitle('秋兴', sub, 2, style), expected, `连缀 ${style}: ${sub}`);
}

// 与南洋吟游的解析示例对齐。
for (const [title, base, ordinal, subtitle] of [
  ['秋兴八首（其一）', '秋兴八首', 1, ''],
  ['秋兴八首(其十一)', '秋兴八首', 11, ''],
  ['山中 一 访友', '山中', 1, '访友'],
  ['感怀 其二', '感怀', 2, ''],
  ['感怀（其二）夜坐', '感怀', 2, '夜坐'],
  ['咏怀古迹五首③：绯木村', '咏怀古迹五首', 3, '绯木村'],
  ['南京游记 肆（牛首山', '南京游记', 4, '牛首山'],
  ['aaa（其④）', 'aaa', 4, ''],
  ['aaa 壹', 'aaa', 1, ''],
  ['aaa 其肆 访友', 'aaa', 4, '访友'],
  ['aaa（其廿）', 'aaa', 20, ''],
  ['aaa（廿一）', 'aaa', 21, ''],
  ['aaa 其卅', 'aaa', 30, ''],
]) {
  equal(parseSequenceTitle(title), { base, ordinal, subtitle, matched: true }, title);
}
for (const title of ['无题', '秋兴八首', '二十世纪', 'aaa 二十首', 'aaa（序）']) {
  equal(parseSequenceTitle(title).matched, false, `不误识别 ${title}`);
}
for (const sub of ['一', '二 登楼', '其廿三 夜坐', '卅', '肆', '其肆 访友', '②', '㉟', '③：登楼', '（其二）登楼']) {
  equal(hasSequenceOrdinal(sub), true, `已有序数 ${sub}`);
  equal(formatSequenceTitle('秋兴', sub, 2, 'space'), `秋兴 ${sub}`, `保留原文 ${sub}`);
}
for (const sub of ['', '  ', '登楼', '一夜登楼', '二十世纪', '其余', '零', '十十', '①②']) {
  equal(hasSequenceOrdinal(sub), false, `不误识别小标题 ${sub}`);
}
for (const [text, value] of [['其十', 10], ['肆', 4], ['⑳', 20], ['壹拾贰', 12], ['廿三', 23], ['卅', 30], ['一百零二', 102], ['十十', 0], ['零', 0]]) {
  equal(chineseNumeralValue(text), value, text);
}
for (const [number, text] of [[10, '十'], [11, '十一'], [21, '二十一'], [102, '一百零二'], [1001, '一千零一']]) {
  equal(chineseNumberLabel(number), text, String(number));
}
equal(formatSequenceTitle(' 秋兴 ', ' 登楼 ', 11, 'space'), '秋兴 其十一 登楼', '清理空白及第十一首');
equal(formatSequenceTitle('秋兴', '其三 登楼', 2, 'paren'), '秋兴（其三 登楼）', '已有序数不重编号');

// 实际点击上传组件，检查标题没有在组装 payload 时被绕过，序列关系也保持正确。
function findUpload(node) {
  if (!node || typeof node !== 'object') return;
  if (node.type === 'button' && node.props.onClick && /^上传 \d+ 首$/.test(node.props.children)) return node;
  for (const child of [node.props?.children].flat(Infinity)) {
    const found = findUpload(child);
    if (found) return found;
  }
}
async function upload(title, subtitles, style) {
  globalThis.localStorage = {
    getItem: key => ({ fangcun_sk: 'dummy-test-key', fangcun_seq_style: style })[key] ?? null,
    setItem: () => {},
  };
  globalThis.sequenceTitleTestCalls = [];
  globalThis.sequenceTitleTestBoard = {
    title, genre: 'Shi', metadata: { author: '示例作者', date: '2026-10-27', dateFormat: 'Gregorian' },
    sections: subtitles.map(title => ({ title, charCount: 20, poemChars: [...'白日依山尽黄河入海流欲穷千里目更上一层楼'] })),
  };
  const tree = UploadModal({ onClose: () => {} });
  await findUpload(tree).props.onClick();
  return globalThis.sequenceTitleTestCalls;
}
for (const [sub, style, expected] of cases) {
  const calls = await upload('秋兴', ['', sub ?? ''], style);
  equal(calls[1].title, expected, `真实 payload ${style}: ${sub}`);
  equal(calls[1].relations, [{ id: 'uuid-1', type: 'sequence' }], '关系链');
}
equal((await upload('新建·五言绝句', ['', ''], 'space')).map(p => p.title),
  ['新建·五言绝句 其一', '新建·五言绝句 其二'], '默认标题');
equal((await upload('秋兴', ['登楼'], 'paren'))[0].title, '秋兴', '单首标题');
equal((await upload('秋兴', Array(11).fill(''), 'space'))[10].title, '秋兴 其十一', '第十一首 payload');
console.log(`组诗标题：${checks} 项检查通过（含真实上传组件 payload，未发网络请求）`);
