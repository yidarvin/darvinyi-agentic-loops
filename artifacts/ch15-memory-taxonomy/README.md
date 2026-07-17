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

To inspect one regime or the records that the harness derives from the default structured trace:

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

`trace.json` is the source of truth for the comparison. Copy it, then edit its four
objects to describe a short trace from an agent you operate:

```sh
cp trace.json my-failed-trace.json
# edit working, preference, incident, and procedure in my-failed-trace.json
node memory_harness.mjs --trace my-failed-trace.json --compare
```

The harness derives the displayed interaction, typed episodic/semantic/procedural stores,
retained records, question prompts, and answers from that JSON. `preference` supplies a
dated statement and consolidated profile value. `incident` supplies a dated event and its
current fact. `procedure` supplies the originating instruction and explicit skill. Keep
those types separate while deciding what should survive, consolidate, become a tested
procedure, or be discarded. A database backend can come later.

## Verify it

```sh
bash check.sh
```

The check executes the default comparison and a second structured trace in
`fixtures/custom-trace.json`. It asserts that the fresh working-state case excludes the old
session, the default typed records produce their expected behavior, and custom trace values
change the episodic, semantic, and procedural comparison output.
