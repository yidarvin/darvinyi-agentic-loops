#!/usr/bin/env python3
"""A production-shaped MCP server: Support Analytics, an adapter over a real database.

Companion to chapter 8, "Building a Real MCP Server." The toy server from the earlier
chapters answered the happy path. This one is built for the client it actually has: a
non-deterministic agent that will send malformed arguments, disallowed queries, and
calls in the wrong order. The gap between the toy and this is entirely defensive
engineering, and that engineering is the whole chapter:

  * lifecycle    open the database once at startup, close it at shutdown (a real
                 lifespan, not a global opened on first use)
  * two error    a ToolError is visible to the model so it can recover; an unexpected
    channels     exception is logged in full server-side and MASKED to a generic
                 message so no internal detail leaks to the client
  * intent tools the surface is a UI for an agent, not a 1:1 wrapper of the database.
                 summarize_customer_issues consolidates three lookups into one call
  * handle state run_ticket_report mints an opaque, user-bound, expiring job_id;
                 get_report_status accepts it back. State lives in a store, not in a
                 session pinned to one process
  * testable     an in-memory client calls handle() directly, no subprocess, so the
                 whole server is unit-testable in milliseconds

The integration is real: a genuine SQLite database (standard library), seeded at
startup, queried with bound parameters, guarded to read-only where it must be. No
external service, no API key, no network, no third-party package.

Run it:

    python3 support_analytics.py            # walk the disciplines, print each exchange
    python3 support_analytics.py --test     # run the in-memory test suite, exit non-zero on failure
    python3 support_analytics.py --unmasked # same walk, but show what leaks with masking OFF

Internal (a real MCP client, e.g. the Inspector, would start this for you):

    python3 support_analytics.py --serve-stdio

Protocol shapes track MCP revision 2025-11-25. The idiomatic FastMCP version of this
same server is in server_fastmcp.py.
"""
from __future__ import annotations

import json
import secrets
import sqlite3
import sys
import traceback
from contextlib import contextmanager

LATEST = "2025-11-25"
SUPPORTED = ["2025-11-25", "2025-06-18", "2025-03-26"]

# JSON-RPC / MCP error codes. Protocol errors ride the JSON-RPC "error" channel; tool
# execution failures ride inside a normal result with isError:true (see call_tool).
METHOD_NOT_FOUND = -32601
INVALID_REQUEST = -32600
INVALID_PARAMS = -32602  # a malformed call: the SDK layer rejects it before your tool runs

# How long a report handle stays valid, measured in server ticks (one per request).
# Real servers use wall-clock TTLs in a store (Redis, Postgres); a logical tick keeps
# expiry deterministic and demonstrable here.
HANDLE_TTL_TICKS = 4


# ================================================================================
# LIFESPAN: open expensive resources once, tear them down once. The toy opens a global
# on first use and never closes it; a real server owns the resource's whole lifetime.
# ================================================================================

@contextmanager
def lifespan(user: str):
    """Open the database, seed it, hand it to the server, close it on the way out."""
    log(f"lifespan: opening database, authenticated user = {user}")
    conn = sqlite3.connect(":memory:")
    conn.row_factory = sqlite3.Row
    _seed(conn)
    server = SupportAnalytics(conn=conn, user=user)
    try:
        yield server
    finally:
        conn.close()
        log("lifespan: database closed")


