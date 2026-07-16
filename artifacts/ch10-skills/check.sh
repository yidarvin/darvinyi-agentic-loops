#!/usr/bin/env bash
set -euo pipefail

HERE="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$HERE"
python3 skills_lab.py --test

# This is the literal Claude Code command from the installed skill, deliberately run
# outside the skill directory. Candidate data crosses stdin, never shell source.
CANDIDATE="$(mktemp)"
trap 'rm -f "$CANDIDATE"' EXIT
printf '%s\n' 'Added: --export flag to the CLI' > "$CANDIDATE"
(
  cd /
  export CLAUDE_SKILL_DIR="$HERE/changelog-entry"
  python3 "$CLAUDE_SKILL_DIR/scripts/validate_entry.py" < "$CANDIDATE"
)
