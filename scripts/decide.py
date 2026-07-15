#!/usr/bin/env python3
"""Choose the next bounded stage in the build -> critique state machine."""
from __future__ import annotations

import os
import sys

import validate as V


def rows(repo: str) -> list[dict]:
    queue = V.parse_queue(repo)
    slug_i = V._col_index(queue["header"], "slug")
    status_i = V._col_index(queue["header"], "status")
    queue_status = {row[slug_i]: row[status_i] for row in queue["rows"] if len(row) > max(slug_i, status_i)}
    return [
        {"num": chapter.get("num"), "slug": chapter["slug"], "title": chapter.get("title"),
         "registry": chapter.get("status"), "queue": queue_status.get(chapter["slug"]),
         "verdict": V.read_verdict(repo, chapter["slug"])}
        for chapter in V.load_registry(repo).get("chapters", []) if chapter.get("slug")
    ]


def counts(items: list[dict]) -> dict[str, int]:
    return {
        "pending": sum(item["registry"] == "pending" for item in items),
        "draft": sum(item["registry"] == "draft" for item in items),
        "done": sum(item["registry"] == "done" for item in items),
        "revise": sum(item["verdict"] == "revise" for item in items),
        "unreviewed": sum(item["registry"] == "draft" and item["verdict"] in (None, "resolved") for item in items),
        "approved_draft": sum(item["registry"] == "draft" and item["verdict"] == "approve" for item in items),
    }


def decide(repo: str) -> tuple[str, str, str]:
    errors, _warnings = V.validate(repo)
    if errors:
        return "error", "-", "validation failed; run npm run validate"
    items = rows(repo)
    for item in items:
        if item["verdict"] == "revise":
            return "resolve", item["slug"], "open critique requires a revision"
    for item in items:
        if item["registry"] == "draft" and item["verdict"] in (None, "resolved", "approve"):
            return "critique", item["slug"], "draft chapter needs review or final status recording"
    for item in items:
        if item["registry"] == "pending" and item["queue"] == "PENDING":
            return "build", item["slug"], "first pending chapter in queue order"
    return "done", "-", "queue drained and every chapter is approved"


def main(argv: list[str]) -> int:
    if len(argv) != 2 or argv[1] not in {"status", "next", "counts"}:
        print("usage: python3 scripts/decide.py status|next|counts")
        return 2
    repo = os.getcwd()
    items = rows(repo)
    action, slug, reason = decide(repo)
    if argv[1] == "counts":
        data = counts(items)
        print(" ".join(f"{key}={value}" for key, value in data.items()))
    elif argv[1] == "next":
        print(f"NEXT {action} {slug} :: {reason}")
    else:
        for line in V._summary_lines(repo):
            print(line)
        print()
        print(f"{'#':>2}  {'slug':<30} {'state':<8} {'queue':<7} verdict")
        for item in items:
            print(f"{item['num']:>2}  {item['slug']:<30} {item['registry']:<8} {item['queue']:<7} {item['verdict'] or '-'}")
        print(f"\nNEXT {action} {slug} :: {reason}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