def _seed(conn: sqlite3.Connection) -> None:
    conn.executescript(
        """
        CREATE TABLE customers (id INTEGER PRIMARY KEY, name TEXT, plan TEXT);
        CREATE TABLE tickets (
            id INTEGER PRIMARY KEY, customer_id INTEGER, subject TEXT,
            body TEXT, status TEXT
        );
        """
    )
    conn.executemany(
        "INSERT INTO customers (id, name, plan) VALUES (?, ?, ?)",
        [(1, "Acme", "enterprise"), (2, "Globex", "pro"), (3, "Initech", "free")],
    )
    conn.executemany(
        "INSERT INTO tickets (id, customer_id, subject, body, status) VALUES (?, ?, ?, ?, ?)",
        [
            (101, 1, "Export fails on large reports", "The CSV export times out past 50k rows.", "open"),
            (102, 1, "SSO login loop", "SAML redirect loops on the staging tenant.", "resolved"),
            (103, 2, "Webhook retries missing", "Failed webhooks are not retried as documented.", "open"),
            (104, 3, "Billing page 500", "Upgrade page returns a 500 on submit.", "open"),
            (105, 2, "Rate limit unclear", "Docs disagree with the 429 headers we see.", "resolved"),
        ],
    )
    conn.commit()


# ================================================================================
# ToolError: a failure the model is meant to SEE and recover from. Its message always
# reaches the client, masking on or off. Any other exception is an internal fault: it
# is logged in full and masked to a generic message the model can retry against.
# ================================================================================

class ToolError(Exception):
    """A recoverable, client-visible tool failure. The model reads this and self-corrects."""


# ================================================================================
# THE SERVER. handle() maps a JSON-RPC message to a reply. It is a real MCP server core:
# a client can spawn it with --serve-stdio and speak newline-delimited JSON to it.
# ================================================================================

