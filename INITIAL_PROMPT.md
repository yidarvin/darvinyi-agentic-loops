# Operator handoff

Open the repository at its root and read `AGENTS.md`, the relevant chapter note,
and its research document. Run the bounded driver rather than asking an agent to
commit directly:

```bash
./run.sh status
./run.sh next
./run.sh loop 6
```

The default implementation model is `gpt-5.6-terra` at `ultra` reasoning effort.
Each stage uses a fresh context, stays scoped to one chapter, validates locally, and
is committed only by the driver. A chapter follows `pending -> draft -> done`; only
an independent approved critique can set `done`.
