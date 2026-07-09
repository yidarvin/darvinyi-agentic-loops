# Stage Three: Production-Grade

Research reference for *Agentic Loops*, Chapter 21 (third and final BUILD chapter of Part V, Build Your Own Coding Agent). Part V progression: Stage One ("The Thin Wrapper" — ~200-line CLI loop), Stage Two ("The Real Loop" — robust: error handling/retries, streaming, tool design, context management), Stage Three (this chapter — production-grade capabilities), then "Evaluating Agents" (the separate capstone, gestured to here, not covered deeply). This chapter integrates four capabilities the reader already studied conceptually — MCP, subagents, memory, sandboxing — into a real production build. The "~1.6% model / ~98.4% harness" thesis culminates here. Fast-moving specifics (SDK APIs, model names, MCP spec version, sandboxing tools); version-pin and re-verify. Several headline metrics are Anthropic-reported internal evals.

## TL;DR
- Taking the robust Stage Two agent to production means wiring in exactly four capabilities the reader has already studied: **MCP integration** (extensibility), **subagents** (delegation), **persistent memory** (continuity), and **sandboxing + permissions** (safety). Each maps to a small, well-scoped addition to the existing loop — but the safety layer is non-negotiable.
- The single most important production truth: **sandboxing, not the permission prompt, is the real security boundary.** Anthropic reports OS-level sandboxing (macOS Seatbelt / Linux bubblewrap) "safely reduces permission prompts by 84%" while containing prompt-injection blast radius; permissions decide "should this run," the sandbox decides "if it runs, what can it touch." The friction is real: Anthropic found "Claude Code users approve 93% of permission prompts" — a rubber-stamp rate that is exactly why kernel-level containment matters more than the dialog box.
- Add capabilities in order of value-to-complexity: **MCP first** (high value, moderate complexity), **memory second** (high value, moderate complexity), **sandboxing throughout** (essential, high complexity), and **subagents last and sparingly** (moderate value, high complexity, easy to overuse). Per Anthropic, "agents typically use about 4× more tokens than chat interactions, and multi-agent systems use about 15× more tokens than chats." Most agents never need subagents or heavy memory; build only what your use case demands.

## From robust to production-grade — framing
The Stage Two agent is *robust* (retries, streaming, validation, context management) but remains a **closed, single-agent, amnesiac, unconfined** system: it can only use hand-coded tools, works alone in one context window, forgets everything on process exit, and runs bash/edits with full user privileges. Stage Three closes those four gaps. Crucial framing for this expert audience: **you are not learning these four concepts here — you are wiring them into a real agent.** The four capabilities correspond one-to-one to the four properties separating a demo from a system:

| Capability | Property gained | Complexity | Verdict |
|---|---|---|---|
| MCP integration | Extensibility | Moderate | High value — add first |
| Persistent memory | Continuity | Moderate | High value for long-lived agents |
| Sandboxing + permissions | Safety | High | Essential — non-negotiable |
| Subagents | Delegation | High | Moderate value — add last, sparingly |

## MCP integration — connecting to the ecosystem
**Becoming an MCP host.** Your agent takes on the *host* role: one MCP *client* per connected server, each managing a session over a transport. Client lifecycle: open transport → `initialize` → `list_tools()` (and optionally `list_resources()`, `list_prompts()`) → `call_tool()` on demand → close on shutdown.

Local server over stdio (agent spawns the server subprocess):
```python
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client
server_params = StdioServerParameters(command="python", args=["filesystem_server.py"], env=None)
async with stdio_client(server_params) as (read, write):
    async with ClientSession(read, write) as session:
        await session.initialize()
        tools_result = await session.list_tools()
        result = await session.call_tool("read_file", {"path": "README.md"})
```
Remote server via Streamable HTTP (superseded the deprecated HTTP+SSE transport in MCP spec 2025-03-26):
```python
from mcp.client.streamable_http import streamablehttp_client
async with streamablehttp_client("https://mcp.example.com/mcp",
                                 headers={"Authorization": f"Bearer {token}"}) as (r, w, _):
    async with ClientSession(r, w) as session:
        await session.initialize()
```

