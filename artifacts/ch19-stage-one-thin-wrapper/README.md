# Stage One: The Thin Wrapper

This is a supervised coding-agent REPL. It is deliberately small: a conversation list, four tools, one dispatch function, and a loop that runs while the model requests tools. A no-tool response is final only when it carries `end_turn`.

The implementation is a **product example: Anthropic Messages API**. The central pattern is provider-neutral: preserve the assistant action blocks and return every tool result in the next user turn. Dispatch only when `stop_reason == "tool_use"` and the response contains tool blocks. A `max_tokens` or `model_context_window_exceeded` response fails before dispatch, even if it contains a partial tool block. With no action block, this example accepts only `stop_reason == "end_turn"` as normal completion.

## Safety boundary

The run_bash tool executes shell commands with your user privileges. The file tools reject paths outside the selected workspace, but shell commands are not sandboxed and can still read, write, or reach the network outside it.

The documented launcher starts Python without an API-key environment variable. After Python starts, it reads the key through a hidden terminal prompt, constructs the SDK client with that local value, and closes the prompt before model-controlled tools become available. Every shell child excludes `ANTHROPIC_API_KEY` and receives no standard input. Start from a fresh terminal that has never exported `ANTHROPIC_API_KEY`; the artifact refuses to start if that variable is already present in its own environment. For the key entered at the prompt, this keeps the direct shell child, REPL process, and launcher-ancestor environment paths that `run_bash` can inspect with `ps` free of that key.

This is credential hygiene, not a sandbox. Commands can still reach other user-accessible environment variables, files, credentials, and the network. The authenticated SDK client also necessarily keeps a credential in process memory, which this Stage One artifact does not protect from a capable same-user process inspector.

Run this only under close supervision in a disposable or otherwise contained repository. Do not expose other secrets, production credentials, untrusted instructions, or permission to operate unattended.

## Run it

Use Python 3.11 or later. Start from a fresh terminal that has never exported `ANTHROPIC_API_KEY`; do not launch the REPL from a nested shell whose ancestor still exports it. From this artifact directory:

~~~sh
python3 -m venv .venv
source .venv/bin/activate
python3 -m pip install -r requirements.txt
export THIN_WRAPPER_MODEL=your-current-tool-capable-model
python3 agent.py --workspace /path/to/disposable-repo
~~~

After Python starts, it prompts for the Anthropic API key without echoing it. Do not export `ANTHROPIC_API_KEY` or pass the key as a command-line argument. The model identifier is deliberately not hard-coded. Provider model names move faster than the loop contract. Set `THIN_WRAPPER_MODEL` to a current model ID your account can use for tool calls.

Try a bounded task such as:

~~~text
Fix the failing slug test. Read the relevant files, make the smallest edit, then run the test.
~~~

The REPL prints every tool call. It keeps the full conversation in memory for the process lifetime. Type /quit or /exit to stop it.

## Offline check

~~~sh
bash check.sh
~~~

The check compiles the program and exercises file reading, overlapping exact-match rejection, path containment, error results, a local shell command, API-key filtering for shell children, and a real clean-environment subprocess that passes a synthetic key after startup and inspects the child, REPL process, and ancestor `ps` paths. It also covers truncated responses with and without a tool block. It does not import the SDK, require an API key, or make a network call.

## What this stage intentionally omits

- No retry policy, streaming output, interruption, compaction, or context budget. Those are Stage Two concerns.
- No permission prompts, sandbox, network isolation, memory, MCP, or subagents. Those are Stage Three concerns.
- No persistence or evaluation harness. The conversation disappears when the REPL exits.

The omissions are the lesson. This wrapper proves the control loop, not the production safety case.
