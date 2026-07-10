"""The user-facing command line: the only path that mutates the store.

Commands: add a task, list tasks (optionally by state), and move a task to a new
state. Parsing is deliberately boring argparse; the interesting rules all live in
models.py and store.py. Keeping mutation in one entry point is what lets the API
stay read-only without racing the CLI for the write.
"""
from __future__ import annotations

import argparse
import sys

from store import Store

DEFAULT_DB = "tasks.json"


def cmd_add(store: Store, args: argparse.Namespace) -> int:
    task = store.add(args.title, tags=args.tag or [])
    store.save()
    print(f"added #{task.id}: {task.title}")
    return 0


def cmd_list(store: Store, args: argparse.Namespace) -> int:
    for task in store.tasks.values():
        if args.state and task.state != args.state:
            continue
        tags = f" [{', '.join(task.tags)}]" if task.tags else ""
        print(f"#{task.id} {task.state:5} {task.title}{tags}")
    return 0


def cmd_move(store: Store, args: argparse.Namespace) -> int:
    task = store.get(args.id)
    task.move(args.state)
    store.save()
    print(f"#{task.id} -> {task.state}")
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="tasktrack")
    parser.add_argument("--db", default=DEFAULT_DB)
    sub = parser.add_subparsers(dest="cmd", required=True)

    p_add = sub.add_parser("add")
    p_add.add_argument("title")
    p_add.add_argument("--tag", action="append")
    p_add.set_defaults(func=cmd_add)

    p_list = sub.add_parser("list")
    p_list.add_argument("--state", choices=["open", "doing", "done"])
    p_list.set_defaults(func=cmd_list)

    p_move = sub.add_parser("move")
    p_move.add_argument("id", type=int)
    p_move.add_argument("state", choices=["open", "doing", "done"])
    p_move.set_defaults(func=cmd_move)
    return parser


def main(argv: list[str]) -> int:
    args = build_parser().parse_args(argv)
    store = Store(args.db).load()
    return args.func(store, args)


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
