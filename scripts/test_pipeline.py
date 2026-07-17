#!/usr/bin/env python3
"""Small black-box checks for the state-machine contract."""
from __future__ import annotations

import json
import os
import plistlib
import shutil
import subprocess
import tempfile
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
GUARD = ROOT / "scripts/pipeline_guard.py"
WATCHDOG = ROOT / "scripts/process_watchdog.py"


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


def test_service_git_plan_is_pinned_and_shimmed() -> None:
    with (ROOT / "scripts/com.darvin.agentic-loops-queue.plist").open("rb") as handle:
        plist = plistlib.load(handle)
    assert "WorkingDirectory" not in plist
    args = plist["ProgramArguments"]
    assert args[0] == "/bin/bash"
    assert args[1] == str(ROOT / "scripts/queue-worker.sh")
    environment = plist["EnvironmentVariables"]
    assert environment["PIPELINE_GIT_BIN"] == "/usr/bin/git"
    assert environment["PATH"].split(":")[0] == str(ROOT / "scripts/service-bin")
    assert environment["TERRA_IDLE_TIMEOUT_SECONDS"] == "1800"
    assert environment["TERRA_MAX_RUNTIME_SECONDS"] == "5400"
    worker = (ROOT / "scripts/queue-worker.sh").read_text(encoding="utf-8")
    assert "/usr/bin/shlock" in worker
    assert "PIPELINE_GIT_BIN" in worker


def test_git_shim_and_parent_helper_pin_apple_git() -> None:
    shim = ROOT / "scripts/service-bin/git"
    helper = ROOT / "scripts/pipeline-git.sh"
    assert shim.exists(), "service Git shim must exist"
    assert helper.exists(), "parent Git helper must exist"

    shim_version = run(str(shim), "--version", cwd=ROOT)
    assert shim_version.returncode == 0, shim_version.stderr
    assert "Apple Git" in shim_version.stdout

    resolved = run(
        "/bin/bash",
        "-c",
        "command -v git",
        cwd=ROOT,
        env={**os.environ, "PATH": f"{ROOT / 'scripts/service-bin'}:/opt/homebrew/bin:/usr/bin:/bin"},
    )
    assert resolved.stdout.strip() == str(shim)

    work = Path(tempfile.mkdtemp())
    home = Path(tempfile.mkdtemp())
    try:
        trace = work / "trace.json"
        fake_git = work / "fake-git"
        fake_git.write_text(
            "#!/usr/bin/env python3\n"
            "import json, os, pathlib, sys\n"
            "pathlib.Path(os.environ['GIT_TRACE']).write_text(json.dumps({\n"
            "    'cwd': os.getcwd(), 'args': sys.argv[1:]\n"
            "}), encoding='utf-8')\n",
            encoding="utf-8",
        )
        fake_git.chmod(0o755)
        result = run(
            str(helper), "--repo", str(work), "status", "--short",
            cwd=ROOT,
            env={
                **os.environ,
                "HOME": str(home),
                "PIPELINE_GIT_BIN": str(fake_git),
                "GIT_TRACE": str(trace),
            },
        )
        assert result.returncode == 0, result.stderr
        observed = json.loads(trace.read_text(encoding="utf-8"))
        assert Path(observed["cwd"]).resolve() == home.resolve()
        assert observed["args"][:2] == ["-C", str(work)]
    finally:
        shutil.rmtree(work)
        shutil.rmtree(home)


