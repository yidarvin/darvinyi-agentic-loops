#!/usr/bin/env python3
"""Run one command with idle and absolute deadlines, killing its process group."""
from __future__ import annotations

import argparse
import json
import math
import os
import signal
import subprocess
import sys
import time
from pathlib import Path

TIMEOUT_EXIT = 124


def positive_seconds(value: str) -> float:
    try:
        seconds = float(value)
    except ValueError as error:
        raise argparse.ArgumentTypeError(f"not a number: {value}") from error
    if not math.isfinite(seconds) or seconds <= 0:
        raise argparse.ArgumentTypeError("must be a finite number greater than zero")
    return seconds


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Bound a command by output inactivity and total runtime."
    )
    parser.add_argument("--log", required=True, type=Path)
    parser.add_argument("--state", type=Path)
    parser.add_argument("--label", default="command")
    parser.add_argument("--idle-timeout", required=True, type=positive_seconds)
    parser.add_argument("--max-runtime", required=True, type=positive_seconds)
    parser.add_argument("--term-grace", default=10.0, type=positive_seconds)
    parser.add_argument("--poll-interval", default=5.0, type=positive_seconds)
    parser.add_argument("command", nargs=argparse.REMAINDER)
    args = parser.parse_args()
    if args.command and args.command[0] == "--":
        args.command = args.command[1:]
    if not args.command:
        parser.error("a command is required after --")
    return args


def process_group_exists(process_group: int) -> bool:
    try:
        os.killpg(process_group, 0)
    except ProcessLookupError:
        return False
    except PermissionError:
        return True
    return True


def signal_process_group(process_group: int, signum: int) -> None:
    try:
        os.killpg(process_group, signum)
    except ProcessLookupError:
        pass
    except PermissionError:
        # A sandbox can deny a redundant signal while a terminated descendant
        # remains briefly visible as a zombie. The direct child is still reaped
        # below, and a live same-user service process accepts the group signal.
        pass


def terminate_process_group(process: subprocess.Popen[bytes], grace: float) -> None:
    signal_process_group(process.pid, signal.SIGTERM)
    deadline = time.monotonic() + grace
    while time.monotonic() < deadline and process_group_exists(process.pid):
        time.sleep(min(0.05, max(0.0, deadline - time.monotonic())))
    if process_group_exists(process.pid):
        signal_process_group(process.pid, signal.SIGKILL)
    try:
        process.wait(timeout=max(1.0, grace))
    except subprocess.TimeoutExpired:
        signal_process_group(process.pid, signal.SIGKILL)
        try:
            process.wait(timeout=max(1.0, grace))
        except subprocess.TimeoutExpired:
            # Never let the watchdog become the new unbounded wait. run.sh will
            # detect any surviving Codex process and retain the stage lease.
            pass


def atomic_write_json(path: Path, payload: dict[str, object]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_name(f".{path.name}.{os.getpid()}.tmp")
    try:
        with temp.open("x", encoding="utf-8") as handle:
            json.dump(payload, handle, sort_keys=True)
            handle.write("\n")
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temp, path)
    finally:
        try:
            temp.unlink()
        except FileNotFoundError:
            pass


def main() -> int:
    args = parse_args()
    args.log.parent.mkdir(parents=True, exist_ok=True)
    started = time.monotonic()
    started_at = time.time()
    last_activity = started
    last_output_at = started_at
    interrupted_by: int | None = None

    def remember_signal(signum: int, _frame: object) -> None:
        nonlocal interrupted_by
        interrupted_by = signum

    for signum in (signal.SIGINT, signal.SIGTERM, signal.SIGHUP):
        signal.signal(signum, remember_signal)

    with args.log.open("wb", buffering=0) as log_handle:
        process = subprocess.Popen(
            args.command,
            stdin=subprocess.DEVNULL,
            stdout=log_handle,
            stderr=subprocess.STDOUT,
            start_new_session=True,
        )
        state: dict[str, object] = {
            "version": 1,
            "label": args.label,
            "state": "running",
            "pid": process.pid,
            "pgid": process.pid,
            "started_at": started_at,
            "updated_at": started_at,
            "last_output_at": started_at,
            "idle_timeout_seconds": args.idle_timeout,
            "max_runtime_seconds": args.max_runtime,
            "max_deadline_at": started_at + args.max_runtime,
            "log": str(args.log.resolve()),
            "command": Path(args.command[0]).name,
        }

        def persist(**updates: object) -> None:
            if args.state is None:
                return
            state.update(updates)
            state["updated_at"] = time.time()
            atomic_write_json(args.state, state)

        persist()
        last_size = 0
        reason: str | None = None
        while True:
            try:
                returncode = process.wait(timeout=args.poll_interval)
            except subprocess.TimeoutExpired:
                returncode = None

            now = time.monotonic()
            try:
                current_size = args.log.stat().st_size
            except FileNotFoundError:
                current_size = last_size
            if current_size != last_size:
                last_size = current_size
                last_activity = now
                last_output_at = time.time()

            if returncode is not None:
                persist(
                    state="succeeded" if returncode == 0 else "failed",
                    exit_code=returncode,
                    last_output_at=last_output_at,
                    finished_at=time.time(),
                )
                return returncode

            persist(last_output_at=last_output_at)

            if interrupted_by is not None:
                reason = f"received signal {interrupted_by}"
                break
            if now - started >= args.max_runtime:
                reason = f"maximum runtime exceeded ({args.max_runtime:g}s)"
                break
            if now - last_activity >= args.idle_timeout:
                reason = f"idle timeout exceeded ({args.idle_timeout:g}s without output)"
                break

        terminate_process_group(process, args.term_grace)
        message = f"process watchdog: {reason}; terminated process group {process.pid}"
        log_handle.write(f"\n[watchdog] {message}\n".encode())
        print(message, file=sys.stderr)
        if interrupted_by is not None:
            exit_code = 128 + interrupted_by
            persist(
                state="interrupted",
                exit_code=exit_code,
                reason=reason or "interrupted",
                last_output_at=last_output_at,
                finished_at=time.time(),
            )
            return exit_code
        persist(
            state="timed-out",
            exit_code=TIMEOUT_EXIT,
            reason=reason or "deadline exceeded",
            last_output_at=last_output_at,
            finished_at=time.time(),
        )
        return TIMEOUT_EXIT


if __name__ == "__main__":
    raise SystemExit(main())
