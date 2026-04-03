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

**CLI (pip-installable):**
- `cli.py` — Entry point (`fangcun`), subcommands: `validate`, `rules`, `char`, `rhyme`, `suggest`, `key`
- `pyproject.toml` — Package config, entry point `fangcun = "cli:main"`

**API Security & Monitoring:**
- `api_keys.py` — API Key management, dual backend (SQLite local / Postgres production via `POSTGRES_URL`)
- `app.py` middleware — Rate limiting (flask-limiter, memory://), API Key auth, input validation, security headers
- Same-origin requests (frontend) bypass API Key auth; external calls require `X-API-Key` header
- `static/dashboard.html` — Admin dashboard at `/dashboard`, shows call stats by date/route/source
- `static/docs.html` — API documentation at `/docs`
- Stats endpoints: `GET /api/_stats/routes`, `GET /api/_stats/keys` (exempt from auth)

**Deployment (Vercel):**
- `vercel.json` — Routes `/api/*`, `/docs`, `/dashboard` to `api/index.py` (serverless Python), everything else to frontend static build
- `api/index.py` — Vercel serverless entry point, re-exports Flask `app`
- Production DB: Vercel Postgres (Neon), env var `POSTGRES_URL` auto-injected
- Production URL: https://write.sjtuguoxue.space

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

# CLI
pip install -e .                 # Install CLI locally
fangcun validate --text "白日依山尽..." --genre Shi
fangcun key create --name "user" # Create API Key (needs POSTGRES_URL for prod)
fangcun key list                 # List all keys
fangcun key stats                # View route call stats
fangcun key stats --date 2026-04-02  # Filter by date (UTC+8)

# Deploy
vercel --prod                    # Deploy to production

# Test production API
FANGCUN_API_KEY=fc_xxx bash test_api.sh

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

## Git & Deployment Workflow

- Repo: `github.com/lyy0323/fangcun` (private)
- Deploy: `vercel --prod`
- **每次部署前必须 review：**
  - `static/docs.html` — API 文档（限额、参数、返回值必须与代码一致）
  - `CHANGELOG.md` — 重要功能变更需记录，小改动可省略
  - `frontend/src/components/TopBar.tsx` — 设置面板中的更新日志（与 CHANGELOG 同步）
- 部署后用 `test_api.sh` 验证生产环境
