#!/usr/bin/env bash
# Bounded, critique-aware driver. Terra edits; this script validates and commits.
set -euo pipefail
umask 077

ROOT="$(CDPATH= cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
export PIPELINE_GIT_BIN="${PIPELINE_GIT_BIN:-/usr/bin/git}"
export PATH="$ROOT/scripts/service-bin:${PATH:-/usr/bin:/bin:/usr/sbin:/sbin}"
GIT_HELPER="$ROOT/scripts/pipeline-git.sh"
SYNC_COMMAND="${PIPELINE_SYNC_COMMAND:-$ROOT/scripts/pipeline-sync.sh}"
WATCHDOG="$ROOT/scripts/process_watchdog.py"
PROCESS_STATE_TOOL="$ROOT/scripts/process_state.py"
PROCESS_STATE="$ROOT/.pipeline/active-process.json"
VALIDATION_FAILURE="$ROOT/.pipeline/validation-failure.json"
VALIDATED_HEAD="$ROOT/.pipeline/validated-head"

MODEL="${TERRA_MODEL:-gpt-5.6-terra}"
EFFORT="${TERRA_EFFORT:-ultra}"
SANDBOX="${TERRA_SANDBOX:-workspace-write}"
IDLE_TIMEOUT="${TERRA_IDLE_TIMEOUT_SECONDS:-1800}"
MAX_RUNTIME="${TERRA_MAX_RUNTIME_SECONDS:-5400}"
WATCHDOG_TERM_GRACE="${TERRA_WATCHDOG_TERM_GRACE_SECONDS:-10}"
WATCHDOG_POLL="${TERRA_WATCHDOG_POLL_SECONDS:-5}"
VALIDATION_IDLE_TIMEOUT="${PIPELINE_VALIDATION_IDLE_TIMEOUT_SECONDS:-600}"
VALIDATION_MAX_RUNTIME="${PIPELINE_VALIDATION_MAX_RUNTIME_SECONDS:-1800}"
PIPELINE_TERM_GRACE="${PIPELINE_WATCHDOG_TERM_GRACE_SECONDS:-10}"
PIPELINE_POLL="${PIPELINE_WATCHDOG_POLL_SECONDS:-2}"
REPAIR_ATTEMPTS_PER_RUN="${PIPELINE_REPAIR_ATTEMPTS_PER_RUN:-1}"
PUSH=0
PUSH_ON_DONE=0
CHECK=1
DRY=0
VERB=next
LIMIT=1
RETRIES=1

usage() {
  cat <<'EOF'
Usage: ./run.sh [status|doctor|next|loop [N]|build|critique|resolve|recover|repair|preflight] [options]

  -m, --model MODEL    Terra model (default: gpt-5.6-terra)
  -e, --effort LEVEL   reasoning effort (default: ultra)
      TERRA_SANDBOX    nested Codex sandbox (default: workspace-write)
      TERRA_IDLE_TIMEOUT_SECONDS
                       abort after no model output for this long (default: 1800)
      TERRA_MAX_RUNTIME_SECONDS
                       abort a model stage after this long (default: 5400)
      --push           push the driver-created commit after a successful stage
      --push-on-done   push accumulated commits only when a chapter reaches done
      --retries N      accepted for compatibility; safe retries are worker-managed
      --no-check       skip npm run check (manual use only)
      --allow-dirty    deprecated and rejected; unattended stages require a clean tree
      --dry-run        show the chosen stage without invoking Terra
      --version        print the driver interface version
  -h, --help           show this help

Exit codes: 0 success, 1 stage failure, 2 usage/invariant failure,
69 infrastructure synchronization failure, 75 asynchronous work still settling,
76 model stage watchdog timeout, 77 stage validation failure requiring repair,
78 validation watchdog timeout, 79 baseline preflight failure (both retry without model recovery).
loop N counts stages, not chapters.
Terra never commits or pushes. The driver validates exact role-specific scope,
the queue outcome, and the full project gate before creating a commit.
EOF
}

die() { echo "run.sh: $*" >&2; exit 2; }
is_positive() { [[ "$1" =~ ^[1-9][0-9]*$ ]]; }

