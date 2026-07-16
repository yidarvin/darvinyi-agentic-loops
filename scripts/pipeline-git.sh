#!/usr/bin/env bash
# Execute every parent-process Git operation through one TCC-stable identity.
set -euo pipefail

ROOT="$(CDPATH= cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
REPO_ROOT="${PIPELINE_REPO_ROOT:-$ROOT}"
GIT_BIN="${PIPELINE_GIT_BIN:-/usr/bin/git}"

if [[ "${1:-}" == --repo ]]; then
  (($# >= 3)) || { echo "pipeline-git: --repo needs a path and Git arguments" >&2; exit 2; }
  REPO_ROOT="$2"
  shift 2
fi

[[ -x "$GIT_BIN" ]] || { echo "pipeline-git: Git executable is not runnable: $GIT_BIN" >&2; exit 2; }
[[ -d "$REPO_ROOT" ]] || { echo "pipeline-git: repository root does not exist: $REPO_ROOT" >&2; exit 2; }

NEUTRAL_DIR="${HOME:-/}"
[[ -d "$NEUTRAL_DIR" && -r "$NEUTRAL_DIR" ]] || NEUTRAL_DIR=/
cd "$NEUTRAL_DIR"
exec "$GIT_BIN" -C "$REPO_ROOT" "$@"
