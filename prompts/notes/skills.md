# Build notes: Skills

`ch10` | slug `skills` | Part II --- Extending the Agent: MCP and Skills

**Research backbone:** `docs/research/ch10-skills.md`. Open this first; it is the factual
source of record for this chapter (numbers, citations, caveats). Shared context for
the whole book is `docs/research/00-survey-overview.md`. Do not contradict the
research doc without reason; verify only genuinely version-sensitive claims (MCP
spec revisions, model and tool releases, framework APIs) against current sources
where web access is available.

## Thesis

What a SKILL.md actually is, the frontmatter, progressive disclosure, and the discovery and triggering mechanics.

## Runnable artifact (hard requirement)

A real, well-authored skill with correct frontmatter and progressive disclosure that the reader can drop in and trigger.

Suggested home: `artifacts/ch10-skills/`. It must actually run, with clear
run instructions. Where it needs an API key or an external service, document the
requirement and fail gracefully without it. Wire it into the chapter with the
`<RunnableArtifact>` block.

## Signature widget

Skill anatomy viewer: hover the parts of a SKILL.md to see how each drives discovery and loading.

## Depends on

- `the-loop`

## Threads

`skills`
