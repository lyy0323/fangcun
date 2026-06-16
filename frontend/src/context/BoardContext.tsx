import React, { createContext, useContext, useReducer, useEffect, type Dispatch } from 'react';
import type { Board, Folder, SortMode, ValidationResult, BoardMetadata, PoemSection, FreeRhymeResult } from '../lib/types';
import { PLACEHOLDER } from '../lib/types';

export interface MarkdownPasteSection {
  title?: string;
  preface?: string;
  footnote?: string;
  date?: string;
  lines: string[];
}

export interface MarkdownPasteResult {
  title?: string;
  author?: string;
  boardPreface?: string;
  boardFootnote?: string;
  boardDate?: string;
  sections: MarkdownPasteSection[];
}
import { loadBoards, saveBoards, loadActiveBoardId, saveActiveBoardId, loadFolders, saveFolders, loadUndoStacks, saveUndoStacks } from '../lib/storage';

// ============================================================================
// State
// ============================================================================

export interface AppState {
  boards: Board[];
  folders: Folder[];
  activeBoardId: string | null;
  activeSectionIndex: number;
  validations: (ValidationResult | null)[];
  showGenreSelector: boolean;
  dictQuery: string | null;
  dictQueryCursor: number | null;
  insertCharFn: ((text: string, mode?: 'forward' | 'backward' | 'pair') => void) | null;
  rhymeOverride: string | null;
  pairQuery: { text: string; insertAt: number } | null;
  freeRhymeResult: FreeRhymeResult | null;
  rootSortMode: SortMode;
  undoStacks: Record<string, Board[]>;
  redoStacks: Record<string, Board[]>;
  _undoMeta: { boardId: string; actionType: string; timestamp: number };
}

