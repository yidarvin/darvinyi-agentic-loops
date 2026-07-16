#!/usr/bin/env bash
# Install the queue from this repository and start its LaunchAgent.
set -euo pipefail
umask 077

SOURCE_ROOT="$(CDPATH= cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
PLIST_NAME=com.darvin.agentic-loops-queue.plist
PLIST_SOURCE="$SOURCE_ROOT/scripts/$PLIST_NAME"
PLIST_TARGET="/Users/darvin/Library/LaunchAgents/$PLIST_NAME"
LABEL="gui/$(id -u)/com.darvin.agentic-loops-queue"
GIT_HELPER="$SOURCE_ROOT/scripts/pipeline-git.sh"
export PIPELINE_GIT_BIN="${PIPELINE_GIT_BIN:-/usr/bin/git}"
export PATH="$SOURCE_ROOT/scripts/service-bin:${PATH:-/usr/bin:/bin:/usr/sbin:/sbin}"
BRANCH="$("$GIT_HELPER" --repo "$SOURCE_ROOT" symbolic-ref --quiet --short HEAD)"

case "$BRANCH" in
  main|master) echo "installer: refusing protected branch '$BRANCH'" >&2; exit 2 ;;
esac

if launchctl print "$LABEL" >/dev/null 2>&1; then
  launchctl bootout "$LABEL"
fi

"$SOURCE_ROOT/scripts/pipeline_guard.py" --repo "$SOURCE_ROOT" branch >/dev/null
mkdir -p "$SOURCE_ROOT/.pipeline" /Users/darvin/Library/LaunchAgents

/usr/bin/install -m 600 "$PLIST_SOURCE" "$PLIST_TARGET"
launchctl bootstrap "gui/$(id -u)" "$PLIST_TARGET"

echo "queue worker installed from $SOURCE_ROOT on branch $BRANCH with $PIPELINE_GIT_BIN"
