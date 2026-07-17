#!/usr/bin/env python3
"""Read the watchdog-owned subprocess state without scanning unrelated processes."""
from __future__ import annotations

import argparse
import json
import os
import time
from pathlib import Path


def read_state(path: Path) -> dict[str, object]:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        return {}
    except (OSError, json.JSONDecodeError) as error:
        raise RuntimeError(f"invalid process state: {error}") from error
    if not isinstance(data, dict):
        raise RuntimeError("invalid process state: expected an object")
    return data


def group_exists(pgid: object) -> bool:
    if not isinstance(pgid, int) or pgid <= 0:
        return False
    try:
        os.killpg(pgid, 0)
    except ProcessLookupError:
        return False
    except PermissionError:
        return True
    return True


def is_active(data: dict[str, object]) -> bool:
    return data.get("state") == "running" and group_exists(data.get("pgid"))


def shown(data: dict[str, object]) -> str:
    if not data:
        return "PROCESS none"
    now = time.time()
    started = float(data.get("started_at", now))
    last_output = float(data.get("last_output_at", started))
    max_deadline = float(data.get("max_deadline_at", now))
    recorded_state = str(data.get("state", "unknown"))
    state = "running" if is_active(data) else ("stale" if recorded_state == "running" else recorded_state)
    return (
        f"PROCESS label={data.get('label', 'unknown')} state={state} "
        f"pid={data.get('pid', '-')} age={max(0, int(now - started))} "
        f"idle={max(0, int(now - last_output))} "
        f"deadline={max(0, int(max_deadline - now))} "
        f"log={data.get('log', '-')}"
    )


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=("active", "show"))
    parser.add_argument("--state", required=True, type=Path)
    args = parser.parse_args()
    try:
        data = read_state(args.state)
    except RuntimeError as error:
        print(f"process_state: {error}", file=os.sys.stderr)
        return 2
    if args.command == "active":
        return 0 if is_active(data) else 1
    print(shown(data))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
