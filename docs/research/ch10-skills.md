# Skills: Anthropic's Agent Skills as an Extension Mechanism

Research reference for *Agentic Loops*, Chapter 10 (pairs with the MCP arc as the other major extension mechanism; precedes Ch 11 "Skill or Server"). Current as of 2026. The reader already understands the agent loop, context economics, and MCP; this chapter is Skills-specific and can leave the detailed head-to-head to the next chapter. Version-gated details and adoption figures drift; version-pin and re-verify at build time.

## TL;DR
- An Agent Skill is a folder containing a `SKILL.md` (YAML frontmatter + Markdown instructions) plus optional bundled scripts, reference docs, and assets; it packages procedural knowledge that an agent loads on demand via **progressive disclosure**, complementing rather than competing with MCP.
- The core innovation is context economy: only ~100 tokens of metadata per listed,
  model-invocable Skill load at startup; in Claude Code, each first, distinct, or changed
  rendered `SKILL.md` body (target <5k tokens / <500 lines) loads when needed, while an
  identical re-invocation adds a short already-loaded note; reference text enters only when
  read, and bundled scripts can execute without their source entering the context window.
- Launched October 16 2025 and published as an open standard December 18 2025 (agentskills.io, with a spec and reference SDK), Skills run across Claude.ai, Claude Code, the Claude Developer Platform/API, and Claude Cowork; the SKILL.md format has been adopted by OpenAI (Codex, ChatGPT), Microsoft, Cursor, and others — making it, per Simon Willison, "maybe a bigger deal than MCP."

## What Agent Skills are
Introduced October 16 2025 (product post "Introducing Agent Skills" + engineering deep-dive "Equipping agents for the real world with Agent Skills," by Barry Zhang, Keith Lazuka, Mahesh Murag). Motivating observation: "Claude is powerful, but real work requires procedural knowledge and organizational context." As models gained filesystems + code execution, the missing piece became "composable, scalable, and portable ways to equip them with domain-specific expertise."

Definition (deliberately minimal): **a Skill is a directory containing a `SKILL.md` file** — YAML frontmatter + Markdown instructions — optionally with bundled scripts, reference docs, and assets. It "package[s] your expertise into composable resources for Claude, transforming general-purpose agents into specialized agents." Recurring analogy: a new-hire onboarding guide. Conceptual bet (Barry Zhang): "The agent underneath is actually more universal than we thought" — one universal agent + a library of capability packages, rather than separate architectures per domain. Skills embody progressive disclosure from the start: at startup the agent sees only each Skill's name/description and pulls in more only as needed — distinguishing a Skill from pasting a large prompt or stuffing `CLAUDE.md`.

## Architecture of a Skill
**`SKILL.md`.** Begins with YAML frontmatter (`---` delimited). The portable Agent
Skills contract requires `name` (one to 64 Unicode lowercase alphanumeric characters and
single hyphen-separated words; it must match the directory) and `description`
(non-empty, at most 1,024 characters). The specification says the description
should state both *what* it does and *when* to use it. Anthropic's platform adds
surface-specific reserved-vendor and XML-like-angle-bracket restrictions, plus
third-person authoring guidance. Below is a Markdown body of
instructions/workflows/examples. Optional top-level fields (`license`, `compatibility`,
and the free-form `metadata` map) are recognized but rarely needed. Put a version in
`metadata` when you need one. Claude Code extends the
frontmatter substantially (see plugins section): `allowed-tools`,
`disable-model-invocation`, `user-invocable`, `context: fork`, `model`,
`effort`, `paths`, `hooks`.

**Folder structure:**
```
skill-name/
├── SKILL.md          # Required: metadata + instructions
├── scripts/          # Optional: executable code (deterministic tasks)
├── references/       # Optional: docs loaded into context on demand
├── assets/           # Optional: templates, fonts, icons used in output
└── ...
```
Roles (skill-creator): `scripts/` = "executable code for deterministic/repetitive tasks"; `references/` = "docs loaded into context as needed"; `assets/` = "files used in output (templates, icons, fonts)."

