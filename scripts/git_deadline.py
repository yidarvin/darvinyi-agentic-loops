#!/usr/bin/env python3
"""Run one Git process group with a hard local-operation deadline."""
from __future__ import annotations

import argparse
import math
import os
import signal
import subprocess
import sys


def positive_seconds(value: str) -> float:
    try:
        seconds = float(value)
    except ValueError as error:
        raise argparse.ArgumentTypeError(f"not a number: {value}") from error
    if not math.isfinite(seconds) or seconds <= 0:
        raise argparse.ArgumentTypeError("must be a finite number greater than zero")
    return seconds


def signal_group(pgid: int, signum: int) -> None:
    try:
        os.killpg(pgid, signum)
    except ProcessLookupError:
        pass


def stop_group(process: subprocess.Popen[bytes], grace: float) -> None:
    signal_group(process.pid, signal.SIGTERM)
    try:
        process.wait(timeout=grace)
    except subprocess.TimeoutExpired:
        signal_group(process.pid, signal.SIGKILL)
        try:
            process.wait(timeout=grace)
        except subprocess.TimeoutExpired:
            pass


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--timeout", required=True, type=positive_seconds)
    parser.add_argument("--term-grace", default=5.0, type=positive_seconds)
    parser.add_argument("command", nargs=argparse.REMAINDER)
    args = parser.parse_args()
    if args.command and args.command[0] == "--":
        args.command = args.command[1:]
    if not args.command:
        parser.error("a Git command is required after --")
    process = subprocess.Popen(args.command, start_new_session=True)
    try:
        return process.wait(timeout=args.timeout)
    except subprocess.TimeoutExpired:
        stop_group(process, args.term_grace)
        print(
            f"pipeline-git: local Git deadline exceeded ({args.timeout:g}s)",
            file=sys.stderr,
        )
        return 124


if __name__ == "__main__":
    raise SystemExit(main())
