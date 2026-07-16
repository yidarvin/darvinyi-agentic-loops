# ch12-delegation --- the context boundary, made observable

A zero-dependency boundary lab paired with Chapter 12. It models one isolated,
one-shot, non-fork worker with no messages or resume, then shows you the direct
briefing and selected return so delegation stops being a metaphor and becomes a
measurement. It is intentionally narrower than a full Claude Code or Claude Agent SDK
subagent transport.

- **Runtime:** Python 3.9+ (standard library only).
- **Requires:** nothing offline. `--live` makes one Anthropic Messages API call as a
  live model stand-in if `ANTHROPIC_API_KEY` is set (and the `anthropic` SDK is
  installed); without either it falls back to a deterministic offline summarizer.

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

The boundary is literal in the lab code, not a diagram. The lead and worker are separate
`Context` objects. `run_subagent(prompt, use_live)` receives a task-specific briefing
but is never handed the lead context. Its worker Context starts with a fixed modeled
runtime baseline: system and environment, project rules and memory, a git-status snapshot,
and preloaded skills. Within this narrow model, the briefing is the direct dynamic lead
input and the code selects a summary or transcript as the return.

That is not an absolute claim about Claude Code. A real non-fork Claude Code subagent also
starts with its own runtime baseline and can have a sibling roster; SendMessage and resume
introduce more paths, and Claude Code can scan a final report before the parent reads it.
The lab isolates the context-compression mechanic rather than emulating that full runtime.

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

# Print the lab model's task-specific briefing and selected summary return.
python3 delegate.py --show-boundary

# Assertions: the boundary holds, the return is compressed, leaking defeats it.
python3 delegate.py --test

# The artifact gate works from this directory or from the repository root.
bash check.sh

# Optional: use a one-shot live model stand-in for the summary.
export ANTHROPIC_API_KEY=sk-...      # pip install anthropic
python3 delegate.py --show-boundary --live
```

## What you should see

`--compare` prints the load-bearing result:

```
  mode        lead after        explanation
  inline         2168 tok   ->   no delegation: the lead reads everything
  delegate        160 tok   ->   lab delegation: selected summary enters the lead
  leak           2376 tok   ->   delegation, but the subagent returns its transcript
```

Delegation keeps the lead more than 13x smaller than doing the work inline. Leaking
the transcript throws that away and lands back near inline. The token numbers use a
rough four-characters-per-token estimate, not a real tokenizer, so read them as
ratios, not exact counts.

## The `--live` path

With `ANTHROPIC_API_KEY` set and `anthropic` installed, `--live` sends one Messages
API request containing the task-specific briefing and a pre-concatenated file corpus to a
live Claude model (override with `DELEGATE_MODEL`, default `claude-sonnet-5`). Its reply
becomes the summary selected by this lab model. This is a one-shot live model stand-in, not
a Claude Code or Claude Agent SDK subagent: it invokes neither the Agent tool nor a
tool-using agent loop. Any missing key, missing SDK, or API error degrades quietly back to
offline, so the artifact always runs.

## The estimates, stated plainly

The token counts are a four-chars-per-token heuristic, good for watching a window
fill, not for billing. The offline summarizer distills each file to its first
docstring or heading line; the live model stand-in receives the full preloaded corpus.
The fixture repo is deliberately small so the whole thing runs in a blink; scale the
file sizes up and the compression ratio only grows.
