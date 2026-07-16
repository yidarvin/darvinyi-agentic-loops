# ch12-delegation --- the context boundary, made observable

A zero-dependency orchestrator paired with Chapter 12. It dispatches an isolated
subagent to summarize a small codebase and then shows you exactly what crossed the
boundary in each direction, so delegation stops being a metaphor and becomes a
measurement.

- **Runtime:** Python 3.9+ (standard library only).
- **Requires:** nothing offline. `--live` uses a real Claude subagent if
  `ANTHROPIC_API_KEY` is set (and the `anthropic` SDK is installed); without either
  it falls back to a deterministic offline summarizer.

## The task, and why it fits delegation

Summarizing a codebase means reading every file, which is a lot of tokens of
mostly-uninteresting content. That is the exact shape delegation is for: push the
messy reading into a subagent's own context window, and let only the distilled
summary cross back. The lead never sees the files.

```
ch12-delegation/
  delegate.py              # the orchestrator: delegate, inline, leak, compare, test
  fixtures/repo/           # a real (tiny) codebase the subagent reads and summarizes
    README.md store.py models.py cli.py api.py
```

The boundary is literal in the code, not a diagram. The lead and the subagent are
separate `Context` objects. `run_subagent(prompt, use_live)` takes a *string* and
returns a `Result`; it is never handed the lead's context. So the only channel down
is the prompt string, and the only channel up is the returned summary, which is
precisely the Claude Agent SDK's rule for the Agent tool (renamed from Task; both
names still work): a subagent does not receive the parent's conversation, and only
its final message returns.

## Run it

```bash
cd artifacts/ch12-delegation

# Delegate to an isolated subagent (default). Watch the lead stay tiny while the
# subagent's context fills with the files it read.
python3 delegate.py

# The counterfactual: no delegation. The lead reads every file into its own window.
python3 delegate.py --inline

# The anti-pattern: delegate, but return the whole transcript instead of a summary.
# The isolation benefit vanishes; the lead bloats back to inline size.
python3 delegate.py --leak

# All three side by side, as one table. This is the chapter's whole argument.
python3 delegate.py --compare

# Print exactly what crossed each way: the prompt string down, the summary up.
python3 delegate.py --show-boundary

# Assertions: the boundary holds, the return is compressed, leaking defeats it.
python3 delegate.py --test

# The artifact gate works from this directory or from the repository root.
bash check.sh

# Optional: use a real Claude subagent for the summary.
export ANTHROPIC_API_KEY=sk-...      # pip install anthropic
python3 delegate.py --show-boundary --live
```

## What you should see

`--compare` prints the load-bearing result:

```
  mode        lead after        explanation
  inline         2168 tok   ->   no delegation: the lead reads everything
  delegate        160 tok   ->   delegation: only the summary crosses back
  leak           2349 tok   ->   delegation, but the subagent returns its transcript
```

Delegation keeps the lead more than 13x smaller than doing the work inline. Leaking
the transcript throws that away and lands back near inline. The token numbers use a
rough four-characters-per-token estimate, not a real tokenizer, so read them as
ratios, not exact counts.

## The `--live` path

With `ANTHROPIC_API_KEY` set and `anthropic` installed, `--live` sends the same
delegation prompt and the file corpus to a real Claude model (override with
`DELEGATE_MODEL`, default `claude-sonnet-5`) and uses its reply as the summary that
crosses the boundary. Everything else is identical, so you can watch a real subagent
compress the same way the offline stand-in does. Any missing key, missing SDK, or API
error degrades quietly back to offline, so the artifact always runs.

## The estimates, stated plainly

The token counts are a four-chars-per-token heuristic, good for watching a window
fill, not for billing. The offline summarizer distills each file to its first
docstring or heading line; a real subagent reasons over the whole file. The fixture
repo is deliberately small so the whole thing runs in a blink; scale the file sizes
up and the compression ratio only grows.
