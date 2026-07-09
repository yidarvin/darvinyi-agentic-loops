# Build notes: Stage Two: The Real Loop

`ch20` | slug `stage-two-real-loop` | Part V --- Build Your Own Coding Agent

**Research backbone:** `docs/research/ch20-stage-two-real-loop.md`. Open this first; it is the factual
source of record for this chapter (numbers, citations, caveats). Shared context for
the whole book is `docs/research/00-survey-overview.md`. Do not contradict the
research doc without reason; verify only genuinely version-sensitive claims (MCP
spec revisions, model and tool releases, framework APIs) against current sources
where web access is available.

## Thesis

Tool dispatch, planning, error handling and retries, file and shell tools. The wrapper becomes an agent.

## Runnable artifact (hard requirement)

The stage-two agent with a working tool suite (file and shell), planning, and retry handling, runnable on macOS.

Suggested home: `artifacts/ch20-stage-two-real-loop/`. It must actually run, with clear
run instructions. Where it needs an API key or an external service, document the
requirement and fail gracefully without it. Wire it into the chapter with the
`<RunnableArtifact>` block.

## Signature widget

Tool-dispatch tracer: watch the agent select, call, and recover from tools across a task.

## Depends on

- `stage-one-thin-wrapper`
- `anatomy-of-a-tool-call`

## Threads

`diy-agent`
