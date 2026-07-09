# CLAUDE.md — Agentic Loops

Project memory for the Agentic Loops refsite. This file is glue. It points at the portable build procedure (the refsite-runner skill) and records only what is specific to this project. Keep it thin.

## What this is

Agentic Loops is an expert-level reference/textbook site on building with AI coding tools: MCP, skills, multi-agent workflows, memory, and building your own coding agent from scratch. Audience is professional AI researchers and senior engineers. Theory-heavy but practically grounded. Claude Code is the spine; Codex and opencode are contrast points, not equal-weight coverage.

## How to build it

1. Use the refsite-runner skill for the build procedure. That skill is the source of truth for mechanics: how to generate a chapter, run the queue, wire navigation, and validate. This file does not restate it.
2. registry.json is the chapter manifest (5 parts, 22 chapters, each with an artifact spec and a widget).
3. queue.md is the work order and the definition of done.
4. docs/research/ is the knowledge base, and it is COMPLETE. It holds one research doc per chapter (chNN-slug.md), a cross-cutting survey (00-survey-overview.md), and a MANIFEST.md index. Before authoring a chapter, open its matching doc (see MANIFEST.md for the filename), treat it as the factual backbone (numbers, citations, caveats, staged recommendations), then write the chapter in house style. The 00-survey doc is shared context for the whole book. No further research is required to build; verify only genuinely version-sensitive claims (MCP spec revisions, model and tool releases, framework APIs) against current sources where web access is available, and do not contradict a doc without reason.

On first run, reconcile registry.json and queue.md against the actual refsite-runner skill and the darvinyi-refsite-template contract. These seed files encode intent using a schema aligned with prior refsites; adapt field names and structure to whatever the skill actually expects. Do not assume the schema here is authoritative over the skill.

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

- "Run the next one" — build the topmost unchecked chapter to the definition of done, update queue.md and registry.json, commit.
- "Add X to the queue" — insert a new chapter in the right part with a seeded registry entry.

## Conventions

- Local-first, git-centric. NAS mirror alongside GitHub per the usual workflow.
- Simpler option first, with explicit upgrade paths noted rather than built prematurely.
- Commit per completed chapter with a clear message.
