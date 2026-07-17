#!/usr/bin/env python3
"""Crash-safe state, scope, and outcome guards for the automated Terra loop."""
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import time
from pathlib import Path

STAGES = {"build", "critique", "resolve"}
LEASE_STATES = {"running", "awaiting-output"}
PROTECTED_BRANCHES = {"main", "master"}


class GuardError(RuntimeError):
    pass


def git(repo: Path, *args: str, text: bool = True) -> subprocess.CompletedProcess:
    """Run Git through the pinned parent helper from a neutral readable cwd."""
    helper = Path(os.environ.get("PIPELINE_GIT_HELPER", Path(__file__).with_name("pipeline-git.sh")))
    neutral_cwd = Path(os.environ.get("HOME", "/"))
    if not neutral_cwd.is_dir():
        neutral_cwd = Path("/")
    try:
        proc = subprocess.run(
            [str(helper), "--repo", str(repo), *args],
            cwd=neutral_cwd,
            text=text,
            capture_output=True,
            check=False,
            timeout=float(os.environ.get("PIPELINE_LOCAL_GIT_TIMEOUT_SECONDS", "60")),
        )
    except subprocess.TimeoutExpired as error:
        raise GuardError(f"git {' '.join(args)} exceeded its local deadline") from error
    if proc.returncode != 0:
        stderr = proc.stderr.strip() if text else proc.stderr.decode("utf-8", "replace").strip()
        raise GuardError(f"git {' '.join(args)} failed: {stderr or f'exit {proc.returncode}'}")
    return proc


