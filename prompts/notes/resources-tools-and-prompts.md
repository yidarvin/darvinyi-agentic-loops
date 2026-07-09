# Build notes: Resources, Tools, and Prompts

`ch07` | slug `resources-tools-and-prompts` | Part II --- Extending the Agent: MCP and Skills

**Research backbone:** `docs/research/ch07-resources-tools-and-prompts.md`. Open this first; it is the factual
source of record for this chapter (numbers, citations, caveats). Shared context for
the whole book is `docs/research/00-survey-overview.md`. Do not contradict the
research doc without reason; verify only genuinely version-sensitive claims (MCP
spec revisions, model and tool releases, framework APIs) against current sources
where web access is available.

## Thesis

The three MCP primitives, their exact semantics, and when to reach for each.

## Runnable artifact (hard requirement)

One server exposing all three primitives with a client walkthrough exercising each in turn.

Suggested home: `artifacts/ch07-resources-tools-and-prompts/`. It must actually run, with clear
run instructions. Where it needs an API key or an external service, document the
requirement and fail gracefully without it. Wire it into the chapter with the
`<RunnableArtifact>` block.

## Signature widget

Primitive explorer: pick a primitive and see its request/response shape and intended use.

## Depends on

- `mcp-from-the-wire-up`

## Threads

`mcp`
