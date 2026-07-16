# Critique rubric

Apply the generic refsite critique procedure, then judge Agentic Loops on these
non-negotiables.

1. Verify consequential claims against the chapter research file and linked primary sources.
2. The figure and widget must teach the chapter thesis, not decorate nearby prose.
3. The runnable artifact must have clear local instructions, a deterministic `check.sh`, and a meaningful failure mode.
4. Product-specific examples must be labelled as examples. The conceptual spine remains vendor-neutral.
5. Reject em dashes, vague AI-tell phrasing, missing source links, and hand-wavy security or evaluation claims.

## Convergence policy

- Read the complete critique history before adding a finding. A resolved finding is settled unless the current files concretely regress it.
- REQUIRED findings are limited to material factual errors, broken runnable behavior, security defects, inaccessible teaching mechanisms, and missing non-negotiable chapter grammar.
- Style preferences, speculative edge cases, optional robustness, and incremental polish are ADVISORY. They never block approval.
- Starting with the fourth review round, use convergence mode. Add a new REQUIRED finding only when the defect would make the chapter materially wrong, unsafe, inaccessible, or non-runnable. If prior required fixes remain intact and the full gate passes, approve.
- Do not convert an earlier advisory into a later required finding without new concrete evidence of material impact.

Critiques begin with exactly one line: `verdict: approve`, `verdict: revise`, or `verdict: resolved`.
