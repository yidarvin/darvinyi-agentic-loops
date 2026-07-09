# Build notes: Skill or Server

`ch11` | slug `skill-or-server` | Part II --- Extending the Agent: MCP and Skills

**Research backbone:** `docs/research/ch11-skill-or-server.md`. Open this first; it is the factual
source of record for this chapter (numbers, citations, caveats). Shared context for
the whole book is `docs/research/00-survey-overview.md`. Do not contradict the
research doc without reason; verify only genuinely version-sensitive claims (MCP
spec revisions, model and tool releases, framework APIs) against current sources
where web access is available.

## Thesis

The design decision: when a skill beats an MCP server and vice versa, and the hybrid. Authoring skills well.

## Runnable artifact (hard requirement)

A skill-plus-server hybrid that solves one problem both ways, with the tradeoff made explicit in code and runnable both paths.

Suggested home: `artifacts/ch11-skill-or-server/`. It must actually run, with clear
run instructions. Where it needs an API key or an external service, document the
requirement and fail gracefully without it. Wire it into the chapter with the
`<RunnableArtifact>` block.

## Signature widget

Decision matrix: an interactive chooser that maps problem characteristics to skill, server, or hybrid.

## Depends on

- `mcp-security-surface`
- `skills`

## Threads

`skills`, `mcp`
