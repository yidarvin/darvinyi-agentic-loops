#!/usr/bin/env python3
"""Validate that the registry, the queue, and the chapter files all agree.

This is the load-bearing gate. It parses BOTH state files (content/registry.json
and prompts/queue.md), cross-checks them against each other, and scans every file
on disk under src/chapters for unfinished markers. It also doubles as the data
source for "queue status": it prints the counts and the next pending item.

Run from the repo root:

    python3 scripts/validate.py

Exit code is 1 on any error, 0 otherwise (warnings never fail the gate). The other
repo scripts (mark.py, new_chapter.py) import the helpers here, so the queue and
registry are parsed and rewritten in exactly one place.
"""
from __future__ import annotations

import glob
import json
import os
import re
import sys

VALID_REGISTRY_STATUS = {"pending", "draft", "done"}
VALID_QUEUE_STATUS = {"PENDING", "DONE", "SKIPPED"}

# A shared slug pairs a registry status with a queue status. Any pair not in this
# set is a mismatch. This encodes: DONE matches done, PENDING matches pending or
# draft, SKIPPED matches pending.
ALLOWED_STATUS_PAIRS = {
    ("done", "DONE"),
    ("draft", "PENDING"),
    ("pending", "PENDING"),
    ("pending", "SKIPPED"),
}

# Canonical per-chapter key order, so registry diffs stay small and readable. Any
# key not listed here is preserved and written after the known ones.
CHAPTER_KEY_ORDER = ("num", "slug", "title", "subtitle", "part", "routes", "status", "url", "source")

# Template placeholders have the exact shape {{SLUG}}, {{TITLE}}, and so on. A bare
# "{{" check would false-positive on legitimate JSX like style={{...}}.
PLACEHOLDER_RE = re.compile(r"\{\{[A-Z_]+\}\}")
TODO_MARKER = "TODO:"


class QueueError(Exception):
    """Raised when prompts/queue.md cannot be parsed as a table."""


# ---- paths -----------------------------------------------------------------

def registry_path(repo: str) -> str:
    return os.path.join(repo, "content", "registry.json")


def queue_path(repo: str) -> str:
    return os.path.join(repo, "prompts", "queue.md")


def chapters_dir(repo: str) -> str:
    return os.path.join(repo, "src", "chapters")


# ---- registry --------------------------------------------------------------

def load_registry(repo: str) -> dict:
    with open(registry_path(repo), "r", encoding="utf-8") as fh:
        return json.load(fh)


def canonical_chapter(ch: dict) -> dict:
    """Return the chapter with keys in house order; unknown keys kept after."""
    out: dict = {}
    for key in CHAPTER_KEY_ORDER:
        if key in ch:
            out[key] = ch[key]
    for key in ch:
        if key not in out:
            out[key] = ch[key]
    return out


def write_registry(repo: str, data: dict) -> None:
    """Write registry.json with canonical per-chapter key order and a newline.

    Top-level key order is preserved as loaded (title, subtitle, mode, chapters).
    """
    out = dict(data)
    out["chapters"] = [canonical_chapter(c) for c in data.get("chapters", [])]
    with open(registry_path(repo), "w", encoding="utf-8") as fh:
        json.dump(out, fh, indent=2, ensure_ascii=False)
        fh.write("\n")


# ---- queue table -----------------------------------------------------------

def _split_row(line: str) -> list[str]:
    s = line.strip()
    if s.startswith("|"):
        s = s[1:]
    if s.endswith("|"):
        s = s[:-1]
    return [c.strip() for c in s.split("|")]


def _is_separator(line: str) -> bool:
    s = line.strip()
    return bool(s) and "-" in s and re.fullmatch(r"\|?[\s:|-]+\|?", s) is not None


def _col_index(header: list[str], name: str) -> int:
    for i, cell in enumerate(header):
        if cell.strip().lower() == name:
            return i
    return -1


def parse_queue(repo: str) -> dict:
    """Locate the run-list table and return its structure.

    Everything outside the table (the intro prose, the trailing comment) is kept
    in `lines` so a rewrite can splice the table back in place.
    """
    with open(queue_path(repo), "r", encoding="utf-8") as fh:
        content = fh.read()
    lines = content.split("\n")
    header_idx = None
    for i in range(len(lines) - 1):
        if lines[i].strip().startswith("|") and _is_separator(lines[i + 1]):
            header_idx = i
            break
    if header_idx is None:
        raise QueueError("prompts/queue.md has no markdown table")
    sep_idx = header_idx + 1
    header = _split_row(lines[header_idx])
    rows: list[list[str]] = []
    j = sep_idx + 1
    while j < len(lines) and lines[j].strip().startswith("|"):
        rows.append(_split_row(lines[j]))
        j += 1
    return {
        "lines": lines,
        "header_idx": header_idx,
        "sep_idx": sep_idx,
        "end_idx": j,
        "header": header,
        "rows": rows,
    }


