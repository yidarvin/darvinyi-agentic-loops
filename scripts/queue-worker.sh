#!/usr/bin/env bash
# Durable single-writer supervisor for the queue with a stale-aware PID lock.
set -euo pipefail
umask 077

ROOT="$(CDPATH= cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
export PIPELINE_GIT_BIN="${PIPELINE_GIT_BIN:-/usr/bin/git}"
export PATH="$ROOT/scripts/service-bin:${PATH:-/usr/bin:/bin:/usr/sbin:/sbin}"
GUARD="$ROOT/scripts/pipeline_guard.py"
SYNC_COMMAND="${PIPELINE_SYNC_COMMAND:-$ROOT/scripts/pipeline-sync.sh}"
LOG="$ROOT/.pipeline/queue-worker.log"
STATUS="$ROOT/.pipeline/queue-worker.status"
LOCK="${PIPELINE_LOCK_FILE:-/private/tmp/com.darvin.agentic-loops-queue.lock}"
SYNC_RETRY_FILE="$ROOT/.pipeline/sync-retry"
PUBLISH_READY="$ROOT/.pipeline/publish-ready"
SYNC_BACKOFF_BASE_SECONDS="${PIPELINE_SYNC_BACKOFF_BASE_SECONDS:-60}"
SYNC_BACKOFF_CAP_SECONDS="${PIPELINE_SYNC_BACKOFF_CAP_SECONDS:-900}"
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

clear_sync_backoff() {
  rm -f "$SYNC_RETRY_FILE"
}

schedule_sync_retry() {
  local count=0 ignored=0 exponent delay now not_before temp i
  if [[ -f "$SYNC_RETRY_FILE" ]]; then
    read -r count ignored <"$SYNC_RETRY_FILE" || count=0
    [[ "$count" =~ ^[0-9]+$ ]] || count=0
  fi
  ((count += 1))
  exponent=$((count - 1))
  (( exponent > 10 )) && exponent=10
  delay=$SYNC_BACKOFF_BASE_SECONDS
  for ((i=0; i<exponent; i++)); do delay=$((delay * 2)); done
  (( delay > SYNC_BACKOFF_CAP_SECONDS )) && delay=$SYNC_BACKOFF_CAP_SECONDS
  now="$(date +%s)"
  not_before=$((now + delay))
  temp="$SYNC_RETRY_FILE.$$.tmp"
  printf '%s %s\n' "$count" "$not_before" >"$temp"
  mv "$temp" "$SYNC_RETRY_FILE"
  report_status "infrastructure sync failure $count; retrying in ${delay}s without model recovery"
}

sync_backoff_active() {
  local count not_before now remaining
  [[ -f "$SYNC_RETRY_FILE" ]] || return 1
  if ! read -r count not_before <"$SYNC_RETRY_FILE" || [[ ! "$count" =~ ^[0-9]+$ || ! "$not_before" =~ ^[0-9]+$ ]]; then
    clear_sync_backoff
    return 1
  fi
  now="$(date +%s)"
  if (( now < not_before )); then
    remaining=$((not_before - now))
    report_status "infrastructure sync backoff active (${remaining}s); no model will run"
    return 0
  fi
  return 1
}

attempt_sync() {
  local sync_rc
  if "$SYNC_COMMAND" --repo "$ROOT"; then
    sync_rc=0
  else
    sync_rc=$?
  fi
  if (( sync_rc == 0 )); then
    clear_sync_backoff
    return 0
  fi
  if (( sync_rc == 69 )); then
    schedule_sync_retry
    return 69
  fi
  report_status "unexpected synchronization exit $sync_rc; stopping safely"
  return "$sync_rc"
}

publish_pending_chapter() {
  local sync_rc
  [[ -f "$PUBLISH_READY" ]] || return 0
  report_status 'retrying deferred approved-chapter publication without model recovery'
  if attempt_sync; then
    rm -f "$PUBLISH_READY"
    report_status 'approved chapter and accumulated stage commits pushed'
    return 0
  else
    sync_rc=$?
  fi
  return "$sync_rc"
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
    TERRA_SANDBOX=danger-full-access "$ROOT/run.sh" recover --push-on-done
    recover_rc=$?
    set -e
    if (( recover_rc == 0 )); then
      report_status 'asynchronous Terra stage recovered; chapter-boundary publication policy applied'
      LEASE_CONTINUE=1
      return 0
    fi
    if (( recover_rc == 69 )); then
      schedule_sync_retry
      report_status 'asynchronous stage is committed locally; synchronization deferred without model recovery'
      return 69
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
  local next run_rc active_rc sync_rc
  date '+%Y-%m-%dT%H:%M:%S%z queue worker tick'
  "$GUARD" --repo "$ROOT" branch >/dev/null

  if terra_active; then
    report_status 'Terra stage is active; waiting'
    return 0
  else
    active_rc=$?
    [[ $active_rc -eq 1 ]] || return "$active_rc"
  fi

  if sync_backoff_active; then
    return 0
  fi

  if publish_pending_chapter; then
    sync_rc=0
  else
    sync_rc=$?
  fi
  (( sync_rc == 0 )) || return "$sync_rc"

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
    TERRA_SANDBOX=danger-full-access "$ROOT/run.sh" next --push-on-done
    run_rc=$?
    set -e
    if (( run_rc == 0 )); then
      report_status 'stage committed; approved chapters publish with accumulated commits'
      continue
    fi
    if (( run_rc == 75 )); then
      report_status 'stage is still settling; launchd will resume automatically'
      return 0
    fi
    if (( run_rc == 69 )); then
      schedule_sync_retry
      report_status 'stage is committed locally; synchronization deferred without model recovery'
      return 69
    fi
    report_status "stage failed with exit $run_rc; launchd will retry after the lease policy allows"
    return "$run_rc"
  done
  report_status "completed $STAGES_PER_TICK stage(s); launchd will continue"
}

{
  run_worker
} >>"$LOG" 2>&1
