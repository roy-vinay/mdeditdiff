#!/bin/bash
# Cross-session, cross-tool example: Claude Code, Codex and a person share plan.md over three days.
# Each "session" is a separate process; the only thing that carries over is mdEditDiff's history.
# Compare with git: a commit is one baseline for everyone, while mdEditDiff keeps one per reader.
# Runs in a temporary folder with its own history and git repo, so it never touches your files.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
if [ -f "$HERE/../dist/src/cli.js" ]; then MDD=(node "$HERE/../dist/src/cli.js"); else MDD=(mdeditdiff); fi
mdeditdiff() { "${MDD[@]}" "$@"; }

WORK="$(mktemp -d)"
export MDEDITDIFF_HOME="$WORK/.history"
cd "$WORK"
cp "$HERE/plan.md" plan.md
git init -q && git -c user.name=demo -c user.email=demo@example.com commit -q --allow-empty -m init

say()  { printf '\n\033[1;36m# %s\033[0m\n' "$*"; }
edit() { perl -0pi -e "$1" plan.md; }

say "Monday. A Claude Code session writes the plan and checks it in, and the plan is committed to git."
mdeditdiff checkpoint plan.md --author claude-code --note "First plan"
git add plan.md && git -c user.name=demo -c user.email=demo@example.com commit -q -m "Plan"
say "Monday. A Codex session and you each read it once (first look: the full text)."
mdeditdiff seen plan.md --reader codex
mdeditdiff seen plan.md --reader you

say "Tuesday. You fix step 2 in your editor and tell no one. Nothing is committed."
edit 's/2\. Build the CSV on the server\./2. Build the CSV on the server, streaming rows so large reports never time out./'
say "Tuesday. A new Codex session asks what changed since Codex last looked, then proposes a row limit."
mdeditdiff changes plan.md --reader codex | head -2
edit 's/- What is the row limit\?/- What is the row limit? Proposed: 100,000 rows./'
mdeditdiff checkpoint plan.md --author codex --note "Proposed a row limit"

say "Wednesday. A new Claude Code session asks what changed since Claude Code last looked."
mdeditdiff changes plan.md --reader claude-code
say "Wednesday. You ask too. You see both changes. Your own edit shows as \"changed outside, not reported\" because you didn't check it in: mdEditDiff only knows who made a change when the writer says so."
mdeditdiff changes plan.md --reader you | head -2

say "For comparison, git: one baseline (the commit) for everyone, and no record of who read what."
git --no-pager diff --stat
mdeditdiff history plan.md | tail -1
