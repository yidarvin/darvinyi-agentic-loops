#!/usr/bin/env bash
set -euo pipefail

here="$(cd -- "$(dirname -- "$0")" && pwd)"
cd "$here"

if ! command -v node >/dev/null 2>&1; then
  echo "node 18+ is required for this artifact" >&2
  exit 1
fi

workdir="$(mktemp -d)"
trap 'rm -rf "$workdir"' EXIT

node self_managed_memory.mjs --reset --session 1 --state "$workdir/state.json" --json > "$workdir/session-1.json"
node self_managed_memory.mjs --session 2 --state "$workdir/state.json" --json > "$workdir/session-2.json"
node verify_demo.mjs "$workdir"
