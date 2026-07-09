# Stage Two: The Real Loop

Research reference for *Agentic Loops*, Chapter 20 (second chapter of Part V, Build Your Own Coding Agent). Part V progression: Stage One ("The Thin Wrapper" — ~200-line CLI with read_file/list_files/edit_file/run_bash and the core loop), Stage Two (this chapter — hardening it into something robust), Stage Three ("Production-Grade" — MCP, subagents, memory, sandboxing), then "Evaluating Agents." This chapter takes the working-but-fragile Stage One agent and adds the harness engineering that makes it reliable — a big chunk of the "~98.4% harness" the book keeps invoking. The reader knows the loop, the tool_use/tool_result lifecycle, context economics, caching, MCP, skills, multi-agent, and memory, and just built Stage One — this chapter APPLIES those concepts. Fast-moving specifics (SDK APIs, model names, caching/context-management betas); version-pin and re-verify. Several headline numbers are vendor-reported.

## TL;DR
- Stage Two turns the fragile ~200-line thin wrapper into a robust agent by adding four harness layers — error handling/retries, streaming, well-designed and validated tools, and active context management — where each layer patches a specific failure mode you hit the moment you run the thin wrapper on a real task.
- The single highest-leverage additions are (1) never letting the loop crash — every API error is retried with exponential backoff+jitter and every tool error is fed back as a `tool_result` with `is_error: true` so the model self-corrects, and (2) an active context strategy combining prompt caching (cheap retention), tool-result clearing/pruning, compaction (summarize when full), and file-based offloading so long tasks run reliably and economically.
- After Stage Two you have a genuinely usable coding agent that survives errors and long tasks; what remains for Stage Three is extensibility (MCP), delegation (subagents), cross-session memory, and real sandboxing — the permission layer added here is a basic human-in-the-loop gate, not a security boundary.

## From fragile to robust — framing
The Stage One thin wrapper works ("an LLM, a loop, and enough tokens"). But point it at a real task and it falls over predictably: the first `429` or `529` crashes the process mid-task; a tool that throws (file not found, non-zero bash exit, hung command) propagates the exception and kills the loop; the model occasionally emits a malformed tool call or hallucinated tool name with no branch to handle it; on a long task the message array grows every turn until you exceed the window (crash) or degrade from context rot well before; and with no streaming, a long generation looks like a hang, can't be interrupted, and can hit the 10-minute non-streaming timeout.

Philosophy: **each layer addresses a specific, observed failure mode**, not a hypothetical one. Design goal in one sentence — *an agent you can start on a real task and walk away from without it falling over*. Anthropic's "Building Effective Agents" frames the same north star: agents suit "open-ended problems where it's difficult or impossible to predict the required number of steps," which "means higher costs, and the potential for compounding errors" and demands "extensive testing in sandboxed environments, along with the appropriate guardrails." A useful organizing principle (from Anthropic's tool-writing guidance): **tools and harnesses are a contract between a deterministic system and a non-deterministic agent** — the model will hallucinate, mis-format, and wander, and the harness must absorb that without dying.

## Robust error handling and retries
Governing principle: **a real agent should almost never crash. Every error is either retried (if transient) or fed back to the model as information (if the model can react to it).** Three surfaces.

**(a) API-level errors** map to typed SDK exceptions — catch the classes, never string-match:

| Status | Type | Transient? |
|---|---|---|
| 429 | `RateLimitError` | yes (respect `Retry-After`) |
| 529 | `OverloadedError` | yes |
| 500 | `InternalServerError`/`APIError` | yes |
| 503/504 | overloaded / `timeout_error` | yes |
| connection drop | `APIConnectionError` | yes |
| 400 | `BadRequestError` (malformed/oversized) | **no** — fix the request |
| 401/403 | auth/permission | no |
| 413 | `request_too_large` | no — shrink context |