class SupportAnalytics:
    def __init__(self, conn: sqlite3.Connection, user: str, mask_error_details: bool = True):
        self.db = conn
        self.user = user  # the authenticated subject, as an OAuth resource server would resolve it
        self.mask = mask_error_details
        self.jobs: dict[str, dict] = {}  # explicit-handle store: job_id -> {owner, expires_tick, ...}
        self._tick = 0
        self.initialized = False

    # ---- the JSON-RPC front door ------------------------------------------------
    def handle(self, msg: dict) -> dict | None:
        self._tick += 1
        method = msg.get("method")
        if "id" not in msg:  # a notification is never answered
            if method == "notifications/initialized":
                self.initialized = True
            return None
        mid = msg["id"]

        if method == "initialize":
            requested = msg.get("params", {}).get("protocolVersion")
            return ok(mid, {
                "protocolVersion": requested if requested in SUPPORTED else LATEST,
                "capabilities": {"tools": {"listChanged": True}, "resources": {"listChanged": True}},
                "serverInfo": {"name": "support-analytics", "version": "1.0.0"},
            })
        if not self.initialized:
            return err(mid, INVALID_REQUEST,
                       "Received request before initialization completed")
        if method == "tools/list":
            return ok(mid, {"tools": TOOLS})
        if method == "tools/call":
            return self.call_tool(mid, msg.get("params", {}))
        if method == "resources/list":
            return ok(mid, {"resources": [{
                "uri": "schema://tickets", "name": "database-schema",
                "title": "Live database schema", "mimeType": "text/plain",
                "description": "The DDL of every table, read from the live database.",
            }]})
        if method == "resources/read":
            return self.read_resource(mid, msg.get("params", {}))
        return err(mid, METHOD_NOT_FOUND, f"Method not found: {method}")

    # ---- tool dispatch: validation, then the two error channels -----------------
    def call_tool(self, mid, params: dict) -> dict:
        name = params.get("name")
        args = params.get("arguments", {})
        fn = TOOL_FNS.get(name)
        if fn is None:
            return err(mid, INVALID_PARAMS, f"Unknown tool: {name}")

        # Argument validation is a PROTOCOL error: a malformed call never reaches the
        # tool body. The SDK does this from the inputSchema; we do it by hand here.
        problem = validate_args(name, args)
        if problem:
            return err(mid, INVALID_PARAMS, problem)

        try:
            return tool_ok(mid, fn(self, args))
        except ToolError as e:
            # Channel one: a recoverable failure the model should read. Always visible.
            return tool_err(mid, str(e))
        except Exception as e:  # noqa: BLE001 -- the whole point is to catch everything
            # Channel two: an internal fault. Log it in full for the operator, and mask
            # it to a generic message so no stack trace, SQL, or path reaches the client.
            log("UNEXPECTED ERROR in tool '%s':\n%s" % (name, traceback.format_exc()))
            if self.mask:
                return tool_err(mid, "An internal error occurred. The failure has been logged.")
            return tool_err(mid, f"[unmasked] {type(e).__name__}: {e}")

    def read_resource(self, mid, params: dict) -> dict:
        uri = params.get("uri", "")
        if uri != "schema://tickets":
            return err(mid, INVALID_PARAMS, f"Resource not found: {uri}")
        rows = self.db.execute(
            "SELECT sql FROM sqlite_master WHERE type='table' ORDER BY name"
        ).fetchall()
        ddl = ";\n".join(r["sql"] for r in rows) + ";"
        return ok(mid, {"contents": [{"uri": uri, "mimeType": "text/plain", "text": ddl}]})

    # ---- the tools themselves: intent-shaped, not endpoint-shaped ---------------
    # Each returns a JSON string. Descriptions live in TOOLS below, because the model
    # selects a tool from its name and description alone.

    def search_tickets(self, args: dict) -> str:
        """Economical result: id, subject, status, and a snippet. Never the full body."""
        q = f"%{args.get('query', '')}%"
        sql = "SELECT id, subject, status, substr(body,1,60) AS snippet FROM tickets WHERE (subject LIKE ? OR body LIKE ?)"
        binds: list = [q, q]
        if args.get("status"):
            sql += " AND status = ?"
            binds.append(args["status"])
        sql += " ORDER BY id LIMIT ?"
        binds.append(min(int(args.get("limit", 20)), 50))  # cap the row count, always
        rows = self.db.execute(sql, binds).fetchall()
        return json.dumps([dict(r) for r in rows])

    def get_ticket(self, args: dict) -> str:
        row = self.db.execute("SELECT * FROM tickets WHERE id = ?", [args["ticket_id"]]).fetchone()
        if row is None:
            raise ToolError(f"ticket {args['ticket_id']} not found")  # visible, recoverable
        return json.dumps(dict(row))

    def summarize_customer_issues(self, args: dict) -> str:
        """One intent, one call. Consolidates the customer lookup, their tickets, and the
        counts that would otherwise be three chatty round trips (the Token Arson anti-pattern)."""
        cid = args["customer_id"]
        cust = self.db.execute("SELECT * FROM customers WHERE id = ?", [cid]).fetchone()
        if cust is None:
            raise ToolError(f"customer {cid} not found")
        tickets = self.db.execute(
            "SELECT id, subject, status FROM tickets WHERE customer_id = ? ORDER BY id", [cid]
        ).fetchall()
        by_status: dict[str, int] = {}
        for t in tickets:
            by_status[t["status"]] = by_status.get(t["status"], 0) + 1
        return json.dumps({
            "customer": dict(cust),
            "open_count": by_status.get("open", 0),
            "by_status": by_status,
            "tickets": [dict(t) for t in tickets],
        })

    def run_ticket_report(self, args: dict) -> str:
        """Mint an opaque handle for a report. The state lives in a store keyed by the
        handle, bound to the calling user and given an expiry. A bare handle lifted from
        a log would otherwise be a replay token."""
        status = args.get("status")
        count = self.db.execute(
            "SELECT count(*) AS n FROM tickets WHERE (? IS NULL OR status = ?)", [status, status]
        ).fetchone()["n"]
        job_id = "job_" + secrets.token_hex(5)
        self.jobs[job_id] = {
            "owner": self.user,
            "expires_tick": self._tick + HANDLE_TTL_TICKS,
            "status": "complete",
            "result": {"filter": status or "all", "matched": count},
        }
        return json.dumps({"job_id": job_id, "status": "complete"})

    def get_report_status(self, args: dict) -> str:
        job = self.jobs.get(args["job_id"])
        if job is None:
            raise ToolError(f"no report with id {args['job_id']}")
        if job["owner"] != self.user:  # a handle is bound to whoever minted it
            raise ToolError("this report handle does not belong to you")
        if self._tick > job["expires_tick"]:  # and it expires
            raise ToolError("this report handle has expired; run the report again")
        return json.dumps({"status": job["status"], "result": job["result"]})

    def create_followup(self, args: dict) -> str:
        """A write. Annotated destructive so a careful client confirms before running it."""
        cid = args["customer_id"]
        if self.db.execute("SELECT 1 FROM customers WHERE id = ?", [cid]).fetchone() is None:
            raise ToolError(f"customer {cid} not found")
        new_id = self.db.execute("SELECT coalesce(max(id),100)+1 AS n FROM tickets").fetchone()["n"]
        self.db.execute(
            "INSERT INTO tickets (id, customer_id, subject, body, status) VALUES (?,?,?,?,?)",
            [new_id, cid, "Follow-up", args["note"], "open"],
        )
        self.db.commit()
        return json.dumps({"created_ticket_id": new_id})

    def run_query(self, args: dict) -> str:
        """A guarded raw-SQL escape hatch. The guard is a visible ToolError; a query that
        slips past it and fails inside SQLite is an internal fault, logged and masked."""
        sql = args["sql"].strip()
        if not sql.upper().startswith("SELECT"):
            raise ToolError("only SELECT queries are allowed here")  # visible guard
        rows = self.db.execute(sql).fetchall()  # a bad column/table raises -> masked
        return json.dumps([dict(r) for r in rows])


