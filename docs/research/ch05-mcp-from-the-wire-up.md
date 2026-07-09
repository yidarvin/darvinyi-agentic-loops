# MCP from the Wire Up

Research reference for *Agentic Loops*, Chapter 5 (opens Part II). Current as of 2026. Version numbers, spec dates, and ecosystem figures drift fast; version-pin at build time. This chapter is the protocol foundation — transports, the three primitives in depth, building servers, and security are deliberately kept brief here and covered in chapters 6–9.

## TL;DR
- MCP is a JSON-RPC 2.0-based, stateful, capability-negotiated protocol that collapses the M×N integration problem (M models/agents × N tools/data sources) into M+N by defining one shared contract. Announced by Anthropic on November 25, 2024, donated to the Linux Foundation's Agentic AI Foundation on December 9, 2025. Per that announcement: "97M+ monthly SDK downloads across Python and TypeScript" and "more than 10,000 active public MCP servers."
- The wire protocol is small and knowable: three JSON-RPC message shapes (requests with an `id`, responses echoing that `id`, id-less notifications), a mandatory `initialize`/`initialized` handshake negotiating a date-stamped protocol version and capabilities object, and namespaced methods (`tools/list`, `tools/call`, `resources/read`, `prompts/get`).
- Version matters in 2026: stable spec is `2025-11-25`; the `2026-07-28` release candidate (locked May 21 2026, final July 28 2026) is a breaking "MCP 2.0" that removes the handshake and session and makes the protocol stateless. Build on `2025-11-25` today; track the RC migration deliberately.

## What MCP is and why it exists
Created at Anthropic by David Soria Parra and Justin Spahr-Summers (development began summer 2024 to give Claude Desktop easier access to local data), open-sourced November 25 2024 with the `2024-11-05` spec plus Python/TS SDKs. Solves the **M×N integration problem**: M AI apps × N tools naively needs up to M×N bespoke integrations; MCP collapses this to **M+N** — every app implements the client contract once, every tool the server contract once, any compliant pair interoperates.

