verdict: revise

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
