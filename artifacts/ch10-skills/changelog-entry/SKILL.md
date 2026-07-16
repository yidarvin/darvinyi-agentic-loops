---
name: changelog-entry
description: Formats and validates a Keep a Changelog entry. Use when adding a
  changelog entry, recording a change, or editing CHANGELOG.md.
---
# Changelog entry

Add one entry to the Unreleased section of `CHANGELOG.md`, in the Keep a
Changelog format, and verify it before writing.

## Steps

1. Decide the change type. Use exactly one of: Added, Changed, Deprecated,
   Removed, Fixed, Security.
2. Write a single imperative line summarizing the change. Compose it as
   `Type: summary`, for example `Added: --export flag`.
3. In Claude Code, run `python3 "${CLAUDE_SKILL_DIR}/scripts/validate_entry.py" "Type: summary"`
   to check the format. The variable resolves the bundled script from any project
   directory. In another harness, substitute that harness's skill-root variable
   or an absolute skill-root path. It exits 0 when the entry is well formed and
   prints a specific reason when it is not.
4. If it fails, fix the reported problem and run it again. Do not write the entry
   until the validator passes.
5. Place the summary as a `- ` bullet under the matching `### Type` heading in
   the `## [Unreleased]` section, creating the heading if it is not there yet.

## Notes

- One change per entry. Split unrelated changes into separate entries.
- Write for a person reading the release notes, not for the commit log.
- The validator enforces a known type, one nonempty line, and clean outer
  whitespace. Keep a Changelog does not prescribe a length cap or terminal
  punctuation, so this skill does not add either rule.
- The validator does not write files. Step 5 intentionally writes the project's
  `CHANGELOG.md`, so obtain project-write permission before taking that step.
- For the full format, the order of the headings, and how Unreleased becomes a
  released version, see `references/FORMAT.md`.
