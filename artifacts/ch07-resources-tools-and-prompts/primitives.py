#!/usr/bin/env python3
"""One MCP server, three primitives. See who controls each.

Companion to chapter 7, "Resources, Tools, and Prompts." An MCP server exposes
exactly three server-side primitives, and the only axis that separates them is who
decides when the primitive fires:

  * tools      model-controlled       the LLM calls them        (~ POST, side effects)
  * resources  application-controlled the host pulls them in    (~ GET, read-only)
  * prompts    user-controlled        the human selects them    (~ stored template)

This script is one real MCP server, `DatabaseServer`, that exposes all three at once
over the canonical composition: a schema resource, query and insert tools, and a
report prompt. `handle()` turns a JSON-RPC message into a JSON-RPC reply and is a
genuine server core: a real client (the MCP Inspector, say) can spawn it with
`--serve-stdio` and speak to it over newline-delimited JSON. By default the driver
walks each primitive in turn and prints the wire request and response, labelling the
controller, so the three shapes sit side by side.

Run it:

    python3 primitives.py             # walk tools, then resources, then prompts
    python3 primitives.py --tools     # just the tools walkthrough
    python3 primitives.py --resources # just the resources walkthrough
    python3 primitives.py --prompts   # just the prompts walkthrough

Internal (a real MCP client would start this for you):

    python3 primitives.py --serve-stdio

No SDK, no API key, no network. Standard library only. Protocol shapes track MCP
revision 2025-11-25.
"""
from __future__ import annotations

import json
import sys

LATEST = "2025-11-25"
SUPPORTED = ["2025-11-25", "2025-06-18", "2025-03-26"]

METHOD_NOT_FOUND = -32601
INVALID_REQUEST = -32600
INVALID_PARAMS = -32602
RESOURCE_NOT_FOUND = -32002  # spec code for resources/read on a URI that has no resource

# A tiny in-memory "database" the primitives read and write. The point is not the
# data; it is that one dataset is reachable three ways, each under a different
# controller. Real precision (the aggregate below) is done here in Python, not by
# the model: that is the hybrid pattern the report prompt hands off.
SCHEMA = {
    "orders": {"id": "integer", "customer": "text", "total_cents": "integer", "status": "text"},
    "customers": {"id": "integer", "name": "text", "region": "text"},
}
ORDERS = [
    {"id": 1, "customer": "acme", "total_cents": 12000, "status": "paid"},
    {"id": 2, "customer": "globex", "total_cents": 4500, "status": "paid"},
    {"id": 3, "customer": "acme", "total_cents": 8000, "status": "refunded"},
]


# ================================================================================
# THE SERVER CORE. handle() maps a JSON-RPC message to a reply (or to None for a
# notification, which is never answered). It is a real MCP server: feed it the wire
# messages a client sends and it returns the wire replies. The three primitives are
# the three families of methods it answers.
# ================================================================================