def test_synchronized_branch_does_not_push() -> None:
    sync = ROOT / "scripts/pipeline-sync.sh"
    assert sync.exists(), "synchronization helper must exist"
    work = Path(tempfile.mkdtemp())
    home = Path(tempfile.mkdtemp())
    try:
        trace = work / "trace.jsonl"
        pushed = work / "push-called"
        fake_git = work / "fake-git"
        fake_git.write_text(
            "#!/usr/bin/env python3\n"
            "import json, os, pathlib, sys\n"
            "args = sys.argv[1:]\n"
            "with pathlib.Path(os.environ['GIT_TRACE']).open('a', encoding='utf-8') as h:\n"
            "    h.write(json.dumps(args) + '\\n')\n"
            "if 'push' in args:\n"
            "    pathlib.Path(os.environ['PUSH_CALLED']).write_text('yes', encoding='utf-8')\n"
            "    raise SystemExit(99)\n"
            "if 'rev-parse' in args and '@{u}' in args:\n"
            "    print('origin/codex/test')\n"
            "elif 'rev-list' in args:\n"
            "    print(os.environ.get('SYNC_COUNTS', '0 0'))\n",
            encoding="utf-8",
        )
        fake_git.chmod(0o755)
        result = run(
            str(sync), "--repo", str(work),
            cwd=ROOT,
            env={
                **os.environ,
                "HOME": str(home),
                "PIPELINE_GIT_BIN": str(fake_git),
                "GIT_TRACE": str(trace),
                "PUSH_CALLED": str(pushed),
                "SYNC_COUNTS": "0 0",
            },
        )
        assert result.returncode == 0, result.stdout + result.stderr
        assert not pushed.exists()
        assert "already synchronized" in result.stdout

        failed_push = run(
            str(sync), "--repo", str(work),
            cwd=ROOT,
            env={
                **os.environ,
                "HOME": str(home),
                "PIPELINE_GIT_BIN": str(fake_git),
                "GIT_TRACE": str(trace),
                "PUSH_CALLED": str(pushed),
                "SYNC_COUNTS": "0 1",
            },
        )
        assert failed_push.returncode == 69, failed_push.stdout + failed_push.stderr
        assert pushed.exists()
    finally:
        shutil.rmtree(work)
        shutil.rmtree(home)


def test_watchdog_terminates_a_silent_process_group() -> None:
    assert WATCHDOG.exists(), "stage process watchdog must exist"
    work = Path(tempfile.mkdtemp())
    try:
        child = work / "silent_tree.py"
        grandchild_marker = work / "grandchild-terminated"
        child.write_text(
            "import pathlib, signal, subprocess, sys, time\n"
            "marker = pathlib.Path(sys.argv[1])\n"
            "code = (\"import pathlib, signal, sys, time\\n\"\n"
            "        \"marker = pathlib.Path(sys.argv[1])\\n\"\n"
            "        \"def stop(*_): marker.write_text('terminated', encoding='utf-8'); raise SystemExit(0)\\n\"\n"
            "        \"signal.signal(signal.SIGTERM, stop)\\n\"\n"
            "        \"while True: time.sleep(1)\\n\")\n"
            "subprocess.Popen([sys.executable, '-c', code, str(marker)])\n"
            "while True: time.sleep(1)\n",
            encoding="utf-8",
        )
        started = time.monotonic()
        result = run(
            str(WATCHDOG),
            "--log", str(work / "stage.log"),
            "--idle-timeout", "0.25",
            "--max-runtime", "5",
            "--term-grace", "0.5",
            "--poll-interval", "0.05",
            "--",
            "python3", str(child), str(grandchild_marker),
            cwd=work,
        )
        elapsed = time.monotonic() - started
        assert result.returncode == 124, result.stdout + result.stderr
        assert elapsed < 3, f"silent process took {elapsed:.2f}s to terminate"
        assert grandchild_marker.read_text(encoding="utf-8") == "terminated"
        assert "idle timeout" in result.stderr
    finally:
        shutil.rmtree(work)


def test_watchdog_allows_a_command_that_keeps_making_progress() -> None:
    assert WATCHDOG.exists(), "stage process watchdog must exist"
    work = Path(tempfile.mkdtemp())
    try:
        command = (
            "import time\n"
            "for index in range(6):\n"
            " print(index, flush=True)\n"
            " time.sleep(0.08)\n"
        )
        result = run(
            str(WATCHDOG),
            "--log", str(work / "stage.log"),
            "--idle-timeout", "0.2",
            "--max-runtime", "3",
            "--term-grace", "0.2",
            "--poll-interval", "0.03",
            "--",
            "python3", "-c", command,
            cwd=work,
        )
        assert result.returncode == 0, result.stdout + result.stderr
        assert (work / "stage.log").read_text(encoding="utf-8").splitlines() == [
            "0", "1", "2", "3", "4", "5"
        ]
    finally:
        shutil.rmtree(work)


