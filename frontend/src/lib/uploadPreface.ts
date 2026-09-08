// ============================================================================
// 上传「序」的映射（纯函数，供 UploadModal 与回归测试复用）
//
// 序有两种存放处：
//   - metadata.preface：画板级序（MetadataPopover 编辑）。单首画板的序即存于此；
//     组诗画板此处为「整组序」，导出/出图时归入首首。
//   - section.sectionPreface：组诗各首的本首小序（GridEditor 组诗下可编辑）。
// 上传（南洋吟游）逐首提交时，序的映射：
//   - 单首画板：画板序 + 本首小序（若并存）按序拼接
//   - 组诗：首首带整组序（与其本首小序拼接）；其余各首带各自本首小序
// ============================================================================

export interface UploadPrefaceInput {
  /** 画板级序（metadata.preface，trim 后） */
  boardPreface?: string;
  /** 本首小序（section.sectionPreface，trim 后） */
  sectionPreface?: string;
  /** 是否单首画板 */
  isSingle: boolean;
  /** 组诗中是否为第 1 首（idx === 0） */
  isFirstOfGroup: boolean;
}

export function resolveUploadPreface(input: UploadPrefaceInput): string | undefined {
  const { boardPreface, sectionPreface, isSingle, isFirstOfGroup } = input;
  const bp = boardPreface?.trim();
  const sp = sectionPreface?.trim();
  const join = () => (bp && sp ? `${bp}\n\n${sp}` : bp || sp || undefined);
  if (isSingle) return join();
  if (isFirstOfGroup && bp) return join();
  return sp || undefined;
}