class DatabaseServer:
    def __init__(self) -> None:
        self.initialized = False

    def handle(self, msg: dict) -> dict | None:
        method = msg.get("method")
        mid = msg.get("id")
        if "id" not in msg:  # a notification: no reply is ever owed
            if method == "notifications/initialized":
                self.initialized = True
            return None

        if method == "initialize":
            requested = msg.get("params", {}).get("protocolVersion")
            return ok(mid, {
                "protocolVersion": requested if requested in SUPPORTED else LATEST,
                # Declaring a capability is the server's promise that the matching
                # methods exist. One server, three primitives, three capabilities.
                "capabilities": {
                    "tools": {"listChanged": True},
                    "resources": {"subscribe": False, "listChanged": True},
                    "prompts": {"listChanged": True},
                },
                "serverInfo": {"name": "database-server", "version": "1.0.0"},
            })

        if not self.initialized:
            return err(mid, INVALID_REQUEST,
                       "Received request before initialization completed")

        # --- tools: model-controlled. Discovery, then invocation. -----------------
        if method == "tools/list":
            return ok(mid, {"tools": self.tools()})
        if method == "tools/call":
            return self.call_tool(mid, msg.get("params", {}))

        # --- resources: application-controlled. List, templates, read. ------------
        if method == "resources/list":
            return ok(mid, {"resources": self.resources()})
        if method == "resources/templates/list":
            return ok(mid, {"resourceTemplates": self.resource_templates()})
        if method == "resources/read":
            return self.read_resource(mid, msg.get("params", {}))

        # --- prompts: user-controlled. List, then get the filled messages. --------
        if method == "prompts/list":
            return ok(mid, {"prompts": self.prompts()})
        if method == "prompts/get":
            return self.get_prompt(mid, msg.get("params", {}))

        return err(mid, METHOD_NOT_FOUND, f"Method not found: {method}")

    # -- tools -------------------------------------------------------------------
    # A tool is chosen by the model from its name and description alone, so both do
    # real work. Annotations are hints the client uses to graduate confirmation:
    # a read-only tool can auto-run; a destructive one should ask first.
    def tools(self) -> list[dict]:
        return [
            {
                # Same bytes as the db://schema resource below, exposed as a tool. The
                # only difference is the controller: this the model can call itself.
                "name": "get_schema",
                "title": "Get the database schema",
                "description": "Return the full schema: tables, columns, and types. Read-only.",
                "inputSchema": {"type": "object", "properties": {}},
                "annotations": {"readOnlyHint": True, "openWorldHint": False},
            },
            {
                "name": "run_query",
                "title": "Run a read-only query",
                "description": "Return rows from the orders table, optionally filtered by status.",
                "inputSchema": {
                    "type": "object",
                    "properties": {"status": {"type": "string", "description": "e.g. paid, refunded"}},
                },
                "annotations": {"readOnlyHint": True, "openWorldHint": False},
            },
            {
                "name": "insert_order",
                "title": "Insert an order",
                "description": "Append a new order. Writes to the database.",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "customer": {"type": "string"},
                        "total_cents": {"type": "integer"},
                    },
                    "required": ["customer", "total_cents"],
                },
                "annotations": {"readOnlyHint": False, "destructiveHint": True, "idempotentHint": False},
            },
        ]

    def call_tool(self, mid, params: dict) -> dict:
        name = params.get("name")
        args = params.get("arguments", {})
        if name == "get_schema":
            return tool_ok(mid, json.dumps(SCHEMA))
        if name == "run_query":
            rows = [o for o in ORDERS if o["status"] == args["status"]] if "status" in args else list(ORDERS)
            # A tool result carries content plus isError; a tool error rides inside
            # the result (isError:true), not as a JSON-RPC error, so the model sees
            # it and can self-correct.
            return tool_ok(mid, json.dumps(rows))
        if name == "insert_order":
            missing = [k for k in ("customer", "total_cents") if k not in args]
            if missing:
                return tool_err(mid, f"missing argument(s): {missing}")
            row = {"id": len(ORDERS) + 1, "customer": args["customer"],
                   "total_cents": args["total_cents"], "status": "pending"}
            ORDERS.append(row)
            return tool_ok(mid, json.dumps({"inserted": row}))
        return err(mid, INVALID_PARAMS, f"Unknown tool: {name}")

    # -- resources ---------------------------------------------------------------
    # A resource is an addressable, read-only interface to data, identified by a URI.
    # A direct resource is enumerated in resources/list; a template is a parameterised
    # URI (RFC 6570) that stands in for a family of resources without listing them all.
    def resources(self) -> list[dict]:
        return [{
            "uri": "db://schema",
            "name": "database-schema",
            "title": "Full database schema",
            "description": "Every table, its columns, and their types.",
            "mimeType": "application/json",
        }]

    def resource_templates(self) -> list[dict]:
        return [{
            "uriTemplate": "db://tables/{table}/schema",
            "name": "table-schema",
            "title": "Schema for one table",
            "description": "Columns and types for a single table.",
            "mimeType": "application/json",
        }]

    def read_resource(self, mid, params: dict) -> dict:
        uri = params.get("uri", "")
        if uri == "db://schema":
            return resource_ok(mid, uri, json.dumps(SCHEMA))
        if uri.startswith("db://tables/") and uri.endswith("/schema"):
            table = uri[len("db://tables/"):-len("/schema")]
            if table in SCHEMA:
                return resource_ok(mid, uri, json.dumps({table: SCHEMA[table]}))
        # A read for a URI the server does not serve is a protocol error, not a
        # tool-style isError result: resources are addressed, so a bad address fails.
        # The spec reserves -32002 for exactly this; -32602 stays for a malformed uri.
        return err(mid, RESOURCE_NOT_FOUND, f"Resource not found: {uri}")

    # -- prompts -----------------------------------------------------------------
    # A prompt is a user-selected, parameterised message template, surfaced as a slash
    # command. Its messages can prime an assistant turn and embed a resource. This one
    # uses the hybrid pattern: the server computes the exact figure and hands the model
    # one language task, so arithmetic stays deterministic and prose stays the model's.
    def prompts(self) -> list[dict]:
        return [{
            "name": "weekly_report",
            "title": "Weekly revenue report",
            "description": "Summarise paid revenue for a region in plain prose.",
            "arguments": [{"name": "region", "description": "region to report on", "required": True}],
        }]

    def get_prompt(self, mid, params: dict) -> dict:
        name = params.get("name")
        if name != "weekly_report":
            return err(mid, INVALID_PARAMS, f"Unknown prompt: {name}")
        region = params.get("arguments", {}).get("region", "all")
        paid_cents = sum(o["total_cents"] for o in ORDERS if o["status"] == "paid")
        return ok(mid, {
            "description": f"Weekly revenue report for {region}",
            "messages": [
                # An embedded resource pulls the schema straight into the flow.
                {"role": "user", "content": {"type": "resource", "resource": {
                    "uri": "db://schema", "mimeType": "application/json", "text": json.dumps(SCHEMA)}}},
                # The server did the exact arithmetic; the model only writes the prose.
                {"role": "user", "content": {"type": "text", "text": (
                    f"Paid revenue is {paid_cents} cents. "
                    f"Write a one-paragraph weekly report for region '{region}'.")}},
                # A primed assistant turn steers tone. Prompts have no system role.
                {"role": "assistant", "content": {"type": "text",
                    "text": "Here is the weekly revenue summary:"}},
            ],
        })