**Bundled scripts** (Python/Bash/JS) let a Skill ship deterministic code Claude runs via bash — "Claude can run this script without loading either the script or the [data] into context." The PDF Skill bundles a form-field extraction script; "because code is deterministic, this workflow is consistent and repeatable."

**Reference files** are linked from `SKILL.md` and read only when needed. Shipped PDF Skill: "For advanced features... see REFERENCE.md. If you need to fill out a PDF form, read FORMS.md and follow its instructions."

**Naming:** gerund (`processing-pdfs`) or noun/action (`pdf-processing`); avoid vague (`helper`, `utils`, `tools`); the file must be exactly `SKILL.md`.

## Progressive disclosure — the key mechanism
"The core design principle that makes Agent Skills flexible and scalable." Analogy: "a well-organized manual that starts with a table of contents, then specific chapters, and finally a detailed appendix." Three levels (token costs from Anthropic docs):

| Level | When loaded | Token cost | Content |
|---|---|---|---|
| 1: Metadata | Startup for listed, model-invocable Skills | ~100 tokens/Skill | name + description |
| 2: Instructions | On first, distinct, or changed Claude Code rendering | <5k tokens recommended | Full SKILL.md body; an identical re-invocation gets a short already-loaded note; distinct skills can stack |
| 3+: Resources | As needed | Effectively unlimited | Reference text enters when read; script output enters after execution while source can remain on disk |

Sequence when a Skill triggers: (1) context = system prompt + the metadata of listed,
model-invocable Skills + user message; (2) Claude bashes to read `pdf/SKILL.md`; (3)
optionally reads `forms.md`, bringing that document's text into context, or executes a
script and receives its output; (4) proceeds. Because agents with filesystem + code
execution do not need to read every bundled file, the unused bundle is effectively
unbounded. In Claude Code, `disable-model-invocation: true` removes a user-only Skill
from the startup listing until manual invocation.

**Token economics vs MCP (crux of the debate).** Context cost is a host and
configuration property, not a universal Skills-versus-MCP distinction. Claude Code now
loads MCP tool names at startup and defers schemas until use. GitHub's MCP server can
also narrow the exposed surface with `--toolsets` or `--tools`. An eagerly injected,
large tool catalog is still expensive, but it is a configuration to measure rather than
a default architecture to assume. Firecrawl: "each skill costs roughly 30-50 tokens at
startup... An agent with 100 skills installed uses approximately 3,000-5,000 tokens at
session start for skill metadata." Scope that arithmetic to listed, model-invocable
Skills. One measurement of Anthropic's official Skills: median discovery cost ~80
tokens/Skill (~55 webapp-testing to ~235 xlsx). Mahesh Murag (VentureBeat): each skill
"takes only a few dozen tokens when summarized... with full details loading only when
the task requires them." Principle: "the context window is a public good."

**Caveat:** In an eager-schema MCP host or configuration, up-front loading buys *runtime latency*: the model reasons immediately about which tool to call, whereas progressive disclosure requires filesystem round-trips (bash reads). Independent analysis (MCPJam) notes progressive disclosure may use "3 to 4 times" as many filesystem tool calls. The optimal design may be hybrid (e.g. Klavis Strata uses MCP as delivery with progressive-disclosure-style discovery on top).

## Discovery and invocation
Skills are **model-invoked** — Claude decides autonomously, like a tool. At startup the
harness injects each listed, model-invocable Skill's name + description into the system
prompt (Claude Code's Skill tool constructs its description at runtime by aggregating
available names and descriptions). When the task matches a description, Claude reads the
full `SKILL.md`. User-only skills are an explicit exception on surfaces that support them.

The `description` is the primary discovery mechanism and the highest-leverage authoring decision. The portable specification says it should explain both what it does and when to use it, including specific trigger terms. Anthropic authoring guidance additionally prefers the **third person** ("Processes Excel files and generates reports," never "I can help..." or "You can use..."), because its description is injected into the system prompt. The PDF Skill's description is deliberately "pushy": "Use this skill whenever the user wants to do anything with PDF files... If the user mentions a .pdf file or asks to produce one, use this skill."