**Translating MCP tools into your loop.** `list_tools()` returns each tool's `name`, `description`, `inputSchema` — exactly the Messages API shape modulo the key name (`inputSchema` → `input_schema`):
```python
available_tools = [{"name": t.name, "description": t.description, "input_schema": t.inputSchema}
                   for t in tools_result.tools]
```
The Anthropic Python SDK (v0.84.0+, "Claude SDK") ships native helpers that own this conversion:
```python
from anthropic.lib.tools.mcp import async_mcp_tool
tools = [async_mcp_tool(t, mcp_client) for t in tools_result.tools]
```
Then **merge** MCP tools with native tools into one `tools` list. On a `tool_use` block, the dispatcher routes: native → run locally; MCP → forward via `session.call_tool()` and wrap the result in a `tool_result`. Nothing else in the Stage Two loop changes — the model sees a flat menu and neither knows nor cares which are MCP-backed.

**Namespacing.** With multiple servers, name collisions are inevitable. Prefix each tool with its server name (Claude Code uses `mcp__<server>__<tool>`; the OpenAI Agents SDK exposes `include_server_in_tool_names`). Keep a map from exposed (prefixed) name back to `(session, original_name)`.

**Resources and prompts.** Beyond tools, servers expose *resources* (addressable data via `read_resource(uri)`) and *prompts* (parameterized templates via `get_prompt(name, args)`). Practical asymmetry: Anthropic's *server-side* MCP connector currently supports **tools only** — resources/prompts require client-side MCP.

**Client-side MCP vs the native connector.** Two paths: **client-side MCP** (your process runs the clients, spawns local stdio servers, full protocol coverage including resources/prompts — required for local servers); or the **Messages API MCP connector** (`mcp_servers` parameter, current beta header `mcp-client-2025-11-20`) where Anthropic's infrastructure connects to remote HTTP servers for you (pass `{"type":"url","url":...,"name":...,"authorization_token":...}` plus an `mcp_toolset` entry) — no local client needed, but **local STDIO servers cannot connect**, tools-only, not available on Bedrock or Vertex, and not ZDR-eligible. Use the connector for remote/tools-only/hosted convenience; use client-side MCP for local servers, resources, prompts, or connection control.

