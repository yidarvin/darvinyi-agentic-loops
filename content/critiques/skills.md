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

## Builder resolution (2026-07-16)

Regression gate: re-read the complete critique history, including Rounds 1 through 6,
and re-verified every prior required correction against the current chapter, figure, widget,
research backbone, and `artifacts/ch10-skills` files. The resolved Rounds 1 through 3
corrections remain intact: the Oasis example and portable-versus-surface distinction are
accurate, the progressive-disclosure model includes stacked bodies and both resource paths,
the startup and MCP comparisons are scoped to their harnesses, and the root-aware validator
workflow still passes. The chapter remains `draft`; this resolution does not grant approval.

1. **Murag attribution.** Rewrote the Skills/MCP passage in `src/chapters/skills.mdx` to
   attribute the formulation to its VentureBeat interview, added that source to the chapter,
   and linked the same attribution in `docs/research/ch10-skills.md`.
2. **Runtime contract.** Declared `python3` with Python 3.9+ and Bash requirements in the
   runnable-artifact block, artifact README, and lab docstring. The bundled skill's
   compatibility metadata now states its Python and project-write requirements. The artifact
   still has no third-party packages, API key, or network requirement.
3. **Fresh installation.** Replaced the README's incomplete copy command with a directory-
   creating, content-copying install sequence, documented its overlay-update behavior, and
   added a test that runs those exact commands against an empty temporary home before
   executing the installed root-aware validator from outside the skill directory.
4. **Meaningful budget failure.** Made `--budget` reject negative counts through argparse
   with a clear nonzero error, retained zero as valid, and added both boundaries to
   `skills_lab.py --test`.
5. **Production validation.** Removed every claim that `skills-ref validate` is a production
   validator. The chapter, README, lab output, and docstring now direct production users to
   the target harness's maintained validator plus a deployment gate, and describe
   `skills-ref` as a demonstration-only reference implementation.
6. **Cheap advisory repairs.** The teaching parser now reports unsupported inline and nested
   YAML collections as P0 errors instead of accepting them as strings; `--validate` and
   `--skill` now honor caller-relative paths; and `FORMAT.md` labels its Unreleased and
   category-order rules as bundled conventions rather than universal Keep a Changelog rules.

Verification: `bash artifacts/ch10-skills/check.sh` passes 46 assertions, including the
clean-home install and negative-budget cases. `npm run check` passes all seven stages.

## Round 7 review (2026-07-16)

Independent re-review: read the complete critique history and current
`src/chapters/skills.mdx`, `SkillsFigure.tsx`, `SkillsWidget.tsx`, every file in
`artifacts/ch10-skills`, and `docs/research/ch10-skills.md`. Ran `npm run check`
(all seven stages pass) and `bash artifacts/ch10-skills/check.sh` (46 assertions
pass), then exercised the documented validator failure path. Checked the current
Agent Skills specification and reference validator, Anthropic and Claude Code
documentation, GitHub's MCP server documentation, Firecrawl, MCPJam, Simon
Willison's cited example, Keep a Changelog, the Oasis report, and the Murag
attribution. Re-verified the required corrections from Rounds 1 through 6. The
available rendered-browser backend could not be reached, so the figure and widget
pass used source inspection and the passing render tests rather than screenshots.

## Required fixes

