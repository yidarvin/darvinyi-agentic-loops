verdict: resolved

## Round 1 review (2026-07-16)

Fresh-eyes review: read the chapter, `PromptCachingEconomicsFigure`,
`PromptCachingEconomicsWidget`, the full runnable artifact and its instructions, the
Chapter 16 research file, build notes, rubric, and status files. No prior critique
file or history exists, so there are no earlier REQUIRED fixes to re-verify. Ran
`npm run check` successfully, including the artifact gate; separately ran the
artifact's deterministic `bash check.sh`, simulation path, and missing-key live
failure path. Checked the linked OpenAI, Anthropic, Gemini, DeepSeek, and arXiv
primary sources, plus DeepSeek's current official pricing page.

## Required fixes

1. **`src/chapters/prompt-caching-economics.mdx:109,215`: The cross-provider benchmark is misattributed and misnamed.** The linked [arXiv:2601.06007](https://arxiv.org/abs/2601.06007) is *Don't Break the Cache: An Evaluation of Prompt Caching for Long-Horizon Agentic Tasks* by Elias Lumer, Faheem Nizar, Akshaya Jangiti, Kevin Frank, Anmol Gulati, Mandar Phadate, and Vamse Kumar Subbiah, not Chan et al. or *A Framework for Cache-Aware LLM Application Design*. Its abstract does support the stated 41% to 80% API-cost and 13% to 31% TTFT findings. Correct both the prose attribution and source-list title while retaining only the supported result.
2. **`src/chapters/prompt-caching-economics.mdx:217`: The timing-side-channel paper has the wrong title.** The linked [arXiv:2502.07776](https://arxiv.org/abs/2502.07776) is Gu et al., *Auditing Prompt Caching in Language Model APIs*, not *Token-Level Membership Inference Attacks against Prompt Caching*. The linked paper supports the side-channel claim, but the false title is a material source-attribution error. Replace the source-list title with the work the URL actually resolves to.
3. **The live benchmark's cached-input price is 10 times too high.** `src/chapters/prompt-caching-economics.mdx:172`, `artifacts/ch16-prompt-caching-economics/README.md:37-55`, and `artifacts/ch16-prompt-caching-economics/cache_benchmark.mjs:24-25` supply `$0.028` per million cached DeepSeek V4 Flash input tokens. The current official [DeepSeek Models & Pricing page](https://api-docs.deepseek.com/quick_start/pricing/) lists `$0.14` per million cache-miss input tokens and `$0.0028` per million cache-hit input tokens. Since those values feed the live report's estimated-cost calculation, the documented command and defaults materially understate savings. Correct the concrete price everywhere it is presented, add the pricing source, and reconcile `docs/research/ch16-prompt-caching-economics.md:38` so it does not reintroduce the stale value. Alternatively, remove the claimed default and require an explicitly verified user-supplied rate.

## Advisories

- The live A/B is not a literal move of one identical field as `README.md:48` says: `makeMessages()` uses different static and dynamic namespace strings, with different lengths and contents, in the two layouts. It remains a useful teaching benchmark because it reports provider usage, but a same-length field moved between sides of the stable prefix would make the live comparison cleaner.

## Builder resolution (2026-07-16)

Regression gate: read the full append-only history and `git log -p` for this critique.
Round 1 is the only review round, so no earlier REQUIRED fixes exist to regress. Re-verified
every Round 1 finding against the current MDX, figure, widget, runnable artifact, matching
research, and linked primary sources.

1. **Cross-provider benchmark attribution:** Updated
   `src/chapters/prompt-caching-economics.mdx` to attribute the 41% to 80% API-cost and
   13% to 31% TTFT result to Lumer and colleagues, and gave the source its exact title.
   Corrected the same material misattribution in
   `docs/research/ch16-prompt-caching-economics.md`.
2. **Timing-side-channel source:** Replaced the chapter source-list title with Gu et al.,
   *Auditing Prompt Caching in Language Model APIs*, which is the work resolved by
   arXiv:2502.07776.
3. **DeepSeek pricing:** Changed the V4 Flash cached-input default and documented live
   command from `$0.028` to `$0.0028` per million tokens in the chapter MDX, artifact
   README, and `cache_benchmark.mjs`. Added the official DeepSeek Models & Pricing source
   to the chapter and artifact references. Reconciled the matching research pricing line,
   including the stale V4 Pro figures and cache-hit ratio.

Advisories: left the namespace-field layout suggestion untouched because it is advisory and
would require a broader benchmark redesign.

Verification: `bash artifacts/ch16-prompt-caching-economics/check.sh`, the offline
simulation, the missing-key live-mode failure path, and `npm run check` all pass.

## Round 2 review (2026-07-16)

Fresh-eyes review: read the current chapter, `PromptCachingEconomicsFigure`, and
`PromptCachingEconomicsWidget` in full; read the runnable artifact, its instructions,
the Chapter 16 research file, build notes, rubric, and the complete critique history
(`git log -p -- content/critiques/prompt-caching-economics.md`). Ran `npm run check`
successfully, then ran the artifact's deterministic check, simulation, and expected
missing-key live-mode failure path. Checked the linked OpenAI, Anthropic, Gemini,
DeepSeek, Lumer et al., Gu et al., and SGLang primary sources, plus the W3C contrast
criterion. Re-verified every Round 1 REQUIRED correction: the Lumer attribution and
reported result match arXiv:2601.06007; the Gu title and timing-side-channel claim match
arXiv:2502.07776; and the chapter, README, artifact defaults, and current DeepSeek price
page agree on $0.14/M cache-miss and $0.0028/M cache-hit input.

## Required fixes

1. **`src/chapters/_widgets/PromptCachingEconomicsWidget.tsx:55-66,199-221` --- the displayed cache-aware curve compares a cumulative uncached cost with a one-turn cached cost.** `point.uncached` multiplies by `turn`, but `point.cached` contains only that turn's charge while the widget labels the rows "cost per turn" and renders them as a pair. At the default values, `t_2` displays `$0.048 / $0.010905`, although the corresponding cumulative cache-aware cost is `$0.039405`; in dynamic-boundary mode, the top metric correctly reports `$0.240` cache-aware versus `$0.192` uncached, while `t_8` shows `$0.192 / $0.030`. This makes the signature calculator materially overstate cache savings and contradict its own summary. Make both series cumulative through the named turn, or make both per-turn and relabel the comparison, then keep the bar widths and displayed values on that same basis.
2. **`src/chapters/_widgets/PromptCachingEconomicsWidget.tsx:85,159,180,201-207,225,262-263,299` --- essential widget labels fail minimum text contrast.** The interactive slider labels, metric names, pricing explanation, and cost-curve legend use `text-comment` (`#55707b`) at 0.7rem/12px against `bg-surface` (`#10171a`, 3.44:1) or `bg-surface-2` (`#141d21`, 3.25:1). These are active teaching controls and result labels, not decorative text; [WCAG 2.2 SC 1.4.3](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html) requires 4.5:1 for normal text. Use an AA-passing color such as `text-muted` (`#7d919b`, 5.52:1 / 5.21:1 on those surfaces) for the informative labels, or another verified equivalent.

## Advisories

- No new advisory findings. The Round 1 namespace-layout note remains non-blocking and is not re-litigated here.

## Builder resolution (2026-07-16)

Regression gate: read the complete append-only history and `git log -p --
content/critiques/prompt-caching-economics.md`. Re-verified every Round 1 REQUIRED
fix against the current chapter, research, runnable artifact, and linked primary sources:
Lumer et al. and *Don't Break the Cache* remain the correct attribution and title for the
cross-provider result; Gu et al. and *Auditing Prompt Caching in Language Model APIs*
remain the correct timing-side-channel source; and the DeepSeek V4 Flash cache-miss and
cache-hit prices remain $0.14/M and $0.0028/M throughout the chapter, artifact README,
artifact defaults, and matching research. All still hold.

1. **Cumulative cost curve:** In
   `src/chapters/_widgets/PromptCachingEconomicsWidget.tsx`, added a single
   `cachedCostThroughTurn()` calculation and use it for both the summary metric and every
   curve point. The paired bars and values now both show cumulative input cost through the
   named turn, with the heading and accessible label updated to say so. At the default
   inputs, the cumulative calculations are $0.048000 / $0.039405 at `t_2` and
   $0.192000 / $0.104835 at `t_8` (rendered as $0.048 / $0.039 and $0.192 / $0.105);
   the dynamic-boundary `t_8` reaches $0.192 / $0.240, matching the summary accounting.
2. **AA label contrast:** Replaced the widget's instructional, control, metric, and curve
   labels from `text-comment` to `text-muted`, including the prompt map's dynamic-tail
   label. These labels now use the token's `--fg-muted` color rather than the insufficient
   `--comment` color on the widget surfaces.

Advisories: left the Round 1 namespace-layout suggestion unchanged because it remains
non-blocking and would broaden the benchmark beyond this resolution.

Verification: `npm run check` passes after the widget correction; it runs validation,
prose lint, artifact checks, tests, production build, and advisory lint.

## Round 3 review (2026-07-16)

Fresh-eyes review: read the current chapter, `PromptCachingEconomicsFigure`, and
`PromptCachingEconomicsWidget` in full; read the runnable artifact and its instructions,
the Chapter 16 research file, build notes, rubric, and complete append-only critique
history (`git log -p -- content/critiques/prompt-caching-economics.md`). Ran `npm run
check` successfully, then ran the artifact's deterministic check, simulation, and its
expected missing-key live-mode failure path. Checked the linked OpenAI, Anthropic,
Gemini, DeepSeek, Lumer et al., Gu et al., and SGLang primary sources. Re-verified every
prior REQUIRED correction: the Lumer attribution and results remain accurate; the Gu
title and timing-side-channel claim remain accurate; DeepSeek V4 Flash remains $0.14/M
cache-miss and $0.0028/M cache-hit throughout the current chapter and artifact; and the
widget still uses the same cumulative calculation for its summary and curve with
AA-passing active labels.

## Required fixes

1. **`docs/research/ch16-prompt-caching-economics.md:34,42,45` --- the chapter's factual backbone incorrectly states that OpenAI has no cache-write fee and calls the GPT-5.6 1.25x write rate a confusion with Anthropic.** The current official [OpenAI prompt-caching guide](https://developers.openai.com/api/docs/guides/prompt-caching) states that models before GPT-5.6 have no additional cache-write fee, while GPT-5.6 and later model families bill cache writes at 1.25x the uncached input rate and report them in `cache_write_tokens`. This makes the research file's free-write comparison and no-break-even conclusion materially false for a current model family. Qualify the no-surcharge claim to pre-GPT-5.6 models and revise the derived comparison and break-even guidance. The visible chapter currently avoids this error by referring only to a model-dependent write policy; keep it that way.

## Advisories

- No new advisory findings. The Round 1 namespace-layout note remains non-blocking and is not re-litigated.

## Builder resolution (2026-07-16)

Regression gate: read the complete append-only history and `git log -p --
content/critiques/prompt-caching-economics.md`. Re-verified every prior REQUIRED fix
against the current chapter, figure, widget, runnable artifact, and matching research.
Round 1 remains intact: Lumer et al. and *Don't Break the Cache* are the chapter's
cross-provider attribution, Gu et al. and *Auditing Prompt Caching in Language Model
APIs* are the timing-side-channel source, and the DeepSeek V4 Flash cache-miss/cache-hit
prices remain $0.14/M and $0.0028/M throughout the MDX, README, artifact defaults, and
research. Round 2 remains intact: the widget uses `cachedCostThroughTurn()` for both its
summary and curve, and its active teaching labels use `text-muted` rather than
`text-comment`.

1. **OpenAI cache-write economics:** Updated
   `docs/research/ch16-prompt-caching-economics.md` to make the policy model-family
   dependent. The research now limits no-additional-fee writes to models before GPT-5.6;
   records GPT-5.6+ writes at 1.25× uncached input in `cache_write_tokens`; distinguishes
   the older retention controls from GPT-5.6+'s 30-minute minimum TTL; and retains
   `cached_tokens` for reads. Its comparison, one-shot caveat, operational accounting, and
   break-even guidance now include the write premium. At a 0.1× cached-read rate, one
   1.25× write plus its first later read costs 1.35× versus 2× uncached, so break-even is
   the second use. The visible chapter remained unchanged because it already correctly
   describes OpenAI's write policy as model-dependent.

Advisories: left the Round 1 namespace-layout suggestion untouched because it remains
non-blocking and would broaden the benchmark beyond this resolution.

Verification: `npm run check` passes, including validation, prose lint, the artifact gate,
tests, the production build, and advisory lint.
