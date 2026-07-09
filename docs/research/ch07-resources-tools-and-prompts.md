# Resources, Tools, and Prompts: MCP's Three Server-Side Primitives

Research reference for *Agentic Loops*, Chapter 7. Current as of 2026. The reader has already learned the wire protocol (Ch 5) and transports (Ch 6); this chapter focuses only on the three server-side primitives. Version-gated features and client-support facts drift fast; version-pin and re-verify at build time.

## TL;DR
- MCP servers expose exactly three primitives, distinguished by *who controls invocation*: **tools** are model-controlled (the LLM decides to call them), **resources** are application-controlled (the host decides when to pull data into context), **prompts** are user-controlled (the human explicitly selects them). This control taxonomy is the single most important design decision when building a server, and it maps onto REST intuition: tools ≈ POST (actions/side effects), resources ≈ GET (read-only retrieval), prompts ≈ stored templates / slash commands.
- In practice **tools dominate** and are the only primitive with near-universal client support; resources and prompts have inconsistent, lagging, often buggy support (Claude Desktop won't auto-read resources and has resource templates tracked as a P0 bug). Design for tools first; treat resources/prompts as enhancements whose payoff depends on your target client.
- Version-gating: tool **annotations** and the **completions** capability shipped 2025-03-26; **structured output** (`outputSchema` + `structuredContent`) and **resource links** shipped 2025-06-18 (which also removed JSON-RPC batching); **icons** and experimental **tasks** arrived in 2025-11-25; a stateless-core 2026-07-28 revision is in RC.

## The control taxonomy (organizing principle)
Every capability decision reduces to one question: "who should decide when this happens?"
- **Tools — model-controlled.** Spec: "Tools in MCP are designed to be model-controlled, meaning that the language model can discover and invoke tools automatically based on its contextual understanding and the user's prompts." Because tools act on the world, the spec adds: "there SHOULD always be a human in the loop with the ability to deny tool invocations."
- **Resources — application-controlled** (spec's word: "application-driven"). "Resources in MCP are designed to be application-driven, with host applications determining how to incorporate context based on their needs." The model does not spontaneously read a resource. Spec implication: "In order to expose data to models automatically, server authors should use a model-controlled primitive such as Tools."
- **Prompts — user-controlled.** "Prompts are designed to be user-controlled... with the intention of the user being able to explicitly select them for use... for example, as slash commands."

REST analogy (imperfect but exactly right for choosing a primitive): tools ≈ POST (side effects), resources ≈ GET (idempotent read-only, URI-addressed), prompts ≈ stored templates/macros the user invokes. A tool marked `readOnlyHint: true` behaves like a GET; a resource template resembles a parameterized GET route.

Why it matters for design: the control model dictates how each primitive is surfaced and what guarantees it must offer. Model-controlled tools need descriptions good enough for autonomous selection plus confirmation/annotations. Application-controlled resources must be safe to read repeatedly and cheap to enumerate (URIs, MIME types, pagination, subscriptions). User-controlled prompts must be discoverable and legible (titles, descriptions, argument metadata, autocompletion).

## Tools in depth
**Capability:** `{"capabilities":{"tools":{"listChanged":true}}}`.

**Tool definition** (from `tools/list`): `name` (unique; SEP-986 guidance 2025-11-25 recommends 1–128 chars, `[A-Za-z0-9_.-]`), optional `title` (UX only, no security meaning), `description` (what the model reads to decide relevance), `inputSchema` (JSON Schema, `type: object`), optional `outputSchema` (2025-06-18), optional `annotations`.

**`tools/list`** supports cursor pagination; on change a `listChanged` server SHOULD emit `notifications/tools/list_changed`.
```json
{"result":{"tools":[{"name":"get_weather","title":"Weather Information Provider","description":"Get current weather information for a location","inputSchema":{"type":"object","properties":{"location":{"type":"string","description":"City name or zip code"}},"required":["location"]}}],"nextCursor":"next-page-cursor"}}
```

**`tools/call`:**
```json
{"method":"tools/call","params":{"name":"get_weather","arguments":{"location":"New York"}}}
{"result":{"content":[{"type":"text","text":"Current weather in New York:\nTemperature: 72°F\nConditions: Partly cloudy"}],"isError":false}}
```

**Result structure.** A `CallToolResult` carries unstructured `content`, structured `structuredContent`, or both, plus `isError`. `content` blocks (each supports optional `annotations`: `audience`, `priority`, `lastModified`):
- text: `{"type":"text","text":"..."}`
- image: `{"type":"image","data":"<base64>","mimeType":"image/png"}`
- audio: `{"type":"audio","data":"<base64>","mimeType":"audio/wav"}` (added 2025-03-26)
- resource_link: `{"type":"resource_link","uri":"file:///project/src/main.rs","name":"main.rs","mimeType":"text/x-rust"}` (added 2025-06-18; "Resource links returned by tools are not guaranteed to appear in the results of a `resources/list` request")
- embedded resource: `{"type":"resource","resource":{"uri":"...","mimeType":"...","text":"..."}}`

**Structured output (2025-06-18):** define `outputSchema`, return matching JSON in `structuredContent`. "Servers MUST provide structured results that conform to this schema"; "Clients SHOULD validate." For backward compat, "a tool that returns structured content SHOULD also return the serialized JSON in a TextContent block." Two gotchas: strict validation can pre-empt an intended `isError:true` (TS SDK issue #654); and there's spec ambiguity (discussion #1563) about whether `content` and `structuredContent` must mirror each other — treat `structuredContent` as authoritative, keep the text block a serialized copy for older clients.

**Two error channels** (frequent bug source): protocol errors (JSON-RPC `error`: unknown tool, invalid args, server failure — e.g. −32602) vs tool execution errors (inside `result` with `isError:true`, returned as results so the model can self-correct: "Clients SHOULD provide tool execution errors to language models to enable self-correction").

**Annotations (2025-03-26, PR #185)** — four hints + `title`, with deliberately conservative defaults:
- `readOnlyHint` (default **false**) — no environment modification.
- `destructiveHint` (default **true**) — may perform destructive/irreversible updates. Only meaningful when not read-only.
- `idempotentHint` (default **false**) — repeated identical calls have no additional effect. Affects retry behavior. Only meaningful when not read-only.
- `openWorldHint` (default **true**) — interacts with external entities (internet, third-party APIs). Internal-DB tool → false; user-supplied-URL fetch → true.

An unannotated tool is treated as destructive, non-idempotent, open-world (maximum confirmation friction). Two critical caveats: (1) annotations are **hints, not guarantees** — "clients MUST consider tool annotations to be untrusted unless they come from trusted servers"; drive UX, never security. (2) They've become the de-facto **risk vocabulary** for graduated confirmation (auto-approve read-only from trusted servers; confirm destructive). Missing/incorrect annotations are a leading directory-rejection cause: per sunpeak's May 2026 guide, "Anthropic reports that missing annotations alone cause 30% of directory rejections. OpenAI calls incorrect or missing annotations 'a common cause of rejection'..." Claude requires ≥ one of `readOnlyHint`/`destructiveHint` per submitted tool; ChatGPT requires `openWorldHint: true` on external-service tools.

**How the LLM uses descriptions.** Selection is "based almost entirely on the name and description fields." Anthropic's *Writing effective tools for AI agents*: unambiguous parameter names (`user_id`, not `user`); namespacing across many tools (`asana_search`, `asana_projects_search`) has "non-trivial effects" on evals; "even small refinements to tool descriptions can yield dramatic improvements." Anthropic states the upgraded Sonnet 3.5 "achieved state-of-the-art performance on the SWE-bench Verified evaluation after we made precise refinements to tool descriptions" (49.0%, up from 33.4%). Tool design is evaluation-driven, not deterministic.

**FastMCP (Python):**
```python
from fastmcp import FastMCP
mcp = FastMCP(name="WeatherServer")

@mcp.tool(name="get_weather",
          description="Get current weather for a city. Read-only; safe to call anytime.",
          annotations={"readOnlyHint": True, "openWorldHint": True})
def get_weather(location: str) -> dict:
    """Return current conditions for a city name or zip code."""
    return {"temperature": 22.5, "conditions": "Partly cloudy", "humidity": 65}
```
FastMCP auto-generates `structuredContent` for object-like returns (dict/Pydantic/dataclass) even without an explicit `outputSchema`, and always emits a text block for backward compat.

**TypeScript SDK:**
```ts
server.registerTool("get_weather",
  { title: "Weather Information Provider", description: "Get current weather for a location",
    inputSchema: { location: z.string().describe("City name or zip code") },
    outputSchema: { temperature: z.number(), conditions: z.string(), humidity: z.number() },
    annotations: { readOnlyHint: true, openWorldHint: true } },
  async ({ location }) => {
    const data = { temperature: 22.5, conditions: "Partly cloudy", humidity: 65 };
    return { content: [{ type: "text", text: JSON.stringify(data) }], structuredContent: data };
  });
```

## Resources in depth
**What:** read-only interfaces (not the data, an addressable interface to it) that must be side-effect-free — deterministic, idempotent. The GET side of MCP. Capability with two optional sub-features: `{"capabilities":{"resources":{"subscribe":true,"listChanged":true}}}`.

**URIs/schemes** (`[protocol]://[host]/[path]`): `https://` (only "when the client is able to fetch and load the resource directly from the web on its own"), `file://` (need not map to a physical FS), `git://`, and custom schemes (`db://`, `postgres://`, `memory://`, `weather://`) per RFC 3986.

**Direct vs template.** A direct resource appears in `resources/list` (`uri`, `name`, optional `title`/`description`/`mimeType`/`size`). A **template** exposes a parameterized URI via `resources/templates/list` using **RFC 6570 URI Template** syntax — `weather://forecast/{city}`, `db://tables/{table_name}/schema` — covering families of resources without enumerating thousands. FastMCP also supports form-style query params (`{?p1,p2}`) and wildcard params (`{path*}`).

```json
// resources/list
{"result":{"resources":[{"uri":"file:///project/src/main.rs","name":"main.rs","title":"Rust Software Application Main File","description":"Primary application entry point","mimeType":"text/x-rust"}],"nextCursor":"next-page-cursor"}}
// resources/read
{"method":"resources/read","params":{"uri":"file:///project/src/main.rs"}}
{"result":{"contents":[{"uri":"file:///project/src/main.rs","mimeType":"text/x-rust","text":"fn main() {\n    println!(\"Hello world!\");\n}"}]}}
// resources/templates/list
{"result":{"resourceTemplates":[{"uriTemplate":"file:///{path}","name":"Project Files","title":"📁 Project Files","description":"Access files in the project directory","mimeType":"application/octet-stream"}]}}
```

**Contents:** each item is text (`"text"`, UTF-8) or binary (`"blob"`, base64), with `uri` and typically `mimeType` (correct MIME types matter so clients can parse).

**Annotations:** `audience` (`["user"]`/`["assistant"]`/both), `priority` (0.0–1.0), `lastModified` (ISO 8601) — hints for filtering/prioritizing/sorting.

**Subscriptions/notifications:** with `listChanged`, `notifications/resources/list_changed` on add/remove; with `subscribe`, a client sends `resources/subscribe` with a URI and the server emits `notifications/resources/updated` on change (good for live dashboards/logs/metrics).

**How the app decides what to pull in:** a picker/tree for explicit selection, search/filter, or automatic heuristic/model-driven inclusion. In Claude Desktop the user attaches via the "+"/paperclip menu.

**FastMCP resource + template:**
```python
import json
from pathlib import Path
from fastmcp import FastMCP
from fastmcp.exceptions import ResourceError
mcp = FastMCP(name="DataServer")

@mcp.resource("resource://config/app")
def app_config() -> dict:
    return {"version": "1.4.2", "region": "us-east-1"}

@mcp.resource("weather://forecast/{city}")
def forecast(city: str) -> str:
    return json.dumps({"city": city.capitalize(), "temp": 22, "condition": "Sunny"})

DOCS_ROOT = Path("docs").resolve()
@mcp.resource("docs://{filename}")
def read_doc(filename: str) -> str:
    p = (DOCS_ROOT / filename).resolve()
    if not p.is_relative_to(DOCS_ROOT) or not p.is_file():
        raise ResourceError("Document not found")
    return p.read_text(encoding="utf-8")
```
**TypeScript template resource:**
```ts
server.registerResource("user-profile",
  new ResourceTemplate("users://{userId}/profile", { list: undefined }),
  { title: "User Profile", mimeType: "application/json" },
  async (uri, { userId }) => ({ contents: [{ uri: uri.href, text: JSON.stringify(await getUser(userId)) }] }));
```

**Why underused — the live debate.** Recurring question: "what's the difference between a resource and a read-only tool?" — since both can return identical data. The *only* real difference is the control model: a tool is model-invoked; a resource is application/user-invoked. Two suppressing forces: (1) resources require product UX to be useful (a browse/select interface — "product thinking, not just protocol implementation"); (2) client support is weak/buggy (below), so authors who want data reliably available to the model are told by the spec itself to use tools instead. Counter-argument for resources: for **static reference context the user knows they want** (project docs, a schema), a resource is more token-efficient than burning tool-description tokens and needs no model round-trip — but only on clients with good resource support.

## Prompts in depth
**What:** server-authored, reusable, parameterized message templates the user explicitly selects, typically surfaced as slash commands. The handoff artifact between a workflow author and the end user. Capability: `{"capabilities":{"prompts":{"listChanged":true}}}`.

```json
// prompts/list
{"result":{"prompts":[{"name":"code_review","title":"Request Code Review","description":"Asks the LLM to analyze code quality and suggest improvements","arguments":[{"name":"code","description":"The code to review","required":true}]}],"nextCursor":"next-page-cursor"}}
// prompts/get
{"method":"prompts/get","params":{"name":"code_review","arguments":{"code":"def hello():\n    print('world')"}}}
{"result":{"description":"Code review prompt","messages":[{"role":"user","content":{"type":"text","text":"Please review this Python code:\ndef hello():\n    print('world')"}}]}}
```

**Arguments:** each has `name`, optional `description`, `required` (bool). Unlike tool `inputSchema` (full JSON Schema), prompt arguments are a simpler named list — user-facing form fields, not a machine-validated contract.

**Messages:** the returned `messages` array is the payload. Each `PromptMessage` has a `role` (`"user"`/`"assistant"` — **no `system` role**) and `content` (text, image, audio, or embedded resource). This enables (a) **multi-message conversations** (a user turn plus a primed assistant turn) and (b) **embedded resources** pulled directly into the flow.

**Autocompletion (`completions`, 2025-03-26):** a server declaring `completions` answers `completion/complete` for IDE-style dropdowns on prompt args or resource-template params. References are `ref/prompt` or `ref/resource`; up to 100 ranked values. Two limits: client support is thin (mostly the MCP Inspector), and a known gap (issue #597) — a completion request for a multi-variable template doesn't tell the server which *earlier* variables were resolved, so `{repo}` can't be scoped by `{owner}`.

**FastMCP prompts:**
```python
from fastmcp import FastMCP
from fastmcp.prompts.base import UserMessage, AssistantMessage, Message
mcp = FastMCP(name="DevServer")

@mcp.prompt()
def ask_review(code_snippet: str) -> str:
    """Generate a standard code review request."""
    return f"Please review the following code for bugs and style issues:\n```python\n{code_snippet}\n```"

@mcp.prompt()
def debug_session_start(error_message: str) -> list[Message]:
    """Initiate a debugging help session (multi-message)."""
    return [UserMessage(f"I encountered an error:\n{error_message}"),
            AssistantMessage("Okay — can you share the full traceback and what you were trying to do?")]
```
**TypeScript prompt:**
```ts
server.registerPrompt("review-code",
  { title: "Code Review", description: "Review code for best practices and potential issues",
    argsSchema: { code: z.string() } },
  ({ code }) => ({ messages: [{ role: "user", content: { type: "text", text: `Please review this code:\n\n${code}` } }] }));
```

**Use cases:** standardized repeatable workflows (weekly report, security audit, incident triage); encoding org best practices; slash-command discoverability.

## How the three compose
Canonical example — a **database server**:
- **Resource:** the schema (tables/columns/types/relationships) at `db://schema`, loaded as context at session start; template `db://tables/{table}/schema` per table. Semi-static, read-only, needed for every query → application-controlled.
- **Tools:** `run_query` (SELECT, `readOnlyHint: true`), `create_record`/`update_record`/`delete_record` (side effects, `destructiveHint: true`). Model decides when, constructs args from the user's request.
- **Prompt:** a `data_analysis` workflow embedding the schema resource, with query-structuring instructions and output format — user-triggered as `/data_analysis`.

Anthropic's SQLite reference server is a real instance (a guiding prompt, create/query tools, a `memo://insights` resource updated in real time). A powerful pattern (AWS Heroes): the **hybrid-execution prompt** — the server runs deterministic steps (query, aggregate, exact arithmetic) and hands the model a precomputed dataset with one instruction ("format this as an executive summary"). The server does what needs precision; the model does what needs language. Since newer specs have no protocol session, thread state across tool calls by returning an explicit handle (e.g. `basket_id`) from one tool and passing it to the next.

## From the client/LLM perspective
**Surfacing:** tools are injected into the model's context (name + description + schema) with a confirmation UI; resources through host UX (picker/attach/`#`-mention/drag/auto-include); prompts to the user (VS Code: `/mcp.servername.promptname`).

**Actual client support (crucial caveat).** Tools are near-universal; resources/prompts are inconsistent/buggy. The official modelcontextprotocol.io client matrix is authoritative in framing but **community-maintained and stale as of mid-2026** — it under-reports Cursor and VS Code. Reconciling with first-party sources:

| Client | Resources | Prompts | Tools | Notes |
|---|---|---|---|---|
| Claude Desktop | ✅ but buggy | ✅ | ✅ | Attach via "+"/paperclip; resources listed in Settings but **not auto-read**; **dynamic templates broken — P0 issue**; large resources can throw stack-size errors. |
| Claude Code (CLI) | Partial/weak | ✅ | ✅ (+ roots) | 2026 docs reference `resources/list`/`list_changed` but consumption bugs reported. |
| Cursor | ✅ since v1.6 (Sept 2025) | Emerging | ✅ (hard cap 40 tools total) | Loads all tool defs upfront; overhead grows past ~10 servers. Per Demiliani (Sept 2025): exceeding 40 → only the first 40 tools are sent. |
| VS Code + Copilot | ✅ incl. templates | ✅ as `/mcp.servername.promptname` | ✅ (max 128 enabled) | Full MCP spec since the June 12 2025 release. |

Documented Claude Desktop bugs (worth citing since Anthropic authored both spec and client): it "calls `resources/list` on startup and displays available resources in Settings, but doesn't call `resources/read` when answering questions. It often does a web search instead," and "Resource templates like `greeting://{name}` are broken. Only static resources function." (Corroborated by python-sdk #263, typescript-sdk #686.)

**Practical reality:** tools dominate. Architectural conclusion: **if it must work on every client, make it a tool.** Reserve resources/prompts for verified clients (VS Code + Copilot is currently most complete) and degrade gracefully.

## Design guidance and anti-patterns
**When to use which:** tool → model should decide/act; anything with side effects; external computation; dynamic context-dependent retrieval. resource → app/user controls read-only context; large reference material; sensitive data needing opt-in; compliance/consent. prompt → user triggers a known repeatable workflow, or you want to encode best practices / discoverability.

**The "make everything a tool" temptation.** Because tools are the only universal, model-invokable primitive, exposing everything (including read-only data) as tools is often *pragmatically correct*, but it inflates the tool list, consumes context, and hands the model control over data access a user/app arguably should control. Ask the control-model question first; fall back to a tool only when client support forces it.

**Context-window implications — the dominant constraint.** Every tool definition is injected into the system prompt on every request. Reported numbers: StackOne — "GitHub's official MCP server (94 tools) uses 17,600 tokens per request for tool definitions alone"; Getunblocked — "Nebulagg measured it at ~42,000 tokens... Piotr Hajdas's more recent count put it at 55,000 across 93 tool definitions" (~21% of a 200K window before the first prompt); Apideck — GitHub+Slack+Sentry (~40 tools) = "55,000 tokens of tool definitions... over a quarter of Claude's 200k limit. Each MCP tool costs 550-1,400 tokens"; Demiliani — a Playwright server's tools ≈ "22.2% of its [claude-sonnet-4 200K] context window." This also degrades decision quality via attention dilution and "lost in the middle." Anthropic's *advanced tool use* post quantifies the fix: with the Tool Search Tool, "Opus 4 improved from 49% to 74%, and Opus 4.5 improved from 79.5% to 88.1%," an "85% reduction in token usage while maintaining access to your full tool library." Mitigations: per-conversation tool toggling; tool-search/lazy loading (Claude Code triggers past ~10K tokens of definitions); progressive disclosure (short/medium/full descriptions); and Anthropic's **code-execution-with-MCP** pattern (the agent writes code that calls tools on demand and filters results before they hit the model). Also a point for resources: a directly-attached resource costs no tool-description tokens and needs no model round-trip.

**Common mistakes:** treating resources as action triggers (use tools); huge resource payloads (paginate; use `resource_link`); omitting annotations (defaults to destructive/open-world); vague/colliding tool names, ambiguous params (`user` vs `user_id`); assuming resources/prompts work everywhere; conflating `content`/`structuredContent` or letting output-schema validation swallow error results; relying on autocompletion in production.

## Recommendations
1. **Build tools first, correctly:** precise, eval-tested descriptions and unambiguous param names; complete `inputSchema`; accurate annotations set explicitly (don't accept pessimistic defaults); errors as `isError:true` results; adopt `outputSchema`+`structuredContent` where downstream code consumes results. Threshold: past ~10–15 tools or ~10K tokens of definitions, add namespacing + lazy loading / tool search, or split into multiple servers. (Hard ceilings: Cursor sends only the first 40; VS Code caps at 128 enabled.)
2. **Add resources deliberately, matched to your target client:** semi-static reference context with correct MIME types, pagination, RFC 6570 templates; add `subscribe`/`listChanged` only for live data. Only invest in rich resource UX if your primary client supports it well (VS Code + Copilot today); if you must target Claude Desktop and need the model to *use* the data, expose it as a read-only tool instead (dynamic templates are broken there; resources aren't auto-read).
3. **Add prompts to encode workflows:** parameterized, possibly multi-message, embedding relevant resources; prefer the hybrid pattern (deterministic steps server-side, one language task to the model). Add `completions` only as a nice-to-have (thin client support).
4. **Cross-cutting:** validate inputs, enforce access controls/rate limits, never trust annotations for security. Pin the target protocol version (send `MCP-Protocol-Version` on HTTP; servers default to 2025-03-26 if absent) and test against the actual clients you support. Track the 2026-07-28 RC (stateless core, extensions, tasks) if you run remote/multi-tenant servers.

## Caveats
- Client support is a moving target and the official matrix is stale; re-verify per client before relying on resource/prompt support (Cursor and VS Code have advanced past the matrix).
- Token/cost figures vary by measurement and change frequently: GitHub-server figures span 17,600 (StackOne, 94 tools), ~42,000 (Nebulagg), 55,000 (Hajdas, 93 defs). Order-of-magnitude, not exact. "Lost in the middle" percentages come from research summaries, not one canonical benchmark.
- Spec ambiguities remain (`content` vs `structuredContent`; multi-variable template completion) — SDK behavior may differ from a strict reading.
- Version drift: annotations & completions (2025-03-26); structured output, resource links, elicitation, RFC 8707 resource indicators, batching removal (2025-06-18); icons & experimental tasks (2025-11-25); stateless core & extensions (2026-07-28 RC). Any SDK/client may implement a subset — confirm the negotiated `protocolVersion` at runtime.
- This chapter omits the wire protocol, transports, and client-side primitives (sampling, roots, elicitation) except where they intersect the three server primitives (resource links, embedded resources, handle-threading).