#!/usr/bin/env python3
"""The house prose gate. Scans chapter prose and widget/figure labels for em
dashes and the banned AI tells named in the authoring spec.

The patterns live in prose-lint.config.json at the repo root (errors, warnings,
globs), so a site can tune them without editing this script. Every pattern is a
case-insensitive regex. Error-tier hits fail the gate; warning-tier hits are
reported but never block. Each hit prints as file:line: matched-text.

Run from the repo root:

    python3 scripts/prose_lint.py
"""
from __future__ import annotations

import glob
import json
import os
import re
import sys


def load_config(repo: str) -> dict:
    path = os.path.join(repo, "prose-lint.config.json")
    with open(path, "r", encoding="utf-8") as fh:
        return json.load(fh)


def compile_patterns(patterns: list[str]) -> list[re.Pattern]:
    return [re.compile(p, re.IGNORECASE) for p in patterns]


def collect_files(repo: str, globs: list[str]) -> list[str]:
    found: list[str] = []
    for g in globs:
        found.extend(glob.glob(os.path.join(repo, g), recursive=True))
    return sorted(set(found))


def main(argv: list[str]) -> int:
    repo = os.path.abspath(argv[1]) if len(argv) > 1 else os.getcwd()
    cfg = load_config(repo)
    error_pats = compile_patterns(cfg.get("errors", []))
    warn_pats = compile_patterns(cfg.get("warnings", []))
    files = collect_files(repo, cfg.get("globs", []))

    error_hits: list[str] = []
    warn_hits: list[str] = []
    for path in files:
        rel = os.path.relpath(path, repo)
        with open(path, "r", encoding="utf-8") as fh:
            for lineno, line in enumerate(fh, 1):
                text = line.rstrip("\n")
                for rx in error_pats:
                    m = rx.search(text)
                    if m:
                        error_hits.append(f"{rel}:{lineno}: {m.group(0)}")
                for rx in warn_pats:
                    m = rx.search(text)
                    if m:
                        warn_hits.append(f"{rel}:{lineno}: {m.group(0)}")

    print(f"prose lint: scanned {len(files)} file(s)")
    for w in warn_hits:
        print(f"  warn: {w}")
    for e in error_hits:
        print(f"  error: {e}")
    if error_hits:
        print(f"\nFAIL: {len(error_hits)} prose error(s).")
        return 1
    print("\nOK: prose is clean.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
