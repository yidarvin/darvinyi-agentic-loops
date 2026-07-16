#!/usr/bin/env python3
"""Small black-box checks for the state-machine contract."""
from __future__ import annotations

import json
import os
import plistlib
import shutil
import subprocess
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
GUARD = ROOT / "scripts/pipeline_guard.py"


def run(*args: str, cwd: Path, env: dict[str, str] | None = None) -> subprocess.CompletedProcess[str]:
    return subprocess.run(args, cwd=cwd, env=env, text=True, capture_output=True, check=False)


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


def guard_fixture() -> Path:
    work = Path(tempfile.mkdtemp())
    for directory in (
        "content/critiques",
        "prompts",
        "src/chapters/_figures",
        "src/chapters/_widgets",
        "artifacts/ch01-one",
        "docs/research",
    ):
        (work / directory).mkdir(parents=True, exist_ok=True)
    data = {
        "title": "T",
        "subtitle": "S",
        "chapters": [
            {"num": 1, "slug": "one", "title": "One", "status": "pending"},
            {"num": 2, "slug": "two", "title": "Two", "status": "pending"},
        ],
    }
    (work / "content/registry.json").write_text(json.dumps(data), encoding="utf-8")
    (work / "prompts/queue.md").write_text(
        "| # | Slug | Status |\n|---|---|---|\n| 01 | one | PENDING |\n| 02 | two | PENDING |\n",
        encoding="utf-8",
    )
    for slug, component in (("one", "One"), ("two", "Two")):
        (work / f"src/chapters/{slug}.mdx").write_text(f"# {component}\n", encoding="utf-8")
        (work / f"src/chapters/_figures/{component}Figure.tsx").write_text("export {}\n", encoding="utf-8")
        (work / f"src/chapters/_widgets/{component}Widget.tsx").write_text("export {}\n", encoding="utf-8")
        (work / f"docs/research/ch0{1 if slug == 'one' else 2}-{slug}.md").write_text("research\n", encoding="utf-8")
    (work / "artifacts/ch01-one/README.md").write_text("artifact\n", encoding="utf-8")
    (work / ".gitignore").write_text(".pipeline\n", encoding="utf-8")
    assert run("git", "init", "-b", "codex/test", cwd=work).returncode == 0
    assert run("git", "config", "user.name", "Pipeline Test", cwd=work).returncode == 0
    assert run("git", "config", "user.email", "pipeline@example.test", cwd=work).returncode == 0
    assert run("git", "add", "-A", cwd=work).returncode == 0
    assert run("git", "commit", "-m", "fixture", cwd=work).returncode == 0
    return work


def guard(work: Path, *args: str) -> subprocess.CompletedProcess[str]:
    return run("python3", str(GUARD), "--repo", str(work), *args, cwd=work)


def set_state(work: Path, *, status: str, verdict: str | None = None) -> None:
    data = json.loads((work / "content/registry.json").read_text(encoding="utf-8"))
    data["chapters"][0]["status"] = status
    (work / "content/registry.json").write_text(json.dumps(data), encoding="utf-8")
    queue_status = "DONE" if status == "done" else "PENDING"
    (work / "prompts/queue.md").write_text(
        f"| # | Slug | Status |\n|---|---|---|\n| 01 | one | {queue_status} |\n| 02 | two | PENDING |\n",
        encoding="utf-8",
    )
    critique = work / "content/critiques/one.md"
    if verdict is None:
        if critique.exists():
            critique.unlink()
    else:
        critique.write_text(f"verdict: {verdict}\n", encoding="utf-8")


def test_guard_branch_and_lease() -> None:
    work = guard_fixture()
    try:
        assert guard(work, "branch").returncode == 0
        created = guard(work, "lease-create", "build", "one", "01")
        assert created.returncode == 0, created.stderr
        duplicate = guard(work, "lease-create", "build", "one", "01")
        assert duplicate.returncode != 0 and "lease already exists" in duplicate.stderr
        shown = guard(work, "lease-show")
        assert shown.returncode == 0 and "build one 01 running" in shown.stdout
        assert guard(work, "lease-update", "awaiting-output").returncode == 0
        assert "awaiting-output" in guard(work, "lease-show").stdout
        assert guard(work, "lease-clear").returncode == 0
        assert run("git", "branch", "-m", "main", cwd=work).returncode == 0
        protected = guard(work, "branch")
        assert protected.returncode != 0 and "protected branch" in protected.stderr
    finally:
        shutil.rmtree(work)


