verdict: approve

## Round 1 review (2026-07-16)

Fresh-eyes review: read `src/chapters/when-multi-agent-fails.mdx`, `WhenMultiAgentFailsFigure.tsx`, `WhenMultiAgentFailsWidget.tsx`, and the complete `artifacts/ch14-when-multi-agent-fails/` artifact. Ran `npm run check` (passes), then ran the artifact's deterministic `check.sh` and inspected its comparison and trace output. Read `docs/research/ch14-when-multi-agent-fails.md` and checked the chapter's consequential claims against the linked primary sources: MAST v3, Chen et al., Zhang et al., Anthropic, and Cognition. No prior critique history exists, so there were no prior required fixes to re-verify.

The chapter is materially truthful and teaching: its MAST shares and individual-mode values match the research record at the stated precision, the figure accurately distinguishes coupled writes from independent read fan-out, the keyboard-operable widget maps each observed symptom to the correct MAST category and a concrete control, and the runnable lab deterministically exposes FC2 fact loss, FC1 unchanged retries, and FC3 absent objective verification before proving the corrected control plane.

## Advisories

- MAST v3's diagram presents information withholding as 0.80%, while its prose and this chapter's widget use 0.85%. This source-internal, immaterial discrepancy is within the review tolerance and does not block approval.
