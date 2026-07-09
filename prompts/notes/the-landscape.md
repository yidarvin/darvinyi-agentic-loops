# Build notes: The Landscape

`ch04` | slug `the-landscape` | Part I --- Foundations of the Agentic Loop

**Research backbone:** `docs/research/ch04-the-landscape.md`. Open this first; it is the factual
source of record for this chapter (numbers, citations, caveats). Shared context for
the whole book is `docs/research/00-survey-overview.md`. Do not contradict the
research doc without reason; verify only genuinely version-sensitive claims (MCP
spec revisions, model and tool releases, framework APIs) against current sources
where web access is available.

## Thesis

Claude Code, Codex, and opencode as points in a design space. What each optimizes and where the philosophies diverge. Deliberately not a feature list. Orientation for the rest of the book.

## Runnable artifact (hard requirement)

A comparison harness that runs the same small task under different tool postures and surfaces the difference in loop behavior, not just output.

Suggested home: `artifacts/ch04-the-landscape/`. It must actually run, with clear
run instructions. Where it needs an API key or an external service, document the
requirement and fail gracefully without it. Wire it into the chapter with the
`<RunnableArtifact>` block.

## Signature widget

Design-space map: an interactive positioning of the tools across axes (autonomy, context strategy, extensibility) with rationale on selection.

## Depends on

- `the-loop`

## Threads

`landscape`
