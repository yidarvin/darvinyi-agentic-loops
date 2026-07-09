# ch01 - the loop

A minimal agent loop that narrates its four phases (`perceive`, `decide`, `act`,
`observe`) on every turn. It is the runnable companion to chapter 1: the agent is
the loop, not the model.

## Run it

```
cd artifacts/ch01-the-loop
python3 loop.py
```

- **Runtime:** Python 3.9+ (standard library only for the offline path).
- **No key needed.** With no `ANTHROPIC_API_KEY` set, the loop runs against a
  deterministic offline model that replays a scripted trajectory, so you still see
  every phase turn. This is the graceful fallback: it runs anywhere, with no setup.

## Run it live

```
pip install -r requirements.txt
export ANTHROPIC_API_KEY=sk-ant-...        # your key
export ANTHROPIC_MODEL=claude-sonnet-5     # optional; this is the default
python3 loop.py
```

The loop body is identical in both modes. Only `choose_model()` differs: live mode
calls the Anthropic Messages API, offline mode replays a script. That is the
chapter's thesis made concrete: swap the policy, keep the loop.

## What you will see

Each turn prints the phase banners. Watch two things: the message list grows only on
`DECIDE` (the assistant turn is appended) and `OBSERVE` (the tool result is appended),
and the loop stops when the model returns `stop_reason != "tool_use"`. The `HALT` line
is the harness deciding to exit, not the model.

## The tools

Two read-only tools confined to this directory: `list_files(glob)` rejects any glob
containing a path separator or `..`, and `count_lines(path)` strips directory
components from its argument. Neither can reach outside the folder. This is a toy
agent-computer interface; later chapters make it real.
