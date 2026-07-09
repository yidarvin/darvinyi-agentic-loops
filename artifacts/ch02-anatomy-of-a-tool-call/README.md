# ch02 - anatomy of a tool call

A tracer that runs one tool-use exchange and prints the raw blocks it is made of: the
`tool_use` block the model emits (`id`, `name`, `input`) and the `tool_result` block
your harness returns (`tool_use_id`, `content`, `is_error?`). It is the runnable
companion to chapter 2: a tool call is a structured request the model emits as content,
not an action the model performs.

## Run it

```
cd artifacts/ch02-anatomy-of-a-tool-call
python3 trace.py
```

- **Runtime:** Python 3.9+ (standard library only for the offline path).
- **No key needed.** With no `ANTHROPIC_API_KEY` set, the tracer replays a scripted
  exchange and prints the same block structure, so you can read the anatomy anywhere.

## Run it live

```
pip install -r requirements.txt
export ANTHROPIC_API_KEY=sk-ant-...        # your key
export ANTHROPIC_MODEL=claude-sonnet-5     # optional; this is the default
python3 trace.py
```

Live mode traces a real model and adds one thing the offline path cannot: exact token
counts. It calls the `count_tokens` endpoint twice, with the tools array and without,
and prints the difference. That number is the input-token cost your two tool
definitions add to every request in the session, whether or not the model calls them.

## What you will see

For each turn, the tracer prints the assistant `content` (the `tool_use` blocks and any
text) with its `stop_reason`, then the `tool_result` blocks the harness sends back. Two
things to notice: the `id` on a `tool_use` block reappears as the `tool_use_id` on its
`tool_result` (the correlation handle that binds a call to its result), and the model
resumes only after the result is already in its context.

## The tools

Two real, read-only tools confined to this directory: `read_file(path)` strips directory
components from its argument, and `list_dir(glob)` rejects any glob containing a path
separator or `..`. Neither can reach outside the folder. On a bad argument each returns
an error string with `is_error: true` set on the block, which is how you let the model
correct itself instead of crashing the loop.
