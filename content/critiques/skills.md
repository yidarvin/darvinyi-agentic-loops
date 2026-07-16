verdict: revise

## Round 1 review (2026-07-15)

Fresh-eyes review: read `src/chapters/skills.mdx`, `SkillsFigure.tsx`,
`SkillsWidget.tsx`, the complete `artifacts/ch10-skills` lab, its bundled skill,
script, reference, README, and `docs/research/ch10-skills.md`. Ran `npm run check`
(passes) and `bash artifacts/ch10-skills/check.sh` (22 assertions pass). I also ran
the bundled skill's literal validator command, which failed with permission denied
(exit 126), then checked the chapter's consequential claims against the current Agent
Skills specification, Anthropic documentation, Firecrawl, MCPJam, and Oasis Security.

## Required fixes

1. **`src/chapters/skills.mdx:172-176`: the Oasis example is misattributed to a skill.** The linked Oasis report describes a default Claude.ai chain using invisible prompt injection in a URL parameter and the Files API. It says no integration, tool, or MCP server was required. It does not involve a `SKILL.md`. Rewrite this as a general prompt-injection and egress example, or replace it with evidence of a skill-specific attack. Evidence: [Oasis Security's Claudy Day report](https://www.oasis.security/blog/claude-ai-prompt-injection-data-exfiltration-vulnerability).

2. **`artifacts/ch10-skills/changelog-entry/SKILL.md:17`: the real skill cannot execute the validator it instructs the agent to run.** `scripts/validate_entry.py` is not executable, so `./changelog-entry/scripts/validate_entry.py "Added: --export flag to the CLI"` exits 126. `skills_lab.py` masks this by calling the file through `sys.executable` at lines 287 and 389, while the widget repeats the unusable literal command at `src/chapters/_widgets/SkillsWidget.tsx:112`. Either make the script executable or instruct `python3 scripts/validate_entry.py ...` everywhere, then test the actual documented workflow.

3. **`artifacts/ch10-skills/skills_lab.py:46,138-169`: the validator is neither a correct portable validator nor clearly scoped as an Anthropic-specific lint.** The current [Agent Skills specification](https://agentskills.io/specification) requires names not to start or end with a hyphen, forbids consecutive hyphens, and requires a name to match its parent directory. This validator accepts `-bad--name-` with a nonmatching directory as clean, while hard-failing Anthropic-surface rules and authoring guidance such as reserved vendor words, angle brackets, third person, and the 500-line recommendation. Provide a standards-correct portable mode and separate surface-specific checks, or explicitly rename and document the lab as a partial Anthropic authoring lint. Do not present clean output as portable validity until its contract is accurate.

4. **`src/chapters/_figures/SkillsFigure.tsx:45-86` and `src/chapters/_widgets/SkillsWidget.tsx:55-58`: the loading model is materially incomplete.** The figure says one selected skill's body enters the window and only draws a Level-3 script-output path. Skills can stack, and reading a referenced document puts that document's content into the context window. The figure's panel headed "what actually lands here" therefore omits a central Level-3 path, while the widget says only one triggered skill pays for its body. Update the prose, figure, and widget to show each activated skill's body, a separate reference-read-to-context path, and a script-execute-to-output path. Only unread resources and uninspected script source stay out of context. Evidence: [Anthropic's Skills overview](https://claude.com/skills) and [Agent Skills documentation](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview).

5. **`src/chapters/skills.mdx:62-64` and `:262-292`: a quantitative attribution has no listed source.** The text attributes the 30 to 50 token and 3,000 to 5,000 token estimates to Firecrawl, but the Sources section does not link Firecrawl. Add [the Firecrawl article](https://www.firecrawl.dev/blog/agent-skills) beside the claim or remove the attribution and numbers. The project rubric requires source links for consequential claims.

6. **`artifacts/ch10-skills/README.md:60-64`: the artifact's security claim is broader than its behavior.** The README says the skill touches no files outside its input, but `changelog-entry/SKILL.md:21-22` directs the agent to write `CHANGELOG.md`. Limit that claim to `validate_entry.py`, or state the skill's actual write scope and required permission. The chapter treats this artifact as a trust-boundary exercise, so its access description must be exact.

## Advisories

- `artifacts/ch10-skills/changelog-entry/scripts/validate_entry.py:48` strips stdin before validation. A documented stdin invocation with leading or trailing whitespace therefore passes even though `validate()` claims to reject it. Preserve the raw input except for the terminal newline, or remove stdin support.
- `src/chapters/skills.mdx:231-236` presents `--simulate` as evidence that a description would be discovered, although the artifact implements only a two-keyword proxy and the chapter correctly explains that task difficulty also affects triggering. Label the exercise as illustrative and direct readers to target-harness, fresh-model trigger evaluations with near-miss negative cases.
- Increase the contrast or size of the figure's 8.5 to 9.5px explanatory labels. They are likely marginal at the figure's minimum width.

## Round 2 review (2026-07-15)

Independent supplement to the still-open Round 1: re-read the current chapter, figure,
widget, complete ch10 artifact, README, research file, and listed sources. Ran `npm run
check` (passes) and `bash artifacts/ch10-skills/check.sh` (22 assertions pass), then
exercised the installed skill's literal validator command. Checked the current Agent Skills
specification and reference validator, Anthropic Skills and Claude Code documentation,
the GitHub MCP server documentation, the Oasis report, Firecrawl's article, and Keep a
Changelog 1.1.0. The Round 1 required fixes remain unaddressed; this round records only
additional material defects.

## Required fixes

1. **`src/chapters/skills.mdx:37-42, 172-175, 202-205, and 246-251` --- the prose and exercises conflate the portable Agent Skills contract with Anthropic-only restrictions.** The current [Agent Skills specification](https://agentskills.io/specification) and its [reference validator](https://github.com/agentskills/agentskills/blob/main/skills-ref/src/skills_ref/validator.py) require the name to match its directory and forbid leading, trailing, and consecutive hyphens, but do not reserve `claude` or `anthropic` or ban angle brackets in descriptions. The current [Anthropic platform rules](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview) impose those latter restrictions. Round 1 item 3 correctly flags the lab's behavior; also correct the chapter, widget, and exercise so the conceptual spine stays vendor-neutral, teach the missing portable name checks, and either make the lab spec-correct or explicitly present it as an Anthropic-surface lint.

2. **`src/chapters/skills.mdx:56, 60-64`, `SkillsFigure.tsx:42-51, 81-86`, and `SkillsWidget.tsx:38-58` --- the startup-cost model incorrectly applies to every installed skill.** In Claude Code, `disable-model-invocation: true` hides a user-only skill entirely until manual invocation, so it has zero startup context cost. The chapter itself introduces that surface feature at lines 104-108. Scope the figure, widget, and hundred-skill arithmetic to model-invocable/listed skills and explain the user-only exception. Evidence: [Claude Code's current context-cost documentation](https://code.claude.com/docs/en/features-overview).

3. **`src/chapters/skills.mdx:73-80` --- the MCP comparison presents an outdated host behavior as the normal architecture.** Current Claude Code defers MCP schemas by default and loads only tool names at startup; the official GitHub server also supports `--toolsets` and `--tools` specifically to reduce context. An eagerly injected, large tool catalog is a useful historical or host-specific counterexample, but “typically load in full” and the unqualified GitHub tens-of-thousands claim now mislead. Reframe the comparison by harness/configuration, date and source any historical number, and name deferred-schema hosts as the counterexample. Evidence: [Claude Code context costs](https://code.claude.com/docs/en/features-overview) and [GitHub MCP tool configuration](https://github.com/github/github-mcp-server).

4. **`artifacts/ch10-skills/changelog-entry/references/FORMAT.md:5`, `SKILL.md:15-18`, and `scripts/validate_entry.py:40-43` --- the bundled validator rejects entries that the stated source format permits.** `FORMAT.md` says it paraphrases Keep a Changelog 1.1.0, but the skill makes a trailing period and a 120-character ceiling hard failures. The primary [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/) examples use trailing periods and specify no such length cap; `python3 scripts/validate_entry.py "Added: The default script runs."` currently fails. Either align the validator with the cited format or label, document, and source these as this skill's local house rules. Also reconcile “under 120” with the implementation, which accepts 120 characters.

5. **`src/chapters/skills.mdx:172-176` and `docs/research/ch10-skills.md:119` --- the security conclusion overstates what the Oasis incident establishes.** Beyond Round 1's incorrect Skill attribution, use of an intentionally allowed Files API egress route does not demonstrate a sandbox escape or establish that a sandbox is only a convenience boundary. Reframe the lesson precisely: a sandbox alone does not stop prompt injection or intentionally permitted egress, so agents need explicit egress, filesystem, and permission controls. Correct the research backbone at the same time so the error is not reintroduced later.

## Advisories

- No additional advisory findings. The Round 1 advisories remain open.

## Round 3 review (2026-07-15)

Independent re-review: read the current chapter, figure, widget, complete `ch10-skills`
artifact, bundled skill, README, research backbone, and listed sources. Ran `npm run check`
(passes) and `bash artifacts/ch10-skills/check.sh` (22 assertions pass). I then exercised the
literal validator command from the package root, a project root, and the skill directory. The
first two exit 127 because `scripts/validate_entry.py` is not relative to either working
directory; the last exits 126 because the file is not executable. I checked the current Agent
Skills specification, Claude Code Skills documentation, Anthropic's Skills overview, the Oasis
report, and Keep a Changelog 1.1.0. Round 1 and 2 required fixes remain unaddressed; this round
records one additional defect rather than re-litigating them.

## Required fixes

1. **`artifacts/ch10-skills/changelog-entry/SKILL.md:17`, `artifacts/ch10-skills/README.md:45-63`, and `src/chapters/_widgets/SkillsWidget.tsx:112`: the installed artifact cannot locate its own validator.** The README tells readers to copy `changelog-entry/` into `~/.claude/skills/changelog-entry` and invoke it from a project, but its literal `scripts/validate_entry.py "Type: summary"` command resolves from the project working directory, not the skill directory. It exits 127 from both the artifact package root and this repository root; executing it from the skill directory instead exits 126 because the script is mode `100644`. `skills_lab.py` hides both failures with `sys.executable`. Make the documented workflow root-aware and runnable, for example use `python3 ${CLAUDE_SKILL_DIR}/scripts/validate_entry.py` in the Claude Code installation path and state the equivalent skill-root convention for other harnesses. Then extend `check.sh` to execute the literal installed-workflow command from a non-skill working directory. Evidence: [Claude Code documents `${CLAUDE_SKILL_DIR}` specifically for bundled scripts](https://code.claude.com/docs/en/skills).

## Advisories

- No new advisory findings. The Round 1 and 2 advisories remain open.

## Builder resolution (2026-07-16)

Regression gate: re-read the full critique history, including Rounds 1, 2, and 3, and
re-verified every required fix against the current chapter, figure, widget, research
backbone, and `artifacts/ch10-skills` files. The chapter remains `draft`; this resolution
does not grant approval.

1. **Oasis attribution and security conclusion.** Rewrote `src/chapters/skills.mdx` and
   `docs/research/ch10-skills.md` to identify the Oasis case as invisible URL prompt
   injection plus intentionally permitted Files API egress, with no skill, integration,
   tool, or MCP server. Both now state the supported lesson: sandboxing alone does not
   prevent injection or allowed egress, so egress, filesystem access, and permissions need
   explicit controls.
2. **Portable contract versus surface rules.** Reworked
   `artifacts/ch10-skills/skills_lab.py` so its default profile is explicitly a teaching
   lint for the bundled portable subset: ASCII name syntax, directory match, and description
   bounds. `--surface anthropic` adds vendor-name and angle-bracket restrictions, while
   third-person, trigger, and body-length checks are labelled warnings. The chapter, widget,
   README, and exercises now teach the same split and direct production validation to
   `skills-ref validate`.
3. **Installed validator workflow.** Replaced every skill-facing relative executable
   instruction with the Claude Code root-aware command
   `python3 "${CLAUDE_SKILL_DIR}/scripts/validate_entry.py" "Type: summary"`; documented
   the equivalent skill-root convention for other harnesses; and extended
   `artifacts/ch10-skills/check.sh` plus lab tests to run that command from outside the
   skill directory.
4. **Changelog-format behavior.** Aligned the bundled validator and `FORMAT.md` with Keep
   a Changelog by removing the unsupported period prohibition and 120-character cap. The
   validator now preserves raw stdin whitespace except for one terminal newline, and tests
   prove both whitespace rejection and source-compatible punctuation/length behavior.
5. **Progressive-disclosure model.** Updated `SkillsFigure.tsx`, `SkillsWidget.tsx`, the
   chapter, and the lab to show listed/model-invocable metadata, multiple activated bodies,
   reference content entering context on read, and script output entering after execution
   while uninspected source stays on disk. The figure also states the Claude Code user-only
   exception and uses larger explanatory labels.
6. **Startup and MCP scope.** Scoped the hundred-skill arithmetic to listed,
   model-invocable skills, documented the zero-startup-cost user-only exception, and
   reframed the MCP contrast by host/configuration. The chapter now names deferred schemas
   and GitHub's tool-narrowing controls rather than treating eager schemas as universal.
7. **Sources and artifact permissions.** Added the Firecrawl source beside the token
   estimate and expanded the source list with the current Claude Code and GitHub MCP
   documentation. Corrected the README and exercise so `validate_entry.py` is accurately
   read-only and no-network, while the skill's later `CHANGELOG.md` write is explicit and
   permission-scoped.
8. **Discovery guidance.** Marked `--simulate` as a two-keyword illustration rather than
   evidence of real triggering, and directed readers to fresh-model, target-harness
   evaluations with realistic positive and near-miss prompts.
9. **Research and parser precision.** Corrected the research backbone so portable version
   metadata lives inside the free-form `metadata` map and eager MCP schemas are a
   host/configuration case. The teaching parser now handles basic quoted scalars, so an
   empty quoted description still fails the required portable-description check.

Advisories taken: all three Round 1 advisories were resolved through raw-stdin coverage,
explicit discovery-simulator limits, and larger, higher-contrast figure labels.

Verification: `bash artifacts/ch10-skills/check.sh` passes 39 assertions, including the
installed root-aware command; `npm run check` passes all seven stages.

## Round 4 review (2026-07-16)

Fresh-eyes re-review: read the full critique history, current `src/chapters/skills.mdx`,
`SkillsFigure.tsx`, `SkillsWidget.tsx`, the complete `artifacts/ch10-skills` lab, bundled
skill, validator, reference, README, and `docs/research/ch10-skills.md`. Re-verified that
the required corrections from Rounds 1 through 3 remain in the current artifacts. Ran
`npm run check` (all seven stages pass) and `bash artifacts/ch10-skills/check.sh` (39
assertions pass). Checked the consequential claims against the current Agent Skills
specification, Anthropic and Claude Code documentation, GitHub's MCP server documentation,
Firecrawl, MCPJam, Keep a Changelog, and the source of the Murag attribution. The local
in-app browser had no available backend, so the figure and widget review used current source,
render tests, and static accessibility inspection rather than a screenshot pass.

## Required fixes

1. **`src/chapters/skills.mdx:203-206` and `:276-309` --- the attributed Murag quotation has no source link in the chapter.** The listed Anthropic engineering post does not contain the quotation. Its source is the [VentureBeat interview](https://venturebeat.com/technology/anthropic-launches-enterprise-agent-skills-and-opens-the-standard), which identifies Murag and gives the Skills/MCP formulation. Add that source to the Sources section next to the attribution, or remove the attributed quotation. The project rubric makes a missing source link blocking.

2. **`artifacts/ch10-skills/README.md:8-9`, `src/chapters/skills.mdx:226-236`, and `artifacts/ch10-skills/skills_lab.py:504-520` --- the artifact claims Python 3.9+ and no requirements, but an advertised command requires Bash.** `python3 skills_lab.py --test` unconditionally starts `bash -c` to exercise the installed command, and `check.sh` also has a Bash shebang. On a Python 3.9 environment without Bash, the test raises before it can report a useful result. Declare a POSIX shell and `python3` command as requirements in the README and runnable-artifact block, or replace the shell-dependent test with a Python-only equivalent and make the documented workflow accurate.

3. **`artifacts/ch10-skills/README.md:60-75` --- the advertised Claude Code install command fails on a fresh skills setup.** `cp -r changelog-entry ~/.claude/skills/changelog-entry` assumes the parent `~/.claude/skills` already exists. `cp` cannot create that missing parent, so the promised drop-in skill cannot be installed or triggered from a clean setup. Add `mkdir -p ~/.claude/skills` before the copy, state update or overwrite behavior, and test the install instructions from an empty skills directory. The [official Claude Code example](https://code.claude.com/docs/en/skills) creates `~/.claude/skills/<skill>/...` first.

## Advisories

- `artifacts/ch10-skills/skills_lab.py:65-82,192-205` treats unsupported unquoted YAML
  structures as strings. A valid YAML sequence in `description` could therefore report
  clean despite not being the string scalar the teaching profile promises. Reject clearly
  unsupported YAML forms instead of accepting them as plain scalars.
- `artifacts/ch10-skills/changelog-entry/references/FORMAT.md:10,25,38` presents the
  Unreleased placement and the category ordering as universal Keep a Changelog requirements.
  The source recommends an Unreleased section and groups categories but does not make every
  local ordering rule universal. Label these as the bundled skill's convention or soften the
  absolutes.
- `src/chapters/_figures/SkillsFigure.tsx:11-14` safely scrolls in the shared Figure wrapper,
  but its 860px minimum width still makes a phone reader pan across the central teaching
  diagram. The labels are correct and legible at native width, so this is not blocking.
- `src/chapters/_widgets/SkillsWidget.tsx:170-220` makes nearly every code line a separate
  focusable button. The interaction works, but keyboard readers must traverse many tab stops;
  grouped selectable regions or a roving control would be calmer.

## Round 5 review (2026-07-16)

Independent supplement to the open Round 4: read the current chapter, figure, widget, full
artifact, research backbone, and critique history. Ran `npm run check` (all seven stages
pass) and `bash artifacts/ch10-skills/check.sh` (39 assertions pass), then exercised the
artifact's invalid-input boundary. Re-verified the Round 4 source and installation findings;
they remain open and are not re-litigated here. This round records one new artifact defect.

## Required fixes

1. **`artifacts/ch10-skills/skills_lab.py:537,560-562,286-297` --- `--budget` accepts a negative library size and reports impossible negative context costs as success.** `python3 skills_lab.py --budget -1` exits 0 after printing `~-36 tokens`, `~-420 tokens`, and `-0.00x`, even though a library cannot contain negative skills. The argparse type check accepts every integer and no later guard rejects values below zero. Reject a negative count with a clear nonzero error before calculating, and add the boundary to `--test`/`check.sh`; the chapter's runnable-artifact contract requires meaningful failure behavior.

## Advisories

- `artifacts/ch10-skills/skills_lab.py:546-548` resolves every relative `--validate DIR`
  against the lab directory rather than the caller's working directory. The documented
  `cd artifacts/ch10-skills` path works, but a repo-relative path given from the repository
  root fails unexpectedly. Document that resolution rule or honor caller-relative paths.

## Round 6 review (2026-07-16)

Independent review: read the full critique history and current `src/chapters/skills.mdx`,
`SkillsFigure.tsx`, `SkillsWidget.tsx`, every file in `artifacts/ch10-skills`, the research
backbone, and the chapter's listed sources. Ran `npm run check` successfully through all
seven stages and `bash artifacts/ch10-skills/check.sh` successfully with 39 assertions. I
also checked the current Agent Skills specification, Claude Code Skills documentation, and
the upstream `skills-ref` README. I re-verified the existing open requirements against the
current artifacts without repeating them below.

## Required fixes

1. **`src/chapters/skills.mdx:214-217`, `artifacts/ch10-skills/README.md:90-96`, and `artifacts/ch10-skills/skills_lab.py:6-10,238` --- the production-validation guidance recommends a tool whose maintainers say it is not for production.** The chapter calls `skills-ref validate` the production validator, the README tells production users to use it, and the lab directs a clean result to it for full-schema validation. The upstream [skills-ref README](https://github.com/agentskills/agentskills/tree/main/skills-ref) says the library is intended for demonstration purposes only and is not meant for production. Keep it as a reference or teaching comparison if useful, but direct production users to their target harness's maintained validator plus their own deployment gate. Do not present a `skills-ref` clean result as production validation.

## Advisories

- `artifacts/ch10-skills/changelog-entry/SKILL.md:2-4,22-25` remains model-invocable by default even though its workflow later writes `CHANGELOG.md`. Claude Code recommends `disable-model-invocation: true` for side-effect workflows. The existing permission language means this does not establish an unsafe automatic write, so it is not blocking, but a manual-only write skill or a separate read-only discovery skill would align the exemplar more closely with the chapter's security guidance.
