#!/usr/bin/env bash
# Execute every parent-process Git operation through one TCC-stable identity.
set -euo pipefail

ROOT="$(CDPATH= cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
REPO_ROOT="${PIPELINE_REPO_ROOT:-$ROOT}"
GIT_BIN="${PIPELINE_GIT_BIN:-/usr/bin/git}"
GIT_TIMEOUT="${PIPELINE_GIT_TIMEOUT_SECONDS:-60}"
GIT_TERM_GRACE="${PIPELINE_GIT_TERM_GRACE_SECONDS:-5}"
GIT_DEADLINE="$ROOT/scripts/git_deadline.py"

if [[ "${1:-}" == --repo ]]; then
  (($# >= 3)) || { echo "pipeline-git: --repo needs a path and Git arguments" >&2; exit 2; }
  REPO_ROOT="$2"
  shift 2
fi

[[ -x "$GIT_BIN" ]] || { echo "pipeline-git: Git executable is not runnable: $GIT_BIN" >&2; exit 2; }
[[ -x "$GIT_DEADLINE" ]] || { echo "pipeline-git: Git deadline helper is not runnable: $GIT_DEADLINE" >&2; exit 2; }
[[ -d "$REPO_ROOT" ]] || { echo "pipeline-git: repository root does not exist: $REPO_ROOT" >&2; exit 2; }

NEUTRAL_DIR="${HOME:-/}"
[[ -d "$NEUTRAL_DIR" && -r "$NEUTRAL_DIR" ]] || NEUTRAL_DIR=/
cd "$NEUTRAL_DIR"
exec "$GIT_DEADLINE" --timeout "$GIT_TIMEOUT" --term-grace "$GIT_TERM_GRACE" \
  -- "$GIT_BIN" -C "$REPO_ROOT" "$@"
