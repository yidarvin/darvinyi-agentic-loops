#!/usr/bin/env bash
set -euo pipefail

here="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$here"

if ! command -v node >/dev/null 2>&1; then
  echo "node 18+ is required for this artifact" >&2
  exit 1
fi

report="$(node cache_benchmark.mjs --simulate --trials 4 --prefix-words 160 --tail-words 24 --json)"

node -e '
const report = JSON.parse(process.argv[1]);
if (report.mode !== "simulate") throw new Error("expected simulation mode");
const friendly = report.layouts.find((item) => item.layout === "cache-friendly");
const breaking = report.layouts.find((item) => item.layout === "cache-breaking");
if (!friendly || !breaking) throw new Error("missing benchmark layouts");
if (friendly.promptCacheHitTokens <= 0) throw new Error("cache-friendly layout did not model a hit");
if (breaking.promptCacheHitTokens !== 0) throw new Error("cache-breaking layout unexpectedly hit");
if (friendly.estimatedInputCostUsd >= breaking.estimatedInputCostUsd) throw new Error("cache-friendly layout did not reduce input cost");
if (friendly.elapsedMs >= breaking.elapsedMs) throw new Error("cache-friendly layout did not reduce modeled elapsed time");
console.log("cache-layout benchmark: checks passed");
' "$report"
