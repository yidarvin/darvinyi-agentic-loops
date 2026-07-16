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
STATUS=.pipeline/queue-worker.status

if ! mkdir "$LOCK" 2>/dev/null; then
  exit 0
fi
trap 'rmdir "$LOCK"' EXIT

terra_active() {
  pgrep -f "codex .* -C $ROOT exec" >/dev/null 2>&1
}

report_status() {
  printf '%s\t%s\n' "$(date '+%Y-%m-%dT%H:%M:%S%z')" "$1" >"$STATUS"
  echo "queue worker: $1"
}

recover_delayed_output() {
  [[ -n "$(git status --porcelain)" ]] || return 1
  report_status 'validating completed asynchronous Terra output'
  TERRA_SANDBOX=danger-full-access ./run.sh recover --push
}

clear_empty_lease() {
  [[ -f .pipeline/active-stage ]] || return 0
  [[ -z "$(git status --porcelain)" ]] || return 0
  report_status 'previous Terra stage exited without changes; clearing lease for a fresh attempt'
  rm -f .pipeline/active-stage
}

{
  date '+%Y-%m-%dT%H:%M:%S%z queue worker tick'

  # Never launch a second model context for this repository while the first is
  # still alive. The nested desktop launcher can return early, so this guard is
  # the durable handoff boundary between launchd ticks.
  if terra_active; then
    report_status 'Terra stage is active; waiting for it to finish'
    exit 0
  fi

  clear_empty_lease

  # A finished nested Terra process can leave valid writes after run.sh returns.
  # Recover only the recorded chapter-scoped stage, then continue immediately.
  for _ in {1..6}; do
    if recover_delayed_output; then
      report_status 'recovered asynchronous Terra stage; continuing immediately'
    fi

  # A known delayed Chapter 10 build is parked until Chapter 9 is independently
  # approved. Restore it only when it is again the active build target.
    next="$(python3 scripts/decide.py next)"
    if [[ "$next" == "done" ]]; then
      report_status 'queue drained'
      exit 0
    elif [[ "$next" == "build skills" ]] && git stash list | rg -q 'wip: delayed Terra skills build'; then
      git stash pop
      report_status 'launching restored Skills build'
      TERRA_SANDBOX=danger-full-access ./run.sh next --allow-dirty --push || true
    elif [[ -n "$(git status --porcelain)" ]]; then
      report_status 'non-recoverable dirty worktree; stopping'
      exit 1
    else
      report_status "launching $next"
      TERRA_SANDBOX=danger-full-access ./run.sh next --push || true
    fi

    for _ in {1..6}; do
      sleep 10
      if terra_active; then
        report_status 'Terra stage is active; waiting for the next launchd tick'
        exit 0
      fi
      if [[ -n "$(git status --porcelain)" ]]; then
        recover_delayed_output
        break
      fi
    done
  done
} >>"$LOG" 2>&1
