#!/usr/bin/env bash
# Install the built AppImage to ~/.local/bin and register a .desktop file
# with MimeType=text/markdown so file managers show MD Reader under "Open With".
set -euo pipefail
cd "$(dirname "$0")/.."

APPIMAGE="$(ls -1 src-tauri/target/release/bundle/appimage/*.AppImage 2>/dev/null | head -1 || true)"
if [ -z "$APPIMAGE" ] || [ ! -f "$APPIMAGE" ]; then
  echo "No AppImage found in src-tauri/target/release/bundle/appimage/. Run scripts/build.sh first." >&2
  exit 1
fi

DEST_BIN="$HOME/.local/bin/md-reader"
mkdir -p "$HOME/.local/bin" "$HOME/.local/share/applications" "$HOME/.local/share/icons/hicolor/256x256/apps"
install -m 0755 "$APPIMAGE" "$DEST_BIN"

ICON_SRC="$(ls -1 src-tauri/target/release/bundle/appimage/*.png 2>/dev/null | head -1 || true)"
if [ -z "$ICON_SRC" ]; then
  ICON_SRC="src-tauri/icons/icon.png"
fi
install -m 0644 "$ICON_SRC" "$HOME/.local/share/icons/hicolor/256x256/apps/md-reader.png"

cat > "$HOME/.local/share/applications/md-reader.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=MD Reader
GenericName=Markdown Reader
Comment=Brutalist markdown reader
Exec=$DEST_BIN %f
Icon=md-reader
Terminal=false
Categories=Utility;TextEditor;Office;
MimeType=text/markdown;text/x-markdown;application/markdown;
Keywords=markdown;md;reader;editor;
StartupWMClass=md-reader
EOF

# Refresh desktop / icon / MIME caches
if command -v update-desktop-database >/dev/null; then
  update-desktop-database "$HOME/.local/share/applications" || true
fi
if command -v gtk-update-icon-cache >/dev/null; then
  gtk-update-icon-cache -f -t "$HOME/.local/share/icons/hicolor" || true
fi
if command -v xdg-mime >/dev/null; then
  xdg-mime default md-reader.desktop text/markdown || true
fi

echo "Installed:"
echo "  Binary : $DEST_BIN"
echo "  .desktop: $HOME/.local/share/applications/md-reader.desktop"
echo "  Icon   : $HOME/.local/share/icons/hicolor/256x256/apps/md-reader.png"
echo
echo "Now right-click any .md file → Open With → MD Reader."
