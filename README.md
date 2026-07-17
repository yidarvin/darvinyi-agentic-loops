# Agentic Loops

An expert reference textbook on building reliable AI coding systems: tool protocols,
skills, delegation, coordination, memory, and a production-grade coding agent. It
uses a vendor-neutral conceptual spine with labelled product examples.

## Local development

```bash
npm install
npm run dev
npm run check
```

`npm run check` is the release gate: state validation, prose lint, pipeline tests,
deterministic runnable-artifact checks, UI tests, production build, and advisory
lint. Each chapter must include prose, an SVG figure, a signature widget, a runnable
artifact with `README.md` and `check.sh`, and exercises.

## Terra build and critique loop

The queue lives in `prompts/queue.md`; the manifest is `content/registry.json`; the
research corpus is complete in `docs/research/`. The driver uses fresh Terra contexts
and owns all commits. It never grants the model Git authority.

```bash
./run.sh status                     # state and next stage
./run.sh next                       # one bounded build, critique, or resolve stage
./run.sh loop 6                     # six stages, stopping on any failure
./run.sh -m gpt-5.6-terra -e ultra next
```

The state machine is `pending -> draft -> done`. Build marks a chapter draft; a
separate critic writes `content/critiques/<slug>.md`; only `verdict: approve` allows
the validator to record `done`. `runqueue.sh` is a compatibility wrapper only.

The launchd worker runs one leased Terra stage at a time, validates exact role-specific
write scope, commits every valid state transition locally, and immediately selects the
next stage. It pushes the accumulated build, critique, and resolution commits only when
the independent critic approves the chapter as done, producing at most one deployment per
completed chapter. Delayed Codex output keeps its lease and is recovered after the model
process exits; a quiet grace period prevents duplicate retries. `./run.sh status` shows
the queue, last worker heartbeat, and any active lease.

Each model stage runs in its own process group behind an output-idle and absolute-runtime
watchdog. The durable service terminates the full group after 30 minutes without output
or 90 minutes total, clears an unchanged lease, and lets launchd retry on its next tick.
Valid edits are still validated and committed if the model exits abnormally. Override
the bounds for a manual run with `TERRA_IDLE_TIMEOUT_SECONDS` and
`TERRA_MAX_RUNTIME_SECONDS`.

On macOS, the persistent LaunchAgent runs directly from this checkout. The service
pins `/usr/bin/git`, prepends `scripts/service-bin` so child agents resolve the same
Apple Git identity, and routes parent Git calls through a neutral-cwd helper. Run
`scripts/install-queue-worker.sh` to stop any loaded copy, install the current plist,
and restart the service. `./run.sh doctor` reports the effective Git and service plan
without changing repository or queue state.

## Release

Build output is static Vite content in `dist/`. Vercel is the deployment target, but
this branch is release-ready only: deployment remains an explicit follow-up action.
