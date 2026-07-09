# Build notes: Context-Window Economics

`ch03` | slug `context-window-economics` | Part I --- Foundations of the Agentic Loop

**Research backbone:** `docs/research/ch03-context-window-economics.md`. Open this first; it is the factual
source of record for this chapter (numbers, citations, caveats). Shared context for
the whole book is `docs/research/00-survey-overview.md`. Do not contradict the
research doc without reason; verify only genuinely version-sensitive claims (MCP
spec revisions, model and tool releases, framework APIs) against current sources
where web access is available.

## Thesis

The master constraint that explains most downstream design decisions. Token accounting, the cost curve, what fills a window and how fast. Sets up both Part IV (memory) and the multi-agent cost arguments.

## Runnable artifact (hard requirement)

A context-budget analyzer that takes a running session and decomposes the window by category (system, tools, history, results) with token counts and cost.

Suggested home: `artifacts/ch03-context-window-economics/`. It must actually run, with clear
run instructions. Where it needs an API key or an external service, document the
requirement and fail gracefully without it. Wire it into the chapter with the
`<RunnableArtifact>` block.

## Signature widget

Context-budget visualizer: a live stacked breakdown of a window that the reader can perturb to see how fast categories grow.

## Depends on

- `anatomy-of-a-tool-call`

## Threads

`context`, `economics`
