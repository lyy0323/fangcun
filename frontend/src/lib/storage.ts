import type { Board } from './types';

const BOARDS_KEY = 'boards';
const ACTIVE_KEY = 'active_board_id';

export function loadBoards(): Board[] {
  try {
    const raw = localStorage.getItem(BOARDS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveBoards(boards: Board[]) {
  localStorage.setItem(BOARDS_KEY, JSON.stringify(boards));
}

export function loadActiveBoardId(): string | null {
  return localStorage.getItem(ACTIVE_KEY);
}

export function saveActiveBoardId(id: string) {
  localStorage.setItem(ACTIVE_KEY, id);
}
