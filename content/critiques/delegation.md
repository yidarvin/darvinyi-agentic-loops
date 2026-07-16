verdict: revise

## Round 1 review (2026-07-16)

Fresh-eyes review: read `prompts/critique-rubric.md`, the absent prior critique history (this is round 1), `src/chapters/delegation.mdx`, `DelegationFigure.tsx`, `DelegationWidget.tsx`, the full `artifacts/ch12-delegation/` artifact and its fixture, `docs/research/ch12-delegation.md`, and the linked primary sources. Ran `npm run check` successfully, including the delegation artifact gate, Vitest, typecheck, build, and lint; also exercised `--compare`, `--show-boundary`, `--leak`, `--test`, and the no-key `--live` fallback. Browser-level inspection was unavailable because no browser backend was present, so the widget was checked through its source and render gate. I checked Anthropic's multi-agent and context-engineering posts, the current Claude Code subagent docs, Liu et al., Chroma's Context Rot report, Cognition's two posts, the OpenAI Agents SDK docs, and the current LangChain multi-agent material.

## Required fixes

1. **`src/chapters/delegation.mdx`, `src/chapters/_figures/DelegationFigure.tsx`, and the artifact documentation/model --- the chapter's central "only channel" contract is false as stated.** The prose says the Agent prompt string is the only parent-to-subagent channel and that the parent receives the final message verbatim (`delegation.mdx:51-58,129-134`); the figure repeats "the only way in/back" (`DelegationFigure.tsx:76-97`). Current [Claude Code subagent documentation](https://code.claude.com/docs/en/sub-agents) says a non-fork also starts with its own system/environment details, `CLAUDE.md` and memory hierarchy, a git-status snapshot, preloaded skills, and sometimes a sibling roster; named agents can use `SendMessage`, resumed agents retain history, and output scanning can add markers before Claude reads a report. Scope the model consistently to a one-shot, non-fork, no-message delegation and call the prompt the task-specific briefing, not the sole transport. Show or state the inherited baseline context and qualify the return contract. The artifact may keep its intentionally narrower simulation, but it must label that simulation rather than attribute the absolute rule to Claude Code.
2. **`artifacts/ch12-delegation/delegate.py`, its README, and `delegation.mdx:173-184` --- `--live` is not a real Claude subagent.** `live_summarize()` performs one `anthropic.Anthropic().messages.create()` call after the parent has concatenated the entire fixture corpus (`delegate.py:121-145`); it invokes neither Claude Code nor the Agent SDK's Agent tool and runs no tool-using agent loop. That contradicts the chapter and README promise that `--live` swaps in a real Claude subagent. Either implement that claimed runtime or relabel this path precisely as a one-shot live model stand-in while retaining the offline boundary model.
3. **`src/chapters/delegation.mdx:24-35` --- correct the two source-backed long-context claims.** [Liu et al.](https://ar5iv.labs.arxiv.org/html/2307.03172) quantify the cited GPT-3.5 multi-document-QA positional drop as more than 20%, not the chapter's more-than-30% assertion; use the supported number or identify a specific plotted model/condition that supports a different one. [Chroma's report](https://www.trychroma.com/research/context-rot) reports broad degradation but also a local GPT-4 Turbo performance peak and says not all 18 models appear in every experiment. Replace "every model degraded ... at every increment" with the report's qualified finding.
4. **`src/chapters/delegation.mdx:251-253` --- repair the LangGraph source link.** The listed legacy URL resolves only to a redirect and no longer documents the claimed handoff implementation. Replace it with the current official [LangChain multi-agent documentation](https://docs.langchain.com/oss/python/langchain/multi-agent) or its [handoffs page](https://docs.langchain.com/oss/python/langchain/multi-agent/handoffs), and ensure the surrounding claim matches the replacement source.

## Advisories

- `delegate.py --test` checks three representative file-body markers rather than every fixture body. It is a meaningful deterministic test for the fixed fixture, but an exhaustive assertion would make its proof stronger.

## Builder resolution (2026-07-16)

Regression gate: read the complete critique history, including `git log -p -- content/critiques/delegation.md`. Round 1 is the only review round, so its four REQUIRED fixes are the complete prior required set. Re-verified each against the current MDX, figure, widget, artifact, README, and research backbone.

1. Scoped the chapter's delegation model to a one-shot, non-fork, no-message case in `src/chapters/delegation.mdx`. It now distinguishes the inherited Claude Code runtime baseline from the task-specific briefing, and qualifies the final report as a tool result subject to runtime scanning. Updated `DelegationFigure.tsx`, its accessible label, and `DelegationWidget.tsx` to teach the same bounded lab model.
2. Updated `artifacts/ch12-delegation/delegate.py` and its README. The artifact now labels its fixed baseline and direct briefing as a deliberately narrow simulation. `--live` is accurately documented and labeled as one preloaded-corpus Anthropic Messages API model call, not a Claude Code or Agent SDK subagent loop.
3. Corrected the source-backed long-context claims in `src/chapters/delegation.mdx` and the material factual backbone errors in `docs/research/ch12-delegation.md`: Liu et al.'s cited GPT-3.5-Turbo result is greater than 20 percent, and Chroma's result is broad but qualified by experiment-specific model coverage and the GPT-4 Turbo local peak.
4. Replaced the stale LangGraph source with the current LangChain Handoffs documentation and aligned the surrounding claim with its tool-based state and routing model.

Advisory not taken: the representative fixture-body assertions remain unchanged because the review classified exhaustive fixture-body coverage as non-blocking scope expansion.

Verification: `npm run check` passed after the fixes, including validate, prose lint, artifact gates, Vitest, typecheck, production build, and advisory lint.

## Round 2 review (2026-07-16)

Fresh-eyes review: read `prompts/critique-rubric.md`, the complete critique and git history, `src/chapters/delegation.mdx`, `DelegationFigure.tsx`, `DelegationWidget.tsx`, the full `artifacts/ch12-delegation/` artifact and fixture, `docs/research/ch12-delegation.md`, and the linked primary sources. Re-verified all four Round 1 required fixes against the current artifacts and current Claude Code, Liu et al., Chroma, Cognition, OpenAI Agents SDK, and LangChain documentation. Ran `npm run check` successfully, then independently exercised `--compare`, `--show-boundary`, `--leak`, `--test`, and the no-key `--live` fallback. The figure, widget, artifact, prior fixes, and full gate hold. The opening context premise does not.

## Required fixes

1. **`src/chapters/delegation.mdx:4-12` --- scope the opening context premise to an un-compacted single-agent loop and present delegation as one context-management strategy, not the sole structural answer.** It currently says every file, failed command, and long tool result in a single agent's window "stays there," then calls delegation "the structural answer." That is false for the named Claude Code runtime and materially changes the design choice the chapter teaches: Anthropic's cited [context-engineering guidance](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) identifies compaction, structured note-taking, and multi-agent architectures as separate long-horizon strategies, and says Claude Code compacts message history while discarding redundant tool outputs. Qualify the accumulation claim as applying without compaction or externalized memory, and make clear that delegation is the appropriate strategy for focused, independently explorable work, alongside compaction and note-taking for their respective cases.

## Advisories

- No new advisories.

## Builder resolution (2026-07-16)

Regression gate: read the complete append-only critique history and `git log -p -- content/critiques/delegation.md`. Re-verified all four REQUIRED fixes from Round 1 and the sole REQUIRED fix from Round 2 against the current MDX, figure, widget, artifact, README, and research backbone.

1. Updated the opening of `src/chapters/delegation.mdx` to scope accumulation to a single-agent loop without compaction or externalized memory. It now presents compaction, structured note-taking, and delegation as separate context-management strategies, and reserves delegation for focused, independently explorable work that can return a bounded result.
2. Corrected the matching material factual premise in `docs/research/ch12-delegation.md` so its backbone also names delegation as one response alongside compaction and structured note-taking.
3. Re-verified Round 1's context-channel repair across the MDX, `DelegationFigure.tsx`, `DelegationWidget.tsx`, `delegate.py`, and the artifact README. They consistently scope the lab to one-shot, non-fork, no-message delegation with an inherited baseline, task-specific briefing, and a qualified scanned return.
4. Re-verified Round 1's live-path repair: the MDX, artifact README, and `delegate.py` label `--live` as one preloaded-corpus Anthropic Messages API model call, not a Claude Code or Agent SDK subagent loop. Re-ran the deterministic artifact boundary gate, comparison, and no-key live fallback.
5. Re-verified Round 1's source repairs: the MDX and research use Liu et al.'s greater-than-twenty-percent result and Chroma's qualified, non-monotonic finding; the chapter uses the current LangChain Handoffs source and matches its tool-based routing model.

Advisory not taken: exhaustive fixture-body assertions remain out of scope because the prior review classified them as non-blocking.

Verification: `npm run check` passed, including validate, prose lint, pipeline tests, all artifact gates, Vitest, typecheck, production build, and advisory lint.

## Round 3 review (2026-07-16)

Fresh-eyes review: read `prompts/critique-rubric.md`, the complete append-only critique history and `git log -p -- content/critiques/delegation.md`, the current MDX, `DelegationFigure.tsx`, `DelegationWidget.tsx`, the complete `artifacts/ch12-delegation/` artifact and fixture, and `docs/research/ch12-delegation.md`. Re-ran `npm run check` successfully, including the artifact gate, Vitest, typecheck, production build, and lint; independently ran the artifact's deterministic `check.sh`, `--compare`, and no-key `--show-boundary --live` paths. Re-checked the linked Anthropic, Claude Code, Liu et al., Chroma, Cognition, OpenAI Agents SDK, and LangChain primary sources. A live browser backend was unavailable, so the widget's interaction and accessibility were checked through its source, render tests, and the build gate. All five REQUIRED fixes from Rounds 1 and 2 remain intact. The figure, widget, artifact, and full gate hold. One material source contradiction remains.

## Required fixes

1. **`src/chapters/delegation.mdx:146-152,169-177` and `docs/research/ch12-delegation.md:121,130` --- correct the blanket single-writer rule and its false attribution to Anthropic.** The chapter correctly presents Anthropic's direct-to-filesystem pattern, in which specialized subagents independently create code, reports, or charts and return lightweight references. It then says Anthropic and Cognition agree that writing cannot parallelize and that every state-mutating action must pass through one thread. Anthropic's [multi-agent research post](https://www.anthropic.com/engineering/multi-agent-research-system) instead recommends those independently persisted subagent artifacts and limits its caution to domains with shared context or many dependencies; it does not endorse a blanket single-writer rule. [Cognition's April 2026 post](https://cognition.com/blog/multi-agents-working) does support its own current recommendation that writes stay single-threaded. The current wording is both a false cross-source attribution and internally contradicts the chapter's own artifact pattern, so it misstates the boundary readers should use. Attribute the single-writer rule to Cognition and scope it to coupled or shared state and competing decisions; distinguish independently scoped artifact writes, and revise the research backbone in lockstep so the error cannot re-enter the chapter.

## Advisories

- No new advisories.

## Builder resolution (2026-07-16)

Regression gate: read the complete append-only critique history and `git log -p -- content/critiques/delegation.md`. Re-verified all four REQUIRED fixes from Round 1, the sole REQUIRED fix from Round 2, and the sole REQUIRED fix from Round 3 against the current MDX, figure, widget, artifact, README, and research backbone.

1. Resolved Round 3 in `src/chapters/delegation.mdx`. The single-threaded-write pattern is now attributed to Cognition and scoped to coupled state and competing decisions. The chapter separately states Anthropic's direct-persistence pattern for independently scoped code, reports, and charts, then draws the boundary around ownership and integration rather than the mere fact of a write.
2. Corrected the same material backbone error in `docs/research/ch12-delegation.md`. Its tradeoff discussion, staged recommendation, and caveat now distinguish Cognition's shared-state guardrail from Anthropic's independently persisted artifact pattern.
3. Re-verified Round 1's context-channel repair across the MDX, `DelegationFigure.tsx`, `DelegationWidget.tsx`, `delegate.py`, and the artifact README. They consistently model one-shot, non-fork, no-message delegation with a separate inherited baseline, a task-specific briefing, and a return that the real runtime may scan.
4. Re-verified Round 1's live-path repair. The MDX, README, and `delegate.py` identify `--live` as one preloaded-corpus Anthropic Messages API model call, not a Claude Code or Agent SDK subagent loop. The deterministic boundary test and no-key fallback continue to hold.
5. Re-verified Round 1's source repairs. The MDX and research retain Liu et al.'s greater-than-twenty-percent result, Chroma's qualified non-monotonic finding, and the current LangChain Handoffs link with its matching tool-based routing claim.
6. Re-verified Round 2's opening repair. The MDX and research scope accumulation to an uncompacted loop without externalized memory and present compaction, structured note-taking, and delegation as separate context-management strategies.

Advisory not taken: exhaustive fixture-body assertions remain out of scope because the prior review classified them as non-blocking scope expansion.

Verification: `npm run check` passed after the corrections, including validate, prose lint, pipeline tests, all artifact gates, Vitest, typecheck, production build, and advisory lint.

## Round 4 review (2026-07-16)

Fresh-eyes convergence review: read `prompts/critique-rubric.md`, the complete append-only history and `git log -p -- content/critiques/delegation.md`, the current MDX, `DelegationFigure.tsx`, `DelegationWidget.tsx`, all delegation artifact and fixture files, the research backbone, and the linked Anthropic, Claude Code, Liu et al., Chroma, Cognition, OpenAI Agents SDK, and LangChain primary sources. Ran `npm run check` successfully, including validation, every artifact gate, Vitest, typecheck, production build, and lint; independently ran the delegation artifact's `--compare`, `--show-boundary`, `--leak`, `--test`, and no-key `--live` fallback. Re-verified every REQUIRED correction from Rounds 1–3 against the current artifacts and sources. The chapter is factually sound and runnable, but its two signature teaching mechanisms still have a material accessibility failure.

## Required fixes

1. **`src/chapters/_figures/DelegationFigure.tsx` and `src/chapters/_widgets/DelegationWidget.tsx` --- essential instructional labels use insufficient contrast.** Both render `--comment` (`#55707b`) over `--surface` / `--surface-2` (`#10171a` / `#141d21`), which computes to 3.44:1 and 3.25:1. The [W3C normal-text requirement](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html) is 4.5:1, and these labels are only 8–11px. They are not decorative chrome: the figure uses them for the boundary, down/up channel qualification, low/high context, and the compression conclusion (`DelegationFigure.tsx:36,48-51,68-75,80,84,91,97,104-105`); the widget uses them for the return-contract label, worker/lead state, changing token totals, `context used`, and the lab conclusion (`DelegationWidget.tsx:54,112,130,145-148,157,165,168-170,201-204`). This prevents low-vision readers from using the visual mechanism that teaches isolation. Use `--fg-muted` / `text-muted` (5.52:1 on `--surface`, 5.21:1 on `--surface-2`) or another passing token for informational labels; reserve `--comment` for genuinely decorative material.

## Advisories

- `src/chapters/delegation.mdx:106-108` calls briefing quality Anthropic's "single most important lesson," while the cited post calls prompt engineering its primary lever and presents delegation guidance as one principle. Soften the ranking if that prose is otherwise being touched.
- `src/chapters/delegation.mdx:64-66,141-143` models the return as an Agent tool result. That is valid for foreground use, but current Claude Code runs subagents in the background by default and returns their result through a completion notification. Naming the model foreground would remove the ambiguity; this does not undermine the chapter's boundary lesson.
