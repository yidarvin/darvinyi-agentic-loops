# Build notes: Stage Three: Production-Grade

`ch21` | slug `stage-three-production-grade` | Part V --- Build Your Own Coding Agent

**Research backbone:** `docs/research/ch21-stage-three-production-grade.md`. Open this first; it is the factual
source of record for this chapter (numbers, citations, caveats). Shared context for
the whole book is `docs/research/00-survey-overview.md`. Do not contradict the
research doc without reason; verify only genuinely version-sensitive claims (MCP
spec revisions, model and tool releases, framework APIs) against current sources
where web access is available.

## Thesis

MCP client support so the agent consumes the Part II servers, subagents so it delegates, plus streaming, permissions, and sandboxing. The synthesis chapter that pulls the book together.

## Runnable artifact (hard requirement)

The stage-three agent: MCP-capable and subagent-capable, with streaming, a permissions model, and sandboxing, runnable on macOS.

Suggested home: `artifacts/ch21-stage-three-production-grade/`. It must actually run, with clear
run instructions. Where it needs an API key or an external service, document the
requirement and fail gracefully without it. Wire it into the chapter with the
`<RunnableArtifact>` block.

## Signature widget

Capability panel: toggle MCP, subagents, and sandboxing and see the agent's behavior and safety envelope change.

## Depends on

- `stage-two-real-loop`
- `building-a-real-mcp-server`
- `delegation`

## Threads

`diy-agent`, `mcp`, `multi-agent`
