#!/usr/bin/env python3
"""Validate one changelog entry of the form "Type: summary".

The deterministic gate the changelog-entry skill runs before writing an entry.
Because it is a script, the check is identical every time, and a harness can return its
output without first loading this source into the model's context window.

Usage:
    python3 validate_entry.py < /absolute/path/to/candidate-entry.txt

Exit 0 and print OK when the entry is well formed; exit 1 and print a specific
reason when it is not.
"""
from __future__ import annotations

import sys
from typing import Optional

TYPES = ["Added", "Changed", "Deprecated", "Removed", "Fixed", "Security"]


def has_terminal_control(text: str) -> bool:
    """Return whether text contains C0 or C1 control characters."""
    return any(
        ord(char) <= 0x1F or 0x7F <= ord(char) <= 0x9F
        for char in text
    )


def validate(entry: str) -> Optional[str]:
    """Return None if the entry is well formed, else a one-line reason."""
    if has_terminal_control(entry):
        return "entry contains a terminal control character"
    if entry != entry.strip():
        return "entry has leading or trailing whitespace"
    if not entry:
        return "entry is empty"
    if len(entry.splitlines()) != 1:
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
    return None


def read_stdin_entry() -> str:
    """Preserve whitespace while accepting the shell's one terminal newline."""
    raw = sys.stdin.read()
    if raw.endswith("\r\n"):
        return raw[:-2]
    if raw.endswith("\n"):
        return raw[:-1]
    return raw


def main(argv: list[str]) -> int:
    if len(argv) > 1:
        print("FAIL: this validator reads one literal candidate from standard input; write it to a file and redirect that file into this command")
        return 2
    entry = read_stdin_entry()
    problem = validate(entry)
    if problem:
        print(f"FAIL: {problem}")
        return 1
    print(f"OK: {entry}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
