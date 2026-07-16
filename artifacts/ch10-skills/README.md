# ch10-skills --- a portable skills lab

A zero-dependency lab for `SKILL.md`-compatible agent harnesses, paired with Chapter 10.
It ships a real, correct skill you can install and use, plus a tool that makes the
chapter's three ideas executable: a frontmatter teaching lint, the progressive-disclosure cost
model, and discovery.

- **Runtime:** Python 3.9+ (standard library only)
- **Requires:** nothing. No API key, no network, no packages.

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

# Price a library: what 100 installed skills cost at startup vs. loading bodies.
python3 skills_lab.py --budget 100

# Simulate discovery: does a request trigger the skill, and what loads if it does?
python3 skills_lab.py --simulate "add a changelog entry for the new export flag"

# Run the skill's own bundled validator (level-3 execution: output only).
python3 skills_lab.py --entry "Added: --export flag to the CLI"

# Exercise the same root-aware command the installed Claude Code skill uses.
(
  export CLAUDE_SKILL_DIR="$PWD/changelog-entry"
  python3 "$CLAUDE_SKILL_DIR/scripts/validate_entry.py" "Added: --export flag to the CLI"
)

# Assertions: the good skill passes, the bad one fails on the exact rules it breaks.
python3 skills_lab.py --test

# The self-contained check works from this directory.
bash check.sh
```

From the repository root, run `bash artifacts/ch10-skills/check.sh` instead.

## Install the changelog-entry skill (optional)

The `changelog-entry/` directory is a valid skill. Copy it into the skill directory that
your compatible agent harness scans. For example, Claude Code uses:

```bash
cp -r changelog-entry ~/.claude/skills/changelog-entry
```

Then ask for a changelog entry, or use the harness's explicit invocation mechanism if it
has one. In Claude Code, `${CLAUDE_SKILL_DIR}` resolves to this installed directory, so the
skill runs `python3 "${CLAUDE_SKILL_DIR}/scripts/validate_entry.py" "Type: summary"` from
any project directory. Another harness needs an equivalent skill-root variable or an
absolute path. The validator touches no network and does not write project files. The
workflow deliberately writes the project's `CHANGELOG.md` only after validation, so the
agent needs explicit permission for that project write.

## The estimates, stated plainly

Token counts assume roughly four characters per token; they show the shape of the
cost, not an exact bill. The startup model applies to listed, model-invocable skills.
A Claude Code skill with `disable-model-invocation: true` is user-only and contributes
zero startup context until a user invokes it. The discovery match is a crude keyword-
overlap proxy: a real model weighs task difficulty and phrasing, not just shared words,
and may decline a skill whose description matches a one-step request it can handle
directly. Treat `--simulate` as an illustration, then evaluate with fresh models in the
target harness against positive and near-miss prompts.

## Teaching-lint scope

`skills_lab.py` is deliberately dependency-free. Its default profile is a teaching lint
for this bundle's supported portable subset: plain or basic quoted scalar key-value
fields, indented continuations, folded (`>`) or literal (`|`) description blocks, ASCII
name syntax, and directory matching. A clean result means only that the checked subset
passed; it does not certify arbitrary YAML, Unicode name forms, or the complete optional
Agent Skills schema.
For a production skill, use the official `skills-ref validate` reference validator.
`--surface anthropic` adds Anthropic's reserved-vendor-name and angle-bracket restrictions.
Third-person wording, a concrete `when` cue, and the 500-line body budget are authoring
warnings, not portable structural failures.
