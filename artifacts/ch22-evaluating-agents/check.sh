#!/usr/bin/env bash
set -euo pipefail

artifact_dir="$(cd "$(dirname "$0")" && pwd)"
work_dir="$(mktemp -d)"
trap 'rm -rf "$work_dir"' EXIT

python3 "$artifact_dir/harness.py" --runs 3 --report "$work_dir/report.json" > "$work_dir/output.txt"

python3 - "$work_dir/report.json" <<'PY'
import json
import sys
from pathlib import Path

report = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
summary = report["summary"]
assert summary["task_count"] == 4, summary
assert summary["runs_per_task"] == 3, summary
assert summary["pass_at_1"] == 0.75, summary
assert summary["pass_at_k"] == 1.0, summary
assert summary["pass_to_k"] == 0.5, summary
assert len(report["trials"]) == 12, report["trials"]
tags = {tag for trial in report["trials"] for tag in trial["failure_tags"]}
assert "verification_miss" in tags, tags
assert "invalid_arguments" in tags, tags
assert all("checks" in trial and "trajectory" in trial and "passed" in trial for trial in report["trials"]), report["trials"]
print("harness assertions passed")
PY

python3 "$artifact_dir/harness.py" \
  --runs 1 \
  --agent-command "python3 $artifact_dir/negative_agent.py --mode forbidden" \
  --report "$work_dir/forbidden.json" > /dev/null

python3 - "$work_dir/forbidden.json" <<'PY'
import json
import sys
from pathlib import Path

report = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
boundary = next(trial for trial in report["trials"] if trial["task_id"] == "preserve-boundary")
assert boundary["outcome_passed"] is True, boundary
assert boundary["trajectory"]["passed"] is False, boundary
assert boundary["passed"] is False, boundary
assert report["summary"]["pass_at_1"] == 0.75, report["summary"]
print("forbidden action cannot raise pass metrics")
PY

python3 "$artifact_dir/harness.py" \
  --runs 1 \
  --agent-command "python3 $artifact_dir/negative_agent.py --mode nan" \
  --report "$work_dir/nan.json" > /dev/null

python3 - "$work_dir/nan.json" <<'PY'
import json
import sys
from pathlib import Path

report = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
assert report["summary"]["pass_at_1"] == 0.0, report["summary"]
assert all("agent_error" in trial["failure_tags"] for trial in report["trials"]), report["trials"]
assert all(trial["agent"]["cost_usd"] is None for trial in report["trials"]), report["trials"]
print("non-finite metrics are rejected")
PY

python3 "$artifact_dir/harness.py" \
  --runs 1 \
  --agent-command "python3 $artifact_dir/negative_agent.py --mode missing" \
  --report "$work_dir/missing.json" > /dev/null

python3 - "$work_dir/missing.json" <<'PY'
import json
import sys
from pathlib import Path

report = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
assert report["summary"]["pass_at_1"] == 0.0, report["summary"]
assert all("agent_error" in trial["failure_tags"] for trial in report["trials"]), report["trials"]
assert all("must include turns" in trial["agent"]["summary"] for trial in report["trials"]), report["trials"]
print("required metric fields are enforced")
PY

python3 "$artifact_dir/harness.py" \
  --runs 1 \
  --agent-command "python3 $artifact_dir/negative_agent.py --mode binary" \
  --report "$work_dir/binary.json" > /dev/null

python3 - "$work_dir/binary.json" <<'PY'
import json
import sys
from pathlib import Path

report = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
assert report["summary"]["pass_at_1"] == 0.0, report["summary"]
assert all(trial["outcome_passed"] is False for trial in report["trials"]), report["trials"]
assert all("agent_error" not in trial["failure_tags"] for trial in report["trials"]), report["trials"]
print("binary file output becomes a controlled failed check")
PY

if python3 "$artifact_dir/harness.py" --tasks "$artifact_dir/invalid-top-level.json" > /dev/null 2> "$work_dir/invalid-top-level.txt"; then
  echo "invalid top-level task schema unexpectedly passed" >&2
  exit 1
fi
grep -q "harness error: task file must be a JSON object" "$work_dir/invalid-top-level.txt"

if python3 "$artifact_dir/harness.py" --tasks "$artifact_dir/invalid-trajectory.json" > /dev/null 2> "$work_dir/invalid-trajectory.txt"; then
  echo "invalid trajectory task schema unexpectedly passed" >&2
  exit 1
fi
grep -q "harness error: trajectory must be an object" "$work_dir/invalid-trajectory.txt"

grep -q "pass@3=100.0%" "$work_dir/output.txt"
grep -q "pass^3=50.0%" "$work_dir/output.txt"
printf 'ch22 evaluation harness check passed\n'
