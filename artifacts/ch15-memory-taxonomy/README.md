# ch15 - memory-regime harness

This small offline harness runs one fixed interaction under five memory regimes. It makes
the taxonomy concrete without calling a model: the prior conversation stays constant while
the state available after a new-session boundary changes. The harness deliberately begins
with active working state reset, then shows which durable records are selected for the new
session's context projection.

## Run it

```sh
cd artifacts/ch15-memory-taxonomy
node memory_harness.mjs --compare
```

- **Runtime:** Node.js 18 or later.
- **Dependencies:** none.
- **Network and API key:** neither is required.

To inspect one regime or the records that the harness derives from the fixed interaction:

```sh
node memory_harness.mjs --regime episodic
node memory_harness.mjs --regime semantic
node memory_harness.mjs --regime procedural
node memory_harness.mjs --show-stores
```

## What the comparison means

`working` starts a new session with reset active working state, so its context projection
contains only the current request. This is a fresh-session case, not a definition of
working memory: in a continuing decision loop, active working state can persist across
LLM calls. `episodic` keeps the dated events. `semantic` keeps the distilled preference and
release fact. `procedural` keeps an explicit release skill. `all` selects from all three
persistent stores. The output reports the consulted store, retained records, and answers to
the same three questions for every regime.

The procedural regime models a selected explicit code or prompt skill. It does not model
parametric procedural memory in the model weights, which conditions every generation without
a retrieval step.

This is a deterministic design harness, not an LLM benchmark or a production memory
framework. Its value is the controlled contrast: a raw event, a generalized fact, and an
executable rule have different future behavior even when they come from the same history.

## Adapt it to a real agent

Replace the three strings in `transcript` with a short trace from an agent you operate.
Then decide which records should remain as episodes, which can be consolidated into facts,
and which deserve a tested procedure. Keep the typed stores separate while you make that
decision. A database backend can come later.

## Verify it

```sh
bash check.sh
```

The check executes the comparison and asserts that the fresh working-state case excludes the
old session, episodic memory retains the incident, semantic memory retains the profile, and
an explicit procedural skill enforces the release guardrail.
