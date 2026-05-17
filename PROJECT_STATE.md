# Project State

## Current Goal
Ship a mobile markdown reader/editor with:
- local file management
- share-link backend
- explain-term (LLM) flow from preview selection

## Current Status
- Working implementation across `mobile/` (Expo RN + TypeScript) and `backend/` (FastAPI + SQLModel + SQLite).
- App includes editor/preview, share flow, mermaid/table viewers, and explain-term viewer with LLM chat.
- Navigation: React Navigation stack (`AppNavigator.tsx`), auth-gated via `AuthContext`.
- Theme: dark/light toggle through `ThemeContext`, brutalist UI component library (`BrutalButton`, `BrutalInput`, `BrutalSwitch`, `ConfirmModal`).
- Backend: JWT auth (7-day tokens), upload-based file serving, share link CRUD with batch operations, background cleanup task (hourly).
- LLM: pluggable provider system (`openai`/`anthropic`/`gemini`) with per-file term caching and daily usage limits.
- Tests: basic Jest setup with component smoke tests (`mobile/__tests__/`); no API integration tests yet.
- Agent memory files: `CLAUDE.md`, `AGENTS.md`, `DECISIONS.md`, `PROJECT_STATE.md`, `TODO.md` for cross-agent context sharing.
- Empty directories: `.agents/`, `.codex/`, `mobile/.agents/`, `mobile/.codex/` (scaffolding for agent integration), `mobile/src/types/` (no type definitions extracted yet).

## Codebase Structure
- `backend/`: FastAPI app (`app/main.py`), routers (`auth`, `share`, `view`, `explain`), services (explain + LLM providers), models (`user`, `share`, `explanation`), utils, SQLite DB file (`database.db`), uploads directory.
  - Two venvs present: `backend/venv/` and root `.venv/` (both gitignored).
- `mobile/`: Expo SDK 54 app with navigation/screens/components/api/context/constants/utils, Jest tests, EAS build config.
- `sample/`: `sample-markdown-full-test.md` for UI testing.
- `implement plans/`: planning documents (gitignored).
- Project memory files: `CLAUDE.md`, `AGENTS.md`, `DECISIONS.md`, `PROJECT_STATE.md`, `TODO.md`.

## Known Issues
- `backend/.env` has an invalid non-env line (`Continue Codex at "codex resume ..."`) causing `python-dotenv` parse warning at startup.
- `backend/.env.example` only documents `SECRET_KEY`; missing `LLM_PROVIDER`, `OPENAI_BASE_URL`, `OPENAI_API_KEY`, `GEMINI_API_KEY`, `ANTHROPIC_API_KEY`, `OPENAI_MODEL`, `LLM_MODEL`, `EXPLAIN_DAILY_LIMIT`.
- `mobile/.env.example` does not mention that `EXPO_PUBLIC_API_URL` can point to production URLs (e.g., Render) or explain the build-time binding behavior.
- App requires `EXPO_PUBLIC_API_URL` at build/runtime; missing value leads to network failures in auth/share/explain.
- Backend uses local SQLite file (`backend/database.db`) and local uploads; not production-grade persistence/scaling.
- Cleanup task removes links only when `expires_at < now - 7 days` (not immediately at expiry).
- CORS policy is wildcard `*`; fine for dev, should be tightened for production.
- `mobile/src/types/` directory exists but is empty; shared TypeScript types are inline in components rather than extracted.
- `mobile/src/constants/` is sparse (only `theme.ts`); other config constants (API URL, limits) are hardcoded or inline.

## Recent Changes
- 2026-05-17: Added project memory files (`AGENTS.md`, `CLAUDE.md`, `PROJECT_STATE.md`, `TODO.md`, `DECISIONS.md`) for shared agent context.
- 2026-05-17: Refactored mobile API client to dynamically strip trailing slashes from `EXPO_PUBLIC_API_URL`.
- 2026-05-17: Configured EAS build (`mobile/eas.json`), updated mobile app metadata, refactored auth to `x-www-form-urlencoded`.
- 2026-05-17: Added `/api/wakeup` endpoint and wired Expo project for EAS deployment.
- 2026-05-17: Explain flow includes per-file term cache + daily usage limit (`EXPLAIN_DAILY_LIMIT`) + renew path.
- 2026-05-17: Mermaid/Table external viewers support orientation toggle and native zoom controls.
- 2026-05-17: Added deploy/build helpers (`backend/requirements.txt`, `mobile/eas.json`).
