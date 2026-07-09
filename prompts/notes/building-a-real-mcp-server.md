# Build notes: Building a Real MCP Server

`ch08` | slug `building-a-real-mcp-server` | Part II --- Extending the Agent: MCP and Skills

**Research backbone:** `docs/research/ch08-building-a-real-mcp-server.md`. Open this first; it is the factual
source of record for this chapter (numbers, citations, caveats). Shared context for
the whole book is `docs/research/00-survey-overview.md`. Do not contradict the
research doc without reason; verify only genuinely version-sensitive claims (MCP
spec revisions, model and tool releases, framework APIs) against current sources
where web access is available.

## Thesis

Beyond the toy: lifecycle, error handling, official SDK patterns, a server that does something genuine.

## Runnable artifact (hard requirement)

A production-shaped MCP server backed by a real integration (not echo), with proper lifecycle and error handling, runnable locally.

Suggested home: `artifacts/ch08-building-a-real-mcp-server/`. It must actually run, with clear
run instructions. Where it needs an API key or an external service, document the
requirement and fail gracefully without it. Wire it into the chapter with the
`<RunnableArtifact>` block.

## Signature widget

Live server console: invoke the server's tools and inspect structured results and errors.

## Depends on

- `transports`
- `resources-tools-and-prompts`

## Threads

`mcp`
