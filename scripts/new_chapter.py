#!/usr/bin/env python3
"""Stamp a new chapter's files, registry entry, and queue row from templates.

Deterministic scaffolding so every chapter starts with the same correct wiring
(imports, a Figure slot, the signature Widget slot, exercises). The runner then
fills in the real prose, figure, and widget. Existing files are never overwritten.

Naming rule (import mismatches are a known cheap-model failure): a slug like
the-first-chapter becomes the component names TheFirstChapterFigure and
TheFirstChapterWidget, in src/chapters/_figures/ and src/chapters/_widgets/.

Run from the repo root:

    python3 scripts/new_chapter.py \\
        --slug the-settled-body --num 1 --title "The settled body" \\
        --subtitle "posture and breath" --part "Part I --- Foundations"

This writes src/chapters/<slug>.mdx plus the two stubs, and adds a pending entry
to content/registry.json and a PENDING row to prompts/queue.md. It is idempotent:
anything that already exists is left alone, so re-running is a safe no-op. When
only one of the registry entry or the queue row exists, the missing one is
inserted at the matching position so validate.py's order check stays green.
"""
from __future__ import annotations

import argparse
import os
import sys

import validate as V

TEMPLATE_DIR_NAME = "templates"


def pascal_case(slug: str) -> str:
    parts = [p for p in slug.replace("_", "-").split("-") if p]
    return "".join(word[:1].upper() + word[1:] for word in parts)


def snake_case(slug: str) -> str:
    return slug.replace("-", "_")


def render(repo: str, template_name: str, mapping: dict[str, str]) -> str:
    path = os.path.join(repo, TEMPLATE_DIR_NAME, template_name)
    with open(path, "r", encoding="utf-8") as fh:
        text = fh.read()
    for key, value in mapping.items():
        text = text.replace("{{" + key + "}}", value)
    return text


def write_if_absent(path: str, content: str, repo: str) -> bool:
    if os.path.exists(path):
        print(f"  skip (exists): {os.path.relpath(path, repo)}")
        return False
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as fh:
        fh.write(content)
    print(f"  wrote: {os.path.relpath(path, repo)}")
    return True


def build_entry(num: int, slug: str, title: str, subtitle: str, part: str) -> dict:
    entry: dict = {"num": num, "slug": slug, "title": title}
    if subtitle:
        entry["subtitle"] = subtitle
    if part:
        entry["part"] = part
    entry["routes"] = []
    entry["status"] = "pending"
    return entry


def insert_index(target_order: list[str], authority_order, slug: str) -> int:
    """Where to insert slug into target_order so the two lists agree on order.

    authority_order is the list that already contains slug. We drop slug in right
    after the nearest preceding authority slug that also lives in target_order; if
    there is none, at the front. When authority_order is None, we append.
    """
    if not authority_order or slug not in authority_order:
        return len(target_order)
    i = authority_order.index(slug)
    target_set = set(target_order)
    for preceding in reversed(authority_order[:i]):
        if preceding in target_set:
            return target_order.index(preceding) + 1
    return 0


def ensure_entries(repo: str, num: int, slug: str, title: str, subtitle: str, part: str) -> None:
    data = V.load_registry(repo)
    chapters = data.setdefault("chapters", [])
    reg_order = [c.get("slug") for c in chapters]
    in_reg = slug in reg_order

    q = V.parse_queue(repo)
    slug_i = V._col_index(q["header"], "slug")
    status_i = V._col_index(q["header"], "status")
    num_i = V._col_index(q["header"], "#")
    item_i = V._col_index(q["header"], "item")
    q_order = [r[slug_i] for r in q["rows"] if len(r) > slug_i]
    in_queue = slug in q_order

    if in_reg and in_queue:
        print("  registry entry and queue row already present; nothing to add")
        return

    if not in_reg:
        authority = q_order if in_queue else None
        idx = insert_index(reg_order, authority, slug)
        chapters.insert(idx, build_entry(num, slug, title, subtitle, part))
        V.write_registry(repo, data)
        print(f"  registry: inserted pending entry '{slug}'")

    if not in_queue:
        reg_order_now = [c.get("slug") for c in V.load_registry(repo).get("chapters", [])]
        rows = [list(r) for r in q["rows"]]
        new_row = [""] * len(q["header"])
        if num_i != -1:
            new_row[num_i] = f"{num:02d}"
        if slug_i != -1:
            new_row[slug_i] = slug
        if item_i != -1:
            new_row[item_i] = title
        if status_i != -1:
            new_row[status_i] = "PENDING"
        idx = insert_index(q_order, reg_order_now, slug)
        rows.insert(idx, new_row)
        V.write_queue(repo, q, rows)
        print(f"  queue: inserted PENDING row for '{slug}'")


def main(argv: list[str]) -> int:
    ap = argparse.ArgumentParser(description="Stamp a new refsite chapter.")
    ap.add_argument("--slug", required=True, help="url id, e.g. the-settled-body")
    ap.add_argument("--num", required=True, type=int, help="display number")
    ap.add_argument("--title", required=True)
    ap.add_argument("--subtitle", default="")
    ap.add_argument("--part", default="")
    ap.add_argument("--widget-name", default="", help="mono label for the widget (default: snake_case slug)")
    ap.add_argument("--repo", default=os.getcwd(), help="repo root (default: cwd)")
    args = ap.parse_args(argv[1:])

    slug = args.slug.strip()
    repo = os.path.abspath(args.repo)
    if not os.path.isdir(os.path.join(repo, "src", "chapters")):
        print(f"error: {repo} does not look like a refsite repo (no src/chapters).")
        return 1

    figure_component = pascal_case(slug) + "Figure"
    widget_component = pascal_case(slug) + "Widget"
    widget_name = args.widget_name or snake_case(slug)

    mapping = {
        "SLUG": slug,
        "TITLE": args.title,
        "NUM": str(args.num),
        "FIGURE_COMPONENT": figure_component,
        "WIDGET_COMPONENT": widget_component,
        "WIDGET_NAME": widget_name,
    }

    print(f"stamping chapter '{slug}' (#{args.num}):")
    chapters_dir = os.path.join(repo, "src", "chapters")
    write_if_absent(os.path.join(chapters_dir, f"{slug}.mdx"), render(repo, "chapter.mdx.tmpl", mapping), repo)
    write_if_absent(
        os.path.join(chapters_dir, "_figures", f"{figure_component}.tsx"),
        render(repo, "figure.tsx.tmpl", mapping),
        repo,
    )
    write_if_absent(
        os.path.join(chapters_dir, "_widgets", f"{widget_component}.tsx"),
        render(repo, "widget.tsx.tmpl", mapping),
        repo,
    )

    ensure_entries(repo, args.num, slug, args.title, args.subtitle, args.part)

    print("\nnext steps:")
    print("  1. write the prose, the figure, and the widget (see the authoring spec).")
    print("  2. run 'npm run check'.")
    print(f"  3. run 'python3 scripts/mark.py {slug} done' to record it.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
