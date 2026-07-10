#!/usr/bin/env python3
"""format_notes.py --- the skill's deterministic formatter (level-three code).

Reads a commit list as JSON on stdin and prints a categorized release-notes section
to stdout. This is procedure, not access: it never reaches out for the commits, it
only knows what to do with them once they arrive. The commits come from the server.

Accepts either a bare JSON array of commit objects, or an object with a "commits"
key (the shape the commit server returns). Each commit needs a "message" field.

Usage:
    format_notes.py [--version V] < commits.json
    echo '{"commits": [...]}' | format_notes.py --version v0.4.0
"""
from __future__ import annotations

import argparse
import json
import re
import sys

# type(scope)!: subject
CC = re.compile(r"^(?P<type>\w+)(?:\((?P<scope>[^)]*)\))?(?P<bang>!)?:\s*(?P<subject>.+)$")

# Conventional Commit type -> Keep a Changelog category. Types not listed are
# dropped: they do not change what a user sees.
TYPE_TO_CATEGORY = {"feat": "Added", "fix": "Fixed", "perf": "Changed"}

# Keep a Changelog section order; only non-empty sections are emitted.
SECTION_ORDER = ["Added", "Changed", "Deprecated", "Removed", "Fixed", "Security"]


def categorize(message: str):
    """Return (category, line) for a commit message, or (None, None) to drop it."""
    m = CC.match(message.strip())
    if not m:
        return None, None
    ctype = m.group("type").lower()
    scope = (m.group("scope") or "").lower()
    subject = m.group("subject").strip()
    breaking = bool(m.group("bang")) or "BREAKING" in message

    if ctype == "feat" and ("secur" in scope or "secur" in subject.lower()):
        category = "Security"
    elif breaking and ctype in TYPE_TO_CATEGORY:
        category = "Changed"
    else:
        category = TYPE_TO_CATEGORY.get(ctype)

    if category is None:
        return None, None

    line = subject[:1].upper() + subject[1:]
    line = line.rstrip(".")
    if breaking:
        line = f"**Breaking:** {line}"
    return category, line


def format_notes(commits: list, version: str) -> str:
    sections: dict[str, list[str]] = {name: [] for name in SECTION_ORDER}
    for commit in commits:
        message = commit.get("message", "") if isinstance(commit, dict) else str(commit)
        category, line = categorize(message)
        if category is not None:
            sections[category].append(line)

    out = [f"## {version}", ""]
    emitted = False
    for name in SECTION_ORDER:
        lines = sections[name]
        if not lines:
            continue
        emitted = True
        out.append(f"### {name}")
        out.extend(f"- {line}" for line in lines)
        out.append("")
    if not emitted:
        out.append("_No user-facing changes._")
        out.append("")
    return "\n".join(out).rstrip() + "\n"


def load_commits(raw: str) -> tuple[list, str | None]:
    """Parse stdin into (commits, head). Tolerates empty input and both shapes."""
    raw = raw.strip()
    if not raw:
        return [], None
    data = json.loads(raw)
    if isinstance(data, list):
        return data, None
    return data.get("commits", []), data.get("head")


def main(argv: list[str]) -> int:
    ap = argparse.ArgumentParser(description="Format release notes from a commit list.")
    ap.add_argument("--version", default=None, help="version heading; defaults to the head from the input")
    args = ap.parse_args(argv[1:])

    commits, head = load_commits(sys.stdin.read())
    version = args.version or head or "Unreleased"
    sys.stdout.write(format_notes(commits, version))
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