const initialState: AppState = {
  boards: loadBoards(),
  folders: loadFolders(),
  activeBoardId: loadActiveBoardId(),
  activeSectionIndex: 0,
  validations: [],
  showGenreSelector: false,
  dictQuery: null,
  dictQueryCursor: null,
  insertCharFn: null,
  rhymeOverride: null,
  pairQuery: null,
  freeRhymeResult: null,
  rootSortMode: 'updated-desc' as SortMode,
  undoStacks: loadUndoStacks(),
  redoStacks: {},
  _undoMeta: { boardId: '', actionType: '', timestamp: 0 },
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
  | { type: 'SET_VALIDATION'; sectionIndex: number; result: ValidationResult | null }
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
  | { type: 'IMPORT_BOARDS'; boards: Board[]; folders?: Folder[] }
  | { type: 'ADD_SECTION' }
  | { type: 'DELETE_SECTION'; sectionIndex: number }
  | { type: 'MOVE_SECTION'; sectionIndex: number; direction: 'up' | 'down' }
  | { type: 'UPDATE_SECTION_TITLE'; sectionIndex: number; title: string }
  | { type: 'SET_ACTIVE_SECTION'; sectionIndex: number }
  | { type: 'SET_FREE_LINES'; lines: string[] }
  | { type: 'SET_FREE_RHYME'; result: FreeRhymeResult | null }
  | { type: 'TOGGLE_IMMERSIVE'; sectionIndex: number }
  | { type: 'UPDATE_SECTION_META'; sectionIndex: number; field: 'sectionDate' | 'sectionPreface' | 'sectionFootnote' | 'sectionDateHidden' | 'sectionLegacyId'; value: string | boolean }
  | { type: 'SET_PUNCT_OVERRIDE'; index: number; punct: string | null }
  | { type: 'TOGGLE_AUX_MARK'; index: number; mark: string }
  | { type: 'ADD_FOLDER'; name: string; parentId: string | null }
  | { type: 'RENAME_FOLDER'; id: string; name: string }
  | { type: 'DELETE_FOLDER'; id: string }
  | { type: 'TOGGLE_FOLDER'; id: string }
  | { type: 'MOVE_FOLDER'; id: string; direction: 'up' | 'down' }
  | { type: 'MOVE_BOARD'; boardId: string; folderId: string | null }
  | { type: 'SET_SORT_MODE'; folderId: string | null; mode: SortMode }
  | { type: 'REORDER_BOARD'; boardId: string; direction: 'up' | 'down' }
  | { type: 'UNDO' }
  | { type: 'REDO' }
  | { type: 'IMPORT_MARKDOWN'; payload: MarkdownPasteResult };

// ============================================================================
// Undo/Redo
// ============================================================================

const MAX_UNDO = 20;
const DEBOUNCE_MS = 500;

const UNDOABLE_ACTIONS = new Set([
  'UPDATE_CHAR', 'SET_POEM_CHARS', 'SET_FREE_LINES',
  'UPDATE_TITLE', 'UPDATE_SECTION_TITLE',
  'ADD_CANDIDATE', 'REMOVE_CANDIDATE', 'REPLACE_WITH_CANDIDATE',
  'ADD_SECTION', 'DELETE_SECTION', 'MOVE_SECTION',
  'SET_PUNCT_OVERRIDE', 'TOGGLE_AUX_MARK',
  'UPDATE_METADATA', 'UPDATE_SECTION_META',
  'ADD_INSPIRATION', 'DELETE_INSPIRATION', 'UPDATE_INSPIRATION',
  'TOGGLE_IMMERSIVE',
  'IMPORT_MARKDOWN',
]);

// ============================================================================
// Reducer
// ============================================================================

// 不可变更新指定 section
function updateSection(b: Board, si: number, patch: Partial<PoemSection>): Board {
  const sections = b.sections.map((s, i) => i === si ? { ...s, ...patch } : s);
  return { ...b, sections, updatedAt: Date.now() };
}

function reducer(state: AppState, action: Action): AppState {
  // Undo snapshot: push current board before undoable mutations
  if (UNDOABLE_ACTIONS.has(action.type) && state.activeBoardId) {
    const bid = state.activeBoardId;
    const board = state.boards.find(b => b.id === bid);
    if (board) {
      const now = Date.now();
      const prev = state._undoMeta;
      const same = bid === prev.boardId && action.type === prev.actionType && now - prev.timestamp < DEBOUNCE_MS;
      const past = state.undoStacks[bid] || [];
      const newPast = same ? past : [...past, board].slice(-MAX_UNDO);
      state = {
        ...state,
        undoStacks: { ...state.undoStacks, [bid]: newPast },
        redoStacks: { ...state.redoStacks, [bid]: [] },
        _undoMeta: { boardId: bid, actionType: action.type, timestamp: now },
      };
    }
  }

  switch (action.type) {
    case 'UNDO': {
      const bid = state.activeBoardId;
      if (!bid) return state;
      const past = state.undoStacks[bid] || [];
      if (past.length === 0) return state;
      const current = state.boards.find(b => b.id === bid);
      if (!current) return state;
      const prev = past[past.length - 1];
      const future = [...(state.redoStacks[bid] || []), current];
      return {
        ...state,
        boards: state.boards.map(b => b.id === bid ? prev : b),
        undoStacks: { ...state.undoStacks, [bid]: past.slice(0, -1) },
        redoStacks: { ...state.redoStacks, [bid]: future },
      };
    }
    case 'REDO': {
      const bid = state.activeBoardId;
      if (!bid) return state;
      const future = state.redoStacks[bid] || [];
      if (future.length === 0) return state;
      const current = state.boards.find(b => b.id === bid);
      if (!current) return state;
      const next = future[future.length - 1];
      const past = [...(state.undoStacks[bid] || []), current];
      return {
        ...state,
        boards: state.boards.map(b => b.id === bid ? next : b),
        undoStacks: { ...state.undoStacks, [bid]: past },
        redoStacks: { ...state.redoStacks, [bid]: future.slice(0, -1) },
      };
    }
    case 'ADD_BOARD': {
      const boards = [...state.boards, action.board];
      return { ...state, boards, activeBoardId: action.board.id, activeSectionIndex: 0, showGenreSelector: false, validations: [] };
    }
    case 'DELETE_BOARD': {
      const boards = state.boards.filter(b => b.id !== action.id);
      let activeBoardId = state.activeBoardId;
      if (activeBoardId === action.id) {
        activeBoardId = boards.length > 0 ? boards[0].id : null;
      }
      const { [action.id]: _u, ...undoRest } = state.undoStacks;
      const { [action.id]: _r, ...redoRest } = state.redoStacks;
      return {
        ...state,
        boards,
        activeBoardId,
        activeSectionIndex: activeBoardId !== state.activeBoardId ? 0 : state.activeSectionIndex,
        validations: activeBoardId !== state.activeBoardId ? [] : state.validations,
        showGenreSelector: boards.length === 0,
        undoStacks: undoRest,
        redoStacks: redoRest,
      };
    }
    case 'SWITCH_BOARD':
      return { ...state, activeBoardId: action.id, activeSectionIndex: 0, validations: [], freeRhymeResult: null };
    case 'UPDATE_TITLE': {
      const boards = state.boards.map(b =>
        b.id === state.activeBoardId ? { ...b, title: action.title, updatedAt: Date.now() } : b,
      );
      return { ...state, boards };
    }
    case 'UPDATE_CHAR': {
      const si = state.activeSectionIndex;
      const boards = state.boards.map(b => {
        if (b.id !== state.activeBoardId) return b;
        const sec = b.sections[si];
        const poemChars = [...sec.poemChars];
        poemChars[action.index] = action.char;
        return updateSection(b, si, { poemChars });
      });
      return { ...state, boards };
    }
    case 'SET_POEM_CHARS': {
      const si = state.activeSectionIndex;
      const boards = state.boards.map(b =>
        b.id === state.activeBoardId ? updateSection(b, si, { poemChars: action.chars }) : b,
      );
      return { ...state, boards };
    }
    case 'SET_VALIDATION': {
      const vs = [...state.validations];
      vs[action.sectionIndex] = action.result;
      return { ...state, validations: vs };
    }
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
      const si = state.activeSectionIndex;
      const boards = state.boards.map(b => {
        if (b.id !== state.activeBoardId) return b;
        const sec = b.sections[si];
        const cm = { ...sec.candidatesMap };
        const existing = cm[action.index] ?? [];
        if (existing.length >= 5 || existing.includes(action.char)) return b;
        cm[action.index] = [...existing, action.char];
        return updateSection(b, si, { candidatesMap: cm });
      });
      return { ...state, boards };
    }
    case 'REMOVE_CANDIDATE': {
      const si = state.activeSectionIndex;
      const boards = state.boards.map(b => {
        if (b.id !== state.activeBoardId) return b;
        const sec = b.sections[si];
        const cm = { ...sec.candidatesMap };
        const existing = cm[action.index] ?? [];
        cm[action.index] = existing.filter(c => c !== action.char);
        if (cm[action.index].length === 0) delete cm[action.index];
        return updateSection(b, si, { candidatesMap: cm });
      });
      return { ...state, boards };
    }
    case 'REPLACE_WITH_CANDIDATE': {
      const si = state.activeSectionIndex;
      const boards = state.boards.map(b => {
        if (b.id !== state.activeBoardId) return b;
        const sec = b.sections[si];
        const poemChars = [...sec.poemChars];
        const cm = { ...sec.candidatesMap };
        const oldChar = poemChars[action.index];
        const existing = cm[action.index] ?? [];
        poemChars[action.index] = action.char;
        let newCandidates = existing.filter(c => c !== action.char);
        if (oldChar && oldChar !== '\u25a1' && !newCandidates.includes(oldChar)) {
          newCandidates = [oldChar, ...newCandidates];
        }
        if (newCandidates.length > 0) {
          cm[action.index] = newCandidates;
        } else {
          delete cm[action.index];
        }
        return updateSection(b, si, { poemChars, candidatesMap: cm });
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
      const existingBoardIds = new Set(state.boards.map(b => b.id));
      const newBoards = action.boards.filter(b => !existingBoardIds.has(b.id));

      let folders = state.folders;
      if (action.folders && action.folders.length > 0) {
        const existingFolderIds = new Set(state.folders.map(f => f.id));
        const newFolders = action.folders.filter(f => !existingFolderIds.has(f.id));
        if (newFolders.length > 0) {
          folders = [...state.folders, ...newFolders];
        }
      }

      const allFolderIds = new Set(folders.map(f => f.id));
      const boards = [...state.boards, ...newBoards.map(b =>
        b.folderId && !allFolderIds.has(b.folderId) ? { ...b, folderId: undefined } : b,
      )];

      if (newBoards.length === 0 && folders === state.folders) return state;
      return { ...state, boards, folders };
    }
    case 'ADD_SECTION': {
      const boards = state.boards.map(b => {
        if (b.id !== state.activeBoardId) return b;
        const ref = b.sections[0];
        const newSec: PoemSection = {
          id: crypto.randomUUID(),
          title: '',
          ruleName: ref.ruleName,
          charCount: ref.charCount,
          poemChars: Array(ref.charCount).fill(PLACEHOLDER),
          candidatesMap: {},
        };
        return { ...b, sections: [...b.sections, newSec], updatedAt: Date.now() };
      });
      const board = boards.find(b => b.id === state.activeBoardId);
      const newIdx = board ? board.sections.length - 1 : 0;
      const validations = [...state.validations, null];
      return { ...state, boards, activeSectionIndex: newIdx, validations };
    }
    case 'DELETE_SECTION': {
      const boards = state.boards.map(b => {
        if (b.id !== state.activeBoardId || b.sections.length <= 1) return b;
        const sections = b.sections.filter((_, i) => i !== action.sectionIndex);
        return { ...b, sections, updatedAt: Date.now() };
      });
      const newSi = Math.min(state.activeSectionIndex, (boards.find(b => b.id === state.activeBoardId)?.sections.length ?? 1) - 1);
      const validations = state.validations.filter((_, i) => i !== action.sectionIndex);
      return { ...state, boards, activeSectionIndex: newSi, validations };
    }
    case 'MOVE_SECTION': {
      const { sectionIndex: from, direction } = action;
      const to = direction === 'up' ? from - 1 : from + 1;
      const boards = state.boards.map(b => {
        if (b.id !== state.activeBoardId) return b;
        if (to < 0 || to >= b.sections.length) return b;
        const sections = [...b.sections];
        [sections[from], sections[to]] = [sections[to], sections[from]];
        return { ...b, sections, updatedAt: Date.now() };
      });
      const board = boards.find(b => b.id === state.activeBoardId);
      if (!board || to < 0 || to >= board.sections.length) return state;
      const validations = [...state.validations];
      [validations[from], validations[to]] = [validations[to], validations[from]];
      const newSi = state.activeSectionIndex === from ? to : state.activeSectionIndex === to ? from : state.activeSectionIndex;
      return { ...state, boards, validations, activeSectionIndex: newSi };
    }
    case 'UPDATE_SECTION_TITLE': {
      const boards = state.boards.map(b =>
        b.id === state.activeBoardId ? updateSection(b, action.sectionIndex, { title: action.title }) : b,
      );
      return { ...state, boards };
    }
    case 'SET_ACTIVE_SECTION':
      return { ...state, activeSectionIndex: action.sectionIndex };
    case 'SET_FREE_LINES': {
      const boards = state.boards.map(b => {
        if (b.id !== state.activeBoardId || b.genre !== 'Free') return b;
        const sections = [...b.sections];
        sections[0] = { ...sections[0], lines: action.lines };
        return { ...b, sections, updatedAt: Date.now() };
      });
      return { ...state, boards };
    }
    case 'SET_FREE_RHYME':
      return { ...state, freeRhymeResult: action.result };
    case 'TOGGLE_IMMERSIVE': {
      const boards = state.boards.map(b => {
        if (b.id !== state.activeBoardId) return b;
        return updateSection(b, action.sectionIndex, { immersive: !b.sections[action.sectionIndex]?.immersive });
      });
      return { ...state, boards };
    }
    case 'UPDATE_SECTION_META': {
      const boards = state.boards.map(b => {
        if (b.id !== state.activeBoardId) return b;
        const val = action.value === true ? true : action.value === false ? undefined : (action.value || undefined);
        return updateSection(b, action.sectionIndex, { [action.field]: val });
      });
      return { ...state, boards };
    }
    case 'SET_PUNCT_OVERRIDE': {
      const si = state.activeSectionIndex;
      const boards = state.boards.map(b => {
        if (b.id !== state.activeBoardId) return b;
        const sec = b.sections[si];
        if (!sec) return b;
        const overrides = { ...(sec.punctOverrides ?? {}) };
        if (action.punct === null) { delete overrides[action.index]; }
        else { overrides[action.index] = action.punct; }
        return updateSection(b, si, { punctOverrides: overrides });
      });
      return { ...state, boards };
    }
    case 'TOGGLE_AUX_MARK': {
      const si = state.activeSectionIndex;
      const boards = state.boards.map(b => {
        if (b.id !== state.activeBoardId) return b;
        const sec = b.sections[si];
        if (!sec) return b;
        const all = { ...(sec.auxMarks ?? {}) };
        const marks = [...(all[action.index] ?? [])];
        const idx = marks.indexOf(action.mark);
        if (idx >= 0) { marks.splice(idx, 1); }
        else { marks.push(action.mark); }
        if (marks.length === 0) { delete all[action.index]; }
        else { all[action.index] = marks; }
        return updateSection(b, si, { auxMarks: all });
      });
      return { ...state, boards };
    }
    case 'ADD_FOLDER': {
      const siblings = state.folders.filter(f => f.parentId === action.parentId);
      const maxOrder = siblings.length > 0 ? Math.max(...siblings.map(f => f.order)) : -1;
      const folder: Folder = {
        id: crypto.randomUUID(),
        name: action.name,
        parentId: action.parentId,
        order: maxOrder + 1,
        createdAt: Date.now(),
      };
      return { ...state, folders: [...state.folders, folder] };
    }
    case 'RENAME_FOLDER': {
      const folders = state.folders.map(f => f.id === action.id ? { ...f, name: action.name } : f);
      return { ...state, folders };
    }
    case 'DELETE_FOLDER': {
      const toDelete = new Set<string>();
      const collect = (id: string) => {
        toDelete.add(id);
        state.folders.filter(f => f.parentId === id).forEach(f => collect(f.id));
      };
      collect(action.id);
      const target = state.folders.find(f => f.id === action.id);
      const parentId = target?.parentId ?? null;
      const folders = state.folders.filter(f => !toDelete.has(f.id));
      const boards = state.boards.map(b =>
        b.folderId && toDelete.has(b.folderId) ? { ...b, folderId: parentId ?? undefined } : b,
      );
      return { ...state, folders, boards };
    }
    case 'TOGGLE_FOLDER': {
      const folders = state.folders.map(f => f.id === action.id ? { ...f, collapsed: !f.collapsed } : f);
      return { ...state, folders };
    }
    case 'MOVE_FOLDER': {
      const folder = state.folders.find(f => f.id === action.id);
      if (!folder) return state;
      const siblings = state.folders
        .filter(f => f.parentId === folder.parentId)
        .sort((a, b) => a.order - b.order);
      const idx = siblings.findIndex(f => f.id === action.id);
      const swapIdx = action.direction === 'up' ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= siblings.length) return state;
      const orderA = siblings[idx].order;
      const orderB = siblings[swapIdx].order;
      const folders = state.folders.map(f => {
        if (f.id === siblings[idx].id) return { ...f, order: orderB };
        if (f.id === siblings[swapIdx].id) return { ...f, order: orderA };
        return f;
      });
      return { ...state, folders };
    }
    case 'MOVE_BOARD': {
      const boards = state.boards.map(b =>
        b.id === action.boardId ? { ...b, folderId: action.folderId ?? undefined, updatedAt: Date.now() } : b,
      );
      return { ...state, boards };
    }
    case 'SET_SORT_MODE': {
      if (action.folderId === null) {
        return { ...state, rootSortMode: action.mode };
      }
      const folders = state.folders.map(f => f.id === action.folderId ? { ...f, sortMode: action.mode } : f);
      return { ...state, folders };
    }
    case 'REORDER_BOARD': {
      const board = state.boards.find(b => b.id === action.boardId);
      if (!board) return state;
      const fid = board.folderId ?? null;
      const siblings = state.boards
        .filter(b => (b.folderId ?? null) === fid)
        .sort((a, b) => (a.boardOrder ?? 0) - (b.boardOrder ?? 0));
      const idx = siblings.findIndex(b => b.id === action.boardId);
      const swapIdx = action.direction === 'up' ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= siblings.length) return state;
      const orderA = siblings[idx].boardOrder ?? idx;
      const orderB = siblings[swapIdx].boardOrder ?? swapIdx;
      const boards = state.boards.map(b => {
        if (b.id === siblings[idx].id) return { ...b, boardOrder: orderB };
        if (b.id === siblings[swapIdx].id) return { ...b, boardOrder: orderA };
        return b;
      });
      return { ...state, boards };
    }
    case 'IMPORT_MARKDOWN': {
      const { payload } = action;
      const boards = state.boards.map(b => {
        if (b.id !== state.activeBoardId) return b;
        let updated = { ...b, updatedAt: Date.now() };

        if (payload.title) updated.title = payload.title;

        const meta: Partial<BoardMetadata> = {};
        if (payload.author) meta.author = payload.author;
        if (payload.boardPreface) meta.preface = payload.boardPreface;
        if (payload.boardFootnote) meta.footnote = payload.boardFootnote;
        if (payload.boardDate) meta.date = payload.boardDate;

        const pSections = payload.sections;
        if (pSections.length === 0) return updated;

        // Expand sections to match parsed count
        let sections = [...updated.sections];
        while (sections.length < pSections.length) {
          const ref = sections[0];
          sections.push({
            id: crypto.randomUUID(),
            title: '',
            ruleName: ref.ruleName,
            charCount: ref.charCount,
            poemChars: Array(ref.charCount).fill(PLACEHOLDER),
            candidatesMap: {},
          });
        }

        // Fill each section
        const singleSection = pSections.length === 1;
        for (let i = 0; i < pSections.length; i++) {
          const ps = pSections[i];
          const sec = { ...sections[i] };
          if (ps.title) sec.title = ps.title;

          if (singleSection) {
            // Single section: promote metadata to board level
            if (ps.preface && !meta.preface) meta.preface = ps.preface;
            if (ps.footnote && !meta.footnote) meta.footnote = ps.footnote;
            if (ps.date && !meta.date) meta.date = ps.date;
          } else {
            if (ps.preface) sec.sectionPreface = ps.preface;
            if (ps.footnote) sec.sectionFootnote = ps.footnote;
            if (ps.date) sec.sectionDate = ps.date;
          }

          if (b.genre === 'Free') {
            sec.lines = ps.lines;
          } else {
            // Fill poemChars from text lines (strip punctuation)
            const allText = ps.lines.join('');
            const chars = [...allText].filter(c => /[一-鿿㐀-䶿]/.test(c));
            const poemChars = [...sec.poemChars];
            for (let j = 0; j < Math.min(chars.length, poemChars.length); j++) {
              poemChars[j] = chars[j];
            }
            sec.poemChars = poemChars;
          }
          sections[i] = sec;
        }

        updated.sections = sections;
        if (Object.keys(meta).length > 0) updated.metadata = { ...updated.metadata, ...meta };
        return updated;
      });
      return { ...state, boards };
    }
    default:
      return state;
  }
}

