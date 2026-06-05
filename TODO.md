# TODO

## Done
- [x] Mobile stack implemented (Expo React Native + TS + React Navigation).
- [x] Backend stack implemented (FastAPI + SQLModel + JWT auth + SQLite).
- [x] Markdown edit/preview flow with save/autosave and undo/redo (edit mode).
- [x] Share link flow (create/list/revoke/batch revoke/revoke all) with public view/download endpoints.
- [x] Mermaid preview + full viewer (native zoom + orientation toggle).
- [x] Wide-table handling (preview card + show-here + external table viewer).
- [x] Explain-term flow from preview selection to backend LLM response with cache + daily limit.
- [x] Release build scaffolding (`mobile/eas.json`) and backend deploy dependency file (`backend/requirements.txt`).
- [x] API URL sanitization (trailing slash stripping in mobile client).
- [x] Auth refactored to `x-www-form-urlencoded` for mobile compatibility.
- [x] Backend `DATABASE_URL` support with SQLite fallback and Postgres URL normalization.
- [x] Storage abstraction implemented (`local`/`r2`) and integrated into share/view/cleanup flows.
- [x] `backend/.env.example` expanded with DB/storage/LLM env docs.
- [x] Markdown preview style pass in editor: highlight marker color, explicit bold/italic/link style, and monospace code rendering.
- [x] Added Home split view `Library | Device` (MVP).
- [x] Added scan-folder management in Settings and Android SAF markdown scanning utility.
- [x] Added Device-tab action to import scanned markdown into Library.
- [x] Fixed scanned-file import path for Android SAF (`content://`) reads.
- [x] Desktop Linux MVP scaffolded under `desktop/` (Tauri 2 + React) with open/save, edit/preview/split view, theme toggle, and recent files.

## Next Fixes (High Priority)
- [x] Implement native Android module `SafMetadataModule` after `expo prebuild` to return reliable SAF `lastModified`/`size`/`displayName` (done on `feat/android-file-metadata-saf`).
- [x] Build Linux desktop variant (Tauri + Vite + React) under `desktop/`, AppImage bundle, "Open With" .desktop for `text/markdown`.
- [ ] Verify Linux desktop install flow end-to-end on target distro: `scripts/install.sh` and right-click "Open With" registration after local AppImage build.
- [ ] Add user-facing warning/help text for SAF-restricted folders (Android scoped storage limitation).
- [ ] Define and implement backend upload-only endpoint if product requires “import => cloud upload immediately” without generating a share link.
- [ ] Persist Device scan index for larger folder sets (current MVP scans on demand).
- [ ] Verify on-device that italic text uses desired Grotesk variant; current app bundle loads Regular/Medium/Bold only (no explicit italic font file).
- [ ] Remove invalid non-env line from `backend/.env` (`Continue Codex at ...`).
- [ ] Expand `mobile/.env.example` to document production URL usage and the build-time binding behavior of `EXPO_PUBLIC_API_URL`.
- [ ] Add explicit startup/runtime validation for required mobile env (`EXPO_PUBLIC_API_URL`) with clear error messaging.
- [ ] Re-check share cleanup policy (`expires_at < now - 7 days`) and align behavior with intended expiry semantics.
- [ ] Add DB migration strategy for existing local SQLite data when switching to Postgres in production.
- [ ] Add one-time object migration utility from local `uploads/` to R2 for existing share records.

## Quality / Hardening
- [ ] Add integration tests for auth/share/explain API routes.
- [ ] Add migration path away from SQLite local file for production deployment.
- [ ] Tighten production CORS policy (currently wildcard `*`).
- [ ] Populate or remove empty `mobile/src/types/` directory; extract shared TypeScript interfaces from inline definitions.
- [ ] Consolidate virtual environments (both `backend/venv/` and root `.venv/` exist).
- [ ] Add CI pipeline (lint, type-check, test) for both mobile and backend.
