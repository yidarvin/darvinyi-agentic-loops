# ch15 - memory-regime harness

This small offline harness runs one fixed interaction under five memory regimes. It makes
the taxonomy concrete without calling a model: the prior conversation stays constant while
the store available after a new-session boundary changes.

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

`working` starts a new session with only the current request. `episodic` keeps the dated
events. `semantic` keeps the distilled preference and release fact. `procedural` keeps the
release rule. `all` selects from all three persistent stores. The output reports the
consulted store, retained records, and answers to the same three questions for every regime.

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

The check executes the comparison and asserts that working memory forgets the old session,
episodic memory retains the incident, semantic memory retains the profile, and procedural
memory enforces the release guardrail.
