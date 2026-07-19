#!/usr/bin/env python3
"""A small, inspectable agent evaluation harness.

The harness intentionally separates agent-facing task data from grader-only
expected state. It gives every task attempt a fresh temporary workspace, invokes
an agent command without a shell, grades the final state and declared actions, and
writes a structured report suitable for inspection or later CI integration.
"""

from __future__ import annotations

import argparse
import json
import math
import os
import shlex
import subprocess
import sys
import tempfile
import time
from collections import defaultdict
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parent


class HarnessError(RuntimeError):
    """A readable configuration or agent-contract error."""


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Score an agent across a local task set.")
    parser.add_argument("--tasks", default=str(ROOT / "tasks.json"), help="Task-set JSON path.")
    parser.add_argument("--runs", type=int, default=3, help="Independent trials per task.")
    parser.add_argument(
        "--agent-command",
        help="Command for a compatible agent. Parsed without a shell. Defaults to the bundled fixture agent.",
    )
    parser.add_argument("--timeout", type=float, default=15.0, help="Per-trial command timeout in seconds.")
    parser.add_argument("--report", default="report.json", help="Where to write the JSON report.")
    return parser.parse_args()


def load_task_set(path: Path) -> list[dict[str, Any]]:
    try:
        document = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError as error:
        raise HarnessError("task file not found: " + str(path)) from error
    except json.JSONDecodeError as error:
        raise HarnessError("task file is not valid JSON: " + str(error)) from error

    if not isinstance(document, dict):
        raise HarnessError("task file must be a JSON object with a tasks list")
    tasks = document.get("tasks")
    if not isinstance(tasks, list) or not tasks:
        raise HarnessError("task file must contain a non-empty tasks list")

    ids: set[str] = set()
    for task in tasks:
        if not isinstance(task, dict):
            raise HarnessError("every task must be an object")
        task_id = task.get("id")
        if not isinstance(task_id, str) or not task_id:
            raise HarnessError("every task needs a non-empty id")
        if task_id in ids:
            raise HarnessError("duplicate task id: " + task_id)
        ids.add(task_id)
        if not isinstance(task.get("prompt"), str):
            raise HarnessError("task " + task_id + " needs a prompt")
        requirements = task.get("requirements", [])
        if not isinstance(requirements, list) or not all(isinstance(item, str) for item in requirements):
            raise HarnessError("requirements must be a list of strings for " + task_id)
        initial_files = task.get("initial_files", {})
        if not isinstance(initial_files, dict) or not all(
            isinstance(relative_path, str) and isinstance(content, str)
            for relative_path, content in initial_files.items()
        ):
            raise HarnessError("initial_files must map strings to strings for " + task_id)
        checks = task.get("checks")
        if not isinstance(checks, list) or not checks:
            raise HarnessError("task " + task_id + " needs at least one deterministic check")
        for check in checks:
            if not isinstance(check, dict):
                raise HarnessError("every check must be an object for " + task_id)
            kind = check.get("kind")
            check_path = check.get("path")
            if kind not in {"file_equals", "file_contains", "file_absent"} or not isinstance(check_path, str):
                raise HarnessError("check kind and path are invalid for " + task_id)
            if kind in {"file_equals", "file_contains"} and not isinstance(check.get("expected"), str):
                raise HarnessError(str(kind) + " needs a string expected value for " + task_id)

        trajectory = task.get("trajectory", {})
        if not isinstance(trajectory, dict):
            raise HarnessError("trajectory must be an object for " + task_id)
        for field in ("required_actions", "allowed_actions", "forbidden_actions"):
            actions = trajectory.get(field, [])
            if not isinstance(actions, list) or not all(isinstance(action, str) for action in actions):
                raise HarnessError(field + " must be a list of strings for " + task_id)
        failure_tags = task.get("failure_tags", {})
        if not isinstance(failure_tags, dict) or not all(isinstance(value, str) for value in failure_tags.values()):
            raise HarnessError("failure_tags must map strings to strings for " + task_id)

        task["requirements"] = requirements
        task["initial_files"] = initial_files
        task["trajectory"] = trajectory
        task["failure_tags"] = failure_tags
    return tasks


def workspace_path(workspace: Path, relative_path: str) -> Path:
    """Resolve a task path and reject traversal outside the fresh workspace."""

    try:
        workspace_root = workspace.resolve()
        candidate = (workspace / relative_path).resolve()
    except (OSError, RuntimeError) as error:
        raise HarnessError("could not resolve task path: " + relative_path) from error
    try:
        candidate.relative_to(workspace_root)
    except ValueError as error:
        raise HarnessError("task path escapes workspace: " + relative_path) from error
    return candidate