**What the SDK gives for free.** The Anthropic Python SDK implements production retry: `DEFAULT_MAX_RETRIES = 2`, `DEFAULT_TIMEOUT = httpx.Timeout(600, connect=5.0)`, `INITIAL_RETRY_DELAY = 0.5`, `MAX_RETRY_DELAY = 8.0`. Backoff (`_calculate_retry_timeout`): honor `Retry-After` only when `0 < value ≤ 60`; else `min(0.5 * 2^n, 8.0)` × jitter `(1 - 0.25*random())` (a 0.75–1.0× multiplier). So delays are 0.5/1.0/2.0/4.0…capped 8.0s, jittered to avoid thundering-herd. `_should_retry` covers 408/409/429/≥500/connection/timeout, plus an explicit server override via `x-should-retry`. Note the SDK discards `Retry-After` values >60s, which can fire retries against a token bucket that won't refill yet (a Tier-1 reset can be ~171s).

**What you must add.** (1) **Don't stack your own retry loop on the SDK's** — the dominant production bug is app-level retry × SDK retry = up to `(2+1)×(3+1)=12` requests per transient failure and silent multi-minute hangs. Pick one owner: *let the SDK own it* (`Anthropic(max_retries=4)` or `client.with_options(max_retries=8)`, catch the final exception to save state) — simplest, good default; or *own it yourself* (`max_retries=0`, one outer loop with a saner `Retry-After` ceiling and a user-facing "retrying in Ns · attempt x/y" indicator). Claude Code owns it: up to 10 retries (`CLAUDE_CODE_MAX_RETRIES`, cap 15), higher `Retry-After` cap, and deliberately does **not** retry TLS-cert validation failures or other non-recoverable errors. (2) Add a **stall/idle watchdog** on streaming — a silently dropped TCP connection can leave the SDK waiting forever with no `message_stop`; Claude Code shows "Waiting for API response · will retry" after 20s of no stream data, then aborts and re-issues.

**(b) Tool execution errors.** Catch and return a `tool_result` with `is_error: true` and a human-readable message, then continue — the model treats it as information and self-corrects:
```python
def run_tool(name, tool_input, tool_use_id):
    try:
        return {"type": "tool_result", "tool_use_id": tool_use_id,
                "content": TOOLS[name](**tool_input)}
    except Exception as e:
        return {"type": "tool_result", "tool_use_id": tool_use_id,
                "content": f"Error running {name}: {e}", "is_error": True}
```
Two hard API invariants even on the error path: **every `tool_use` must be answered by a `tool_result` with the matching `tool_use_id` in the next user message** (crash between request and result → `400: tool_use ids were found without tool_result blocks`; on interrupt, still append a synthetic `"[Request interrupted by user]"` error result); and **if a request contains tool_use/tool_result blocks, `tools` must be defined** in that request.

**(c) Malformed model output.** Hallucinated tool name, missing required arg, or (under `max_tokens` truncation of streamed tool JSON) incomplete JSON — handle each as a fed-back error:
```python
if tool_use.name not in TOOLS:
    return error_result(tool_use.id, f"Unknown tool '{tool_use.name}'. Available: {list(TOOLS)}")
try:
    validated = TOOL_SCHEMAS[tool_use.name](**tool_use.input)
except ValidationError as e:
    return error_result(tool_use.id, f"Invalid arguments for {tool_use.name}: {e}")
```
Streaming-specific: fine-grained tool streaming sends parameters without server-side JSON validation, so `stop_reason == "max_tokens"` mid-parameter yields invalid JSON — detect the truncated stop reason. Watch the mixed text+tool-call ordering bug (a `text_delta` targeting an open `tool_use` block → "Content block is not a text block"), and ignore unknown event types rather than crashing.

## Streaming
**Why it earns its place** (not aesthetics): (1) the non-streaming API is capped at a 10-minute request and long generations hit `504 timeout_error` — Anthropic recommends streaming for long-running requests; (2) streaming enables **interruption**; (3) live token display collapses perceived latency; (4) you can render *what the agent is doing* (which tool, which file) in real time — most of the demo-vs-tool UX gap.

