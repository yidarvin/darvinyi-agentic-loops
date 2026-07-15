#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")"

output="$(python3 loop.py)"
printf '%s\n' "$output"

for phase in PERCEIVE DECIDE ACT OBSERVE HALT; do
  if ! grep -Fq "$phase" <<<"$output"; then
    echo "artifact check failed: missing $phase phase" >&2
    exit 1
  fi
done