**Anthropic-specific tendency:** Anthropic's current [skill-creator](https://github.com/anthropics/skills/blob/main/skills/skill-creator/SKILL.md)
says simple one-step queries such as "read this PDF" may not trigger even when the
description matches, because Claude can handle them directly; matching complex, multi-step,
or specialized queries reliably trigger. Treat that as current Anthropic model-and-harness
guidance, not a portable guarantee. Evaluate triggering in fresh target-harness sessions with
realistic positive and near-miss prompts.

**Explicit invocation** also exists: in Claude Code user-invocable Skills appear as slash
commands (`/skill-name`); on API/Claude.ai the model decides. Claude Code switches:
`disable-model-invocation: true` (user-only, e.g. `/deploy`, with no startup description
cost) and `user-invocable: false` (Claude-only and hidden from the `/` menu, e.g.
background knowledge).

## Code execution environment
Skills "run in a code execution environment where Claude has filesystem access, bash commands, and code execution capabilities." Skills are directories on a VM (API: copied to `/skills/{directory}/`); Claude uses ordinary bash to navigate.

Three payoffs: **on-demand file access** (read just the one needed file; the rest "consume zero tokens"); **efficient script execution** (when Claude runs `validate_form.py`, "the script's code never loads into the context window. Only the script's output... consumes tokens" — "far more efficient than having Claude generate equivalent code"); **no practical limit on bundled content**. Rationale: "sorting a list via token generation is far more expensive than simply running a sorting algorithm... many applications require the deterministic reliability that only code can provide." Willison's `slack-gif-creator` test shows the feedback-loop pattern: run a bundled script, then a bundled validator checks Slack's 2MB limit and the model can adjust and rerun if the output is too large.

**Runtime constraints differ sharply by surface** (critical): API — no network, no runtime package install (pre-installed only), isolated ephemeral container unless a container ID is reused; claude.ai — network varies by admin settings, can install from npm/PyPI + GitHub when egress enabled; Claude Code — full network (like any program on the machine), local package install only.

## Where Skills work
Supported across Claude.ai, Claude Code, the Agent SDK, and the API; included in Max/Pro/Team/Enterprise at no extra cost (API usage = standard pricing). "Create a skill once and it works across all surfaces without modification, provided the environment supports any dependencies."

**Shipped document Skills:** Claude's docx/pptx/xlsx/fillable-pdf abilities are Skills. Pre-built by `skill_id`: `pptx`, `xlsx`, `docx`, `pdf`. Production versions in `anthropics/skills` `document-skills/` (source-available, not open source); many example Skills are Apache-2.0.

**Claude Code:** custom filesystem Skills only (no API upload). Discovery precedence: enterprise > personal (`~/.claude/skills/`) > project (`.claude/skills/`) > plugin (`<plugin>/skills/`); same-named skill overrides bundled. Bundles prompt-based Skills (`/code-review`, `/debug`, `/loop`, `/claude-api`). Edits to watched `SKILL.md` files can affect later discovery or future invocation in the current session, but already invoked rendered content stays in context and is not reread automatically.

**API / Agent SDK:** via the code execution tool. Three beta headers: `code-execution-2025-08-25`, `skills-2025-10-02`, `files-api-2025-04-14`. Specified in `container` with `type` (`anthropic`/`custom`), `skill_id`, optional `version`; up to **8 Skills/request**; uploads capped at **30 MB**. Custom Skills via `/v1/skills` (CRUD + versioning); Anthropic Skills use date versions (`20251013`), custom use epoch-timestamp or `latest`. Notes: changing the Skills list breaks prompt caching; long-running Skills surface a `pause_turn` stop reason to feed back.

**Claude Cowork:** same agentic architecture as Claude Code; supports Skills (Code Execution + File Creation must be enabled). Custom Skills typically made via the Skill Creator, then toggled.

