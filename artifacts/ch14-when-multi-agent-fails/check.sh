#!/usr/bin/env sh
set -eu

artifact_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
python3 "$artifact_dir/simulate.py" --self-test
