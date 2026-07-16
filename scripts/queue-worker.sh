#!/usr/bin/env bash
# Durable single-writer supervisor for the queue with a stale-aware PID lock.
set -euo pipefail
umask 077

export PATH="$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"

ROOT="$(CDPATH= cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
GUARD="$ROOT/scripts/pipeline_guard.py"
LOG="$ROOT/.pipeline/queue-worker.log"
STATUS="$ROOT/.pipeline/queue-worker.status"
LOCK=/private/tmp/com.darvin.agentic-loops-queue.lock
ASYNC_GRACE_SECONDS="${QUEUE_ASYNC_GRACE_SECONDS:-180}"
STAGES_PER_TICK="${QUEUE_STAGES_PER_TICK:-6}"
LEASE_CONTINUE=0

if ! /usr/bin/shlock -f "$LOCK" -p $$; then
  exit 0
fi
trap 'rm -f "$LOCK"' EXIT INT TERM

mkdir -p "$ROOT/.pipeline"
cd "$ROOT"

if [[ -f "$LOG" ]] && (( $(stat -f '%z' "$LOG") > 20971520 )); then
  mv -f "$LOG" "$LOG.1"
fi
find "$ROOT/.pipeline" -type f \( -name 'build-*.log' -o -name 'critique-*.log' -o -name 'resolve-*.log' \) -mtime +14 -delete

report_status() {
  local message="$1" temp="$STATUS.$$.tmp"
  printf '%s\t%s\n' "$(date '+%Y-%m-%dT%H:%M:%S%z')" "$message" >"$temp"
  mv "$temp" "$STATUS"
  echo "queue worker: $message"
}

terra_active() {
  pgrep -f "codex .* -C $ROOT exec" >/dev/null 2>&1
  local rc=$?
  [[ $rc -eq 0 ]] && return 0
  [[ $rc -eq 1 ]] && return 1
  report_status 'cannot inspect Terra process state; stopping safely'
  return 2
}

has_changes() {
  "$GUARD" --repo "$ROOT" has-changes
  local rc=$?
  [[ $rc -eq 0 ]] && return 0
  [[ $rc -eq 1 ]] && return 1
  return "$rc"
}

sync_push() {
  local upstream ahead
  "$GUARD" --repo "$ROOT" branch >/dev/null
  if upstream="$(git rev-parse --abbrev-ref --symbolic-full-name '@{u}' 2>/dev/null)"; then
    ahead="$(git rev-list --count "$upstream"..HEAD)"
    if (( ahead > 0 )); then
      report_status "pushing $ahead committed stage(s)"
      git push
    fi
  else
    report_status 'establishing branch upstream'
    git push -u origin HEAD
  fi
}

handle_existing_lease() {
  local stage slug num state age active_rc recover_rc
  [[ -f .pipeline/active-stage.json ]] || return 1

  if terra_active; then
    report_status 'Terra stage is active; waiting'
    return 0
  else
    active_rc=$?
    [[ $active_rc -eq 1 ]] || return "$active_rc"
  fi

  if has_changes; then
    report_status 'recovering completed asynchronous Terra output'
    set +e
    TERRA_SANDBOX=danger-full-access "$ROOT/run.sh" recover --push
    recover_rc=$?
    set -e
    if (( recover_rc == 0 )); then
      report_status 'asynchronous Terra stage recovered and pushed'
      LEASE_CONTINUE=1
      return 0
    fi
    report_status "asynchronous recovery failed with exit $recover_rc; preserving lease and changes"
    return "$recover_rc"
  else
    local changed_rc=$?
    [[ $changed_rc -eq 1 ]] || return "$changed_rc"
  fi

  read -r stage slug num state age < <("$GUARD" --repo "$ROOT" lease-show)
  if [[ "$state" == running ]]; then
    "$GUARD" --repo "$ROOT" lease-update awaiting-output
    read -r stage slug num state age < <("$GUARD" --repo "$ROOT" lease-show)
  fi
  if (( age < ASYNC_GRACE_SECONDS )); then
    report_status "awaiting delayed output for $stage $slug (${age}s/${ASYNC_GRACE_SECONDS}s)"
    return 0
  fi
  "$GUARD" --repo "$ROOT" lease-clear
  report_status "no output arrived for $stage $slug; lease expired and a fresh attempt is eligible"
  LEASE_CONTINUE=1
  return 0
}

run_worker() {
  local next run_rc active_rc
  date '+%Y-%m-%dT%H:%M:%S%z queue worker tick'
  "$GUARD" --repo "$ROOT" branch >/dev/null

  if terra_active; then
    report_status 'Terra stage is active; waiting'
    return 0
  else
    active_rc=$?
    [[ $active_rc -eq 1 ]] || return "$active_rc"
  fi

  if [[ -f .pipeline/active-stage.json ]]; then
    handle_existing_lease
    if (( ! LEASE_CONTINUE )); then
      return 0
    fi
  elif has_changes; then
    report_status 'dirty worktree without a stage lease; stopping without committing'
    return 1
  else
    local changed_rc=$?
    [[ $changed_rc -eq 1 ]] || return "$changed_rc"
  fi

  sync_push

  for ((iteration=1; iteration<=STAGES_PER_TICK; iteration++)); do
    next="$(python3 scripts/decide.py next)"
    if [[ "$next" == "NEXT done "* ]]; then
      report_status 'queue drained'
      return 0
    fi
    if [[ "$next" == "NEXT error "* ]]; then
      report_status 'queue validation failed; stopping'
      return 1
    fi
    report_status "launching ${next#NEXT }"
    set +e
    TERRA_SANDBOX=danger-full-access "$ROOT/run.sh" next --push
    run_rc=$?
    set -e
    if (( run_rc == 0 )); then
      report_status 'stage committed and pushed; selecting the next stage'
      continue
    fi
    if (( run_rc == 75 )); then
      report_status 'stage is still settling; launchd will resume automatically'
      return 0
    fi
    report_status "stage failed with exit $run_rc; launchd will retry after the lease policy allows"
    return "$run_rc"
  done
  report_status "completed $STAGES_PER_TICK stage(s); launchd will continue"
}

{
  run_worker
} >>"$LOG" 2>&1