**Cross-surface caveat:** custom Skills do NOT sync — a Skill uploaded to claude.ai must be separately uploaded to the API; Claude Code Skills are filesystem-only. Sharing scope differs: claude.ai per-user, API workspace-wide, Claude Code personal/project (shareable via plugins).

## Building a Skill
**Template:**
```markdown
---
name: my-skill-name
description: A clear description of what this skill does and when to use it
---
# My Skill Name
[Instructions Claude follows when this skill is active]
## Examples
- Example usage 1
## Guidelines
- Guideline 1
```

**Core principles** (Anthropic best-practices): **concise** ("the context window is a public good"; assume "Claude is already very smart"; body <500 lines, split beyond); **appropriate degrees of freedom** (high freedom/prose when many approaches work; low freedom/exact scripts when fragile or must be consistent — guardrails-on-a-narrow-bridge vs open-field analogy); **one level deep** (reference links one hop from SKILL.md; Claude may only partially read nested files); **table of contents** for reference files >100 lines; **test across models** (Haiku/Sonnet/Opus).

**Scripts vs model:** ship a script when code is repeatedly regenerated or determinism matters — even if Claude could write it, pre-made scripts are "more reliable," "save tokens," "save time," "ensure consistency." Make intent explicit ("Run `analyze_form.py`" = execute; "See `analyze_form.py`" = read). Scripts should "solve, don't punt" (handle errors) and avoid "voodoo constants."

**Patterns:** workflow checklists Claude copies/checks off; feedback loops (run validator → fix → repeat); plan-validate-execute with a verifiable intermediate file (`changes.json`); templates/examples. **Anti-patterns:** Windows backslash paths (use forward slashes); too many options instead of a default + escape hatch; time-sensitive info (put deprecated approaches in an "old patterns" section); assuming packages pre-installed.

**skill-creator.** Anthropic ships a `skill-creator` Skill that interactively builds Skills (asks about the workflow, generates structure, formats SKILL.md, bundles resources); bundled `scripts/init_skill.py <name> --path <dir>` scaffolds, `package_skill.py` validates + zips. Not strictly required: "Claude models understand the Skill format... Simply ask Claude to create a Skill." Style: imperative/infinitive ("To accomplish X, do Y"); "you're creating this for another instance of Claude to use."

**Evaluation-driven development.** Build evals *before* extensive docs: (1) run Claude without the Skill to find gaps; (2) create ~3 scenarios (or ~20 mixed should/should-not-trigger prompts for description tuning); (3) baseline; (4) minimal instructions; (5) iterate. Two-instance workflow: "Claude A" authors/refines, fresh "Claude B" tests on real tasks. An updated skill-creator plugin automates this in Claude Code (subagent per test case, graded assertions, `benchmark.json` comparing pass-rate/time/tokens with-vs-without). No built-in eval runner on the API.

## Skills and Claude Code plugins
Layered extensibility model: **CLAUDE.md** (always-on context) → **Skills** (on-demand knowledge/workflows, same context window, probabilistic or explicit) → **Subagents** (isolated context, return a summary; a Skill can run in a forked subagent via `context: fork`, and a subagent can preload Skills via `skills:`) → **Hooks** (deterministic lifecycle interceptors; enforce where Skills only encourage) → **MCP servers** (external connections) → **Plugins** (the packaging/distribution layer bundling skills, hooks, subagents, MCP servers).

Context nuance: in Claude Code an invoked Skill's content "enters the conversation as a single message and stays there for the rest of the session" — a recurring per-turn cost, not re-read each turn. An identical rendered re-invocation adds only a short already-loaded note; a changed rendering, such as different arguments or dynamic-context output, appends the full body again. Distinct rendered Skill bodies can coexist. Auto-compaction carries the most recent invocation of each Skill forward within a 25,000-token budget.

