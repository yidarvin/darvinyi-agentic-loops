#!/usr/bin/env bash
# One durable, non-overlapping queue tick for launchd or manual scheduling.
set -euo pipefail

# launchd supplies a minimal PATH; Terra's CLI is installed per user.
export PATH="$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"

ROOT="$(CDPATH= cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
mkdir -p .pipeline
LOCK=.pipeline/queue-worker.lock
LOG=.pipeline/queue-worker.log

if ! mkdir "$LOCK" 2>/dev/null; then
  exit 0
fi
trap 'rmdir "$LOCK"' EXIT

recover_delayed_output() {
  [[ -n "$(git status --porcelain)" ]] || return 1
  echo 'queue worker: validating delayed Terra output'
  npm run check
  git add -A
  git commit -m 'recover(queue): delayed Terra stage'
  git push -u origin HEAD
}

{
  date '+%Y-%m-%dT%H:%M:%S%z queue worker tick'

  # A nested Terra process can finish its filesystem writes just after run.sh
  # returns. Give it a bounded settle window, then turn only gate-passing output
  # into a commit before selecting another stage.
  for _ in {1..6}; do
    if recover_delayed_output; then
      echo 'queue worker: recovered delayed stage; continuing immediately'
    fi

  # A known delayed Chapter 10 build is parked until Chapter 9 is independently
  # approved. Restore it only when it is again the active build target.
    next="$(python3 scripts/decide.py next)"
    if [[ "$next" == "done" ]]; then
      echo 'queue worker: queue drained'
      exit 0
    elif [[ "$next" == "build skills" ]] && git stash list | rg -q 'wip: delayed Terra skills build'; then
      git stash pop
      TERRA_SANDBOX=danger-full-access ./run.sh next --allow-dirty --retries 3 --push || true
    elif [[ -n "$(git status --porcelain)" ]]; then
      echo 'queue worker: non-recoverable dirty worktree; stopping'
      exit 1
    else
      TERRA_SANDBOX=danger-full-access ./run.sh next --retries 3 --push || true
    fi

    for _ in {1..6}; do
      sleep 10
      if [[ -n "$(git status --porcelain)" ]]; then
        recover_delayed_output
        break
      fi
    done
  done
} >>"$LOG" 2>&1
