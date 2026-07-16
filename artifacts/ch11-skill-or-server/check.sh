#!/usr/bin/env bash
set -euo pipefail

HERE="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$HERE"

python3 hybrid_lab.py --test
python3 ../ch10-skills/skills_lab.py --validate release-notes
