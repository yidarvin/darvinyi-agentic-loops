# Build notes: MCP from the Wire Up

`ch05` | slug `mcp-from-the-wire-up` | Part II --- Extending the Agent: MCP and Skills

**Research backbone:** `docs/research/ch05-mcp-from-the-wire-up.md`. Open this first; it is the factual
source of record for this chapter (numbers, citations, caveats). Shared context for
the whole book is `docs/research/00-survey-overview.md`. Do not contradict the
research doc without reason; verify only genuinely version-sensitive claims (MCP
spec revisions, model and tool releases, framework APIs) against current sources
where web access is available.

## Thesis

The protocol and its JSON-RPC underpinnings, the initialization handshake and capability negotiation, spec version history through the recent revisions.

## Runnable artifact (hard requirement)

A minimal MCP server and client that complete the handshake and exchange framed messages the reader can inspect on the wire.

Suggested home: `artifacts/ch05-mcp-from-the-wire-up/`. It must actually run, with clear
run instructions. Where it needs an API key or an external service, document the
requirement and fail gracefully without it. Wire it into the chapter with the
`<RunnableArtifact>` block.

## Signature widget

Handshake sequence diagram that animates the initialize/capabilities exchange message by message.

## Depends on

- `anatomy-of-a-tool-call`

## Threads

`mcp`
