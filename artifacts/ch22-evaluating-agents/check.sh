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

python3 "$artifact_dir/harness.py" \
  --runs 1 \
  --agent-command "python3 $artifact_dir/negative_agent.py --mode non-utf8-stdout" \
  --report "$work_dir/non-utf8.json" > /dev/null

python3 - "$work_dir/non-utf8.json" <<'PY'
import json
import sys
from pathlib import Path

report_path = Path(sys.argv[1])
assert report_path.is_file(), report_path
report = json.loads(report_path.read_text(encoding="utf-8"))
assert report["summary"]["pass_at_1"] == 0.0, report["summary"]
assert all("agent_error" in trial["failure_tags"] for trial in report["trials"]), report["trials"]
assert all("agent stdout must be valid UTF-8" in trial["agent"]["summary"] for trial in report["trials"]), report["trials"]
print("non-UTF-8 agent stdout becomes a failed trial with a report")
PY

python3 "$artifact_dir/harness.py" \
  --runs 1 \
  --agent-command "python3 $artifact_dir/negative_agent.py --mode unreadable" \
  --report "$work_dir/unreadable.json" > /dev/null

python3 - "$work_dir/unreadable.json" <<'PY'
import json
import sys
from pathlib import Path

report = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
assert report["summary"]["pass_at_1"] == 0.0, report["summary"]
assert all(trial["outcome_passed"] is False for trial in report["trials"]), report["trials"]
assert all("agent_error" not in trial["failure_tags"] for trial in report["trials"]), report["trials"]
assert all(trial["checks"] for trial in report["trials"]), report["trials"]
print("unreadable checked files become controlled failed checks")
PY

python3 "$artifact_dir/harness.py" \
  --runs 1 \
  --agent-command "python3 $artifact_dir/negative_agent.py --mode symlink-loop" \
  --report "$work_dir/symlink-loop.json" > "$work_dir/symlink-loop-output.txt"

python3 - "$work_dir/symlink-loop.json" <<'PY'
import json
import sys
from pathlib import Path

report_path = Path(sys.argv[1])
assert report_path.is_file(), report_path
report = json.loads(report_path.read_text(encoding="utf-8"))
greeting = next(trial for trial in report["trials"] if trial["task_id"] == "patch-greeting")
assert greeting["outcome_passed"] is False, greeting
assert greeting["passed"] is False, greeting
assert "agent_error" in greeting["failure_tags"], greeting
assert "could not resolve task path: greeting.txt" in greeting["agent"]["summary"], greeting
assert report["summary"]["pass_at_1"] == 0.75, report["summary"]
print("self-referential symlink becomes a failed trial with a report")
PY

python3 - "$artifact_dir/harness.py" <<'PY'
import os
import runpy
import stat
import sys
import tempfile
from pathlib import Path

harness = runpy.run_path(sys.argv[1])
with tempfile.TemporaryDirectory() as temporary:
    workspace = Path(temporary)
    ghost = workspace / "ghost"
    ghost.symlink_to("missing-target")
    assert os.path.lexists(ghost), ghost
    result = harness["grade_check"](workspace, {"kind": "file_absent", "path": "ghost"})
    assert result["passed"] is False, result
    assert result["detail"] == "file unexpectedly exists", result
    ghost.unlink()
    ghost.write_text("present", encoding="utf-8")
    result = harness["grade_check"](
        workspace,
        {"kind": "file_absent", "path": "missing-parent/../ghost"},
    )
    assert result["passed"] is False, result
    assert result["detail"] == "file unexpectedly exists", result
    ghost.unlink()
    nested = workspace / "nested"
    (nested / "dir").mkdir(parents=True)
    (nested / "ghost").write_text("present", encoding="utf-8")
    (workspace / "link").symlink_to("nested/dir", target_is_directory=True)
    result = harness["grade_check"](
        workspace,
        {"kind": "file_absent", "path": "link/../ghost"},
    )
    assert result["passed"] is False, result
    assert result["detail"] == "file unexpectedly exists", result
    locked = workspace / "locked"
    locked.mkdir()
    (locked / "ghost").write_text("present", encoding="utf-8")
    locked.chmod(0)
    try:
        try:
            result = harness["grade_check"](workspace, {"kind": "file_absent", "path": "locked/ghost"})
        except harness["HarnessError"] as error:
            assert "could not inspect task path: locked/ghost" in str(error), error
        else:
            assert result["passed"] is False, result
            assert result["detail"] == "file unexpectedly exists", result
    finally:
        locked.chmod(stat.S_IRWXU)
print("file_absent rejects dangling symlinks, semantic traversal, and hidden entries")
PY

python3 "$artifact_dir/harness.py" \
  --runs 1 \
  --agent-command "python3 $artifact_dir/negative_agent.py --mode replace-workspace" \
  --report "$work_dir/replaced-workspace.json" > /dev/null

python3 - "$work_dir/replaced-workspace.json" <<'PY'
import json
import sys
from pathlib import Path

report_path = Path(sys.argv[1])
assert report_path.is_file(), report_path
report = json.loads(report_path.read_text(encoding="utf-8"))
assert report["summary"]["pass_at_1"] == 0.0, report["summary"]
assert all("agent_error" in trial["failure_tags"] for trial in report["trials"]), report["trials"]
assert all("workspace root was replaced by agent" in trial["agent"]["summary"] for trial in report["trials"]), report["trials"]
print("a replaced workspace root becomes a failed trial with a report")
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