# ---- tool catalog: names, descriptions, schemas, annotations -------------------
# The description is the interface the model reasons over. Annotations are trust hints
# the client uses to graduate confirmation: read-only can auto-run, destructive should ask.

TOOLS = [
    {
        "name": "search_tickets",
        "title": "Search support tickets",
        "description": "Find tickets by keyword, optionally filtered by status (open, resolved). Returns id, subject, status, and a short snippet, not full bodies. Use get_ticket for the full text of one.",
        "inputSchema": {"type": "object", "properties": {
            "query": {"type": "string", "description": "keyword to match in subject or body"},
            "status": {"type": "string", "enum": ["open", "resolved"]},
            "limit": {"type": "integer", "default": 20},
        }, "required": ["query"]},
        "annotations": {"readOnlyHint": True, "openWorldHint": False},
    },
    {
        "name": "get_ticket",
        "title": "Get one ticket",
        "description": "Return the full record of a single ticket by id, including the body.",
        "inputSchema": {"type": "object", "properties": {
            "ticket_id": {"type": "integer"},
        }, "required": ["ticket_id"]},
        "annotations": {"readOnlyHint": True, "openWorldHint": False},
    },
    {
        "name": "summarize_customer_issues",
        "title": "Summarize a customer's issues",
        "description": "Return a customer with their tickets and open-issue counts in one call. Prefer this over fetching the customer and their tickets separately.",
        "inputSchema": {"type": "object", "properties": {
            "customer_id": {"type": "integer"},
        }, "required": ["customer_id"]},
        "annotations": {"readOnlyHint": True, "openWorldHint": False},
    },
    {
        "name": "run_ticket_report",
        "title": "Start a ticket report",
        "description": "Start a report over tickets, optionally filtered by status. Returns a job_id; pass it to get_report_status to read the result.",
        "inputSchema": {"type": "object", "properties": {
            "status": {"type": "string", "enum": ["open", "resolved"]},
        }},
        "annotations": {"readOnlyHint": True, "openWorldHint": False},
    },
    {
        "name": "get_report_status",
        "title": "Read a report result",
        "description": "Read the status and result of a report started with run_ticket_report, by its job_id.",
        "inputSchema": {"type": "object", "properties": {
            "job_id": {"type": "string"},
        }, "required": ["job_id"]},
        "annotations": {"readOnlyHint": True, "openWorldHint": False},
    },
    {
        "name": "create_followup",
        "title": "Create a follow-up ticket",
        "description": "Open a new follow-up ticket for a customer with a note. Writes to the database.",
        "inputSchema": {"type": "object", "properties": {
            "customer_id": {"type": "integer"},
            "note": {"type": "string"},
        }, "required": ["customer_id", "note"]},
        "annotations": {"readOnlyHint": False, "destructiveHint": True, "idempotentHint": False},
    },
    {
        "name": "run_query",
        "title": "Run a read-only SQL query",
        "description": "Run a single read-only SELECT against the database. Non-SELECT statements are rejected.",
        "inputSchema": {"type": "object", "properties": {
            "sql": {"type": "string"},
        }, "required": ["sql"]},
        "annotations": {"readOnlyHint": True, "openWorldHint": False},
    },
]

