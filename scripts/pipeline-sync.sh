#!/usr/bin/env bash
# Push only committed work that is actually ahead. All sync failures are EX_UNAVAILABLE.
set -uo pipefail

ROOT="$(CDPATH= cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
REPO_ROOT="${PIPELINE_REPO_ROOT:-$ROOT}"
GIT_HELPER="$ROOT/scripts/pipeline-git.sh"
SYNC_EXIT=69

if [[ "${1:-}" == --repo ]]; then
  (($# == 2)) || { echo "pipeline-sync: usage: pipeline-sync.sh [--repo PATH]" >&2; exit 2; }
  REPO_ROOT="$2"
elif (($#)); then
  echo "pipeline-sync: usage: pipeline-sync.sh [--repo PATH]" >&2
  exit 2
fi

git_run() {
  "$GIT_HELPER" --repo "$REPO_ROOT" "$@"
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
  git_run push -u origin HEAD || sync_failed "git push failed"
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
git_run push || sync_failed "git push failed"
