#!/usr/bin/env bash
# One durable, non-overlapping queue tick for launchd or manual scheduling.
set -euo pipefail

ROOT="$(CDPATH= cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
mkdir -p .pipeline
LOCK=.pipeline/queue-worker.lock
LOG=.pipeline/queue-worker.log

if ! mkdir "$LOCK" 2>/dev/null; then
  exit 0
fi
trap 'rmdir "$LOCK"' EXIT

{
  date '+%Y-%m-%dT%H:%M:%S%z queue worker tick'

  # A known delayed Chapter 10 build is parked until Chapter 9 is independently
  # approved. Restore it only when it is again the active build target.
  next="$(python3 scripts/decide.py next)"
  if [[ "$next" == "build skills" ]] && git stash list | rg -q 'wip: delayed Terra skills build'; then
    git stash pop
    TERRA_SANDBOX=danger-full-access ./run.sh next --allow-dirty --retries 3 --push
  elif [[ -n "$(git status --porcelain)" ]]; then
    echo 'queue worker: dirty worktree; preserving changes and stopping'
    exit 0
  else
    TERRA_SANDBOX=danger-full-access ./run.sh next --retries 3 --push
  fi
} >>"$LOG" 2>&1
