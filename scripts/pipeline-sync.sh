#!/usr/bin/env bash
# Push only committed work that is actually ahead. All sync failures are EX_UNAVAILABLE.
set -uo pipefail

ROOT="$(CDPATH= cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
REPO_ROOT="${PIPELINE_REPO_ROOT:-$ROOT}"
GIT_HELPER="$ROOT/scripts/pipeline-git.sh"
WATCHDOG="$ROOT/scripts/process_watchdog.py"
SYNC_EXIT=69
SYNC_IDLE_TIMEOUT="${PIPELINE_SYNC_IDLE_TIMEOUT_SECONDS:-120}"
SYNC_MAX_RUNTIME="${PIPELINE_SYNC_MAX_RUNTIME_SECONDS:-900}"
WATCHDOG_TERM_GRACE="${PIPELINE_WATCHDOG_TERM_GRACE_SECONDS:-10}"
WATCHDOG_POLL="${PIPELINE_WATCHDOG_POLL_SECONDS:-2}"

if [[ "${1:-}" == --repo ]]; then
  (($# == 2)) || { echo "pipeline-sync: usage: pipeline-sync.sh [--repo PATH]" >&2; exit 2; }
  REPO_ROOT="$2"
elif (($#)); then
  echo "pipeline-sync: usage: pipeline-sync.sh [--repo PATH]" >&2
  exit 2
fi

PROCESS_STATE="$REPO_ROOT/.pipeline/active-process.json"

git_run() {
  "$GIT_HELPER" --repo "$REPO_ROOT" "$@"
}

bounded_push() {
  local log rc
  mkdir -p "$REPO_ROOT/.pipeline"
  log="$REPO_ROOT/.pipeline/sync-$(date +%Y%m%d-%H%M%S).log"
  set +e
  PIPELINE_GIT_TIMEOUT_SECONDS="$SYNC_MAX_RUNTIME" \
  "$WATCHDOG" --log "$log" --state "$PROCESS_STATE" --label sync:push \
    --idle-timeout "$SYNC_IDLE_TIMEOUT" --max-runtime "$SYNC_MAX_RUNTIME" \
    --term-grace "$WATCHDOG_TERM_GRACE" --poll-interval "$WATCHDOG_POLL" \
    -- "$GIT_HELPER" --repo "$REPO_ROOT" push "$@"
  rc=$?
  set -e
  cat "$log"
  return "$rc"
}

sync_failed() {
  echo "pipeline-sync: infrastructure synchronization failed: $*" >&2
  exit "$SYNC_EXIT"
}

upstream="$(git_run rev-parse --abbrev-ref --symbolic-full-name '@{u}' 2>/dev/null)"
upstream_rc=$?
set_upstream=0

if (( upstream_rc != 0 )); then
  branch="$(git_run symbolic-ref --quiet --short HEAD 2>/dev/null)" || sync_failed "cannot resolve the current branch"
  upstream="origin/$branch"
  git_run show-ref --verify --quiet "refs/remotes/$upstream"
  remote_ref_rc=$?
  if (( remote_ref_rc == 1 )); then
    set_upstream=1
  elif (( remote_ref_rc != 0 )); then
    sync_failed "cannot inspect the remote-tracking branch"
  fi
fi

if (( set_upstream )); then
  echo "pipeline-sync: remote branch is not present; pushing the local branch"
  bounded_push -u origin HEAD || sync_failed "git push failed or exceeded its deadline"
  exit 0
fi

counts="$(git_run rev-list --left-right --count "$upstream...HEAD" 2>/dev/null)" || sync_failed "cannot compare HEAD with $upstream"
read -r behind ahead <<<"$counts"
[[ "$behind" =~ ^[0-9]+$ && "$ahead" =~ ^[0-9]+$ ]] || sync_failed "invalid ahead/behind counts: $counts"

if (( behind > 0 )); then
  sync_failed "local branch is $behind commit(s) behind $upstream"
fi
if (( ahead == 0 )); then
  echo "pipeline-sync: already synchronized with $upstream; skipping git push"
  exit 0
fi

echo "pipeline-sync: pushing $ahead committed stage(s) to $upstream"
bounded_push || sync_failed "git push failed or exceeded its deadline"
