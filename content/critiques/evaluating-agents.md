verdict: revise

## Round 1 review (2026-07-18)

Fresh-eyes review: confirmed there is no prior critique history; read `src/chapters/evaluating-agents.mdx`, `EvaluatingAgentsFigure.tsx`, `EvaluatingAgentsWidget.tsx`, and every file in `artifacts/ch22-evaluating-agents/`; read `docs/research/ch22-evaluating-agents.md`; and checked the linked Anthropic guide, tau-bench, SWE-bench, SWE-bench Verified, Terminal-Bench, LiveCodeBench, and MT-Bench sources. Ran `npm run check` successfully, including the chapter artifact gate. I also reproduced the final-state edge case below in a temporary workspace by calling the artifact's own `grade_check`.

## Required fixes

1. **artifacts/ch22-evaluating-agents/harness.py:187-194: `file_absent` accepts a dangling symlink as absent.** `workspace_path()` resolves `ghost -> missing-target` to an in-workspace nonexistent target, then `not target.exists()` returns true. The workspace still contains the `ghost` directory entry, but the grader reports `{ "passed": true, "detail": "file was absent" }`. An agent can therefore evade an advertised final-state absence check, which is a material grader bypass for this evaluation harness. Preserve containment validation, then test for the unresolved directory entry with `os.path.lexists` or equivalent, and add a deterministic negative case to `check.sh` that proves a dangling symlink fails `file_absent`.

## Advisories

- `README.md` says malformed check paths fail before an agent is invoked, but check-path containment is evaluated during grading after `invoke_agent`. Correct the ordering claim when touching the artifact. The path still cannot escape the workspace, so this is non-blocking.