TOOL_FNS = {
    "search_tickets": SupportAnalytics.search_tickets,
    "get_ticket": SupportAnalytics.get_ticket,
    "summarize_customer_issues": SupportAnalytics.summarize_customer_issues,
    "run_ticket_report": SupportAnalytics.run_ticket_report,
    "get_report_status": SupportAnalytics.get_report_status,
    "create_followup": SupportAnalytics.create_followup,
    "run_query": SupportAnalytics.run_query,
}

# Minimal schema validation: required-present and a light int/string check. This stands
# in for the SDK's inputSchema validation, whose failures are protocol -32602 errors.
_TYPES = {"integer": int, "string": str}


def validate_args(name: str, args: dict) -> str | None:
    schema = next(t["inputSchema"] for t in TOOLS if t["name"] == name)
    for req in schema.get("required", []):
        if req not in args:
            return f"missing required argument: {req}"
    for key, val in args.items():
        prop = schema.get("properties", {}).get(key)
        if not prop or prop.get("type") not in _TYPES:
            continue
        expected = prop["type"]
        # bool is a subclass of int; reject it explicitly so integer means integer
        if expected == "integer" and isinstance(val, bool):
            return f"argument '{key}' must be an integer"
        if not isinstance(val, _TYPES[expected]):
            article = "an" if expected == "integer" else "a"
            return f"argument '{key}' must be {article} {expected}"
    return None


# ---- JSON-RPC reply builders ---------------------------------------------------

def ok(mid, result: dict) -> dict:
    return {"jsonrpc": "2.0", "id": mid, "result": result}


def err(mid, code: int, message: str) -> dict:
    return {"jsonrpc": "2.0", "id": mid, "error": {"code": code, "message": message}}


def tool_ok(mid, text: str) -> dict:
    return ok(mid, {"content": [{"type": "text", "text": text}], "isError": False})


def tool_err(mid, text: str) -> dict:
    return ok(mid, {"content": [{"type": "text", "text": text}], "isError": True})


# ---- logging: STDERR ONLY ------------------------------------------------------
# The stdio footgun: a stdio server speaks JSON-RPC over stdout. One stray print to
# stdout corrupts the stream and the client disconnects. All logs go to stderr.

def log(*parts) -> None:
    print("[server]", *parts, file=sys.stderr)


# ================================================================================
# TRANSPORT (minimal): a real stdio server, so an actual MCP client can connect.
# ================================================================================

def serve_stdio(user: str) -> None:
    with lifespan(user) as server:
        for line in sys.stdin:
            line = line.strip()
            if not line:
                continue
            reply = server.handle(json.loads(line))
            if reply is not None:
                sys.stdout.write(json.dumps(reply) + "\n")
                sys.stdout.flush()


# ================================================================================
# IN-MEMORY CLIENT: call handle() directly, no subprocess. This is FastMCP's killer
# testing feature reproduced in miniature: the real protocol, millisecond tests.
# ================================================================================

