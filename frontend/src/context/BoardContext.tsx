import React, { createContext, useContext, useReducer, useEffect, type Dispatch } from 'react';
import type { Board, ValidationResult, BoardMetadata } from '../lib/types';
import { PLACEHOLDER } from '../lib/types';
import { loadBoards, saveBoards, loadActiveBoardId, saveActiveBoardId } from '../lib/storage';

// ============================================================================
// State
// ============================================================================

export interface AppState {
  boards: Board[];
  activeBoardId: string | null;
  validation: ValidationResult | null;
  showGenreSelector: boolean;
  dictQuery: string | null;       // 联动字典查询（由网格点击触发）
  dictQueryCursor: number | null;  // 触发 dictQuery 时的光标位置
  insertCharFn: ((text: string, mode?: 'forward' | 'backward' | 'pair') => void) | null;
  rhymeOverride: string | null;   // 字典韵部点击 → 联动右侧面板切换韵部
  pairQuery: { text: string; insertAt: number } | null;  // 多选对语查询
}

const initialState: AppState = {
  boards: loadBoards(),
  activeBoardId: loadActiveBoardId(),
  validation: null,
  showGenreSelector: false,
  dictQuery: null,
  dictQueryCursor: null,
  insertCharFn: null,
  rhymeOverride: null,
  pairQuery: null,
};

// 首次打开没有画板时，自动弹出体裁选择
if (initialState.boards.length === 0) {
  initialState.showGenreSelector = true;
}

// ============================================================================
// Actions
// ============================================================================

export type Action =
  | { type: 'ADD_BOARD'; board: Board }
  | { type: 'DELETE_BOARD'; id: string }
  | { type: 'SWITCH_BOARD'; id: string }
  | { type: 'UPDATE_TITLE'; title: string }
  | { type: 'UPDATE_CHAR'; index: number; char: string }
  | { type: 'SET_VALIDATION'; result: ValidationResult | null }
  | { type: 'SHOW_GENRE_SELECTOR'; show: boolean }
  | { type: 'SET_POEM_CHARS'; chars: string[] }
  | { type: 'SET_DICT_QUERY'; query: string | null; cursor?: number | null }
  | { type: 'SET_RHYME_OVERRIDE'; category: string | null }
  | { type: 'SET_PAIR_QUERY'; payload: { text: string; insertAt: number } | null }
  | { type: 'SET_INSERT_FN'; fn: ((text: string, mode?: 'forward' | 'backward' | 'pair') => void) | null }
  | { type: 'ADD_CANDIDATE'; index: number; char: string }
  | { type: 'REMOVE_CANDIDATE'; index: number; char: string }
  | { type: 'REPLACE_WITH_CANDIDATE'; index: number; char: string }
  | { type: 'ADD_INSPIRATION'; card: import('../lib/types').InspirationCard }
  | { type: 'DELETE_INSPIRATION'; cardId: string }
  | { type: 'UPDATE_INSPIRATION'; cardId: string; content: string }
  | { type: 'UPDATE_METADATA'; metadata: Partial<BoardMetadata> }
  | { type: 'IMPORT_BOARDS'; boards: Board[] };