# -- JSON-RPC reply builders -----------------------------------------------------

def ok(mid, result: dict) -> dict:
    return {"jsonrpc": "2.0", "id": mid, "result": result}


def err(mid, code: int, message: str) -> dict:
    return {"jsonrpc": "2.0", "id": mid, "error": {"code": code, "message": message}}


def tool_ok(mid, text: str) -> dict:
    return ok(mid, {"content": [{"type": "text", "text": text}], "isError": False})


def tool_err(mid, text: str) -> dict:
    return ok(mid, {"content": [{"type": "text", "text": text}], "isError": True})


def resource_ok(mid, uri: str, text: str) -> dict:
    return ok(mid, {"contents": [{"uri": uri, "mimeType": "application/json", "text": text}]})


# ================================================================================
# TRANSPORT (minimal): a real stdio server, so an actual MCP client can connect.
# The chapter is about the primitives, not the framing, so this is deliberately thin.
# ================================================================================

def serve_stdio() -> None:
    server = DatabaseServer()
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        reply = server.handle(json.loads(line))
        if reply is not None:
            sys.stdout.write(json.dumps(reply) + "\n")
            sys.stdout.flush()


# ================================================================================
# THE DRIVER: walk each primitive in turn against the same server, printing the wire
# request and the wire reply, so the three request/response shapes line up.
# ================================================================================

def banner(controller: str, primitive: str) -> None:
    print("\n" + "=" * 78)
    print(f"== {primitive.upper():<10} controlled by the {controller}")
    print("=" * 78)


def exchange(server: DatabaseServer, note: str, msg: dict) -> dict | None:
    print(f"\n  # {note}")
    print(f"  C -> S  {json.dumps(msg)}")
    reply = server.handle(msg)
    if reply is None:
        print("  S -> C  (notification: no reply owed)")
    else:
        print(f"  S -> C  {json.dumps(reply)}")
    return reply


def walk_tools(server: DatabaseServer, mid: int) -> int:
    banner("model", "tools")
    print("  The model reads the tool list, decides one is relevant, and calls it.")
    exchange(server, "discover: what can the model call?",
             {"jsonrpc": "2.0", "id": mid, "method": "tools/list"})
    exchange(server, "invoke a read-only tool: get_schema returns the same bytes as the resource below",
             {"jsonrpc": "2.0", "id": mid + 1, "method": "tools/call",
              "params": {"name": "get_schema", "arguments": {}}})
    exchange(server, "invoke a read-only query (readOnlyHint: auto-runnable)",
             {"jsonrpc": "2.0", "id": mid + 2, "method": "tools/call",
              "params": {"name": "run_query", "arguments": {"status": "paid"}}})
    exchange(server, "invoke a writing tool (destructiveHint: confirm first)",
             {"jsonrpc": "2.0", "id": mid + 3, "method": "tools/call",
              "params": {"name": "insert_order", "arguments": {"customer": "initech", "total_cents": 9900}}})
    return mid + 4