while (($#)); do
  case "$1" in
    status|doctor|next|build|critique|resolve|recover|repair|preflight) VERB="$1"; shift ;;
    loop) VERB=loop; LIMIT=999999; shift; if (($#)) && is_positive "$1"; then LIMIT="$1"; shift; fi ;;
    -m|--model) (($# >= 2)) || die "$1 needs a value"; MODEL="$2"; shift 2 ;;
    -e|--effort) (($# >= 2)) || die "$1 needs a value"; EFFORT="$2"; shift 2 ;;
    --retries) (($# >= 2)) || die "$1 needs a value"; is_positive "$2" || die "--retries needs a positive integer"; RETRIES="$2"; shift 2 ;;
    --push) PUSH=1; shift ;;
    --push-on-done) PUSH_ON_DONE=1; shift ;;
    --no-check) CHECK=0; shift ;;
    --allow-dirty) die "--allow-dirty is no longer supported; commit or stash changes first" ;;
    --dry-run) DRY=1; shift ;;
    --version) echo "agentic-loops-run 2"; exit 0 ;;
    -h|--help) usage; exit 0 ;;
    *) die "unknown argument '$1'" ;;
  esac
done

(( ! PUSH || ! PUSH_ON_DONE )) || die "--push and --push-on-done are mutually exclusive"

case "$EFFORT" in low|medium|high|xhigh|max|ultra) ;; *) die "invalid effort '$EFFORT'" ;; esac
case "$SANDBOX" in workspace-write|danger-full-access) ;; *) die "invalid TERRA_SANDBOX '$SANDBOX'" ;; esac

GUARD="$ROOT/scripts/pipeline_guard.py"
PUBLISH_READY="$ROOT/.pipeline/publish-ready"
cd "$ROOT"
[[ -f content/registry.json && -f prompts/queue.md && -x "$GUARD" && -x "$GIT_HELPER" && -x "$SYNC_COMMAND" ]] || die "not a runnable refsite repository"

pipeline_process_active() {
  "$PROCESS_STATE_TOOL" active --state "$PROCESS_STATE" >/dev/null 2>&1
  local rc=$?
  [[ $rc -eq 0 ]] && return 0
  [[ $rc -eq 1 ]] && return 1
  echo "run.sh: could not inspect the owned pipeline process" >&2
  return 2
}

has_changes() {
  "$GUARD" --repo "$ROOT" has-changes
  local rc=$?
  [[ $rc -eq 0 ]] && return 0
  [[ $rc -eq 1 ]] && return 1
  return "$rc"
}

decision_for() {
  python3 scripts/decide.py next | awk '{print $2, $3}'
}

stage_for() {
  local next_stage next_slug
  read -r next_stage next_slug < <(decision_for)
  if [[ "$VERB" == next || "$VERB" == loop ]]; then
    printf '%s %s\n' "$next_stage" "$next_slug"
  elif [[ "$VERB" == "$next_stage" ]]; then
    printf '%s %s\n' "$next_stage" "$next_slug"
  else
    die "requested '$VERB', but the queue requires '$next_stage $next_slug'"
  fi
}

target_num() {
  python3 - "$1" <<'PY'
import json, sys
for chapter in json.load(open('content/registry.json'))['chapters']:
    if chapter['slug'] == sys.argv[1]:
        print(f"{chapter['num']:02d}")
        break
PY
}

critique_rounds() {
  local file="content/critiques/$1.md"
  [[ -f "$file" ]] || { echo 0; return; }
  rg -c '^## Round [0-9]+ review' "$file" 2>/dev/null || echo 0
}

prompt_for() {
  local stage="$1" slug="$2" rounds
  case "$stage" in
    build) cat <<EOF
You are the chapter builder for the Agentic Loops refsite. Build chapter '$slug'.

Use only AGENTS.md, prompts/notes/$slug.md, and the matching docs/research chapter as planning context. Produce the complete chapter now: expert prose, one explanatory SVG figure, one signature React widget, direct source links, a self-contained runnable artifact with README.md and check.sh, and exercises. Keep the conceptual spine vendor-neutral and label product examples. Mark the chapter draft with the repository state script and run npm run check.

Your write scope is only this chapter's MDX, its exact figure and widget, its artifact directory, content/registry.json, and prompts/queue.md. Do not edit research, notes, other chapters, shared components, pipeline code, or configuration. Do not stage, commit, or push. Before finishing, verify the chapter grammar and the full check are green.
EOF
      ;;
    critique)
      rounds="$(critique_rounds "$slug")"
      cat <<EOF
