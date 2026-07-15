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

usage() {
  cat <<'EOF'
Usage: ./run.sh [status|next|loop [N]|build|critique|resolve] [options]

  -m, --model MODEL    Terra model (default: gpt-5.6-terra)
  -e, --effort LEVEL   reasoning effort (default: ultra)
      TERRA_SANDBOX    nested Codex sandbox (default: workspace-write)
      --push           push the driver-created commit after a successful stage
      --no-check       skip npm run check (not recommended)
      --allow-dirty    allow pre-existing changes (never use for unattended work)
      --dry-run        show the chosen stage without invoking Terra
  -h, --help           show this help

Terra never commits or pushes. The driver limits edits to the chosen chapter,
validates them, then creates one reviewable commit. loop N counts stages, not chapters.
EOF
}

die() { echo "run.sh: $*" >&2; exit 2; }
is_positive() { [[ "$1" =~ ^[1-9][0-9]*$ ]]; }

while (($#)); do
  case "$1" in
    status|next|build|critique|resolve) VERB="$1"; shift ;;
    loop) VERB=loop; LIMIT=999999; shift; if (($#)) && is_positive "$1"; then LIMIT="$1"; shift; fi ;;
    -m|--model) (($# >= 2)) || die "$1 needs a value"; MODEL="$2"; shift 2 ;;
    -e|--effort) (($# >= 2)) || die "$1 needs a value"; EFFORT="$2"; shift 2 ;;
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
if [[ -n "$(git status --porcelain)" && $ALLOW_DIRTY -eq 0 ]]; then
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

scope_ok() {
  local stage="$1" slug="$2" num="$3" file prefix="artifacts/ch${num}-${slug}/"
  while IFS= read -r file; do
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

prompt_for() {
  local stage="$1" slug="$2"
  case "$stage" in
    build) cat <<EOF
Build chapter '$slug' in the Agentic Loops refsite. The driver already enforces the refsite-runner state machine, scope, validation, and commits. Read AGENTS.md, prompts/notes/$slug.md, and its docs/research chapter before editing. Start the chapter work immediately; do not spend the run reloading runner manuals. Keep the conceptual spine vendor-neutral. Implement the prose, figure, signature widget, sources with direct links, runnable artifact README and check.sh. Use the existing state scripts to mark the chapter draft. Run npm run check. Do not commit, push, or edit any other chapter.
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
  local stage="$1" slug="$2" num before after prompt log
  [[ "$stage" != done && "$stage" != error ]] || { echo "nothing to run: $stage"; return 0; }
  num="$(target_num "$slug")"; [[ -n "$num" ]] || die "could not find chapter '$slug'"
  before="$(python3 scripts/decide.py counts)"
  prompt="$(prompt_for "$stage" "$slug")"
  mkdir -p .pipeline
  log=".pipeline/${stage}-${slug}-$(date +%Y%m%d-%H%M%S).log"
  echo "== $stage $slug with $MODEL (effort=$EFFORT) =="
  if (( DRY )); then printf '%s\n' "$prompt"; return 0; fi
  if ! codex --search -m "$MODEL" -c "model_reasoning_effort=\"$EFFORT\"" -s "$SANDBOX" -a never -C "$ROOT" exec "$prompt" >"$log" 2>&1; then
    echo "run.sh: Terra failed; tail of $log:" >&2
    tail -80 "$log" >&2
    return 1
  fi
  echo "Terra stage completed; full transcript: $log"
  scope_ok "$stage" "$slug" "$num" || return 1
  [[ -n "$(git diff --name-only)" ]] || { echo "run.sh: stalled stage '$stage' (1/3): no changes" >&2; return 1; }
  python3 scripts/validate.py
  if (( CHECK )); then npm run check; fi
  after="$(python3 scripts/decide.py counts)"
  [[ "$before" != "$after" ]] || { echo "run.sh: stalled stage '$stage' (1/3): state did not change" >&2; return 1; }
  git add -A
  git commit -m "${stage}(${slug}): Terra stage"
  if (( PUSH )); then git push -u origin HEAD; fi
}

if [[ "$VERB" == loop ]]; then
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
