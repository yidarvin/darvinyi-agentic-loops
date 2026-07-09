# Context-Window Economics: The Master Constraint of Agent Engineering

Research reference for *Agentic Loops*, Chapter 3. Current as of July 2026. Pricing, model names, tokenizer behavior, and context-management identifiers change frequently — validate all numbers against current Anthropic docs at build time.

## TL;DR
- The context window is a finite, zero-sum, per-turn-re-billed budget, and treating it as the master constraint explains nearly every agent design pattern downstream — prompt caching, compaction, context editing, retrieval, sub-agents, memory tools, and token-efficient tool design are all responses to it. As of July 2026 on the Anthropic Messages API, Claude Opus 4.8 costs $5/$25 per million input/output tokens, Sonnet 4.6 costs $3/$15, and Haiku 4.5 costs $1/$5, with cached reads at 10% of input price and cache writes at 1.25×–2×.
- Bigger windows are not a free lunch: Chroma's "Context Rot" study (18 models incl. GPT-4.1, Claude 4, Gemini 2.5, Qwen3) shows every model degrades non-uniformly as input grows, well below the hard limit; effective usable context is commonly ~50–65% of the advertised window, and practitioners cap working context near ~40% capacity.
- Agents are token-hungry: Anthropic reports agents use ~4× and multi-agent systems ~15× the tokens of chat; cost grows quadratically because each turn re-sends the full history.

## Key findings
1. **The window is one shared, zero-sum budget.** Everything counts: system prompt, tool definitions, conversation history, tool results, retrieved documents, thinking tokens, and the generated output. Anthropic: "Everything in the request counts toward the context window: the system prompt, every message in messages (including tool results, images, and documents), and your tool definitions. The output Claude generates for the turn, including its extended thinking, counts too."
2. **Cost is quadratic-ish over a session** because the API is stateless and each turn re-sends the entire accumulated history. A naive N-step loop processes ~N(N+1)/2 × (per-turn tokens); a 20-step loop with ~2K new tokens/turn processes ~420K tokens, ~10× the naive linear estimate.
3. **Context rot is real and measurable.** Degradation is a gradient, not a cliff, and appears in all frontier models.
4. **The 1M-token window is now standard on current Claude models** at flat pricing, but effective usable context lags advertised capacity, and filling a huge window is slower and quadratically expensive.
5. **Instrumentation is a first-class discipline:** the `count_tokens` endpoint, the `usage` object's cache fields, and Claude Code's `/context` breakdown make the budget observable.

## Details

### 1. The context window as a finite, shared resource
Ordered components on the Anthropic Messages API: **tool definitions → system prompt → message history (including tool results, images, documents) → the current turn → the model's output (including thinking tokens).** Growth dynamics:
- **System prompt:** roughly fixed. Claude Code's is ~2.3K–3.6K tokens.
- **Tool definitions:** fixed per configuration but can be enormous. Claude Code's ~23–27 built-in tools cost ~14K–17.6K tokens. MCP compounds fast: GitHub's official MCP server measured at ~17.6K–55K tokens; a five-server setup (~58 tools) ~55K tokens before the conversation; Anthropic reports seeing up to 134K tokens of tool definitions before optimization. One Apideck deployment: three MCP servers (~40 tools) consumed 143,000 of 200,000 tokens (72%) before the first user message.
- **Conversation history:** grows monotonically, re-sent every turn.
- **Tool results:** fastest-growing category in coding agents.
- **Thinking/reasoning tokens:** count toward the window, billed as output.
- **Output:** subtracts from available space (Opus 4.8 max output 128K; Sonnet 4.6 32K standard).

### 2. Token accounting in precise detail
**Tokenization is model-specific.** Claude Opus 4.7/4.8, Sonnet 5, Fable 5, Mythos 5 use a newer tokenizer producing ~30% more tokens for the same text than earlier models (Anthropic guidance: 1.0×–1.35× multiplier, worst for code, structured data, non-English). List pricing unchanged, but effective cost per request can rise.

