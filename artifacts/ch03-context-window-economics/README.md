# ch03 - context-budget analyzer

Decomposes a captured agent session's context window by category and prices it. It is
the runnable companion to chapter 3: the window is one finite, zero-sum budget, and
because the API is stateless every turn re-sends the whole history, so the bill grows
with the square of the turn count.

## Run it

```
cd artifacts/ch03-context-window-economics
python3 budget.py
```

- **Runtime:** Python 3.9+ (standard library only for the offline path).
- **No key needed.** With no `ANTHROPIC_API_KEY` set, every count is a clearly labeled
  character-based estimate (chars / 4), so the whole decomposition runs anywhere.

## Run it live

```
pip install -r requirements.txt
export ANTHROPIC_API_KEY=sk-ant-...            # your key
export ANTHROPIC_MODEL=claude-sonnet-4-6       # optional; also sets pricing
python3 budget.py
```

Live mode uses the real `count_tokens` endpoint for exact per-category counts. Do not
substitute `tiktoken`: it is OpenAI's tokenizer and undercounts Claude, more so on code.

## What you will see

1. **A `/context`-style breakdown.** Tool definitions, system prompt, history, tool
   results, and the reserved output buffer, each as a token count, a share of the
   window, and a bar, then the free space that is left.
2. **Alarms.** It flags when tool definitions cross ~10% of the window and when free
   space falls below the ~40% working-context ceiling.
3. **The re-send.** It models the session as N turns that grow the tail, then prints one
   final-turn footprint next to the cumulative billed input, so you can read the
   quadratic multiple directly, priced with and without a cached prefix.

## Analyze your own session

`session.json` holds the session the analyzer reads: a `system` string, a `tools` array,
and a `messages` history in Messages-API shape (each assistant `tool_use` followed by a
user `tool_result` with a matching `tool_use_id`). Dump your own agent's message list into
that file, keeping the structure, and rerun to price a real budget. Override the window
size with `CONTEXT_WINDOW` (default 200000).

## The categories

Attribution is done by differences on `count_tokens`: system tokens are the count with the
system prompt minus a minimal baseline, tool tokens are the count with tools minus without,
and tool-result tokens are the full history minus a copy with the results blanked. The
totals are exact in live mode and approximate offline; either way the shares and the
quadratic re-send curve are the point.
