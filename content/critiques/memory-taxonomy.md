verdict: resolved

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

## Builder resolution (2026-07-16)

Regression gate: read the complete append-only history and `git log -p --
content/critiques/memory-taxonomy.md`. Round 1 is the only review round, so no
earlier required fixes existed to re-verify. Re-verified all four Round 1
requirements against the current chapter, figure, widget, artifact, and matching
research backbone.

1. **Working-memory model corrected.** `src/chapters/memory-taxonomy.mdx` now
   distinguishes cross-call active working state from the per-call context
   projection. `MemoryTaxonomyFigure.tsx` makes that projection and its return
   path explicit. The widget and harness now label their `working` case as a
   deliberate fresh working-state reset rather than the definition of working
   memory.
2. **Procedural-memory access paths separated.** The chapter, figure, widget,
   harness, and research backbone now distinguish implicit model weights, which
   shape every generation directly, from explicit code and skills, which can be
   selected, densely retrieved, or executed.
3. **Figure made readable and high-contrast.**
   `MemoryTaxonomyFigure.tsx` now uses a 720-unit viewBox with a 720px minimum
   width, 13px-or-larger structural labels, and `--fg` or `--fg-muted` for all
   teaching labels. The reflow keeps the state, projection, retrieval, direct
   parametric path, and consolidation relationships visible together.
4. **Memory-poisoning claim attributed and scoped.** The chapter now attributes
   query-only memory injection to Dong et al.'s MINJA paper, limits the claim to
   designs that write untrusted interaction and later retrieve it, and includes
   the primary source in its reference list.
5. **Material backbone corrections recorded.**
   `docs/research/ch15-memory-taxonomy.md` now matches CoALA's cross-call
   working-memory definition and its distinction between parametric weights and
   explicit procedural retrieval.

No advisories were present or taken. `bash artifacts/ch15-memory-taxonomy/check.sh`
and `npm run check` pass.

## Round 2 review (2026-07-16)

Fresh-eyes re-review: read `prompts/critique-rubric.md`, the full append-only
critique file, and `git log -p --follow -- content/critiques/memory-taxonomy.md`.
Read the current chapter, exact figure and widget source, every artifact file, and
the chapter research backbone. Ran `npm run check` (passes),
`node memory_harness.mjs --compare`, `bash check.sh`, and the unsupported-regime
path (clear usage, exit 2). Checked CoALA, Generative Agents, MemGPT, LongMemEval,
Mem0, Zep, and MINJA against their linked primary sources, plus WCAG 2.2 contrast
guidance. Re-verified every Round 1 requirement from the current artifacts: working
memory remains a cross-call state with a per-call projection; parametric procedural
memory has its direct path; the SVG has readable, high-contrast structural labels;
and the MINJA claim remains linked and correctly scoped. None has regressed.

## Required fixes

1. **`artifacts/ch15-memory-taxonomy/README.md`, `memory_harness.mjs`, and Exercise 03 in `src/chapters/memory-taxonomy.mdx` --- the advertised real-trace customization path does not change the harness behavior.** The README says the harness derives records from the fixed interaction (line 20) and tells readers to replace only the three `transcript` strings (lines 49-52); Exercise 03 then tells them to rerun the five regimes. In the executable, however, `transcript` is consumed only by `printStores()` (lines 102-109). `--compare` instead prints regimes built from independent hard-coded `stores` (lines 14-21) and hard-coded `questions[].answer` values (lines 54-85). Replacing the advertised trace therefore leaves the Mira/migration comparison unchanged, so the runnable design probe fails its promised adaptation path. Either derive the typed records and answers from an editable structured trace, or clearly label the fixture static and update the README and exercise with the exact additional stores and expected answers a reader must edit together. If customization remains a documented behavior, make `check.sh` exercise it.
2. **`src/chapters/_widgets/MemoryTaxonomyWidget.tsx` --- key explanatory text in the signature teaching mechanism fails normal-text contrast.** The selected `consulted:` path and the `// missing` interpretation at lines 125 and 127-129 use `text-comment` at `0.7rem` (11.2px). `src/styles/tokens.css` defines that color as `#55707b`; it yields about 3.44:1 on `--surface` and 3.25:1 on `--surface-2`, below [WCAG 2.2 SC 1.4.3's 4.5:1 requirement for normal text](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html). Those lines explain why a selected regime produces its answer and what it cannot retain, so they are teaching content rather than decorative code-comment framing. Use `text-muted` or `text-fg` for meaningful labels and explanations, reserving `text-comment` for non-semantic framing. This is separate from, and does not reopen, the resolved SVG-label contrast finding.

## Advisories

- Add a direct LoCoMo source link to the Sources list. Its brief mention is accurate, but a direct primary link would complete the benchmark attribution.

## Builder resolution (2026-07-16)

Regression gate: read the complete append-only history and `git log -p --
content/critiques/memory-taxonomy.md`, then re-verified every Required finding from
Rounds 1 and 2 against the current chapter, figure, widget, artifact, and matching
research backbone. Round 1 still distinguishes cross-call working state from each
per-call context projection; preserves the direct parametric path alongside selected or
retrieved explicit procedures; keeps the figure's teaching labels readable and
high-contrast; and attributes and scopes the MINJA claim. None regressed.

1. **Trace-driven artifact customization.** `artifacts/ch15-memory-taxonomy/trace.json`
   now supplies the editable structured trace. `memory_harness.mjs` accepts
   `--trace`, validates the JSON, and derives the transcript, typed stores, retained
   records, prompts, and answers used by `--compare` from it. The artifact check runs
   `fixtures/custom-trace.json` and asserts its changed episodic, semantic, and
   procedural output, so an edited trace changes the teaching comparison. The README
   and Exercise 03 now name that trace-driven workflow.
2. **Widget explanatory-text contrast.**
   `src/chapters/_widgets/MemoryTaxonomyWidget.tsx` now renders the selected
   `consulted:` explanation and the `// missing` interpretation with `text-fg`, not
   `text-comment`, giving the signature teaching text sufficient normal-text contrast.

No advisories were taken. The Round 2 LoCoMo-link advisory remains outside this resolve
scope. `bash artifacts/ch15-memory-taxonomy/check.sh` and `npm run check` pass.
