# Stage One: The Thin Wrapper

This is a supervised coding-agent REPL. It is deliberately small: a conversation list, four tools, one dispatch function, and a loop that continues until the model stops requesting tools.

The implementation is a **product example: Anthropic Messages API**. The central pattern is provider-neutral: preserve the assistant action blocks, return every tool result in the next user turn, and stop only when there are no more action blocks.

## Safety boundary

The run_bash tool executes shell commands with your user privileges. The file tools reject paths outside the selected workspace, but shell commands are not sandboxed and can still read, write, or reach the network outside it.

Run this only under close supervision in a disposable or otherwise contained repository. Do not give it secrets, production credentials, untrusted instructions, or permission to operate unattended.

## Run it

Use Python 3.11 or later. From this artifact directory:

~~~sh
python3 -m venv .venv
source .venv/bin/activate
python3 -m pip install -r requirements.txt
export ANTHROPIC_API_KEY=your-key
export THIN_WRAPPER_MODEL=your-current-tool-capable-model
python3 agent.py --workspace /path/to/disposable-repo
~~~

The model identifier is deliberately not hard-coded. Provider model names move faster than the loop contract. Set THIN_WRAPPER_MODEL to a current model ID your account can use for tool calls.

Try a bounded task such as:

~~~text
Fix the failing slug test. Read the relevant files, make the smallest edit, then run the test.
~~~

The REPL prints every tool call. It keeps the full conversation in memory for the process lifetime. Type /quit or /exit to stop it.

## Offline check

~~~sh
bash check.sh
~~~

The check compiles the program and exercises file reading, exact string replacement, path containment, error results, and a local shell command. It does not import the SDK, require an API key, or make a network call.

## What this stage intentionally omits

- No retry policy, streaming output, interruption, compaction, or context budget. Those are Stage Two concerns.
- No permission prompts, sandbox, network isolation, memory, MCP, or subagents. Those are Stage Three concerns.
- No persistence or evaluation harness. The conversation disappears when the REPL exits.

The omissions are the lesson. This wrapper proves the control loop, not the production safety case.
