# AGENTS.md — Agentic Loops

Project memory for the Agentic Loops refsite. This file is glue. It points at the portable build procedure (the refsite-runner skill) and records only what is specific to this project. Keep it thin.

## What this is

Agentic Loops is an expert-level reference/textbook site on building with AI coding tools: MCP, skills, multi-agent workflows, memory, and building your own coding agent from scratch. Audience is professional AI researchers and senior engineers. Theory-heavy but practically grounded. The conceptual spine is vendor-neutral; Codex, Claude Code, and other tools appear as clearly labelled examples rather than competing default narratives.

## How to build it

1. Use the refsite-runner skill for the build procedure. That skill is the source of truth for mechanics: how to generate a chapter, run the queue, wire navigation, and validate. This file does not restate it.
2. content/registry.json is the chapter manifest (5 parts, 22 chapters). It uses the template's flat schema (num, slug, title, subtitle, part, routes, status). The richer per-chapter intent from the seed (summary, runnable-artifact spec, widget, depends_on) lives in prompts/notes/<slug>.md, which the runner reads when it builds a chapter.
3. prompts/queue.md is the work order; scripts/check.sh (npm run check) is the definition of mechanical done. `./run.sh` is the stage-aware Terra driver: it invokes fresh model contexts, validates edits, and commits itself. Models never commit or push.
4. docs/research/ is the knowledge base, and it is COMPLETE. It holds one research doc per chapter (chNN-slug.md), a cross-cutting survey (00-survey-overview.md), and a MANIFEST.md index. Before authoring a chapter, open its matching doc (see MANIFEST.md for the filename), treat it as the factual backbone (numbers, citations, caveats, staged recommendations), then write the chapter in house style. The 00-survey doc is shared context for the whole book. No further research is required to build; verify only genuinely version-sensitive claims (MCP spec revisions, model and tool releases, framework APIs) against current sources where web access is available, and do not contradict a doc without reason.

Reconciliation is done. The seed files that shipped at the repo root (registry.json, queue.md, in the prior-refsite schema) have been migrated into the template's contract: content/registry.json and prompts/queue.md now hold the 22 chapters in the flat template schema, and the per-chapter artifact/widget/summary/depends_on intent lives in prompts/notes/. The root seed files have been removed; do not resurrect them. content/registry.json and prompts/queue.md are the only state files, and the refsite-runner skill owns the mechanics.

## Stack

Vite + React 18 + TypeScript + MDX + Tailwind + React Router, per the darvinyi-refsite-template. Deploy target Vercel.

## House style (non-negotiable)

- Background #0a0e0f, teal accent #2dd4bf.
- JetBrains Mono for structural/code-comment elements, Inter for prose.
- Dark-minimal, code-comment motifs, consistent with the darvinyi house style.
- No em dashes anywhere in prose.
- No AI-tell phrasing or hedging filler. Write with decisive momentum.
- Do not over-explain fundamentals the expert audience already owns.

## Chapter grammar (every chapter, no exceptions)

1. Prose teaches the concept.
2. SVG figure(s) explain the model.
3. One signature interactive React widget per chapter.
4. A runnable artifact: real executable code the reader can run, beyond inline snippets. Hard requirement.
5. ExerciseCards at the end.

## Runnable artifacts

This is the distinguishing feature of this site versus prior refsites. The topic is executable, so the repo is also a library of runnable AI-tooling patterns. Each chapter's artifact must actually run, with clear run instructions. Where an artifact needs an API key or external service, document the requirement and fail gracefully without it. Keep artifacts self-contained per chapter where possible.

## Standing commands

- "Run the next one" — use `./run.sh next`. The driver chooses build, critique, or resolve; chapters move pending -> draft -> done and only an approved independent critique may set done.
- "Add X to the queue" — insert a new chapter in the right part with a seeded registry entry.

## Conventions

- Local-first, git-centric. NAS mirror alongside GitHub per the usual workflow.
- Simpler option first, with explicit upgrade paths noted rather than built prematurely.
- Commit per completed chapter with a clear message.
