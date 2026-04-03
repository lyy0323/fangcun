import { useEffect, useRef } from 'react';
import { useBoardContext, useActiveBoard } from '../context/BoardContext';
import { validateMeter } from '../lib/api';

/**
 * 格律检测 hook。
 * 监听当前画板的 poemChars 变化，debounce 500ms 后调用后端检测 API，
 * 将结果写入 context 的 validation 字段。
 * 切换画板时中止旧请求，防止竞态覆盖。
 */
export function useValidation() {
  const { dispatch } = useBoardContext();
  const board = useActiveBoard();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const boardIdRef = useRef(board?.id ?? '');

  const charsKey = board?.poemChars.join('') ?? '';
  const boardId = board?.id ?? '';

  // 始终跟踪最新 boardId
  boardIdRef.current = boardId;

  useEffect(() => {
    if (!board) return;

    // 清除之前的 timer
    if (timerRef.current) clearTimeout(timerRef.current);
    // 中止之前的请求
    if (abortRef.current) abortRef.current.abort();

    const currentBoardId = board.id;

    timerRef.current = setTimeout(async () => {
      abortRef.current = new AbortController();

      try {
        const result = await validateMeter({
          poem_text: board.poemChars.join(''),
          genre: board.genre,
          rhyme_book_name: board.rhymeBookName,
          rule_name: board.ruleName,
          ensure_longpu: board.genre === 'Ci',
        });
        // 仅当仍在同一个画板时才更新，防止竞态
        if (boardIdRef.current === currentBoardId) {
          dispatch({ type: 'SET_VALIDATION', result });
        }
      } catch {
        // 忽略 abort 错误
      }
    }, 500);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [charsKey, boardId]);
}
