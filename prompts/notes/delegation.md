# Build notes: Delegation

`ch12` | slug `delegation` | Part III --- Multi-Agent Systems

**Research backbone:** `docs/research/ch12-delegation.md`. Open this first; it is the factual
source of record for this chapter (numbers, citations, caveats). Shared context for
the whole book is `docs/research/00-survey-overview.md`. Do not contradict the
research doc without reason; verify only genuinely version-sensitive claims (MCP
spec revisions, model and tool releases, framework APIs) against current sources
where web access is available.

## Thesis

Subagents and the Task tool, how context isolation works and why it is the whole point, and the orchestrator-worker pattern as the foundational structure.

## Runnable artifact (hard requirement)

A working orchestrator that dispatches an isolated subagent and returns the result, with the context boundary observable.

Suggested home: `artifacts/ch12-delegation/`. It must actually run, with clear
run instructions. Where it needs an API key or an external service, document the
requirement and fail gracefully without it. Wire it into the chapter with the
`<RunnableArtifact>` block.

## Signature widget

Isolation viewer: watch the parent and subagent contexts side by side and see what does and does not cross the boundary.

## Depends on

- `context-window-economics`

## Threads

`multi-agent`