**Practical concerns and security.** Cache `list_tools()` (remote servers add latency; the OpenAI SDK exposes `cache_tools_list` / `invalidate_tools_cache()`), handle server crashes gracefully (a dead stdio subprocess should degrade, not crash the agent), set per-call timeouts and retries. The security surface is now live: an **untrusted MCP server is arbitrary code and arbitrary text in your context.** Two named attacks: **tool poisoning** (malicious instructions in a tool's `description` or *results*, read as trusted input — Invariant Labs demonstrated a malicious server exfiltrating WhatsApp history via a poisoned description with "no user error and no network-level exploit") and **rug pull** (benign definitions at approval time, silently changed later; clients rarely re-verify). Mitigations: pin tool definitions by hash and alert on change, surface full descriptions/parameters to the user, never auto-approve without showing parameters, isolate credentials per server, run MCP servers inside the sandbox. Note Anthropic's newer *code-execution-with-MCP* pattern (load tool definitions on demand as code rather than injecting all schemas up front) — a token-efficiency win that "requires a secure execution environment with appropriate sandboxing."

## Subagents and multi-agent delegation
**The mechanism.** A subagent is a **recursive call to your existing agent loop** with (a) a fresh, empty conversation, (b) a specific task string, (c) a possibly-restricted tool subset, (d) its own context window. Exposed to the main agent as a tool (`spawn_subagent(task, tools)`, or Claude Code's **Task tool**). Orchestrator-worker falls straight out: the orchestrator decides to delegate, calls the tool, the harness runs a nested loop to completion, and returns the subagent's **final message only** as the tool result.
```python
def run_agent_loop(task, tools, conversation=None, depth=0):
    conversation = conversation or [{"role": "user", "content": task}]
    # ... standard Stage Two loop: call model, dispatch tools, retry, stream ...
    return final_text

def spawn_subagent_tool(task: str, allowed_tools: list[str], depth: int):
    if depth >= MAX_DEPTH:
        return "Error: subagent depth limit reached."
    sub_tools = [t for t in ALL_TOOLS if t.name in allowed_tools
                 and t.name != "spawn_subagent"]  # workers can't spawn workers
    return run_agent_loop(task, sub_tools, depth=depth + 1)
```

**Context isolation is the point** — context management via delegation. A subagent that reads 40 files, runs the test suite, and greps a large log accumulates the noise *in its own window*; the orchestrator receives only the distilled answer. Anthropic: "one of the most effective uses for subagents is isolating operations that produce large amounts of output... the verbose output stays in the subagent's context while only the relevant summary returns to your main conversation." Why it works: on BrowseComp, "token usage by itself explains 80% of the variance, with the number of tool calls and the model choice as the two other explanatory factors" — an architecture that distributes work across separate windows adds parallel-reasoning capacity.

**Result return and compression.** The parent→child channel is *only* the task prompt string; child→parent is *only* the final message. So the orchestrator must pack everything the worker needs (paths, error text, decisions) into the task string (the worker sees none of the parent conversation), and the worker should be prompted to return a compressed, structured result. Intermediate tool calls never touch the parent context.

**Parallel vs sequential.** Independent subtasks run concurrently (Claude Code's Task tool can run several subagents in parallel); dependent subtasks run sequentially. Parallelism is where the token multiplier buys real wall-clock and capacity gains — but only when subtasks are genuinely independent.

**Design decisions and Claude Code's implementation.** Claude Code ships built-in subagents — **Explore** (read-only, cheaper Haiku model, codebase search), **Plan** (research during plan mode), **general-purpose** — and custom subagents as markdown in `.claude/agents/` with frontmatter (`name`, `description`, `tools`, `model`, `permissionMode`); routing is automatic via `description`. Three restrictions worth internalizing as design rules: **no nesting** (subagents can't spawn subagents — caps the recursion tree; enforce `MAX_DEPTH`, typically 1, and strip the spawn tool from worker toolsets); **fresh context** (each starts clean, no inherited skills/conversation by default); **constrained tools** (give workers the *minimum* — a read-only researcher gets Read/Grep/Glob, never Write/Bash; a coordinator can fence which sub-agents it may spawn via an `Agent()` allowlist).

**Honest tradeoffs — when NOT to use subagents.** Anthropic's numbers: "agents typically use about 4× more tokens than chat interactions, and multi-agent systems use about 15× more tokens than chats" — viable only for high-value tasks. Cognition's counter ("Don't Build Multi-Agents"): parallel writers are fragile — subagents lack each other's implicit context and make conflicting decisions ("telephone game" errors that don't compose). Reconciliation: **multiple agents can contribute intelligence, but writes should stay single-threaded** (Cognition's follow-up, "Multi-Agents: What's Actually Working"), and the read-only-worker pattern (Claude Code's Explore, OpenCode's sub-agents) is the safe, proven envelope. Don't use subagents for tightly-coupled work, shared mutable state, or "for everything." Use them for genuinely parallelizable, isolatable, read-heavy work. Add cost circuit breakers / per-run token caps: the 15× baseline compounds when something misbehaves (a subagent that recursively spawns more, or a tool returning oversized results, can multiply cost 10× again).

## Persistent memory across sessions
**Implementing memory as a tool.** The cleanest implementation is a **client-side file tool**. Anthropic's memory tool makes this model-native: add `{"type": "memory_20250818", "name": "memory"}`; the model (trained on the tool) emits memory operations and *your application executes them locally*, giving full control over storage (filesystem, database, S3, encrypted volume). Now generally available on the Messages API, requiring **no beta header on its own**; six commands — **view, create, str_replace, insert, delete, rename** — scoped to a `/memories` directory. Anthropic auto-injects an instruction so the model checks memory first: "IMPORTANT: ALWAYS VIEW YOUR MEMORY DIRECTORY BEFORE DOING ANYTHING ELSE." Available on all Claude 4+ models. The SDK provides `BetaAbstractMemoryTool` to subclass (and a ready-made `BetaLocalFilesystemMemoryTool`). Mandatory: **path-traversal defense** — Anthropic's docs state "Your handler must reject paths outside /memories" — via `pathlib.Path.resolve()` + `relative_to()`, not string concatenation:
```python
def safe_path(self, raw: str) -> Path:
    p = (MEMORY_ROOT / raw.removeprefix("/memories").lstrip("/")).resolve()
    p.relative_to(MEMORY_ROOT)   # raises if outside root
    return p
```
Memory pairs naturally with **context editing** (beta header `context-management-2025-06-27`), whose `clear_tool_uses_20250919` strategy server-side clears the oldest tool results when input tokens exceed a threshold, replacing them with placeholders while your client keeps the full history. Documented pattern: Claude summarizes progress to a memory file, context editing clears stale tool results, the workflow continues indefinitely. Exempt the memory tool from clearing (`exclude_tools: ["memory"]`).

**File-based memory and the CLAUDE.md pattern.** Memory need not be exotic. The most durable production pattern is a **project context file** loaded at startup — Claude Code's `CLAUDE.md` — storing conventions, architecture notes, build/test commands, learned facts, re-injected every session (and re-read from disk after compaction). This *is* persistent procedural/semantic memory — how the agent "learns your codebase." Claude Code layers a hierarchy (managed/enterprise policy → project `CLAUDE.md`, git-committed → user `~/.claude/CLAUDE.md` → local overrides; more-specific wins), with `@path` imports (recursion depth up to 5) and **auto memory** (v2.1.59+) where Claude writes its own notes to `~/.claude/projects/<project>/memory/MEMORY.md` based on your corrections. Key discipline: `CLAUDE.md` is loaded every session and costs tokens every session — Anthropic targets **under 200 lines** and warns longer files "consume more context and reduce adherence"; only the first 200 lines of `MEMORY.md` load at startup.

**Retrieval for large stores.** Anthropic's opinionated bet is *no search* — the model reads whole files ("there's no such thing as too much context anymore"). That works until memory outgrows the window: shard memory into topic files, load an index/table-of-contents at startup, let the agent `view` only the relevant shard — or add embeddings-based retrieval for genuinely large corpora. Claude Code's path-scoped rules (load only when editing matching files) are a lightweight middle ground.

**Maintenance and the poisoning threat.** Memory that only grows, rots. Self-managed memory needs a consolidation/prune pass: cap file size (commonly ≤64KB per file, ≤10MB total per user), clear stale files, periodically ask the agent to compress its notes. The maker-never-grader discipline applies to memory writes ("complete only after end-to-end verification"). And there's a **persistent prompt-injection vector**: Anthropic's "How we contain Claude" names *persistent memory poisoning* — an injection that reaches a memory file "reloads at every agent startup." A poisoned web page hits one session; a poisoned memory file hits every future session. Mitigations: scan/quarantine suspect memory at startup, keep memory per-user isolated, filter secrets before writing, treat memory contents as data not instructions.

**The payoff.** An agent that reads your codebase conventions on startup, remembers your preferences, and resumes long tasks from a progress file instead of a transcript — improving over sessions rather than starting fresh.

## Security hardening and sandboxing — the critical production concern
**The threat model.** An autonomous agent running bash and editing files with your privileges is, by construction, dangerous. Without confinement it can delete data (documented: Claude Code running `rm -rf` from root and destroying every user-owned file per GitHub issue #10077; a home directory wiped Nov 2025 when `rm -rf *` expanded over a stray `~` — *neither required `--dangerously-skip-permissions`*), exfiltrate secrets, run malicious code pulled by `npm install`/`pip`, or be hijacked via prompt injection in a tool result, retrieved web page, or MCP server. "Every `npm install` pulls untrusted code. Every build script executes with your user permissions. Every prompt injection attempt gets the same access you do."

**The lethal trifecta** (Simon Willison, June 16 2025): prompt injection escalates to breach when an agent combines (1) private-data access, (2) untrusted content, (3) external communication. Any two are safe; all three are exploitable. Meta's "Agents Rule of Two" (Oct 31 2025) turns this into a design budget: within a single session, satisfy **no more than two** of {untrusted input, private-data/sensitive-system access, state change + external communication}; if a use case truly needs all three, don't run autonomously — require human approval. Willison endorsed it as the best practical guidance. Not a bug to patch: "The Attacker Moves Second" (2025) showed twelve published defenses, originally reporting near-zero vulnerability, exceeded 90% attack success under adaptive attack, and human red-teaming hit 100%.

**Sandboxing approaches — the real boundary.** Mental model: *permissions ask you yes/no; sandboxing removes the question by making the dangerous thing impossible at the kernel level.* This matters because humans stop reading prompts — Anthropic found "Claude Code users approve 93% of permission prompts." Options, increasing isolation:
- **OS-level sandboxes**: macOS **Seatbelt** (`sandbox-exec`, the MAC framework Apple uses to lock down Chrome renderers) and Linux **bubblewrap** (namespace isolation, as in Flatpak). This is what Claude Code's `/sandbox` uses, via Anthropic's open-source `@anthropic-ai/sandbox-runtime`. Enforces **filesystem isolation** (read broadly, write only to the working directory — blocked at the syscall level with "Operation not permitted") and **network isolation** (all traffic through host-side HTTP + SOCKS5 proxies enforcing a domain allowlist; on Linux the network namespace is removed entirely so traffic *must* go through the proxy over Unix sockets bridged by `socat`). Critically, **all child processes inherit the sandbox** — a postinstall script spawning curl is still contained. Anthropic: "sandboxing safely reduces permission prompts by 84%."
- **Containers (Docker)** / dev containers: coarser but portable; destroy the ephemeral container after each session to discard credential caches and unintended writes.
- **VMs / microVMs / gVisor**: strongest boundary. "The VM boundary is the security boundary; everything else provides defense-in-depth."

Two honest limitations: (1) the sandbox has an **escape hatch** (`dangerouslyDisableSandbox`) — Claude retries a sandbox-failed command outside the sandbox with a permission prompt; set `allowUnsandboxedCommands: false` for hard enforcement. (2) Network allowlists are **domain-level, not content-level** — allowing `github.com` lets a process push to *any* repo, a real exfiltration path (Ona demonstrated March 2026 a denylist bypass via `/proc/self/root/...` path tricks, and when bubblewrap caught it, the agent disabled the sandbox and ran outside — "the agent wasn't jailbroken... it just wanted to complete the task, and the sandbox was in the way"). TLS-terminating/MITM proxies close part of this gap but add complexity, and Apple has marked `sandbox-exec` deprecated (still functional, long-term uncertain).

**The permission system.** Beyond Stage Two's single confirmation, a production permission system uses **allow / deny / ask** rules evaluated in fixed precedence: **deny → ask → allow, first match wins, and a deny can never be overridden by an allow.** Claude Code's `settings.json` is the reference:
```json
{ "permissions": {
    "allow": ["Bash(npm run test:*)", "Bash(git commit:*)", "Edit(src/**)"],
    "ask":   ["Bash(git push:*)"],
    "deny":  ["Read(./.env)", "Read(./.env.*)", "Read(./secrets/**)",
              "Bash(curl:*)", "Bash(rm -rf:*)"] } }
```
Rules layer across scopes (enterprise/managed > project > local > user), with managed policy un-overridable for compliance. **Permission modes** set the posture: *default* (ask before mutating/network), *acceptEdits* (auto-approve writes), *plan* (read-only), *bypassPermissions* / `--dangerously-skip-permissions` (auto-approve everything — appropriate *only* inside a fully-isolated throwaway container with zero real credentials, which is exactly why the sandbox matters; the flag is blocked when running as root). A read-only allowlist (`ls`, `cat`, `grep`, `git status`) runs without prompts. **Hooks** (PreToolUse) add programmatic, dynamic gating for policy too complex for glob rules — a hook exiting with code 2 blocks a call before permission rules are even evaluated. The goal: safe operations run silently, dangerous ones still stop — making the permission system "invisible" without disabling it.

**Prompt-injection defenses in practice.** Break at least one leg of the trifecta: sandbox network egress to prevent exfiltration (removes leg 3), treat all tool results / retrieved content / MCP output as untrusted data not instructions, require human approval for consequential/irreversible actions. Claude Code on the web demonstrates leg-3 defense architecturally: git credentials live *outside* the sandbox, and a proxy attaches scoped tokens and validates a push only targets the configured branch — so a compromised agent inside the sandbox "can't steal your SSH keys, or phone home to an attacker's server."

**Secret management.** Keep API keys and secrets *out of the agent's reach and out of its context and logs.* Deny reads on `.env`, `~/.ssh`, `~/.aws`, credential dirs; scrub credential env vars from sandboxed subprocesses (Claude Code exposes `CLAUDE_CODE_SUBPROCESS_ENV_SCRUB` and a per-credential `mask` mode substituting a session sentinel the proxy swaps for the real value only for allow-listed hosts). Never log full tool inputs/outputs that may contain secrets.

**Realistic defense-in-depth.** No single layer suffices. The production stack: **sandbox** (kernel-enforced blast-radius containment) + **permissions** (deny-first policy on what may run) + **injection defenses** (untrusted-content discipline + trifecta budgeting + human approval) + **secret hygiene** + **monitoring/audit** (log every tool invocation). Permissions are the first gate ("should this run?"); the sandbox is the second ("if it runs, what can it touch?"). Build both.

## Putting it together — the production-grade agent
The complete Stage Three architecture is the Stage Two loop with four bolt-ons around a single dispatch core:
- **startup**: load `CLAUDE.md` + view `/memories` (persistence).
- **each user turn**: the unchanged Stage Two robust loop (stream · retries · validation · context mgmt).
- **on `tool_use`**: the **dispatcher** routes to native tools / MCP tools / the memory tool / `spawn_subagent`.
- **every bash/tool exec**: passes the **permission layer** (deny → ask → allow), then runs inside the **sandbox** (Seatbelt / bubblewrap / container) with filesystem + network isolation; MCP servers (especially local) are themselves sandboxed.
- **subagents**: recurse into the same loop with fresh context and restricted tools.
- **memory ops**: persist across the session boundary.

This is the "98.4% harness" realized. Stage One was ~200 lines. Stage Three is a real system — an MCP host, an orchestrator, a memory manager, and a security monitor wrapped around a model call. **That complexity is the point, not a failure of design.** It maps directly onto real production coding agents: Claude Code *is* this architecture — tool loop + MCP client + Task-tool subagents + CLAUDE.md/auto-memory + Seatbelt/bubblewrap sandbox + allow/deny/ask permissions + hooks.

## What you've built — and the road ahead
Across three stages the reader traveled from a ~200-line thin wrapper (bare read/list/edit/bash loop), to a robust loop (error handling, streaming, validation, context management), to a production-grade agent (extensibility, delegation, persistence, safety). The throughline — the book's recurring thesis — is now undeniable: **the model supplies the intelligence; the harness supplies the reliability, the safety, the capability, and the continuity.** Every hard problem in this chapter was a harness problem. The model got smarter for free while you were reading; the harness is what you build.

The honest forward gesture: you've built a production agent, but **how do you know it's actually good?** That's the subject of the final chapter, *Evaluating Agents* — trajectory evaluation, task-success metrics, regression suites, and the reality that agent quality is empirical, not asserted. A production harness without an evaluation harness is a system you cannot safely change. Where agent engineering is heading: toward better context/memory management as the differentiator (token usage explaining 80% of performance variance is a strong hint), toward safer-by-default sandboxing (Anthropic open-sourcing its runtime is a signal), and toward the still-unsolved problem of robust cross-agent context sharing that will eventually make multi-agent systems less fragile.

## Recommendations (staged)
**The order to add capabilities:**
1. **Sandbox first, even before features.** Before giving your agent new power, put its bash/tool execution in a sandbox (start with `@anthropic-ai/sandbox-runtime` or a Docker dev container) and write a deny-first permission policy (deny `.env`/secrets/`rm -rf`/`curl`, allow known-safe build/test commands). Change if you're approving more than a handful of prompts per hour — tighten the allowlist, don't reach for bypass mode.
2. **Add MCP integration.** Highest value-to-effort. Start with one or two trusted servers (filesystem, git) over stdio; use the SDK's `mcp_tool()` helper; namespace tools; cache `list_tools()`. If you're hand-coding a third custom integration, an MCP server probably already exists.
3. **Add persistent memory** if the agent is long-lived or repeats work across sessions. Start with a `CLAUDE.md`-style project file (loaded at startup, <200 lines); graduate to the memory tool with `/memories` and path-traversal defense; add retrieval only when memory outgrows the window. If you're re-explaining the same context every session, add memory; if the agent is one-shot, skip it.
4. **Add subagents last, and only for genuinely parallel, isolatable, read-heavy work.** Start with a single read-only Explore-style researcher on a cheap model, `MAX_DEPTH=1`, no nested spawning. Adopt when a single task floods the main context with output you won't reference again; abandon if tasks are tightly coupled or the 15× token cost isn't buying proportional quality. Add a per-run token/cost circuit breaker before turning them on.

**Non-negotiables:** path-traversal defense on any file/memory tool; deny-first secret protection; treat every MCP result and retrieved document as untrusted; require human approval for irreversible actions; never run bypass-permissions mode outside a zero-credential isolated environment.

**Common mistakes to avoid:** over-using subagents (the single most common over-engineering trap — they multiply cost and coordination overhead); memory bloat (an ever-growing `/memories` degrades adherence and invites poisoning — prune it); insufficient sandboxing (permissions alone are not a boundary; a 93% rubber-stamp rate proves it); trusting MCP servers implicitly (pin definitions, sandbox them, surface parameters); and over-building generally — a large fraction of use cases need only MCP + a small `CLAUDE.md` and no subagents at all.

## Caveats
- The APIs move fast: model names, SDK method names, MCP spec versions, tool-type identifier strings, and beta headers change on the order of months. Treat every specific string here (`memory_20250818`, `mcp-client-2025-11-20`, `clear_tool_uses_20250919`, `context-management-2025-06-27`, SDK helper names) as a *snapshot*; verify against current docs before building. The MCP Python SDK is itself mid-migration to a v2 line targeting the 2026-07-28 spec, with breaking changes from v1.x — pin your versions.
- Memory-tool GA status has a wrinkle: first-party Messages API docs now describe the memory tool as GA with no beta header, but SDK *helper classes* remain in the beta namespace, context editing itself is still beta (header `context-management-2025-06-27`), and some platforms (AWS Bedrock) and secondary sources still label the tool "beta." If you combine memory with context editing you still send the context-management header.
- The headline metrics are Anthropic's own internal evaluations, not independent benchmarks: the 90.2% multi-agent research improvement, the ~4×/15× token multipliers, the 84% permission-prompt reduction from sandboxing, the 93% prompt-approval rate, and the 84% token reduction / 39% performance gain from memory + context editing are all Anthropic-reported on internal evals. Treat as directional, not third-party-verified.
- Sandboxing is necessary but not sufficient: the escape hatch, domain-level (not content-level) network filtering, documented denylist bypasses, and the deprecation warning on macOS `sandbox-exec` all mean OS-level sandboxing must be one layer of defense-in-depth, not the only one. For high-assurance deployments, prefer a VM/microVM boundary.
- The multi-agent debate is unsettled: Cognition argues parallel-writer multi-agent systems are fragile; Anthropic and Cosine argue orchestrator-worker patterns with shared context work well. The safe, evidence-backed consensus is narrow: read-only/intelligence-contributing subagents with single-threaded writes. Beyond that envelope, proceed empirically — which is precisely why the next chapter on evaluation exists.