# Build notes: Retrieval as Memory

`ch17` | slug `retrieval-as-memory` | Part IV --- Memory

**Research backbone:** `docs/research/ch17-retrieval-as-memory.md`. Open this first; it is the factual
source of record for this chapter (numbers, citations, caveats). Shared context for
the whole book is `docs/research/00-survey-overview.md`. Do not contradict the
research doc without reason; verify only genuinely version-sensitive claims (MCP
spec revisions, model and tool releases, framework APIs) against current sources
where web access is available.

## Thesis

Vector stores, embeddings, RAG for agent memory, the actual database options and patterns, and where retrieval helps versus where it quietly fails.

## Runnable artifact (hard requirement)

A retrieval-backed memory layer over a real vector store that the agent queries during a run, fully runnable.

Suggested home: `artifacts/ch17-retrieval-as-memory/`. It must actually run, with clear
run instructions. Where it needs an API key or an external service, document the
requirement and fail gracefully without it. Wire it into the chapter with the
`<RunnableArtifact>` block.

## Signature widget

Retrieval inspector: issue a query and see what gets retrieved, ranked, and injected into context.

## Depends on

- `memory-taxonomy`

## Threads

`memory`, `retrieval`
