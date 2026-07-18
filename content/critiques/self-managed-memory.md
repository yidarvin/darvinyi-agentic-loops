verdict: resolved

## Round 1 review (2026-07-18)

Fresh-eyes review: read `prompts/critique-rubric.md`, the complete current
chapter, `SelfManagedMemoryFigure.tsx`, `SelfManagedMemoryWidget.tsx`, the full
artifact (`README.md`, `check.sh`, `self_managed_memory.mjs`, and
`verify_demo.mjs`), the Chapter 18 research backbone, and the complete critique
history (none). Ran `npm run check` and the chapter artifact's `bash check.sh`; both
pass. Checked the linked primary sources for MemGPT, Letta, Anthropic memory tools,
Mem0, MINJA, Generative Agents, Sleep-time Compute, HaluMem, and RealMem. I also
reproduced the artifact's claimed fresh-file reload against a temporary state file.

## Required fixes

1. **`artifacts/ch18-self-managed-memory/self_managed_memory.mjs` and `verify_demo.mjs` --- Session 2 does not read the compacted `project.md` it claims to reload.** `runSessionTwo()` only verifies that `state.hotBlock.content` exists, then builds its answer from `currentFacts(state)`, the separate `trusted` array. After session 1, I replaced only `hotBlock.content` in a temporary state file with an Express/npm/Monday playbook; session 2 still returned Fastify/pnpm/Tuesday. This contradicts the chapter and artifact claim that a fresh process reads the compacted file, while the current verifier merely proves that both representations coexist. Make session 2 derive its recalled answer from the persisted hot block (or revise the artifact and chapter claims to describe the actual source of truth), and extend `check.sh`/`verify_demo.mjs` to prove that changing the compacted file changes what the second process recalls.

2. **`src/chapters/_widgets/SelfManagedMemoryWidget.tsx` --- the promotion step creates `release_window` without a displayed candidate.** The proposal state displays three candidates, Fastify, pnpm, and the tool-derived instruction, plus the pre-existing Express fact. The next state lists `release_window` among three trusted facts even though no candidate or proposal-trace entry exists for it. The artifact does propose `release_window`, so the widget's lifecycle contradicts the chapter's candidate-to-trusted gate. Display the release-window candidate and proposal, and correct the candidate count, or remove it from the later widget states.

## Advisories

- No additional advisory findings.

## Builder resolution (2026-07-18)

Regression gate: re-verified every REQUIRED finding from Round 1 against the current
artifact and widget. There are no earlier review rounds or prior builder resolutions
for this chapter.

1. `artifacts/ch18-self-managed-memory/self_managed_memory.mjs` now parses the
   persisted `project.md` hot block in Session 2 with `readProjectPlaybook()` and
   derives its recalled values and answer from that file content. Session 2 no longer
   reads current trusted facts as its recall source.
2. `artifacts/ch18-self-managed-memory/verify_demo.mjs`, invoked by `check.sh`, now
   writes an isolated state copy whose only changed field is `hotBlock.content`, starts
   a fresh Session 2 process, and asserts that it recalls Express, npm, and Monday
   10:00 UTC from the changed file. The artifact README now describes that proof.
3. `src/chapters/_widgets/SelfManagedMemoryWidget.tsx` now shows all four proposed
   candidates, including `release_window`, updates the candidate count to four, and
   records the release-window proposal in the trace before the later promotion state.

No advisories were taken because Round 1 listed none. `bash check.sh` for the artifact
and `npm run check` both pass.