def driver_fixture(
    fake_codex: str, *, initial_status: str = "pending", verdict: str | None = None
) -> tuple[Path, dict[str, str]]:
    work = guard_fixture()
    (work / "scripts").mkdir(exist_ok=True)
    for name in ("pipeline_guard.py", "decide.py", "validate.py", "mark.py"):
        shutil.copy2(ROOT / f"scripts/{name}", work / f"scripts/{name}")
    shutil.copy2(ROOT / "scripts/process_watchdog.py", work / "scripts/process_watchdog.py")
    for name in ("pipeline-git.sh", "pipeline-sync.sh"):
        shutil.copy2(ROOT / f"scripts/{name}", work / f"scripts/{name}")
    (work / "scripts/service-bin").mkdir()
    shutil.copy2(ROOT / "scripts/service-bin/git", work / "scripts/service-bin/git")
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
    for path in (
        work / "run.sh",
        work / "scripts/pipeline_guard.py",
        work / "scripts/process_watchdog.py",
        work / "scripts/pipeline-git.sh",
        work / "scripts/pipeline-sync.sh",
        work / "scripts/queue-worker.sh",
        work / "scripts/service-bin/git",
    ):
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
        env["PIPELINE_LOCK_FILE"] = str(home / "test-worker.lock")
        assert guard(work, "lease-create", "build", "one", "01").returncode == 0
        assert guard(work, "lease-update", "awaiting-output").returncode == 0
        waiting = run("./scripts/queue-worker.sh", cwd=work, env=env)
        assert waiting.returncode == 0, (
            waiting.stdout + waiting.stderr +
            (work / ".pipeline/queue-worker.log").read_text(encoding="utf-8")
        )
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
        env["PIPELINE_LOCK_FILE"] = str(home / "test-worker.lock")
        (work / "unleased.txt").write_text("do not commit\n", encoding="utf-8")
        refused = run("./scripts/queue-worker.sh", cwd=work, env=env)
        assert refused.returncode != 0, (
            refused.stdout + refused.stderr +
            (work / ".pipeline/queue-worker.log").read_text(encoding="utf-8")
        )
        status = (work / ".pipeline/queue-worker.status").read_text(encoding="utf-8")
        assert "dirty worktree without a stage lease" in status
        assert run("git", "log", "-1", "--format=%s", cwd=work).stdout.strip() == "driver fixture"
    finally:
        shutil.rmtree(work)
        shutil.rmtree(home)


def test_worker_expires_a_stale_running_lease_without_resetting_its_age() -> None:
    fake_codex = """#!/bin/bash
printf 'model\n' >>"$MODEL_CALLS"
exit 1
"""
    work, env = driver_fixture(fake_codex)
    home = Path(tempfile.mkdtemp())
    try:
        model_calls = home / "model-calls"
        env.update({
            "HOME": str(home),
            "MODEL_CALLS": str(model_calls),
            "PIPELINE_LOCK_FILE": str(home / "stale-lease-worker.lock"),
            "QUEUE_ASYNC_GRACE_SECONDS": "180",
            "QUEUE_STAGES_PER_TICK": "1",
        })
        assert guard(work, "lease-create", "build", "one", "01").returncode == 0
        lease_path = work / ".pipeline/active-stage.json"
        lease = json.loads(lease_path.read_text(encoding="utf-8"))
        lease["updated_at"] = int(time.time()) - 600
        lease_path.write_text(json.dumps(lease), encoding="utf-8")

        result = run("./scripts/queue-worker.sh", cwd=work, env=env)
        assert result.returncode == 0, (
            result.stdout + result.stderr
            + (work / ".pipeline/queue-worker.log").read_text(encoding="utf-8")
        )
        assert model_calls.read_text(encoding="utf-8").splitlines() == ["model"]
        status = (work / ".pipeline/queue-worker.status").read_text(encoding="utf-8")
        assert "stage is still settling; launchd will resume automatically" in status
    finally:
        shutil.rmtree(work)
        shutil.rmtree(home)


def test_worker_defers_intermediate_push_and_publishes_approval() -> None:
    build_codex = """#!/usr/bin/env python3
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
    work, env = driver_fixture(build_codex)
    home = Path(tempfile.mkdtemp())
    try:
        sync_calls = home / "sync-calls"
        fake_sync = home / "fake-sync"
        fake_sync.write_text(
            "#!/bin/bash\n"
            "printf 'sync\\n' >>\"$SYNC_CALLS\"\n",
            encoding="utf-8",
        )
        fake_sync.chmod(0o755)
        fake_tools = home / "bin"
        fake_tools.mkdir()
        npm = fake_tools / "npm"
        npm.write_text("#!/bin/bash\nexit 0\n", encoding="utf-8")
        npm.chmod(0o755)
        env["PATH"] = f"{fake_tools}:{env['PATH']}"
        env.update({
            "HOME": str(home),
            "PIPELINE_LOCK_FILE": str(home / "build-worker.lock"),
            "PIPELINE_SYNC_COMMAND": str(fake_sync),
            "QUEUE_STAGES_PER_TICK": "1",
            "SYNC_CALLS": str(sync_calls),
        })
        result = run("./scripts/queue-worker.sh", cwd=work, env=env)
        assert result.returncode == 0, (
            result.stdout + result.stderr +
            (work / ".pipeline/queue-worker.log").read_text(encoding="utf-8")
        )
        assert not sync_calls.exists(), "a draft chapter must remain committed locally"
        assert run("git", "log", "-1", "--format=%s", cwd=work).stdout.strip() == "build(one): Terra stage"
    finally:
        shutil.rmtree(work)
        shutil.rmtree(home)

    approve_codex = """#!/usr/bin/env python3
