#!/usr/bin/env python3
"""commit_server.py --- a tiny stdio server in the shape of MCP.

The connectivity layer. It stands in for the thing a real MCP server does: hold a
connection to an external system and expose it as callable tools. Here the
"external system" is a bundled fixture of commits, so the artifact runs with no
network and no git history, but the boundary is real: this is a separate process
that the driver spawns and talks to over stdin/stdout, one JSON message per line.

This is MCP-shaped, not MCP. It borrows JSON-RPC 2.0 framing (jsonrpc, id, method,
params) and the tools/list + tools/call method names so the shape is familiar from
Chapters 5 and 6, but it skips the initialize handshake, capability negotiation,
and the rest of the real protocol. The point is the process-and-wire boundary that
separates a server from a skill, not a conformant implementation.

Protocol, one JSON object per line:
    <- {"jsonrpc":"2.0","id":1,"method":"tools/list"}
    -> {"jsonrpc":"2.0","id":1,"result":{"tools":[...]}}
    <- {"jsonrpc":"2.0","id":2,"method":"tools/call",
        "params":{"name":"list_commits_since","arguments":{"tag":"v0.3.0"}}}
    -> {"jsonrpc":"2.0","id":2,"result":{"commits":[...],"head":"v0.4.0"}}
"""
from __future__ import annotations

import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
FIXTURE = os.path.join(HERE, "fixtures", "commits.json")

TOOLS = [
    {
        "name": "list_commits_since",
        "description": "List the commits merged since a given tag. The access the "
        "agent cannot get on its own: it reaches a system, holds the connection, "
        "and returns live data.",
        "input_schema": {
            "type": "object",
            "properties": {"tag": {"type": "string"}},
            "required": ["tag"],
        },
    }
]


def load_fixture() -> dict:
    with open(FIXTURE, "r", encoding="utf-8") as fh:
        return json.load(fh)


def handle(req: dict) -> dict:
    """Dispatch one request to a result or an error, JSON-RPC style."""
    rid = req.get("id")
    method = req.get("method")

    if method == "tools/list":
        return {"jsonrpc": "2.0", "id": rid, "result": {"tools": TOOLS}}

    if method == "tools/call":
        params = req.get("params", {})
        name = params.get("name")
        args = params.get("arguments", {})
        if name != "list_commits_since":
            return {"jsonrpc": "2.0", "id": rid,
                    "error": {"code": -32601, "message": f"unknown tool: {name}"}}
        data = load_fixture()
        tag = args.get("tag")
        supported_tag = data.get("since_tag")
        # The fixture holds one truthful range. Reject another tag instead of
        # pretending that its commits came from the range the caller requested.
        if tag != supported_tag:
            return {
                "jsonrpc": "2.0", "id": rid,
                "error": {
                    "code": -32602,
                    "message": (
                        f"unsupported tag: {tag!r}; fixture supports only "
                        f"{supported_tag!r}"
                    ),
                },
            }
        return {
            "jsonrpc": "2.0", "id": rid,
            "result": {
                "since_tag": supported_tag,
                "head": data.get("head"),
                "commits": data.get("commits", []),
            },
        }

    return {"jsonrpc": "2.0", "id": rid,
            "error": {"code": -32601, "message": f"unknown method: {method}"}}


def main() -> int:
    # Read one JSON object per line until stdin closes. Flush every reply so the
    # driver, blocked on readline(), sees it immediately.
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            req = json.loads(line)
        except json.JSONDecodeError as exc:
            sys.stdout.write(json.dumps(
                {"jsonrpc": "2.0", "id": None,
                 "error": {"code": -32700, "message": f"parse error: {exc}"}}) + "\n")
            sys.stdout.flush()
            continue
        resp = handle(req)
        sys.stdout.write(json.dumps(resp) + "\n")
        sys.stdout.flush()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
