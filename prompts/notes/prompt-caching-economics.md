# Build notes: Prompt Caching and the Economics of Remembering

`ch16` | slug `prompt-caching-economics` | Part IV --- Memory

**Research backbone:** `docs/research/ch16-prompt-caching-economics.md`. Open this first; it is the factual
source of record for this chapter (numbers, citations, caveats). Shared context for
the whole book is `docs/research/00-survey-overview.md`. Do not contradict the
research doc without reason; verify only genuinely version-sensitive claims (MCP
spec revisions, model and tool releases, framework APIs) against current sources
where web access is available.

## Thesis

How prompt caching works, cache breakpoints, TTL, and how it reshapes agent design once accounted for. The load-bearing practical memory chapter.

## Runnable artifact (hard requirement)

A cached-versus-uncached benchmark over the same workload that reports the cost and latency delta with real numbers.

Suggested home: `artifacts/ch16-prompt-caching-economics/`. It must actually run, with clear
run instructions. Where it needs an API key or an external service, document the
requirement and fail gracefully without it. Wire it into the chapter with the
`<RunnableArtifact>` block.

## Signature widget

Cache-economics calculator: adjust breakpoints and hit rate and see the cost curve move.

## Depends on

- `memory-taxonomy`

## Threads

`memory`, `economics`
