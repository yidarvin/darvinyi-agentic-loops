#!/usr/bin/env bash
# Install the queue into an unprotected worker clone and start its LaunchAgent.
set -euo pipefail
umask 077

SOURCE_ROOT="$(CDPATH= cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
WORKER_ROOT=/Users/darvin/.local/share/darvinyi-agentic-loops-worker
PLIST_NAME=com.darvin.agentic-loops-queue.plist
PLIST_SOURCE="$WORKER_ROOT/scripts/$PLIST_NAME"
PLIST_TARGET="/Users/darvin/Library/LaunchAgents/$PLIST_NAME"
LABEL="gui/$(id -u)/com.darvin.agentic-loops-queue"
BRANCH="$(git -C "$SOURCE_ROOT" symbolic-ref --quiet --short HEAD)"
REMOTE="$(git -C "$SOURCE_ROOT" remote get-url origin)"

case "$BRANCH" in
  main|master) echo "installer: refusing protected branch '$BRANCH'" >&2; exit 2 ;;
esac

if launchctl print "$LABEL" >/dev/null 2>&1; then
  launchctl bootout "$LABEL"
fi

if [[ -e "$WORKER_ROOT" && ! -d "$WORKER_ROOT/.git" ]]; then
  echo "installer: $WORKER_ROOT exists but is not a Git clone" >&2
  exit 2
fi

if [[ ! -d "$WORKER_ROOT/.git" ]]; then
  mkdir -p "$(dirname "$WORKER_ROOT")"
  git clone --branch "$BRANCH" --single-branch "$REMOTE" "$WORKER_ROOT"
else
  "$WORKER_ROOT/scripts/pipeline_guard.py" --repo "$WORKER_ROOT" branch >/dev/null
  if "$WORKER_ROOT/scripts/pipeline_guard.py" --repo "$WORKER_ROOT" has-changes; then
    echo "installer: worker clone is dirty; refusing to overwrite it" >&2
    exit 2
  fi
  git -C "$WORKER_ROOT" fetch origin "$BRANCH"
  git -C "$WORKER_ROOT" checkout "$BRANCH"
  git -C "$WORKER_ROOT" merge --ff-only "origin/$BRANCH"
fi

if [[ "$(git -C "$WORKER_ROOT" rev-parse HEAD)" != "$(git -C "$SOURCE_ROOT" rev-parse HEAD)" ]]; then
  echo "installer: worker clone does not match the source HEAD; push the source branch first" >&2
  exit 2
fi

mkdir -p "$SOURCE_ROOT/.pipeline" /Users/darvin/Library/LaunchAgents
POINTER_TEMP="$SOURCE_ROOT/.pipeline/worker-root.$$.tmp"
printf '%s\n' "$WORKER_ROOT" >"$POINTER_TEMP"
mv "$POINTER_TEMP" "$SOURCE_ROOT/.pipeline/worker-root"

/usr/bin/install -m 600 "$PLIST_SOURCE" "$PLIST_TARGET"
launchctl bootstrap "gui/$(id -u)" "$PLIST_TARGET"

echo "queue worker installed from $WORKER_ROOT on branch $BRANCH"
