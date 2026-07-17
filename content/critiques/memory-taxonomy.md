verdict: revise

## Round 1 review (2026-07-16)

Fresh-eyes review: read `prompts/critique-rubric.md`, the complete critique history
(none), `src/chapters/memory-taxonomy.mdx`, `MemoryTaxonomyFigure.tsx`,
`MemoryTaxonomyWidget.tsx`, and every file in `artifacts/ch15-memory-taxonomy/`.
Read `docs/research/ch15-memory-taxonomy.md`; checked the linked CoALA, Generative
Agents, MemGPT, LongMemEval, Mem0, and Zep primary sources; and checked MINJA for the
security claim. Ran `node memory_harness.mjs --compare`, `bash check.sh`, and an
unsupported-regime failure path (exit 2). Ran `npm run check`, which passes. No prior
required findings exist to re-verify. Browser rendering was unavailable, so the figure's
accessibility measurements below are derived from its authored viewBox, minimum width,
and the fixed reading-column layout.

## Required fixes

1. **`src/chapters/memory-taxonomy.mdx` and `src/chapters/_figures/MemoryTaxonomyFigure.tsx` --- working memory is incorrectly equated with the one-call context window.** Lines 13-17 and 32-40 state that working memory is the current request and disappears at a session boundary; the figure and caption repeat that model. The cited [CoALA source](https://arxiv.org/html/2309.02427) section 4.1 defines working memory more broadly as a data structure that persists across LLM calls, with each LLM input synthesized from a subset of it. This is the chapter's central taxonomy, so it misclassifies active task state carried across calls as long-term memory. Distinguish active agent working state from the prompt/context projection in the prose and figure, including the caption and accessible description. A new session may reset working memory, but working memory is not inherently one model call.
2. **`src/chapters/memory-taxonomy.mdx` lines 45-49 and `src/chapters/_figures/MemoryTaxonomyFigure.tsx` --- the procedural-memory model falsely treats retrieval as the only way procedural memory affects a generation.** The prose says a portable skill is not a record that can wait in a similarity index, but CoALA section 4.3 gives dense retrieval of code-based skills as a procedural-memory example. The figure lists model weights as procedural memory while its caption says only selected retrieval changes the next generation. CoALA section 4.1 identifies weights as implicit procedural memory, and they influence every generation without retrieval. Separate memory type from selection/retrieval mechanism, and separate parametric weights from agent-managed external stores, so the prose, figure, caption, and aria label no longer contradict each other or the cited source.
3. **`src/chapters/_figures/MemoryTaxonomyFigure.tsx` --- the figure's structural labels are materially unreadable.** The 860-unit viewBox is constrained to a 720px minimum width inside a 3xl reading column and padded figure, so its 8.7px and 9px SVG labels render at about 7.3px and 7.5px. Those labels carry the retrieval, encoding, consolidation, store-detail, and risk distinctions. Many also use `--comment` on `--surface-2`, a 3.25:1 contrast ratio, below the 4.5:1 normal-text threshold. This violates the required readable, accessible teaching mechanism despite the valid `role` and `aria-label`. Reflow or resize the diagram so its meaningful labels render at a readable physical size and use sufficient contrast for all labels that teach the taxonomy.
4. **`src/chapters/memory-taxonomy.mdx` lines 87-91 --- the consequential memory-poisoning security claim has no primary source link or attribution.** The Sources list omits a security source even though the research backbone identifies MINJA. The project rubric explicitly rejects missing source links and hand-wavy security claims. Add an attributed primary link such as [Dong et al., "Memory Injection Attacks on LLM Agents via Query-Only Interaction"](https://arxiv.org/abs/2503.03704), which supports query-only injection of malicious records later retrieved to influence agent behavior, and scope the claim to the affected write/retrieval designs if needed.

## Advisories

- None.
