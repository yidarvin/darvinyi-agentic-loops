---
name: release-notes
description: Formats a version's release notes from a list of commits, grouped by
  change type in Keep a Changelog order. Use when writing release notes, drafting a
  changelog section for a release, or turning merged commits into a CHANGELOG entry.
---
# Release notes

The judgment layer. You are handed a list of commits and you produce a clean,
categorized release-notes section. In this lab, you do not fetch the commits yourself:
the commit server supplies that access so the two layers stay visible. A different
workflow-local Skill can bundle a script that calls an API when its runtime supplies
network access and credentials. Your job here is knowing what to do with the data once
it arrives.

1. Get the commits. In production they come from an MCP tool such as
   `list_commits_since`. Never invent them; if you have none, say so.
2. Run `scripts/format_notes.py` with the commit list on stdin. It groups by
   Conventional Commit type, drops non-user-facing types, orders the sections the
   Keep a Changelog way, and marks breaking changes. Let the script decide; do not
   categorize by hand and do not reword its output.
3. For the category and voice rules the script encodes, see
   `references/CONVENTIONS.md`. Read it only if you need to explain or extend a rule.
4. Place the result under the Unreleased or version heading in `CHANGELOG.md`.

The split this skill exists to teach: the procedure lives here, and this lab places
reusable access in the server. Neither half is a release note on its own.
