#!/usr/bin/env python3
"""Run one command with idle and absolute deadlines, killing its process group."""
from __future__ import annotations

import argparse
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


def main() -> int:
    args = parse_args()
    args.log.parent.mkdir(parents=True, exist_ok=True)
    started = time.monotonic()
    last_activity = started
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
        last_size = 0
        reason: str | None = None
        while True:
            try:
                return process.wait(timeout=args.poll_interval)
            except subprocess.TimeoutExpired:
                pass

            now = time.monotonic()
            try:
                current_size = args.log.stat().st_size
            except FileNotFoundError:
                current_size = last_size
            if current_size != last_size:
                last_size = current_size
                last_activity = now

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
            return 128 + interrupted_by
        return TIMEOUT_EXIT


if __name__ == "__main__":
    raise SystemExit(main())