**Distribution:** a Skill can ship via a plugin's `skills/` directory (namespaced `plugin-name:skill-name`, can't conflict with local). Install from marketplaces: `/plugin marketplace add anthropics/skills` then `/plugin install document-skills@anthropic-agent-skills`. Custom commands (`.claude/commands/`) effectively merged into Skills — a file at `.claude/commands/deploy.md` and a Skill at `.claude/skills/deploy/SKILL.md` both create `/deploy`, but Skills add supporting-file dirs, richer frontmatter, automatic model invocation. Claude Code also extends the standard: dynamic context injection (`` !`git diff HEAD` `` inlines shell output), argument substitution (`$ARGUMENTS`, `$0`, named args), per-skill tool pre-approval (`allowed-tools`).

## Skills vs MCP (high level; deep comparison is Ch 11)
Distinction: **MCP connects the agent to external systems/tools via a client-server protocol; Skills package instructions and code that run in the agent's own execution environment.** In a [VentureBeat interview](https://venturebeat.com/technology/anthropic-launches-enterprise-agent-skills-and-opens-the-standard), Mahesh Murag said MCP provides secure connectivity to external software and data, while skills provide the procedural knowledge for using those tools effectively. Shorthand: "MCP gives your agent access to external tools and data. Skills teach your agent what to do with those tools and data."

Complementary: a Skill can invoke MCP tools (Claude Code best practice: fully-qualified names like `GitHub:create_issue`); the sentry-code-review Skill wraps Sentry's MCP-provided error data in a workflow. Willison's framing: "MCP is a whole protocol specification... Skills are Markdown with a tiny bit of YAML metadata and some optional scripts... They feel a lot closer to the spirit of LLMs — throw in some text and let the model figure it out. They outsource the hard parts to the LLM harness and the associated computer environment." Counterpoint: MCP provides remote/authenticated tool access (maturing OAuth, remote servers) and cross-vendor developer incentives, whereas Skills are local folders/zips with no built-in remote-access or auth model.

## Security considerations
Because Skills execute arbitrary code, a malicious/compromised Skill is a real threat. Anthropic: "Use Skills only from trusted sources: those you created yourself or obtained from Anthropic... a malicious Skill can direct Claude to invoke tools or execute code in ways that don't match the Skill's stated purpose." Risk categories: **audit thoroughly** (review every bundled file for unexpected network/file access); **external sources are risky** (Skills fetching external URLs may pull in malicious instructions — indirect injection; "even trustworthy Skills can be compromised if their external dependencies change"); **tool misuse** and **data exposure**; **"treat like installing software."**

Independent research: Anthropic's frontmatter reaches its system prompt. That surface
separately disallows XML-like angle brackets. Oasis Security demonstrated a
Claude.ai chain with invisible URL prompt injection and exfiltration through intentionally
permitted Anthropic Files API egress. It used no skill, integration, tool, or MCP server.
That does not establish a sandbox escape. It shows that a sandbox alone cannot stop prompt
injection or egress a system explicitly permits. Microsoft found a (patched) Claude Code
GitHub Action flaw where the Read tool bypassed the Bubblewrap sandbox isolating Bash.
Lesson: sandboxing, least-privilege permissions, explicit egress and filesystem controls,
deny rules, and human review are complements, not substitutes.

Relative to MCP: both share the "untrusted content in the loop" problem, but MCP's trust boundary is the server (authenticated, remote, auditable protocol), whereas a Skill's trust boundary is the code you place on the agent's own machine — hence "install only from trusted sources." Enterprise governance: Team/Enterprise admins can centrally provision approved Skills; code execution / network egress are admin-gated.

## Significance
Skills matter as a **design pattern**: (1) **progressive disclosure generalizes** — load minimal metadata, disclose detail just-in-time, keep bulk on disk — a broad context-engineering principle (support bots, research agents over large corpora); (2) **simplicity/portability** — "just folders and markdown" lowers the authoring bar (a PM can write one) and makes Skills trivially shareable via VCS/zip; (3) **composability** — with each other, MCP servers, and the Claude Code stack.

**Reception:** Willison on launch day — "awesome, maybe a bigger deal than MCP," predicting "a Cambrian explosion in Skills which will make this year's MCP rush look pedestrian." Key dependency: Skills require the model to have filesystem + code execution. Not all reactions unreserved — some worried Anthropic risks "overcomplicating" its surface area (SKILL.md, AGENTS.md, marketplaces, plugins, projects), and noted Claude sometimes struggles to know when to trigger a Skill.

