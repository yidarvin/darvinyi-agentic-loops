#!/usr/bin/env python3
"""skills_lab.py --- a zero-dependency lab for Agent Skills.

Three things the Skills chapter describes, made executable:

  1. Validate a SKILL.md's canonical frontmatter subset against explicit
     portability and authoring checks (name and description format, the
     "claude"/"anthropic" ban, no angle brackets, third-person phrasing, an
     advisory `when` cue, the body-length budget, and dangling reference links).
  2. Price progressive disclosure: what one skill costs at each of the three
     loading levels, and what installing N skills costs at startup.
  3. Simulate discovery: match a request against a description and print the
     loading sequence that follows a trigger.

No dependencies, no API key, no network. The token counts are estimates
(~4 characters per token) and the discovery match is a crude keyword proxy, not
the real model; both are here to make the shape of the mechanism visible, not to
reproduce a production harness. The tiny parser handles the simple mappings and
folded or literal block scalars used by portable SKILL.md frontmatter; it is not a
general YAML implementation.

Usage:
    python3 skills_lab.py                     # overview of the bundled skill
    python3 skills_lab.py --validate DIR      # validate a skill directory
    python3 skills_lab.py --budget 100        # startup cost of 100 skills
    python3 skills_lab.py --simulate "..."    # simulate discovery for a request
    python3 skills_lab.py --entry "Added: X"  # run the skill's bundled validator
    python3 skills_lab.py --test              # assertions; exit non-zero on failure
"""
from __future__ import annotations

import argparse
import os
import re
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
DEFAULT_SKILL = os.path.join(HERE, "changelog-entry")

# A big MCP server loads all its tool definitions upfront. GitHub's official
# server is the standing example of tens of thousands of tokens before the agent
# does anything; we use a round figure for contrast, not a measurement.
MCP_SERVER_BASELINE = 25_000

VALID_NAME = re.compile(r"[a-z0-9-]+")
KEY_LINE = re.compile(r"^([A-Za-z][A-Za-z0-9_-]*):\s?(.*)$")
# Descriptions enter the harness prompt as statements about available capabilities,
# so the authoring guidance calls for third person. This remains a heuristic, not a
# parser for English: it catches ordinary first- and second-person pronouns.
PERSON = re.compile(
    r"\b(?:i(?!/)(?:'m|'ve|'ll|'d)?|me|my|mine|you(?:'re|'ve|'ll|'d)?|your|yours|yourself)\b",
    re.IGNORECASE,
)
WHEN_CUE = re.compile(r"\b(when|whenever|use this|use for)\b")
REF_PATH = re.compile(r"(?:references|scripts|assets)/[A-Za-z0-9_./-]+")


# --------------------------------------------------------------------------- #
# parsing
# --------------------------------------------------------------------------- #
def parse_frontmatter(text: str):
    """Split a SKILL.md into (meta, body, has_frontmatter).

    A minimal YAML reader: enough for `key: value` pairs, indented continuation
    lines, and folded (`>`) or literal (`|`) block scalars. Not a general YAML
    parser: a production harness should use a real YAML implementation.
    """
    lines = text.splitlines()
    if not lines or lines[0].strip() != "---":
        return {}, text, False
    end = None
    for i in range(1, len(lines)):
        if lines[i].strip() == "---":
            end = i
            break
    if end is None:
        return {}, text, False

    meta: dict[str, str] = {}
    key = None
    frontmatter = lines[1:end]
    i = 0
    while i < len(frontmatter):
        ln = frontmatter[i]
        m = KEY_LINE.match(ln)
        if m and not ln[:1].isspace():
            key = m.group(1)
            value = m.group(2).strip()
            if re.fullmatch(r"[>|][1-9]?[+-]?|[>|][+-]?[1-9]?", value):
                style = value[0]
                block: list[str] = []
                i += 1
                while i < len(frontmatter) and (
                    not frontmatter[i].strip() or frontmatter[i][:1].isspace()
                ):
                    block.append(frontmatter[i].strip())
                    i += 1
                if style == ">":
                    meta[key] = " ".join(part for part in block if part).strip()
                else:
                    meta[key] = "\n".join(block).strip()
                continue
            meta[key] = value
        elif key is not None and ln[:1].isspace():
            meta[key] = (meta[key] + " " + ln.strip()).strip()
        i += 1
    body = "\n".join(lines[end + 1:]).strip("\n")
    return meta, body, True


def load_skill(skill_dir: str):
    path = os.path.join(skill_dir, "SKILL.md")
    if not os.path.isfile(path):
        return None, f"no SKILL.md in {skill_dir}"
    with open(path, "r", encoding="utf-8") as fh:
        text = fh.read()
    meta, body, has_fm = parse_frontmatter(text)
    return {"meta": meta, "body": body, "has_fm": has_fm, "dir": skill_dir}, None


