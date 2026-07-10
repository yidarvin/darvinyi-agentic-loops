# ch08 - a real MCP server, not a toy

The toy servers in the earlier chapters answered the happy path. This is the server you
would actually ship: an adapter over a **real database** (SQLite, standard library) whose
client is a non-deterministic agent that will send malformed arguments, disallowed
queries, and calls in the wrong order. The gap between the toy and this is entirely
defensive engineering, and that engineering is the whole chapter.

Two files build the same server two ways:

| file                    | what it is                                                        |
|-------------------------|-------------------------------------------------------------------|
| `support_analytics.py`  | zero dependencies. The disciplines built by hand so you see them. |
| `server_fastmcp.py`     | the version you would ship, written with the official SDK (FastMCP). |

Read them side by side. The hand-rolled server shows you what FastMCP is doing under the
decorators: schema validation, the two error channels, transport, masking.

## Run it

```
cd artifacts/ch08-building-a-real-mcp-server
python3 support_analytics.py            # walk the disciplines, print each wire exchange
python3 support_analytics.py --test     # the in-memory test suite; exits non-zero on failure
python3 support_analytics.py --unmasked # the same walk with masking OFF, to see what leaks
```

- **Runtime:** Python 3.9+, standard library only (`sqlite3` is the "real integration").
- **No key, no SDK, no network.** Protocol shapes track MCP revision `2025-11-25`.

The official-SDK version needs FastMCP, and says so if it is missing:

```
uv add fastmcp          # or: pip install fastmcp
python3 server_fastmcp.py            # stdio, for a local client
python3 server_fastmcp.py --http     # Streamable HTTP on :8000, for a remote client
```

## What the disciplines are

The demo walks each one and prints the wire request and reply:

1. **Lifecycle (lifespan).** The database is opened and seeded once at startup and closed
   at shutdown, not lazily on first use. In production this is an `asyncpg` pool and an
   `httpx` client; the shape is the same. Run with logs visible (`2>&1`) and you see the
   open and close bracket the whole session.
2. **Intent, not endpoints.** `summarize_customer_issues` returns a customer, their
   tickets, and the counts in **one** call instead of three chatty round trips (the Token
   Arson anti-pattern). `search_tickets` returns snippets, not full bodies, so a large
   result does not eat the context window.
3. **The two error channels.** A not-found and the SELECT guard are **visible**
   `ToolError`s: `isError:true` inside a normal result, so the model reads them and
   recovers. An unexpected exception (a query that fails inside SQLite) is logged in full
   on stderr and **masked** to a generic message, so no stack trace, SQL, or path reaches
   the client. A malformed call is a **protocol** error (`-32602`), caught by validation
   before the tool body runs. Compare `--test` (masked) with `--unmasked` to see the leak.
4. **Explicit-handle state.** `run_ticket_report` mints an opaque `job_id`; the state
   lives in a store keyed by the handle, **bound to the calling user and given an expiry**.
   `get_report_status` accepts the handle back. A different user is refused; a stale handle
   is expired. This is the pattern that survives the move to a stateless protocol and to
   servers behind a load balancer, where no session is pinned to one process.
5. **The stdio footgun.** Every log line goes to **stderr**. In a stdio server, one stray
   `print()` to stdout corrupts the JSON-RPC stream and the client disconnects.

## It is a real server

`SupportAnalytics.handle()` maps a JSON-RPC message to a JSON-RPC reply. It is a genuine
MCP server, not a mock: a real client can spawn it and speak newline-delimited JSON.

```
python3 support_analytics.py --serve-stdio
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | python3 support_analytics.py --serve-stdio
```

## Tested without a subprocess

`InMemoryClient` calls `handle()` directly: the real protocol, no subprocess, millisecond
tests. This mirrors FastMCP's in-memory `Client(mcp)`, the fastest way to keep a server's
tool contract from drifting out from under the agent that depends on it. `--test` runs
nine deterministic assertions over the happy path, both error channels, masking, and the
handle's ownership and expiry.
