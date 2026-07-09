# Build notes: The MCP Security Surface

`ch09` | slug `mcp-security-surface` | Part II --- Extending the Agent: MCP and Skills

**Research backbone:** `docs/research/ch09-mcp-security-surface.md`. Open this first; it is the factual
source of record for this chapter (numbers, citations, caveats). Shared context for
the whole book is `docs/research/00-survey-overview.md`. Do not contradict the
research doc without reason; verify only genuinely version-sensitive claims (MCP
spec revisions, model and tool releases, framework APIs) against current sources
where web access is available.

## Thesis

Prompt injection through tool results, the confused-deputy problem, token-theft and command-injection vulnerability classes from recent security research, OAuth and auth patterns, and mitigations. The chapter most treatments skip.

## Runnable artifact (hard requirement)

A deliberately vulnerable MCP server paired with its hardened counterpart, so the reader can run the exploit and then the mitigation.

Suggested home: `artifacts/ch09-mcp-security-surface/`. It must actually run, with clear
run instructions. Where it needs an API key or an external service, document the
requirement and fail gracefully without it. Wire it into the chapter with the
`<RunnableArtifact>` block.

## Signature widget

Attack/defense toggle: flip a server between vulnerable and hardened and watch a malicious tool result get neutralized.

## Depends on

- `building-a-real-mcp-server`

## Threads

`mcp`, `security`