def render_queue_table(header: list[str], rows: list[list[str]]) -> list[str]:
    """Render an aligned markdown table. All rows are padded to the column count."""
    ncols = len(header)
    norm = [list(r) + [""] * (ncols - len(r)) for r in rows]
    widths = [len(header[c]) for c in range(ncols)]
    for r in norm:
        for c in range(ncols):
            widths[c] = max(widths[c], len(r[c]))

    def fmt(cells: list[str]) -> str:
        return "| " + " | ".join(cells[c].ljust(widths[c]) for c in range(ncols)) + " |"

    out = [fmt(header)]
    out.append("|" + "|".join("-" * (widths[c] + 2) for c in range(ncols)) + "|")
    for r in norm:
        out.append(fmt(r))
    return out


def write_queue(repo: str, parsed: dict, rows: list[list[str]]) -> None:
    """Rewrite prompts/queue.md with a new set of rows, table region only."""
    lines = list(parsed["lines"])
    table = render_queue_table(parsed["header"], rows)
    new_lines = lines[: parsed["header_idx"]] + table + lines[parsed["end_idx"]:]
    with open(queue_path(repo), "w", encoding="utf-8") as fh:
        fh.write("\n".join(new_lines))


# ---- content scan ----------------------------------------------------------

def _content_files(repo: str) -> list[str]:
    patterns = [
        os.path.join(chapters_dir(repo), "*.mdx"),
        os.path.join(chapters_dir(repo), "_figures", "*.tsx"),
        os.path.join(chapters_dir(repo), "_widgets", "*.tsx"),
    ]
    found: list[str] = []
    for p in patterns:
        found.extend(glob.glob(p))
    return sorted(set(found))


# ---- validation ------------------------------------------------------------

