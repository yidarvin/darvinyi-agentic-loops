# Build notes: Evaluating Agents

`ch22` | slug `evaluating-agents` | Part V --- Build Your Own Coding Agent

**Research backbone:** `docs/research/ch22-evaluating-agents.md`. Open this first; it is the factual
source of record for this chapter (numbers, citations, caveats). Shared context for
the whole book is `docs/research/00-survey-overview.md`. Do not contradict the
research doc without reason; verify only genuinely version-sensitive claims (MCP
spec revisions, model and tool releases, framework APIs) against current sources
where web access is available.

## Thesis

The capstone. SWE-bench and SWE-bench Verified with their caveats, eval harness design, task construction, the agent failure taxonomy, and how to measure what this book built: skills, MCP servers, multi-agent systems, and memory.

## Runnable artifact (hard requirement)

A small but real eval harness that scores an agent on a task set and reports results, runnable end to end.

Suggested home: `artifacts/ch22-evaluating-agents/`. It must actually run, with clear
run instructions. Where it needs an API key or an external service, document the
requirement and fail gracefully without it. Wire it into the chapter with the
`<RunnableArtifact>` block.

## Signature widget

Eval dashboard: run the harness and inspect per-task pass/fail with failure-mode tags.

## Depends on

- `stage-three-production-grade`

## Threads

`diy-agent`, `evaluation`
