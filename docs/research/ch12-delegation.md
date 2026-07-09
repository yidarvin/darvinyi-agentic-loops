# Delegation: The Foundational Mechanic of Multi-Agent LLM Systems

Research reference for *Agentic Loops*, Chapter 12 (opens Part III, Multi-Agent Systems; followed by "Coordination Patterns" and "When Multi-Agent Fails"). Current as of 2026. The reader understands the agent loop, context economics, tool calls, MCP, and skills. This chapter establishes the delegation mechanic deeply but leaves elaborate coordination topologies and failure analysis to the next two chapters. Version-gated details drift; version-pin and re-verify. Note that headline benchmarks are Anthropic's own internal evals.

## TL;DR
- Delegation is fundamentally a context-engineering move, not just a parallelism trick. A lead/orchestrator spawns subagents — each invoked like a tool that happens to be another agent loop with its own clean context window — so the messy intermediate work burns the subagent's context and only a distilled result returns. Anthropic's Claude Agent SDK docs list context isolation first among the benefits.
- It works, and the numbers are concrete but expensive. Anthropic's multi-agent research system (Opus 4 lead + Sonnet 4 subagents) beat single-agent Opus 4 by 90.2% on their internal research eval and cut research time up to 90% via parallelism — but multi-agent systems burn ~15× the tokens of a chat, so delegation only pays off on high-value, parallelizable, breadth-first tasks.
- The mechanic is standardized across stacks: Claude Code / Claude Agent SDK (the `Agent`/`Task` tool, markdown-defined subagents), OpenAI Agents SDK (`Agent.as_tool()` manager pattern and `handoff()`), LangGraph (`create_supervisor`). All expose subagents as tool calls. The central unresolved tension (Cognition's "Don't Build Multi-Agents") is that tasks with shared context and coupled write-decisions resist delegation and should stay single-threaded.

## What delegation is and why it exists
The single-agent loop has a hard ceiling: one finite context window that accumulates every tool result, reasoning step, failed attempt, and long document. Delegation is the response: a **lead** decomposes a task and spawns **subagents** to handle pieces; each runs its own agent loop with its own context window and returns a result. Anthropic: "A multi-agent system consists of multiple agents (LLMs autonomously using tools in a loop) working together."

Four coupled motivations: **(a) context isolation** (each subagent has a clean context, so the lead's isn't polluted — the deepest reason); **(b) parallelism** (independent subtasks run simultaneously); **(c) specialization** (specific tools, prompts, models); **(d) separation of concerns** — Anthropic: "distinct tools, prompts, and exploration trajectories — which reduces path dependency and enables thorough, independent investigations."

The unifying frame — and this chapter's thesis — is that **delegation is fundamentally a context-engineering move.** Anthropic's "Effective context engineering" post lists multi-agent architectures as one of three long-horizon context strategies (with compaction and note-taking): "the detailed search context remains isolated within sub-agents, while the lead agent focuses on synthesizing and analyzing the results." Parallelism is a benefit, but the reason a single agent can't just work sequentially in one window is that its context would rot. "The essence of search is compression: distilling insights from a vast corpus."

## Architecture: orchestrator-worker
Anthropic's Research system "uses a multi-agent architecture with an orchestrator-worker pattern, where a lead agent coordinates the process while delegating to specialized subagents that operate in parallel." Lifecycle: user query → spawn **LeadResearcher** → it thinks and **saves its plan to Memory to persist context** (context >200k tokens gets truncated; losing the plan is catastrophic) → **spawns specialized subagents** (diagram shows two, "but it can be any number") with specific tasks → each independently searches, evaluates with interleaved thinking, and **returns findings** → LeadResearcher synthesizes and decides whether to spawn more → findings pass to a **CitationAgent** → final report to user.

Mechanically key: **the subagent is invoked like a tool that happens to be another agent.** In Claude Code / the Claude Agent SDK this is the `Agent` tool (renamed from `Task` in Claude Code v2.1.63; both names appear for compatibility). The lead emits a `tool_use` block naming the Agent tool with a `subagent_type` and a `prompt`; the runtime spins up an isolated agent loop; the tool result is the subagent's final message.

The subagent's context starts fresh but not empty. Per the SDK docs, a non-fork subagent receives: its own system prompt + environment details, the delegation prompt (task message), CLAUDE.md/memory hierarchy, a git-status snapshot, and any preloaded skills. It does **not** receive the parent's conversation history, tool results, or system prompt. "The only channel from parent to subagent is the Agent tool's prompt string, so include any file paths, error messages, or decisions the subagent needs directly in that prompt."

## Context isolation as the core benefit
Why isolated windows matter: a single agent degrades as context fills — not because the model changed, but because signal-to-noise collapsed. Three compounding mechanisms: **lost in the middle** (Liu et al. 2024, tested on NaturalQuestions-Open: U-shaped accuracy by position, >30% drop when relevant info sits mid-context; replicated across GPT-3.5-Turbo, GPT-4, Claude 1.3, LongChat-13B, MPT-30B, Cohere Command; rooted in RoPE long-term decay); **attention dilution** (quadratic self-attention spreads a fixed budget across n² pairs); **distractor interference** (similar-but-irrelevant content misleads).

Chroma's 2025 report (Hong, Kelly; Troynikov, Anton; Huber, Jeff, "Context Rot," research.trychroma.com/context-rot) tested 18 frontier models (incl. GPT-4.1, Claude 4 Opus/Sonnet, Gemini 2.5 Pro/Flash, Qwen3) and found every one degrades as input length increases, at every increment — even far below the nominal limit. Notably Chroma did *not* see the classic U-shaped pattern (no consistent needle-position advantage) — context degradation is broader than any single positional artifact.

Delegation solves this structurally: the subagent burns its context on the messy work — reading dozens of files, running failing tests, backtracking — and returns only the clean result. Claude Code docs: "a `research-assistant` subagent can explore dozens of files without any of that content accumulating in the main conversation. The parent receives a concise summary, not every file the subagent read." Human analogy (exact, worth stating): a manager who delegates doesn't watch every keystroke — they get the memo. Cognition's Walden Yan, even while arguing against most multi-agent designs, concedes the benefit: "all the subagent's investigative work does not need to remain in the history of the main agent, allowing for longer traces before running out of context."

Underappreciated corollary (Cognition, April 2026): a clean context doesn't just save space, it can make the subagent *smarter*. Their Devin code-review loop works best when the coding and review agents share **no** context beforehand — the reviewer "gets to skip this extraneous context, only look at the diff, and re-discover any context it needs as it reads the code from scratch. With a shorter context, the improved intelligence naturally leads to increased detection of nuanced issues." Per "Multi-Agents: What's Actually Working," "even on PRs written by Devin, Devin Review catches an average of 2 bugs per PR, of which roughly 58% are severe."

## Parallelism and its benefits
Independent subtasks run concurrently: multiple sources, multiple directories, multiple options. Anthropic's headline: a multi-agent system (Opus 4 lead + Sonnet 4 subagents) "outperformed single-agent Claude Opus 4 by 90.2% on our internal research eval." The illustrative case: asked to identify all board members of the S&P 500 IT companies, "the multi-agent system found the correct answers by decomposing this into tasks for subagents, while the single agent system failed... with slow, sequential searches." Two layers of parallelization (lead spins up 3–5 subagents in parallel; each uses 3+ tools in parallel) "cut research time by up to 90% for complex queries."

**Cost tradeoff is the central caveat.** "Agents typically use about 4× more tokens than chat interactions, and multi-agent systems use about 15× more tokens than chats. For economic viability, multi-agent systems require tasks where the value... is high enough to pay for the increased performance." They excel at "valuable tasks that involve heavy parallelization, information that exceeds single context windows, and interfacing with numerous complex tools," and fit poorly where all agents must share context or there are many dependencies — "most coding tasks involve fewer truly parallelizable tasks than research, and LLM agents are not yet great at coordinating and delegating to other agents in real time." (Token usage alone explained ~80% of performance variance on BrowseComp; multi-agent architectures "effectively scale token usage.")

## Specialization
Four axes: **system prompt / role** (a `code-reviewer`/`debugger`/`data-scientist` gets focused instructions that would be "unnecessary noise in the main agent's instructions"); **tool restrictions** (a `doc-reviewer` limited to Read and Grep "can analyze but never accidentally modify"; Claude Code's built-in Explore and Plan agents are read-only); **model choice** (route "to faster, cheaper models like Haiku"; the `model` field accepts `sonnet`/`opus`/`haiku`/`fable`/a full ID/`inherit`); **effort / thinking budget** (an `effort` frontmatter field, `low`…`max`).

A Claude Code custom subagent is a markdown file with YAML frontmatter in `.claude/agents/` (project) or `~/.claude/agents/` (user):
```markdown
---
name: code-reviewer
description: Expert code review specialist. Proactively reviews code for quality, security, and maintainability. Use immediately after writing or modifying code.
tools: Read, Grep, Glob, Bash
model: inherit
---
You are a senior code reviewer ensuring high standards of code quality and security.
When invoked:
1. Run git diff to see recent changes
2. Focus on modified files
3. Begin review immediately
...
Provide feedback organized by priority:
- Critical issues (must fix)
- Warnings (should fix)
- Suggestions (consider improving)
```
Only `name` and `description` are required; the `description` is what the lead uses to decide when to delegate. Dynamic model selection by stakes is first-class (a factory returning `model="opus" if is_strict else "sonnet"`).

## How delegation actually works — implementations
**Claude Code / Claude Agent SDK.** Subagents defined three ways: programmatically (the `agents` parameter in `query()`), as markdown files, or via the built-in `general-purpose` subagent. The `Agent` tool must be in `allowedTools`. Programmatic (Python):
```python
from claude_agent_sdk import query, ClaudeAgentOptions, AgentDefinition
async for message in query(
    prompt="Review the authentication module for security issues",
    options=ClaudeAgentOptions(
        allowed_tools=["Read", "Grep", "Glob", "Agent"],  # Agent tool required
        agents={
            "code-reviewer": AgentDefinition(
                description="Expert code review specialist. Use for quality, security reviews.",
                prompt="You are a code review specialist...",
                tools=["Read", "Grep", "Glob"],  # read-only
                model="sonnet",
            ),
        },
    ),
):
    if hasattr(message, "result"):
        print(message.result)
```
`AgentDefinition` fields: `description` (required), `prompt` (required), `tools` (optional; inherits all if omitted), `model` (`sonnet`/`opus`/`haiku`/`inherit`). Constraints: **subagents cannot spawn their own subagents in the SDK** (don't include `Agent` in a subagent's tools) — though Claude Code as of v2.1.172 supports nested subagents to a fixed depth of five. Claude delegates automatically from the `description`, or explicitly when named.

**Anthropic's multi-agent research architecture** is the reference orchestrator-worker implementation (LeadResearcher + parallel subagents + CitationAgent, plan persisted to Memory).

**OpenAI Agents SDK** — two idioms:
- **Agents-as-tools (manager pattern):** the orchestrator retains control and calls specialists via `Agent.as_tool()`. The sub-agent runs as an isolated nested `Runner.run()` — it receives only the tool input the orchestrator generates, not the conversation history — and returns its result to the manager, which owns the final answer.
```python
from agents import Agent
booking_agent = Agent(name="Booking agent", ...)
refund_agent = Agent(name="Refund agent", ...)
customer_facing_agent = Agent(
    name="Customer-facing agent",
    instructions="Handle all direct user communication. Call the relevant tools when specialized expertise is needed.",
    tools=[
        booking_agent.as_tool(tool_name="booking_expert", tool_description="Handles booking questions."),
        refund_agent.as_tool(tool_name="refund_expert", tool_description="Handles refund questions."),
    ],
)
```
  By default `as_tool()` returns the sub-agent's final text output. For result compression it accepts a `custom_output_extractor` — an async callable receiving the nested `RunResult` and returning a `str` — so you extract/reformat/validate before it reaches the orchestrator.
- **Handoffs:** control transfers entirely to a specialist that takes over the conversation. Implemented as a tool call named `transfer_to_<agent_name>`; the receiving agent sees the full history by default (adjustable via `input_filter`). Decentralized/peer-to-peer. Use handoffs "when routing itself is part of the workflow"; use agents-as-tools "when a specialist should help with a bounded subtask but should not take over the user-facing conversation."

**LangGraph** — `create_supervisor` routes to workers via prebuilt handoff tools. Notably, by default `create_handoff_tool` passes the **full message history** to the worker (opposite of Claude Code's isolation default); `create_forward_message_tool` forwards a worker's message verbatim to output, which "saves tokens for the supervisor and avoids potential misrepresentation of the worker's response through paraphrasing."

Universal thread: **subagents are exposed to the orchestrator as tools** — Claude's `Agent`, OpenAI's `as_tool()`/`transfer_to_X`, LangGraph's handoff tools. Delegation reuses the tool-calling mechanism; the subagent is a tool whose implementation is another agent loop.

## Designing effective delegation
Anthropic's single most important lesson: **"Teach the orchestrator how to delegate."** Because the subagent doesn't share the lead's context, each needs "an objective, an output format, guidance on the tools and sources to use, and clear task boundaries. Without detailed task descriptions, agents duplicate work, leave gaps, or fail to find necessary information." Failure example: with vague instructions ("research the semiconductor shortage"), "one subagent explored the 2021 automotive chip crisis while 2 others duplicated work investigating current 2025 supply chains, without an effective division of labor."

**Scale effort to complexity.** Anthropic embeds explicit rules in prompts: "Simple fact-finding requires just 1 agent with 3-10 tool calls, direct comparisons might need 2-4 subagents with 10-15 calls each, and complex research might use more than 10 subagents with clearly divided responsibilities" — countering the early failure of "spawning 50 subagents for simple queries."

**Delegate vs inline** (Claude Code rule): use the main conversation when the task needs frequent back-and-forth, when multiple phases share significant context, for quick targeted changes, or when latency matters (subagents start fresh and need time to gather context). Use subagents when output is verbose and unneeded in the main context, when you want tool restrictions, or when the work is self-contained and can return a summary.

**Avoid over-delegation.** Overhead is real: extra tokens, latency (a fresh subagent must re-gather context), prompt-passing cost. OpenAI: "start with one agent whenever you can. Add specialists only when they materially improve capability isolation, policy isolation, prompt clarity, or trace legibility. Splitting too early creates more prompts, more traces, and more approval surfaces without necessarily making the workflow better."

## What to return — result compression
The design decision that determines whether delegation delivers its benefit. **If a subagent returns its full context, you lose the entire benefit.** The return must be distilled. Mechanically, in Claude Code "the parent receives the subagent's final message verbatim as the Agent tool result, but may summarize it in its own response" — so the compression discipline lives in the subagent's system prompt (instruct it to return a structured, distilled summary, not a transcript).

Advanced pattern (Anthropic) for high-fidelity/large outputs: **direct-to-filesystem artifacts.** "Rather than requiring subagents to communicate everything through the lead agent, implement artifact systems where specialized agents can create outputs that persist independently. Subagents call tools to store their work in external systems, then pass lightweight references back to the coordinator. This prevents information loss during multi-stage processing and reduces token overhead from copying large outputs through conversation history." Minimizes the "game of telephone"; works well for code, reports, data visualizations. The OpenAI SDK operationalizes compression via `custom_output_extractor`; LangGraph via `create_forward_message_tool` (verbatim, avoiding lossy re-paraphrasing). All three converge: **the return channel is a compression boundary; design it deliberately.**

## Tradeoffs and when to delegate
**Costs:** token overhead (~15× chat); latency (offset by parallelism but incurred on cold-start context gathering); coordination complexity; difficulty passing context to isolated subagents; risk of subagents duplicating work or misunderstanding tasks.
**Helps:** parallelizable breadth-first tasks; tasks needing context isolation; clear independent decomposition; information exceeding a single window; read-only exploration.
**Hurts:** tightly coupled tasks; tasks needing shared context; tasks where parallel write-decisions conflict; simple tasks where overhead dominates.

This is where the genuine debate lives (and where the next chapters take over). **Cognition's "Don't Build Multi-Agents" (Walden Yan, June 2025)** is the sharpest counterpoint. Two principles: (1) "Share context, and share full agent traces, not just individual messages"; (2) "Actions carry implicit decisions, and conflicting decisions carry bad results." The Flappy Bird example: parallel subagents building the background and the bird produce visually incompatible assets because "subagent 1 and subagent 2 cannot see what the other was doing." His 2025 conclusion: prefer single-threaded linear agents, escalating to a context-compressing model only for very long tasks.

The tension resolves (worth previewing) in Cognition's April 2026 follow-up, "Multi-Agents: What's Actually Working," conceding "a narrower class of patterns that do" work: "setups where multiple agents contribute intelligence to a task while writes stay single-threaded." Through-line: "multi-agent systems work best today when writes stay single-threaded and the additional agents contribute intelligence rather than actions." Both Anthropic and Cognition converge on read-only subagents as the first safe application — exactly the delegation mechanic this chapter describes.

Academic backstop — UC Berkeley **MAST** (Cemri et al., "Why Do Multi-Agent LLM Systems Fail?", arXiv:2503.13657, last revised Oct 2025; NeurIPS 2025 Datasets & Benchmarks). Developed from 150 traces (inter-annotator Cohen's κ = 0.88), scaled into MAST-Data ("1600+ annotated traces across 7 popular MAS frameworks"). 14 failure modes in 3 categories, measured distribution ~specification/system-design 41.8%, inter-agent misalignment 36.9%, verification failures 21.3% — many failures stem from organizational design, not raw model limits. The natural spine for the failure chapter.

Architectural note that reframes the default hierarchy: Anthropic's April 2026 **Advisor Strategy** inverts big-delegates-to-small — a cheap executor (Sonnet/Haiku) drives the loop and consults Opus only when stuck. Delegation flowing *upward*; "who delegates to whom" is itself a design variable.

## Recommendations (staged)
1. **Default to a single agent; delegate only when a concrete threshold is crossed:** one agent with all tools plateaus below target despite prompt iteration, OR the task is demonstrably breadth-first with independent subtasks, OR intermediate work would overflow/rot the window. Otherwise the ~15× cost and coordination complexity aren't worth it.
2. **Treat delegation as context engineering first:** before spawning, ask "what context pollution am I preventing?" If "none — the subagent needs everything the lead has," prefer inline work or a shared-context pattern.
3. **Invest disproportionately in the delegation prompt and return contract:** give every subagent an explicit objective, output format, tool/source guidance, boundaries; embed effort-scaling rules in the orchestrator prompt (1 agent / 3–10 calls for fact-finding; 2–4 for comparisons; 10+ only for genuinely complex research); instruct subagents to return distilled structured summaries, never transcripts.
4. **Use the return channel as a compression boundary:** structured summaries; for large/structured artifacts (code, reports), write to the filesystem and return references. OpenAI SDK: `custom_output_extractor`. LangGraph: `create_forward_message_tool` for verbatim forwarding.
5. **Specialize with the cheapest sufficient model and narrowest sufficient tool set:** route read-only exploration to Haiku-class with read-only tools; reserve Opus-class for hard reasoning or the lead; restrict subagent tools by default.
6. **Keep writes single-threaded** (Cognition + Anthropic): parallel subagents for read/exploration/analysis; funnel all state-mutating actions through one thread until models coordinate write-decisions reliably.

**Benchmarks that should change your approach:** if per-task value can't absorb ~15× token cost, don't go multi-agent. If subtasks have hidden interdependencies (Flappy Bird), collapse to single-threaded. If a subagent's return bloats the lead's context, tighten the return contract before adding more agents.

## Caveats
- Numbers are Anthropic's own internal evals: the 90.2% improvement and 15×/4× multiples come from their Research-system engineering blog (June 2025), reflecting their internal research eval and BrowseComp; not independent third-party benchmarks; 90.2% is specific to breadth-first research, not coding/general tasks.
- Fast-moving, version-dependent: Claude Code subagent behavior (`Task`→`Agent`, background-by-default, nested subagents, Explore defaults) changed across late-2025–2026 releases; verify against current version. Framework defaults differ in ways that matter: Claude Code isolates context by default, LangGraph's default handoff passes full history.
- The single-vs-multi debate is genuinely unresolved for coupled tasks: Cognition and Anthropic agree read-only subagents are the safe zone and shared-context coupled-write tasks resist delegation today; they differ on how far to push structured delegation. This chapter establishes only the mechanic.
- Some sourcing is secondary: the OpenAI `as_tool()` default return behavior is partly from source-code analysis and community issues (the `custom_output_extractor` signature is documented officially); Advisor Strategy figures come from launch materials and secondary coverage.