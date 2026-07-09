# Build notes: The Memory Taxonomy

`ch15` | slug `memory-taxonomy` | Part IV --- Memory

**Research backbone:** `docs/research/ch15-memory-taxonomy.md`. Open this first; it is the factual
source of record for this chapter (numbers, citations, caveats). Shared context for
the whole book is `docs/research/00-survey-overview.md`. Do not contradict the
research doc without reason; verify only genuinely version-sensitive claims (MCP
spec revisions, model and tool releases, framework APIs) against current sources
where web access is available.

## Thesis

Working versus short-term versus long-term, episodic versus semantic. Mapping the concepts precisely before implementing, picking up the context-window thread from Chapter 3.

## Runnable artifact (hard requirement)

A session harness that runs the same interaction under different memory regimes so the reader can compare behavior directly.

Suggested home: `artifacts/ch15-memory-taxonomy/`. It must actually run, with clear
run instructions. Where it needs an API key or an external service, document the
requirement and fail gracefully without it. Wire it into the chapter with the
`<RunnableArtifact>` block.

## Signature widget

Memory-regime switcher: toggle regimes and watch what the agent retains or forgets across turns.

## Depends on

- `context-window-economics`

## Threads

`memory`, `context`
