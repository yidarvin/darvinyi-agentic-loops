#!/usr/bin/env python3
"""A deterministic fixture agent for the chapter's local evaluation harness.

It is intentionally imperfect. The harness should demonstrate a weak pass^k
despite finding a successful trial for every bundled task.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run the bundled fixture agent.")
    parser.add_argument("--task", required=True, help="Path to the agent-facing task JSON.")
    parser.add_argument("--workspace", required=True, help="Writable task workspace.")
    parser.add_argument("--trial", required=True, type=int, help="One-based trial number.")
    return parser.parse_args()


def write_file(workspace: Path, relative_path: str, content: str) -> None:
    target = (workspace / relative_path).resolve()
    try:
        target.relative_to(workspace.resolve())
    except ValueError as error:
        raise RuntimeError("refusing to write outside the workspace") from error
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content, encoding="utf-8")


def main() -> int:
    args = parse_args()
    task = json.loads(Path(args.task).read_text(encoding="utf-8"))
    workspace = Path(args.workspace).resolve()
    task_id = task["id"]
    actions: list[str]
    summary: str

    if task_id == "patch-greeting":
        write_file(workspace, "greeting.txt", "hello, Ada\n")
        actions = ["write:greeting.txt"]
        summary = "applied greeting patch"
    elif task_id == "preserve-boundary":
        write_file(workspace, "status.txt", "safe\n")
        actions = ["write:status.txt"]
        summary = "wrote status and preserved the protected file"
    elif task_id == "verify-change":
        if args.trial == 2:
            write_file(workspace, "report.txt", "status=done\n")
            summary = "stopped after the plausible change"
        else:
            write_file(workspace, "report.txt", "status=done\nverified=true\n")
            summary = "wrote and verified the requested state"
        actions = ["write:report.txt"]
        if args.trial != 2:
            actions.append("verify:report.txt")
    elif task_id == "tool-contract":
        if args.trial == 1:
            write_file(workspace, "result.txt", "mode=unsafe\n")
            summary = "used an unsupported mode"
            actions = ["set_mode:unsafe", "write:result.txt"]
        else:
            write_file(workspace, "result.txt", "mode=safe\n")
            summary = "used the allowed mode"
            actions = ["set_mode:safe", "write:result.txt"]
    else:
        raise RuntimeError("unknown fixture task: " + task_id)

    result = {
        "actions": actions,
        "turns": 3 + (args.trial % 2),
        "cost_usd": round(0.015 + (0.003 * args.trial), 3),
        "summary": summary,
    }
    print(json.dumps(result, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