# --------------------------------------------------------------------------- #
# validation
# --------------------------------------------------------------------------- #
def validate_skill(skill) -> tuple[list, list]:
    """Return (errors, warnings), each a list of (code, message)."""
    errors: list[tuple[str, str]] = []
    warnings: list[tuple[str, str]] = []
    meta, body = skill["meta"], skill["body"]

    if not skill["has_fm"]:
        errors.append(("E0", "no YAML frontmatter (the file must open with a --- fence)"))
        return errors, warnings

    name = meta.get("name", "")
    desc = meta.get("description", "")

    # name -----------------------------------------------------------------
    if not name:
        errors.append(("E1", "name is missing or empty"))
    else:
        if len(name) > 64:
            errors.append(("E2", f"name is {len(name)} chars; the max is 64"))
        if not VALID_NAME.fullmatch(name):
            errors.append(("E3", "name must be lowercase letters, digits, and hyphens only"))
        low = name.lower()
        if "claude" in low or "anthropic" in low:
            errors.append(("E4", "name may not contain 'claude' or 'anthropic'"))

    # description ----------------------------------------------------------
    if not desc:
        errors.append(("E5", "description is missing or empty"))
    else:
        if len(desc) > 1024:
            errors.append(("E6", f"description is {len(desc)} chars; the max is 1024"))
        person = PERSON.search(desc.lower())
        if person:
            errors.append(("E9", f"description reads first/second person ('{person.group(0)}'); write it in the third person"))
        if not WHEN_CUE.search(desc.lower()):
            warnings.append(("W1", "description does not say when to use the skill (add a 'Use when ...' clause)"))

    # angle brackets are an injection surface in the system prompt ----------
    if any(c in (name + desc) for c in "<>"):
        errors.append(("E7", "angle brackets are not allowed in frontmatter (they are a prompt-injection surface)"))

    # body -----------------------------------------------------------------
    line_count = len(body.splitlines())
    if line_count > 500:
        errors.append(("E8", f"body is {line_count} lines; keep it under 500 and split the rest into references/"))
    if not body.strip():
        warnings.append(("W2", "body is empty; the skill has nothing to instruct once it triggers"))
    if "\\" in body:
        warnings.append(("W4", "body contains a backslash path; use forward slashes so the skill is portable"))

    # dangling one-hop links -----------------------------------------------
    for rel in sorted(set(REF_PATH.findall(body))):
        if not os.path.exists(os.path.join(skill["dir"], rel)):
            warnings.append(("W3", f"body references '{rel}', which is not present in the skill folder"))

    return errors, warnings


def print_validation(skill) -> tuple[list, list]:
    errors, warnings = validate_skill(skill)
    name = skill["meta"].get("name", "(no name)")
    print(f"// validate: {os.path.relpath(skill['dir'], HERE)}  (name: {name})")
    for code, msg in warnings:
        print(f"  warn  {code}  {msg}")
    for code, msg in errors:
        print(f"  ERROR {code}  {msg}")
    if not errors and not warnings:
        print("  clean: frontmatter passes every implemented rule")
    elif not errors:
        print(f"  ok with {len(warnings)} warning(s); no hard errors")
    else:
        print(f"  FAIL: {len(errors)} error(s), {len(warnings)} warning(s)")
    return errors, warnings


# --------------------------------------------------------------------------- #
# progressive-disclosure cost model
# --------------------------------------------------------------------------- #
def est_tokens(s: str) -> int:
    return 0 if not s else max(1, round(len(s) / 4))


def cost_model(skill) -> dict:
    meta, body = skill["meta"], skill["body"]
    level1 = est_tokens(meta.get("name", "")) + est_tokens(meta.get("description", ""))
    level2 = est_tokens(body)
    resources = []
    for sub in ("references", "scripts", "assets"):
        d = os.path.join(skill["dir"], sub)
        if os.path.isdir(d):
            for fn in sorted(os.listdir(d)):
                fp = os.path.join(d, fn)
                if os.path.isfile(fp):
                    resources.append((f"{sub}/{fn}", os.path.getsize(fp)))
    return {"level1": level1, "level2": level2, "resources": resources}


def print_cost(skill) -> None:
    c = cost_model(skill)
    print("// progressive-disclosure cost (token estimates, ~4 chars/token)")
    print(f"  level 1  metadata (name + description)  ~{c['level1']:>5} tokens   always resident, per skill")
    print(f"  level 2  SKILL.md body                  ~{c['level2']:>5} tokens   loads only on a trigger")
    if c["resources"]:
        print("  level 3+ bundled resources                            read/executed from disk on demand:")
        for rel, size in c["resources"]:
            kind = "executed, output only" if rel.startswith("scripts/") else "read when the body says so"
            print(f"             {rel:<34} {size:>6} bytes   {kind}")
    else:
        print("  level 3+ (none bundled)")


