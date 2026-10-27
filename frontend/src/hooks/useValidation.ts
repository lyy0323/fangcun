import { useCallback, useEffect, useRef, useState } from 'react';
import { useBoardContext, useActiveBoard } from '../context/BoardContext';
import { validateMeter } from '../lib/api';
import { normalizeBookKey } from '../lib/types';

/** 单次检测请求超时（毫秒）。超时后会进入自动重试，而不是无限等待。 */
const REQUEST_TIMEOUT_MS = 12000;
/** 自动重试间隔（毫秒）。首次请求失败后，最多再试 2 次。 */
const RETRY_DELAYS_MS = [1200, 3000];

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

/**
 * 格律检测 hook。
 * 监听当前画板的 poemChars 变化，debounce 500ms 后调用后端检测 API，
 * 将结果写入 context 的 validation 字段。
 * 切换画板时中止旧请求，防止竞态覆盖。
 *
 * 词（Ci）画布的网格分行完全依赖检测结果，请求失败会让画布永久停在
 * 「加载词谱...」。因此这里对失败做有限重试，并把最终失败暴露给 UI 提示重试。
 */
export function useValidation() {
  const { state, dispatch } = useBoardContext();
  const board = useActiveBoard();
  const si = state.activeSectionIndex;
  const sec = board?.sections[si];
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const boardIdRef = useRef(board?.id ?? '');
  /** 手动重试计数：变化后重新触发检测 effect。 */
  const [retryNonce, setRetryNonce] = useState(0);
  /** 当前 section 在重试耗尽后仍然失败（用于替换无限加载动画）。 */
  const [failed, setFailed] = useState(false);

  const charsKey = sec?.poemChars.join('') ?? '';
  const boardId = board?.id ?? '';
  const rhymeBookName = normalizeBookKey(board?.rhymeBookName ?? '');

  boardIdRef.current = boardId;

  const retry = useCallback(() => {
    setFailed(false);
    setRetryNonce(n => n + 1);
  }, []);

  // Active section: debounced validation on content/section changes
  useEffect(() => {
    if (!board || !sec || board.genre === 'Free') return;

    if (timerRef.current) clearTimeout(timerRef.current);
    if (abortRef.current) abortRef.current.abort();
    setFailed(false);

    const currentBoardId = board.id;
    const currentSi = si;
    let cancelled = false;

    const run = async () => {
      for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
        if (attempt > 0) {
          await sleep(RETRY_DELAYS_MS[attempt - 1]);
        }
        if (cancelled) return;

        const controller = new AbortController();
        abortRef.current = controller;
        const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

        try {
          const result = await validateMeter({
            poem_text: sec.poemChars.join(''),
            genre: board.genre,
            rhyme_book_name: rhymeBookName,
            rule_name: sec.ruleName,
            ensure_longpu: board.genre === 'Ci',
          }, controller.signal);
          clearTimeout(timeout);
          if (!cancelled && boardIdRef.current === currentBoardId) {
            dispatch({ type: 'SET_VALIDATION', sectionIndex: currentSi, result });
            setFailed(false);
          }
          return;
        } catch {
          clearTimeout(timeout);
          // 组件已卸载 / 画板或内容已切换：不提示失败，也不覆盖新结果
          if (cancelled) return;
          if (attempt === RETRY_DELAYS_MS.length && boardIdRef.current === currentBoardId) {
            setFailed(true);
          }
        }
      }
    };

    timerRef.current = setTimeout(run, 500);

    return () => {
      cancelled = true;
      if (timerRef.current) clearTimeout(timerRef.current);
      if (abortRef.current) abortRef.current.abort();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [charsKey, boardId, rhymeBookName, si, retryNonce]);

  // Non-active sections: validate on board load or rhyme book change
  useEffect(() => {
    if (!board || board.sections.length <= 1 || board.genre === 'Free') return;
    const currentBoardId = board.id;
    const controller = new AbortController();

    board.sections.forEach((s, idx) => {
      if (idx === si) return;
      validateMeter({
        poem_text: s.poemChars.join(''),
        genre: board.genre,
        rhyme_book_name: rhymeBookName,
        rule_name: s.ruleName,
        ensure_longpu: board.genre === 'Ci',
      }, controller.signal).then(result => {
        if (!controller.signal.aborted && boardIdRef.current === currentBoardId) {
          dispatch({ type: 'SET_VALIDATION', sectionIndex: idx, result });
        }
      }).catch(() => {});
    });

    return () => { controller.abort(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardId, rhymeBookName]);

  return { failed, retry };
}
