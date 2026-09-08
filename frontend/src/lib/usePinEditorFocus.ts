import { useEffect, type RefObject } from 'react';

/**
 * 钉住编辑器隐藏输入的焦点。
 *
 * 创作区用隐藏 <input> 承载键盘输入（光标 = inputFocused）。默认行为下，
 * 用户点创作区外的按钮/链接等可聚焦控件，会把 DOM 焦点从隐藏输入抢走
 * （表现为"字失焦/光标消失"）。本 hook 在 document mousedown 捕获阶段：
 *
 *   - 焦点当前在本编辑器隐藏输入上时介入；
 *   - 目标落在编辑器容器内 → 不干预（点字/点空白由编辑器自身逻辑处理）；
 *   - 目标在容器外且属于「可聚焦但非文本编辑」控件
 *     （button / a / summary / [role=button] / select / [tabindex]）
 *     → preventDefault() 阻止其抢占焦点；click 事件不受影响，按钮照常生效，
 *       创作光标得以保持。
 *   - 目标是需要键盘的文本输入（input/textarea/[contenteditable]）→ 放行，
 *     用户可正常切换到别处输入；普通文本区本就不抢焦点，也不拦截。
 *
 * @param containerRef 编辑器根容器（创作区）
 * @param inputRef     隐藏输入
 * @param enabled      是否启用（例如仅当存在画板时）
 */
export function usePinEditorFocus(
  containerRef: RefObject<HTMLElement | null>,
  inputRef: RefObject<HTMLInputElement | null>,
  enabled = true,
) {
  useEffect(() => {
    if (!enabled) return;

    const isTextEditable = (el: Element | null): boolean =>
      !!el?.closest('input, textarea, select, [contenteditable="true"]');

    const isFocusStealer = (el: Element | null): boolean =>
      !!el?.closest('button, a[href], summary, [role="button"], [tabindex]');

    const onMouseDown = (e: MouseEvent) => {
      const inp = inputRef.current;
      if (!inp || document.activeElement !== inp) return; // 焦点不在创作输入上
      const target = e.target as Element | null;
      if (!target) return;
      if (containerRef.current?.contains(target)) return; // 创作区内不干预
      if (isTextEditable(target)) return;                 // 文本编辑放行
      if (isFocusStealer(target)) e.preventDefault();     // 钉住焦点（click 仍触发）
    };

    document.addEventListener('mousedown', onMouseDown, true);
    return () => document.removeEventListener('mousedown', onMouseDown, true);
  }, [containerRef, inputRef, enabled]);
}
