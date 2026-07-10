"""The Task record and its small state machine.

A task moves open -> doing -> done, or open -> done directly, and can be
reopened from done. Illegal transitions raise so a corrupt store is loud
rather than silently wrong. Nothing here touches disk or the network; models
stay pure so the store and the API can share them without importing each other.
"""
from __future__ import annotations

from dataclasses import dataclass, field, asdict
from typing import Any

# The allowed transitions. A state not present here is terminal for moves.
TRANSITIONS: dict[str, set[str]] = {
    "open": {"doing", "done"},
    "doing": {"done", "open"},
    "done": {"open"},
}


@dataclass
class Task:
    """One tracked unit of work."""

    id: int
    title: str
    state: str = "open"
    tags: list[str] = field(default_factory=list)

    def move(self, to: str) -> None:
        """Advance the task, refusing any transition not in TRANSITIONS."""
        allowed = TRANSITIONS.get(self.state, set())
        if to not in allowed:
            raise ValueError(f"cannot move task {self.id} from {self.state} to {to}")
        self.state = to

    def to_json(self) -> dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_json(cls, raw: dict[str, Any]) -> "Task":
        return cls(
            id=int(raw["id"]),
            title=str(raw["title"]),
            state=str(raw.get("state", "open")),
            tags=list(raw.get("tags", [])),
        )
