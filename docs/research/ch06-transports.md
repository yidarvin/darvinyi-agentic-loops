# Transports: How MCP Messages Move Between Client and Server

Research reference for *Agentic Loops*, Chapter 6. Current as of 2026. The reader has already learned the MCP wire protocol foundation (Chapter 5); this chapter focuses only on transports. Version numbers and spec dates drift fast; version-pin at build time.

## TL;DR
- MCP cleanly separates the **protocol layer** (JSON-RPC messages, negotiation, primitives) from the **transport layer** (how bytes move). As of mid-2026 the spec defines exactly two standard transports — **stdio** for local subprocess integrations and **Streamable HTTP** for everything remote or multi-client — while the original **HTTP+SSE** transport (2024-11-05) is deprecated.
- **stdio** launches the server as a child process and exchanges newline-delimited JSON over stdin/stdout with sub-millisecond latency but is single-client and doesn't scale (Stacklok's Kubernetes benchmark: for stdio "out of 50 requests, only 2 succeeded" at 20 concurrent connections). **Streamable HTTP** uses one endpoint that answers with either a JSON body or an upgraded SSE stream, works with standard HTTP infrastructure, and delivered "290-300 requests per second with shared sessions versus only 30-36 requests per second with unique sessions."
- Current stable spec is **2025-11-25** (session via `Mcp-Session-Id`); the **2026-07-28 release candidate** (locked May 21 2026, final July 28 2026) removes the initialize handshake and session header entirely so "any MCP request can land on any server instance" — the biggest transport change since launch.

## The role of the transport layer
MCP is layered. Protocol layer: JSON-RPC 2.0 encoding, the initialize/initialized handshake, capability negotiation, primitives. Transport layer: one job — move UTF-8 JSON-RPC bytes bidirectionally. Spec: "The protocol is transport-agnostic and can be implemented over any communication channel that supports bidirectional message exchange," and custom transports "MUST ensure they preserve the JSON-RPC message format and lifecycle requirements."

This buys portability (a TS client calls a Python server; one server binary serves a laptop over stdio and a fleet over HTTP), separation of concerns (server authors write tool logic, not sockets), and evolvability (the protocol swapped its remote transport once and is about to change its session model without touching primitives).

SDK abstraction (TypeScript):
```typescript
interface Transport {
  start(): Promise<void>;
  send(message: JSONRPCMessage): Promise<void>;
  close(): Promise<void>;
  onclose?: () => void;
  onerror?: (error: Error) => void;
  onmessage?: (message: JSONRPCMessage) => void;
}
```
Every concrete transport (`StdioServerTransport`, `StreamableHTTPServerTransport`, deprecated `SSEServerTransport`) implements this. Python transports are async context managers yielding a `(read_stream, write_stream)` pair (the spec advises `anyio` over `asyncio` for compatibility). Spec preference: **"Clients SHOULD support stdio whenever possible."**

## The stdio transport
**Mechanics** (2025-11-25): client launches the server as a subprocess; server reads JSON-RPC from stdin, writes to stdout; "Messages are delimited by newlines, and MUST NOT contain embedded newlines"; server MAY write UTF-8 to stderr for logging and the client "SHOULD NOT assume stderr output indicates error conditions"; "The server MUST NOT write anything to its stdout that is not a valid MCP message."

Most common production bug: **stdout contamination** (a stray `print()`, library banner, uncaught traceback, or stdout-routed log) corrupts a message or hangs the client. Related: **buffering** — flush stdout after each message. Both are why the spec authors recommend the SDK transport over hand-rolled framing.

**Process lifecycle** (client owns it): recommended shutdown is (1) close stdin, (2) wait or `SIGTERM` after a reasonable time, (3) `SIGKILL` if still alive. Closing stdin first lets well-behaved servers detect EOF and exit cleanly. Real clients get this wrong: a Claude Code issue kills the process before closing the client (firing `onclose`, mislabeling a clean exit as failed); VS Code has an open "does not follow spec" issue; Codex has leaked stdio subprocesses when session shutdown never drains the client (fix: process groups to kill the subtree).

**When right:** local file/shell/DB tools; desktop apps spawning `npx @modelcontextprotocol/server-filesystem /path` or `uvx ...`; single-dev single-machine. Every client supports stdio; zero infra.

