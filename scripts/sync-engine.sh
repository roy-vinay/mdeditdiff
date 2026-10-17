#!/usr/bin/env bash
# Copies the Mac app's real preview engine into demo/engine/, so the website demo runs the same
# code as the app. Usage: scripts/sync-engine.sh [release tag], default the latest release.
set -euo pipefail
cd "$(dirname "$0")/.."
TAG="${1:-$(curl -fsSL https://api.github.com/repos/roy-vinay/applied-ai-agents/releases/latest | sed -n 's/.*"tag_name": *"\([^"]*\)".*/\1/p')}"
BASE="https://raw.githubusercontent.com/roy-vinay/applied-ai-agents/$TAG/tools/mdeditdiff/app/Sources/MDEditDiffApp/Resources/Preview"
for f in preview.css preview.js pages.js annotations.js markdown-it.min.js mdeditdiff-diff.js THIRD_PARTY_LICENSES.txt; do
  curl -fsSL "$BASE/$f" -o "demo/engine/$f"
done
echo "$TAG" > demo/engine/VERSION
echo "Synced the preview engine from $TAG. preview.html and bridge.js are demo-specific and kept as they are."
