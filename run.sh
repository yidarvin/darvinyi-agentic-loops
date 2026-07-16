#!/usr/bin/env bash
# Bounded, critique-aware driver. Terra edits; this script validates and commits.
set -euo pipefail

MODEL="${TERRA_MODEL:-gpt-5.6-terra}"
EFFORT="${TERRA_EFFORT:-ultra}"
SANDBOX="${TERRA_SANDBOX:-workspace-write}"
PUSH=0
CHECK=1
DRY=0
ALLOW_DIRTY=0
VERB=next
LIMIT=1
RETRIES=1

usage() {
  cat <<'EOF'
Usage: ./run.sh [status|next|loop [N]|build|critique|resolve|recover] [options]

  -m, --model MODEL    Terra model (default: gpt-5.6-terra)
  -e, --effort LEVEL   reasoning effort (default: ultra)
      TERRA_SANDBOX    nested Codex sandbox (default: workspace-write)
      --push           push the driver-created commit after a successful stage
      --retries N      retry a completed no-change Terra stage up to N times (default: 1)
      --no-check       skip npm run check (not recommended)
      --allow-dirty    allow pre-existing changes (never use for unattended work)
      --dry-run        show the chosen stage without invoking Terra
  -h, --help           show this help

Terra never commits or pushes. The driver limits edits to the chosen chapter,
validates them, then creates one reviewable commit. loop N counts stages, not chapters.
recover commits a finished asynchronous Terra stage recorded in .pipeline.
EOF
}

die() { echo "run.sh: $*" >&2; exit 2; }
is_positive() { [[ "$1" =~ ^[1-9][0-9]*$ ]]; }

while (($#)); do
  case "$1" in
    status|next|build|critique|resolve|recover) VERB="$1"; shift ;;
    loop) VERB=loop; LIMIT=999999; shift; if (($#)) && is_positive "$1"; then LIMIT="$1"; shift; fi ;;
    -m|--model) (($# >= 2)) || die "$1 needs a value"; MODEL="$2"; shift 2 ;;
    -e|--effort) (($# >= 2)) || die "$1 needs a value"; EFFORT="$2"; shift 2 ;;
    --retries) (($# >= 2)) || die "$1 needs a value"; is_positive "$2" || die "--retries needs a positive integer"; RETRIES="$2"; shift 2 ;;
    --push) PUSH=1; shift ;;
    --no-check) CHECK=0; shift ;;
    --allow-dirty) ALLOW_DIRTY=1; shift ;;
    --dry-run) DRY=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) die "unknown argument '$1'" ;;
  esac
done

case "$EFFORT" in low|medium|high|xhigh|max|ultra) ;; *) die "invalid effort '$EFFORT'" ;; esac
case "$SANDBOX" in workspace-write|danger-full-access) ;; *) die "invalid TERRA_SANDBOX '$SANDBOX'" ;; esac
ROOT="$(CDPATH= cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"
[[ -f content/registry.json && -f prompts/queue.md ]] || die "not a refsite repository"

if [[ "$VERB" == status ]]; then python3 scripts/decide.py status; exit 0; fi
command -v codex >/dev/null || die "codex CLI is not on PATH"
command -v git >/dev/null || die "git is not on PATH"
if (( CHECK )); then command -v npm >/dev/null || die "npm is not on PATH"; fi
if [[ -n "$(git status --porcelain)" && $ALLOW_DIRTY -eq 0 && "$VERB" != recover ]]; then
  die "working tree is dirty; commit/stash first or pass --allow-dirty"
fi

stage_for() {
  if [[ "$VERB" == next || "$VERB" == loop ]]; then
    python3 scripts/decide.py next | awk '{print $2, $3}'
  else
    local line
    line="$(python3 scripts/decide.py next)"
    printf '%s %s\n' "$VERB" "$(awk '{print $3}' <<<"$line")"
  fi
}

STAGE_MARKER=.pipeline/active-stage

terra_active() {
  # The desktop launcher can return before the nested Codex process has completed.
  # Match only Codex commands scoped to this repository, never a user's other work.
  pgrep -f "codex .* -C $ROOT exec" >/dev/null 2>&1
}

write_stage_marker() {
  local stage="$1" slug="$2" num="$3"
  mkdir -p .pipeline
  printf '%s\t%s\t%s\t%s\n' "$stage" "$slug" "$num" "$(date +%s)" >"$STAGE_MARKER"
}

read_stage_marker() {
  [[ -f "$STAGE_MARKER" ]] || return 1
  IFS=$'\t' read -r MARKED_STAGE MARKED_SLUG MARKED_NUM MARKED_AT <"$STAGE_MARKER"
  [[ -n "${MARKED_STAGE:-}" && -n "${MARKED_SLUG:-}" && -n "${MARKED_NUM:-}" ]]
}

