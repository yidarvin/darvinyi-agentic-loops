# Build notes: Stage One: The Thin Wrapper

`ch19` | slug `stage-one-thin-wrapper` | Part V --- Build Your Own Coding Agent

**Research backbone:** `docs/research/ch19-stage-one-thin-wrapper.md`. Open this first; it is the factual
source of record for this chapter (numbers, citations, caveats). Shared context for
the whole book is `docs/research/00-survey-overview.md`. Do not contradict the
research doc without reason; verify only genuinely version-sensitive claims (MCP
spec revisions, model and tool releases, framework APIs) against current sources
where web access is available.

## Thesis

A CLI over the API with a REPL. The smallest thing that deserves to be called a coding agent, on macOS.

## Runnable artifact (hard requirement)

The stage-one agent: a runnable macOS CLI REPL that talks to the API and maintains a conversation.

Suggested home: `artifacts/ch19-stage-one-thin-wrapper/`. It must actually run, with clear
run instructions. Where it needs an API key or an external service, document the
requirement and fail gracefully without it. Wire it into the chapter with the
`<RunnableArtifact>` block.

## Signature widget

REPL walkthrough: an annotated transcript the reader can step through to see the wrapper's control flow.

## Depends on

- `the-loop`

## Threads

`diy-agent`