def print_budget(skill, n: int) -> None:
    c = cost_model(skill)
    level1 = c["level1"]
    startup = level1 * n
    naive = c["level2"] * n
    print(f"// startup budget for {n} installed skills like this one")
    print(f"  progressive disclosure: ~{startup:,} tokens  ({level1} of metadata each, bodies stay on disk)")
    print(f"  if every body loaded up front instead: ~{naive:,} tokens")
    print(f"  one large MCP server, for contrast, loads ~{MCP_SERVER_BASELINE:,} tokens before doing anything")
    if startup:
        print(f"  => {n} skills cost about {startup / MCP_SERVER_BASELINE:.2f}x a single big server at startup")


# --------------------------------------------------------------------------- #
# discovery simulation
# --------------------------------------------------------------------------- #
STOP = set("a an the to for of and or with this that add adds new your you it is are be "
           "on in at as by from into out do does can will use uses using".split())


def keywords(s: str) -> list[str]:
    return [w for w in re.findall(r"[a-z0-9]+", s.lower()) if w not in STOP and len(w) > 1]


def simulate(skill, request: str) -> bool:
    meta, body = skill["meta"], skill["body"]
    desc = meta.get("description", "")
    dt = set(keywords(desc))
    overlap = sorted({w for w in keywords(request) if w in dt})
    triggered = len(overlap) >= 2

    print(f"// simulate discovery for: {request!r}")
    print(f"  request keywords overlap description on: {overlap or '(none)'}")
    if not triggered:
        print("  => below the trigger threshold; the SKILL.md body never loads (level 1 only)")
        print("     (a real model also weighs task difficulty, not just keywords)")
        return False
    print("  => triggered. loading sequence:")
    print(f"     level 1  already resident: name + description (~{est_tokens(desc)} tokens for the description)")
    print(f"     level 2  bash reads {os.path.basename(skill['dir'])}/SKILL.md (~{est_tokens(body)} tokens)")
    for rel in sorted(set(REF_PATH.findall(body))):
        if rel.startswith("scripts/"):
            print(f"     level 3  bash executes {rel} when instructed; only its output enters context")
        else:
            print(f"     level 3  bash reads {rel} on demand; costs nothing until this point")
    return True


def run_entry(skill, entry: str) -> int:
    """Run the skill's bundled validator on an entry, showing level-3 execution:
    the harness can return output without first loading script source into context."""
    script = os.path.join(skill["dir"], "scripts", "validate_entry.py")
    if not os.path.isfile(script):
        print(f"no bundled validator at {script}")
        return 1
    print(f"// bash executes scripts/validate_entry.py {entry!r}")
    proc = subprocess.run([sys.executable, script, entry], capture_output=True, text=True)
    out = (proc.stdout + proc.stderr).strip()
    print(f"  output: {out}")
    print(f"  exit:   {proc.returncode}   (this is all that enters the model's context)")
    return proc.returncode


