# ch18 - persistent self-managed memory

This no-dependency lab exercises the write side of a memory system across two
separate Node processes. Session 1 proposes a framework correction, project
preferences, and an instruction-shaped tool result. The local policy promotes only
trusted user facts, replaces the stale current framework, archives its predecessor,
quarantines the tool result, and compacts the surviving facts into a bounded
project.md-style hot block. Session 2 starts fresh, reads the same state file, and
answers from the persisted facts.

The script deliberately uses a deterministic policy rather than an API model call.
That makes the candidate, validation, promotion, and recall path repeatable. In a
production agent, replace the proposal routine with a model tool call but retain the
candidate-to-trusted gate, provenance checks, namespace isolation, size limits, audit
log, and explicit replacement policy.

## Run it

~~~sh
cd artifacts/ch18-self-managed-memory
node self_managed_memory.mjs --reset --session 1
node self_managed_memory.mjs --session 2
~~~

The first command writes .memory/state.json. The second command is a new process. It
reloads project.md from that file and reports that the project uses Fastify and pnpm,
with production releases scheduled for Tuesday at 14:00 UTC.

For machine-readable traces:

~~~sh
node self_managed_memory.mjs --reset --session 1 --json
node self_managed_memory.mjs --session 2 --json
~~~

Use --state to place the persistent state elsewhere:

~~~sh
node self_managed_memory.mjs --reset --session 1 --state /tmp/memory-lab/state.json
node self_managed_memory.mjs --session 2 --state /tmp/memory-lab/state.json
~~~

## Verify it

~~~sh
bash check.sh
~~~

The check runs session 1 and session 2 in separate Node invocations against a fresh
temporary state file. It asserts all of the following:

- Fastify replaces Express as the current framework, while Express remains archived.
- The tool-derived instruction is quarantined and cannot become trusted memory.
- The hot block is compacted from the current facts with source keys.
- A fresh second process recalls the persisted framework, package manager, and release
  window.

## Requirements and boundaries

- Runtime: Node.js 18 or later.
- Dependencies: none.
- Network and API key: neither is required.
- Persistent state: .memory/state.json by default. It is ignored by Git and can be
  removed to restart the lab.

This is an inspectable reference implementation, not a full authorization system.
The policy trusts only the simulated user channel. A real deployment must authenticate
the source, validate a per-user storage root, filter sensitive data, manage retention,
and protect concurrent writes with an application-level lock or transaction.
