#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"
python3 -m py_compile agent.py
python3 agent.py --self-test