# --------------------------------------------------------------------------- #
# tests
# --------------------------------------------------------------------------- #
def run_tests() -> int:
    passed = 0
    failed = 0

    def check(desc, cond):
        nonlocal passed, failed
        if cond:
            passed += 1
            print(f"  PASS  {desc}")
        else:
            failed += 1
            print(f"  FAIL  {desc}")

    print("// tests")

    good, err = load_skill(DEFAULT_SKILL)
    check("changelog-entry loads", good is not None and err is None)
    if good:
        e, w = validate_skill(good)
        check("changelog-entry has no errors", e == [])
        check("changelog-entry has no warnings", w == [])

    bad, err = load_skill(os.path.join(HERE, "bad-skill"))
    check("bad-skill loads", bad is not None and err is None)
    if bad:
        e, w = validate_skill(bad)
        codes = {c for c, _ in e}
        check("bad-skill trips E4 (forbidden word in name)", "E4" in codes)
        check("bad-skill trips E7 (angle brackets)", "E7" in codes)
        check("bad-skill trips E9 (first person)", "E9" in codes)
        check("bad-skill warns W1 (no 'when' cue)", "W1" in {c for c, _ in w})

    # synthetic frontmatter, exercising the numeric rules without a file per case
    def synth(name="ok-name", desc="Does a thing. Use when a thing is needed.", body="# x\nbody"):
        return {"meta": {"name": name, "description": desc}, "body": body,
                "has_fm": True, "dir": HERE}

    check("E1 empty name", "E1" in {c for c, _ in validate_skill(synth(name=""))[0]})
    check("E2 over-long name", "E2" in {c for c, _ in validate_skill(synth(name="x" * 65))[0]})
    check("E3 bad name chars", "E3" in {c for c, _ in validate_skill(synth(name="Bad_Name"))[0]})
    check("E5 empty description", "E5" in {c for c, _ in validate_skill(synth(desc=""))[0]})
    check("E6 over-long description", "E6" in {c for c, _ in validate_skill(synth(desc="d" * 1025))[0]})
    check("E8 over-long body", "E8" in {c for c, _ in validate_skill(synth(body="\n".join(["x"] * 501)))[0]})
    check(
        "E9 ordinary first-person wording",
        "E9" in {c for c, _ in validate_skill(synth(desc="I format changelog entries. Use when one is needed."))[0]},
    )

    folded_meta, folded_body, folded_frontmatter = parse_frontmatter(
        "---\nname: folded-description\ndescription: >\n  Formats changelog entries.\n  Use when one is needed.\n---\n# Body"
    )
    folded_skill = {
        "meta": folded_meta,
        "body": folded_body,
        "has_fm": folded_frontmatter,
        "dir": HERE,
    }
    folded_errors, _ = validate_skill(folded_skill)
    check(
        "folded YAML description parses",
        folded_meta.get("description") == "Formats changelog entries. Use when one is needed.",
    )
    check("folded YAML description avoids E7", "E7" not in {c for c, _ in folded_errors})

    # discovery threshold
    if good:
        check("relevant request triggers", simulate_quiet(good, "add a changelog entry for the export flag"))
        check("irrelevant request does not trigger", not simulate_quiet(good, "reboot the database server"))

    # the bundled validator itself
    if good:
        check("validator accepts a good entry", run_entry_quiet(good, "Added: --export flag to the CLI") == 0)
        check("validator rejects an unknown type", run_entry_quiet(good, "Nope: something") == 1)
        check("validator rejects a trailing period", run_entry_quiet(good, "Fixed: crash on startup.") == 1)

    print(f"\n{passed} passed, {failed} failed")
    return 0 if failed == 0 else 1


def simulate_quiet(skill, request: str) -> bool:
    desc = skill["meta"].get("description", "")
    dt = set(keywords(desc))
    return len({w for w in keywords(request) if w in dt}) >= 2


def run_entry_quiet(skill, entry: str) -> int:
    script = os.path.join(skill["dir"], "scripts", "validate_entry.py")
    proc = subprocess.run([sys.executable, script, entry], capture_output=True, text=True)
    return proc.returncode


# --------------------------------------------------------------------------- #
# cli
# --------------------------------------------------------------------------- #
def main(argv: list[str]) -> int:
    ap = argparse.ArgumentParser(description="A zero-dependency lab for Agent Skills.")
    ap.add_argument("--validate", metavar="DIR", help="validate a skill directory")
    ap.add_argument("--skill", metavar="DIR", default=DEFAULT_SKILL, help="skill used by --budget/--simulate/--entry")
    ap.add_argument("--budget", metavar="N", type=int, help="print the startup cost of N installed skills")
    ap.add_argument("--simulate", metavar="REQUEST", help="simulate discovery for a request string")
    ap.add_argument("--entry", metavar="LINE", help="run the skill's bundled validator on a changelog entry")
    ap.add_argument("--test", action="store_true", help="run assertions and exit non-zero on failure")
    args = ap.parse_args(argv[1:])

    if args.test:
        return run_tests()

    if args.validate:
        skill, err = load_skill(args.validate if os.path.isabs(args.validate)
                                else os.path.join(HERE, args.validate))
        if err:
            print(err)
            return 1
        errors, _ = print_validation(skill)
        return 0 if not errors else 1

    skill, err = load_skill(args.skill if os.path.isabs(args.skill) else os.path.join(HERE, args.skill))
    if err:
        print(err)
        return 1

    if args.budget is not None:
        print_budget(skill, args.budget)
        return 0
    if args.simulate is not None:
        simulate(skill, args.simulate)
        return 0
    if args.entry is not None:
        return 0 if run_entry(skill, args.entry) == 0 else 1

    # default: an overview of the bundled skill
    print("=== a real skill, validated, priced, and discovered ===\n")
    print_validation(skill)
    print()
    print_cost(skill)
    print()
    simulate(skill, "add a changelog entry for the new export flag")
    print()
    print("run --test for assertions, --validate bad-skill to watch the rules fail,")
    print("--budget 100 to price a library, or --entry \"Added: X\" to run the bundled validator.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