import pathlib
import sys

args = sys.argv[1:]
root = pathlib.Path(args[args.index('-C') + 1])
(root / 'content/critiques/one.md').write_text(
    'verdict: approve\\n\\n## Round 2 review\\n\\nNo required findings.\\n',
    encoding='utf-8',
)
"""
    work, env = driver_fixture(approve_codex, initial_status="draft", verdict="resolved")
    home = Path(tempfile.mkdtemp())
    try:
        sync_calls = home / "sync-calls"
        fake_sync = home / "fake-sync"
        fake_sync.write_text(
            "#!/bin/bash\n"
            "printf 'sync\\n' >>\"$SYNC_CALLS\"\n",
            encoding="utf-8",
        )
        fake_sync.chmod(0o755)
        fake_tools = home / "bin"
        fake_tools.mkdir()
        npm = fake_tools / "npm"
        npm.write_text("#!/bin/bash\nexit 0\n", encoding="utf-8")
        npm.chmod(0o755)
        env["PATH"] = f"{fake_tools}:{env['PATH']}"
        env.update({
            "HOME": str(home),
            "PIPELINE_LOCK_FILE": str(home / "approve-worker.lock"),
            "PIPELINE_SYNC_COMMAND": str(fake_sync),
            "QUEUE_STAGES_PER_TICK": "1",
            "SYNC_CALLS": str(sync_calls),
        })
        result = run("./scripts/queue-worker.sh", cwd=work, env=env)
        assert result.returncode == 0, (
            result.stdout + result.stderr +
            (work / ".pipeline/queue-worker.log").read_text(encoding="utf-8")
        )
        assert sync_calls.read_text(encoding="utf-8").splitlines() == ["sync"]
        assert not (work / ".pipeline/publish-ready").exists()
        data = json.loads((work / "content/registry.json").read_text(encoding="utf-8"))
        assert data["chapters"][0]["status"] == "done"
    finally:
        shutil.rmtree(work)
        shutil.rmtree(home)


def test_three_sync_failures_never_invoke_model_recovery() -> None:
    fake_codex = """#!/bin/bash