def seed_workspace(workspace: Path, task: dict[str, Any]) -> None:
    initial_files = task.get("initial_files", {})
    if not isinstance(initial_files, dict):
        raise HarnessError("initial_files must be an object for " + task["id"])
    for relative_path, content in initial_files.items():
        if not isinstance(relative_path, str) or not isinstance(content, str):
            raise HarnessError("initial_files entries must map strings to strings")
        target = workspace_path(workspace, relative_path)
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content, encoding="utf-8")


def agent_view(task: dict[str, Any]) -> dict[str, Any]:
    """Return the task contract without exposing grader or expected-state fields."""

    return {
        "id": task["id"],
        "prompt": task["prompt"],
        "requirements": task.get("requirements", []),
        "allowed_actions": task.get("trajectory", {}).get("allowed_actions", []),
        "forbidden_actions": task.get("trajectory", {}).get("forbidden_actions", []),
    }


def read_text_if_present(path: Path) -> str | None:
    if not path.is_file():
        return None
    try:
        return path.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        return None


def grade_check(workspace: Path, check: dict[str, Any]) -> dict[str, Any]:
    kind = check.get("kind")
    relative_path = check.get("path")
    if not isinstance(relative_path, str):
        raise HarnessError("a check needs a string path")
    target = workspace_path(workspace, relative_path)

    if kind == "file_equals":
        expected = check.get("expected")
        if not isinstance(expected, str):
            raise HarnessError("file_equals needs a string expected value")
        actual = read_text_if_present(target)
        return {
            "kind": kind,
            "path": relative_path,
            "passed": actual == expected,
            "detail": "file matched expected content" if actual == expected else "file content differed or was absent",
        }

    if kind == "file_contains":
        expected = check.get("expected")
        if not isinstance(expected, str):
            raise HarnessError("file_contains needs a string expected value")
        actual = read_text_if_present(target)
        passed = actual is not None and expected in actual
        return {
            "kind": kind,
            "path": relative_path,
            "passed": passed,
            "detail": "file contained expected text" if passed else "file did not contain expected text",
        }

    if kind == "file_absent":
        # Check the requested entry rather than its resolved target so a dangling
        # symlink remains present for an absence grader. workspace_path() above
        # still validates that the requested path stays inside the workspace. The
        # lexical normalization makes missing-parent/../entry address entry.
        entry_path = workspace / os.path.normpath(relative_path)
        passed = not os.path.lexists(entry_path)
        return {
            "kind": kind,
            "path": relative_path,
            "passed": passed,
            "detail": "file was absent" if passed else "file unexpectedly exists",
        }

    raise HarnessError("unsupported check kind: " + str(kind))


def normalize_actions(raw_result: dict[str, Any]) -> list[str]:
    if "actions" not in raw_result:
        raise HarnessError("agent JSON must include actions")
    actions = raw_result["actions"]
    if not isinstance(actions, list) or not all(isinstance(action, str) for action in actions):
        raise HarnessError("agent JSON actions must be a list of strings")
    return actions


def normalize_number(raw_result: dict[str, Any], key: str) -> float | None:
    if key not in raw_result:
        raise HarnessError("agent JSON must include " + key)
    value = raw_result[key]
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise HarnessError("agent JSON " + key + " must be a finite non-negative number")
    normalized = float(value)
    if not math.isfinite(normalized) or normalized < 0:
        raise HarnessError("agent JSON " + key + " must be a finite non-negative number")
    return normalized


def grade_trajectory(task: dict[str, Any], actions: list[str]) -> tuple[dict[str, Any], list[str]]:
    trajectory = task.get("trajectory", {})
    if not isinstance(trajectory, dict):
        raise HarnessError("trajectory must be an object for " + task["id"])

    required = trajectory.get("required_actions", [])
    allowed = trajectory.get("allowed_actions", required)
    forbidden = trajectory.get("forbidden_actions", [])
    if not all(isinstance(action, str) for action in required + allowed + forbidden):
        raise HarnessError("trajectory actions must be strings")

    required_set = set(required)
    allowed_set = set(allowed)
    forbidden_set = set(forbidden)
    action_set = set(actions)
    missing = sorted(required_set - action_set)
    prohibited = sorted(forbidden_set & action_set)
    unexpected = sorted(action_set - allowed_set) if allowed_set else []
    recall = 1.0 if not required_set else (len(required_set & action_set) / len(required_set))
    precision = 1.0 if not actions else (len([action for action in actions if action in allowed_set]) / len(actions))
    passed = not missing and not prohibited
    tags: list[str] = []
    failure_tags = task.get("failure_tags", {})
    if missing:
        tags.append(str(failure_tags.get("trajectory", "trajectory_miss")))
    if prohibited:
        tags.append(str(failure_tags.get("policy", "policy_violation")))

    return (
        {
            "passed": passed,
            "required_actions": sorted(required_set),
            "seen_actions": actions,
            "missing_actions": missing,
            "prohibited_actions": prohibited,
            "unexpected_actions": unexpected,
            "precision": precision,
            "recall": recall,
        },
        tags,
    )