You are the independent adversarial critic for draft chapter '$slug'. A wrong approval is worse than a concise required correction, but endless polish is also a failure. Read prompts/critique-rubric.md, the complete existing critique history, the current chapter, exact figure and widget, artifact, research file, and linked primary sources. Run npm run check.

Judge the current artifacts, not the builder's claims. Verify that every prior REQUIRED finding remains fixed. Resolved findings are settled and must not be re-litigated. A new REQUIRED finding must identify a material factual error, broken runnable behavior, security defect, inaccessible teaching mechanism, or violation of a non-negotiable chapter requirement. Style preferences, optional robustness, speculative edge cases, and incremental polish are ADVISORY and cannot block approval.

This chapter has already had $rounds review round(s). If it has had at least three, operate in convergence mode: introduce a new REQUIRED finding only for a concrete high-severity defect that would make the chapter materially wrong, unsafe, or non-runnable. Otherwise approve once prior required fixes and the full gate hold.

Write only content/critiques/$slug.md, preserving its append-only history. Begin with exactly verdict: approve or verdict: revise. On approval, use scripts/mark.py to record done. Do not edit chapter content, artifacts, research, pipeline code, or configuration. Do not stage, commit, or push.
EOF
      ;;
    resolve) cat <<EOF
You are the chapter builder resolving the open critique for '$slug'. Read the full append-only critique history, the chapter research, and the current artifact. Apply every REQUIRED finding in the latest review and re-verify every prior required fix. Do not expand advisory polish into new scope.

Your write scope is only this chapter's MDX, exact figure and widget, artifact directory, critique file, and, only when correcting a material factual backbone error, its matching research file. Leave the registry draft and queue PENDING. Set the critique first line to verdict: resolved, append a concrete builder resolution, and run npm run check. Do not edit other chapters, shared components, pipeline code, or configuration. Do not stage, commit, or push.
EOF
      ;;
  esac
}

push_head() {
  "$SYNC_COMMAND" --repo "$ROOT"
}

chapter_is_done() {
  local slug="$1"
  python3 - "$slug" <<'PY'
import json, sys
for chapter in json.load(open('content/registry.json'))['chapters']:
    if chapter.get('slug') == sys.argv[1]:
        raise SystemExit(0 if chapter.get('status') == 'done' else 1)
raise SystemExit(1)
PY
}

mark_publish_ready() {
  local slug="$1" temp="$PUBLISH_READY.$$.tmp" head
  head="$("$GIT_HELPER" --repo "$ROOT" rev-parse HEAD)"
  mkdir -p "$ROOT/.pipeline"
  printf '%s %s\n' "$slug" "$head" >"$temp"
  mv "$temp" "$PUBLISH_READY"
}

publish_completed_chapter() {
  local stage="$1" slug="$2"
  [[ "$stage" == critique ]] || return 0
  chapter_is_done "$slug" || return 0
  mark_publish_ready "$slug"
  push_head
  rm -f "$PUBLISH_READY"
}

record_approved_critique() {
  local stage="$1" slug="$2" state verdict_line
  [[ "$stage" == critique ]] || return 0
  verdict_line="$(sed -n '1p' "content/critiques/$slug.md" 2>/dev/null || true)"
  [[ "$verdict_line" == 'verdict: approve' ]] || return 0
  state="$(python3 - "$slug" <<'PY'
import json, sys
for chapter in json.load(open('content/registry.json'))['chapters']:
    if chapter.get('slug') == sys.argv[1]:
        print(chapter.get('status', ''))
        break
PY
)"
  if [[ "$state" == draft ]]; then
    echo "run.sh: recording the critic's approving verdict"
    python3 scripts/mark.py "$slug" done
  fi
}

record_validation_failure() {
  local kind="$1" stage="$2" slug="$3" log="$4" exit_code="$5"
  python3 - "$VALIDATION_FAILURE" "$kind" "$stage" "$slug" "$log" "$exit_code" <<'PY'
import json, os, pathlib, sys, time
path = pathlib.Path(sys.argv[1])
payload = {
    "version": 1,
    "kind": sys.argv[2],
    "stage": sys.argv[3],
    "slug": sys.argv[4],
    "log": sys.argv[5],
    "exit_code": int(sys.argv[6]),
    "recorded_at": int(time.time()),
}
path.parent.mkdir(parents=True, exist_ok=True)
temp = path.with_name(f".{path.name}.{os.getpid()}.tmp")
with temp.open("x", encoding="utf-8") as handle:
    json.dump(payload, handle, sort_keys=True)
    handle.write("\n")
    handle.flush()
    os.fsync(handle.fileno())
os.replace(temp, path)
PY
}

