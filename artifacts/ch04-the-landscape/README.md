# ch04 - loop comparator

Runs one small task under three harness postures and compares the loop, not the output. It
is the runnable companion to chapter 4: Claude Code, Codex, and opencode run the same
program (a model in a loop) and diverge on a short list of architectural bets, so the same
fix travels through three different loops.

## Run it

```
cd artifacts/ch04-the-landscape
python3 landscape.py
```

- **Runtime:** Python 3.9+ (standard library only for the offline path).
- **No key needed.** With no `ANTHROPIC_API_KEY` set, token counts are deterministic
  estimates, so the whole comparison runs anywhere. The fix is still really executed to
  prove all three postures produce the same, passing output.

## Run it live

```
pip install -r requirements.txt
export ANTHROPIC_API_KEY=sk-ant-...            # your key
export FRONTIER_MODEL=claude-sonnet-4-6        # optional; the "frontier" model
export CHEAP_MODEL=claude-haiku-4-5            # optional; the "cheap" planning model
python3 landscape.py
```

Live mode calls the model on the plan and edit phases, routed per posture, and reports real
token counts for those phases (the read, test, and PR phases stay estimated, since no real
shell or PR runs), so you can watch model coupling change the cost of the same output. The
Anthropic API is used as a uniform backend for all three postures here; the point is the
harness posture, not the vendor.

## The three postures

| posture | models on | after modeling |
|---|---|---|
| **interactive** | Claude Code | approve every edit and shell action, one frontier model, fresh session, local tree, permission-rule trust boundary |
| **delegated** | Codex | no prompts, OS-sandbox containment with the network off, persistent thread |
| **agnostic** | opencode | cheap model plans, frontier model fixes, per-tool permissions, persistent daemon, git-snapshot rollback |

## What you will see

1. **Output convergence.** Each posture produces a fix, and the script runs the fixed
   function (`c_to_f(100)` must be `212`, `c_to_f(0)` must be `32`) to prove they are
   functionally identical. Offline the expressions are byte-identical; a live model may
   format the same formula differently, so execution, not string equality, is the proof.
2. **Loop divergence.** A side-by-side table: where the loop runs, the trust boundary, how
   many approval gates fired, model routing, tokens, and session persistence. Different
   loop.
3. **Coupling, priced.** Routing planning to a cheap model makes the agnostic posture
   cheaper for the same fix, which is the model-coupling axis showing up as a cost, not a
   token count.

The lesson: the output converged and the loop did not. That short list of differences is
what you are choosing between when you pick a tool.
