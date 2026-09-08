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

// ============================================================================
// 脚注映射：与序对称，但整组注在文末 → 归入末首
// （单首画板注存于 metadata.footnote；组诗各首注 sectionFootnote、
//   整组注 metadata.footnote 导出时位于末尾，故并入最后一首，本首注在前）
// ============================================================================

export interface UploadFootnoteInput {
  /** 画板级脚注（metadata.footnote，trim 后） */
  boardFootnote?: string;
  /** 本首脚注（section.sectionFootnote，trim 后） */
  sectionFootnote?: string;
  /** 是否单首画板 */
  isSingle: boolean;
  /** 组诗中是否为最后 1 首（idx === sections.length - 1） */
  isLastOfGroup: boolean;
}

export function resolveUploadFootnote(input: UploadFootnoteInput): string | undefined {
  const { boardFootnote, sectionFootnote, isSingle, isLastOfGroup } = input;
  const bf = boardFootnote?.trim();
  const sf = sectionFootnote?.trim();
  // 末首：本首注在前，整组注在后（与导出 markdown「本首注 → 画板注」顺序一致）
  const joinTail = () => (sf && bf ? `${sf}\n\n${bf}` : sf || bf || undefined);
  if (isSingle) return joinTail();
  if (isLastOfGroup && bf) return joinTail();
  return sf || undefined;
}
