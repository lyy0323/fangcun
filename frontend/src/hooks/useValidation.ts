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
  const { state, dispatch } = useBoardContext();
  const board = useActiveBoard();
  const si = state.activeSectionIndex;
  const sec = board?.sections[si];
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const boardIdRef = useRef(board?.id ?? '');

  const charsKey = sec?.poemChars.join('') ?? '';
  const boardId = board?.id ?? '';
  const rhymeBookName = board?.rhymeBookName ?? '';

  boardIdRef.current = boardId;

  // Active section: debounced validation on content/section changes
  useEffect(() => {
    if (!board || !sec || board.genre === 'Free') return;

    if (timerRef.current) clearTimeout(timerRef.current);
    if (abortRef.current) abortRef.current.abort();

    const currentBoardId = board.id;
    const currentSi = si;

    timerRef.current = setTimeout(async () => {
      abortRef.current = new AbortController();

      try {
        const result = await validateMeter({
          poem_text: sec.poemChars.join(''),
          genre: board.genre,
          rhyme_book_name: board.rhymeBookName,
          rule_name: sec.ruleName,
          ensure_longpu: board.genre === 'Ci',
        });
        if (boardIdRef.current === currentBoardId) {
          dispatch({ type: 'SET_VALIDATION', sectionIndex: currentSi, result });
        }
      } catch {
        // ignore abort
      }
    }, 500);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [charsKey, boardId, rhymeBookName, si]);

  // Non-active sections: validate on board load or rhyme book change
  useEffect(() => {
    if (!board || board.sections.length <= 1 || board.genre === 'Free') return;
    const currentBoardId = board.id;
    const abort = new AbortController();

    board.sections.forEach((s, idx) => {
      if (idx === si) return;
      validateMeter({
        poem_text: s.poemChars.join(''),
        genre: board.genre,
        rhyme_book_name: board.rhymeBookName,
        rule_name: s.ruleName,
        ensure_longpu: board.genre === 'Ci',
      }).then(result => {
        if (!abort.signal.aborted && boardIdRef.current === currentBoardId) {
          dispatch({ type: 'SET_VALIDATION', sectionIndex: idx, result });
        }
      }).catch(() => {});
    });

    return () => { abort.abort(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardId, rhymeBookName]);
}
