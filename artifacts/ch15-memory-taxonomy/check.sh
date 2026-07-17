#!/usr/bin/env bash
set -euo pipefail

here="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$here"

if ! command -v node >/dev/null 2>&1; then
  echo "node 18+ is required for this artifact" >&2
  exit 1
fi

comparison="$(node memory_harness.mjs --compare)"

grep -Fq "=== REGIME: working (fresh working state) ===" <<<"$comparison"
grep -Fq "Unknown. The active working state was reset, so the old session is absent from this context projection." <<<"$comparison"
grep -Fq "=== REGIME: episodic (episodic) ===" <<<"$comparison"
grep -Fq "production failed after a migration mismatch" <<<"$comparison"
grep -Fq "=== REGIME: semantic (semantic) ===" <<<"$comparison"
grep -Fq "Mira's profile says: vegetarian." <<<"$comparison"
grep -Fq "=== REGIME: procedural (procedural) ===" <<<"$comparison"
grep -Fq "Run migration verification and block production deployment until it passes." <<<"$comparison"

custom_comparison="$(node memory_harness.mjs --trace fixtures/custom-trace.json --compare)"
grep -Fq "=== REGIME: episodic (episodic) ===" <<<"$custom_comparison"
grep -Fq "At 08:15, Noor said I avoid peanuts." <<<"$custom_comparison"
grep -Fq "=== REGIME: semantic (semantic) ===" <<<"$custom_comparison"
grep -Fq "Noor's profile says: peanut-free." <<<"$custom_comparison"
grep -Fq "Run schema validation and block rollout until it passes." <<<"$custom_comparison"
if grep -Fq "Mira's profile says: vegetarian." <<<"$custom_comparison"; then
  echo "custom trace did not replace the default comparison" >&2
  exit 1
fi

echo "memory-regime harness: checks passed"
