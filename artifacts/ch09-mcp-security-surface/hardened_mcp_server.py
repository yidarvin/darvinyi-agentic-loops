#!/usr/bin/env python3
"""Run the hardened local MCP server over stdio."""

from __future__ import annotations

import sys

from security_mcp import run_entrypoint


if __name__ == "__main__":
    raise SystemExit(run_entrypoint("hardened", sys.argv[1:]))
