"""Durable storage for tasks: the single source of truth.

Everything that reads or writes tasks goes through here, so serialization lives
in exactly one place. Saves are atomic: the store writes a temporary file in the
same directory and renames it over the target, which is atomic on POSIX, so a
crash mid-write leaves the previous good file intact rather than a half-written
one. Concurrent writers are out of scope; the CLI is the only writer by design.
"""
from __future__ import annotations

import json
import os
import tempfile

from models import Task


class Store:
    """A JSON-file-backed collection of tasks keyed by id."""

    def __init__(self, path: str) -> None:
        self.path = path
        self.tasks: dict[int, Task] = {}

    def load(self) -> "Store":
        if not os.path.exists(self.path):
            self.tasks = {}
            return self
        with open(self.path, "r", encoding="utf-8") as fh:
            raw = json.load(fh)
        self.tasks = {int(r["id"]): Task.from_json(r) for r in raw.get("tasks", [])}
        return self

    def save(self) -> None:
        payload = {"tasks": [t.to_json() for t in self.tasks.values()]}
        directory = os.path.dirname(os.path.abspath(self.path))
        fd, tmp = tempfile.mkstemp(dir=directory, suffix=".tmp")
        try:
            with os.fdopen(fd, "w", encoding="utf-8") as fh:
                json.dump(payload, fh, indent=2)
            os.replace(tmp, self.path)  # atomic rename over the real file
        finally:
            if os.path.exists(tmp):
                os.remove(tmp)

    def add(self, title: str, tags: list[str] | None = None) -> Task:
        next_id = 1 + max(self.tasks, default=0)
        task = Task(id=next_id, title=title, tags=tags or [])
        self.tasks[task.id] = task
        return task

    def get(self, task_id: int) -> Task:
        return self.tasks[task_id]
