# Build notes: When Multi-Agent Fails

`ch14` | slug `when-multi-agent-fails` | Part III --- Multi-Agent Systems

**Research backbone:** `docs/research/ch14-when-multi-agent-fails.md`. Open this first; it is the factual
source of record for this chapter (numbers, citations, caveats). Shared context for
the whole book is `docs/research/00-survey-overview.md`. Do not contradict the
research doc without reason; verify only genuinely version-sensitive claims (MCP
spec revisions, model and tool releases, framework APIs) against current sources
where web access is available.

## Thesis

The rigorous core of the part. Coordination cost, the empirical question of when multi-agent helps versus adding latency and expense, and the MAST failure taxonomy as a structured way to reason about breakdowns.

## Runnable artifact (hard requirement)

An instrumented multi-agent run that exposes a real coordination failure, with the diagnosis and the fix runnable side by side.

Suggested home: `artifacts/ch14-when-multi-agent-fails/`. It must actually run, with clear
run instructions. Where it needs an API key or an external service, document the
requirement and fail gracefully without it. Wire it into the chapter with the
`<RunnableArtifact>` block.

## Signature widget

Failure taxonomy explorer: map an observed breakdown onto MAST categories and see the corresponding mitigation.

## Depends on

- `coordination-patterns`

## Threads

`multi-agent`