def walk_resources(server: DatabaseServer, mid: int) -> int:
    banner("application", "resources")
    print("  The host decides what to pull into context. The model does not read these on its own.")
    exchange(server, "discover: direct resources",
             {"jsonrpc": "2.0", "id": mid, "method": "resources/list"})
    exchange(server, "discover: parameterised resource templates",
             {"jsonrpc": "2.0", "id": mid + 1, "method": "resources/templates/list"})
    exchange(server, "read the whole schema by its URI",
             {"jsonrpc": "2.0", "id": mid + 2, "method": "resources/read",
              "params": {"uri": "db://schema"}})
    exchange(server, "read one table by filling the template",
             {"jsonrpc": "2.0", "id": mid + 3, "method": "resources/read",
              "params": {"uri": "db://tables/orders/schema"}})
    return mid + 4


def walk_prompts(server: DatabaseServer, mid: int) -> int:
    banner("user", "prompts")
    print("  The user picks a prompt (a slash command). The server fills and returns the messages.")
    exchange(server, "discover: which prompts are offered?",
             {"jsonrpc": "2.0", "id": mid, "method": "prompts/list"})
    exchange(server, "get the filled messages for /weekly_report region=west",
             {"jsonrpc": "2.0", "id": mid + 1, "method": "prompts/get",
              "params": {"name": "weekly_report", "arguments": {"region": "west"}}})
    return mid + 2


def run_checks() -> int:
    """Pin the wire contract that makes this a real MCP server, not a transcript."""
    server = DatabaseServer()
    early = server.handle({"jsonrpc": "2.0", "id": 1, "method": "tools/list"})
    assert early and early["error"]["code"] == INVALID_REQUEST
    initialized = server.handle({"jsonrpc": "2.0", "id": 2, "method": "initialize",
                                 "params": {"protocolVersion": LATEST}})
    assert initialized and initialized["result"]["protocolVersion"] == LATEST
    assert server.handle({"jsonrpc": "2.0", "method": "notifications/initialized"}) is None
    tools = server.handle({"jsonrpc": "2.0", "id": 3, "method": "tools/list"})
    assert tools and {tool["name"] for tool in tools["result"]["tools"]} == {
        "get_schema", "run_query", "insert_order"}
    missing = server.handle({"jsonrpc": "2.0", "id": 4, "method": "resources/read",
                             "params": {"uri": "db://tables/absent/schema"}})
    assert missing and missing["error"]["code"] == RESOURCE_NOT_FOUND
    print("primitive core checks: OK")
    return 0


def main(argv: list[str]) -> int:
    if "--serve-stdio" in argv:
        serve_stdio()
        return 0
    if "--test" in argv:
        return run_checks()

    server = DatabaseServer()
    print("# resources, tools, and prompts: one server, three controllers")
    print(f"# MCP {LATEST}. The same dataset is reachable three ways; watch who invokes each.")
    exchange(server, "initialize: the server declares all three capabilities",
             {"jsonrpc": "2.0", "id": 0, "method": "initialize",
              "params": {"protocolVersion": LATEST, "capabilities": {},
                         "clientInfo": {"name": "walkthrough", "version": "1.0.0"}}})
    exchange(server, "initialized: the client completes the handshake before any primitive call",
             {"jsonrpc": "2.0", "method": "notifications/initialized"})

    only = {"--tools", "--resources", "--prompts"} & set(argv)
    mid = 1
    if not only or "--tools" in argv:
        mid = walk_tools(server, mid)
    if not only or "--resources" in argv:
        mid = walk_resources(server, mid)
    if not only or "--prompts" in argv:
        mid = walk_prompts(server, mid)

    print("\n# one dataset, three doors. Tools the model opens, resources the app opens,")
    print("# prompts the user opens. Choosing the primitive is choosing the controller.")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
