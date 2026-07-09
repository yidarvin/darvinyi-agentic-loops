# Agentic Coding Tools, Protocols & Patterns: An Implementation-Level Survey

Cross-cutting overview for *Agentic Loops*. This is the broad landscape survey that preceded the per-chapter research docs. It spans the whole book and is useful context for any chapter, but each chapter also has its own dedicated, deeper research doc (ch01–ch22). Current as of 2026; version-pin everything at build time.

## TL;DR
- The field has consolidated around a small, learnable primitive set — a single-threaded tool-use loop, MCP for tool/data connectivity, Skills for procedural knowledge, and file-backed memory to beat context rot — and Claude Code is the reference implementation whose "small loop, large harness" design most repays study; Codex (cloud-sandbox, OS-level sandboxing) and opencode (open, model-agnostic, Go) are the instructive contrasts.
- The hard problems in 2026 are not model capability but context and coordination: context rot degrades every frontier model as input grows; long-horizon runs fail from coherence collapse and error cascades; multi-agent helps only for parallelizable, high-value, read-heavy work (Anthropic's research system: +90.2% but ~15× tokens), and the Berkeley MAST study shows most multi-agent failures are system-design and coordination failures.
- Security and economics are now first-class: MCP's attack surface (tool poisoning, prompt injection through tool results, confused deputy) is real and documented (OWASP MCP Top 10; CVE-2025-6514, a CVSS-9.6 RCE in the mcp-remote proxy disclosed by JFrog); prompt caching is the economic substrate that makes agent loops affordable (cache reads at 0.10× input); and the memory tool + context editing is the emerging standard answer to the finite context window.

## Key findings
1. **MCP is stable at the primitive level and fast-moving at the edges.** Date-versioned: 2024-11-05 (first), 2025-03-26 (OAuth 2.1 + Streamable HTTP replacing HTTP+SSE), 2025-06-18, current stable 2025-11-25, with a 2026-07-28 release candidate in draft. Two standard transports: stdio and Streamable HTTP (old dual-endpoint HTTP+SSE deprecated). Three primitives: tools, resources, prompts.
2. **Skills are the lighter-weight complement to MCP.** A SKILL.md is a directory with YAML frontmatter (~100 tokens preloaded) and a body loaded on match, with bundled files and scripts loaded on demand (progressive disclosure). MCP adds capabilities; a Skill adds knowledge.
3. **Claude Code's architecture is deliberately minimal at the core** — a single-threaded while-loop (nO) with an async steering queue (h2A), a 9-step per-turn pipeline, a 7-mode permission system, a 5-layer compaction pipeline, four extension mechanisms (MCP, plugins, skills, hooks), and subagents that get isolated context and return only summaries.
4. **The competitive landscape splits on execution architecture.** Codex = cloud sandbox / async delegation, OS-level sandboxing (Seatbelt/Landlock); Claude Code = local, interactive, collaborative; opencode = open-source, model-agnostic, persistent server process.
5. **Multi-agent is a targeted tool, not a default.** Excels at parallelizable, high-value, context-exceeding, read-heavy work; fails at tightly-coupled write-heavy work like most coding.
6. **Memory is the frontier.** Context window → session → long-term persistent (episodic vs semantic). Prompt caching, compaction, context editing, the memory tool, and external systems (Letta, Mem0, Zep, LangMem) are the toolkit.
7. **Building an agent from scratch is ~100 lines.** Everything else is harness.
8. **Evaluation is harness-dependent.** SWE-bench Verified dominates but scores conflate model and scaffold.
9. **Long-horizon failure is a first-order concern.** Context rot, coherence collapse, error cascades.

## Details

### MCP
Version history: 2024-11-05 first spec (original HTTP+SSE, two endpoints); 2025-03-26 (OAuth 2.1 framework, Streamable HTTP replacing HTTP+SSE, tool annotations); 2025-06-18; 2025-11-25 current stable (OIDC Discovery, icons metadata, incremental scope consent, Client ID Metadata Documents, URL-mode elicitation, sampling tool-calling, experimental tasks; formalized under the Linux Foundation Agentic AI Foundation; ~110M monthly SDK downloads reported); 2026-07-28 RC in draft (SDK v2 beta targets it).

Wire format: JSON-RPC 2.0 over a transport. **stdio** (newline-delimited JSON-RPC over stdin/stdout, process isolation, single-client, doesn't scale). **Streamable HTTP** (one endpoint supporting POST+GET, optional SSE upgrade, `Mcp-Session-Id` header; MUST validate Origin, SHOULD bind 127.0.0.1 locally). Deprecated HTTP+SSE (dual endpoints, no resumable streams).

Primitives: **tools** (model-controlled actions, POST-like), **resources** (app-controlled read-only, GET-like), **prompts** (user-controlled templates, often slash commands).

Security surface (the most important section for an expert text): prompt injection through tool results; tool poisoning (malicious instructions in tool descriptions/schemas/returns — the WhatsApp-server PoC); confused deputy; cross-server exfiltration; **CVE-2025-6514** (JFrog, July 9 2025, CVSS 9.6 OS command-injection RCE in mcp-remote 0.0.5–0.1.15, fixed 0.1.16). Standards: OWASP MCP Top 10 + Security Cheat Sheet. Mitigations: OAuth 2.1 + OIDC + Client ID Metadata Documents, least privilege, Origin validation, localhost binding, human-in-the-loop tool approval, gateway auth/audit, static tool-metadata analysis.

Context tax: MCP tool descriptions can consume 40–50% of context before real work (Perplexity CTO, Ask 2026); mitigations are the MCP Gateway pattern (lazy-load schemas), Tool Search (defer schemas), and code-execution-with-MCP.

### Skills
SKILL.md: directory with YAML frontmatter (required name + description ≤1024 chars). Progressive disclosure (3 tiers): startup loads name+description (~60–100 tokens/skill); on match the body loads (keep <500 lines); referenced files and scripts load only when needed (scripts executed via Bash, not read into context). Skill vs MCP vs tool: MCP = capability/connection; Skill = procedural knowledge; bare tool = single callable action. They compose. Anthropic ships a skill-creator skill.

### Claude Code internals
Single-threaded while-loop (nO) + async steering queue (h2A). 9-step per-turn pipeline. 7 permission modes (plan → default → acceptEdits → auto → dontAsk → bypassPermissions + internal bubble; deny-first). Built-in tools: Read, Write, Edit, Bash, Glob, LS, Grep, TodoWrite, Task. Subagents (Task tool): fresh context window, initialized only from the prompt, returns only its final response as a summary, depth-limited, cost not reduced (each is a separate full-rate call). Hooks (PreToolUse/PostToolUse/Stop), custom commands, plugins. Context: CLAUDE.md + auto memory + wU2 compaction (~92%). 1M-token window in beta on Sonnet 4.x. (Internal codenames from reverse-engineering, not all officially confirmed.)

### Competitive tools
**Codex** (2025–2026 agent, not the 2021 model): cloud web agent + open-source CLI (Rust+TS, Apache-2.0) + IDE extensions + macOS app; OS-level sandboxing (Seatbelt/Landlock, network off by default); AGENTS.md; delegation + speed ethos. **opencode** (SST; MIT, Go, 75+ providers, no subscription): persistent server process (survives terminal close), TUI, AGENTS.md, model-agnostic is its differentiator. **Cursor**: Agent/Composer mode. **Aider**: tree-sitter repo map + NetworkX PageRank; edit formats (whole/diff/diff-fenced/udiff/patch); auto-commits with Conventional Commits; architect/editor mode (two models). **Orchestration frameworks**: LangGraph (graph/state-machine, checkpointing), CrewAI (role-based crews), AutoGen/AG2 (conversational, event-driven), OpenAI Agents SDK (handoffs), Google ADK+A2A (hierarchical + inter-agent protocol).

### Multi-agent
Patterns: orchestrator-worker, supervisor, hierarchical. Context isolation is the key design decision. Anthropic research system: lead Opus + Sonnet subagents "+90.2% on our internal research eval," agents ~4× and multi-agent ~15× chat tokens; on BrowseComp token usage explained ~80% of variance. Poor fit for coding. **Berkeley MAST** (Cemri et al., arXiv:2503.13657, NeurIPS 2025): 14 failure modes across 3 categories (specification/system-design, inter-agent misalignment, task verification/termination), built from 1,600+ traces across 7 frameworks, κ=0.88; thesis "Beyond Model Capabilities: The Primacy of System Design." When multi-agent helps: read tasks parallelize, write tasks don't; justified only when task value covers the 15× multiplier. **A2A** (Google, Apr 2025, donated to Linux Foundation Jun 2025): Agent Cards, Tasks lifecycle, HTTP+SSE+JSON-RPC. MCP = agent-to-tool; A2A = agent-to-agent.

### Memory
Taxonomy: context window (working) → session/short-term → long-term persistent (episodic vs semantic). **Prompt caching** (Anthropic): prefix cache over tools→system→messages, up to 4 breakpoints; cache write 1.25× (5m) / 2× (1h), read 0.10× (90% discount); min 1,024 tokens. **Compaction / context editing / memory tool**: context editing (`clear_tool_uses_20250919`, beta header `context-management-2025-06-27`); memory tool (`memory_20250818`, GA Sept 29 2025, client-side `/memories` directory persisting across sessions). Combined impact (Anthropic internal): +39% memory+editing, +29% editing alone, 84% token reduction over 100 turns. **External systems**: Letta/MemGPT (OS-inspired virtual context paging: core/recall/archival), Mem0 (extract→consolidate→retrieve), Zep/Graphiti (temporal knowledge graph with validity windows), LangMem.

### Building your own agent
Minimal loop (Anthropic Messages API): define tools as JSON-schema dicts; loop create → if stop_reason == "tool_use" append assistant turn, execute tool_use blocks, append tool_result blocks, repeat until plain-text stop. **mini-swe-agent** (~100 lines, >74% SWE-bench Verified, bash-only). Progression: conversation memory, planning, retries with backoff, token accounting, permissions/approval, sandboxing (OS-level or containers), MCP client integration, subagents, streaming. Reference: the Claude Agent SDK (same loop + built-in tools + context management as Claude Code).

### Evaluation
SWE-bench (Jimenez et al. 2024): 2,294 real GitHub issue-commit pairs. SWE-bench Lite (300), SWE-bench Verified (500, human-validated — dominant), SWE-bench Pro (multi-step). Harness dependence is central: a score measures model + scaffold; isolate the model with minimal bash-only mini-swe-agent. Complementary: Terminal-Bench, LiveCodeBench, HumanEval (saturated). Memory-specific: LoCoMo, LongMemEval, BEAM (vendor scores disagree — run your own).

### Tool-call and context mechanics
Tool schemas and tool_use/tool_result blocks serialize into the prompt (JSON), counting against the window and cache prefix. Order matters for caching (tools→system→messages). Why loops fail: context rot (Chroma, 18 models — performance grows unreliable as input grows, even below the limit); coherence collapse / self-conditioning; error cascades; empirical long-horizon degradation. Mitigations: just-in-time retrieval, sub-agent isolation, specification discipline, independent verifier/judge agents.

## Recommendations
1. Anchor every chapter on primitive-then-harness: teach the ~100-line loop first, then show each Claude Code subsystem as a harness layer.
2. Treat context as the master constraint throughout; make prompt caching, compaction, context editing, and the memory tool a load-bearing chapter.
3. Frame multi-agent as a cost/benefit decision with explicit thresholds (shuffle-invariant subtasks, task value covering ~15× tokens, read-heavy work); use MAST as the failure checklist.
4. Make MCP security a dedicated chapter (tool poisoning, injection through tool results, confused deputy, CVE-2025-6514, OWASP MCP Top 10).
5. Use Codex and opencode as structured contrasts on execution locus and model coupling; Aider for edit-format and repo-context engineering.
6. Cover memory systems as competing architectures (Letta paging, Mem0 extract-consolidate, Zep temporal graph, the native Anthropic stack); insist readers run their own evals.
7. Version-pin everything (MCP date-versioned, SDKs adopt at their own pace, beta headers gate features).

## Caveats
- Fast-moving, version-sensitive field. MCP spec dates, SDK majors, model names, and Claude Code versions churn on a weeks-to-months cadence.
- Active debates: single vs multi-agent; whether bigger context windows help long-horizon agents; MCP transport design; whether MCP's context tax justifies gateways/code-execution.
- Benchmark numbers are frequently self-reported and harness-dependent; present SWE-bench figures with the harness caveat.
- Claude Code internal codenames (nO, h2A, wU2) and the 9-step pipeline come from reverse-engineering, corroborated but not all officially confirmed. Codex/opencode internals are documented more thinly than Claude Code's.