def registry(repo: Path) -> dict:
    try:
        return json.loads((repo / "content/registry.json").read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise GuardError(f"cannot read content/registry.json: {exc}") from exc


def chapter(repo: Path, slug: str) -> dict:
    for item in registry(repo).get("chapters", []):
        if item.get("slug") == slug:
            return item
    raise GuardError(f"unknown chapter slug: {slug}")


def normalized_num(value: object) -> str:
    try:
        return f"{int(value):02d}"
    except (TypeError, ValueError) as exc:
        raise GuardError(f"invalid chapter number: {value!r}") from exc


def validate_target(repo: Path, stage: str, slug: str, num: str | None = None) -> tuple[dict, str]:
    if stage not in STAGES:
        raise GuardError(f"invalid stage {stage!r}; expected build, critique, or resolve")
    item = chapter(repo, slug)
    expected_num = normalized_num(item.get("num"))
    if num is not None and normalized_num(num) != expected_num:
        raise GuardError(f"chapter number mismatch for {slug}: expected {expected_num}, got {num}")
    return item, expected_num


def current_head(repo: Path) -> str:
    return git(repo, "rev-parse", "HEAD").stdout.strip()


def current_branch(repo: Path) -> str:
    proc = git(repo, "symbolic-ref", "--quiet", "--short", "HEAD")
    branch = proc.stdout.strip()
    if not branch:
        raise GuardError("detached HEAD is not safe for automated commits")
    return branch


def require_safe_branch(repo: Path) -> str:
    branch = current_branch(repo)
    if branch in PROTECTED_BRANCHES:
        raise GuardError(f"protected branch {branch!r}; automated commits require a topic branch")
    return branch


def changed_paths(repo: Path) -> list[str]:
    proc = git(repo, "status", "--porcelain=v1", "-z", "--untracked-files=all", text=False)
    fields = proc.stdout.split(b"\0")
    paths: list[str] = []
    index = 0
    while index < len(fields):
        field = fields[index]
        if not field:
            index += 1
            continue
        if len(field) < 4 or field[2:3] != b" ":
            raise GuardError("could not parse git status --porcelain output")
        status = field[:2]
        paths.append(field[3:].decode("utf-8", "surrogateescape"))
        index += 1
        if b"R" in status or b"C" in status:
            if index >= len(fields) or not fields[index]:
                raise GuardError("could not parse renamed path from git status")
            paths.append(fields[index].decode("utf-8", "surrogateescape"))
            index += 1
    return sorted(set(paths))


def component_name(slug: str) -> str:
    return "".join(part[:1].upper() + part[1:] for part in slug.split("-") if part)


def allowed_paths(stage: str, slug: str, num: str) -> tuple[set[str], tuple[str, ...]]:
    component = component_name(slug)
    critique = f"content/critiques/{slug}.md"
    chapter_file = f"src/chapters/{slug}.mdx"
    figure = f"src/chapters/_figures/{component}Figure.tsx"
    widget = f"src/chapters/_widgets/{component}Widget.tsx"
    artifact_prefix = f"artifacts/ch{num}-{slug}/"
    if stage == "build":
        exact = {
            "content/registry.json",
            "prompts/queue.md",
            chapter_file,
            figure,
            widget,
        }
        prefixes = (artifact_prefix,)
    elif stage == "critique":
        exact = {critique, "content/registry.json", "prompts/queue.md"}
        prefixes = ()
    else:
        exact = {
            critique,
            chapter_file,
            figure,
            widget,
            f"docs/research/ch{num}-{slug}.md",
        }
        prefixes = (artifact_prefix,)
    return exact, prefixes


def require_scope(repo: Path, stage: str, slug: str, num: str) -> list[str]:
    _, num = validate_target(repo, stage, slug, num)
    paths = changed_paths(repo)
    if not paths:
        raise GuardError(f"{stage} stage for {slug} produced no changes")
    exact, prefixes = allowed_paths(stage, slug, num)
    escaped = [path for path in paths if path not in exact and not any(path.startswith(prefix) for prefix in prefixes)]
    if escaped:
        raise GuardError(
            f"{stage} stage for {slug} changed out-of-scope path(s): {', '.join(escaped)}"
        )
    return paths


def queue_status(repo: Path, slug: str) -> str | None:
    try:
        lines = (repo / "prompts/queue.md").read_text(encoding="utf-8").splitlines()
    except OSError as exc:
        raise GuardError(f"cannot read prompts/queue.md: {exc}") from exc
    header: list[str] | None = None
    slug_index = status_index = -1
    for line in lines:
        if not line.lstrip().startswith("|"):
            continue
        cells = [cell.strip() for cell in line.strip().strip("|").split("|")]
        if header is None:
            header = [cell.lower() for cell in cells]
            try:
                slug_index = header.index("slug")
                status_index = header.index("status")
            except ValueError as exc:
                raise GuardError("queue table must contain slug and status columns") from exc
            continue
        if all(cell and set(cell) <= {"-", ":"} for cell in cells):
            continue
        if len(cells) > max(slug_index, status_index) and cells[slug_index] == slug:
            return cells[status_index]
    return None


def verdict(repo: Path, slug: str) -> str | None:
    path = repo / f"content/critiques/{slug}.md"
    if not path.exists():
        return None
    try:
        first = path.read_text(encoding="utf-8").splitlines()[0].strip()
    except (OSError, IndexError) as exc:
        raise GuardError(f"cannot read critique for {slug}: {exc}") from exc
    return first.removeprefix("verdict:").strip() if first.startswith("verdict:") else None


def require_outcome(repo: Path, stage: str, slug: str) -> None:
    item, _ = validate_target(repo, stage, slug)
    state = item.get("status")
    queued = queue_status(repo, slug)
    current_verdict = verdict(repo, slug)
    if stage == "build":
        valid = state == "draft" and queued == "PENDING"
        expected = "registry=draft and queue=PENDING"
    elif stage == "resolve":
        valid = state == "draft" and queued == "PENDING" and current_verdict == "resolved"
        expected = "registry=draft, queue=PENDING, and verdict=resolved"
    else:
        valid = (
            (state == "done" and queued == "DONE" and current_verdict == "approve")
            or (state == "draft" and queued == "PENDING" and current_verdict == "revise")
        )
        expected = "done/DONE/approve or draft/PENDING/revise"
    if not valid:
        raise GuardError(
            f"{stage} stage for {slug} did not reach {expected}; "
            f"got registry={state}, queue={queued}, verdict={current_verdict}"
        )


def lease_path(repo: Path) -> Path:
    return repo / ".pipeline/active-stage.json"


def read_lease(repo: Path) -> dict:
    path = lease_path(repo)
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError as exc:
        raise GuardError("no active stage lease") from exc
    except (OSError, json.JSONDecodeError) as exc:
        raise GuardError(f"invalid active stage lease: {exc}") from exc
    stage = data.get("stage")
    slug = data.get("slug")
    num = data.get("num")
    state = data.get("state")
    validate_target(repo, stage, slug, num)
    if state not in LEASE_STATES:
        raise GuardError(f"invalid lease state: {state!r}")
    for field in ("started_at", "updated_at", "base_head"):
        if field not in data:
            raise GuardError(f"active stage lease is missing {field}")
    return data


def atomic_write_json(path: Path, data: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_name(f".{path.name}.{os.getpid()}.tmp")
    try:
        with temp.open("x", encoding="utf-8") as handle:
            json.dump(data, handle, sort_keys=True)
            handle.write("\n")
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temp, path)
    finally:
        try:
            temp.unlink()
        except FileNotFoundError:
            pass


def create_lease(repo: Path, stage: str, slug: str, num: str) -> None:
    _, num = validate_target(repo, stage, slug, num)
    require_safe_branch(repo)
    path = lease_path(repo)
    if path.exists():
        raise GuardError("active stage lease already exists")
    if changed_paths(repo):
        raise GuardError("working tree must be clean before creating a stage lease")
    now = int(time.time())
    data = {
        "version": 1,
        "stage": stage,
        "slug": slug,
        "num": num,
        "state": "running",
        "started_at": now,
        "updated_at": now,
        "base_head": current_head(repo),
    }
    path.parent.mkdir(parents=True, exist_ok=True)
    try:
        descriptor = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    except FileExistsError as exc:
        raise GuardError("active stage lease already exists") from exc
    with os.fdopen(descriptor, "w", encoding="utf-8") as handle:
        json.dump(data, handle, sort_keys=True)
        handle.write("\n")
        handle.flush()
        os.fsync(handle.fileno())


def update_lease(repo: Path, state: str) -> None:
    if state not in LEASE_STATES:
        raise GuardError(f"invalid lease state {state!r}")
    data = read_lease(repo)
    data["state"] = state
    data["updated_at"] = int(time.time())
    atomic_write_json(lease_path(repo), data)


def verify_lease(repo: Path) -> dict:
    data = read_lease(repo)
    head = current_head(repo)
    if data["base_head"] != head:
        raise GuardError(
            "repository HEAD changed during the Terra stage; refusing automatic recovery"
        )
    require_safe_branch(repo)
    return data


def clear_lease(repo: Path) -> None:
    path = lease_path(repo)
    try:
        path.unlink()
    except FileNotFoundError:
        return


def parser() -> argparse.ArgumentParser:
    result = argparse.ArgumentParser(description=__doc__)
    result.add_argument("--repo", type=Path, default=Path(__file__).resolve().parents[1])
    sub = result.add_subparsers(dest="command", required=True)
    sub.add_parser("branch")
    sub.add_parser("has-changes")
    changed = sub.add_parser("changed-paths")
    changed.add_argument("--null", action="store_true")
    for name in ("scope",):
        command = sub.add_parser(name)
        command.add_argument("stage")
        command.add_argument("slug")
        command.add_argument("num")
    outcome = sub.add_parser("outcome")
    outcome.add_argument("stage")
    outcome.add_argument("slug")
    create = sub.add_parser("lease-create")
    create.add_argument("stage")
    create.add_argument("slug")
    create.add_argument("num")
    sub.add_parser("lease-show")
    update = sub.add_parser("lease-update")
    update.add_argument("state")
    sub.add_parser("lease-verify")
    sub.add_parser("lease-clear")
    return result


def main(argv: list[str]) -> int:
    args = parser().parse_args(argv)
    repo = args.repo.expanduser().resolve()
    try:
        if args.command == "branch":
            print(require_safe_branch(repo))
        elif args.command == "has-changes":
            return 0 if changed_paths(repo) else 1
        elif args.command == "changed-paths":
            paths = changed_paths(repo)
            separator = "\0" if args.null else "\n"
            sys.stdout.write(separator.join(paths) + (separator if paths else ""))
        elif args.command == "scope":
            for path in require_scope(repo, args.stage, args.slug, args.num):
                print(path)
        elif args.command == "outcome":
            require_outcome(repo, args.stage, args.slug)
        elif args.command == "lease-create":
            create_lease(repo, args.stage, args.slug, args.num)
        elif args.command == "lease-show":
            data = read_lease(repo)
            age = max(0, int(time.time()) - int(data["updated_at"]))
            print(f"{data['stage']} {data['slug']} {data['num']} {data['state']} {age}")
        elif args.command == "lease-update":
            update_lease(repo, args.state)
        elif args.command == "lease-verify":
            data = verify_lease(repo)
            print(f"{data['stage']} {data['slug']} {data['num']} {data['state']}")
        elif args.command == "lease-clear":
            clear_lease(repo)
        return 0
    except GuardError as exc:
        print(f"pipeline_guard: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