def test_guard_scope_includes_every_git_state_and_enforces_roles() -> None:
    work = guard_fixture()
    try:
        (work / "src/chapters/one.mdx").write_text("# built\n", encoding="utf-8")
        (work / "artifacts/ch01-one/new.py").write_text("print('ok')\n", encoding="utf-8")
        assert guard(work, "scope", "build", "one", "01").returncode == 0
    finally:
        shutil.rmtree(work)

    work = guard_fixture()
    try:
        (work / "untracked-secret.txt").write_text("must not commit\n", encoding="utf-8")
        escaped = guard(work, "scope", "build", "one", "01")
        assert escaped.returncode != 0 and "untracked-secret.txt" in escaped.stderr
        assert run("git", "add", "untracked-secret.txt", cwd=work).returncode == 0
        staged = guard(work, "scope", "build", "one", "01")
        assert staged.returncode != 0 and "untracked-secret.txt" in staged.stderr
    finally:
        shutil.rmtree(work)

    work = guard_fixture()
    try:
        (work / "src/chapters/one.mdx").write_text("critic edited content\n", encoding="utf-8")
        role_violation = guard(work, "scope", "critique", "one", "01")
        assert role_violation.returncode != 0 and "src/chapters/one.mdx" in role_violation.stderr
        (work / "src/chapters/one.mdx").write_text("# One\n", encoding="utf-8")
        (work / "content/critiques/one.md").write_text("verdict: revise\n", encoding="utf-8")
        assert guard(work, "scope", "critique", "one", "01").returncode == 0
    finally:
        shutil.rmtree(work)

    work = guard_fixture()
    try:
        (work / "src/chapters/_figures/TwoFigure.tsx").write_text("wrong chapter\n", encoding="utf-8")
        wrong_figure = guard(work, "scope", "build", "one", "01")
        assert wrong_figure.returncode != 0 and "TwoFigure.tsx" in wrong_figure.stderr
    finally:
        shutil.rmtree(work)


def test_guard_stage_outcomes() -> None:
    work = guard_fixture()
    try:
        assert guard(work, "outcome", "build", "one").returncode != 0
        set_state(work, status="draft")
        assert guard(work, "outcome", "build", "one").returncode == 0
        set_state(work, status="draft", verdict="resolved")
        assert guard(work, "outcome", "resolve", "one").returncode == 0
        assert guard(work, "outcome", "critique", "one").returncode != 0
        set_state(work, status="draft", verdict="revise")
        assert guard(work, "outcome", "critique", "one").returncode == 0
        set_state(work, status="done", verdict="approve")
        assert guard(work, "outcome", "critique", "one").returncode == 0
    finally:
        shutil.rmtree(work)


def test_launchd_contract_starts_neutral_and_uses_os_lock() -> None:
    with (ROOT / "scripts/com.darvin.agentic-loops-queue.plist").open("rb") as handle:
        plist = plistlib.load(handle)
    assert "WorkingDirectory" not in plist
    args = plist["ProgramArguments"]
    assert args[0] == "/bin/bash"
    assert "/opt/homebrew/bin" in plist["EnvironmentVariables"]["PATH"]
    worker = (ROOT / "scripts/queue-worker.sh").read_text(encoding="utf-8")
    assert "/usr/bin/shlock" in worker


def driver_fixture(
    fake_codex: str, *, initial_status: str = "pending", verdict: str | None = None
) -> tuple[Path, dict[str, str]]:
    work = guard_fixture()
    (work / "scripts").mkdir(exist_ok=True)
    for name in ("pipeline_guard.py", "decide.py", "validate.py", "mark.py"):
        shutil.copy2(ROOT / f"scripts/{name}", work / f"scripts/{name}")
    shutil.copy2(ROOT / "scripts/queue-worker.sh", work / "scripts/queue-worker.sh")
    shutil.copy2(ROOT / "run.sh", work / "run.sh")
    (work / "prompts/notes").mkdir(parents=True, exist_ok=True)
    (work / "prompts/notes/one.md").write_text("Build one.\n", encoding="utf-8")
    if initial_status != "pending" or verdict is not None:
        set_state(work, status=initial_status, verdict=verdict)
    fake_bin = work / "fake-bin"
    fake_bin.mkdir()
    codex = fake_bin / "codex"
    codex.write_text(fake_codex, encoding="utf-8")
    codex.chmod(0o755)
    pgrep = fake_bin / "pgrep"
    pgrep.write_text("#!/bin/bash\nexit 1\n", encoding="utf-8")
    pgrep.chmod(0o755)
    for path in (work / "run.sh", work / "scripts/pipeline_guard.py", work / "scripts/queue-worker.sh"):
        path.chmod(0o755)
    assert run("git", "add", "-A", cwd=work).returncode == 0
    assert run("git", "commit", "-m", "driver fixture", cwd=work).returncode == 0
    env = os.environ.copy()
    env["PATH"] = f"{fake_bin}:{env['PATH']}"
    return work, env


def test_driver_retains_lease_for_delayed_output() -> None:
    work, env = driver_fixture("#!/bin/bash\nexit 0\n")
    try:
        result = run("./run.sh", "next", "--no-check", cwd=work, env=env)
        assert result.returncode == 75, result.stdout + result.stderr
        lease = guard(work, "lease-show")
        assert lease.returncode == 0 and "build one 01 awaiting-output" in lease.stdout
        second = run("./run.sh", "next", "--no-check", cwd=work, env=env)
        assert second.returncode != 0 and "lease already exists" in second.stderr
        assert run("git", "log", "-1", "--format=%s", cwd=work).stdout.strip() == "driver fixture"
    finally:
        shutil.rmtree(work)