class InMemoryClient:
    def __init__(self, server: SupportAnalytics):
        self.server = server
        self._id = 0
        self.server.handle({"jsonrpc": "2.0", "id": self._new_id(), "method": "initialize",
                            "params": {"protocolVersion": LATEST, "capabilities": {}}})
        self.server.handle({"jsonrpc": "2.0", "method": "notifications/initialized"})

    def _new_id(self) -> int:
        self._id += 1
        return self._id

    def call_tool(self, name: str, arguments: dict) -> dict:
        reply = self.server.handle({
            "jsonrpc": "2.0", "id": self._new_id(), "method": "tools/call",
            "params": {"name": name, "arguments": arguments},
        })
        return reply


def run_tests() -> int:
    """Deterministic assertions over the protocol. No LLM, no network, no subprocess."""
    failures = 0

    def check(label: str, cond: bool) -> None:
        nonlocal failures
        mark = "ok  " if cond else "FAIL"
        print(f"  [{mark}] {label}")
        if not cond:
            failures += 1

    with lifespan("u_analyst") as server:
        early = server.handle({"jsonrpc": "2.0", "id": 0, "method": "tools/list"})
        check("pre-handshake request -> -32600",
              early and early.get("error", {}).get("code") == INVALID_REQUEST)
        client = InMemoryClient(server)

        # happy path: a well-formed call returns content with isError:false
        r = client.call_tool("get_ticket", {"ticket_id": 101})["result"]
        check("get_ticket returns a result", r["isError"] is False and "Export fails" in r["content"][0]["text"])

        # intent tool consolidates: one call, customer + tickets + counts
        r = json.loads(client.call_tool("summarize_customer_issues", {"customer_id": 1})["result"]["content"][0]["text"])
        check("summarize_customer_issues consolidates", r["customer"]["name"] == "Acme" and r["open_count"] == 1)

        # ToolError is VISIBLE: a not-found is a recoverable, readable failure
        r = client.call_tool("get_ticket", {"ticket_id": 9999})["result"]
        check("missing ticket -> visible ToolError", r["isError"] is True and "9999" in r["content"][0]["text"])

        # the SELECT guard is a visible ToolError, not a crash
        r = client.call_tool("run_query", {"sql": "DELETE FROM tickets"})["result"]
        check("non-SELECT -> visible guard", r["isError"] is True and "SELECT" in r["content"][0]["text"])

        # an internal fault is MASKED: the client sees a generic message, never the SQL error
        r = client.call_tool("run_query", {"sql": "SELECT * FROM does_not_exist"})["result"]
        leaked = "no such table" in r["content"][0]["text"].lower()
        check("internal error -> masked (no leak)", r["isError"] is True and not leaked)

        # a malformed call is a PROTOCOL error (-32602), rejected before the tool body
        reply = client.call_tool("get_ticket", {})  # missing required ticket_id
        check("missing required arg -> -32602", reply.get("error", {}).get("code") == INVALID_PARAMS)

        # explicit handle: mint a job, read it back
        job = json.loads(client.call_tool("run_ticket_report", {"status": "open"})["result"]["content"][0]["text"])
        r = json.loads(client.call_tool("get_report_status", {"job_id": job["job_id"]})["result"]["content"][0]["text"])
        check("handle round-trips", r["result"]["matched"] == 3)

        # a handle is bound to its owner: a different authenticated user is refused
        server.user = "u_intruder"
        r = client.call_tool("get_report_status", {"job_id": job["job_id"]})["result"]
        check("foreign user -> handle refused", r["isError"] is True and "belong" in r["content"][0]["text"])
        server.user = "u_analyst"

        # a handle expires: advance ticks past the TTL
        job2 = json.loads(client.call_tool("run_ticket_report", {})["result"]["content"][0]["text"])
        for _ in range(HANDLE_TTL_TICKS + 1):
            server.handle({"jsonrpc": "2.0", "id": 0, "method": "tools/list"})
        r = client.call_tool("get_report_status", {"job_id": job2["job_id"]})["result"]
        check("stale handle -> expired", r["isError"] is True and "expired" in r["content"][0]["text"])

    print()
    if failures:
        print(f"# {failures} test(s) FAILED")
    else:
        print("# all tests passed")
    return 1 if failures else 0