**Strengths:** process isolation, no network, no auth, no TLS, minimal code, lowest latency (sub-ms IPC; spawn is a one-time <100ms cost). **Limitations:** single client per subprocess; local only; **doesn't scale** (pipes aren't multiplexed, concurrent requests serialize, no load balancing). 50 devs × 8 servers = ~400 processes across 50 laptops, no central audit. Stacklok benchmark: stdio Basic Test at 20 concurrent — "out of 50 requests, only 2 succeeded, and over half never left the client" (0.64 req/sec, 20.01s avg round-trip).

**Python — stdio server (FastMCP):**
```python
from mcp.server.fastmcp import FastMCP
mcp = FastMCP("Demo")

@mcp.tool()
def add(a: int, b: int) -> int:
    """Add two integers."""
    return a + b

if __name__ == "__main__":
    mcp.run()  # stdio default; == mcp.run(transport="stdio")
```
**Python — stdio client:**
```python
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

server_params = StdioServerParameters(command="python", args=["example_server.py"], env=None)

async def run():
    async with stdio_client(server_params) as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()
            result = await session.call_tool("add", {"a": 2, "b": 5})
```
`StdioServerParameters` also exposes `cwd`, `encoding` (default utf-8), `encoding_error_handler` (default strict).

**TypeScript — stdio:**
```typescript
// Server
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
const transport = new StdioServerTransport();
await server.connect(transport);
// Client
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
const transport = new StdioClientTransport({
  command: "npx", args: ["-y", "@modelcontextprotocol/server-filesystem", "/home/user/projects"],
});
await client.connect(transport);
```

## The original HTTP+SSE transport (deprecated, 2024-11-05)
**How it worked** (spec required **two endpoints**): "An SSE endpoint, for clients to establish a connection and receive messages from the server; A regular HTTP POST endpoint for clients to send messages to the server." When a client connects, "the server MUST send an `endpoint` event containing a URI for the client to use for sending messages." By SDK convention `/sse` (GET, long-lived `text/event-stream`) and `/messages` (POST). Flow: client opens `GET /sse` → server sends `event: endpoint\ndata: /messages?sessionId=...` → every client message is `POST /messages?sessionId=...` returning **202 Accepted** with no body → the actual JSON-RPC response arrives asynchronously over the SSE stream as a `message` event.

