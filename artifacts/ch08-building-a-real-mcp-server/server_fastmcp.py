#!/usr/bin/env python3
"""The same Support Analytics server, written with the official SDK: FastMCP.

support_analytics.py builds the disciplines by hand so it runs with zero dependencies.
This file is the version you would actually ship: FastMCP does the JSON-RPC, the schema
generation from type hints, the transport, and the error masking for you, so your code
is just the tools and the lifespan. Read the two side by side; the hand-rolled server
shows you what the framework is doing under the decorators.

FastMCP is the production Python choice (Jeremiah Lowin's framework, stewarded by
Prefect; the standalone `fastmcp` v3 line is the current one, and FastMCP 1.0 also ships
inside the official `mcp` package as `mcp.server.fastmcp.FastMCP`). This file needs it
installed and fails gracefully with instructions when it is not:

    uv add fastmcp          # or: pip install fastmcp
    python3 server_fastmcp.py            # stdio, for a local client
    python3 server_fastmcp.py --http     # Streamable HTTP on :8000, for a remote client

No API key, no network. The database is an in-memory SQLite seeded at startup, exactly
as in the hand-rolled version. Protocol shapes track MCP revision 2025-11-25.
"""
from __future__ import annotations

import json
import secrets
import sqlite3
import sys
import time
from contextlib import asynccontextmanager
from dataclasses import dataclass

try:
    from fastmcp import Context, FastMCP
    from fastmcp.exceptions import ToolError
    HAVE_FASTMCP = True
except ImportError:  # the graceful-degradation path: no dependency, clear instructions
    HAVE_FASTMCP = False


HANDLE_TTL_SECONDS = 300  # a real handle expires; a real store (Redis) enforces it


def seed(conn: sqlite3.Connection) -> None:
    conn.row_factory = sqlite3.Row
    conn.executescript(
        """
        CREATE TABLE customers (id INTEGER PRIMARY KEY, name TEXT, plan TEXT);
        CREATE TABLE tickets (id INTEGER PRIMARY KEY, customer_id INTEGER,
            subject TEXT, body TEXT, status TEXT);
        """
    )
    conn.executemany("INSERT INTO customers VALUES (?,?,?)",
                     [(1, "Acme", "enterprise"), (2, "Globex", "pro"), (3, "Initech", "free")])
    conn.executemany("INSERT INTO tickets VALUES (?,?,?,?,?)", [
        (101, 1, "Export fails on large reports", "CSV export times out past 50k rows.", "open"),
        (102, 1, "SSO login loop", "SAML redirect loops on staging.", "resolved"),
        (103, 2, "Webhook retries missing", "Failed webhooks are not retried.", "open"),
        (104, 3, "Billing page 500", "Upgrade page 500s on submit.", "open"),
    ])
    conn.commit()