def test_driver_commits_valid_stage_once() -> None:
    fake_codex = """#!/usr/bin/env python3
import json
import pathlib
import sys

args = sys.argv[1:]
root = pathlib.Path(args[args.index('-C') + 1])
registry = root / 'content/registry.json'
data = json.loads(registry.read_text(encoding='utf-8'))
data['chapters'][0]['status'] = 'draft'
registry.write_text(json.dumps(data), encoding='utf-8')
(root / 'src/chapters/one.mdx').write_text('# Built one\\n', encoding='utf-8')
"""
    work, env = driver_fixture(fake_codex)
    try:
        result = run("./run.sh", "next", "--no-check", cwd=work, env=env)
        assert result.returncode == 0, result.stdout + result.stderr
        assert not (work / ".pipeline/active-stage.json").exists()
        subject = run("git", "log", "-1", "--format=%s", cwd=work).stdout.strip()
        assert subject == "build(one): Terra stage"
        assert guard(work, "branch").returncode == 0
    finally:
        shutil.rmtree(work)


def test_driver_records_critic_approval_if_model_omits_mark_step() -> None:
    fake_codex = """#!/usr/bin/env python3
import pathlib
import sys

args = sys.argv[1:]
root = pathlib.Path(args[args.index('-C') + 1])
(root / 'content/critiques/one.md').write_text(
    'verdict: approve\\n\\n## Round 2 review\\n\\nNo required findings.\\n',
    encoding='utf-8',
)
"""
    work, env = driver_fixture(fake_codex, initial_status="draft", verdict="resolved")
    try:
        result = run("./run.sh", "next", "--no-check", cwd=work, env=env)
        assert result.returncode == 0, result.stdout + result.stderr
        data = json.loads((work / "content/registry.json").read_text(encoding="utf-8"))
        assert data["chapters"][0]["status"] == "done"
        one_row = next(
            line for line in (work / "prompts/queue.md").read_text(encoding="utf-8").splitlines()
            if "| one " in line
        )
        assert "DONE" in one_row
        assert run("git", "log", "-1", "--format=%s", cwd=work).stdout.strip() == "critique(one): Terra stage"
    finally:
        shutil.rmtree(work)


def test_worker_waits_on_existing_lease_and_refuses_unleased_changes() -> None:
    work, env = driver_fixture("#!/bin/bash\nexit 0\n")
    home = Path(tempfile.mkdtemp())
    try:
        home_bin = home / ".local/bin"
        home_bin.mkdir(parents=True)
        pgrep = home_bin / "pgrep"
        pgrep.write_text("#!/bin/bash\nexit 1\n", encoding="utf-8")
        pgrep.chmod(0o755)
        env["HOME"] = str(home)
        assert guard(work, "lease-create", "build", "one", "01").returncode == 0
        assert guard(work, "lease-update", "awaiting-output").returncode == 0
        waiting = run("./scripts/queue-worker.sh", cwd=work, env=env)
        assert waiting.returncode == 0, waiting.stdout + waiting.stderr
        status = (work / ".pipeline/queue-worker.status").read_text(encoding="utf-8")
        assert "awaiting delayed output for build one" in status
        assert run("git", "log", "-1", "--format=%s", cwd=work).stdout.strip() == "driver fixture"
    finally:
        shutil.rmtree(work)
        shutil.rmtree(home)

    work, env = driver_fixture("#!/bin/bash\nexit 0\n")
    home = Path(tempfile.mkdtemp())
    try:
        home_bin = home / ".local/bin"
        home_bin.mkdir(parents=True)
        pgrep = home_bin / "pgrep"
        pgrep.write_text("#!/bin/bash\nexit 1\n", encoding="utf-8")
        pgrep.chmod(0o755)
        env["HOME"] = str(home)
        (work / "unleased.txt").write_text("do not commit\n", encoding="utf-8")
        refused = run("./scripts/queue-worker.sh", cwd=work, env=env)
        assert refused.returncode != 0
        status = (work / ".pipeline/queue-worker.status").read_text(encoding="utf-8")
        assert "dirty worktree without a stage lease" in status
        assert run("git", "log", "-1", "--format=%s", cwd=work).stdout.strip() == "driver fixture"
    finally:
        shutil.rmtree(work)
        shutil.rmtree(home)


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
        test_guard_branch_and_lease()
        test_guard_scope_includes_every_git_state_and_enforces_roles()
        test_guard_stage_outcomes()
        test_launchd_contract_starts_neutral_and_uses_os_lock()
        test_driver_retains_lease_for_delayed_output()
        test_driver_commits_valid_stage_once()
        test_driver_records_critic_approval_if_model_omits_mark_step()
        test_worker_waits_on_existing_lease_and_refuses_unleased_changes()
        print("pipeline state-machine tests: OK")
        return 0
    finally:
        shutil.rmtree(work)


if __name__ == "__main__":
    raise SystemExit(main())
