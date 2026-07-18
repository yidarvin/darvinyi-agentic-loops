# Stage Two: The Real Loop

This artifact is a small coding-agent harness that turns the Stage One loop into a recoverable one. It has real workspace tools, one retry owner, bounded shell execution, tool-result error paths, a basic permission gate, and a clear-first context manager.

The default provider is deterministic and offline. It uses a temporary workspace, simulates one overloaded model request, makes one intentionally bad edit, recovers through a matching error result, applies the corrected edit, and asks the shell to run a focused check. It requires only Python 3.11 or later on macOS.

## Run the offline trace

From this directory:

~~~sh
python3 agent.py --demo --mode accept-edits
~~~

The trace shows the retry, a failed exact replacement, the matching error result, the corrective read, the successful edit, and the shell check being denied. Accept-edits permits the write but still leaves shell execution behind the gate.

To let the disposable demo run its benign focused shell check:

~~~sh
python3 agent.py --demo --mode dangerously-skip-permissions
~~~

That mode is intentionally named as a warning. It is acceptable only for the artifact's temporary workspace. It is not suitable for a real repository.

## What runs for real

- list_files, read_file, search_files, and replace_once operate on a selected workspace.
- File paths resolve inside that workspace or return a model-visible error result.
- replace_once rejects absent and ambiguous text with corrective messages.
- search_files and run_shell enforce aggregate character caps with a visible middle-truncation marker.
- run_shell starts a new process group, has no standard input, combines standard error with standard output, strips any accidental ANTHROPIC_API_KEY from its child environment, and terminates and reaps the full process group on timeout, terminal interruption, or a supervisor SIGTERM.
- Every tool call produces a result with its original identifier. Errors and permission denials use the same result path.
- Context management first clears stale tool bodies while retaining call identifiers. Its demonstration compaction produces a structured continuation summary.

The shell tool is still not a sandbox. It can execute arbitrary commands with the current user's privileges and can reach user-accessible files, environment variables other than the filtered key, and the network. The permission modes are a human-interface control, not isolation.

## Optional product example: Anthropic streaming

The optional provider adapts the loop to the Anthropic Python SDK. It uses streaming, records text deltas, requires a clean terminal stream event before dispatch, and sets SDK retries to zero so the harness owns transient retries.

Install a current SDK, create a mode-0600 file containing only the API key, and use a current tool-capable model identifier. Do not export ANTHROPIC_API_KEY: the harness refuses an inherited key so a model-controlled shell cannot recover the live credential from its parent process environment.

~~~sh
python3 -m pip install anthropic
python3 agent.py \
  --provider anthropic \
  --api-key-file /path/to/private-anthropic-key \
  --model your-current-tool-capable-model \
  --workspace /path/to/disposable-repository \
  --task "Read the failing test, make the smallest safe fix, then run that test."
~~~

The program reads the key file only after startup and keeps it out of the process environment. It exits with a clear setup error if the package, key file, model, task, or workspace is missing. Run a live provider only in a disposable or otherwise contained repository. A production implementation should use the provider's token-counting endpoint and a real sandbox before it handles untrusted work.

## Run the checks

~~~sh
bash check.sh
~~~

The check is offline and credential-free. It verifies syntax, file reads, bounded search output, symlink and traversal rejection, exact-edit ambiguity, permission denial, bounded retry, shell output truncation, cleanup of cooperative and SIGTERM-resistant shell children on timeout, terminal interruption, and harness SIGTERM, after-start provider-key handling, tool-result identifier pairing, deterministic compaction, and the full scripted recovery path.

## Design boundary

Stage Two makes one local loop durable enough to debug and operate. It does not provide MCP, subagents, persistent cross-session memory, network isolation, or a security boundary. Those belong to Stage Three.