if HAVE_FASTMCP:

    @dataclass
    class AppContext:
        db: sqlite3.Connection
        jobs: dict  # explicit-handle store: job_id -> {owner, expires, result}

    @asynccontextmanager
    async def lifespan(_server: "FastMCP"):
        # Open expensive resources ONCE here, tear them down on the way out. In
        # production this is an asyncpg pool and an httpx.AsyncClient, not sqlite.
        conn = sqlite3.connect(":memory:", check_same_thread=False)
        seed(conn)
        print("[server] lifespan: database opened", file=sys.stderr)
        try:
            yield AppContext(db=conn, jobs={})
        finally:
            conn.close()
            print("[server] lifespan: database closed", file=sys.stderr)

    # mask_error_details defaults to False in FastMCP, which LEAKS exception text to the
    # client. Turning it on is the production default: unexpected exceptions become a
    # generic message, while a raised ToolError still passes its text through.
    mcp = FastMCP("Support Analytics", mask_error_details=True, lifespan=lifespan)

    def _db(ctx: Context) -> sqlite3.Connection:
        return ctx.request_context.lifespan_context.db

    def _jobs(ctx: Context) -> dict:
        return ctx.request_context.lifespan_context.jobs

    def _user(ctx: Context) -> str:
        # A remote server resolves this from the validated OAuth token (ctx carries the
        # auth context). Local stdio has no token, so we use a fixed subject.
        return "u_analyst"

    @mcp.tool
    def search_tickets(query: str, status: str | None = None, limit: int = 20, ctx: Context = None) -> str:
        """Find tickets by keyword, optionally filtered by status (open, resolved).
        Returns id, subject, status, and a snippet, not full bodies. Use get_ticket for one."""
        sql = "SELECT id, subject, status, substr(body,1,60) AS snippet FROM tickets WHERE (subject LIKE ? OR body LIKE ?)"
        binds: list = [f"%{query}%", f"%{query}%"]
        if status:
            sql += " AND status = ?"
            binds.append(status)
        sql += " ORDER BY id LIMIT ?"
        binds.append(min(limit, 50))
        return json.dumps([dict(r) for r in _db(ctx).execute(sql, binds).fetchall()])

    @mcp.tool
    def get_ticket(ticket_id: int, ctx: Context = None) -> str:
        """Return the full record of a single ticket by id, including the body."""
        row = _db(ctx).execute("SELECT * FROM tickets WHERE id = ?", [ticket_id]).fetchone()
        if row is None:
            raise ToolError(f"ticket {ticket_id} not found")  # visible to the model
        return json.dumps(dict(row))

    @mcp.tool
    def summarize_customer_issues(customer_id: int, ctx: Context = None) -> str:
        """Return a customer with their tickets and open-issue counts in ONE call.
        Prefer this over fetching the customer and their tickets separately."""
        db = _db(ctx)
        cust = db.execute("SELECT * FROM customers WHERE id = ?", [customer_id]).fetchone()
        if cust is None:
            raise ToolError(f"customer {customer_id} not found")
        tickets = db.execute("SELECT id, subject, status FROM tickets WHERE customer_id = ? ORDER BY id",
                             [customer_id]).fetchall()
        by_status: dict[str, int] = {}
        for t in tickets:
            by_status[t["status"]] = by_status.get(t["status"], 0) + 1
        return json.dumps({"customer": dict(cust), "open_count": by_status.get("open", 0),
                           "by_status": by_status, "tickets": [dict(t) for t in tickets]})

    @mcp.tool
    def run_ticket_report(status: str | None = None, ctx: Context = None) -> str:
        """Start a report over tickets, optionally filtered by status. Returns a job_id;
        pass it to get_report_status to read the result."""
        n = _db(ctx).execute("SELECT count(*) AS n FROM tickets WHERE (? IS NULL OR status = ?)",
                             [status, status]).fetchone()["n"]
        job_id = "job_" + secrets.token_hex(5)
        # The handle is bound to the caller and given an expiry, so a bare id lifted from
        # a log is not a replay token. A real store (Redis) holds this, not process memory.
        _jobs(ctx)[job_id] = {
            "owner": _user(ctx),
            "expires": time.monotonic() + HANDLE_TTL_SECONDS,
            "result": {"filter": status or "all", "matched": n},
        }
        return json.dumps({"job_id": job_id, "status": "complete"})

    @mcp.tool
    def get_report_status(job_id: str, ctx: Context = None) -> str:
        """Read the status and result of a report started with run_ticket_report."""
        job = _jobs(ctx).get(job_id)
        if job is None:
            raise ToolError(f"no report with id {job_id}")
        if job["owner"] != _user(ctx):
            raise ToolError("this report handle does not belong to you")
        if time.monotonic() > job["expires"]:
            raise ToolError("this report handle has expired; run the report again")
        return json.dumps({"status": "complete", "result": job["result"]})

    @mcp.tool(annotations={"destructiveHint": True, "readOnlyHint": False})
    def create_followup(customer_id: int, note: str, ctx: Context = None) -> str:
        """Open a new follow-up ticket for a customer with a note. Writes to the database."""
        db = _db(ctx)
        if db.execute("SELECT 1 FROM customers WHERE id = ?", [customer_id]).fetchone() is None:
            raise ToolError(f"customer {customer_id} not found")
        new_id = db.execute("SELECT coalesce(max(id),100)+1 AS n FROM tickets").fetchone()["n"]
        db.execute("INSERT INTO tickets VALUES (?,?,?,?,?)",
                   [new_id, customer_id, "Follow-up", note, "open"])
        db.commit()
        return json.dumps({"created_ticket_id": new_id})

    @mcp.tool
    def run_query(sql: str, ctx: Context = None) -> str:
        """Run a single read-only SELECT against the database. Non-SELECT statements are rejected."""
        if not sql.strip().upper().startswith("SELECT"):
            raise ToolError("only SELECT queries are allowed here")  # visible guard
        # A bad column or table raises sqlite3.OperationalError, an unexpected exception
        # that FastMCP logs and, with mask_error_details=True, masks to a generic message.
        return json.dumps([dict(r) for r in _db(ctx).execute(sql).fetchall()])

    @mcp.resource("schema://tickets", mime_type="text/plain")
    def schema(ctx: Context = None) -> str:
        """The DDL of every table, read from the live database."""
        rows = _db(ctx).execute("SELECT sql FROM sqlite_master WHERE type='table' ORDER BY name").fetchall()
        return ";\n".join(r["sql"] for r in rows) + ";"


def main(argv: list[str]) -> int:
    if not HAVE_FASTMCP:
        print("fastmcp is not installed. This file is the official-SDK version of the server.",
              file=sys.stderr)
        print("Install it, then run this file:", file=sys.stderr)
        print("    uv add fastmcp        # or:  pip install fastmcp", file=sys.stderr)
        print("    python3 server_fastmcp.py", file=sys.stderr)
        print("\nThe zero-dependency version runs right now:  python3 support_analytics.py",
              file=sys.stderr)
        return 0
    if "--http" in argv:
        mcp.run(transport="http", host="127.0.0.1", port=8000)
    else:
        mcp.run()  # stdio by default
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
