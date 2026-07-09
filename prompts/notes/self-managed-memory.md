# Build notes: Self-Managed Memory

`ch18` | slug `self-managed-memory` | Part IV --- Memory

**Research backbone:** `docs/research/ch18-self-managed-memory.md`. Open this first; it is the factual
source of record for this chapter (numbers, citations, caveats). Shared context for
the whole book is `docs/research/00-survey-overview.md`. Do not contradict the
research doc without reason; verify only genuinely version-sensitive claims (MCP
spec revisions, model and tool releases, framework APIs) against current sources
where web access is available.

## Thesis

The memory-tool pattern where the agent maintains persistent notes across runs, context editing and compaction, and summarization as the window fills. Letta/MemGPT paging, Mem0, and Zep surveyed as architectures.

## Runnable artifact (hard requirement)

An agent that writes and reads its own persistent memory across sessions, demonstrating recall on a second run.

Suggested home: `artifacts/ch18-self-managed-memory/`. It must actually run, with clear
run instructions. Where it needs an API key or an external service, document the
requirement and fail gracefully without it. Wire it into the chapter with the
`<RunnableArtifact>` block.

## Signature widget

Memory-file timeline: watch the agent's persistent notes get written, compacted, and reloaded across sessions.

## Depends on

- `prompt-caching-economics`
- `retrieval-as-memory`

## Threads

`memory`