clear_validation_failure() {
  rm -f "$VALIDATION_FAILURE"
}

record_validated_head() {
  local temp="$VALIDATED_HEAD.$$.tmp"
  "$GIT_HELPER" --repo "$ROOT" rev-parse HEAD >"$temp"
  mv "$temp" "$VALIDATED_HEAD"
}

run_validation() {
  local stage="$1" slug="$2" log rc
  log="$ROOT/.pipeline/validation-${stage}-${slug}-$(date +%Y%m%d-%H%M%S).log"
  set +e
  if (( CHECK )); then
    "$WATCHDOG" --log "$log" --state "$PROCESS_STATE" --label "validation:$stage:$slug" \
      --idle-timeout "$VALIDATION_IDLE_TIMEOUT" --max-runtime "$VALIDATION_MAX_RUNTIME" \
      --term-grace "$PIPELINE_TERM_GRACE" --poll-interval "$PIPELINE_POLL" \
      -- npm run check
  else
    "$WATCHDOG" --log "$log" --state "$PROCESS_STATE" --label "validation:$stage:$slug" \
      --idle-timeout "$VALIDATION_IDLE_TIMEOUT" --max-runtime "$VALIDATION_MAX_RUNTIME" \
      --term-grace "$PIPELINE_TERM_GRACE" --poll-interval "$PIPELINE_POLL" \
      -- python3 scripts/validate.py
  fi
  rc=$?
  set -e
  if (( rc == 0 )); then
    clear_validation_failure
    return 0
  fi
  tail -80 "$log" >&2 || true
  if (( rc == 124 )); then
    record_validation_failure infrastructure-timeout "$stage" "$slug" "$log" "$rc"
    echo "run.sh: validation deadline expired; preserving the leased stage for infrastructure retry" >&2
    return 78
  fi
  record_validation_failure stage-validation "$stage" "$slug" "$log" "$rc"
  echo "run.sh: stage validation failed; preserving output for a scoped repair attempt" >&2
  return 77
}

run_stage_guard() {
  local stage="$1" slug="$2" label="$3" log rc
  shift 3
  log="$ROOT/.pipeline/contract-${stage}-${slug}-${label}-$(date +%Y%m%d-%H%M%S).log"
  set +e
  "$GUARD" --repo "$ROOT" "$@" >"$log" 2>&1
  rc=$?
  set -e
  if (( rc == 0 )); then
    cat "$log"
    return 0
  fi
  cat "$log" >&2
  record_validation_failure stage-validation "$stage" "$slug" "$log" "$rc"
  echo "run.sh: stage contract '$label' failed; preserving output for scoped repair" >&2
  return 77
}

commit_stage() {
  local stage="$1" slug="$2" num="$3" message="$4" lease_stage lease_slug lease_num lease_state
  read -r lease_stage lease_slug lease_num lease_state < <("$GUARD" --repo "$ROOT" lease-verify)
  [[ "$lease_stage $lease_slug $lease_num" == "$stage $slug $num" ]] || die "active lease does not match $stage $slug $num"
  run_stage_guard "$stage" "$slug" scope scope "$stage" "$slug" "$num" || return $?
  record_approved_critique "$stage" "$slug"
  run_stage_guard "$stage" "$slug" outcome outcome "$stage" "$slug" || return $?
  run_validation "$stage" "$slug" || return $?
  "$GUARD" --repo "$ROOT" branch >/dev/null
  "$GIT_HELPER" --repo "$ROOT" add -A
  "$GUARD" --repo "$ROOT" scope "$stage" "$slug" "$num" >/dev/null
  "$GIT_HELPER" --repo "$ROOT" commit -m "$message"
  "$GUARD" --repo "$ROOT" lease-clear
  clear_validation_failure
  record_validated_head
  if (( PUSH )); then
    push_head
  elif (( PUSH_ON_DONE )); then
    publish_completed_chapter "$stage" "$slug"
  fi
}