// ============================================================================
// Context
// ============================================================================

const Ctx = createContext<{ state: AppState; dispatch: Dispatch<Action>; canUndo: boolean; canRedo: boolean } | null>(null);

export function BoardProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  // 同步 localStorage
  useEffect(() => {
    saveBoards(state.boards);
  }, [state.boards]);

  useEffect(() => {
    saveFolders(state.folders);
  }, [state.folders]);

  useEffect(() => {
    if (state.activeBoardId) saveActiveBoardId(state.activeBoardId);
  }, [state.activeBoardId]);

  useEffect(() => {
    saveUndoStacks(state.undoStacks);
  }, [state.undoStacks]);

  const bid = state.activeBoardId;
  const canUndo = !!bid && (state.undoStacks[bid]?.length ?? 0) > 0;
  const canRedo = !!bid && (state.redoStacks[bid]?.length ?? 0) > 0;

  return <Ctx.Provider value={{ state, dispatch, canUndo, canRedo }}>{children}</Ctx.Provider>;
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
export function createBoard(genre: 'Shi' | 'Ci' | 'Free', ruleName: string, charCount: number, subGenre?: string): Board {
  if (genre === 'Free') {
    const isGuTi = subGenre === '古体诗';
    return {
      id: crypto.randomUUID(),
      title: isGuTi ? '新建·古体诗' : '新建·自由诗',
      genre: 'Free',
      subGenre,
      rhymeBookName: isGuTi ? 'Pingshuiyun' : 'Zhonghua_Tongyun',
      sections: [{
        id: crypto.randomUUID(),
        title: '',
        ruleName: subGenre ?? '自由',
        charCount: 0,
        poemChars: [],
        candidatesMap: {},
        lines: isGuTi ? ['', ''] : [''],
      }],
      inspirationCards: [],
      metadata: { rhymeBook: isGuTi ? 'Pingshuiyun' : 'Zhonghua_Tongyun', dateFormat: 'Gregorian' },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  }
  const defaultRhymeBook = genre === 'Shi' ? 'Pingshuiyun' : 'Cilinzhengyun';
  return {
    id: crypto.randomUUID(),
    title: `新建·${ruleName}`,
    genre,
    rhymeBookName: defaultRhymeBook,
    sections: [{
      id: crypto.randomUUID(),
      title: '',
      ruleName,
      charCount,
      poemChars: Array(charCount).fill(PLACEHOLDER),
      candidatesMap: {},
    }],
    inspirationCards: [],
    metadata: {
      rhymeBook: defaultRhymeBook,
      dateFormat: 'Gregorian',
    },
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}