scope_ok() {
  local stage="$1" slug="$2" num="$3" file prefix="artifacts/ch${num}-${slug}/"
  while IFS= read -r file; do
    # A resolve may correct the chapter's factual backbone when the critic
    # identifies a material source error. Builds and critiques stay read-only
    # with respect to completed research.
    if [[ "$stage" == resolve && "$file" == "docs/research/ch${num}-${slug}.md" ]]; then
      continue
    fi
    case "$file" in
      content/registry.json|prompts/queue.md|"content/critiques/$slug.md"|"src/chapters/$slug.mdx"|src/chapters/_figures/*|src/chapters/_widgets/*|"$prefix"*|prompts/notes/"$slug".md) ;;
      *) echo "run.sh: $stage changed out-of-scope file: $file" >&2; return 1 ;;
    esac
  done < <(git diff --name-only)
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

commit_stage() {
  local stage="$1" slug="$2" num="$3" message="$4" next_stage next_slug
  scope_ok "$stage" "$slug" "$num" || return 1
  python3 scripts/validate.py
  if (( CHECK )); then npm run check; fi
  read -r next_stage next_slug < <(stage_for)
  [[ "$next_stage $next_slug" != "$stage $slug" ]] || {
    echo "run.sh: stalled stage '$stage': queue state did not advance" >&2
    return 1
  }
  git add -A
  git commit -m "$message"
  rm -f "$STAGE_MARKER"
  if (( PUSH )); then git push -u origin HEAD; fi
}

recover_stage() {
  read_stage_marker || die "no asynchronous Terra stage is recorded"
  [[ -n "$(git diff --name-only)" ]] || die "recorded Terra stage has no changes to recover"
  commit_stage "$MARKED_STAGE" "$MARKED_SLUG" "$MARKED_NUM" \
    "${MARKED_STAGE}(${MARKED_SLUG}): recover asynchronous Terra stage"
}

prompt_for() {
  local stage="$1" slug="$2"
  case "$stage" in
    build) cat <<EOF
Build chapter '$slug' in the Agentic Loops refsite. The driver already enforces the refsite-runner state machine, scope, validation, and commits. Read only AGENTS.md, prompts/notes/$slug.md, and its matching docs/research chapter before editing. Then write the complete chapter immediately: prose, figure, signature widget, direct source links, runnable artifact, README, and check.sh. Do not read skill manuals, surveys, earlier chapters, or unrelated docs. Keep the conceptual spine vendor-neutral. Use the existing state scripts to mark the chapter draft. Run npm run check. Do not commit, push, or edit any other chapter.
EOF
      ;;
    critique) cat <<EOF
Critique draft chapter '$slug' independently. The driver already enforces scope, validation, and commits. Read prompts/critique-rubric.md, then inspect the chapter, figure, widget, artifact, research doc, and sources. Start the review immediately; do not spend the run reloading runner manuals. Write content/critiques/$slug.md beginning with the exact verdict line. If approved, use scripts/mark.py to record done. If revisions are needed, keep it draft. Do not edit chapter content, commit, or push.
EOF
      ;;
    resolve) cat <<EOF
Resolve the open critique for '$slug'. The driver already enforces scope, validation, and commits. Read content/critiques/$slug.md, the chapter research, and the artifact. Start the required chapter-scoped fixes immediately; do not spend the run reloading runner manuals. Update the critique first line to 'verdict: resolved', and leave the chapter draft for independent re-review. Run npm run check. Do not commit or push.
EOF
      ;;
  esac
}

run_stage() {
  local stage="$1" slug="$2" num prompt log attempt changed=0 wait_seconds=0
  [[ "$stage" != done && "$stage" != error ]] || { echo "nothing to run: $stage"; return 0; }
  num="$(target_num "$slug")"; [[ -n "$num" ]] || die "could not find chapter '$slug'"
  prompt="$(prompt_for "$stage" "$slug")"
  mkdir -p .pipeline
  echo "== $stage $slug with $MODEL (effort=$EFFORT) =="
  if (( DRY )); then printf '%s\n' "$prompt"; return 0; fi
  write_stage_marker "$stage" "$slug" "$num"
  for ((attempt=1; attempt<=RETRIES; attempt++)); do
    log=".pipeline/${stage}-${slug}-$(date +%Y%m%d-%H%M%S)-attempt${attempt}.log"
    if ! codex --search -m "$MODEL" -c "model_reasoning_effort=\"$EFFORT\"" -s "$SANDBOX" -a never -C "$ROOT" exec "$prompt" >"$log" 2>&1; then
      echo "run.sh: Terra failed; tail of $log:" >&2
      tail -80 "$log" >&2
      return 1
    fi
    echo "Terra stage completed; full transcript: $log"
    # In the desktop environment, codex can hand work to a child process and
    # return before that child writes. Wait for the child rather than launching
    # overlapping retries against the same chapter.
    while terra_active; do
      if (( wait_seconds >= ${TERRA_STAGE_WAIT_SECONDS:-1800} )); then
        echo "run.sh: Terra stage '$stage' is still active; preserving its lease for the worker" >&2
        return 75
      fi
      sleep 10
      ((wait_seconds += 10))
    done
    if [[ -n "$(git diff --name-only)" ]]; then
      changed=1
      break
    fi
    echo "run.sh: stalled stage '$stage' (${attempt}/${RETRIES}): no changes" >&2
  done
  if (( ! changed )); then
    rm -f "$STAGE_MARKER"
    return 1
  fi
  commit_stage "$stage" "$slug" "$num" "${stage}(${slug}): Terra stage"
}

if [[ "$VERB" == recover ]]; then
  recover_stage
elif [[ "$VERB" == loop ]]; then
  for ((i=1; i<=LIMIT; i++)); do
    read -r stage slug < <(stage_for)
    [[ "$stage" == done ]] && { echo "queue drained"; exit 0; }
    [[ "$stage" != error ]] || die "state validation failed"
    run_stage "$stage" "$slug" || exit 1
  done
else
  read -r stage slug < <(stage_for)
  [[ "$stage" != error ]] || die "state validation failed"
  run_stage "$stage" "$slug"
fi