repair_stage() {
  local lease_stage lease_slug lease_num lease_state kind failure_stage failure_slug failure_log
  local prompt log repair_rc active_rc
  read -r lease_stage lease_slug lease_num lease_state < <("$GUARD" --repo "$ROOT" lease-verify)
  [[ -f "$VALIDATION_FAILURE" ]] || die "no recorded validation failure to repair"
  read -r kind failure_stage failure_slug failure_log < <(python3 - "$VALIDATION_FAILURE" <<'PY'
import json, sys
data = json.load(open(sys.argv[1], encoding="utf-8"))
print(data.get("kind", ""), data.get("stage", ""), data.get("slug", ""), data.get("log", ""))
PY
)
  [[ "$failure_stage $failure_slug" == "$lease_stage $lease_slug" ]] \
    || die "validation failure does not match the active lease"
  if [[ "$kind" == infrastructure-timeout ]]; then
    commit_stage "$lease_stage" "$lease_slug" "$lease_num" \
      "${lease_stage}(${lease_slug}): recover validated Terra stage"
    return $?
  fi
  [[ "$kind" == stage-validation ]] || die "unknown validation failure kind '$kind'"
  prompt="You are repairing a failed validation for the active $lease_stage stage of chapter '$lease_slug'. Read $failure_log and the current uncommitted diff. Fix only the concrete failures caused by this chapter stage. Preserve all valid work and stay inside the original role scope. Do not edit pipeline code, configuration, other chapters, or unrelated files. Run focused checks as useful, but do not commit or push; the parent will run the full gate."
  log="$ROOT/.pipeline/repair-${lease_stage}-${lease_slug}-$(date +%Y%m%d-%H%M%S).log"
  set +e
  "$WATCHDOG" --log "$log" --state "$PROCESS_STATE" --label "repair:$lease_stage:$lease_slug" \
    --idle-timeout "$IDLE_TIMEOUT" --max-runtime "$MAX_RUNTIME" \
    --term-grace "$WATCHDOG_TERM_GRACE" --poll-interval "$WATCHDOG_POLL" \
    -- codex --search -m "$MODEL" -c "model_reasoning_effort=\"$EFFORT\"" \
    -s "$SANDBOX" -a never -C "$ROOT" exec "$prompt"
  repair_rc=$?
  set -e
  if pipeline_process_active; then
    echo "run.sh: validation repair is still active" >&2
    return 75
  else
    active_rc=$?
    [[ $active_rc -eq 1 ]] || return "$active_rc"
  fi
  if (( repair_rc == 124 )); then
    echo "run.sh: validation repair watchdog timed out; preserving stage output" >&2
    return 76
  fi
  if (( repair_rc != 0 )); then
    echo "run.sh: repair model exited $repair_rc; validating any resulting changes" >&2
    tail -40 "$log" >&2 || true
  fi
  commit_stage "$lease_stage" "$lease_slug" "$lease_num" \
    "${lease_stage}(${lease_slug}): Terra stage"
}

commit_with_repair() {
  local stage="$1" slug="$2" num="$3" message="$4" rc attempt
  if commit_stage "$stage" "$slug" "$num" "$message"; then
    return 0
  else
    rc=$?
  fi
  (( rc == 77 )) || return "$rc"
  for ((attempt=1; attempt<=REPAIR_ATTEMPTS_PER_RUN; attempt++)); do
    echo "run.sh: starting scoped validation repair attempt $attempt/$REPAIR_ATTEMPTS_PER_RUN" >&2
    if repair_stage; then
      return 0
    else
      rc=$?
    fi
    (( rc == 77 )) || return "$rc"
  done
  return 77
}

recover_stage() {
  local active_rc lease_stage lease_slug lease_num lease_state
  if pipeline_process_active; then
    echo "run.sh: Terra is still active; recovery will wait" >&2
    return 75
  else
    active_rc=$?
    [[ $active_rc -eq 1 ]] || return "$active_rc"
  fi
  if has_changes; then
    :
  else
    local changed_rc=$?
    [[ $changed_rc -eq 1 ]] || return "$changed_rc"
    die "recorded Terra stage has no changes to recover"
  fi
  read -r lease_stage lease_slug lease_num lease_state < <("$GUARD" --repo "$ROOT" lease-verify)
  commit_with_repair "$lease_stage" "$lease_slug" "$lease_num" \
    "${lease_stage}(${lease_slug}): recover asynchronous Terra stage"
}

