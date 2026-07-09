# Build notes: Anatomy of a Tool Call

`ch02` | slug `anatomy-of-a-tool-call` | Part I --- Foundations of the Agentic Loop

**Research backbone:** `docs/research/ch02-anatomy-of-a-tool-call.md`. Open this first; it is the factual
source of record for this chapter (numbers, citations, caveats). Shared context for
the whole book is `docs/research/00-survey-overview.md`. Do not contradict the
research doc without reason; verify only genuinely version-sensitive claims (MCP
spec revisions, model and tool releases, framework APIs) against current sources
where web access is available.

## Thesis

From token to execution and back. How function calls are represented to and emitted by the model, parsed, dispatched, and how results re-enter context. Messages API tool-use mechanics concretely.

## Runnable artifact (hard requirement)

A tool-call tracer that runs a real tool-use exchange and prints the raw representation of each tool_use and tool_result block, showing exactly what the model sees.

Suggested home: `artifacts/ch02-anatomy-of-a-tool-call/`. It must actually run, with clear
run instructions. Where it needs an API key or an external service, document the
requirement and fail gracefully without it. Wire it into the chapter with the
`<RunnableArtifact>` block.

## Signature widget

Interactive tool-call inspector: toggle between the rendered view and the raw block/token view of a call and its result.

## Depends on

- `the-loop`

## Threads

`the-loop`
