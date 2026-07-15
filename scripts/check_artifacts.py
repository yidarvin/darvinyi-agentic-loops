#!/usr/bin/env python3
"""Run every published chapter artifact's deterministic check command."""
from __future__ import annotations

import json
import os
import subprocess
import sys


def main() -> int:
    root = os.getcwd()
    with open(os.path.join(root, "content", "registry.json"), encoding="utf-8") as handle:
        chapters = json.load(handle)["chapters"]
    selected = [chapter for chapter in chapters if chapter.get("status") in {"draft", "done"}]
    failures = 0
    for chapter in selected:
        artifact = os.path.join(root, "artifacts", f"ch{chapter['num']:02d}-{chapter['slug']}")
        readme = os.path.join(artifact, "README.md")
        check = os.path.join(artifact, "check.sh")
        print(f"-- ch{chapter['num']:02d} {chapter['slug']}")
        if not os.path.isfile(readme) or not os.path.isfile(check):
            print("   missing artifact README.md or check.sh", file=sys.stderr)
            failures += 1
            continue
        result = subprocess.run(["bash", check], cwd=artifact, check=False)
        if result.returncode:
            failures += 1
    if failures:
        print(f"artifact gate failed: {failures} chapter(s)", file=sys.stderr)
        return 1
    print(f"artifact gate: {len(selected)} chapter(s) passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