preflight_stage() {
  local head validated='' log rc
  if has_changes; then
    die "baseline preflight requires a clean working tree"
  else
    local changed_rc=$?
    [[ $changed_rc -eq 1 ]] || return "$changed_rc"
  fi
  head="$("$GIT_HELPER" --repo "$ROOT" rev-parse HEAD)"
  [[ -f "$VALIDATED_HEAD" ]] && validated="$(tr -d '[:space:]' <"$VALIDATED_HEAD")"
  if [[ "$validated" == "$head" ]]; then
    echo "run.sh: baseline preflight already passed for $head"
    return 0
  fi
  log="$ROOT/.pipeline/preflight-$(date +%Y%m%d-%H%M%S).log"
  set +e
  "$WATCHDOG" --log "$log" --state "$PROCESS_STATE" --label preflight \
    --idle-timeout "$VALIDATION_IDLE_TIMEOUT" --max-runtime "$VALIDATION_MAX_RUNTIME" \
    --term-grace "$PIPELINE_TERM_GRACE" --poll-interval "$PIPELINE_POLL" \
    -- npm run check
  rc=$?
  set -e
  if (( rc == 0 )); then
    record_validated_head
    echo "run.sh: baseline preflight passed for $head"
    return 0
  fi
  tail -80 "$log" >&2 || true
  if (( rc == 124 )); then
    echo "run.sh: baseline validation deadline expired" >&2
    return 78
  fi
  echo "run.sh: baseline preflight failed at unchanged HEAD; no chapter model will run" >&2
  return 79
}

run_stage() {
  local stage="$1" slug="$2" num prompt log codex_rc active_rc
  [[ "$stage" != done && "$stage" != error ]] || { echo "nothing to run: $stage"; return 0; }
  num="$(target_num "$slug")"
  [[ -n "$num" ]] || die "could not find chapter '$slug'"
  prompt="$(prompt_for "$stage" "$slug")"
  echo "== $stage $slug with $MODEL (effort=$EFFORT) =="
  if (( DRY )); then printf '%s\n' "$prompt"; return 0; fi
  "$GUARD" --repo "$ROOT" branch >/dev/null
  if has_changes; then
    die "working tree is dirty; commit or stash changes before running Terra"
  else
    local changed_rc=$?
    [[ $changed_rc -eq 1 ]] || return "$changed_rc"
  fi
  if pipeline_process_active; then
    echo "run.sh: another Terra stage is already active" >&2
    return 75
  else
    active_rc=$?
    [[ $active_rc -eq 1 ]] || return "$active_rc"
  fi
  mkdir -p .pipeline
  "$GUARD" --repo "$ROOT" lease-create "$stage" "$slug" "$num"
  log=".pipeline/${stage}-${slug}-$(date +%Y%m%d-%H%M%S).log"
  set +e
  "$WATCHDOG" --log "$log" --state "$PROCESS_STATE" --label "model:$stage:$slug" \
    --idle-timeout "$IDLE_TIMEOUT" \
    --max-runtime "$MAX_RUNTIME" \
    --term-grace "$WATCHDOG_TERM_GRACE" \
    --poll-interval "$WATCHDOG_POLL" \
    -- codex --search -m "$MODEL" -c "model_reasoning_effort=\"$EFFORT\"" \
    -s "$SANDBOX" -a never -C "$ROOT" exec "$prompt"
  codex_rc=$?
  set -e

  if pipeline_process_active; then
    echo "run.sh: Terra handed off to a child process; lease retained" >&2
    return 75
  else
    active_rc=$?
    [[ $active_rc -eq 1 ]] || return "$active_rc"
  fi

  if has_changes; then
    if (( codex_rc != 0 )); then
      echo "run.sh: Codex exited $codex_rc after producing changes; validating output" >&2
      tail -40 "$log" >&2
    fi
    commit_with_repair "$stage" "$slug" "$num" "${stage}(${slug}): Terra stage"
    return 0
  else
    local changed_rc=$?
    [[ $changed_rc -eq 1 ]] || return "$changed_rc"
  fi

  if (( codex_rc == 124 )); then
    "$GUARD" --repo "$ROOT" lease-clear
    echo "run.sh: stage watchdog timed out without changes; lease cleared for a fresh attempt" >&2
    tail -40 "$log" >&2
    return 76
  fi

  "$GUARD" --repo "$ROOT" lease-update awaiting-output
  if (( codex_rc != 0 )); then
    echo "run.sh: Codex exited $codex_rc without immediate changes; awaiting delayed output" >&2
    tail -40 "$log" >&2
  else
    echo "run.sh: Terra returned without immediate changes; awaiting delayed output" >&2
  fi
  return 75
}

