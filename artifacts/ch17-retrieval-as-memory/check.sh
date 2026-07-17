#!/usr/bin/env bash
set -euo pipefail

here="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$here"

if ! command -v node >/dev/null 2>&1; then
  echo "node 18+ is required for this artifact" >&2
  exit 1
fi

node retrieval_memory.mjs --self-test
