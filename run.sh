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

MODEL="${TERRA_MODEL:-gpt-5.6-terra}"
EFFORT="${TERRA_EFFORT:-ultra}"
SANDBOX="${TERRA_SANDBOX:-workspace-write}"
IDLE_TIMEOUT="${TERRA_IDLE_TIMEOUT_SECONDS:-1800}"
MAX_RUNTIME="${TERRA_MAX_RUNTIME_SECONDS:-5400}"
WATCHDOG_TERM_GRACE="${TERRA_WATCHDOG_TERM_GRACE_SECONDS:-10}"
WATCHDOG_POLL="${TERRA_WATCHDOG_POLL_SECONDS:-5}"
PUSH=0
PUSH_ON_DONE=0
CHECK=1
DRY=0
VERB=next
LIMIT=1
RETRIES=1

usage() {
  cat <<'EOF'
Usage: ./run.sh [status|doctor|next|loop [N]|build|critique|resolve|recover] [options]

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
76 model stage watchdog timeout (safe to retry).
loop N counts stages, not chapters.
Terra never commits or pushes. The driver validates exact role-specific scope,
the queue outcome, and the full project gate before creating a commit.
EOF
}

die() { echo "run.sh: $*" >&2; exit 2; }
is_positive() { [[ "$1" =~ ^[1-9][0-9]*$ ]]; }

while (($#)); do
  case "$1" in
    status|doctor|next|build|critique|resolve|recover) VERB="$1"; shift ;;
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

terra_active() {
  pgrep -f "codex .* -C $ROOT exec" >/dev/null 2>&1
  local rc=$?
  [[ $rc -eq 0 ]] && return 0
  [[ $rc -eq 1 ]] && return 1
  echo "run.sh: could not inspect Terra processes" >&2
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

commit_stage() {
  local stage="$1" slug="$2" num="$3" message="$4" lease_stage lease_slug lease_num lease_state
  read -r lease_stage lease_slug lease_num lease_state < <("$GUARD" --repo "$ROOT" lease-verify)
  [[ "$lease_stage $lease_slug $lease_num" == "$stage $slug $num" ]] || die "active lease does not match $stage $slug $num"
  "$GUARD" --repo "$ROOT" scope "$stage" "$slug" "$num"
  record_approved_critique "$stage" "$slug"
  python3 scripts/validate.py
  if (( CHECK )); then npm run check; fi
  "$GUARD" --repo "$ROOT" outcome "$stage" "$slug"
  "$GUARD" --repo "$ROOT" branch >/dev/null
  "$GIT_HELPER" --repo "$ROOT" add -A
  "$GUARD" --repo "$ROOT" scope "$stage" "$slug" "$num" >/dev/null
  "$GIT_HELPER" --repo "$ROOT" commit -m "$message"
  "$GUARD" --repo "$ROOT" lease-clear
  if (( PUSH )); then
    push_head
  elif (( PUSH_ON_DONE )); then
    publish_completed_chapter "$stage" "$slug"
  fi
}

recover_stage() {
  local active_rc lease_stage lease_slug lease_num lease_state
  if terra_active; then
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
  commit_stage "$lease_stage" "$lease_slug" "$lease_num" \
    "${lease_stage}(${lease_slug}): recover asynchronous Terra stage"
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
  if terra_active; then
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
  "$WATCHDOG" --log "$log" \
    --idle-timeout "$IDLE_TIMEOUT" \
    --max-runtime "$MAX_RUNTIME" \
    --term-grace "$WATCHDOG_TERM_GRACE" \
    --poll-interval "$WATCHDOG_POLL" \
    -- codex --search -m "$MODEL" -c "model_reasoning_effort=\"$EFFORT\"" \
    -s "$SANDBOX" -a never -C "$ROOT" exec "$prompt"
  codex_rc=$?
  set -e

  if terra_active; then
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
    commit_stage "$stage" "$slug" "$num" "${stage}(${slug}): Terra stage"
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
elif [[ "$VERB" == recover ]]; then
  [[ -x "$PIPELINE_GIT_BIN" ]] || die "pinned Git is not executable: $PIPELINE_GIT_BIN"
  if (( CHECK )); then command -v npm >/dev/null || die "npm is not on PATH"; fi
  recover_stage
else
  command -v codex >/dev/null || die "codex CLI is not on PATH"
  [[ -x "$WATCHDOG" ]] || die "stage watchdog is not executable: $WATCHDOG"
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
