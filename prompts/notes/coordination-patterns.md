# Build notes: Coordination Patterns

`ch13` | slug `coordination-patterns` | Part III --- Multi-Agent Systems

**Research backbone:** `docs/research/ch13-coordination-patterns.md`. Open this first; it is the factual
source of record for this chapter (numbers, citations, caveats). Shared context for
the whole book is `docs/research/00-survey-overview.md`. Do not contradict the
research doc without reason; verify only genuinely version-sensitive claims (MCP
spec revisions, model and tool releases, framework APIs) against current sources
where web access is available.

## Thesis

Supervisor and hierarchical architectures, agent-to-agent handoff, parallel fan-out and aggregation. LangGraph, CrewAI, and AutoGen surveyed as contrast for how each frames orchestration.

## Runnable artifact (hard requirement)

A parallel subagent fan-out with result aggregation, runnable, showing concurrency and the join.

Suggested home: `artifacts/ch13-coordination-patterns/`. It must actually run, with clear
run instructions. Where it needs an API key or an external service, document the
requirement and fail gracefully without it. Wire it into the chapter with the
`<RunnableArtifact>` block.

## Signature widget

Orchestration graph: an interactive supervisor/worker graph the reader can reconfigure to see routing change.

## Depends on

- `delegation`

## Threads

`multi-agent`