**The token-counting endpoint.** `POST /v1/messages/count_tokens` accepts the same structured payload (system, messages, tools, images, PDFs) and returns `input_tokens`. Free, separately rate-limited, must use the exact model. Do **not** use `tiktoken` (OpenAI's tokenizer; undercounts Claude ~15–20% on text, more on code).

```python
from anthropic import Anthropic
client = Anthropic()

def count(messages, system=None, tools=None, model="claude-opus-4-8"):
    kwargs = {"model": model, "messages": messages}
    if system: kwargs["system"] = system
    if tools:  kwargs["tools"] = tools
    return client.messages.count_tokens(**kwargs).input_tokens

base  = count([{"role":"user","content":"hi"}])
withT = count([{"role":"user","content":"hi"}], tools=my_tools)
print("tool-definition cost:", withT - base)
```

**Input vs output asymmetry.** Output costs 5× input across current Claude models. Verbose reasoning and chatty tool outputs are disproportionately expensive; caching only affects input, never output.

**Per-turn cumulative structure.** Each call is stateless; the agent re-sends the whole conversation every turn. Billed input grows quadratically: cumulative input ≈ (per-turn increment) × N(N+1)/2. A 20-step loop at ~1K tokens/step ≈ 210K cumulative input tokens, not 20K.

### 3. The economics
Pricing (Anthropic API, July 2026, per million tokens):

| Model | Input | Output | Cache write (5m / 1h) | Cache read |
|---|---|---|---|---|
| Haiku 4.5 | $1.00 | $5.00 | $1.25 / $2.00 | $0.10 |
| Sonnet 4.6 | $3.00 | $15.00 | $3.75 / $6.00 | $0.30 |
| Opus 4.8 | $5.00 | $25.00 | $6.25 / $10.00 | $0.50 |

Cache reads are 0.1× base input (90% discount); 5-min writes 1.25×; 1-hour writes 2×. Batch API discounts both input and output 50%. The 1M-token window is available on Opus 4.8/4.7/4.6 and Sonnet 4.6/5 at flat standard pricing (no long-context premium as of the March 2026 GA; the earlier beta billed >200K at 2× input / 1.5× output). Opus pricing dropped 67% from the Opus 4.1 era ($15/$75).

**Worked example — long single-agent coding run (Sonnet 4.6, no caching):** 40 turns, ~3K new tokens/turn. Cumulative input ≈ 3K × 40×41/2 = 2.46M → ~$7.38 input; plus ~60K output → ~$0.90. Total ≈ $8.3, matching reported $5–8 per complex agentic coding task. **With caching:** a ~30K stable prefix hit each turn costs 0.1× on reads (~$0.09/turn → ~$0.009/turn on the prefix), ~90% cut on the cached portion — but the growing conversation tail dominates long loops and is only partially cacheable.

**Agent vs chat multipliers.** Anthropic: "agents typically use about 4× more tokens than chat interactions, and multi-agent systems use about 15× more tokens than chats." On BrowseComp, "token usage by itself explains 80% of the variance"; their multi-agent system "outperformed single-agent Claude Opus 4 by 90.2% on our internal research eval" — justified only where task value covers the 15× multiplier.

### 4. Context rot and degradation
Foundational result: Chroma's **"Context Rot: How Increasing Input Tokens Impacts LLM Performance"** (Hong, Troynikov, Huber; July 2025), 18 models including GPT-4.1, Claude 4, Gemini 2.5, Qwen3: "models do not use their context uniformly; instead, their performance grows increasingly unreliable as input length grows." Even on trivial tasks. Findings: it's not window overflow (a 200K model degrades at 50K); semantics matter (low needle-question similarity accelerates degradation); distractors compound non-uniformly; models do better on shuffled than logically structured haystacks; on LongMemEval full ~113K inputs all models did worse than focused ~300-token inputs; Claude models showed the largest focused-vs-full gap (conservative abstention) and lowest hallucination, GPT the highest confident-wrong rate; Claude "decays the slowest overall."

Grounded in **"Lost in the Middle"** (Liu et al., TACL 2024, doi:10.1162/tacl_a_00638): "performance is often highest when relevant information occurs at the beginning or end… significantly degrades when models must access relevant information in the middle." Anthropic's framing ("Effective context engineering"): transformer attention creates n² pairwise relationships, so attention is a finite budget with diminishing returns, "a performance gradient rather than a hard cliff."

**Advertised vs effective window.** NVIDIA's RULER defines effective length as the longest input clearing an 85.6% threshold and finds most models' effective context well below claimed (GPT-4-1106 claims 128K, effective 64K); heuristic ~50–65% of advertised. Opus 4.6 was a step-change (76% on MRCR v2 finding 8 needles across 1M tokens, up from 18.5% prior).

### 5. What fills context fastest in real coding agents
Tool result outputs dominate — a single file read can be tens of thousands of tokens; command output, test logs, search results, screenshots accumulate and persist for the rest of the session unless cleared. Anthropic restricts Claude Code tool responses to 25,000 tokens by default and warns when MCP output exceeds 10,000 (`MAX_MCP_OUTPUT_TOKENS`, default 25,000). Agents "fall apart after a few tool calls" because each result is re-sent every subsequent turn, accumulated results push the working set into the context-rot zone, and eventually the loop fills its own window until there's no room to reason.

### 6. The master-constraint thesis
Every major pattern is a response to the constraint:
- **Prompt caching** amortizes the re-sent prefix. Strict prefix cache over `tools → system → messages`, up to 4 `cache_control` breakpoints; any byte change before a breakpoint invalidates everything after. Reads 0.1× input; 5-min TTL refreshes on hit. Place a stable breakpoint on system+tools (1h TTL for cross-user sharing) and a rolling one near the tail (respect the 20-block lookback, add intermediate breakpoints ~every 18 blocks). ProjectDiscovery went 7%→74–84% hit rate mainly by relocating dynamic content out of the prefix.
- **Compaction / summarization** reclaims space. Claude Code preserves architectural decisions, unresolved bugs, implementation details, and the five most recently accessed files. Server-side compaction: `compact_20260112` (beta header `compact-2026-01-12`, configurable threshold, min 50K).
- **Context editing** clears old tool results while preserving the record. `clear_tool_uses_20250919` (beta header `context-management-2025-06-27`) drops old results past a threshold, keeps N recent, replaces cleared content with placeholders. Runs server-side after prompt-cache lookup, so it preserves cache prefixes. Also `clear_thinking_20251015`. Reports via `context_management.applied_edits`.
- **Retrieval / just-in-time context** pages in only what's needed (file paths, queries, links; load at runtime via glob/grep/head/tail).
- **Sub-agent context isolation** gives each subagent a clean window; it may burn tens of thousands of tokens exploring but returns only a ~1,000–2,000-token summary.
- **Memory tools** externalize state. `memory_20250818`, a client-side file store under `/memories` persisting across sessions.
- **ACI discipline / token-efficient tools.** Return only high-signal info, drop low-level identifiers, support `response_format: concise|detailed`, keep a minimal non-overlapping tool set. Tool Search (GA Feb 2026) defers definitions via `defer_loading: true`, cutting definition tokens ~85% (Opus 4.5 MCP-eval 79.5%→88.1%). Code execution with MCP achieves up to 98.7% token reduction (150K→2K).

**Quantified payoff.** Anthropic (Sept 2025): "combining the memory tool with context editing improved performance by 39% over baseline. Context editing alone delivered a 29% improvement" on an internal agentic-search eval; "in a 100-turn web search evaluation, context editing enabled agents to complete workflows that would otherwise fail… while reducing token consumption by 84%." Self-reported internal evals, not independent benchmarks.

### 7. Long-context model behavior
1M-token window GA on Opus 4.8/4.7/4.6 and Sonnet 4.6, always-on for Sonnet 5, flat pricing (no beta header, no surcharge as of March 13, 2026; the old `context-1m-2025-08-07` header retired for Sonnet 4/4.5 on April 30, 2026). Three constraints: effective ≪ advertised (Gemini 3 Pro scores 77% on 8-needle MRCR at 128K, 26.3% at 1M — a ~50-point cliff); speed (TTFT grows with context); economics (quadratic to attend, re-billed each turn). "A 200K window filled with precisely relevant code outperforms a 1M window filled with an entire repository." Claude Code auto-compacts before the window fills (~967K default on Sonnet 5; ~83.5% with a ~33K buffer on 200K).

### 8. Practical measurement and budgeting
Three observability layers: pre-flight `count_tokens`; post-response `usage` object (`input_tokens` is *uncached only* — total input = `input_tokens + cache_read_input_tokens + cache_creation_input_tokens`; also `cache_creation.ephemeral_5m_input_tokens`/`ephemeral_1h_input_tokens`); category breakdown (Claude Code's `/context`: system prompt, system tools, MCP tools, custom agents, memory files, messages, reserved buffer, free space).

```python
BUDGET = 0.40 * 200_000     # ~40% capacity cap
resp = client.messages.create(model="claude-sonnet-4-6", max_tokens=4096,
                              system=SYS, tools=TOOLS, messages=history)
u = resp.usage
used = u.input_tokens + u.cache_read_input_tokens + u.cache_creation_input_tokens
if used > BUDGET:
    history = compact_or_evict(history)
```

**Budget heuristics:** ~40% rule (quality degrades past ~40% of the window — a starting heuristic, not a law; some argue onset is an absolute band ~32K–100K); keep system prompts lean; prefer one-session-per-task with clearing between tasks; set explicit per-run token/cost budgets and circuit breakers (critical for multi-agent, where 15× compounds); route by difficulty (Haiku for classification/extraction/routing, Sonnet workhorse, Opus hardest reasoning).

## Recommendations
1. **Instrument before optimizing.** Add `count_tokens` pre-flight checks; log the full `usage` breakdown; build a `/context`-style per-category decomposition. Act if tool definitions exceed ~10% of the window or free space drops below ~30–40%.
2. **Attack re-send cost with caching.** 1h-TTL breakpoint on stable system+tools; rolling 5m breakpoint near the tail; relocate volatile content after the last breakpoint. Target ≥80% cache hit rate; below ~50% means dynamic content is polluting the prefix.
3. **Reclaim space actively.** Enable server-side context editing tuned to your revisit pattern; pair with the memory tool; enable server-side compaction. Highest-leverage fix if agents fail from exhaustion (Anthropic: +29% editing alone, +39% with memory, 84% token reduction over 100 turns).
4. **Restructure when single-window management isn't enough.** Move exploration into sub-agents with isolated windows; adopt just-in-time retrieval; prune tools and enable Tool Search / code-execution-with-MCP.
5. **Govern cost.** Per-run and per-session token budgets with hard stops; route by difficulty; use the Batch API (50% off) for non-interactive work; cap working context near ~40%. Re-evaluate model and architecture whenever per-task cost exceeds the value produced.

## Caveats
- **Version-specific, fast-moving numbers.** All pricing as of July 2026; the newer tokenizer (Opus 4.7+, Sonnet 5) can raise effective token counts ~30% for identical text. Validate on your own workload.
- **Vendor vs independent evidence.** The 4×/15× multipliers, 90.2% win, and 29%/39%/84% gains are Anthropic's internal evals. Context rot (Chroma), lost-in-the-middle (Liu et al.), and RULER (NVIDIA) are independent. Vendor NIAH scores overstate real long-context capability.
- **Active debates.** Fixed percentage (~40%) vs absolute token band (~32K–100K) for degradation onset; compaction vs hard clearing for long tasks; safety of mutating an agent's working memory mid-loop (cleared content can orphan later reasoning).
- **Cache fragility.** TTL defaults have silently changed in production; tool-set or model changes mid-session invalidate caches; SDK usage-accounting bugs can double-count. Verify with raw `usage` fields.