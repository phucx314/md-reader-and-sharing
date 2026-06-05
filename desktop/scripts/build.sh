#!/usr/bin/env bash
# Build a release AppImage for MD Reader.
# Requires: rustc/cargo, pnpm, webkit2gtk-4.1, openssl, curl or wget.
set -euo pipefail
cd "$(dirname "$0")/.."

echo "==> Installing JS deps"
pnpm install

echo "==> Building release binary without Tauri bundling"
pnpm tauri build --no-bundle

echo "==> Packaging AppImage"
./scripts/package-appimage.sh

ARTIFACT_DIR="src-tauri/target/release/bundle"
echo
echo "Artifacts:"
ls -la "$ARTIFACT_DIR"/appimage/*.AppImage 2>/dev/null || true
