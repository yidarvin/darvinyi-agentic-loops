# Build notes: Transports

`ch06` | slug `transports` | Part II --- Extending the Agent: MCP and Skills

**Research backbone:** `docs/research/ch06-transports.md`. Open this first; it is the factual
source of record for this chapter (numbers, citations, caveats). Shared context for
the whole book is `docs/research/00-survey-overview.md`. Do not contradict the
research doc without reason; verify only genuinely version-sensitive claims (MCP
spec revisions, model and tool releases, framework APIs) against current sources
where web access is available.

## Thesis

stdio versus SSE versus Streamable HTTP. Message framing, the tradeoffs, when each is correct.

## Runnable artifact (hard requirement)

The same MCP server exposed over two transports with a switchable client, so the reader can watch identical calls travel differently.

Suggested home: `artifacts/ch06-transports/`. It must actually run, with clear
run instructions. Where it needs an API key or an external service, document the
requirement and fail gracefully without it. Wire it into the chapter with the
`<RunnableArtifact>` block.

## Signature widget

Transport comparison: side-by-side framing view of one call over stdio vs HTTP.

## Depends on

- `mcp-from-the-wire-up`

## Threads

`mcp`
