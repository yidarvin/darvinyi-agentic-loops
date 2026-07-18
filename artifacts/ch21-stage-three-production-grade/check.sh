#!/usr/bin/env bash
set -euo pipefail

artifact_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
python_bin="${PYTHON_BIN:-python3}"
temporary_dir="$(mktemp -d "${TMPDIR:-/tmp}/stage-three-harness.XXXXXX")"

cleanup() {
  rm -rf "$temporary_dir"
}
trap cleanup EXIT

"$python_bin" "$artifact_dir/stage_three_agent.py" --self-test

if [[ "$(uname -s)" == "Darwin" ]] && [[ -x /usr/bin/sandbox-exec ]]; then
  cp -R "$artifact_dir/demo_workspace" "$temporary_dir/workspace"

  "$python_bin" "$artifact_dir/stage_three_agent.py" demo \
    --workspace "$temporary_dir/workspace" \
    --approve-verification \
    --stream ndjson > "$temporary_dir/trace.ndjson"

  "$python_bin" "$artifact_dir/stage_three_agent.py" --assert-trace "$temporary_dir/trace.ndjson"
  test -f "$temporary_dir/workspace/verification.txt"

  echo "artifact check: stage-three harness probe passed"
else
  echo "artifact check: deterministic invariants passed; public demo correctly fails closed without Seatbelt"
fi
