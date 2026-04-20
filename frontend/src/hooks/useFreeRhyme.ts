import { useEffect, useRef } from 'react';
import { useBoardContext, useActiveBoard } from '../context/BoardContext';
import { freeRhyme } from '../lib/api';

export function useFreeRhyme() {
  const { dispatch } = useBoardContext();
  const board = useActiveBoard();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const boardIdRef = useRef(board?.id ?? '');

  const lines = board?.genre === 'Free' ? (board.sections[0]?.lines ?? []) : [];
  const linesKey = lines.join('\n');
  const rhymeBookName = board?.rhymeBookName ?? '';

  boardIdRef.current = board?.id ?? '';

  useEffect(() => {
    if (!board || board.genre !== 'Free') return;
    if (lines.every(l => l.trim() === '')) {
      dispatch({ type: 'SET_FREE_RHYME', result: null });
      return;
    }

    if (timerRef.current) clearTimeout(timerRef.current);
    if (abortRef.current) abortRef.current.abort();

    const currentBoardId = board.id;

    timerRef.current = setTimeout(async () => {
      abortRef.current = new AbortController();
      try {
        const result = await freeRhyme({
          lines,
          rhyme_book_name: board.rhymeBookName,
        });
        if (boardIdRef.current === currentBoardId) {
          dispatch({ type: 'SET_FREE_RHYME', result });
        }
      } catch {
        // ignore abort
      }
    }, 500);

    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linesKey, rhymeBookName, board?.id]);
}
