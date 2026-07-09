# Agentic Loops — Build Queue

This queue drives the refsite-runner. Work items top to bottom. Each chapter is one work item and is not done until it ships all five grammar elements: expert prose, SVG figure(s), one signature interactive widget, a runnable artifact, and ExerciseCards. The runnable artifact is a hard requirement, not optional.

Before starting chapter work, reconcile this queue and registry.json against the actual refsite-runner skill and the darvinyi-refsite-template contract. Adapt field names and structure to the skill where they differ. These files encode intent; the skill defines the mechanics.

The research corpus in docs/research/ is complete and is the primary knowledge base. Before authoring a chapter, open its matching doc (docs/research/chNN-slug.md; see docs/research/MANIFEST.md for filenames) and use it as the factual backbone; 00-survey-overview.md is shared context for the whole book. Verify only genuinely version-sensitive claims (MCP spec revisions, model and tool releases, framework APIs) against current sources where web access is available. No em dashes. Write for experts.

## Phase 0 — Project setup

- [ ] Confirm template scaffold is in place (Vite + React 18 + TypeScript + MDX + Tailwind + React Router).
- [ ] Apply house style tokens: background #0a0e0f, accent #2dd4bf, JetBrains Mono for structural elements, Inter for prose, code-comment motifs.
- [ ] Confirm the research corpus is present at docs/research/ (survey + ch01–ch22 + MANIFEST). It ships with this package; no research report needs to be placed.
- [ ] Build the part/chapter navigation from registry.json (5 parts, 22 chapters).
- [ ] Establish shared components: ChapterLayout, SVGFigure wrapper, Widget container, ExerciseCard, and a RunnableArtifact block that links or embeds the chapter's runnable code.
- [ ] Verify tsc, ESLint, and build are clean before starting chapter content.

## Phase 1 — Part I: Foundations of the Agentic Loop

- [ ] ch01 — The Loop
- [ ] ch02 — Anatomy of a Tool Call
- [ ] ch03 — Context-Window Economics
- [ ] ch04 — The Landscape

## Phase 2 — Part II: Extending the Agent (MCP and Skills)

- [ ] ch05 — MCP from the Wire Up
- [ ] ch06 — Transports
- [ ] ch07 — Resources, Tools, and Prompts
- [ ] ch08 — Building a Real MCP Server
- [ ] ch09 — The MCP Security Surface
- [ ] ch10 — Skills
- [ ] ch11 — Skill or Server

## Phase 3 — Part III: Multi-Agent Systems

- [ ] ch12 — Delegation
- [ ] ch13 — Coordination Patterns
- [ ] ch14 — When Multi-Agent Fails

## Phase 4 — Part IV: Memory

- [ ] ch15 — The Memory Taxonomy
- [ ] ch16 — Prompt Caching and the Economics of Remembering
- [ ] ch17 — Retrieval as Memory
- [ ] ch18 — Self-Managed Memory

## Phase 5 — Part V: Build Your Own Coding Agent

- [ ] ch19 — Stage One: The Thin Wrapper
- [ ] ch20 — Stage Two: The Real Loop
- [ ] ch21 — Stage Three: Production-Grade
- [ ] ch22 — Evaluating Agents

## Definition of done (per chapter)

A chapter is complete when:
1. Prose teaches the concept at expert level with no em dashes and no AI-tell phrasing.
2. At least one SVG figure explains the model (not decoration).
3. One signature interactive widget lets the reader manipulate the core idea.
4. A runnable artifact is present and actually runs: real executable code beyond inline snippets, with instructions to run it.
5. ExerciseCards close the chapter.
6. tsc, ESLint, and build pass clean.
7. registry.json status for the chapter is set to done.

## Two standing commands

- "Run the next one" — take the topmost unchecked chapter, build it to the definition of done, mark it complete in the queue and registry, commit.
- "Add X to the queue" — insert a new chapter work item in the correct part with a registry entry seeded (id, part, order, title, slug, summary, artifact spec, widget, depends_on).
