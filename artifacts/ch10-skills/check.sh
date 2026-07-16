#!/usr/bin/env bash
set -euo pipefail

HERE="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$HERE"
python3 skills_lab.py --test

# This is the literal Claude Code command from the installed skill, deliberately run
# outside the skill directory. It proves the bundled path does not depend on the CWD.
(
  cd /
  export CLAUDE_SKILL_DIR="$HERE/changelog-entry"
  python3 "$CLAUDE_SKILL_DIR/scripts/validate_entry.py" "Added: --export flag to the CLI"
)