def invoke_agent(
    command: list[str],
    task_path: Path,
    workspace: Path,
    trial: int,
    timeout: float,
) -> tuple[dict[str, Any], float, str]:
    invocation = [*command, "--task", str(task_path), "--workspace", str(workspace), "--trial", str(trial)]
    started = time.perf_counter()
    try:
        process = subprocess.run(
            invocation,
            cwd=workspace,
            capture_output=True,
            text=True,
            timeout=timeout,
            check=False,
        )
    except FileNotFoundError as error:
        raise HarnessError("could not start agent command: " + command[0]) from error
    except subprocess.TimeoutExpired as error:
        raise HarnessError("agent timed out after " + str(timeout) + " seconds") from error
    duration_seconds = time.perf_counter() - started

    if process.returncode != 0:
        detail = process.stderr.strip() or process.stdout.strip() or "agent returned no diagnostic output"
        raise HarnessError("agent exited " + str(process.returncode) + ": " + detail)

    try:
        result = json.loads(process.stdout.strip())
    except json.JSONDecodeError as error:
        raise HarnessError("agent stdout must contain one JSON object: " + str(error)) from error
    if not isinstance(result, dict):
        raise HarnessError("agent stdout JSON must be an object")
    return result, duration_seconds, process.stderr.strip()


def run_trial(
    task: dict[str, Any],
    trial: int,
    command: list[str],
    timeout: float,
) -> dict[str, Any]:
    with tempfile.TemporaryDirectory(prefix="agent-eval-" + task["id"] + "-") as temporary:
        workspace = Path(temporary)
        seed_workspace(workspace, task)
        task_path = workspace / "agent_task.json"
        task_path.write_text(json.dumps(agent_view(task), indent=2, sort_keys=True), encoding="utf-8")
        failure_tags: list[str] = []

        try:
            raw_result, duration_seconds, stderr = invoke_agent(command, task_path, workspace, trial, timeout)
            actions = normalize_actions(raw_result)
            turns = normalize_number(raw_result, "turns")
            cost_usd = normalize_number(raw_result, "cost_usd")
            checks = [grade_check(workspace, check) for check in task["checks"]]
            outcome_passed = all(check["passed"] for check in checks)
            if not outcome_passed:
                failure_tags.append(str(task.get("failure_tags", {}).get("outcome", "outcome_mismatch")))
            trajectory, trajectory_tags = grade_trajectory(task, actions)
            failure_tags.extend(trajectory_tags)
            accepted = outcome_passed and bool(trajectory["passed"])
            return {
                "task_id": task["id"],
                "trial": trial,
                "outcome_passed": outcome_passed,
                "passed": accepted,
                "trajectory": trajectory,
                "checks": checks,
                "failure_tags": sorted(set(failure_tags)),
                "agent": {
                    "actions": actions,
                    "turns": turns,
                    "cost_usd": cost_usd,
                    "summary": raw_result.get("summary"),
                    "stderr": stderr,
                },
                "duration_seconds": duration_seconds,
            }
        except HarnessError as error:
            return {
                "task_id": task["id"],
                "trial": trial,
                "outcome_passed": False,
                "passed": False,
                "trajectory": {
                    "passed": False,
                    "required_actions": task.get("trajectory", {}).get("required_actions", []),
                    "seen_actions": [],
                    "missing_actions": task.get("trajectory", {}).get("required_actions", []),
                    "prohibited_actions": [],
                    "unexpected_actions": [],
                    "precision": 0.0,
                    "recall": 0.0,
                },
                "checks": [],
                "failure_tags": ["agent_error"],
                "agent": {
                    "actions": [],
                    "turns": None,
                    "cost_usd": None,
                    "summary": str(error),
                    "stderr": "",
                },
                "duration_seconds": None,
            }


