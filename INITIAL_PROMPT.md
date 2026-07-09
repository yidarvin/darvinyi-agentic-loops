# Initial prompt for Claude Code

Paste the block below into Claude Code from the root of the new Agentic Loops repo (created from darvinyi-refsite-template), after placing registry.json, queue.md, CLAUDE.md, and the research report in the repo.

---

You are building "Agentic Loops," an expert-level reference/textbook site on building with AI coding tools. Read CLAUDE.md, registry.json, and queue.md in the repo root first. Use the refsite-runner skill at ~/.claude/skills/refsite-runner/ for the build procedure; it is the source of truth for mechanics.

Context you need:

- Audience is professional AI researchers and senior engineers. Theory-heavy but practically grounded. Claude Code is the spine; Codex and opencode are contrast points only.
- The knowledge base for chapter content is the research corpus in docs/research/, and it is already complete. It contains one research doc per chapter (chNN-slug.md), a cross-cutting survey (00-survey-overview.md), and a MANIFEST.md index mapping chapters to filenames. Before writing a chapter, open its matching doc and use it as the factual backbone (numbers, citations, caveats). Verify only genuinely version-sensitive claims (MCP spec revisions, model and tool releases, framework APIs) against current sources where you have web access. Do not contradict a research doc without reason.
- House style is non-negotiable: background #0a0e0f, teal accent #2dd4bf, JetBrains Mono for structural elements, Inter for prose, dark-minimal with code-comment motifs. No em dashes anywhere. No AI-tell phrasing. Do not over-explain fundamentals.
- Chapter grammar for all 22 chapters: prose teaches, SVG figures explain the model, one signature interactive widget, a runnable artifact (real executable code beyond snippets, a hard requirement), and ExerciseCards at the end.

Your tasks, in order:

1. Reconcile registry.json and queue.md against the actual refsite-runner skill and the template contract. The seed files use a schema aligned with prior refsites (litsearch, centering, Seeing). Adapt field names and structure to whatever the skill actually expects. Report any changes you make.

2. Do Phase 0 from queue.md: confirm the template scaffold, apply house-style tokens, wire the 5-part / 22-chapter navigation from registry.json, and establish shared components including a RunnableArtifact block. Get tsc, ESLint, and build clean before any chapter content.

3. Then stop and show me: the reconciled registry, the navigation, and the clean build. Do not start chapter content until I confirm.

After I confirm Phase 0, you will work the queue one chapter at a time on the command "run the next one," building each chapter to the definition of done in queue.md and committing per chapter.

For now, do tasks 1 through 3 only.

---

## Notes for Darvin (not part of the prompt)

- The handoff package is: the four scaffold files (registry.json, queue.md, CLAUDE.md, INITIAL_PROMPT.md), the README, and the complete research corpus in docs/research/ (survey + one doc per chapter + MANIFEST). Nothing else is needed to build.
- The research corpus is done, so the build is pure authoring plus artifact engineering. No research phase is required; Claude Code just reads each chapter's doc and writes the chapter.
- The prompt deliberately gates on Phase 0 so you can sanity-check the reconciliation and navigation before committing 22 chapters of generation.
- If the refsite-runner skill already defines a registry schema that differs from the seed, that is expected and fine; the prompt tells Claude Code to adapt.
- The runnable-artifact requirement is the one thing most likely to need per-chapter attention, since some artifacts (the real MCP server in ch08, and the three DIY agent stages in ch19–ch21) are substantial. Consider building those chapters attended rather than fully headless.
- Suggested build order matches the queue: Phase 0, then Part I to seed the shared components and set the house voice, then straight through. The Part V build chapters (ch19–ch22) are the highest-value payoff and lean hardest on runnable artifacts.
