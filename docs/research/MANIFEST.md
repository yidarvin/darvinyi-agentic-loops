# Research Corpus Manifest — Agentic Loops

Tracks the per-chapter research documents in `docs/research/`. Each chapter in the book gets one dedicated research doc, consulted when that chapter is built. The broad survey (`00-survey-overview.md`) is cross-cutting context for the whole book.

Status legend: DONE = deep research complete and written. PENDING = not yet researched.

## Cross-cutting
- `00-survey-overview.md` — DONE — broad implementation-level survey spanning the whole book.

## Part I — Foundations of the Agentic Loop
- ch01 — The Loop — DONE — `ch01-the-loop.md`
- ch02 — Anatomy of a Tool Call — DONE — `ch02-anatomy-of-a-tool-call.md`
- ch03 — Context-Window Economics — DONE — `ch03-context-window-economics.md`
- ch04 — The Landscape — DONE — `ch04-the-landscape.md`

## Part II — Extending the Agent (MCP and Skills)
- ch05 — MCP from the Wire Up — DONE — `ch05-mcp-from-the-wire-up.md`
- ch06 — Transports — DONE — `ch06-transports.md`
- ch07 — Resources, Tools, and Prompts — DONE — `ch07-resources-tools-and-prompts.md`
- ch08 — Building a Real MCP Server — DONE — `ch08-building-a-real-mcp-server.md`
- ch09 — The MCP Security Surface — DONE — `ch09-mcp-security-surface.md`
- ch10 — Skills — DONE — `ch10-skills.md`
- ch11 — Skill or Server — DONE — `ch11-skill-or-server.md`

## Part III — Multi-Agent Systems
- ch12 — Delegation — DONE — `ch12-delegation.md`
- ch13 — Coordination Patterns — DONE — `ch13-coordination-patterns.md`
- ch14 — When Multi-Agent Fails — DONE — `ch14-when-multi-agent-fails.md`

## Part IV — Memory
- ch15 — The Memory Taxonomy — DONE — `ch15-memory-taxonomy.md`
- ch16 — Prompt Caching and the Economics of Remembering — DONE — `ch16-prompt-caching-economics.md`
- ch17 — Retrieval as Memory — DONE — `ch17-retrieval-as-memory.md`
- ch18 — Self-Managed Memory — DONE — `ch18-self-managed-memory.md`

## Part V — Build Your Own Coding Agent
- ch19 — Stage One: The Thin Wrapper — DONE — `ch19-stage-one-thin-wrapper.md`
- ch20 — Stage Two: The Real Loop — DONE — `ch20-stage-two-real-loop.md`
- ch21 — Stage Three: Production-Grade — DONE — `ch21-stage-three-production-grade.md`
- ch22 — Evaluating Agents (capstone) — DONE — `ch22-evaluating-agents.md`

## Summary
- Done: 22 of 22 chapter docs (ch01–ch22) plus the cross-cutting survey. **The research corpus is COMPLETE.** All five Parts are fully researched (Part I ch01–ch04, Part II ch05–ch11, Part III ch12–ch14, Part IV ch15–ch18, Part V ch19–ch22).
- Pending: none. 23 files total in `docs/research/` (survey + 22 chapters), plus this manifest.

## Using this corpus
The corpus is complete, so no further research is required to build the book. Each chapter's research doc is the source material for authoring that chapter. During the build (see `INITIAL_PROMPT.md`), Claude Code should open the matching `docs/research/chNN-*.md` before writing a chapter, treat it as the factual backbone (numbers, citations, caveats), and then author the chapter in house style. If a chapter needs a fact the doc does not cover, Claude Code can supplement with its own research, but the doc is the primary reference and should not be contradicted without reason.

When a doc is completed, flip its status here from PENDING to DONE.