**Why problematic:** two connections per logical session (correlated only by URL session ID); a mandatory long-lived connection with **no resumability** (drop = dead session); **stateful server required** (in-memory `sessionId→transport` map → sticky sessions for horizontal deployments, else "400: No transport found"); **serverless-hostile** (functions can't hold an SSE stream for a whole conversation); client friction (Claude Desktop couldn't consume an SSE URL directly, forcing a `mcp-remote` stdio bridge). Deprecated in 2025-03-26 for Streamable HTTP. Vendors are sunsetting it (Atlassian's Rovo `/v1/sse` "deprecated and will remain available for backward compatibility until 30 June 2026").

## The Streamable HTTP transport (2025-03-26, current)
**Single endpoint, two methods:** "The server MUST provide a single HTTP endpoint path... that supports both POST and GET methods," e.g. `https://example.com/mcp`.

**Client→server (POST):** every message is a new POST; client MUST send `Accept: application/json, text/event-stream`; body is a single JSON-RPC request/notification/response. If a **response or notification** and accepted → **202 Accepted, no body**. If a **request** → the server responds with **either** `Content-Type: application/json` (one object) **or** `Content-Type: text/event-stream` (an SSE stream); the client MUST support both. On an SSE stream the server SHOULD eventually deliver the response then terminate it, MAY first send progress; disconnection is **not** cancellation (send a `CancelledNotification`).

Wire (streaming mode):
```
POST /mcp HTTP/1.1
Content-Type: application/json
Accept: application/json, text/event-stream
Mcp-Session-Id: 1868a90c...
MCP-Protocol-Version: 2025-11-25

{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"search","arguments":{"q":"otters"}}}

HTTP/1.1 200 OK
Content-Type: text/event-stream

event: message
data: {"jsonrpc":"2.0","method":"notifications/progress","params":{...}}

event: message
data: {"jsonrpc":"2.0","id":2,"result":{...}}
```

**Server→client (GET):** client MAY `GET` the endpoint (`Accept: text/event-stream`) to open a standalone SSE stream for server-initiated messages; server MUST return `text/event-stream` or `405` (no server-initiated stream).

**Session management:** server MAY assign a session by returning `Mcp-Session-Id` on the `InitializeResult`; ID "SHOULD be globally unique and cryptographically secure" and visible ASCII. If assigned, the client MUST echo it on all later requests; a server requiring it SHOULD answer requests lacking it (except initialize) with 400. Server MAY terminate a session → 404 thereafter → client MUST re-initialize. Client SHOULD `DELETE` the endpoint (with the header) to end a session (server MAY respond 405 if disallowed).

**Protocol version header:** client MUST send `MCP-Protocol-Version` on all post-init requests; absent → server SHOULD assume 2025-03-26; unsupported → 400.

**Resumability:** servers MAY attach an `id` to SSE events (unique within the session); to resume after a drop the client SHOULD `GET` with `Last-Event-ID`; the server MAY replay messages that would have followed on *that* stream and MUST NOT replay from a different stream. Event IDs are a per-stream cursor — the capability the legacy transport never had.

**Why better:** one endpoint; standard HTTP infra (LBs, WAFs, CDNs, bearer auth) works unchanged; server can be stateless (JSON + close) or stateful (sessions + SSE + resumability); serverless-friendly; streaming only when needed.

**Python — Streamable HTTP (FastMCP):**
```python
from mcp.server.fastmcp import FastMCP
mcp = FastMCP("Stateless Server", host="127.0.0.1", port=8000)

@mcp.tool()
def add(a: int, b: int) -> int:
    return a + b

if __name__ == "__main__":
    # stateless_http=True disables Mcp-Session-Id; json_response=True returns plain JSON not SSE
    mcp.run(transport="streamable-http", stateless_http=True)  # endpoint: http://localhost:8000/mcp
```
```python
from mcp import ClientSession
from mcp.client.streamable_http import streamablehttp_client

async def main():
    async with streamablehttp_client("http://127.0.0.1:8000/mcp") as (read, write, get_session_id):
        async with ClientSession(read, write) as session:
            await session.initialize()
            result = await session.call_tool("add", {"a": 2, "b": 5})
```

**TypeScript — stateful (sessions).** `StreamableHTTPServerTransport` behavior set by `sessionIdGenerator` (function → stateful; `undefined` → stateless, no resumability); `enableJsonResponse: true` → plain JSON; `eventStore` → resumability; `enableDnsRebindingProtection`/`allowedHosts`/`allowedOrigins` → DNS-rebinding defense.
```typescript
transport = new StreamableHTTPServerTransport({
  sessionIdGenerator: () => randomUUID(),
  onsessioninitialized: (sid) => { transports[sid] = transport; },
  enableDnsRebindingProtection: true,
  allowedHosts: ["127.0.0.1"],
});
```
**TypeScript — stateless (horizontally scalable):**
```typescript
app.post("/mcp", async (req, res) => {
  const server = build();
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  res.on("close", () => { transport.close(); server.close(); });
  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
});
```

## Transport comparison and decision framework
The one axis that decides it: does *one client own the server process* (stdio) or do *many clients reach one server over a network* (Streamable HTTP)?

| Dimension | stdio | Streamable HTTP |
|---|---|---|
| Location | Local | Local or remote |
| Clients | One per subprocess | Many concurrent |
| Latency | Sub-ms IPC | +1 network round-trip |
| Scaling | None | Horizontal (esp. stateless) |
| Auth | Env vars only | Standard HTTP (bearer/OAuth/TLS) |
| Serverless | No | Yes |
| Audit | Per-host stderr only | Central ingress |

Decision: local tool/one client/desktop → **stdio** (spec default). Shared/hosted/multi-client → **Streamable HTTP**. Auth required → **Streamable HTTP** (no clean stdio path). Cloud/serverless → **Streamable HTTP**, ideally stateless. New remote build → **Streamable HTTP** (never author a new HTTP+SSE server). Watch the client's config schema: Claude Desktop's `claude_desktop_config.json` validates stdio entries only; a `url` field silently drops the whole `mcpServers` block (use the Connectors UI or `mcp-remote`). Migrating a stdio server to HTTP is typically a five-line patch.

**Scaling numbers** (Stacklok `yardstick` echo tool on a local kind cluster — trivial server, treat as upper bound): stdio 2/50 at 20 concurrent; SSE 100% at 20 concurrent but degrades under sustained load (29.87 req/sec, 564ms avg); Streamable HTTP held 100% and hit "290-300 requests per second with shared sessions versus only 30-36 requests per second with unique sessions" (the "10x performance difference" — session reuse is "fundamental to achieving production-scale performance"). Independent of transport, per-call MCP overhead is usually negligible against LLM inference (500ms–5s), so choice is driven by deployment topology, not raw latency.

## Security considerations specific to transports
**stdio:** trust boundary is *launching a subprocess* (arbitrary local code at user privilege — a core MCP criticism). Credentials flow through **environment variables** (spec: stdio servers pull secrets from the environment, not OAuth). In Claude Desktop these go in the `env` block; that file holds plaintext secrets — user-readable-only, never committed. Footguns: stdio servers inherit only a limited platform-dependent subset of the parent environment (the `env` block is the source of truth); variable scope is per-server (isolation is a feature); clients cache config so a restart is needed after edits; relying on `.env`/dotenv inside an installed server is fragile (client may spawn from a different cwd).

**HTTP-based (mandatory spec warning):** (1) **Validate the `Origin` header** to prevent DNS rebinding; invalid → 403. (2) **When local, bind only to `127.0.0.1`, not `0.0.0.0`.** (3) **Implement proper auth**; use TLS in production. TS SDK: `enableDnsRebindingProtection` + `allowedHosts`/`allowedOrigins`. Transport-adjacent attack classes (MCP security best-practices): **session hijacking** (bind session IDs to user context, `<user_id>:<session_id>`, cryptographically random, validate every request); **token passthrough** (a server MUST never accept a token not explicitly issued for it — breaks audience validation and audit); **confused deputy** (proxy servers with static client ID + dynamic registration → per-client consent). stdio has no transport-layer auth and no central interception point, so enterprises front stdio servers with an HTTP gateway (`mcp-proxy`).

## Practical implementation concerns
**Timeouts:** SHOULD set per-request timeouts; on timeout SHOULD send `CancelledNotification` and stop waiting; SDKs SHOULD allow per-request configuration. HTTP: closing the connection is the shutdown signal.

**Reconnection/resumability:** only Streamable HTTP defines it — attach SSE event IDs, reconnect via `Last-Event-ID` on a GET to replay that stream. Requires a server **event store** (TS `eventStore`, e.g. Cloudflare `DurableObjectEventStore`); skip it and reconnecting clients silently lose in-flight messages. Subtle multi-instance failure: the SDK opens a *background* long-lived `GET /mcp` SSE stream that can hash to a different pod than the session's, returning 404; POSTs still get 202 but drain into a dead channel and the client hangs. Usual patch: LB stickiness on `Mcp-Session-Id`.

**Stateless vs stateful (Streamable HTTP):** stateless (`sessionIdGenerator: undefined` / `stateless_http=True`) is simplest and scales horizontally with no shared store but forgoes resumability and server-push. Stateful adds sessions/resumability/notifications but needs sticky routing or an external session store (Redis/DynamoDB/Postgres). Guidance: **start stateless; add sessions only for a feature that needs them.**

**Serverless:** Streamable HTTP made serverless MCP viable. AWS Lambda + API Gateway: stateless (`json_response=True`), persist cross-call state in DynamoDB, auth via bearer/Cognito/OAuth (Node Lambda supports HTTP response streaming since April 2025, so SSE-mode is possible). Cloudflare Workers' Agents SDK ships an `McpAgent` handling Streamable HTTP + session state, with Durable Objects for stateful/resumable. Caveats: runtime limits (Workers 30s CPU / 128MB, no long-lived connections) — long work returns a handle and is polled.

**How 2026-07-28 changes transports** (per lead maintainers Soria Parra and Delimarsky, MCP Blog May 21 2026 — "the largest revision of the protocol since launch"): makes MCP **stateless at the protocol layer**. SEP-2575 removes the initialize/initialized handshake; SEP-2567 removes `Mcp-Session-Id`/session — "with both gone, any MCP request can land on any server instance, and the sticky routing and shared session stores that horizontal deployments needed before are no longer required at the protocol layer." Every request carries its own version/client-info/capabilities in a `_meta` object (keys like `io.modelcontextprotocol/clientInfo`); a new `server/discover` RPC (servers MUST implement) advertises capabilities on demand. SEP-2243 adds required routing headers `Mcp-Method` (every request) and `Mcp-Name` (on tools/call, resources/read, prompts/get) so LBs route without parsing the body. SEP-2549 adds `ttlMs`/`cacheScope` cache metadata. Server-initiated calls (sampling, elicitation) move to the connection-free Multi-Round-Trip Request pattern (SEP-2322): server returns `InputRequiredResult` with an opaque `requestState`, client re-issues with `inputResponses` — no long-lived SSE GET.

**Migration reality:** "stateless protocol" ≠ "stateless application." State moves to **explicit handles** — a tool mints a `basket_id`/`job_id`, returns it, the model passes it back as a normal argument, the server persists real state in Redis/Postgres. This works *today* on 2025-11-25 and survives the upgrade. Roots, Sampling, Logging are **deprecated** (not removed) under a 12-month-minimum policy (SEP-2596); `tasks/list` is removed; "resource not found" moves from −32002 to −32602. Beta SDKs already speak 2026-07-28: Python v2 answers both revisions from one endpoint, C# preview defaults stateless; TS v2 and Go require an explicit opt-in to serve the new revision (`Stateless = true` in the Go options); new-spec clients fall back to the handshake when they reach a 2025-11-25 server.

## Recommendations
1. **Default local integrations to stdio:** least code, lowest latency, no auth surface. Log only to stderr, flush stdout after every message, use the SDK transport. Reconsider when you need a second concurrent client or remote access.
2. **Default all remote/multi-client/production to Streamable HTTP, start stateless** (`sessionIdGenerator: undefined` / `stateless_http=True`). Add sessions, an `eventStore`, and resumability only for a concrete need (server-push, resumable streams). Given the ~10x gap, pool sessions aggressively before scaling hardware.
3. **Never build a new HTTP+SSE (2024-11-05) server** — only as a backward-compat shim for a pre-March-2025 client, sunset on a published date.
4. **Harden HTTP transports day one:** validate `Origin` (403 on mismatch), bind local to 127.0.0.1, require auth, enforce TLS, use cryptographically random session IDs bound to identity, never accept a token not issued for your server, enable `enableDnsRebindingProtection` for any localhost HTTP server.
5. **Get stdio shutdown right:** close stdin, then SIGTERM after grace, then SIGKILL; use process groups to avoid orphaned subtrees.
6. **Prepare for 2026-07-28 without a hot cutover:** adopt the explicit-handle state pattern now, keep LB stickiness as a temporary bridge, plan to emit `Mcp-Method`/`Mcp-Name` and `ttlMs`/`cacheScope`, implement `server/discover`, read version/capabilities from `_meta`. The 12-month deprecation window means nothing breaks on July 28. Read the auth SEPs (esp. `iss` validation per RFC 9207, SEP-2468) sooner.

## Caveats
- Version flux: current *finalized* spec is 2025-11-25; 2026-07-28 is a **release candidate**, specifics may change before July 28 2026, and no Tier-1 SDK had *stable* statelessness support in the RC window.
- Benchmark provenance: the headline scaling numbers are Stacklok's test of a trivial echo tool on a *local* kind cluster; real servers benchmark slower and "100% success" means 100% of requests actually *sent*. Directional. Some corroborating pages (ChatForest) disclose they were AI-written aggregators of the same source, not independent confirmation.
- Path conventions vs spec: `/sse`, `/messages`, `?sessionId=` for the legacy transport are SDK conventions, not spec mandates (2024-11-05 only requires "a URI" in the `endpoint` event). `/mcp` is an example, not required.
- SDK-specific behavior: session/stateless semantics, `enableJsonResponse`, `eventStore`, DNS-rebinding options are TS-SDK APIs; Python (FastMCP) exposes equivalents (`stateless_http`, `json_response`). `_meta` keys, `server/discover`, `Mcp-Method`/`Mcp-Name` are 2026-07-28 constructs, not honored by 2025-11-25 servers.
- Vendor deprecation dates (e.g. Atlassian Rovo `/v1/sse` after 30 June 2026) are vendor-specific, not protocol deadlines.