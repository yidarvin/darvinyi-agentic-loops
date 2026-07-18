# Stage One: The Thin Wrapper

This is a supervised coding-agent REPL. It is deliberately small: a conversation list, four tools, one dispatch function, and a loop that runs while the model requests tools. A no-tool response is final only when it carries `end_turn`.

The implementation is a **product example: Anthropic Messages API**. The central pattern is provider-neutral: preserve the assistant action blocks and return every tool result in the next user turn. Dispatch only when `stop_reason == "tool_use"` and the response contains tool blocks. A `max_tokens` or `model_context_window_exceeded` response fails before dispatch, even if it contains a partial tool block. With no action block, this example accepts only `stop_reason == "end_turn"` as normal completion.

## Safety boundary

The run_bash tool executes shell commands with your user privileges. The file tools reject paths outside the selected workspace, but shell commands are not sandboxed and can still read, write, or reach the network outside it.

The documented launcher reads the key into an unexported variable inside a short-lived subshell and assigns it only to the Python process. The REPL then constructs its SDK client with the explicit key and removes `ANTHROPIC_API_KEY` from its own environment; every shell child also excludes it. Started from a fresh terminal with no prior export, this closes the direct-child, REPL-parent, and invoking-shell-ancestor environment paths that `run_bash` can inspect with `ps`.

This is credential hygiene, not a sandbox. Commands can still reach other user-accessible environment variables, files, credentials, and the network. The authenticated SDK client also necessarily keeps a credential in process memory, which this Stage One artifact does not protect from a capable same-user process inspector.

Run this only under close supervision in a disposable or otherwise contained repository. Do not expose other secrets, production credentials, untrusted instructions, or permission to operate unattended.

## Run it

Use Python 3.11 or later. Start from a fresh terminal that has never exported `ANTHROPIC_API_KEY`; do not launch the REPL from a nested shell whose ancestor still exports it. From this artifact directory:

~~~sh
python3 -m venv .venv
source .venv/bin/activate
python3 -m pip install -r requirements.txt
export THIN_WRAPPER_MODEL=your-current-tool-capable-model
(
  printf 'Anthropic API key: '
  read -r -s THIN_WRAPPER_API_KEY
  printf '\n'
  ANTHROPIC_API_KEY="$THIN_WRAPPER_API_KEY" \
    exec python3 agent.py --workspace /path/to/disposable-repo
)
~~~

`THIN_WRAPPER_API_KEY` is an unexported subshell variable. `ANTHROPIC_API_KEY` exists only in the Python process long enough to initialize the client, then the artifact removes it. The model identifier is deliberately not hard-coded. Provider model names move faster than the loop contract. Set `THIN_WRAPPER_MODEL` to a current model ID your account can use for tool calls.

Try a bounded task such as:

~~~text
Fix the failing slug test. Read the relevant files, make the smallest edit, then run the test.
~~~

The REPL prints every tool call. It keeps the full conversation in memory for the process lifetime. Type /quit or /exit to stop it.

## Offline check

~~~sh
bash check.sh
~~~

The check compiles the program and exercises file reading, overlapping exact-match rejection, path containment, error results, a local shell command, API-key removal from the REPL, shell children, and the inspected parent/ancestor process environments, plus truncated-response handling with and without a tool block. It does not import the SDK, require an API key, or make a network call.

## What this stage intentionally omits

- No retry policy, streaming output, interruption, compaction, or context budget. Those are Stage Two concerns.
- No permission prompts, sandbox, network isolation, memory, MCP, or subagents. Those are Stage Three concerns.
- No persistence or evaluation harness. The conversation disappears when the REPL exits.

The omissions are the lesson. This wrapper proves the control loop, not the production safety case.
