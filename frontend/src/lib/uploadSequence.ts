// ============================================================================
// 组诗上传序列：一首失败立即停止，断点处可重试/继续
// 从 UploadModal.handleUpload 抽出为纯函数（可注入 submit 以便单测）。
//
// 语义：
//   - 逐首上传，前一成功返回的 uuid 作为后一首的 relations.sequence
//   - 任意一首失败（网络/超时/服务端拒绝）→ 立即停止，后续不发起请求
//   - 已有成功结果的条目跳过（断点续传：再次运行时从首个失败处继续）
// ============================================================================
import type { SubmitData, SubmitResult } from './api';

export type SubmitFn = (data: SubmitData, apiKey: string) => Promise<SubmitResult>;

export interface UploadRunOutcome {
  /** 每首的最终结果；未尝试的保持 null */
  results: (SubmitResult | null)[];
  /** 是否因某首失败而提前停止 */
  stopped: boolean;
}

/**
 * @param items      每首要上传的内容（不含 relations，runner 按序自动补链）
 * @param apiKey     API Key
 * @param submit     实际上传函数（默认 submitPoem 语义：不抛异常，返回 {ok, uuid?, error?}）
 * @param prevResults 上一次运行的结果（用于断点续传；成功条目跳过）
 * @param onProgress 每次单首状态变化后回调（用于刷新 UI）
 */
export async function runUploadSequence(
  items: SubmitData[],
  apiKey: string,
  submit: SubmitFn,
  prevResults: (SubmitResult | null)[],
  onProgress?: (results: (SubmitResult | null)[]) => void,
): Promise<UploadRunOutcome> {
  const results = [...prevResults];
  let prevUuid: string | undefined;
  let stopped = false;

  for (let i = 0; i < items.length && !stopped; i++) {
    // 已成功：跳过，并延续序列链
    if (results[i]?.ok) {
      prevUuid = results[i]!.uuid;
      continue;
    }

    const data: SubmitData = { ...items[i] };
    if (items.length > 1 && prevUuid && i > 0) {
      data.relations = [{ id: prevUuid, type: 'sequence' }];
    }

    // 重试时先清掉上次失败显示，进入"上传中"状态
    results[i] = null;
    onProgress?.([...results]);

    const res = await submit(data, apiKey);
    results[i] = res;
    if (res.ok && res.uuid) {
      prevUuid = res.uuid;
    } else {
      // 一首不成功：立即停止，不传后续（断点处可重试/继续）
      stopped = true;
    }
    onProgress?.([...results]);
  }

  return { results, stopped };
}