def validate(repo: str) -> tuple[list[str], list[str]]:
    """Return (errors, warnings). Errors fail the gate; warnings are advisory."""
    errors: list[str] = []
    warnings: list[str] = []

    # registry ----------------------------------------------------------------
    if not os.path.exists(registry_path(repo)):
        return (["content/registry.json not found (is this a refsite repo?)"], [])
    try:
        data = load_registry(repo)
    except json.JSONDecodeError as exc:
        return ([f"registry.json is not valid JSON: {exc}"], [])

    for field in ("title", "subtitle", "chapters"):
        if field not in data:
            errors.append(f"registry.json is missing top-level '{field}'")
    mode = data.get("mode")
    if mode is not None and mode not in ("book", "graph"):
        errors.append(f"registry.json has invalid mode '{mode}' (expected book or graph)")

    chapters = data.get("chapters")
    if not isinstance(chapters, list):
        errors.append("registry.json 'chapters' is not an array")
        chapters = []

    reg_status: dict[str, str] = {}
    reg_order: list[str] = []
    seen_slugs: set[str] = set()
    seen_nums: set = set()
    for i, ch in enumerate(chapters):
        label = ch.get("slug", f"index {i}")
        for field in ("num", "slug", "title", "status"):
            if field not in ch:
                errors.append(f"registry chapter '{label}' is missing required field '{field}'")
        status = ch.get("status")
        if status is not None and status not in VALID_REGISTRY_STATUS:
            errors.append(f"registry chapter '{label}' has invalid status '{status}'")
        num = ch.get("num")
        if num is not None:
            if num in seen_nums:
                errors.append(f"registry has a duplicate num {num}")
            seen_nums.add(num)
        slug = ch.get("slug")
        if slug:
            if slug in seen_slugs:
                errors.append(f"registry has a duplicate slug '{slug}'")
            seen_slugs.add(slug)
            reg_status[slug] = status
            reg_order.append(slug)
            mdx = os.path.join(chapters_dir(repo), f"{slug}.mdx")
            exists = os.path.exists(mdx)
            if status in ("draft", "done") and not exists:
                errors.append(f"registry chapter '{slug}' is '{status}' but src/chapters/{slug}.mdx is missing")
            if status == "pending" and exists:
                warnings.append(
                    f"src/chapters/{slug}.mdx exists but '{slug}' is still pending "
                    "(possible interrupted run: finish it or reset the chapter)"
                )
    reg_slugs = set(reg_order)

    # every mdx on disk must have a registry entry (error, was a warning) --------
    cdir = chapters_dir(repo)
    if os.path.isdir(cdir):
        for name in sorted(os.listdir(cdir)):
            if name.endswith(".mdx"):
                slug = name[: -len(".mdx")]
                if slug not in reg_slugs:
                    errors.append(f"src/chapters/{name} has no registry entry")

    # queue -------------------------------------------------------------------
    q = None
    if not os.path.exists(queue_path(repo)):
        errors.append("prompts/queue.md not found (is this a refsite repo?)")
    else:
        try:
            q = parse_queue(repo)
        except QueueError as exc:
            errors.append(str(exc))
            q = None

    q_status: dict[str, str] = {}
    q_order: list[str] = []
    if q is not None:
        header = q["header"]
        ncols = len(header)
        slug_i = _col_index(header, "slug")
        status_i = _col_index(header, "status")
        if slug_i == -1 or status_i == -1:
            errors.append("prompts/queue.md table needs a 'slug' and a 'status' column")
        else:
            q_seen: set[str] = set()
            for r in q["rows"]:
                if len(r) != ncols:
                    errors.append(
                        f"queue row has {len(r)} columns but the header has {ncols}: {' | '.join(r)}"
                    )
                    continue
                slug = r[slug_i]
                st = r[status_i]
                if st not in VALID_QUEUE_STATUS:
                    errors.append(f"queue row '{slug}' has invalid status '{st}'")
                if slug in q_seen:
                    errors.append(f"queue has a duplicate slug '{slug}'")
                q_seen.add(slug)
                q_status[slug] = st
                q_order.append(slug)

    # cross-checks (only when both files parsed) ------------------------------
    if q is not None:
        q_set = set(q_order)
        for slug in reg_order:
            if slug not in q_set:
                errors.append(f"slug '{slug}' is in the registry but not in prompts/queue.md")
        for slug in q_order:
            if slug not in reg_slugs:
                errors.append(f"slug '{slug}' is in prompts/queue.md but not in the registry")
        for slug in reg_order:
            if slug in q_status:
                pair = (reg_status.get(slug), q_status.get(slug))
                if pair not in ALLOWED_STATUS_PAIRS:
                    errors.append(
                        f"status mismatch for '{slug}': registry '{pair[0]}' vs queue '{pair[1]}'"
                    )
        shared_reg = [s for s in reg_order if s in q_set]
        shared_q = [s for s in q_order if s in reg_slugs]
        if shared_reg != shared_q:
            errors.append(
                "queue and registry disagree on order: "
                f"registry {shared_reg} vs queue {shared_q}"
            )

    # content scan (every file on disk, not keyed to status) ------------------
    for path in _content_files(repo):
        rel = os.path.relpath(path, repo)
        try:
            with open(path, "r", encoding="utf-8") as fh:
                for lineno, line in enumerate(fh, 1):
                    if TODO_MARKER in line:
                        errors.append(f"{rel}:{lineno}: unfinished marker '{TODO_MARKER}'")
                    m = PLACEHOLDER_RE.search(line)
                    if m:
                        errors.append(f"{rel}:{lineno}: unfilled template placeholder '{m.group(0)}'")
        except OSError as exc:
            errors.append(f"could not read {rel}: {exc}")

    return (errors, warnings)


# ---- report ----------------------------------------------------------------

def _summary_lines(repo: str) -> list[str]:
    try:
        data = load_registry(repo)
    except (OSError, json.JSONDecodeError):
        return []
    chapters = data.get("chapters", []) if isinstance(data, dict) else []
    done = sum(1 for c in chapters if c.get("status") == "done")
    draft = sum(1 for c in chapters if c.get("status") == "draft")
    pending = sum(1 for c in chapters if c.get("status") == "pending")
    lines = [f"registry: {len(chapters)} chapters ({done} done, {draft} draft, {pending} pending)"]
    nxt = next((c for c in chapters if c.get("status") == "pending"), None)
    if nxt:
        lines.append(f"next pending: {nxt.get('num')} {nxt.get('slug')} ({nxt.get('title')})")
    else:
        lines.append("next pending: none, the queue is drained")
    return lines


def main(argv: list[str]) -> int:
    repo = os.path.abspath(argv[1]) if len(argv) > 1 else os.getcwd()
    errors, warnings = validate(repo)
    for line in _summary_lines(repo):
        print(line)
    for w in warnings:
        print(f"  warn: {w}")
    for e in errors:
        print(f"  error: {e}")
    if errors:
        print(f"\nFAIL: {len(errors)} error(s).")
        return 1
    print("\nOK: queue, registry, and chapter files agree.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