// ============================================================================
// Reducer
// ============================================================================

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'ADD_BOARD': {
      const boards = [...state.boards, action.board];
      return { ...state, boards, activeBoardId: action.board.id, showGenreSelector: false, validation: null };
    }
    case 'DELETE_BOARD': {
      const boards = state.boards.filter(b => b.id !== action.id);
      let activeBoardId = state.activeBoardId;
      if (activeBoardId === action.id) {
        activeBoardId = boards.length > 0 ? boards[0].id : null;
      }
      return {
        ...state,
        boards,
        activeBoardId,
        validation: activeBoardId !== state.activeBoardId ? null : state.validation,
        showGenreSelector: boards.length === 0,
      };
    }
    case 'SWITCH_BOARD':
      return { ...state, activeBoardId: action.id, validation: null };
    case 'UPDATE_TITLE': {
      const boards = state.boards.map(b =>
        b.id === state.activeBoardId ? { ...b, title: action.title, updatedAt: Date.now() } : b,
      );
      return { ...state, boards };
    }
    case 'UPDATE_CHAR': {
      const boards = state.boards.map(b => {
        if (b.id !== state.activeBoardId) return b;
        const poemChars = [...b.poemChars];
        poemChars[action.index] = action.char;
        return { ...b, poemChars, updatedAt: Date.now() };
      });
      return { ...state, boards };
    }
    case 'SET_POEM_CHARS': {
      const boards = state.boards.map(b =>
        b.id === state.activeBoardId ? { ...b, poemChars: action.chars, updatedAt: Date.now() } : b,
      );
      return { ...state, boards };
    }
    case 'SET_VALIDATION':
      return { ...state, validation: action.result };
    case 'SHOW_GENRE_SELECTOR':
      return { ...state, showGenreSelector: action.show };
    case 'SET_DICT_QUERY':
      return { ...state, dictQuery: action.query, dictQueryCursor: action.cursor ?? null };
    case 'SET_RHYME_OVERRIDE':
      return { ...state, rhymeOverride: action.category };
    case 'SET_PAIR_QUERY':
      return { ...state, pairQuery: action.payload };
    case 'SET_INSERT_FN':
      return { ...state, insertCharFn: action.fn };
    case 'ADD_CANDIDATE': {
      const boards = state.boards.map(b => {
        if (b.id !== state.activeBoardId) return b;
        const cm = { ...b.candidatesMap };
        const existing = cm[action.index] ?? [];
        if (existing.length >= 5 || existing.includes(action.char)) return b;
        cm[action.index] = [...existing, action.char];
        return { ...b, candidatesMap: cm, updatedAt: Date.now() };
      });
      return { ...state, boards };
    }
    case 'REMOVE_CANDIDATE': {
      const boards = state.boards.map(b => {
        if (b.id !== state.activeBoardId) return b;
        const cm = { ...b.candidatesMap };
        const existing = cm[action.index] ?? [];
        cm[action.index] = existing.filter(c => c !== action.char);
        if (cm[action.index].length === 0) delete cm[action.index];
        return { ...b, candidatesMap: cm, updatedAt: Date.now() };
      });
      return { ...state, boards };
    }
    case 'REPLACE_WITH_CANDIDATE': {
      // 将候选字替换为正文，原正文字移入候选
      const boards = state.boards.map(b => {
        if (b.id !== state.activeBoardId) return b;
        const poemChars = [...b.poemChars];
        const cm = { ...b.candidatesMap };
        const oldChar = poemChars[action.index];
        const existing = cm[action.index] ?? [];
        // 新正文 = 候选字
        poemChars[action.index] = action.char;
        // 候选列表: 去掉选中的候选字，加入原正文字（如果不是占位符且不重复）
        let newCandidates = existing.filter(c => c !== action.char);
        if (oldChar && oldChar !== '\u25a1' && !newCandidates.includes(oldChar)) {
          newCandidates = [oldChar, ...newCandidates];
        }
        if (newCandidates.length > 0) {
          cm[action.index] = newCandidates;
        } else {
          delete cm[action.index];
        }
        return { ...b, poemChars, candidatesMap: cm, updatedAt: Date.now() };
      });
      return { ...state, boards };
    }
    case 'ADD_INSPIRATION': {
      const boards = state.boards.map(b =>
        b.id === state.activeBoardId
          ? { ...b, inspirationCards: [...b.inspirationCards, action.card], updatedAt: Date.now() }
          : b,
      );
      return { ...state, boards };
    }
    case 'DELETE_INSPIRATION': {
      const boards = state.boards.map(b =>
        b.id === state.activeBoardId
          ? { ...b, inspirationCards: b.inspirationCards.filter(c => c.id !== action.cardId), updatedAt: Date.now() }
          : b,
      );
      return { ...state, boards };
    }
    case 'UPDATE_INSPIRATION': {
      const boards = state.boards.map(b =>
        b.id === state.activeBoardId
          ? {
              ...b,
              inspirationCards: b.inspirationCards.map(c =>
                c.id === action.cardId ? { ...c, content: action.content } : c,
              ),
              updatedAt: Date.now(),
            }
          : b,
      );
      return { ...state, boards };
    }
    case 'UPDATE_METADATA': {
      const boards = state.boards.map(b => {
        if (b.id !== state.activeBoardId) return b;

        const updatedBoard = {
          ...b,
          metadata: { ...b.metadata, ...action.metadata },
          updatedAt: Date.now(),
        };

        // 如果更新了韵书，同时更新格律检测使用的韵书
        if (action.metadata.rhymeBook !== undefined) {
          updatedBoard.rhymeBookName = action.metadata.rhymeBook;
        }

        return updatedBoard;
      });
      return { ...state, boards };
    }
    case 'IMPORT_BOARDS': {
      const existingIds = new Set(state.boards.map(b => b.id));
      const newBoards = action.boards.filter(b => !existingIds.has(b.id));
      if (newBoards.length === 0) return state;
      const boards = [...state.boards, ...newBoards];
      return { ...state, boards };
    }
    default:
      return state;
  }
}

// ============================================================================
// Context
// ============================================================================

const Ctx = createContext<{ state: AppState; dispatch: Dispatch<Action> } | null>(null);

export function BoardProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  // 同步 localStorage
  useEffect(() => {
    saveBoards(state.boards);
  }, [state.boards]);

  useEffect(() => {
    if (state.activeBoardId) saveActiveBoardId(state.activeBoardId);
  }, [state.activeBoardId]);

  return <Ctx.Provider value={{ state, dispatch }}>{children}</Ctx.Provider>;
}

export function useBoardContext() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useBoardContext must be inside BoardProvider');
  return ctx;
}

// 获取当前激活画板
export function useActiveBoard(): Board | null {
  const { state } = useBoardContext();
  return state.boards.find(b => b.id === state.activeBoardId) ?? null;
}

// 工具: 创建新画板
export function createBoard(genre: 'Shi' | 'Ci', ruleName: string, charCount: number): Board {
  const defaultRhymeBook = genre === 'Shi' ? 'Pingshuiyun' : 'Cilinzhengyun';
  return {
    id: crypto.randomUUID(),
    title: `新建·${ruleName}`,
    genre,
    ruleName,
    charCount,
    rhymeBookName: defaultRhymeBook,
    poemChars: Array(charCount).fill(PLACEHOLDER),
    candidatesMap: {},
    inspirationCards: [],
    metadata: {
      rhymeBook: defaultRhymeBook,
      dateFormat: 'Gregorian',
    },
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}