**Open standard / cross-vendor adoption:** December 18 2025 Anthropic published Agent Skills as an open standard (spec + reference SDK at agentskills.io), added org-wide admin management (Team/Enterprise central provisioning, opt-out), and launched a partner-Skills directory. Per VentureBeat, launch partners included Atlassian, Canva, Figma, Notion, Cloudflare, Zapier, Stripe, Vercel. Stewardship (whether under the Agentic AI Foundation) was open at launch. Adoption was rapid: within ~2 months OpenAI added structurally-identical skills to ChatGPT (`/home/oai/skills`) and Codex CLI (`~/.codex/skills`, `--enable skills`); Microsoft adopted it in VS Code + GitHub; Cursor, Goose, Amp, OpenCode followed.

## Recommendations
1. **Start with one Skill for a repeated workflow, eval-first:** run the task without a Skill and note gaps → capture that context into a lean SKILL.md (ideally have Claude author it) → invest disproportionately in the `description` (third person, what + when, trigger keywords). Claude Code: `mkdir -p ~/.claude/skills/<name>` + a SKILL.md; API: upload via `/v1/skills` with the three beta headers.
2. **Scripts vs prose by task fragility:** prose (high freedom) where many approaches valid; deterministic error-handling script (low freedom) where consistency critical or code keeps being regenerated; make execute-vs-read intent explicit. Threshold: if SKILL.md nears 500 lines / ~5k tokens, split into `references/` one level deep.
3. **Manage the context budget:** metadata is cheap but an *activated* Skill is a recurring per-turn cost in the same window. With many Skills, watch description-listing budgets (Claude Code caps and can drop low-priority descriptions; `skillOverrides: name-only` reclaims budget); prefer forked-subagent execution (`context: fork`) for heavy Skills.
4. **Treat Skills as software supply chain:** install only from trusted sources; audit every bundled file; be wary of external-URL fetches; in production gate code execution + network egress, apply least-privilege `allowed-tools`, use hooks for deterministic guardrails prose can't enforce; centrally provision on Team/Enterprise.
5. **Skill vs MCP by what's missing (Ch 11 preview):** Skill when the gap is *procedural knowledge* (has the tools, lacks the workflow/conventions/reliable script); MCP when the gap is *connectivity* (live, authenticated, remote access). Expect both: a Skill can orchestrate MCP tools when it supplies the procedure those tools need. Consolidate parallel `.cursorrules`/`CLAUDE.md`/skills on the portable SKILL.md standard where possible.

## Caveats
- Version/date-specificity: Skills launched Oct 16 2025; open standard Dec 18 2025. Claude Code frontmatter/behaviors (skill-content lifecycle, stacking, `skillOverrides`) tie to specific versions (many require v2.1.x); verify against current docs. API beta headers and the 8-Skills / 30 MB limits reflect the documented beta and may change.
- Adoption metrics largely secondary: Anthropic named specific launch-day adopters (Microsoft/VS Code/GitHub, Cursor, Goose, Amp, OpenCode); larger figures ("26+"/"32"/"~40" platforms, millions of community skills) come from third-party blogs — indicative, not authoritative.
- Governance unsettled: whether agentskills.io is formally stewarded by the AAIF was undefined at the December 2025 launch; later sources assert AAIF stewardship (developed after launch).
- Active debates: the Skills-vs-MCP context/latency tradeoff (fewer startup tokens vs more runtime filesystem round-trips) is genuinely contested; hybrids may win. Skills depend on a safe code-execution environment (itself unsolved security-wise). And Skills are not yet a trained-in model capability — per a source Willison trusts, Anthropic's models "haven't yet been deliberately trained to know about skills"; they rely on general terminal competence, affecting triggering reliability.
- Source-availability: Anthropic's document Skills (docx/pdf/pptx/xlsx) are source-available point-in-time snapshots, "not actively maintained," may differ from production; example Skills are Apache-2.0.