# ================================================================================
# THE DRIVER: walk the disciplines against the same server, printing each exchange.
# ================================================================================

def exchange(server: SupportAnalytics, note: str, msg: dict) -> dict | None:
    print(f"\n  # {note}")
    print(f"  C -> S  {json.dumps(msg)}")
    reply = server.handle(msg)
    print(f"  S -> C  {json.dumps(reply)}")
    return reply


def call(server, note, name, arguments, mid):
    return exchange(server, note, {"jsonrpc": "2.0", "id": mid, "method": "tools/call",
                                   "params": {"name": name, "arguments": arguments}})


def section(title: str) -> None:
    print("\n" + "=" * 78)
    print(f"== {title}")
    print("=" * 78)


def demo(mask: bool) -> int:
    with lifespan("u_analyst") as server:
        server.mask = mask
        print(f"\n# Support Analytics: a production-shaped MCP server over a real SQLite database.")
        print(f"# MCP {LATEST}. mask_error_details = {mask}. Logs go to stderr; JSON-RPC to stdout.")

        exchange(server, "initialize: declare the capabilities this server actually implements",
                 {"jsonrpc": "2.0", "id": 1, "method": "initialize",
                  "params": {"protocolVersion": LATEST}})
        exchange(server, "initialized: complete the handshake before tool calls",
                 {"jsonrpc": "2.0", "method": "notifications/initialized"})

        section("intent, not endpoints")
        call(server, "one call returns customer + tickets + counts (avoids three chatty round trips)",
             "summarize_customer_issues", {"customer_id": 1}, 2)
        call(server, "economical result: snippets, not full bodies",
             "search_tickets", {"query": "login"}, 3)

        section("the two error channels")
        call(server, "a not-found is a VISIBLE ToolError: the model reads it and recovers",
             "get_ticket", {"ticket_id": 9999}, 4)
        call(server, "the SELECT guard is a visible ToolError, not a crash",
             "run_query", {"sql": "DROP TABLE tickets"}, 5)
        call(server, "an internal fault is MASKED: the client sees generic; the real error is on stderr",
             "run_query", {"sql": "SELECT * FROM does_not_exist"}, 6)
        exchange(server, "a malformed call is a PROTOCOL error (-32602), rejected before the tool runs",
                 {"jsonrpc": "2.0", "id": 7, "method": "tools/call",
                  "params": {"name": "get_ticket", "arguments": {}}})

        section("explicit-handle state (survives statelessness)")
        reply = call(server, "mint an opaque, user-bound, expiring job_id",
                     "run_ticket_report", {"status": "open"}, 8)
        job_id = json.loads(reply["result"]["content"][0]["text"])["job_id"]
        call(server, "hand the same handle back to read the result",
             "get_report_status", {"job_id": job_id}, 9)
        # the handle is bound to whoever minted it: a different authenticated user is refused
        server.user = "u_intruder"
        call(server, "the same handle, a different user: refused (not a replay token)",
             "get_report_status", {"job_id": job_id}, 10)
        server.user = "u_analyst"

        section("write path")
        call(server, "a write carries destructiveHint; a careful client confirms first",
             "create_followup", {"customer_id": 2, "note": "escalated per SLA"}, 11)

        print("\n# The toy answered the happy path. Everything above is the difference: a surface")
        print("# shaped for intent, two error channels done right, and state that outlives a session.")
    return 0


def main(argv: list[str]) -> int:
    user = "u_analyst"
    if "--serve-stdio" in argv:
        serve_stdio(user)
        return 0
    if "--test" in argv:
        return run_tests()
    return demo(mask="--unmasked" not in argv)


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