def summarize(results: list[dict[str, Any]], task_ids: list[str], runs: int) -> dict[str, Any]:
    by_task: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for result in results:
        by_task[str(result["task_id"])].append(result)

    pass_at_1_count = 0
    pass_at_k_count = 0
    pass_to_k_count = 0
    for task_id in task_ids:
        attempts = sorted(by_task[task_id], key=lambda item: int(item["trial"]))
        if attempts and attempts[0]["passed"]:
            pass_at_1_count += 1
        if any(attempt["passed"] for attempt in attempts):
            pass_at_k_count += 1
        if len(attempts) == runs and all(attempt["passed"] for attempt in attempts):
            pass_to_k_count += 1

    costs = [
        float(result["agent"]["cost_usd"])
        for result in results
        if result["agent"]["cost_usd"] is not None
    ]
    turns = [
        float(result["agent"]["turns"])
        for result in results
        if result["agent"]["turns"] is not None
    ]
    durations = [
        float(result["duration_seconds"])
        for result in results
        if result["duration_seconds"] is not None
    ]
    total = len(task_ids)
    return {
        "task_count": total,
        "runs_per_task": runs,
        "pass_at_1": pass_at_1_count / total,
        "pass_at_k": pass_at_k_count / total,
        "pass_to_k": pass_to_k_count / total,
        "mean_cost_usd": (sum(costs) / len(costs)) if costs else None,
        "mean_turns": (sum(turns) / len(turns)) if turns else None,
        "mean_duration_seconds": (sum(durations) / len(durations)) if durations else None,
    }


def print_results(results: list[dict[str, Any]], summary: dict[str, Any]) -> None:
    by_task: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for result in results:
        by_task[str(result["task_id"])].append(result)

    print("")
    print("task                    accepted   pass@k  pass^k  failure tags")
    print("-" * 76)
    for task_id in sorted(by_task):
        attempts = sorted(by_task[task_id], key=lambda item: int(item["trial"]))
        outcomes = "".join("P" if item["passed"] else "F" for item in attempts)
        pass_at_k = any(item["passed"] for item in attempts)
        pass_to_k = all(item["passed"] for item in attempts)
        tags = sorted({tag for item in attempts for tag in item["failure_tags"]})
        print(
            task_id.ljust(23)
            + outcomes.ljust(11)
            + ("yes" if pass_at_k else "no").ljust(8)
            + ("yes" if pass_to_k else "no").ljust(8)
            + (", ".join(tags) if tags else "none")
        )

    print("")
    print(
        "summary: pass@1="
        + format(summary["pass_at_1"] * 100, ".1f")
        + "% pass@"
        + str(summary["runs_per_task"])
        + "="
        + format(summary["pass_at_k"] * 100, ".1f")
        + "% pass^"
        + str(summary["runs_per_task"])
        + "="
        + format(summary["pass_to_k"] * 100, ".1f")
        + "%"
    )
    if summary["mean_cost_usd"] is not None:
        print(
            "means: cost=$"
            + format(summary["mean_cost_usd"], ".3f")
            + " turns="
            + format(summary["mean_turns"], ".2f")
            + " duration="
            + format(summary["mean_duration_seconds"], ".3f")
            + "s"
        )


def main() -> int:
    args = parse_args()
    if args.runs < 1:
        raise HarnessError("--runs must be at least 1")
    if args.timeout <= 0:
        raise HarnessError("--timeout must be positive")

    tasks = load_task_set(Path(args.tasks).resolve())
    if args.agent_command:
        command = shlex.split(args.agent_command)
        if not command:
            raise HarnessError("--agent-command cannot be empty")
    else:
        command = [sys.executable, str(ROOT / "sample_agent.py")]

    results: list[dict[str, Any]] = []
    for task in tasks:
        for trial in range(1, args.runs + 1):
            results.append(run_trial(task, trial, command, args.timeout))

    summary = summarize(results, [task["id"] for task in tasks], args.runs)
    report = {
        "schema_version": 1,
        "tasks_path": str(Path(args.tasks).resolve()),
        "agent_command": command,
        "summary": summary,
        "trials": results,
    }
    report_path = Path(args.report).resolve()
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(json.dumps(report, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print_results(results, summary)
    print("report: " + str(report_path))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except HarnessError as error:
        print("harness error: " + str(error), file=sys.stderr)
        raise SystemExit(2)
