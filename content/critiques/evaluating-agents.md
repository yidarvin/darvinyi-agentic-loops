verdict: resolved

## Round 1 review (2026-07-18)

Fresh-eyes review: confirmed there is no prior critique history; read `src/chapters/evaluating-agents.mdx`, `EvaluatingAgentsFigure.tsx`, `EvaluatingAgentsWidget.tsx`, and every file in `artifacts/ch22-evaluating-agents/`; read `docs/research/ch22-evaluating-agents.md`; and checked the linked Anthropic guide, tau-bench, SWE-bench, SWE-bench Verified, Terminal-Bench, LiveCodeBench, and MT-Bench sources. Ran `npm run check` successfully, including the chapter artifact gate. I also reproduced the final-state edge case below in a temporary workspace by calling the artifact's own `grade_check`.

## Required fixes

1. **artifacts/ch22-evaluating-agents/harness.py:187-194: `file_absent` accepts a dangling symlink as absent.** `workspace_path()` resolves `ghost -> missing-target` to an in-workspace nonexistent target, then `not target.exists()` returns true. The workspace still contains the `ghost` directory entry, but the grader reports `{ "passed": true, "detail": "file was absent" }`. An agent can therefore evade an advertised final-state absence check, which is a material grader bypass for this evaluation harness. Preserve containment validation, then test for the unresolved directory entry with `os.path.lexists` or equivalent, and add a deterministic negative case to `check.sh` that proves a dangling symlink fails `file_absent`.

## Advisories

- `README.md` says malformed check paths fail before an agent is invoked, but check-path containment is evaluated during grading after `invoke_agent`. Correct the ordering claim when touching the artifact. The path still cannot escape the workspace, so this is non-blocking.

## Builder resolution (2026-07-18)

Regression gate: re-verified Round 1's sole REQUIRED finding in the current harness and its deterministic artifact self-check. There are no earlier review rounds or prior required fixes to re-verify.

1. `artifacts/ch22-evaluating-agents/harness.py` now keeps `workspace_path()` containment validation, then uses `os.path.lexists(workspace / relative_path)` for `file_absent`. A dangling symlink therefore remains present to the grader instead of resolving to a missing target.
2. `artifacts/ch22-evaluating-agents/check.sh` now creates `ghost -> missing-target` in a fresh temporary workspace and asserts that `grade_check(..., {"kind": "file_absent", "path": "ghost"})` fails with `file unexpectedly exists`.

No advisories were taken. The README execution-order wording remains an advisory and outside this resolution's required scope. `npm run check` passes after the artifact change.

## Round 2 review (2026-07-18)

Independent re-review: read the complete critique history and current `src/chapters/evaluating-agents.mdx`, `EvaluatingAgentsFigure.tsx`, `EvaluatingAgentsWidget.tsx`, every artifact file, and `docs/research/ch22-evaluating-agents.md`. Ran `npm run check` successfully: validation, artifact gate, 48 render tests, production build, and lint all passed. Re-verified Round 1 directly: `file_absent` rejects a dangling `ghost -> missing-target`, and `check.sh` holds that regression. Checked the linked Anthropic, tau-bench, SWE-bench, SWE-bench Verified, Terminal-Bench, LiveCodeBench, and MT-Bench primary sources; the consequential chapter claims remain supported. I then exercised the two fresh workspace edge cases below against the current harness.

## Required fixes

1. **artifacts/ch22-evaluating-agents/harness.py:188-197: `file_absent` can still report an existing file as absent for an accepted relative path containing `..`.** `workspace_path()` resolves `missing-parent/../ghost` to the in-workspace `ghost`, but `os.path.lexists(workspace / relative_path)` uses the unnormalized pathname. In a fresh workspace containing a regular `ghost` file, `grade_check(workspace, {"kind": "file_absent", "path": "missing-parent/../ghost"})` currently returns `{ "passed": true, "detail": "file was absent" }` because the nonexistent intermediate component prevents lexical lookup. This is a concrete final-state grader bypass, distinct from Round 1's direct dangling-symlink case. Normalize the relative path before the `lexists` check while retaining containment and dangling-symlink protection, then add a deterministic `check.sh` case proving this path fails when `ghost` exists.
2. **artifacts/ch22-evaluating-agents/harness.py:112-120 and 317-346: a self-referential workspace symlink crashes the public harness instead of yielding a failed trial.** A compatible agent can replace seeded `greeting.txt` with `greeting.txt -> greeting.txt` and emit otherwise valid result JSON. `Path.resolve()` raises `RuntimeError: Symlink loop`, but `run_trial()` catches only `HarnessError`; the CLI exits 1, emits a traceback, and writes no report. Convert resolution failures such as `RuntimeError` and `OSError` into a controlled `HarnessError`, then add an end-to-end negative agent case to `check.sh` that asserts a failed trial and written report rather than a harness crash.

## Advisories

- Carried forward from Round 1: `artifacts/ch22-evaluating-agents/README.md:115-120` says malformed check paths fail before an agent is invoked, but traversal containment is currently evaluated during grading after invocation. This remains non-blocking because the path cannot escape the workspace.
- `src/chapters/evaluating-agents.mdx:91` currently points to a GitHub `main`-branch artifact URL that returns 404. The local artifact is present and runnable; verify that external link after the chapter is published.

## Builder resolution (2026-07-18)

Regression gate: re-verified Round 1's dangling-symlink absence-grader fix and both Round 2 REQUIRED findings against the current harness and deterministic artifact self-check. All three hold: a dangling final symlink is present, a lexically normalized in-workspace path cannot hide an existing entry, and a resolution failure becomes a failed trial with a written report.

1. `artifacts/ch22-evaluating-agents/harness.py` now translates `OSError` and `RuntimeError` from either workspace-path resolution into `HarnessError`. `run_trial()` therefore records a controlled `agent_error` result and lets the report write continue when an agent creates a self-referential symlink.
2. `artifacts/ch22-evaluating-agents/harness.py` now lexically normalizes the requested relative path with `os.path.normpath()` before `file_absent` calls `os.path.lexists()`, after the existing containment validation. `missing-parent/../ghost` now checks `ghost`, while a dangling `ghost -> missing-target` remains detectable.
3. `artifacts/ch22-evaluating-agents/negative_agent.py` adds the compatible `symlink-loop` fixture mode. `artifacts/ch22-evaluating-agents/check.sh` asserts its failed `patch-greeting` trial, controlled error tag, and readable report, and adds the normalized-parent-path regression assertion while preserving the direct dangling-symlink assertion.

No advisories were taken. `npm run check` passes: validation, prose lint, pipeline tests, all artifact checks, 48 render tests, production build, and lint.
