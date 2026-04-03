# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

南洋吟游·诗词创作画布 (Nanyang Poetry Canvas) — a Chinese classical poetry composition tool that validates tonal patterns (平仄) and rhyme schemes for Shi (诗) and Ci (词) forms. It provides character dictionary lookup, rhyme book browsing, and phrase/antithesis suggestions.

## Architecture

**Backend (Python/Flask, port 5050):**
- `app.py` — Main Flask server with all API routes (`/api/validate_meter`, `/api/char/lookup`, `/api/rhyme/lookup`, `/api/rhyme/list`, `/api/rules/list`, `/api/dictionary/search`)
- `checker.py` — `PoetryChecker` class: core tonal pattern and rhyme validation engine
- `config_loader.py` — Loads JSON config into structured dataclasses (`RuleSet`, `RhymeBook`, `RhymeCategory`)
- `prebuild.py` — Pre-deployment script that sorts rhyme characters by word frequency and builds traditional→simplified Chinese mapping (requires `wordfreq` and `opencc` libs, not needed at runtime)
- `static/config/` — JSON data files: `char_dict.json`, `rhyme_books.json`, `shi_rules.json`, `ci_rules.json`, `phrase_head.json`, `phrase_tail.json`, `phrase_pairs.json`, `t2s_map.json`

**Frontend (React 19 + TypeScript + Vite + Tailwind CSS 4, port 3000):**
- `frontend/src/App.tsx` — Root component
- `frontend/src/context/BoardContext.tsx` — Central state management via React Context
- `frontend/src/components/` — UI: `GridEditor` (main poetry input grid), `RhymePanel`, `Dictionary`, `GenreSelector`, `TopBar`, `InspirationBoard`
- `frontend/src/hooks/useValidation.ts` — Validation hook calling backend API
- `frontend/src/lib/api.ts` — API client; `types.ts` — shared type definitions; `storage.ts` — localStorage persistence

**Deployment (Vercel):**
- `vercel.json` — Routes `/api/*` to `api/index.py` (serverless Python), everything else to frontend static build
- `api/index.py` — Vercel serverless entry point, re-exports Flask `app`

## Common Commands

```bash
# Backend
pip install -r requirements.txt
python app.py                    # Starts Flask on port 5050

# Frontend
cd frontend
npm install
npm run dev                      # Vite dev server on port 3000, proxies /api to :5050
npm run build                    # TypeScript check + Vite production build
npm run lint                     # ESLint

# Pre-deployment data processing (requires wordfreq, opencc)
python prebuild.py
```

## Development Workflow

Run backend (`python app.py`) and frontend (`cd frontend && npm run dev`) simultaneously. The Vite dev server proxies `/api` requests to the Flask backend at localhost:5050.

## Key Concepts

- **Rhyme books (韵书):** Two supported: `Pingshuiyun` (平水韵) and `Cilin` (词林正韵)
- **Genres:** `Shi` (诗, regulated verse) and `Ci` (词, lyric poetry with cipai/词牌 templates)
- **Tone pattern (平仄):** Each character position has a required tonal category; `checker.py` validates against rule templates
- **Traditional→Simplified (繁→简):** Characters are normalized via `t2s_map.json` for dictionary lookup