printf 'model\\n' >>"$MODEL_CALLS"
exit 1
"""
    work, env = driver_fixture(fake_codex)
    home = Path(tempfile.mkdtemp())
    try:
        sync_attempts = home / "sync-attempts"
        model_calls = home / "model-calls"
        fake_sync = home / "fake-sync"
        fake_sync.write_text(
            "#!/bin/bash\n"
            "printf 'sync\\n' >>\"$SYNC_ATTEMPTS\"\n"
            "exit 69\n",
            encoding="utf-8",
        )
        fake_sync.chmod(0o755)
        env.update({
            "HOME": str(home),
            "PIPELINE_LOCK_FILE": str(home / "test-sync.lock"),
            "PIPELINE_SYNC_COMMAND": str(fake_sync),
            "PIPELINE_SYNC_BACKOFF_BASE_SECONDS": "0",
            "SYNC_ATTEMPTS": str(sync_attempts),
            "MODEL_CALLS": str(model_calls),
        })
        (work / ".pipeline").mkdir(exist_ok=True)
        (work / ".pipeline/publish-ready").write_text("one pending\n", encoding="utf-8")
        for _ in range(3):
            result = run("./scripts/queue-worker.sh", cwd=work, env=env)
            assert result.returncode == 69, (
                result.stdout + result.stderr +
                (work / ".pipeline/queue-worker.log").read_text(encoding="utf-8")
            )
        assert sync_attempts.read_text(encoding="utf-8").splitlines() == ["sync"] * 3
        assert not model_calls.exists()
        assert (work / ".pipeline/publish-ready").exists()
        assert run("git", "log", "-1", "--format=%s", cwd=work).stdout.strip() == "driver fixture"
    finally:
        shutil.rmtree(work)
        shutil.rmtree(home)


def test_normal_model_failure_keeps_existing_delayed_recovery_path() -> None:
    work, env = driver_fixture("#!/bin/bash\nexit 1\n")
    try:
        result = run("./run.sh", "next", "--no-check", cwd=work, env=env)
        assert result.returncode == 75, result.stdout + result.stderr
        lease = guard(work, "lease-show")
        assert lease.returncode == 0
        assert "build one 01 awaiting-output" in lease.stdout
        assert run("git", "log", "-1", "--format=%s", cwd=work).stdout.strip() == "driver fixture"
    finally:
        shutil.rmtree(work)


def test_watchdog_timeout_clears_lease_and_worker_yields_for_retry() -> None:
    work, env = driver_fixture("#!/bin/bash\nsleep 30\n")
    home = Path(tempfile.mkdtemp())
    try:
        env.update({
            "HOME": str(home),
            "PIPELINE_LOCK_FILE": str(home / "watchdog-worker.lock"),
            "QUEUE_STAGES_PER_TICK": "1",
            "TERRA_IDLE_TIMEOUT_SECONDS": "0.25",
            "TERRA_MAX_RUNTIME_SECONDS": "5",
            "TERRA_WATCHDOG_TERM_GRACE_SECONDS": "0.1",
            "TERRA_WATCHDOG_POLL_SECONDS": "0.03",
        })
        direct = run("./run.sh", "next", "--no-check", cwd=work, env=env)
        assert direct.returncode == 76, direct.stdout + direct.stderr
        assert not (work / ".pipeline/active-stage.json").exists()
        assert "watchdog timed out" in direct.stderr

        worker = run("./scripts/queue-worker.sh", cwd=work, env=env)
        assert worker.returncode == 0, (
            worker.stdout + worker.stderr
            + (work / ".pipeline/queue-worker.log").read_text(encoding="utf-8")
        )
        assert not (work / ".pipeline/active-stage.json").exists()
        status = (work / ".pipeline/queue-worker.status").read_text(encoding="utf-8")
        assert "watchdog timed out; launchd will retry automatically" in status
        assert run("git", "log", "-1", "--format=%s", cwd=work).stdout.strip() == "driver fixture"
    finally:
        shutil.rmtree(work)
        shutil.rmtree(home)


def test_status_and_doctor_are_non_mutating() -> None:
    work, env = driver_fixture("#!/bin/bash\nexit 1\n")
    try:
        before = run("git", "status", "--porcelain=v1", cwd=work).stdout
        head = run("git", "rev-parse", "HEAD", cwd=work).stdout
        status = run("./run.sh", "status", cwd=work, env=env)
        doctor = run("./run.sh", "doctor", cwd=work, env=env)
        assert status.returncode == 0, status.stdout + status.stderr
        assert doctor.returncode == 0, doctor.stdout + doctor.stderr
        assert "PIPELINE_GIT_BIN=/usr/bin/git" in doctor.stdout
        assert run("git", "status", "--porcelain=v1", cwd=work).stdout == before
        assert run("git", "rev-parse", "HEAD", cwd=work).stdout == head
    finally:
        shutil.rmtree(work)


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
        test_service_git_plan_is_pinned_and_shimmed()
        test_git_shim_and_parent_helper_pin_apple_git()
        test_synchronized_branch_does_not_push()
        test_watchdog_terminates_a_silent_process_group()
        test_watchdog_allows_a_command_that_keeps_making_progress()
        test_driver_retains_lease_for_delayed_output()
        test_driver_commits_valid_stage_once()
        test_driver_records_critic_approval_if_model_omits_mark_step()
        test_worker_waits_on_existing_lease_and_refuses_unleased_changes()
        test_worker_expires_a_stale_running_lease_without_resetting_its_age()
        test_worker_defers_intermediate_push_and_publishes_approval()
        test_three_sync_failures_never_invoke_model_recovery()
        test_normal_model_failure_keeps_existing_delayed_recovery_path()
        test_watchdog_timeout_clears_lease_and_worker_yields_for_retry()
        test_status_and_doctor_are_non_mutating()
        print("pipeline state-machine tests: OK")
        return 0
    finally:
        shutil.rmtree(work)


if __name__ == "__main__":
    raise SystemExit(main())
