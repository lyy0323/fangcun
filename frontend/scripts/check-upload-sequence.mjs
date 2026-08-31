// ============================================================================
// 组诗上传序列 回归检查（停止 + 断点续传）
//
// 用法：node scripts/check-upload-sequence.mjs （或 npm run check:upload）
//
// 用 esbuild 在内存打包真实生产代码（lib/uploadSequence.ts），注入假 submit
// 函数验证：
//   - 一首失败（网络/超时/服务端拒绝）→ 立即停止，后续不发起请求
//   - 序列链 relations.sequence 按上传顺序正确指向上一首 uuid
//   - 断点续传：已成功条目跳过，从首个失败处继续，链延续到新结果
// ============================================================================
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const srcDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src');

const result = await build({
  stdin: {
    contents: `export { runUploadSequence } from '${srcDir}/lib/uploadSequence.ts';`,
    resolveDir: srcDir,
    loader: 'ts',
  },
  bundle: true,
  format: 'esm',
  platform: 'node',
  write: false,
});
const { runUploadSequence } = await import(
  'data:text/javascript;base64,' + Buffer.from(result.outputFiles[0].text).toString('base64')
);

let pass = 0, fail = 0;
const check = (name, cond, detail) => {
  if (cond) { pass++; }
  else { fail++; console.log(`FAIL  ${name}${detail ? '\n      ' + detail : ''}`); }
};

const mkItems = (n) => Array.from({ length: n }, (_, i) => ({
  author: '作者', title: `第${i + 1}首`, content: `内容${i}`, date: '2026.6.15', type: '诗',
}));

// T1 全部成功：链按序指向上一首 uuid，首首无 relations
{
  const calls = [];
  const submit = async (data) => { calls.push(data); return { ok: true, uuid: `u${calls.length - 1}` }; };
  const { results, stopped } = await runUploadSequence(mkItems(3), 'key', submit, [null, null, null]);
  check('T1 全部成功', results.every(r => r?.ok) && !stopped, JSON.stringify(results));
  check('T1 首首无 relations', calls[0].relations === undefined, JSON.stringify(calls[0]));
  check('T1 第2首链到第1首', calls[1].relations?.[0]?.id === 'u0' && calls[1].relations?.[0]?.type === 'sequence', JSON.stringify(calls[1].relations));
  check('T1 第3首链到第2首', calls[2].relations?.[0]?.id === 'u1', JSON.stringify(calls[2].relations));
}

// T2 第2首网络失败 → 立即停止，第3首不发起请求
{
  const calls = [];
  let n = 0;
  const submit = async (data) => { calls.push(data); n++; return n === 2 ? { ok: false, error: '网络错误：fetch failed' } : { ok: true, uuid: `u${n}` }; };
  const { results, stopped } = await runUploadSequence(mkItems(3), 'key', submit, [null, null, null]);
  check('T2 停止', stopped);
  check('T2 第1首成功', results[0]?.ok === true);
  check('T2 第2首失败', results[1]?.ok === false && results[1]?.error?.includes('网络错误'), JSON.stringify(results[1]));
  check('T2 第3首未尝试', results[2] === null);
  check('T2 只发 2 个请求', calls.length === 2, `got ${calls.length}`);
}

// T3 断点续传：prev=[ok, fail, null] → 只重试第2首，成功后继续第3首，链延续
{
  const prev = [{ ok: true, uuid: 'u0' }, { ok: false, error: '网络错误：x' }, null];
  const calls = [];
  let n = 0;
  const submit = async (data) => { calls.push(data); n++; return { ok: true, uuid: `retry${n}` }; };
  const { results, stopped } = await runUploadSequence(mkItems(3), 'key', submit, prev);
  check('T3 续传全部成功', results.every(r => r?.ok) && !stopped, JSON.stringify(results));
  check('T3 已成功未被重传', results[0]?.uuid === 'u0');
  check('T3 只发 2 个请求', calls.length === 2, `got ${calls.length}`);
  check('T3 重试第2首带链到第1首', calls[0].relations?.[0]?.id === 'u0', JSON.stringify(calls[0].relations));
  check('T3 第3首链到重试结果', calls[1].relations?.[0]?.id === 'retry1', JSON.stringify(calls[1].relations));
}

// T4 首首失败 → 全部停止，不传任何后续
{
  const calls = [];
  const submit = async () => { calls.push(1); return { ok: false, error: '服务端拒绝' }; };
  const { results, stopped } = await runUploadSequence(mkItems(3), 'key', submit, [null, null, null]);
  check('T4 首首失败停止', stopped && calls.length === 1 && results[1] === null && results[2] === null, JSON.stringify(results));
}

// T5 服务端拒绝（HTTP 400）同样立即停止
{
  let n = 0;
  const submit = async () => { n++; return n === 2 ? { ok: false, error: 'HTTP 400' } : { ok: true, uuid: `u${n}` }; };
  const { results, stopped } = await runUploadSequence(mkItems(3), 'key', submit, [null, null, null]);
  check('T5 服务端拒绝停止', stopped && results[1]?.error === 'HTTP 400' && results[2] === null, JSON.stringify(results));
}

// T6 超时结果（submitPoem 超时文案）停止 + onProgress 回调触发
{
  let n = 0;
  const progress = [];
  const submit = async () => { n++; return n === 2 ? { ok: false, error: '网络超时，请检查网络后重试' } : { ok: true, uuid: `u${n}` }; };
  const { results, stopped } = await runUploadSequence(mkItems(3), 'key', submit, [null, null, null], (r) => progress.push(JSON.stringify(r)));
  check('T6 超时停止', stopped && results[1]?.error?.includes('网络超时') && results[2] === null, JSON.stringify(results));
  check('T6 onProgress 触发', progress.length >= 2, `got ${progress.length}`);
}

console.log(`\n==== ${pass} passed, ${fail} failed ====`);
process.exit(fail > 0 ? 1 : 0);
