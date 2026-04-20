import type { Board, Folder } from './types';

const BOARDS_KEY = 'boards';
const ACTIVE_KEY = 'active_board_id';
const FOLDERS_KEY = 'folders';

export function loadBoards(): Board[] {
  try {
    const raw = localStorage.getItem(BOARDS_KEY);
    const boards: Board[] = raw ? JSON.parse(raw) : [];
    for (const b of boards) {
      if (!b.sections) {
        const legacy = b as Board & { ruleName?: string; charCount?: number; poemChars?: string[]; candidatesMap?: Record<number, string[]> };
        b.sections = [{
          id: crypto.randomUUID(),
          title: '',
          ruleName: legacy.ruleName ?? '',
          charCount: legacy.charCount ?? 0,
          poemChars: legacy.poemChars ?? [],
          candidatesMap: legacy.candidatesMap ?? {},
        }];
        delete legacy.ruleName;
        delete legacy.charCount;
        delete legacy.poemChars;
        delete legacy.candidatesMap;
      }
    }
    return boards;
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

export function loadFolders(): Folder[] {
  try {
    const raw = localStorage.getItem(FOLDERS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveFolders(folders: Folder[]) {
  localStorage.setItem(FOLDERS_KEY, JSON.stringify(folders));
}
