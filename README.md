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

## Release

Build output is static Vite content in `dist/`. Vercel is the deployment target, but
this branch is release-ready only: deployment remains an explicit follow-up action.
