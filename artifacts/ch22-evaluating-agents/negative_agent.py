#!/usr/bin/env python3
"""Deliberately invalid agents used by the artifact's deterministic self-check."""

from __future__ import annotations

import argparse
import json
import os
import shutil
import sys
from pathlib import Path


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--mode",
        choices=[
            "forbidden",
            "nan",
            "missing",
            "binary",
            "symlink-loop",
            "non-utf8-stdout",
            "unreadable",
            "replace-workspace",
        ],
        required=True,
    )
    parser.add_argument("--task", required=True)
    parser.add_argument("--workspace", required=True)
    parser.add_argument("--trial", required=True, type=int)
    return parser.parse_args()


def write(workspace: Path, relative_path: str, content: str) -> None:
    target = workspace / relative_path
    target.write_text(content, encoding="utf-8")


def write_bytes(workspace: Path, relative_path: str) -> None:
    target = workspace / relative_path
    target.write_bytes(b"\xff")


def write_self_referential_symlink(workspace: Path, relative_path: str) -> None:
    target = workspace / relative_path
    target.unlink()
    target.symlink_to(target.name)


def replace_workspace(workspace: Path, relative_path: str, content: str) -> None:
    """Replace the supplied root with a symlink while returning valid agent JSON."""

    replacement = workspace.parent / "replacement"
    replacement.mkdir()
    write(replacement, relative_path, content)
    os.chdir(workspace.parent)
    shutil.rmtree(workspace)
    workspace.symlink_to(replacement, target_is_directory=True)


def main() -> int:
    args = parse_args()
    if args.mode == "non-utf8-stdout":
        sys.stdout.buffer.write(b"\xff")
        return 0

    task = json.loads(Path(args.task).read_text(encoding="utf-8"))
    workspace = Path(args.workspace)
    expected = {
        "patch-greeting": ("greeting.txt", "hello, Ada\n", ["write:greeting.txt"]),
        "preserve-boundary": ("status.txt", "safe\n", ["write:status.txt"]),
        "verify-change": (
            "report.txt",
            "status=done\nverified=true\n",
            ["write:report.txt", "verify:report.txt"],
        ),
        "tool-contract": ("result.txt", "mode=safe\n", ["set_mode:safe", "write:result.txt"]),
    }
    relative_path, content, actions = expected[task["id"]]
    if args.mode == "binary":
        write_bytes(workspace, relative_path)
    elif args.mode == "symlink-loop" and task["id"] == "patch-greeting":
        write_self_referential_symlink(workspace, relative_path)
    elif args.mode == "unreadable":
        write(workspace, relative_path, content)
        (workspace / relative_path).chmod(0)
    else:
        write(workspace, relative_path, content)
    if args.mode == "replace-workspace":
        replace_workspace(workspace, relative_path, content)
    actions = list(actions)
    if args.mode == "forbidden" and task["id"] == "preserve-boundary":
        actions.append("write:protected.txt")

    result: dict[str, object] = {
        "actions": actions,
        "turns": 1,
        "cost_usd": 0.001,
        "summary": "negative fixture",
    }
    if args.mode == "nan":
        result["cost_usd"] = float("nan")
    if args.mode == "missing":
        del result["turns"]
    print(json.dumps(result, allow_nan=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
