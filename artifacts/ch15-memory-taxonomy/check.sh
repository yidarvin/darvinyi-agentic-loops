#!/usr/bin/env bash
set -euo pipefail

here="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$here"

if ! command -v node >/dev/null 2>&1; then
  echo "node 18+ is required for this artifact" >&2
  exit 1
fi

comparison="$(node memory_harness.mjs --compare)"

grep -Fq "=== REGIME: working (working only) ===" <<<"$comparison"
grep -Fq "Unknown. The old session is not in this context window." <<<"$comparison"
grep -Fq "=== REGIME: episodic (episodic) ===" <<<"$comparison"
grep -Fq "production failed after a migration mismatch" <<<"$comparison"
grep -Fq "=== REGIME: semantic (semantic) ===" <<<"$comparison"
grep -Fq "Mira's profile says: vegetarian." <<<"$comparison"
grep -Fq "=== REGIME: procedural (procedural) ===" <<<"$comparison"
grep -Fq "Run migration verification and block production deployment until it passes." <<<"$comparison"

echo "memory-regime harness: checks passed"
