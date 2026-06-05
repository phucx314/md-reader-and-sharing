# Project State

## Current Goal
Ship a mobile markdown reader/editor (Expo RN + FastAPI), plus a Linux desktop variant (Tauri + React) for offline single-file use:
- mobile: local file management, share-link backend, explain-term (LLM) flow
- desktop (NEW): Tauri AppImage on Ubuntu/Debian x86_64, "Open With" integration for .md files, core edit+preview, dark/light theme, talks to the hosted FastAPI backend (no local backend)

## Current Status
- Working implementation across `mobile/` (Expo RN + TypeScript) and `backend/` (FastAPI + SQLModel + SQLite).
- `desktop/` Linux variant scaffolded with Tauri 2 + React + TypeScript; frontend build, Rust `cargo check`, and manual AppImage packaging pass locally.
- App includes editor/preview, share flow, mermaid/table viewers, and explain-term viewer with LLM chat.
- Navigation: React Navigation stack (`AppNavigator.tsx`), auth-gated via `AuthContext`.
- Theme: dark/light toggle through `ThemeContext`, brutalist UI component library (`BrutalButton`, `BrutalInput`, `BrutalSwitch`, `ConfirmModal`).
- Backend: JWT auth (7-day tokens), share link CRUD with batch operations, background cleanup task (hourly), provider-based storage (`local`/`r2`), Postgres-ready DB URL support.
- LLM: pluggable provider system (`openai`/`anthropic`/`gemini`) with per-file term caching and daily usage limits.
- Tests: basic Jest setup with component smoke tests (`mobile/__tests__/`); no API integration tests yet.
- Home now has `Library` and `Device` sub views (MVP split).
- Device scan support added (Android SAF folder selection + markdown scan utility + Settings management).
- Desktop app supports single-file open/save, edit/preview/split view, theme toggle, CLI/open-with file path handling, and recent-files persistence.
- Desktop AppImage artifact verified at `desktop/src-tauri/target/release/bundle/appimage/MDReader_0.1.0_amd64.AppImage`.
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
- `mobile/.env.example` does not mention that `EXPO_PUBLIC_API_URL` can point to production URLs (e.g., Render) or explain the build-time binding behavior.
- App requires `EXPO_PUBLIC_API_URL` at build/runtime; missing value leads to network failures in auth/share/explain.
- Backend can use `DATABASE_URL` (Postgres-ready), but default local path is still SQLite file (`backend/database.db`) and local uploads.
- Cleanup task removes links only when `expires_at < now - 7 days` (not immediately at expiry).
- CORS policy is wildcard `*`; fine for dev, should be tightened for production.
- `mobile/src/types/` directory exists but is empty; shared TypeScript types are inline in components rather than extracted.
- `mobile/src/constants/` is sparse (only `theme.ts`); other config constants (API URL, limits) are hardcoded or inline.

## Recent Changes
- 2026-05-18: Device scan now supports recursive “scan all subfolders” toggle from Settings.
- 2026-05-18: Fixed scanned filename normalization (SAF document IDs no longer leak full path into local filename), preventing import write failures.
- 2026-05-18: Fixed Device->Library import for scanned files by using SAF read API for `content://` URIs and ensuring library directory creation before write.
- 2026-05-18: Added `implement plans/11-20260518-library-device-scan-split-plan.vi.md`.
- 2026-05-18: Implemented Home `Library | Device` switch and Device-file import to Library.
- 2026-05-18: Added `mobile/src/utils/deviceScan.ts` and Settings actions for scan folders/rescan.
- 2026-05-18: Added `backend/seed_test_users.py` for non-destructive test-user upsert seeding (bypasses API payload validation by writing hashed passwords directly at DB layer).
- 2026-05-18: Home FAB press interaction now uses animated press-in/press-out transitions (matching `BrutalButton` feel): smooth translate + shadow fade instead of boolean jump.
- 2026-05-18: Markdown preview rendering updated in `EditorScreen`:
  - `==highlight==` now rendered by custom text rule with yellow background (no HTML tag dependency).
  - Bold/italic/link styles explicitly set in markdown styles.
  - Code block + inline code switched to monospace font in preview.
  - Heading-1 spacing/line-height adjusted to reduce clipping around divider.
  - Space Grotesk package confirmed to have no italic face; italic preview uses Grotesk-preserving skew style to avoid system-font fallback mismatch.
- 2026-05-17: Added project memory files (`AGENTS.md`, `CLAUDE.md`, `PROJECT_STATE.md`, `TODO.md`, `DECISIONS.md`) for shared agent context.
- 2026-05-17: Refactored mobile API client to dynamically strip trailing slashes from `EXPO_PUBLIC_API_URL`.
- 2026-05-17: Configured EAS build (`mobile/eas.json`), updated mobile app metadata, refactored auth to `x-www-form-urlencoded`.
- 2026-05-17: Added `/api/wakeup` endpoint and wired Expo project for EAS deployment.
- 2026-05-17: Explain flow includes per-file term cache + daily usage limit (`EXPLAIN_DAILY_LIMIT`) + renew path.
- 2026-05-17: Mermaid/Table external viewers support orientation toggle and native zoom controls.
- 2026-05-17: Added deploy/build helpers (`backend/requirements.txt`, `mobile/eas.json`).
- 2026-05-17: Added storage abstraction service (`app/services/storage.py`) with `STORAGE_PROVIDER=local|r2`.
- 2026-05-17: Share/View/Cleanup flows now use provider-based object IO with backward compatibility for legacy local records.
- 2026-05-17: Added `DATABASE_URL` support and Postgres URL normalization (`postgresql+psycopg://`).
- 2026-05-17: Expanded `backend/.env.example` with DB, storage, and LLM-related env keys.
- 2026-06-05: Desktop app empty state now includes recent files (persisted in `localStorage`) and desktop `.gitignore` now excludes TS build artifacts.
- 2026-06-05: Built Linux AppImage successfully via `desktop/scripts/package-appimage.sh` after bypassing Tauri's failing `linuxdeploy` bundle path; `desktop/scripts/build.sh` now uses `tauri build --no-bundle` + manual package step.
- 2026-06-05: Fixed AppImage runtime launch for WebKitGTK by packaging helper processes under `usr/libexec`, mirroring `libexec`/`lib` at AppDir root, and `cd`-ing into the AppImage root from `AppRun` before launching `md-reader`.
