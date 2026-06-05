#!/usr/bin/env bash
# Manually package the Tauri binary into an AppImage.
# This bypasses `tauri build`'s bundling step, which currently fails in this
# project when linuxdeploy/appimagetool cannot reconcile the generated icon name
# or fetch the AppImage runtime automatically.
set -euo pipefail
cd "$(dirname "$0")/.."

BIN="src-tauri/target/release/md-reader"
if [ ! -f "$BIN" ]; then
  echo "Binary not found at $BIN. Run: pnpm tauri build --no-bundle" >&2
  exit 1
fi

OUT_DIR="src-tauri/target/release/bundle"
APPDIR="$OUT_DIR/MDReader.AppDir"
rm -rf "$APPDIR"
mkdir -p "$APPDIR/usr/bin" "$APPDIR/usr/libexec" "$APPDIR/usr/share/applications" "$APPDIR/usr/share/icons/hicolor/256x256/apps" "$APPDIR/usr/share/icons/hicolor/128x128/apps" "$APPDIR/usr/share/icons/hicolor/32x32/apps"

cp "$BIN" "$APPDIR/usr/bin/md-reader"

# Copy webkit2gtk-4.1 helper processes (WebKitNetworkProcess etc.) from system.
# WebKit helper processes live under /usr/libexec/webkit2gtk-4.1 on Fedora.
# Keep the same relative layout inside the AppImage and point WebKit at it
# explicitly from AppRun so the bundled binary does not fall back to a broken
# relative "././/libexec/..." lookup.
if [ -d /usr/libexec/webkit2gtk-4.1 ]; then
  cp -a /usr/libexec/webkit2gtk-4.1 "$APPDIR/usr/libexec/"
fi
if [ -d /usr/lib64/webkit2gtk-4.1/injected-bundle ]; then
  mkdir -p "$APPDIR/usr/lib/webkit2gtk-4.1"
  cp -a /usr/lib64/webkit2gtk-4.1/injected-bundle "$APPDIR/usr/lib/webkit2gtk-4.1/"
fi

# WebKit's fallback lookup inside AppImage can resolve helpers from
# ./libexec/webkit2gtk-4.1 relative to the AppDir root. Mirror the usual
# usr/ layout there so both lookup styles work.
ln -sfn usr/libexec "$APPDIR/libexec"
ln -sfn usr/lib "$APPDIR/lib"
cp "src-tauri/icons/icon.png" "$APPDIR/usr/share/icons/hicolor/256x256/apps/md-reader.png"
cp "src-tauri/icons/icon.png" "$APPDIR/md-reader.png"
cp "src-tauri/icons/128x128.png" "$APPDIR/usr/share/icons/hicolor/128x128/apps/md-reader.png"
cp "src-tauri/icons/32x32.png" "$APPDIR/usr/share/icons/hicolor/32x32/apps/md-reader.png"

cat > "$APPDIR/md-reader.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=MD Reader
GenericName=Markdown Reader
Comment=Brutalist markdown reader
Exec=md-reader %f
Icon=md-reader
Terminal=false
Categories=Utility;TextEditor;
MimeType=text/markdown;text/x-markdown;application/markdown;
Keywords=markdown;md;reader;editor;
StartupWMClass=md-reader
EOF

cat > "$APPDIR/AppRun" <<'EOF'
#!/usr/bin/env bash
# AppImage runtime: prefer bundled libs (AppDir/usr/lib), then system.
SELF_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SELF_DIR"
export LD_LIBRARY_PATH="$SELF_DIR/usr/lib:${LD_LIBRARY_PATH:-}"
export WEBKIT_EXEC_PATH="$SELF_DIR/usr/libexec"
export WEBKIT_INJECTED_BUNDLE_PATH="$SELF_DIR/usr/lib/webkit2gtk-4.1/injected-bundle"
exec "$SELF_DIR/usr/bin/md-reader" "$@"
EOF
chmod +x "$APPDIR/AppRun"

export APPIMAGE_EXTRACT_AND_RUN=1
export NO_STRIP=1
LINUXDEPLOY="$HOME/.cache/tauri/linuxdeploy-x86_64.AppImage"
PLUGIN_APPIMAGE="$HOME/.cache/tauri/linuxdeploy-plugin-appimage.AppImage"
RUNTIME_FILE="$HOME/.cache/tauri/runtime-x86_64"
if [ ! -x "$LINUXDEPLOY" ]; then
  echo "linuxdeploy not found in cache. Re-run tauri build once to cache it." >&2
  exit 1
fi
if [ ! -f "$PLUGIN_APPIMAGE" ]; then
  echo "linuxdeploy-plugin-appimage not found in cache. Re-run tauri build once to cache it." >&2
  exit 1
fi

if [ ! -f "$RUNTIME_FILE" ]; then
  echo "==> Downloading AppImage runtime"
  if command -v curl >/dev/null 2>&1; then
    curl -L "https://github.com/AppImage/type2-runtime/releases/download/continuous/runtime-x86_64" -o "$RUNTIME_FILE"
  elif command -v wget >/dev/null 2>&1; then
    wget -O "$RUNTIME_FILE" "https://github.com/AppImage/type2-runtime/releases/download/continuous/runtime-x86_64"
  else
    echo "Need curl or wget to download $RUNTIME_FILE" >&2
    exit 1
  fi
fi

APPDIR_ABS="$(cd "$APPDIR" && pwd)"
OUT_DIR_ABS="$(cd "$OUT_DIR" && pwd)"
APPIMAGE_OUT="$OUT_DIR_ABS/appimage/MDReader_0.1.0_amd64.AppImage"
PLUGIN_EXTRACT_DIR="$(mktemp -d /tmp/md-reader-plugin-XXXXXX)"
trap 'rm -rf "$PLUGIN_EXTRACT_DIR"' EXIT

echo "==> Bundling GTK/WebKit dependencies into AppDir"
"$LINUXDEPLOY" \
  --appdir "$APPDIR_ABS" \
  --plugin gtk \
  --desktop-file "$APPDIR_ABS/md-reader.desktop" \
  --icon-file "$APPDIR_ABS/md-reader.png" \
  --icon-filename md-reader

cat > "$APPDIR/AppRun" <<'EOF'
#!/usr/bin/env bash
# AppImage runtime: prefer bundled libs (AppDir/usr/lib), then system.
SELF_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SELF_DIR"
export LD_LIBRARY_PATH="$SELF_DIR/usr/lib:${LD_LIBRARY_PATH:-}"
export WEBKIT_EXEC_PATH="$SELF_DIR/usr/libexec"
export WEBKIT_INJECTED_BUNDLE_PATH="$SELF_DIR/usr/lib/webkit2gtk-4.1/injected-bundle"
exec "$SELF_DIR/usr/bin/md-reader" "$@"
EOF
chmod +x "$APPDIR/AppRun"

echo "==> Extracting AppImage plugin tools"
(
  cd "$PLUGIN_EXTRACT_DIR"
  "$PLUGIN_APPIMAGE" --appimage-extract >/dev/null
)

echo "==> Packaging AppImage"
mkdir -p "$OUT_DIR_ABS/appimage"
"$PLUGIN_EXTRACT_DIR/squashfs-root/usr/bin/appimagetool" \
  --runtime-file "$RUNTIME_FILE" \
  "$APPDIR_ABS" \
  "$APPIMAGE_OUT"

echo "Built: $APPIMAGE_OUT"
ls -lh "$APPIMAGE_OUT"
