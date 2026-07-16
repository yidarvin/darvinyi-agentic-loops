# ch10-skills --- a portable skills lab

A zero-dependency lab for `SKILL.md`-compatible agent harnesses, paired with Chapter 10.
It ships a real, correct skill you can install and use, plus a tool that makes the
chapter's three ideas executable: frontmatter validation, the progressive-disclosure cost
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

# Watch the frontmatter rules fail on a broken skill (exit status 1 is expected).
python3 skills_lab.py --validate bad-skill

# Price a library: what 100 installed skills cost at startup vs. loading bodies.
python3 skills_lab.py --budget 100

# Simulate discovery: does a request trigger the skill, and what loads if it does?
python3 skills_lab.py --simulate "add a changelog entry for the new export flag"

# Run the skill's own bundled validator (level-3 execution: output only).
python3 skills_lab.py --entry "Added: --export flag to the CLI"

# Assertions: the good skill passes, the bad one fails on the exact rules it breaks.
python3 skills_lab.py --test

# The self-contained check works from this directory or the repository root.
bash check.sh
```

## Install the changelog-entry skill (optional)

The `changelog-entry/` directory is a valid skill. Copy it into the skill directory that
your compatible agent harness scans. For example, Claude Code uses:

```bash
cp -r changelog-entry ~/.claude/skills/changelog-entry
```

Then ask for a changelog entry, or use the harness's explicit invocation mechanism if it
has one. The skill drafts an entry, runs its bundled `validate_entry.py` to check the
format, fixes and re-runs until it passes, and places the result under the Unreleased
section. It touches no network and no files outside its input, which is the point of the
trust exercise in the chapter.

## The estimates, stated plainly

Token counts assume roughly four characters per token; they show the shape of the
cost, not an exact bill. The discovery match is a crude keyword-overlap proxy: a
real model weighs task difficulty and phrasing, not just shared words, and may
decline a skill whose description matches a one-step request it can handle directly.

## Validator scope

`skills_lab.py` is deliberately dependency-free. Its small parser accepts the portable
frontmatter subset this artifact uses: scalar key-value fields, indented continuations,
and folded (`>`) or literal (`|`) description blocks. It is not a general YAML parser.
For a production harness, use a real YAML implementation and the target surface's current
reference validator. The third-person check is an authoring heuristic, and a missing
`when` cue is an advisory discovery-quality warning rather than a structural failure.
