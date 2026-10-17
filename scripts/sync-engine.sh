#!/usr/bin/env bash
# Copies the Mac app's real preview engine into demo/engine/, so the website demo runs the same
# code as the app. The engine lives in this repository, so this copies from app/ directly.
set -euo pipefail
cd "$(dirname "$0")/.."
SRC="app/Sources/MDEditDiffApp/Resources/Preview"
for f in preview.css preview.js pages.js annotations.js markdown-it.min.js mdeditdiff-diff.js THIRD_PARTY_LICENSES.txt; do
  cp "$SRC/$f" "demo/engine/$f"
done
VERSION="v$(node -p "require('./package.json').version")"
echo "$VERSION" > demo/engine/VERSION
echo "Synced the preview engine from $VERSION. preview.html and bridge.js are demo-specific and kept as they are."