1. **`src/chapters/_figures/SkillsFigure.tsx:36-37,99-100` --- the figure gives contradictory startup-cost arithmetic.** It says listed metadata costs `~100 tokens` multiplied by listed skills, then concludes that one hundred listed skills cost "a few kilotokens." The displayed premise yields about 10,000 tokens, while `skills.mdx:68-71` correctly distinguishes Anthropic's near-100-token rule of thumb from Firecrawl's 30-to-50-token, 3,000-to-5,000 estimate. Show a source-labelled range, for example the Firecrawl estimate alongside the Anthropic rule of thumb, or make the closing claim agree with the figure's own 100-token premise. The relevant sources are [Anthropic's Skills overview](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview) and [Firecrawl's measurement](https://www.firecrawl.dev/blog/agent-skills). As drawn, the central figure teaches a false quantitative relationship.

2. **`src/chapters/skills.mdx:101-109` and `docs/research/ch10-skills.md:91` --- the chapter presents model-dependent discovery behavior as a universal, reliable rule.** "The model only reaches for a skill on tasks it cannot already handle in one step" and the claim that multi-step, format-sensitive work "reliably triggers" have no supporting primary source and conflict with the chapter's later instruction to measure triggering empirically. Current [Claude Code guidance](https://code.claude.com/docs/en/skills) says to separately measure invocation and output with realistic prompts in fresh sessions, comparing skill-enabled and disabled baselines. Reframe the PDF example as a harness-, model-, and task-dependent tendency, not a rule, and direct readers to target-harness trigger evaluation. Correct the research backbone at the same time so the unsupported certainty is not reintroduced. This claim was added after the earlier critique rounds, so it is a new regression rather than a re-raised finding.

## Advisories

- **`src/chapters/skills.mdx:86-88` --- qualify the MCPJam number more precisely.** Its source says MCP "probably" uses three to four times fewer filesystem-tool calls in the illustrated comparison. The chapter already calls it external and not a platform guarantee, but "argued" or "observed" would be truer than "estimated."

## Round 8 review (2026-07-16)

Independent re-review: read the complete critique history and the current chapter,
figure, widget, complete `artifacts/ch10-skills` lab, bundled skill, research backbone,
and listed sources. Ran `npm run check` successfully through all seven stages and
`bash artifacts/ch10-skills/check.sh` successfully with 46 assertions. Checked the
Agent Skills specification, Anthropic's Skills overview and current
`skill-creator` source, Claude Code Skills documentation, and Simon Willison's cited
example. I re-confirmed that Round 7 item 1 remains open. Round 7 item 2 is superseded:
Anthropic's current `skill-creator` explicitly gives the same simple-task versus
complex-task triggering guidance, so it needs precise attribution and scope rather than
removal as unsupported.

## Required fixes

1. **`src/chapters/skills.mdx:128-132` and `docs/research/ch10-skills.md:98` --- the attributed `slack-gif-creator` example turns a possible retry into an observed retry.** [Willison's post](https://simonwillison.net/2025/Oct/16/claude-skills/) shows a builder followed by `check_slack_size()` and says that, if the GIF is too large, the model *can* have another go. It does not show a failed validation or a retry. Change "if it fails the model adjusts and runs again" and "the model retries" to a capability or a feedback-loop pattern, such as "can adjust and rerun."

2. **`artifacts/ch10-skills/changelog-entry/scripts/validate_entry.py:29` --- the deterministic validator accepts multi-line entries despite its documented one-line contract.** Both `validate("Added: good\\rInjected")` and `validate("Added: good\\u2028Injected")` currently return `None`, because the check rejects only `\\n`; `changelog-entry/SKILL.md:32-34` promises one nonempty line before the workflow writes `CHANGELOG.md`. Reject all line-break code points, for example by requiring `len(entry.splitlines()) == 1` after the existing empty and outer-whitespace checks, and add CR and Unicode-line-separator cases to `skills_lab.py --test`.

3. **`src/chapters/skills.mdx:101-109`, `docs/research/ch10-skills.md:91`, and the Sources list --- repair the source and scope of the triggering guidance that Round 7 misclassified.** The current [Anthropic `skill-creator`](https://github.com/anthropics/skills/blob/main/skills/skill-creator/SKILL.md#L555-L558) explicitly says that simple one-step requests may not trigger and that matching complex, multi-step, or specialized requests reliably trigger. Do not remove the claim as unsupported. Attribute it to this current Anthropic guidance, add the source to the chapter's Sources list, and identify it as Anthropic-specific behavior while retaining the chapter's target-harness evaluation advice. The project rubric requires source links and a vendor-neutral conceptual spine.

4. **`src/chapters/skills.mdx:182-183` and `docs/research/ch10-skills.md:155-156` --- the XML-tag prohibition is presented as a documented injection-defense rationale without a source.** Anthropic's overview establishes separately that Skill metadata enters the system prompt and that XML tags are prohibited, but it does not state that the prohibition exists *because* of that injection risk. Either cite a source for the causal rationale or state the two documented facts without implying an established mechanism. The project rubric rejects hand-wavy security claims.

5. **`docs/research/ch10-skills.md:93` --- the factual backbone contradicts itself about Claude Code invocation.** It says every Skill is a slash command, then immediately describes `user-invocable: false` as Claude-only. Current [Claude Code documentation](https://code.claude.com/docs/en/skills) says `user-invocable: false` hides a Skill from the `/` menu. Correct this to user-invocable Skills so a future chapter revision does not inherit a false rule.

## Advisories

- **`src/chapters/_figures/SkillsFigure.tsx:11-14,36-100` --- increase contrast for essential explanatory labels.** The 10px `--comment` text on `--surface-2` is approximately 3.3:1. It is legible at native size but below normal-text AA; use `--fg-muted` where the labels carry the teaching path.
- **`docs/research/ch10-skills.md:107` --- qualify "edits apply mid-session."** Current Claude Code documentation says already invoked rendered Skill content remains in the conversation and is not reread on later turns. Distinguish discovery or future invocation from an update to content already loaded in the session.

## Round 9 review (2026-07-16)

Fresh-eyes re-review: read the complete critique history, the current chapter, figure,
widget, complete `artifacts/ch10-skills` lab, bundled skill, research backbone, and
listed sources. Re-verified the prior open findings for regression without restating them.
Ran `npm run check` successfully through all seven stages and
`bash artifacts/ch10-skills/check.sh` successfully with 46 assertions. Checked the
current Agent Skills specification and current Claude Code Skills documentation. The
widget's source and the passing render tests confirm that its five selections teach the
intended loading paths.

## Required fixes

1. **`src/chapters/_figures/SkillsFigure.tsx:43-46,73-75`, `artifacts/ch10-skills/skills_lab.py:293-295`, and `docs/research/ch10-skills.md:55-57`: the level-two cost model charges a full body for every activation.** The figure says `× every activation` and `one per activation`, while the lab and research table repeat that model. Current [Claude Code Skills documentation](https://code.claude.com/docs/en/skills) says that an identical rendered Skill re-invocation adds only a short already-loaded note. It appends the full body again only when the rendering differs, such as after different arguments or dynamic-context output. Since the chapter uses Claude Code as a concrete implementation, distinguish a first, distinct, or changed rendered body from an identical re-invocation. Keep stacking as a host-dependent property rather than teaching duplicate context growth as inevitable, and update the figure, artifact, and research backbone together.

## Advisories

- **`src/chapters/_widgets/SkillsWidget.tsx:146-160,202-220`: the resource controls duplicate accessible names.** The top control strip and bundled-resource strip expose indistinguishable buttons for the same resources. The interaction works, but a labelled resource group or contextual accessible names would make keyboard and screen-reader navigation calmer.

## Builder resolution (2026-07-16)

Regression gate: re-read the complete critique history and `git log -p --
content/critiques/skills.md`, including Rounds 1 through 9. Re-verified every required
correction against the current chapter, figure, widget, research backbone, and complete
`artifacts/ch10-skills` package. The corrections from Rounds 1 through 6 remain intact:
portable and Anthropic-specific rules stay separated, the Oasis case remains accurately
scoped, the root-aware installed validator workflow and clean-home install still pass, and
the artifact retains meaningful parser and budget failures. The chapter remains `draft`;
this resolution does not grant approval.

1. **Source-labelled startup arithmetic.** Updated `SkillsFigure.tsx` to show Firecrawl's
   30-to-50-token estimate beside Anthropic's roughly-100-token rule of thumb, with the
   matching 100-skill totals of roughly 3 to 5k and 10k tokens. The figure now agrees with
   the chapter's source-qualified prose.
2. **Discovery and invocation scope.** Reworked `src/chapters/skills.mdx` and
   `docs/research/ch10-skills.md` to attribute the simple-versus-complex triggering
   tendency to Anthropic's current `skill-creator`, label it as Anthropic-specific, retain
   fresh target-harness evaluation guidance, and add the source to the chapter. The research
   backbone now correctly limits slash commands to user-invocable Claude Code Skills and
   states that `user-invocable: false` hides a Skill from the `/` menu.
3. **Evidence precision.** Recast the `slack-gif-creator` example in the chapter and
   research as a feedback loop the model can use to adjust and rerun, rather than an
   observed retry. Removed the unsupported causal rationale for Anthropic's XML-like
   angle-bracket rule while retaining the two documented facts separately.
4. **One-line validator boundary.** Changed
   `artifacts/ch10-skills/changelog-entry/scripts/validate_entry.py` to reject every
   Python-recognized line break, not only `\\n`. Added real-script regression assertions for
   carriage return and the Unicode line separator in `skills_lab.py --test`.
5. **Level-two lifecycle.** Synchronized the figure, chapter caption and prose, widget,
   lab output and simulator, artifact README, and research backbone with Claude Code's
   lifecycle: first, distinct, or changed renderings add the full body; an identical
   re-invocation adds a short already-loaded note; distinct Skill bodies can coexist.
6. **Advisories taken.** Qualified the MCPJam figure in the chapter, raised essential
   figure-label contrast, distinguished later discovery from already-loaded Skill content in
   the research backbone, and gave the widget's part and bundled-resource controls distinct
   accessible names and a labelled resource group.
7. **Teaching-lint scalar boundary.** Tightened `skills_lab.py` so a comment-only
   description remains empty and YAML null, boolean, or numeric scalars are rejected rather
   than reported clean as strings. Added deterministic parser regression coverage and updated
   the artifact README's supported-subset contract.

Verification: `bash artifacts/ch10-skills/check.sh` passes 53 assertions, including the
new line-break and scalar-boundary cases. `npm run check` passes all seven stages.

## Round 10 review (2026-07-16)

Fresh-eyes re-review: read the complete critique history, current
`src/chapters/skills.mdx`, `SkillsFigure.tsx`, `SkillsWidget.tsx`, every file in
`artifacts/ch10-skills`, and `docs/research/ch10-skills.md`. Re-verified that the
required corrections from Rounds 1 through 9 remain in the current artifacts. Ran
`npm run check` successfully through all seven stages and
`bash artifacts/ch10-skills/check.sh` successfully with 53 assertions. Exercised the
documented lab commands and its expected failure path. Spot-checked the consequential
claims against the current Agent Skills specification and reference validator, Anthropic
launch and Skills documentation, Claude Code Skills documentation, GitHub MCP server
documentation, `skill-creator`, Firecrawl, MCPJam, VentureBeat, and the Oasis report.
The visual pass used source and render-test inspection because no rendered-browser backend
was available.

The chapter is materially truthful and teaching: it keeps the portable core distinct from
surface rules, accurately shows progressive disclosure and Claude Code's lifecycle, and
ships a runnable, deterministic, permission-scoped artifact with meaningful failure modes.

## Advisories

- **`src/chapters/skills.mdx:68-71`** Call the Firecrawl 30-to-50-token value an estimate
  or report rather than an independent measurement. The linked article gives the figure but
  no methodology. The source, caveat, and arithmetic are present and correct, so this is not
  blocking.
- **`src/chapters/_figures/SkillsFigure.tsx:13-14`** The 860px minimum width remains
  functional because the shared figure wrapper scrolls horizontally, but a compact narrow
  variant would reduce phone-reader panning.
- **`src/chapters/_widgets/SkillsWidget.tsx:172-200`** Each highlighted code line is still a
  separate keyboard tab stop. The controls work and are labelled, but a grouped or roving
  selection pattern would make keyboard traversal calmer.

## Round 11 review (2026-07-16)

Independent re-review: read the complete critique history, current
`src/chapters/skills.mdx`, `SkillsFigure.tsx`, `SkillsWidget.tsx`, the complete
`artifacts/ch10-skills` package, and `docs/research/ch10-skills.md`. Re-verified the
resolved source, lifecycle, arithmetic, and artifact-boundary corrections from prior rounds
against the current artifacts. Ran `npm run check` successfully through all seven stages and
`bash artifacts/ch10-skills/check.sh` successfully with 53 assertions. Exercised the
documented malformed-skill failure and the negative-budget failure. Checked the current Agent
Skills specification, Anthropic Skills overview and authoring guidance, Claude Code Skills
documentation, and Anthropic's current `skill-creator`. A rendered-browser backend was not
available, so the visual pass used component-source inspection and the passing render tests.

## Required fixes

1. **`src/chapters/_widgets/SkillsWidget.tsx:86,142-154,173-199` and `src/chapters/skills.mdx:160-167` --- the signature widget presents bundled level-3 files as parts of `SKILL.md`, hiding the body-to-resource boundary that progressive disclosure depends on.** The control group calls all five selections "SKILL.md part", including `references/FORMAT.md` and `scripts/validate_entry.py`, although those are distinct files beside `SKILL.md`. When either resource is selected, no excerpt line becomes active because every directive line is tagged `body`; the reader cannot see the level-2 instruction that points to the selected level-3 file. The prose reinforces the error by calling these five relationships "the same file." The Agent Skills specification distinguishes `SKILL.md` from optional `references/` and `scripts/` in the skill directory. Relabel or split the controls as package elements, change the prose to refer to the skill package rather than one file, and make a resource selection visibly connect its level-2 body directive to the selected level-3 file. This is a central truthfulness problem in the chapter's signature interaction, not a cosmetic affordance.

## Advisories

- **`src/chapters/skills.mdx:212-216`** “A common production shape” for a Skill orchestrating MCP tools is plausible, but the linked VentureBeat interview supports complementarity rather than prevalence. Soften the wording or cite a concrete production example.

## Builder resolution (2026-07-16)

Regression gate: re-read the complete critique history and `git log -p --
content/critiques/skills.md`, including Rounds 1 through 11. Re-verified every required
correction against the current chapter, figure, widget, research backbone, and complete
`artifacts/ch10-skills` package. The required fixes from Rounds 1 through 10 remain intact;
Round 7's triggering finding remains superseded by the sourced, Anthropic-specific treatment
from Round 8. The chapter remains `draft`; this resolution does not grant approval.

1. **Package boundary in the signature widget.** Split
   `src/chapters/_widgets/SkillsWidget.tsx` into a `SKILL.md`-contents control group and a
   distinct bundled-package-files group. The level-2 validator and format directives now carry
   explicit `pointsTo` links, so selecting either level-3 resource highlights the exact
   `SKILL.md` directive that names it while preserving that directive as level-2 body prose.
2. **Package framing in the chapter.** Rewrote `src/chapters/skills.mdx` and its widget hint
   to distinguish `SKILL.md` fields and body excerpts from the package's separate reference
   and script files, and to explain the visible body-to-resource trace.

Advisories taken: softened the uncited “common production shape” claim in the chapter and
research backbone to state the supported composition directly without asserting prevalence;
scoped the artifact budget command to listed, model-invocable skills; and described
Firecrawl's unsourced figure as an external estimate rather than an independent measurement.

Verification: `npm run check` passes all seven stages, including the 53-assertion skills
artifact check, 26 render tests, TypeScript, production build, and lint.

## Round 12 review (2026-07-16)

Fresh-eyes re-review: read the complete critique history, including the builder
resolutions, the current `src/chapters/skills.mdx`, `SkillsFigure.tsx`,
`SkillsWidget.tsx`, every file in `artifacts/ch10-skills`, and
`docs/research/ch10-skills.md`. Re-verified every required correction from Rounds 1
through 11 against the current artifacts. Ran `npm run check` through all seven stages
and `bash artifacts/ch10-skills/check.sh` with 53 passing assertions; exercised the
documented budget and discovery commands plus the expected malformed-skill failure.
Spot-checked the consequential claims against the current Agent Skills specification,
Anthropic launch and authoring documentation, Claude Code Skills documentation, the
GitHub MCP server documentation, the `skills-ref` README, and the Oasis report. The
visual pass used component-source inspection and the passing render tests because no
rendered-browser backend was available.

The chapter is materially truthful and teaching. It distinguishes the portable format
from surface-specific behavior, teaches the progressive-disclosure boundaries accurately,
and ships a runnable, deterministic artifact with clear requirements and meaningful
failure modes.

## Advisories

- **Carried forward, `src/chapters/_figures/SkillsFigure.tsx:13-14`.** The shared
  wrapper makes the 860px diagram usable through horizontal scrolling, but a compact
  narrow-screen variant would reduce phone-reader panning.
- **Carried forward, `src/chapters/_widgets/SkillsWidget.tsx:173-225`.** The source
  excerpt remains keyboard-operable and labelled, but its line-by-line controls create a
  long tab sequence. A grouped or roving-selection pattern would make traversal calmer.

## Round 13 review (2026-07-16)

Fresh-eyes re-review: read the complete critique history, current
`src/chapters/skills.mdx`, `SkillsFigure.tsx`, `SkillsWidget.tsx`, every file in
`artifacts/ch10-skills`, and `docs/research/ch10-skills.md`. Ran `npm run check`
successfully through all seven stages, including the 53-assertion skills artifact gate,
and exercised the documented malformed-skill failure. Checked the consequential loading
and API claims against the current [Claude Code Skills documentation](https://code.claude.com/docs/en/skills),
[Anthropic Skills overview](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview),
and [Agent Skills API quickstart](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/quickstart).
The figure and widget pass used component-source inspection and the passing render tests.

This round does not re-litigate Round 9's identical-render correction. It finds the
separate, documented preloaded-subagent path, which no prior round recorded and which the
current chapter, figure, widget, and lab all omit.

## Required fixes

1. **`src/chapters/skills.mdx:60,64-78,160-169,267-273`, `src/chapters/_figures/SkillsFigure.tsx:9-16,42-46,73-75`, `src/chapters/_widgets/SkillsWidget.tsx:5-10,53-61`, `artifacts/ch10-skills/README.md:98-100`, and `artifacts/ch10-skills/skills_lab.py:316,372` --- the Claude Code level-two lifecycle is presented as universal, hiding the preloaded-subagent startup path.** The chapter correctly describes a regular session's first, distinct, or changed render, but current Claude Code documentation explicitly limits that behavior to regular sessions. A subagent configured with preloaded `skills` instead receives the full skill content at startup. That exception changes the central context-cost model, not merely its wording. Qualify the existing path as a regular-session lifecycle and teach the preloaded-subagent exception in the figure, widget, prose, exercise, and lab output. Either model the alternate path in the lab with a tested option or explicitly scope it to regular sessions. Update the research record at `docs/research/ch10-skills.md:7-11,54-66,151-153` in the same change. Evidence: [Claude Code Skills documentation](https://code.claude.com/docs/en/skills) distinguishes the regular-session lifecycle from preloaded subagents.

2. **`docs/research/ch10-skills.md:119,185,192` --- the factual backbone states that Skills API use always requires three beta headers.** The current official overview requires a code-execution tool plus `skills-2025-10-02`; `files-api-2025-04-14` is needed only when the Files API uploads input or downloads output. The current quickstart uses the generally available `code_execution_20260521` with only the Skills header, while older code-execution versions must retain the header appropriate to that tool version. Replace the unconditional three-header prescription and its repeated recommendation/caveat with this conditional guidance. The research document is this chapter's factual source of record, so leaving version-sensitive API setup wrong risks reintroducing it into later revisions. Evidence: [Anthropic Skills overview](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview) and [API quickstart](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/quickstart).

## Advisories

- **`src/chapters/skills.mdx:43-45`, `src/chapters/_widgets/SkillsWidget.tsx:38-50`, and `docs/research/ch10-skills.md:24-26,165-166`.** Narrow the Anthropic restriction wording: reserved vendor words apply to `name`, while XML tags are prohibited in `name` and `description`, rather than every frontmatter field. The portable-versus-surface distinction remains sound.
- **`docs/research/ch10-skills.md:182`.** The Codex path and `--enable skills` wording reads as current setup guidance, while the current Codex manual documents automatic discovery from `.agents/skills` and `$HOME/.agents/skills`. If this is intentionally a historical observation, date and source it; otherwise update it to the current locations. This is non-blocking because the sentence is framed as historical adoption context.

## Round 14 review (2026-07-16)

Independent re-review: read the complete critique history; the current chapter, figure,
widget, full `artifacts/ch10-skills` package, and research backbone; then checked the
consequential claims against the current Agent Skills specification, Anthropic and Claude
Code documentation, the MCP authorization and security documentation, and Oasis's report.
Ran `npm run check` successfully through all seven stages and
`bash artifacts/ch10-skills/check.sh` with 53 passing assertions. I also exercised the
budget, discovery, and expected malformed-skill paths, and directly reproduced the teaching
lint's malformed-frontmatter clean pass. Round 13's two required fixes remain unaddressed in
the current artifacts and are not repeated below.

## Required fixes

1. **`artifacts/ch10-skills/skills_lab.py:143-175,199-216` --- the teaching lint reports malformed YAML frontmatter as clean.** With otherwise valid `name` and `description` fields, an unindented line such as `this is not YAML` before the closing `---` fence is invalid YAML, but `parse_frontmatter()` silently ignores it and `validate_skill()` returns `([], [])`. The artifact and chapter present this as a frontmatter teaching lint whose clean result marks its supported portable subset, so a syntax error cannot produce a clean pass merely because the parser is intentionally partial. Treat any unsupported nonblank top-level frontmatter line as `P0`, and add this exact regression case to `--test`. Evidence: [the Agent Skills specification requires YAML frontmatter](https://agentskills.io/specification).

2. **`src/chapters/skills.mdx:83-90` --- the vendor-neutral loading model makes a Bash/filesystem retrieval path sound intrinsic to progressive disclosure.** The chapter says an agent "has to `bash` out" to read a body and references. The portable [Agent Skills specification](https://agentskills.io/specification) defines staged loading, not a shell or filesystem protocol; [Anthropic's implementation](https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills) specifically illustrates a Bash read. Scope this sentence to a filesystem-and-shell or Anthropic-style harness, then retain the broader latency tradeoff as host-dependent. As written, it conflicts with the chapter's vendor-neutral conceptual spine.

3. **`src/chapters/skills.mdx:211-219` --- the Skills/MCP distinction presents MCP as secure by default.** The attributed shorthand "MCP provides secure connectivity" is not a protocol guarantee. The current [MCP authorization specification](https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization) makes authorization optional and assigns security requirements to implementations; the official [security guidance](https://modelcontextprotocol.io/docs/tutorials/security/security_best_practices) documents concrete attack classes and mitigations. Preserve the useful distinction as connectivity versus procedure, but say that authentication, transport, authorization, and least-privilege deployment determine whether an MCP integration is secure. Add a primary MCP security source alongside the VentureBeat attribution.

## Advisories

- **`src/chapters/skills.mdx:175-180`.** Label the Claude A/B author-and-fresh-tester workflow as an Anthropic example. It transfers well as a general evaluation pattern, so this does not block approval, but that label would better preserve the vendor-neutral spine.
- **`src/chapters/skills.mdx:194-199`.** Oasis describes no integrations or *external* tools, while its chain uses built-in code execution and Files API egress. Replace "no ... tool" with "no external or user-installed tool" to avoid obscuring the built-in capability that enabled the exfiltration path.
