#!/usr/bin/env bash
# Compatibility wrapper. The state-machine driver replaced the old Claude queue loop.
set -euo pipefail

echo "runqueue.sh is deprecated; forwarding to ./run.sh" >&2
args=()
while (($#)); do
  case "$1" in
    -a|--all) args+=(loop); shift ;;
    -n|--count) [[ $# -ge 2 ]] || { echo "$1 needs a count" >&2; exit 2; }; args+=(loop "$2"); shift 2 ;;
    --no-push) echo "--no-push is now the default" >&2; shift ;;
    -m|--model|-e|--effort) [[ $# -ge 2 ]] || exit 2; args+=("$1" "$2"); shift 2 ;;
    --dry-run|--allow-dirty|--no-check|--push|-h|--help) args+=("$1"); shift ;;
    *) echo "runqueue.sh: unsupported legacy flag '$1'; use ./run.sh --help" >&2; exit 2 ;;
  esac
done
if ((${#args[@]} == 0)); then args=(loop); fi
exec "$(dirname "$0")/run.sh" "${args[@]}"
