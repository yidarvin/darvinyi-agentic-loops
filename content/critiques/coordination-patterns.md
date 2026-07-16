verdict: approve

## Round 1 review (2026-07-16)
Fresh-eyes review: read the complete current chapter, build notes, research backbone, figure, widget, runnable artifact, README, and artifact gate. There is no prior critique file or Git history for this chapter, so no prior required fixes exist to re-verify. Ran `npm run check` successfully through validate, prose lint, pipeline tests, all artifact gates, Vitest, typecheck/build, and lint. Directly exercised the artifact's required-branch failure path: `python3 fanout.py --fail risks` exits 2 after `join_blocked` and emits no aggregate. Checked the linked Anthropic, LangChain, OpenAI Agents SDK, LangGraph, and MAST sources, plus Cognition's primary account of its current single-writer pattern. Source inspection and render tests verified the figure and widget; the local browser runtime was unavailable for a visual click-through.

## Required fixes
1. **src/chapters/coordination-patterns.mdx:103-109 and :191 --- the chapter over-attributes a central, categorical single-writer rule to Anthropic.** The prose says to funnel even "a final artifact" through one writer and the source list calls Anthropic support for a "read-parallel/write-serialized boundary." Anthropic's linked article supports parallel research with lead-owned synthesis, but its appendix also recommends independently persisted subagent outputs such as code, reports, and visualizations, with lightweight references returned to the coordinator. It therefore does not support a blanket serialization rule for independently owned artifacts. The coupled-write rationale is a separate vendor finding: [Cognition's current multi-agent account](https://cognition.com/blog/multi-agents-working) identifies conflicting implicit decisions from parallel writers and recommends contributors that add intelligence while writes stay single-threaded. This is material because the rule is the chapter's main deployment recommendation. Scope the rule to shared or coupled state and final integration, distinguish safe independently owned artifact writes with an explicit merge contract, and attribute the two observations separately by adding the Cognition source rather than assigning the whole boundary to Anthropic.

## Advisories
- None.

## Builder resolution (2026-07-16)
Regression gate: read the full append-only history with `git log -p -- content/critiques/coordination-patterns.md` and re-verified Round 1 against the current MDX, exact figure, widget, and artifact. Round 1 is the only prior review, so no earlier required fixes exist to preserve.

1. `src/chapters/coordination-patterns.mdx` now scopes serialization to coupled decisions, coupled state, and final integration. It explicitly permits independently owned reports, code modules, and visualizations when their owner, location, and explicit merge contract are defined.
2. `src/chapters/coordination-patterns.mdx` now attributes parallel research, lead-owned synthesis, and independently persisted artifacts to Anthropic; adds Cognition's primary source; and attributes the parallel-writer conflict and single-threaded-write rationale to Cognition.
3. `docs/research/ch13-coordination-patterns.md` corrects the same material factual backbone error wherever it repeated the blanket reads-versus-writes rule.
4. Re-verified `CoordinationPatternsFigure`, `CoordinationPatternsWidget`, and the fan-out artifact. Their existing terminology already limits serialization to contested or coupled state, and their join and aggregate contract remains correct, so no out-of-scope changes were needed.

No advisories were taken. `npm run check` passes.

## Round 2 review (2026-07-16)
Independent review: read `prompts/critique-rubric.md`, the complete critique history and `git log -p -- content/critiques/coordination-patterns.md`, the current MDX, exact figure and widget, runnable artifact, README, artifact gate, build notes, and research backbone. Fetched the listed Anthropic, Cognition, LangChain, OpenAI Agents SDK, LangGraph, and MAST primary sources. Ran `npm run check` successfully through all seven gates. Directly ran `python3 fanout.py`, which emitted one stable input-order aggregate after the join, and `python3 fanout.py --fail risks`, which exited 2 after `join_blocked` without an aggregate. The local browser interaction runtime was unavailable, so visual interaction was verified from the rendered component structure, keyboard controls, source, and passing render tests. Re-verified Round 1's required correction: serialization is limited to coupled decisions, coupled state, and final integration; independently owned artifacts require an owner, location, and explicit merge contract; Anthropic and Cognition are attributed separately.

The chapter is materially truthful, its figure and widget accurately teach the dependency-driven topology rule, and its runnable artifact is deterministic with a meaningful failure path.

## Advisories
- None.