show_status() {
  local service_state=stopped heartbeat
  python3 scripts/decide.py status
  echo
  if launchctl print "gui/$(id -u)/com.darvin.agentic-loops-queue" >/dev/null 2>&1; then
    service_state=loaded
  fi
  if [[ -f .pipeline/queue-worker.status ]]; then
    heartbeat="$(cat .pipeline/queue-worker.status)"
    printf 'AUTOMATION service=%s last=%s\n' "$service_state" "$heartbeat"
  else
    echo "AUTOMATION service=$service_state; no worker heartbeat recorded"
  fi
  if "$GUARD" --repo "$ROOT" lease-show >/dev/null 2>&1; then
    printf 'LEASE '
    "$GUARD" --repo "$ROOT" lease-show
  else
    echo "LEASE none"
  fi
  "$PROCESS_STATE_TOOL" show --state "$PROCESS_STATE" 2>/dev/null || echo "PROCESS invalid"
  [[ -f .pipeline/no-progress-retry ]] && printf 'NO_PROGRESS_RETRY %s\n' "$(cat .pipeline/no-progress-retry)"
  [[ -f .pipeline/validation-retry ]] && printf 'VALIDATION_RETRY %s\n' "$(cat .pipeline/validation-retry)"
  [[ -f .pipeline/sync-retry ]] && printf 'SYNC_RETRY %s\n' "$(cat .pipeline/sync-retry)"
  return 0
}

show_doctor() {
  local service_state=stopped resolved_git git_version branch
  if launchctl print "gui/$(id -u)/com.darvin.agentic-loops-queue" >/dev/null 2>&1; then
    service_state=loaded
  fi
  resolved_git="$(command -v git)"
  git_version="$(git --version)"
  branch="$("$GIT_HELPER" --repo "$ROOT" symbolic-ref --quiet --short HEAD)"
  printf 'REPO_ROOT=%s\n' "$ROOT"
  printf 'PIPELINE_GIT_BIN=%s\n' "$PIPELINE_GIT_BIN"
  printf 'PATH=%s\n' "$PATH"
  printf 'RESOLVED_GIT=%s\n' "$resolved_git"
  printf 'GIT_VERSION=%s\n' "$git_version"
  printf 'BRANCH=%s\n' "$branch"
  printf 'AUTOMATION_SERVICE=%s\n' "$service_state"
}

if (( RETRIES != 1 )); then
  echo "run.sh: --retries is compatibility-only; the durable worker manages safe retries" >&2
fi

if [[ "$VERB" == status ]]; then
  show_status
elif [[ "$VERB" == doctor ]]; then
  show_doctor
elif [[ "$VERB" == preflight ]]; then
  [[ -x "$WATCHDOG" && -x "$PROCESS_STATE_TOOL" ]] || die "pipeline watchdog tools are not executable"
  command -v npm >/dev/null || die "npm is not on PATH"
  preflight_stage
elif [[ "$VERB" == recover ]]; then
  [[ -x "$PIPELINE_GIT_BIN" ]] || die "pinned Git is not executable: $PIPELINE_GIT_BIN"
  if (( CHECK )); then command -v npm >/dev/null || die "npm is not on PATH"; fi
  recover_stage
elif [[ "$VERB" == repair ]]; then
  command -v codex >/dev/null || die "codex CLI is not on PATH"
  [[ -x "$WATCHDOG" && -x "$PROCESS_STATE_TOOL" ]] || die "pipeline watchdog tools are not executable"
  repair_stage
else
  command -v codex >/dev/null || die "codex CLI is not on PATH"
  [[ -x "$WATCHDOG" && -x "$PROCESS_STATE_TOOL" ]] || die "pipeline watchdog tools are not executable"
  [[ -x "$PIPELINE_GIT_BIN" ]] || die "pinned Git is not executable: $PIPELINE_GIT_BIN"
  if (( CHECK )); then command -v npm >/dev/null || die "npm is not on PATH"; fi
  if [[ "$VERB" == loop ]]; then
    for ((i=1; i<=LIMIT; i++)); do
      read -r stage slug < <(stage_for)
      [[ "$stage" == done ]] && { echo "queue drained"; exit 0; }
      [[ "$stage" != error ]] || die "state validation failed"
      run_stage "$stage" "$slug"
    done
  else
    read -r stage slug < <(stage_for)
    [[ "$stage" != error ]] || die "state validation failed"
    run_stage "$stage" "$slug"
  fi
fi
