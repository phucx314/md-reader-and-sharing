# Decisions

## 2026-05-17: Use file-based project memory
Decision:
- Use AGENTS.md, CLAUDE.md, PROJECT_STATE.md, TODO.md, and DECISIONS.md as shared context between Codex and Claude Code.

Reason:
- Codex and Claude Code cannot share sessions directly.
- Markdown files are durable, git-trackable, and readable by all agents.

## 2026-06-05: Add Linux desktop variant via Tauri (not Electron / not a RN port)
Decision:
- Build a separate `desktop/` app: Tauri 2 (Rust) + Vite + React + TypeScript.
- MVP scope: single-file open/save, edit+preview, dark/light theme, "Open With" integration on Linux, AppImage bundle.
- Use the already-deployed FastAPI backend (Render) — no local backend bundled.
- Do NOT port the mobile app directly; rewrite the frontend for web (react-markdown + remark-gfm + mermaid) because the mobile UI leans on `expo-file-system`, `react-native-webview`, and Android SAF which do not apply on desktop.

Reason:
- Tauri gives a small (~5–10 MB) Linux binary with native .desktop / MIME / single-instance support out of the box; AppImage bundling is a one-liner via `tauri build --bundles appimage`.
- Mobile UI stack (Expo RN, AsyncStorage, WebView, SAF) does not translate to desktop without a near-total rewrite; a clean web frontend is faster and more maintainable.
- Backend is already public and supports the only features that survive the cut (none for MVP — open/save is local-only; future share/explain can reuse the same API).

## 2026-06-05: "Open With" integration via .desktop MIME registration, not DBus activatable
Decision:
- Ship a `.desktop` file with `MimeType=text/markdown;` and `Exec=md-reader %f` and install it to `~/.local/share/applications/`.
- AppImage itself is a single-file executable that takes the file path as `argv[1]`; Tauri reads CLI args on startup and emits an event to the frontend.

Reason:
- AppImage already supports `Exec=` field in its bundled `.desktop`, so file managers (Nautilus, Dolphin, Thunar, Nemo) will auto-pick it up after `update-desktop-database`.
- DBusActivatable would need a D-Bus service definition; overkill for a single-file app.
- This matches the user's request: "open with" via right-click on .md.

## 2026-06-05: Persist desktop recent files locally in the frontend
Decision:
- Store the desktop app's recent file paths in browser `localStorage`, capped to a short MRU list.
- Update the MRU list only after successful open/save operations and render it in the empty state for fast reopen.

Reason:
- Recent files are frontend-only UI state; they do not need Rust-side persistence or backend sync.
- `localStorage` keeps the MVP simple and survives restarts without introducing another dependency or file format.

## 2026-06-05: Build AppImage via manual packaging script, not `tauri build` bundling
Decision:
- Use `pnpm tauri build --no-bundle` to produce the release binary, then package AppImage through `desktop/scripts/package-appimage.sh`.
- In the package script, run cached `linuxdeploy` only for GTK/WebKit dependency deployment, then run `appimagetool` directly with a cached/downloaded AppImage runtime file.
- In `AppRun`, change directory to the AppImage root before launching the bundled binary, and keep root-level `libexec` / `lib` symlinks for WebKitGTK helper lookup compatibility.

Reason:
- In this project, the default Tauri AppImage bundle path fails on Linux because the generated AppDir icon name does not match the desktop file icon key, and `appimagetool` may also fail while auto-downloading the runtime.
- The manual packaging path is deterministic, keeps the lowercase `md-reader` icon naming consistent, and produced a working artifact locally on 2026-06-05.
