# Building a Real MCP Server

Research reference for *Agentic Loops*, Chapter 8 (hands-on capstone of the MCP arc, closes Part II). Current as of July 2026. The reader has already learned the wire protocol (Ch 5), transports (Ch 6), and the three primitives (Ch 7); this chapter focuses on the engineering of a real server. Version-gated behavior and ecosystem stats drift fast; version-pin and re-verify at build time.

## TL;DR
- Build production Python MCP servers with **FastMCP** (Jeremiah Lowin's standalone framework, folded into the official SDK as v1.0; the standalone v3.x is the production choice); use the official **TypeScript SDK** for Node/edge runtimes like Cloudflare Workers. Use **uv** for Python, **npm/npx** for TS. Core principle: the tool surface is a UI for a non-deterministic agent, not a REST API — design for intent, not endpoint coverage.
- Mid-migration: **2025-11-25 is current stable**; the **2026-07-28 RC** (locked May 21 2026, final July 28 2026) makes the base protocol **stateless** (no handshake, no `Mcp-Session-Id`), so the explicit-handle pattern (tools mint/accept opaque IDs backed by Redis/Postgres) is now the correct way to carry state. Build stateless today.
- Security is the hard part: enforce **OAuth 2.1 + PKCE (S256)** for remote servers, validate the **`aud` claim** on every token, **never pass client tokens through to downstream APIs** (confused-deputy trap), sandbox anything that executes code or touches the filesystem, and mask internal error details. Test with the in-memory `Client` and the **MCP Inspector**; publish to the **official MCP Registry**.

## Anatomy of a production project
**SDK choice.** Python → **FastMCP** (`uv add fastmcp`, Python ≥3.10). FastMCP 1.0 is inside the official `mcp` package (`mcp.server.fastmcp.FastMCP`, a pinned older version — fine for simple servers); standalone `fastmcp` v3.x (released Jan 19 2026, reorganized around Components/Providers/Transforms, adds component versioning, granular auth, OpenTelemetry) is the production choice. TS → official `@modelcontextprotocol/sdk` v1.x (implements 2025-11-25) with `McpServer` + `registerTool()` + Zod; a v2 SDK is in beta for 2026-07-28 but **v1.x is the supported production line** (fixes for ≥6 months after v2). Choose TS for Node/edge or end-to-end type safety; Python/FastMCP for fastest iteration, data/ML, and stdio. The low-level TS `Server` (`setRequestHandler`) is for custom-protocol needs; most code uses `McpServer`.

**Dependency management.** **uv** replaces pip/venv/poetry, resolves 10–100× faster, and `uvx` runs a published server ephemerally (Python's `npx`). `pyproject.toml` + `uv.lock` are the sources of truth; venv `.venv`; gitignore `.env`. Footgun: `mcp install` may write a Claude Desktop config omitting deps (`No module named requests`) — launch with `uv --directory /path run server.py` or add `--with` packages.

**src-layout:**
```
my-mcp-server/
├── src/my_server/
│   ├── server.py        # FastMCP() instance + lifespan
│   ├── tools/           # grouped by domain
│   ├── resources/       # resource + template handlers
│   ├── prompts/
│   ├── clients/         # downstream API/db adapters
│   └── config.py        # Pydantic Settings, env-validated
├── tests/               # in-memory Client tests + integration
├── pyproject.toml
├── uv.lock
├── server.json          # MCP Registry manifest
└── README.md
```

**FastMCP essentials:**
```python
from fastmcp import FastMCP
mcp = FastMCP("Acme Ops 🚀")

@mcp.tool
def add(a: int, b: int) -> int:
    """Add two numbers."""
    return a + b

if __name__ == "__main__":
    mcp.run()  # stdio default; mcp.run(transport="streamable-http", host, port) for remote
```
FastMCP 3 adds hot reload (`fastmcp dev server.py`), keeps decorated functions callable as plain Python (easy unit testing), and auto-dispatches sync tools to a threadpool so a slow calc won't block the loop.

## Designing the tool surface ("agent experience")
**Intent, not endpoints.** The dominant anti-pattern (Anthropic; Lowin's "Stop Converting Your REST APIs to MCP"; arXiv:2507.16044) is 1:1 REST wrapping. That empirical study of 116 official servers found **88.6% are REST-backed, 92% implement tools as bare API wrappers**, yet good servers are selective: "MCP servers expose a median of 19% of available operations." Great servers are *intent contracts* ("register a customer and initialize billing"), not *service contracts* ("POST /users").

**Granularity/count.** Reliability degrades well before the list gets long — the mechanism is **context rot** (recall drops as the window fills; per Anthropic's *Effective context engineering*, "as the number of tokens in the context window increases, the model's ability to accurately recall information from that context decreases… across all models"). Target ~8–20 well-named tools. Anti-patterns: **Tool Explosion** (>25 tools paralyze selection) and **Atomic Obsession / Token Arson** (`get_user`→`get_orders`→`get_line_items` where one intent tool suffices; each call is a full expensive reasoning round trip).

**Inputs.** Pydantic (Py) / Zod (TS); sensible defaults, enums, constraints. FastMCP generates JSON Schema from type hints. Apply **Parameter Coercion** (accept `"2024-01-15"`, `"yesterday"`, normalize internally). Avoid deep nesting and `*args`/`**kwargs` (unsupported — FastMCP needs a complete schema).

**Descriptions are the interface.** The description is what the agent reads to select/shape a call. Most important info first, verb+resource structure, operational metadata (pagination, auth prereqs, filtering) in the schema, behavioral (not developer-doc) language. Anthropic showed Claude-optimized descriptions beat human-written ones on held-out Slack/Asana sets.

**Results/context economy.** Structured, consistent shape; never dump huge payloads — paginate, filter, compress; return `ResourceLink`s or handles instead of inlining megabytes. Tool defs and results share the window with reasoning.

## Validation, error handling, robustness
**Protocol vs tool-execution errors.** Protocol errors (malformed JSON-RPC, unknown method) → SDK returns standard codes (−32601, −32602). Tool-execution errors → return a result with `isError: true` and a descriptive (non-stack-trace) message the LLM can recover from. Per spec, **output-schema validation is skipped for `isError: true`** (a real gateway bug, IBM ContextForge #4202, came from validating error envelopes).

**FastMCP error model.** A plain exception is logged and converted to an MCP error; `ToolError` sends its message to the client *regardless* of masking. Set `FastMCP(name, mask_error_details=True)` in production so unexpected exceptions become generic while `ToolError` still passes through — preventing internal-detail leakage. `ErrorHandlingMiddleware` maps exceptions to codes (`ValueError`→−32602).
```python
from fastmcp import FastMCP
from fastmcp.exceptions import ToolError
mcp = FastMCP("SecureServer", mask_error_details=True)

@mcp.tool
def query_database(sql: str) -> list:
    """Run a read-only SQL query."""
    if not sql.strip().upper().startswith("SELECT"):
        raise ToolError("Only SELECT queries are allowed.")  # visible to LLM
    return db.execute(sql)  # unexpected failure -> masked generic error
```
TS FastMCP: `UserError` is the client-visible analog; generic `Error` is internal, returned with `isError: true` without crashing the session.

**Timeouts/long ops.** FastMCP per-tool `timeout` (seconds) → client gets −32000 naming the tool on exceed. For truly long work, prefer progress reporting or the 2026-07-28 **Tasks** extension (create→poll→cancel; state in a backing store).

**Defensive programming.** Treat the LLM client as a chaos agent. Equixly's assessment found command injection in 43% of tested implementations, path traversal/arbitrary file read in 22%, SSRF in 30%. Validate everything; never `os.system`/raw eval; sandbox filesystem/query/exec tools.

**Observability.** MCP logging capability sends `ctx.debug/info/warning/error` to the client; structured logging server-side. **Critical stdio footgun: never write to stdout in a stdio server** — it corrupts JSON-RPC; log to stderr/files. FastMCP ships `LoggingMiddleware`, `StructuredLoggingMiddleware` (JSON), `TimingMiddleware`.

**MCP Inspector.** `npx @modelcontextprotocol/inspector` launches a web UI (default `http://localhost:6274`) to connect (stdio or Streamable HTTP), list/call tools, inspect schemas/logs. `fastmcp dev` wraps this; `fastmcp inspect` prints all registered components and their generated schemas — invaluable when a tool doesn't appear in a client.

## State, context, lifecycle
**Lifespan** (init expensive resources once):
```python
from contextlib import asynccontextmanager
@asynccontextmanager
async def lifespan(app):
    db = await connect_database()
    yield {"db": db}
    await db.close()
mcp = FastMCP("My Server", lifespan=lifespan)
```
Tools reach it via `ctx.request_context.lifespan_context["db"]`.

**Context object** (injected by `ctx: Context` annotation, excluded from schema): logging (`ctx.info`), progress (`ctx.report_progress(progress, total, message)`), resource reading (`ctx.read_resource`), sampling (`ctx.sample`), elicitation (`ctx.elicit`), session state (`ctx.set_state`/`get_state`). FastMCP uses `ContextVar`s so "current request" access works in ASGI/Lambda.

**Session vs stateless — connect to 2026-07-28.** In 2025-11-25, Streamable HTTP begins with `initialize`, the server mints `Mcp-Session-Id`, every later request carries it — pinning the client to one instance (classic failure: pod A mints the session, the SDK's long-lived SSE `GET /mcp` hashes to pod B → 404). The **2026-07-28 RC removes sessions** (SEP-2567; version/client-info/capabilities travel in `_meta` per request; new `Mcp-Method`/`Mcp-Name` routing headers). The correct pattern *today* is the **explicit handle**: a tool mints an opaque `basket_id`/`job_id`, returns it, later tools accept it as a normal argument, real state in Redis/Postgres/DynamoDB. Works on 2025-11-25 and survives the upgrade. Security (Backslash): handles must be **bound to a user identity** and **expire** — a bare handle lifted from a Jira ticket is otherwise a replay token.

## Authentication and security
**Posture reality.** 2026 scans: Censys found 12,520 internet-accessible MCP services (Apr 28 2026), ~40% unauthenticated; BlueRock's ~7,000-server scan reported 41% no auth, 53% of authenticated servers using static API keys, only 8.5% OAuth; Astrix's 5,200+-server audit found 88% require credentials but 53% use static keys/PATs and 79% pass keys via environment variables. Treat auth as a launch requirement.

**Model.** The June 2025 revision (kept in 2025-11-25) makes the **MCP server purely an OAuth 2.1 resource server**: validate tokens from an external AS (enterprise IdP), enforce RBAC internally, do not issue tokens. Local stdio servers skip OAuth and use env credentials.

**Required for remote (2025-11-25):**
- **OAuth 2.1 + PKCE `S256`** mandatory; implicit grant and `plain` PKCE banned.
- **RFC 9728 Protected Resource Metadata:** MUST implement; unauthenticated request → `401` with `WWW-Authenticate: Bearer resource_metadata="…/.well-known/oauth-protected-resource"`; PRM's `authorization_servers` points to the AS.
- **RFC 8707 Resource Indicators:** clients MUST send `resource` (canonical server URI) in authorization and token requests.
- **Audience validation:** servers MUST validate tokens were issued for them (`aud` per RFC 9068) and reject others. Missing `aud` validation is a replay vector.
- Insufficient scope at runtime → `403` with `WWW-Authenticate: Bearer error="insufficient_scope"`.

**Confused deputy & token passthrough.** Token passthrough (forwarding the client's token downstream) is **explicitly forbidden** — collapses trust boundaries, enables confused-deputy escalation, breaks audit trails and downstream audience checks. Correct: the client token authorizes only user→MCP-server; for downstream, the server acts as its own OAuth client and **exchanges** for a separately-scoped token (RFC 8693), never a single broad "God token." Spec: clients MUST NOT send tokens other than ones issued by the server's AS; servers MUST reject non-audience tokens.

**2026-07-28 auth hardening (six SEPs, per the RC announcement):** `iss` validation per RFC 9207 (SEP-2468); OIDC `application_type` in DCR (SEP-837, fixes AS rejecting localhost redirect URIs for a CLI/desktop client); binding credentials to the issuing AS `issuer` + re-registration on migration (SEP-2352); documented OIDC refresh-token requests (SEP-2207); scope-accumulation during step-up (SEP-2350); `.well-known` discovery suffix (SEP-2351). Adjacent (not one of the six): enterprise identity SEP-990 (ID-JAG / RFC 8693). **CIMD (Client ID Metadata Document, SEP-991)** — `client_id` *is* an HTTPS URL to a JSON metadata doc the AS fetches — is the preferred default client registration from 2025-11-25, DCR (RFC 7591) retained as fallback; CIMD carries SSRF risk (AS must block loopback/RFC-1918, HTTPS-only).

**FastMCP auth** ships providers (Google, GitHub, Azure, Auth0, WorkOS): `FastMCP("Secure", auth=GoogleProvider(...))`. Cloudflare offers `workers-oauth-provider`.

**Security checklist:** OAuth 2.1+PKCE(S256); validate `aud` exactly (scheme, no trailing slash); HTTPS only; per-tool scopes; never passthrough (exchange instead); exact redirect-URI matching; validate OAuth `state`; user-bound expiring handles; rate limit; secrets in a manager (never in tool args/logs); sandbox exec/fs tools; mask error details; log every action with the triggering user identity; treat any LLM-generated request as untrusted.

## Connecting to real systems (adapter pattern)
An MCP server is fundamentally an **adapter** between the agent and a system of record.
- **Existing API:** don't auto-generate 1:1 — curate/consolidate into intent tools; use `ToolTransform`s to rename/hide; strip response fields. FastMCP 3 reintroduced OpenAPI as a *Provider* "for responsible use" paired with Transforms.
- **Database:** expose *parameterized* query tools (SELECT-guarded); expose schemas as **resources** so the model reads structure before querying; parameter binding, read-only where possible, cap row counts.
- **Filesystem:** the official `@modelcontextprotocol/server-filesystem` model — allow-list dirs (args or dynamically via **Roots**), path sanitization, `openWorldHint: false`. AuthZed's incident (an agent read 340 files including `.env`/AWS keys) shows why boundaries are mandatory. Prefer Docker read-only bind mounts (`--mount type=bind,...,ro`).
- **External HTTP APIs:** `httpx.AsyncClient` from lifespan; map status codes to specific `ToolError`s (404/429/5xx). Guard SSRF — content-fetch tools taking a user-supplied URL are the most common SSRF/passthrough vector.
- **Downstream credentials:** the server holds its own or does token exchange; never reuse the inbound client token.

## Testing, packaging, deployment
**Testing.** FastMCP's killer feature is **in-memory transport** — pass the server instance directly to `Client(mcp)` (real protocol, no subprocess, ms tests):
```python
import pytest
from fastmcp import Client
from my_server.server import mcp

async def test_add():
    async with Client(mcp) as client:
        result = await client.call_tool("add", {"a": 5, "b": 3})
        assert result.content[0].text == "8"
```
Layer: (1) in-memory unit tests every save; (2) schema-validation tests in CI (catch contract drift that breaks LLM routing); (3) parameterized boundary tests; (4) integration tests (marked, secret-gated); (5) conformance via `npx @modelcontextprotocol/inspector --cli --method tools/list`. Use `result.content[0].text` (older `result[0].text` breaks on current FastMCP). Don't open `Client` inside a pytest fixture (event-loop issues). Lowin's "Stop Vibe-Testing Your MCP Server": LLM-based testing is stochastic/slow/expensive — write deterministic tests; use the Inspector for exploratory/manual, not regression.

**Packaging.** Python: `pyproject.toml`, `python -m build`, publish to PyPI, console-script entry point so users run `uvx your-server`. TS: publish to npm for `npx -y your-server`; `moduleResolution: NodeNext`. `.mcpb` (MCP Bundle) packages portable local servers.

**Deployment targets.**
- **Local stdio** (desktop clients): config in `claude_desktop_config.json`/`mcp.json` with `command: uv --directory … run` or `npx -y …`. Full host-user privilege — scrutinize like any local CLI.
- **Cloudflare Workers** (de-facto vendor pattern — Stripe, Linear, Asana, Sentry converged on Workers + OAuth 2.1 + audience binding + one-click Claude Desktop install): `npm create cloudflare@latest -- --template=cloudflare/ai/demos/remote-mcp-authless`, `npx wrangler deploy`; V8 runtime (no Node `fs`) so fetch over HTTPS; persist with KV/Durable Objects.
- **AWS Lambda:** FastMCP with `stateless_http=True, json_response=True` + `streamable-http` behind the **Lambda Web Adapter** and a Function URL; or TS with `middy-mcp`/`serverless-express`. Cold starts (~seconds) and the 15-min cap are the trade-offs; DynamoDB for state. AWS publishes stateless samples.
- **Containers/PaaS:** FastMCP as an ASGI app under Uvicorn/Gunicorn, nginx TLS, systemd — or Render/Fly. **Reverse-proxy must disable SSE buffering and raise timeouts** or Streamable HTTP silently breaks; run **stateless HTTP mode** behind LBs (in-memory sessions don't survive instance changes; many clients use `fetch` and drop cookies so sticky sessions are unreliable); production OAuth needs an explicit JWT signing key and persistent encrypted token storage.

**Config/env.** Validate with Pydantic Settings; secrets via env/secret manager; `wrangler secret put` on Workers.

**Versioning & registry.** SemVer; declare the protocol version you target; flip to `2026-07-28` only when your SDK ships support. Publish to the **official MCP Registry** (`registry.modelcontextprotocol.io`, preview Sept 8 2025; API frozen at v0.1 since Oct 24 2025) via the `mcp-publisher` CLI + `server.json` — a *metaregistry* (metadata only; code on npm/PyPI/Docker/GHCR/MCPB). Namespaces are reverse-DNS with ownership proven via GitHub auth (`io.github.<user>/*`); MCPB packages require a SHA-256 hash. Downstream directories (mcp.so, Smithery, Glama, PulseMCP) consume it.

## Real-world examples and patterns
**Reference servers** (`modelcontextprotocol/servers`, *educational* not production): **Everything** (exercises all primitives), **Fetch**, **Filesystem** (allow-listed dirs, Roots, hints), **Git**, **Memory** (knowledge-graph), **Sequential Thinking**, **Time**. **Prompts are rare** across the ecosystem; most servers are tools-only, some add resources.

**Production servers to learn from:** **GitHub's** `github/github-mcp-server` (Go, Docker/`ghcr.io`, PAT via env, a `--read-only`/`GITHUB_READ_ONLY=1` mode, name/title overrides so agents distinguish github.com vs Enterprise — a good multi-instance pattern); **Microsoft's** consolidated `microsoft/mcp` catalog; the Cloudflare-hosted vendor cluster.

**Worked example — "Support Analytics" server (adapter over Postgres + an internal ticketing API):**
- Resources: `schema://tickets`, `schema://customers` (read-only DDL); `report://{id}` templates.
- Tools (~8, intent-based): `search_tickets(query, status?, date_range?, limit=20)`; `get_ticket(ticket_id)`; `summarize_customer_issues(customer_id)` (consolidates 3 downstream calls — avoids Token Arson); `run_ticket_report(...)` → `job_id` (explicit handle, Redis) with `get_report_status(job_id)`; `create_followup(customer_id, note)` (write, `destructiveHint`, human confirm).
- Validation: Pydantic with enums for `status`, bounded `limit`, coerced `date_range`.
- Errors: `ToolError("customer 9182 not found")` (visible), DB exceptions masked; SELECT-guard on raw query.
- Lifespan: asyncpg pool + httpx client; ticketing API via the server's own service token (no passthrough), scoped per-user via token exchange.
- Auth: OAuth 2.1 resource server, `aud` validated, per-tool scopes (`tickets:read`, `tickets:write`).
- Context economy: `search_tickets` returns id/title/status/snippet, not full bodies; fetch detail on demand.
- Deploy: FastMCP `stateless_http=True` on Workers or Lambda; publish `server.json`.

**Anti-patterns (compounding):** under-specified schemas; auth retrofitted after launch; chatty atomic tools; "god tools" that fail in too many ways; omnibus parameter blobs; indiscriminate error envelopes; missing audit gates; developer-first (not agent-first) descriptions; raw strings/huge payloads; global mutable state instead of scoped/handle state.

## Recommendations (staged)
1. **Prototype (day 1):** `uv init`; `uv add fastmcp`; 3–5 intent tools with Pydantic inputs and good docstrings; `fastmcp dev` + Inspector; connect via `claude mcp add`. Benchmark: can the agent select and correctly call each tool from realistic prompts?
2. **Harden (week 1):** `mask_error_details=True` + `ToolError` messages; per-tool timeouts; structured logging (stderr only for stdio); in-memory pytest + schema tests in CI; lifespan for DB/HTTP; explicit-handle pattern for state. Benchmark: 100% of tools have deterministic tests; no stdout writes; no unbounded payloads.
3. **Secure for remote (week 2):** Streamable HTTP + `stateless_http=True`; OAuth 2.1 resource-server validation (`aud`, PKCE S256, RFC 9728 PRM); per-tool scopes; token exchange downstream (never passthrough); rate limiting; sandbox exec/fs. Benchmark: Inspector completes the OAuth flow; a token minted for another audience is rejected; no client token reaches a downstream API.
4. **Ship & distribute (week 3+):** entry point; publish to PyPI/npm; `server.json` → official registry via `mcp-publisher`; deploy stateless behind an LB (disable SSE buffering, raise timeouts, explicit JWT key, persistent token store). Benchmark: rolling deploy doesn't break in-flight calls; any instance serves any request.

**Version thresholds:** (a) When your Tier-1 SDK ships 2026-07-28, remove session/sticky-routing code, add `Mcp-Method`/`Mcp-Name`, migrate −32002→−32602, and move Roots/Sampling/Logging usage to replacements before the 12-month window closes. (b) Past ~20 tools or selection errors in evals → consolidate or apply progressive disclosure (Providers/Transforms). (c) Downstream enterprise SSO → CIMD + token exchange rather than DCR.

## Caveats
- Spec in flux: 2026-07-28 is a *release candidate* (locked May 21 2026, final July 28 2026) and can change; current finalized spec is 2025-11-25. No feature is *removed* in 2026-07-28 — Roots/Sampling/Logging are *deprecated* with a 12-month minimum window. SEP numbers cited come from the RC announcement; cross-check the PRs for exact titles.
- SDK lag: as of mid-2026 no official SDK fully ships 2026-07-28 in a stable release; TS v2 is beta, v1.x is the production line. FastMCP version churn is real (a pip upgrade from ≤3.2 can require `--force-reinstall`; uv unaffected); some documented FastMCP 3 features are main-branch/unreleased — pin versions.
- Statistics vary by source: 2026 MCP-security percentages and registry counts come from different vendor scans (Censys, BlueRock, Astrix, Equixly) on different dates and don't fully reconcile — directional, attribute to the scan.
- Reference servers ≠ production (explicitly educational; evaluate your own threat model).
- Some cited tutorials are secondary/vendor sources and may reflect a specific FastMCP/SDK version — cross-check primary docs (gofastmcp.com, modelcontextprotocol.io, the SDK repos).