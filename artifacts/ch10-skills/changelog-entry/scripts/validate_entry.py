#!/usr/bin/env python3
"""Validate one changelog entry of the form "Type: summary".

The deterministic gate the changelog-entry skill runs before writing an entry.
Because it is a script, the check is identical every time, and a harness can return its
output without first loading this source into the model's context window.

Usage:
    validate_entry.py "Added: --export flag to the CLI"
    echo "Fixed: crash on startup" | validate_entry.py

Exit 0 and print OK when the entry is well formed; exit 1 and print a specific
reason when it is not.
"""
from __future__ import annotations

import sys

TYPES = ["Added", "Changed", "Deprecated", "Removed", "Fixed", "Security"]
MAX_LEN = 120


def validate(entry: str) -> str | None:
    """Return None if the entry is well formed, else a one-line reason."""
    if entry != entry.strip():
        return "entry has leading or trailing whitespace"
    if not entry:
        return "entry is empty"
    if "\n" in entry:
        return "entry must be a single line"
    if ":" not in entry:
        return "entry must begin with a type and a colon, e.g. 'Added: ...'; " \
               f"types are {', '.join(TYPES)}"
    change_type, _, summary = entry.partition(":")
    if change_type not in TYPES:
        return f"unknown type {change_type!r}; use one of {', '.join(TYPES)}"
    summary = summary.strip()
    if not summary:
        return "entry has a type but no summary"
    if len(entry) > MAX_LEN:
        return f"entry is {len(entry)} chars; keep it under {MAX_LEN}"
    if summary.endswith("."):
        return "drop the trailing period from the summary"
    return None


def main(argv: list[str]) -> int:
    entry = " ".join(argv[1:]) if len(argv) > 1 else sys.stdin.read().strip()
    problem = validate(entry)
    if problem:
        print(f"FAIL: {problem}")
        return 1
    print(f"OK: {entry}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