Two analogies (both useful, both limited): **"USB-C for AI"** (Benj Edwards, Ars Technica, April 1 2025 — universal adapter; limit: USB-C is vendor-neutral, MCP launched single-vendor until the LF donation); **LSP** (Microsoft's Language Server Protocol standardized M editors × N languages → M+N; MCP applies the same pattern to LLMs and tools). Also shares DNA with OpenAPI.

Governance/adoption: one of the steepest infra-protocol curves. Downloads ~100K (Nov 2024) → 8M (April 2025); OpenAI's March 2025 adoption pushed ~8M→22M within weeks; Google (Gemini) confirmed April 2025; Microsoft/AWS followed. Per Anthropic (Dec 9 2025) "97M+ monthly SDK downloads" (97M recorded late March 2026) and "10,000+ active public MCP servers." On **December 9 2025** Anthropic donated MCP to the **Agentic AI Foundation (AAIF)**, a Linux Foundation directed fund co-founded by Anthropic, Block, OpenAI (platinum: AWS, Bloomberg, Cloudflare, Google, Microsoft). MCP joined Block's goose and OpenAI's AGENTS.md as founding projects; maintainers keep technical autonomy via the SEP process. First MCP Dev Summit NA: April 2–3 2026, NYC.

## The JSON-RPC 2.0 foundation
**All messages MUST follow JSON-RPC 2.0** — this is the architecture, not a detail. Transport-agnostic, which is why the same server talks to a local IDE over stdio and a remote service over HTTP without changing message logic.

Three message types:
- **Requests** (initiate, expect response): `{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{...}}`. MCP tightens the base spec: `id` MUST be a string or integer, MUST NOT be null, MUST NOT be reused within the session.
- **Responses** (echo `id`, carry exactly one of `result`/`error`): `{"jsonrpc":"2.0","id":1,"result":{...}}`.
- **Notifications** (one-way, no `id`, no response): `{"jsonrpc":"2.0","method":"notifications/initialized"}`. Used for lifecycle and dynamic updates (`notifications/tools/list_changed`, `notifications/resources/updated`, progress, cancellation).

Method naming is case-sensitive, forward-slash namespaced. Common errors: wrong casing, missing namespace.

**Framing** is the transport's job. stdio: newline-delimited JSON, no embedded newlines, nothing on stdout that isn't a valid message (stderr for logs). Interop hazard: some implementations use `Content-Length` header framing (LSP heritage) instead, causing silent failures. Streamable HTTP: each client→server message is an HTTP POST with `Accept: application/json, text/event-stream`; an accepted response/notification returns `202 Accepted` with no body.

**Batching** is version-specific: `2024-11-05` allowed it; `2025-03-26` required receiving batches; `2025-06-18` **removed JSON-RPC batching entirely** (PR #416). Treat batching as dead in MCP.

**Error codes** (inherited from JSON-RPC): −32700 parse error, −32600 invalid request, −32601 method not found, −32602 invalid params (also unsupported protocol version, and from the 2026 RC, missing resources), −32603 internal error. Range −32000..−32099 reserved for server-defined errors.

**Critical MCP distinction: protocol errors vs tool-execution errors.** A malformed request or unknown tool → JSON-RPC `error` object. But a tool that *runs* and fails → a successful `result` with `"isError":true` and the failure in the `content` array. Deliberate: lets the LLM see the failure and self-correct rather than treating it as a transport fault.

## Architecture: hosts, clients, servers
Client-host-server; stateful session protocol.
- **Host** — the LLM app (Claude Desktop, IDE, custom agent). Container and coordinator: creates/manages clients, controls permissions and lifecycle, enforces security/consent, handles authorization, coordinates LLM/sampling, aggregates context.
- **Client** — the connector inside the host; each maintains an isolated, **1:1 stateful session with exactly one server**; handles negotiation, routes messages, manages subscriptions.
- **Server** — exposes capabilities (tools, resources, prompts); local (stdio) or remote (HTTP). A host with three clients connects to three servers, one session each.

**Trust boundaries** (design principles): servers should be easy to build and highly composable; **servers should not read the whole conversation or see into other servers** — each gets only what it needs, full history stays with the host, connections are isolated, the host enforces the boundary. This is why consent and policy live at the host, not the server, and why 2025–2026 security work concentrates on prompt-injection via poisoned tool descriptions and confused-deputy/token-passthrough (the security chapter goes deep).

## The connection lifecycle
Three phases: Initialization, Operation, Shutdown.

**Initialization MUST be first.** Client → `initialize` request (protocolVersion, capabilities, clientInfo):
```json
{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{"roots":{"listChanged":true},"sampling":{},"elicitation":{}},"clientInfo":{"name":"ExampleClient","version":"1.0.0"}}}
```
Server → responds with its version, capabilities, serverInfo (plus optional `instructions`, a natural-language manual for the LLM). Client → `notifications/initialized` (no id). Before the server responds to `initialize`, the client SHOULD send only pings; before `initialized`, the server SHOULD send only pings and logging.

**Operation:** both MUST respect the negotiated version and only use negotiated capabilities (`2025-06-18` strengthened this to MUST).

**Shutdown:** no shutdown messages; the transport signals termination. stdio: client closes server stdin → SIGTERM → SIGKILL; server MAY close stdout and exit. HTTP: close the connection(s).

**Timeouts:** SHOULD set per-request timeouts, SHOULD issue cancellation on expiry; progress notifications MAY reset but a max timeout SHOULD always hold.

## Capabilities and feature negotiation
Declared as a nested object in `initialize`; presence of a key advertises a feature, nested keys advertise sub-capabilities. Features not advertised must not be used — the mechanism for graceful degradation and version tolerance.

Server-side: `tools`, `resources`, `prompts`, `logging`, `completions`, `experimental`. Client-side: `sampling` (service server-initiated LLM completions via `sampling/createMessage`, enabling recursive/agentic server workflows), `roots` (provide filesystem roots), `elicitation` (service server requests for user input mid-session), `experimental`.

Optional sub-capabilities: `listChanged` (on tools/resources/prompts — server emits `notifications/*/list_changed` on change); `subscribe` (resources only — client subscribes to individual resource changes).

## The protocol version scheme
Date-based `YYYY-MM-DD`, where the date marks the last backwards-incompatible change. Negotiated in `initialize`; schema is TypeScript-first in `schema.ts`, exported as JSON Schema.

**Negotiation:** client sends its latest supported version; server echoes if supported, else counter-offers its latest; client disconnects if it can't accept. Over HTTP, the negotiated version goes in an `MCP-Protocol-Version` header on all later requests; if absent and uninferable, servers SHOULD assume `2025-03-26`. Rough edges: undefined behavior when header and `initialize` version disagree (issue #2721); some servers hard-reject unknown versions with HTTP 400 instead of negotiating down (real Graylog bug). Robust clients handle both a negotiated-down version and a structured mismatch error.

**Version history (map; chs 6/9 go deep):**
- `2024-11-05` — initial. stdio + HTTP+SSE transports; no standardized auth; batching allowed.
- `2025-03-26` — OAuth 2.1 authorization framework (PR #133); replaced HTTP+SSE with **Streamable HTTP** (PR #206); tool annotations (PR #185); audio content; `completions` capability; mandatory-to-receive batching.
- `2025-06-18` — **removed batching** (PR #416); **structured tool output** (`structuredContent`, PR #371); servers as OAuth Resource Servers (PR #338) + RFC 8707 Resource Indicators (PR #734); **elicitation** (PR #382); resource links in tool results (PR #603); required `MCP-Protocol-Version` header over HTTP (PR #548); `title` fields; `context` on completion requests.
- `2025-11-25` (stable; one-year anniversary) — experimental **Tasks** (durable requests with polling/deferred retrieval, SEP-1686); **icons** metadata (SEP-973); OIDC Discovery 1.0 (PR #797); OAuth Client ID Metadata Documents (SEP-991); tool calling in sampling via `tools`/`toolChoice` (SEP-1577); URL-mode elicitation (SEP-1036). Dynamic Client Registration became optional/deprecated. "This release is backward compatible."
- `2026-07-28` (RC, locked May 21 2026, final July 28 2026) — informally "MCP 2.0." Makes the protocol **stateless**: removes the `initialize`/`initialized` handshake (SEP-2575) and `Mcp-Session-Id`/session (SEP-2567), moving version/client-info/capabilities into per-request `_meta`, adding `server/discover`. Formalizes the **Extensions framework** (reverse-DNS IDs, independent versioning, SEP-2133); demotes Tasks and MCP Apps to extensions; hardens auth (RFC 9207 `iss` via SEP-2468, OIDC `application_type` via SEP-837); lifts tool schemas to full **JSON Schema 2020-12** (SEP-2106); **deprecates Roots, Sampling, Logging** (SEP-2577, 12-month policy); changes missing-resource error from −32002 to −32602 (SEP-2164).

**Tasks aside** (most consequential `2025-11-25` addition, reshaped in the RC): in `2025-11-25`, Tasks are "durable state machines" for polling and deferred result retrieval, "currently experimental." A request gains a `task` field; receiver returns `CreateTaskResult` immediately; requestor polls `tasks/get`, retrieves `tasks/result`, enumerates `tasks/list`, cancels `tasks/cancel`. States include `working`, `input_required`, `completed`, `failed`, `cancelled`. In the RC, Tasks becomes an extension, the lifecycle is reshaped (`tasks/get`, `tasks/update`, `tasks/cancel`), and **`tasks/list` is removed** ("can't be scoped safely without sessions") — anyone who shipped against experimental `2025-11-25` Tasks must migrate.

**Backward compatibility:** per-session, capability-gated. Older client + newer server (or vice versa) interoperate if they share a negotiable version. A well-behaved server keeps `["2025-11-25","2025-06-18","2025-03-26","2024-11-05"]` and negotiates down.

## A concrete end-to-end trace (stdio, 2025-06-18)
1. C→S initialize: `{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{"sampling":{}},"clientInfo":{"name":"demo-client","version":"1.0.0"}}}`
2. S→C result: `{"jsonrpc":"2.0","id":1,"result":{"protocolVersion":"2025-06-18","capabilities":{"tools":{"listChanged":true}},"serverInfo":{"name":"weather-server","version":"2.1.0"}}}`
3. C→S initialized (no id): `{"jsonrpc":"2.0","method":"notifications/initialized"}`
4. C→S list tools: `{"jsonrpc":"2.0","id":2,"method":"tools/list"}`
5. S→C tool list (each tool: `name`, `description`, JSON-Schema `inputSchema`, optional `outputSchema`): `{"jsonrpc":"2.0","id":2,"result":{"tools":[{"name":"get_weather","title":"Weather Lookup","description":"Get current weather for a city","inputSchema":{"type":"object","properties":{"city":{"type":"string"}},"required":["city"]},"outputSchema":{"type":"object","properties":{"temperature":{"type":"number"},"conditions":{"type":"string"}},"required":["temperature","conditions"]}}]}}`
6. C→S call: `{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"get_weather","arguments":{"city":"London"}}}`
7. S→C result (human-readable `content` + machine-readable `structuredContent` conforming to `outputSchema`; for backwards compat a structured result SHOULD also serialize into a TextContent block): `{"jsonrpc":"2.0","id":3,"result":{"content":[{"type":"text","text":"{\"temperature\":12.5,\"conditions\":\"Overcast\"}"}],"structuredContent":{"temperature":12.5,"conditions":"Overcast"},"isError":false}}`

Negotiate → discover → invoke → return. Everything an agent does with MCP is a variation on it. Field gotcha: strict clients cache the `outputSchema` validator at `tools/list` and validate `structuredContent` on every result, so an `isError:true` result whose `structuredContent` carries an error envelope can spuriously fail (−32602 "Failed to validate structured content"). Keep error and success results schema-compatible.

## SDKs and the wire protocol
Official SDKs (now under AAIF, contributions from Anthropic, Google, JetBrains, Microsoft, Spring): Python, TypeScript, Go, Java, Kotlin, C#, Rust, Swift, Ruby. Graded by an **SDK Tiering System** (SEP-1730): Tier 1 = full protocol incl. all non-experimental features + optional capabilities (sampling, elicitation), conformance-validated; Tier 2 = core + roadmap; Tier 3 = early/specialized. Scored by an automated `tier-check` tool; demotion if conformance tests fail continuously for 4 weeks. TypeScript and Python are the reference implementations.

Two abstraction layers (explicit in Python):
- **Low-level `Server`** maps 1:1 to the wire: `@server.list_tools()`, `@server.call_tool()`, hand-written JSON-Schema dicts, return typed content blocks, wire up transport boilerplate. Right for custom transports, unusual handlers, or implementing the protocol.
- **FastMCP** (incorporated into the official Python SDK as "FastMCP 1.0"; standalone 2.x/3.x continues — per the PrefectHQ/fastmcp README as of April 2026, "downloaded a million times a day," powering "70% of MCP servers across all languages") derives the wire format from code:
```python
from fastmcp import FastMCP
mcp = FastMCP("weather-server")

@mcp.tool
def get_weather(city: str) -> dict:
    """Get current weather for a city."""
    return {"temperature": 12.5, "conditions": "Overcast"}

if __name__ == "__main__":
    mcp.run()   # stdio by default; mcp.run(transport="http", ...) for remote
```
Function name → tool `name`; docstring → `description`; type-annotated params → JSON-Schema `inputSchema` (via Pydantic); return value → serialized `content` + `structuredContent`. TypeScript's `McpServer` mirrors this. Trade-off: visibility — FastMCP is a black box, so wire-level breakage means dropping to the low-level API or reading raw messages. (The layering is somewhat leaky: FastMCP wraps an internal `_mcp_server` and new spec features often need changes in both.)

When you need the wire: debugging connection/method-not-found/version-mismatch failures; building a custom client, host, or transport; implementing MCP in a language without a mature SDK; reasoning about security and trust boundaries. The SDK handles the common case otherwise.

## Recommendations
1. **Build on `2025-11-25` today; not on `2024-11-05`.** Current stable, backward compatible, carries production features (async Tasks, modern OAuth, URL-mode elicitation). Reserve `2024-11-05` only for fallback in negotiation lists.
2. **Open a `2026-07-28` migration branch now only if** you operate remote HTTP servers, run custom clients, use OAuth/OIDC, or shipped against experimental Tasks. The stateless rework removes the handshake/session; local stdio servers barely notice, multi-tenant remote deployments need real changes. Trigger: the July 28 2026 final release and your Tier-1 SDK shipping support.
3. **Instrument at the message level.** Log every JSON-RPC message both directions in development; most integration failures are mundane (missing/duplicated `id`, wrong `protocolVersion`, unnamespaced methods, responding to a notification).
4. **Keep `inputSchema`/`outputSchema` shallow and make error results schema-compatible with success results.** Deep schemas inflate tokens and trip validators; incompatible error envelopes cause spurious −32602.
5. **Treat the host as the trust boundary in design reviews.** Put consent, tool-exposure whitelisting, and policy at the host/gateway layer. A widely-referenced benchmark found tool schemas alone can consume ~72% of an agent's context when many servers are attached, making selective exposure a practical necessity.

## Caveats
- Version flux is real. Stable is `2025-11-25`; `2026-07-28` is a locked RC, not final — any RC statement ("removes the handshake," "Tasks becomes an extension") may change before July 28 2026, and SDKs adopt at their own pace.
- Ecosystem figures are directional. "97M+ downloads" and "10,000+ servers" are from Anthropic's own Dec 2025 announcement; independent trackers diverge (Nerq census Q1 2026 indexed 17,468 servers, only 12.9% "high trust"; PulseMCP 5,500+; official registry ~2,000). Order of magnitude solid, precise totals approximate.
- Two commonly-conflated points: OAuth client-credentials/M2M (SEP-1046) shipped as an official *authorization extension*, not a core `2025-11-25` change; general `.well-known` server-capability discovery ("Server Cards," SEP-1649/2127) did NOT land in `2025-11-25` (only OAuth-related `.well-known` discovery did). `server/discover` is a `2026-07-28` RC feature.
- This chapter stops at the protocol foundation; transports, primitives in depth, building production servers, and the security threat model are the following chapters.