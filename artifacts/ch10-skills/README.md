# ch10-skills --- a portable skills lab

A zero-dependency lab for `SKILL.md`-compatible agent harnesses, paired with Chapter 10.
It ships a real, correct skill you can install and use, plus a tool that makes the
chapter's three ideas executable: a frontmatter teaching lint, the progressive-disclosure cost
model, and discovery.

- **Runtime:** a `python3` command backed by Python 3.9+ (standard library only).
- **Shell:** Bash for the documented install commands, filesystem-install smoke test, and
  `check.sh`.
- **External requirements:** no API key, network, or third-party packages.

## What's here

```
ch10-skills/
  skills_lab.py                     # the lab: validate, price, simulate, test
  changelog-entry/                  # a real skill you can install and trigger
    SKILL.md
    references/FORMAT.md            # read one hop away, on demand (level 3)
    scripts/validate_entry.py       # executed, output only (level 3)
  bad-skill/                        # a deliberately broken skill with representative violations
    SKILL.md
```

## Run it

```bash
cd artifacts/ch10-skills

# Overview of the bundled skill: validation, cost per level, a sample discovery.
python3 skills_lab.py

# Watch the supported portable subset and Anthropic-surface rules fail on a broken skill
# (exit 1 is expected).
python3 skills_lab.py --validate bad-skill --surface anthropic

# Price the default full listing: 100 listed names, each with a description.
python3 skills_lab.py --budget 100

# A Claude Code name-only override keeps the name but removes description-based discovery.
python3 skills_lab.py --budget 100 --listing name-only

# Model listing-budget trimming: all 100 names remain, but only 20 retain descriptions.
python3 skills_lab.py --budget 100 --descriptions 20

# Contrast a Claude Code subagent whose named skills were preloaded at startup.
python3 skills_lab.py --budget 3 --session preloaded

# Simulate discovery: does a request trigger the skill, and what loads if it does?
python3 skills_lab.py --simulate "add a changelog entry for the new export flag"

# The same proxy cannot use description keywords when the actual listing is name-only.
python3 skills_lab.py --simulate "editing CHANGELOG" --listing name-only

# In preloaded-subagent mode, the named skill body already arrived at startup.
python3 skills_lab.py --simulate "add a changelog entry for the new export flag" --session preloaded

# Write the literal candidate with an editor or structured file-writing tool, then run the
# skill's bundled validator (level-3 execution: output only). Do not put candidate text in
# a shell command.
python3 skills_lab.py --entry-file /absolute/path/to/candidate-entry.txt

# Exercise the same root-aware stdin command the installed Claude Code skill uses.
# The candidate file was written before this command, so its contents are not shell source.
(
  export CLAUDE_SKILL_DIR="$PWD/changelog-entry"
  python3 "$CLAUDE_SKILL_DIR/scripts/validate_entry.py" < /absolute/path/to/candidate-entry.txt
)

# Assertions: the good skill passes, the bad one fails on the exact rules it breaks.
# This includes a filesystem-install smoke test, so Bash is required here.
python3 skills_lab.py --test

# The self-contained check works from this directory.
bash check.sh
```

From the repository root, run `bash artifacts/ch10-skills/check.sh` instead.
For `--validate DIR` and `--skill DIR`, relative paths resolve from the directory where you
run the command.

## Install the changelog-entry skill (optional)

The `changelog-entry/` directory is a valid skill. Copy it into the skill directory that
your compatible agent harness scans. For example, Claude Code uses:

```bash
mkdir -p ~/.claude/skills/changelog-entry
cp -R changelog-entry/. ~/.claude/skills/changelog-entry/
```

If Claude Code is already running and `~/.claude/skills/` did not exist when that session
started, restart Claude Code now so it begins watching the new top-level directory. If the
directory already existed and was watched, additions and edits below it take effect live;
no restart is needed. Then ask for a changelog entry, or use the harness's explicit
invocation mechanism if it has one. The filesystem-install smoke test validates the copy and
root-aware validator path, not a running Claude Code session's discovery behavior.

The skill writes the exact candidate with the harness's structured file-writing tool before
it validates it. In Claude Code, `${CLAUDE_SKILL_DIR}` resolves to this installed directory,
so the skill runs the root-aware validator with `/absolute/path/to/candidate-entry.txt`
redirected to standard input from any project directory. The candidate stays in a file and
never becomes shell source. Another harness needs an equivalent skill-root variable or an
absolute path. The validator touches no network and does not write project files. The
workflow deliberately writes the project's `CHANGELOG.md` only after validation, so the
agent needs explicit permission for that project write. The validator rejects C0/C1
terminal-control characters before it can print a successful candidate back to the agent.

Running the two install commands again is an overlay update: files with the same name are
replaced, while files removed from a newer bundle stay in the target. Review and deliberately
replace or archive an existing skill directory when a clean update matters.

## The estimates, stated plainly

Token counts assume roughly four characters per token; they show the shape of the cost, not
an exact bill. The startup model applies to the names and descriptions the current session
actually lists, not every skill installed on disk. `--budget 100` models the default full
listing before budget reduction: one hundred listed, model-invocable names and their
descriptions. In Claude Code, `skillOverrides: "name-only"` can retain a name while omitting
its description. When the listing overflows, Claude Code retains every name while it shortens
or drops low-priority descriptions. `--listing name-only` shows the first case, while
`--descriptions 20` models a hundred names with only twenty description-bearing entries.
The latter is a count model, not a claim that every retained description has the same exact
length. Only a description that reaches the listing can supply description-keyword discovery.
A Claude Code skill with `disable-model-invocation: true` is user-only and contributes zero
regular-session startup context until a user invokes it. `skillOverrides` is a Claude Code
settings feature for eligible non-plugin skills, not a portable Agent Skills rule.

The discovery match is a crude keyword-overlap proxy: a real model weighs task difficulty
and phrasing, not just shared words, and may decline a skill whose description matches a
one-step request it can handle directly. Treat `--simulate` as an illustration, then evaluate
with fresh models in the target harness against positive and near-miss prompts.

For the regular Claude Code lifecycle this lab illustrates, a first, distinct, or changed
rendered body enters in full; an identical re-invocation adds only a short already-loaded
note. Distinct skill bodies can coexist. A Claude Code subagent configured with eligible,
named preloaded skills is different: it receives those full skill contents at startup.
`disable-model-invocation: true` prevents that preload. Use the `--session preloaded` mode
to price and simulate that path. Other harnesses can choose different lifecycle behavior.

## Teaching-lint scope

`skills_lab.py` is deliberately dependency-free. Its default profile is a teaching lint
for this bundle's supported portable subset: strict plain or basic quoted scalar key-value
fields, two-space plain continuations, bare folded (`>`) or literal (`|`) description
blocks with two-space content, ASCII name syntax, and directory matching.
Plain comments are stripped, while YAML null, boolean, numeric, malformed, unsupported
plain-scalar, and non-printing frontmatter values are rejected where a string is required.
Unsupported nonblank top-level syntax also fails instead of producing a clean result. A clean result means only
that the checked subset passed; it does not certify arbitrary YAML, Unicode name forms,
or the complete optional Agent Skills schema. For production, use the target harness's
maintained validator and your own deployment gate. `skills-ref` is a demonstration-only
reference implementation useful for comparison, not a production certification.
`--surface anthropic` adds Anthropic's reserved-vendor-name and XML-tag restrictions.
Third-person wording, a concrete `when` cue, and the 500-line body budget are authoring
warnings, not portable structural failures.