**The event stream** (SDK context-manager API):
```python
with client.messages.stream(model=MODEL, max_tokens=8192, tools=TOOLS,
                            messages=messages, system=SYSTEM) as stream:
    for event in stream:
        if event.type == "content_block_delta":
            if event.delta.type == "text_delta":
                print(event.delta.text, end="", flush=True)
            elif event.delta.type == "thinking_delta":
                render_thinking(event.delta.thinking)
    final_message = stream.get_final_message()   # fully reconstructed Message
```
Canonical sequence: `message_start` (shell Message, empty content, initial usage) → per block `content_block_start` / `content_block_delta`(s) / `content_block_stop` → `message_delta` (final `stop_reason`; **cumulative** `usage` — don't sum deltas) → `message_stop`. `ping` events appear anywhere (keep-alives to ignore). `stop_reason` is null in `message_start`, populated only in `message_delta`.

**With tool use.** Tool arguments arrive as `content_block_delta` of type `input_json_delta` carrying `partial_json` fragments you concatenate and parse at block stop. Flow: stream text/thinking, accumulate `tool_use` blocks, and when the stream stops with `stop_reason == "tool_use"`, execute tools, append the assistant message and tool_result(s), loop again — streaming the next turn. `stream.get_final_message()` reconstructs the complete assistant message so you append exactly what a non-streaming call would give. **Don't hand-roll accumulation** — the SDK handles block indexing, partial-JSON assembly, and reconnection.

**Interruption and cancellation.** Run the stream under an abort signal / cancellable task; on interrupt, abort, then **preserve state correctly**. Subtle bug (filed against Claude Code): the SDK's SSE iterator silently swallows `AbortError`, so a `for` loop over the stream *completes normally* on abort — you get whatever arrived (maybe text) but not what didn't (maybe the `tool_use`), and the loop ends as if the turn finished. Defend by checking the stream ended cleanly (`message_stop` seen / `stop_reason` non-null); if not, treat as interruption/error, not a completed turn. When interruption follows a `tool_use`, append the synthetic interrupted-tool result so the conversation stays valid.

**CLI considerations.** Print text deltas with `flush=True`; render tool calls as compact one-liners ("● Edit(auth.py)"); truncate streamed tool *output* display (the model still gets the capped-but-larger version); stream extended-thinking to a dimmed region. Cache metrics (`cache_read_input_tokens`, `cache_creation_input_tokens`) arrive in `message_start`/`message_delta` `usage` — surface them to debug caching.

## Better tool design and validation
Stage One's tools are crude. Upgrading them is the "agent-computer interface" (ACI) work. Anthropic: "think about how much effort goes into human-computer interfaces, and plan to invest just as much effort in creating good agent-computer interfaces" — refining tool descriptions and error messages alone took Claude Sonnet 3.5 to SOTA on SWE-bench Verified.

**Input validation before execution.** Validate paths resolve *within* allowed directories (block traversal) and args against a schema, returning clear errors:
```python
def _resolve_safe(path, working_dir):
    target = (working_dir / path).resolve()
    target.relative_to(working_dir.resolve())   # raises ValueError if outside
    return target
```

**Error messages designed for self-correction** (highest-ROI tool change). Reference: Anthropic's `str_replace_based_edit_tool` returns *"No replacement was performed, old_str `...` did not appear verbatim in {path}."* and *"Multiple occurrences of old_str `...` in lines {lines}. Please ensure it is unique"* — each names the failure and the fix. A robust `str_replace`:
```python
def str_replace(path, old_str, new_str):
    p = _resolve_safe(path, WORKING_DIR)
    content = p.read_text(); count = content.count(old_str)
    if count == 0:
        return f"Error: old_str not found in {path}. Nearby content:\n{_closest_snippet(content, old_str)}"
    if count > 1:
        return f"Error: old_str matched {count} times in {path}; make it unique (add surrounding lines)."
    p.write_text(content.replace(old_str, new_str, 1))
    return f"Edited {path}. Review for correct indentation and no duplicate lines."
```

**The `str_replace` reliability problem** is the dominant edit-tool failure: ~15–20% of edits fail on first attempt ("String to replace not found"), and tab-indented files plus post-autoformat drift break exact match entirely. Mitigations in order: better errors + view-before-edit (cheapest, recovers most via retry); whitespace-tolerant/fuzzy fallback (Aider reports +10–30% success); full-file rewrite for files <~400 lines. Edit-format choice matters at the model level: Aider's "Unified diffs make GPT-4 Turbo 3X less lazy" (Gauthier, 89 tasks, gpt-4-1106-preview): search/replace scored 20%, unified diff raised it to 61% and "reduced laziness by 3X." Conversely the 2025 Diff-XYZ benchmark found search-replace most effective overall (especially for larger models), and a multi-turn study found whole-file rewriting most stable across turns. Net for a Claude-centric agent: the built-in `text_editor` tool (or search/replace with strong errors + fuzzy fallback) is the right default; consider whole-file rewrite for small files.

**The bash tool, hardened.** Needs: a **persistent session** (one long-lived `/bin/bash`, `start_new_session=True` so a timeout kills the whole process group, plus a per-command sentinel to detect completion); a **timeout** that kills-and-restarts on hang (Claude Code default 2 min, ceiling 10 min, `BASH_DEFAULT_TIMEOUT_MS`/`BASH_MAX_TIMEOUT_MS`); **output capping** — the API does *not* truncate tool results (an oversized request is rejected outright), so truncate before returning. Claude Code caps bash output at 30,000 chars with **middle-truncation** (keep head+tail, drop middle) and, when exceeded, saves full output to a file and hands the model the path plus a preview. Interleave stderr into stdout so errors land in context; manage working-directory persistence.

**Add a search/grep tool and a better lister.** Don't wrap every API call; build a few high-leverage tools matched to real workflows. A `read_file` that returns everything wastes context "like searching an address book by reading every page." Add a dedicated `grep`/search (matching lines + line numbers) and a `glob`/`list` (sorted by mtime, capped — Claude Code caps glob at 100 results and flags truncation). Format file reads with line numbers (`cat -n`) so edits/errors can reference them.

**Tool output token management.** Cap file reads (the text-editor tool takes `max_characters`, e.g. 10,000), truncate large search results, prefer summaries/paths over raw dumps. Not just cost — huge tool outputs are the fastest way to blow the window mid-task, and the first thing context management must clear.

**Confirmation for dangerous operations (basic HITL).** Full sandboxing is Stage Three; Stage Two adds a **permission gate**: read/planning tools run free, writes and bash require approval unless whitelisted. Mirror Claude Code's modes (`default` / `acceptEdits` / `dangerouslySkipPermissions`) plus a working-directory trust boundary:
```python
def check_permission(tool_name, args, mode, working_dir):
    if tool_name in READ_TOOLS or tool_name in PLANNING_TOOLS: return True
    if mode == "dangerouslySkipPermissions": return True
    if mode == "acceptEdits" and tool_name in WRITE_TOOLS:
        path = _resolve_tool_path(tool_name, args)
        if path and _is_within_working_dir(path, working_dir): return True
    return ask_user(tool_name, args)      # show tool name + exact args
```
Be honest about limits: an allowlist of "safe" commands is **not** a security boundary. Trail of Bits demonstrated prompt-injection→RCE by *argument injection* through pre-approved commands (e.g. `go test -exec`, `find -exec`) that bypass the approval gate. A denylist of catastrophic patterns (`rm -rf /`, fork bombs, block-device writes) as a hard floor helps, but real isolation is a sandbox — Stage Three.

## Context management (the big one)
**The problem.** Every turn appends messages; file reads, tool outputs, reasoning accumulate. Stateless API → resend the whole transcript each turn → cost grows ~quadratically and you march toward the window limit (200K default; 1M beta for Tier-4). Two bad outcomes: at the hard limit the request is rejected (crash); well before that, **context rot** degrades quality (fuzzy, re-asks answered questions, contradicts earlier decisions). Real agentic tasks run hundreds of turns. Anthropic: context is a finite resource with diminishing returns; "context engineering is the art of curating what goes into the limited context window."

**Monitoring usage.** Use the free `client.messages.count_tokens(model, system, tools, messages)` (separate rate limit, no charge) to know true prefix size before sending — and **use it, not tiktoken** (OpenAI's tokenizer undercounts Claude by ~15–20%, more on code). Read `usage` off each response. Reserve headroom: Claude Code reserves ~20K tokens for the summary itself and triggers auto-compact with ~13K tokens of headroom remaining (≈83.5% of a 200K window), so compaction never fails for lack of room to write.

Cost-ordered hierarchy — cheapest first:

**(a) Prompt caching — cheap retention (first).** Render order is fixed **tools → system → messages**; the cache key is the exact bytes up to a `cache_control: {"type":"ephemeral"}` breakpoint; one changed byte before a breakpoint invalidates everything after. So put tools+system first and keep them byte-stable (no timestamps, no reordered JSON keys — some languages randomize map order and silently bust the cache), breakpoint on the last system block (caches tools+system), and a rolling breakpoint on the last content block of the latest turn (each turn reuses the prior prefix). Up to **4 breakpoints**; exceeding → `400`. Cache reads ~10% of base input price; on a multi-turn loop this is a 5–10× input-cost reduction. Agent-specific gotchas: (1) if a single turn appends >20 content blocks (common with many tool pairs), the next request's breakpoint falls outside the 20-block lookback and silently misses — place an intermediate breakpoint every ~15 blocks in long turns; (2) side calls (summarization, subagents) must copy the parent's system/tools/model *verbatim* or they miss the cache entirely.

**(b) Tool-result clearing / context editing — prune stale bulk (cheap, cache-friendly).** Once the model has processed a file read or search result, the raw bytes are dead weight. Anthropic's server-side context editing (`clear_tool_uses_20250919`, beta `context-management-2025-06-27`) clears the oldest tool results when input tokens cross a threshold, keeps the N most recent, and leaves a placeholder. It runs **server-side, after prompt-cache lookup and before token counting**, so it does not destroy your cache prefix — a real advantage over client-side stripping:
```python
context_management={"edits": [{
    "type": "clear_tool_uses_20250919",
    "trigger": {"type": "input_tokens", "value": 100000},
    "keep": {"type": "tool_uses", "value": 3},
    "clear_at_least": {"type": "input_tokens", "value": 5000},
    "exclude_tools": ["memory"],
}]}
```
There's a parallel `clear_thinking_20251015` (must be first in the `edits` array if used with both). Claude Code's "microcompact" is the same idea — clears old tool results with no model call, ideally right after the ~1-hour cache TTL lapses. Keep: recent tool results, and always the record that the call happened; drop: raw bodies of old, re-fetchable results.

**(c) Compaction — summarize when genuinely full (expensive, busts cache).** When clearing isn't enough, summarize the older conversation into a structured note and continue. Anthropic's server-side compaction (`compact_20260112`, beta `compact-2026-01-12`) detects the threshold, generates a `<summary>`, and auto-drops everything before it on later requests. Claude Code's compaction is the reference for *how to summarize well*: a 9-section structured summary (Primary Request/Intent, Key Technical Concepts, Files and Code Sections with snippets, Errors and Fixes, Problem Solving, All User Messages, Pending Tasks, Current Work, Optional Next Step), then **rehydration**: re-inject a boundary marker, the summary, the ~5 most recently read files (capped ~50K tokens), skills, tools, CLAUDE.md, and instruct the agent to continue without re-acknowledging the summary. Tradeoff, stated plainly: compaction is lossy — exact numbers, precise names, nuanced reasoning get compressed away, and after two or three compactions the model's grip degrades. Compact *proactively* and *well*, not reactively at 95%. Cost optimization from reverse-engineering Claude Code: run the summarization call **with the same system prompt, tools, and message prefix** (compaction instruction as the final user message); a separate "you are a summarizer" system prompt was tested and produced a ~98% cache miss — tens of billions of tokens re-processed for nothing.

**(d) Offloading to external memory / files — keep working context lean.** Move durable information *out* of the transcript into files the agent re-reads on demand (filesystem-as-memory / scratchpad). Have the agent maintain a `NOTES.md` and commit progress to git with descriptive messages (Anthropic found this lets long-running agents recover working states and avoid re-deriving context). The **memory tool** (`memory_20250818`) formalizes this as a client-side file-directory the model reads/writes across turns and sessions; combined with context editing it lets the agent save key findings *before* old tool results are cleared. Files are unlimited, cheap, and survive compaction; context is scarce and expensive.

**The synthesis.** A real agent runs *all four* as a layered strategy ordered by cost: caching makes retained context cheap; clearing removes stale bulk without busting the cache; compaction summarizes when the window genuinely fills; file offloading keeps durable state outside the window. Never pay for an LLM summarization call when a free tool-result clear would do. Fundamental tension to teach: **compaction busts the cache** (it rewrites the prefix), so there's a real tradeoff between the cheap-retention path (cache + clear) and the summarize path — delay compaction as long as clearing + offloading keep you under the limit.

## Putting it together — the robust loop
```
while True:
    user_msg = read_input()                      # streaming CLI, interruptible
    messages.append(user_msg)
    while True:                                   # inner tool loop
        maybe_manage_context(messages)           # count_tokens -> clear/compact/offload
        try:
            with client.messages.stream(         # STREAMING + CACHING
                    model, system=cached(SYSTEM), tools=cached(TOOLS),
                    messages=with_cache_breakpoints(messages),
                    context_management=CLEAR_CONFIG, max_tokens=8192) as stream:
                assistant = consume_and_render(stream)   # print deltas, catch interrupt
        except (RateLimitError, OverloadedError, APIConnectionError, APITimeoutError) as e:
            handle_or_reraise(e); continue        # ONE retry owner — SDK's or here, not both
        messages.append({"role": "assistant", "content": assistant.content})
        if assistant.stop_reason != "tool_use":
            break
        results = []
        for block in tool_use_blocks(assistant):
            if not check_permission(block.name, block.input, mode, wd):
                results.append(error_result(block.id, "[Denied by user]")); continue
            results.append(run_tool_safely(block))     # validates, caps output, is_error on fail
        messages.append({"role": "user", "content": results})
```
Every layer earns its place against a failure it prevents: the `try/except` stops API errors from crashing; `run_tool_safely` (validation + output cap + `is_error`) stops tool failures from crashing and lets the model recover; `consume_and_render` gives UX and interruptibility; `maybe_manage_context` + caching stops overflow and controls cost. Complexity rises (~200 lines → ~700–1000), but each piece maps to a specific line item in the "98.4% harness" ledger.

## What Stage Two achieves — and what's still missing
**Achieves.** A robust, usable coding agent: survives rate limits/overloads/network blips without dying; handles tool failures and malformed output by feeding them back and recovering; runs long multi-hundred-turn tasks via active context management without overflowing or going broke; provides real-time, interruptible UX via streaming with reliable, instrumented tools. You can start it and walk away.

**Still missing (→ Stage Three).** Extensibility via **MCP** (external tools/data instead of hand-writing every tool); **subagents/delegation** (child agents with their own windows for parallelizable or context-heavy subtasks — context management by isolation); **persistent cross-session memory** (the memory tool becomes a first-class durable layer); **real security hardening/sandboxing** (the permission gate here is a usability speed-bump and an allowlist, not a boundary — production needs OS-level isolation, network allowlists, secret hygiene, because allowlists fall to argument-injection and prompt-injection).

## Practical guidance and pitfalls
**Order to add the layers.** (1) Error handling first — crash-vs-not, and cheap. (2) Streaming — unblocks long tasks (10-min timeout), UX, interruption. (3) Tool hardening — validation, error messages, output caps, bash timeouts; where task success rate jumps. (4) Context management last and most carefully — caching first (highest ROI, ~8 lines), then tool-result clearing, then compaction, then file offloading, in cost order.

**Common mistakes, each tied to evidence:** retry storms / double-retry (app retry × SDK retry → 12 requests + silent hangs; one retry owner); over-summarizing / compacting too late (reactive compaction at 95% discards architectural decisions — compact proactively ~60–70% with a structured prompt and rehydration; known bug: some harnesses drop CLAUDE.md on compaction — re-inject every turn); breaking prompt caching with dynamic content (a timestamp/session ID/reordered JSON key in the prefix → cache miss every turn, silently paying full price; watch the >20-block lookback trap in tool-heavy turns); tool output blowing context (one `cat` of a big log adds tens of thousands of tokens — cap and middle-truncate at the tool boundary); streaming bugs (silently-swallowed aborts that look like completed turns — check for clean `message_stop`; `text_delta` on an open `tool_use` block; unhandled unknown event types; summing cumulative `usage` deltas).

**Debugging the robust loop.** Log every request's `usage` (including cache fields) and `stop_reason`; keep the `request-id` header from errors. Use `count_tokens` to trace prefix growth. When caching "isn't working," instrument the hit ratio (`cache_read_input_tokens / total input`) — usual culprit is a volatile field in the prefix, a five-line fix.

**Testing robustness — simulate failures.** Inject `429`/`529`/timeout responses (a local proxy or monkeypatched client) and assert the loop survives and resumes. Feed tools that deliberately raise; confirm the `is_error` result comes back and the model recovers. Drive a synthetic long conversation past the compaction threshold; verify the summary preserves task state. Fuzz tool inputs (missing args, wrong types, nonexistent tool names); confirm no uncaught exceptions.

**Balancing robustness and complexity.** Anthropic: "find the simplest solution possible, and only increase complexity when needed." Build a few high-leverage tools, not a wrapper around every API. Don't add compaction before you've measured you need it; don't add a bespoke retry layer if raising the SDK's `max_retries` suffices. **Stage Two is "done enough" for Stage Three when:** the agent completes a realistic multi-file task end-to-end without a crash; survives an injected rate-limit/overload storm and resumes; runs past at least one compaction cycle with task state intact; tool errors reliably round-trip back to the model; caching hit rate on a multi-turn task is high (>80% of input from cache from turn two); and no class of tool input produces an uncaught exception.

## Recommendations (staged)
1. **Adopt a single retry owner immediately.** Default to the SDK (raise `max_retries` to 4–8 for unattended runs), catch the final typed exception to persist state, add a streaming idle-timeout watchdog. Only write a custom outer loop for `Retry-After` ceilings >60s or user-facing retry indicators — then set SDK `max_retries=0`. Change if request counts spike on transient errors (you have a double-retry; collapse to one layer).
2. **Make every tool fail safe and speak to the model.** Wrap all tool execution in try/except → `is_error` tool_result; validate inputs and paths before executing; return specific, actionable error messages (copy the text-editor tool's phrasing). Cap and middle-truncate all tool output at the boundary (30K chars for bash, 10K for file reads).
3. **Fix editing before anything fancy.** Built-in `text_editor` tool or search/replace with strong errors + whitespace-tolerant fallback; add full-file rewrite for files <400 lines.
4. **Turn on caching before any other context work.** Stabilize the tools→system prefix, place ≤4 breakpoints (last system block + rolling last-message block), verify hit rate via `usage`. Then layer `clear_tool_uses_20250919`; add compaction only when `count_tokens` shows you approaching the reserve threshold. Keep the summarization call on the same cache prefix.
5. **Add a basic permission gate and a hard denylist now; defer real isolation to Stage Three.** Read tools free, writes/bash gated by mode + working-dir boundary, catastrophic patterns hard-blocked. Document explicitly that this is not a security boundary.
6. **Instrument from day one.** Log `usage`, `stop_reason`, cache fields, `request-id`; build failure-injection tests before you need them.

## Caveats
- Specifics change fast: model names, beta headers, tool version strings (`text_editor_20250728`, `clear_tool_uses_20250919`, `compact_20260112`, `memory_20250818`), and SDK constants are moving targets — treat as mid-2026 and verify against current docs. Context editing and compaction are **beta** features requiring beta headers.
- SDK internals are version-dependent: the retry constants and `_calculate_retry_timeout` formula are confirmed from the current `anthropic-sdk-python` source, but line numbers and exact backoff shift between releases; one auto-generated doc erroneously lists `MAX_RETRY_DELAY` as 60s (that 60 is the `Retry-After` acceptance ceiling). Pin your SDK version and re-check.
- Provider-agnostic concepts, Anthropic-specific APIs: the patterns transfer to any provider, but the concrete APIs shown are Anthropic's. On Bedrock/Vertex, prompt caching supports explicit breakpoints but not top-level automatic caching, and some features are first-party only.
- Anthropic's internal-eval numbers (39% context editing + memory, 29% context editing alone, 84% 100-turn token reduction) come from Anthropic's own September 2025 announcement, not independent benchmarks; treat as directional.
- The 1.6%/98.4% figure comes from a systematic audit of Claude Code cited in the HARBOR paper; it's a memorable characterization of one agent's codebase, not a universal law — but the direction (harness dominates) is corroborated by harness-swap benchmarks showing 13–22 point swings on a fixed model (e.g. Opus 4.6's 58.0%→79.8% Terminal-Bench 2.0 swing across harnesses; LangChain's 13.7-point gain from harness tuning alone).