#!/usr/bin/env python3
"""Small black-box checks for the state-machine contract."""
from __future__ import annotations

import json
import os
import shutil
import subprocess
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def run(*args: str, cwd: Path) -> subprocess.CompletedProcess[str]:
    return subprocess.run(args, cwd=cwd, text=True, capture_output=True, check=False)


def fixture() -> Path:
    work = Path(tempfile.mkdtemp())
    (work / "content").mkdir(); (work / "prompts").mkdir(); (work / "src/chapters").mkdir(parents=True)
    data = {"title": "T", "subtitle": "S", "chapters": [{"num": 1, "slug": "one", "title": "One", "status": "done"}]}
    (work / "content/registry.json").write_text(json.dumps(data), encoding="utf-8")
    (work / "prompts/queue.md").write_text("| # | Slug | Status |\n|---|---|---|\n| 01 | one | DONE |\n", encoding="utf-8")
    (work / "src/chapters/one.mdx").write_text("# One\n", encoding="utf-8")
    shutil.copy(ROOT / "scripts/validate.py", work / "validate.py")
    shutil.copy(ROOT / "scripts/decide.py", work / "decide.py")
    return work


def main() -> int:
    work = fixture()
    try:
        failed = run("python3", "validate.py", cwd=work)
        assert failed.returncode == 1 and "done requires an approved critique" in failed.stdout
        (work / "content/critiques").mkdir()
        (work / "content/critiques/one.md").write_text("verdict: approve\n", encoding="utf-8")
        passed = run("python3", "validate.py", cwd=work)
        assert passed.returncode == 0, passed.stdout
        data = json.loads((work / "content/registry.json").read_text())
        data["chapters"][0]["status"] = "draft"
        (work / "content/registry.json").write_text(json.dumps(data), encoding="utf-8")
        (work / "prompts/queue.md").write_text("| # | Slug | Status |\n|---|---|---|\n| 01 | one | PENDING |\n", encoding="utf-8")
        decision = run("python3", "decide.py", "next", cwd=work)
        assert "NEXT critique one" in decision.stdout, decision.stdout
        print("pipeline state-machine tests: OK")
        return 0
    finally:
        shutil.rmtree(work)


if __name__ == "__main__":
    raise SystemExit(main())
