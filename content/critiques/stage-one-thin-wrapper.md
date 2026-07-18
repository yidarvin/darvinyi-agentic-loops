verdict: resolved

## Round 1 review (2026-07-18)

Fresh-eyes review: no prior critique history exists. Read the current chapter, exact figure and widget, artifact README, source, check script, requirements, build notes, and research backbone in full. Ran `bash artifacts/ch19-stage-one-thin-wrapper/check.sh` and `npm run check`, both passing. Exercised the artifact's missing-configuration path, mocked a `max_tokens` API response, and reproduced the edit and environment behaviors below in temporary workspaces. Checked the linked primary sources: Anthropic's tool-use and stop-reason documentation, Ball's build, mini-swe-agent, Aider's edit-format evaluation, the Dive into Claude Code paper, and Anthropic's effective-agents guidance.

## Required fixes

1. **`artifacts/ch19-stage-one-thin-wrapper/agent.py:221-233`: a truncated model response is treated as a completed turn.** `run_agent` returns whenever it finds no `tool_use` block and never inspects `response.stop_reason`. A mocked response with `stop_reason="max_tokens"` and a text block printed the partial text and returned normally. Anthropic's [stop-reason documentation](https://platform.claude.com/docs/en/build-with-claude/handling-stop-reasons) says `max_tokens` and `model_context_window_exceeded` are truncated responses and instructs applications to check `stop_reason`. This contradicts the chapter's categorical rule at `src/chapters/stage-one-thin-wrapper.mdx:30-42`, the figure's “stop here, not on stop_reason” label, and the widget's exit invariant. Keep tool blocks as the dispatch signal, but handle a no-tool response as normally complete only for the appropriate completion state. Stage One can fail loudly on truncation rather than adding recovery. Update the prose, figure, widget, and source list to teach that distinction, and add an offline regression check for it.
2. **`artifacts/ch19-stage-one-thin-wrapper/agent.py:126-149`: `edit_file` silently chooses an overlapping duplicate despite promising a unique exact match.** `content.count(old_str)` counts only non-overlapping matches. With a file containing `aaaa`, `edit_file("overlap.txt", "aaa", "X")` returned `Updated overlap.txt` and wrote `Xa`, although the exact string starts at offsets 0 and 1. That breaks the safety invariant claimed at `src/chapters/stage-one-thin-wrapper.mdx:52-55` and demonstrated by the widget: ambiguity must become an error, not a silent edit. Detect a second start position including overlaps before writing, then add this case to the deterministic offline check.
3. **`artifacts/ch19-stage-one-thin-wrapper/agent.py:88-95,151-160`: the model-controlled shell receives the required Anthropic credential.** The README tells readers to export `ANTHROPIC_API_KEY`, then `WorkspaceTools` copies all of `os.environ` into every `run_bash` child. With a fixture key, `run_bash("printf '%s' \"$ANTHROPIC_API_KEY\"")` returned that key in the tool result, so the model can read and network-exfiltrate the credential that the artifact necessarily requires. The intentionally unsandboxed shell is disclosed, but this avoidable credential exposure contradicts the README instruction not to give the tool secrets. Exclude `ANTHROPIC_API_KEY` from the child command environment before `subprocess.run`, preserve the warning about other user-accessible data, and add a deterministic check proving the credential is absent from shell output.

## Advisories

- None.

## Builder resolution (2026-07-18)

Regression gate: re-verified all Round 1 REQUIRED findings against the current chapter, figure, widget, artifact, and research backbone. There are no earlier critique rounds or prior required fixes.

1. agent.py now dispatches every detected tool_use block before evaluating a no-tool response. It accepts only end_turn as normal completion, fails loudly on max_tokens and model_context_window_exceeded, and its offline self-check covers both truncation states plus a tool_use response carrying max_tokens.
2. agent.py now checks for a second match start position before writing, including overlaps. The offline self-check proves that replacing aaa in aaaa returns an error and leaves the file unchanged.
3. WorkspaceTools removes ANTHROPIC_API_KEY from each shell child environment. The offline self-check injects a fixture key and proves a model-invoked shell cannot print it. README.md preserves the unsandboxed-shell warning and states that other user-accessible credentials and data remain exposed.
4. stage-one-thin-wrapper.mdx, StageOneThinWrapperFigure.tsx, and StageOneThinWrapperWidget.tsx now teach action-based dispatch plus end_turn-only normal completion. The chapter source list includes Anthropic's stop-reason guidance. The matching research file was corrected where its termination, exact-match, and shell-environment examples repeated the material errors.

No advisories were taken. npm run check passes.
