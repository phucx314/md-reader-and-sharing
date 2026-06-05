# MD Reader — Linux Desktop

Brutalist markdown reader/editor for Linux. Built with **Tauri 2** (Rust) + **Vite + React + TypeScript**.

Designed to be a near-zero-config native desktop companion to the existing mobile app in this monorepo. MVP scope: open, edit, preview, save `.md` files. Dark/light theme. **"Open With" integration** so right-clicking a `.md` file in any file manager launches it.

## Layout

```
desktop/
├── src/                  React frontend
├── src-tauri/            Tauri (Rust) backend
│   ├── src/lib.rs        Tauri commands + CLI arg handling
│   ├── tauri.conf.json   App + bundle config
│   └── capabilities/     Permission allowlists
├── scripts/
│   ├── build.sh          Build AppImage + .deb
│   └── install.sh        Install to ~/.local and register MIME
├── index.html
├── package.json
└── vite.config.ts
```

## Prerequisites (Fedora 43)

```bash
sudo dnf install -y webkit2gtk4.1-devel openssl-devel curl wget file \
  libappindicator-gtk3-devel librsvg2-devel gcc gcc-c++ make
```

And Rust:

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
. "$HOME/.cargo/env"
```

## Build

```bash
cd desktop
pnpm install
pnpm tauri:build
# or:
./scripts/build.sh
```

Outputs land in `src-tauri/target/release/bundle/`:

- `appimage/md-reader_<version>_amd64.AppImage` — single-file portable
- `deb/md-reader_<version>_amd64.deb`

## Install + register "Open With"

```bash
./scripts/install.sh
```

That:

1. Copies the AppImage to `~/.local/bin/md-reader`.
2. Drops a `.desktop` file at `~/.local/share/applications/md-reader.desktop` with `MimeType=text/markdown;...` and `Exec=… %f`.
3. Installs the icon at `~/.local/share/icons/hicolor/256x256/apps/md-reader.png`.
4. Refreshes `update-desktop-database` and runs `xdg-mime default` for `text/markdown`.

After this, in Nautilus / Dolphin / Thunar / Nemo, right-click any `.md` file → **Open With → MD Reader**.

To set it as the **default** markdown app:

```bash
xdg-mime default md-reader.desktop text/markdown
```

## Dev

```bash
cd desktop
pnpm tauri:dev
```

## How "Open With" works

When a file manager launches `md-reader /path/to/file.md`:

1. The Tauri Rust process reads `argv[1]`, stashes the path in a `Lazy<Mutex<Option<String>>>` static.
2. On startup, the frontend calls `get_initial_file` to fetch the stashed path.
3. Subsequent opens from the same instance (e.g. drag-and-drop) hit the `open-file` event listener wired in `App.tsx`.
4. The backend `read_text_file` / `write_text_file` commands do the actual FS work, scoped by Tauri's permissions.

## License

Same as parent project.
