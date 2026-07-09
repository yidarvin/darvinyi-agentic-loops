# Build notes: The Loop

`ch01` | slug `the-loop` | Part I --- Foundations of the Agentic Loop

**Research backbone:** `docs/research/ch01-the-loop.md`. Open this first; it is the factual
source of record for this chapter (numbers, citations, caveats). Shared context for
the whole book is `docs/research/00-survey-overview.md`. Do not contradict the
research doc without reason; verify only genuinely version-sensitive claims (MCP
spec revisions, model and tool releases, framework APIs) against current sources
where web access is available.

## Thesis

The agentic primitive: perceive, decide, act, observe. Why 'agent' names the loop, not the model. The minimal viable loop as the mental anchor for the whole book.

## Runnable artifact (hard requirement)

A ~100-line agent loop over the Messages API that logs each phase (perceive, decide, act, observe) as it iterates. The reader can run it and watch the loop turn.

Suggested home: `artifacts/ch01-the-loop/`. It must actually run, with clear
run instructions. Where it needs an API key or an external service, document the
requirement and fail gracefully without it. Wire it into the chapter with the
`<RunnableArtifact>` block.

## Signature widget

Loop-state visualizer that steps through the four phases with the live message list at each step.

## Depends on

Nothing. This is an entry point into the book.

## Threads

`the-loop`
