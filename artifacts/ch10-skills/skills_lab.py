#!/usr/bin/env python3
"""skills_lab.py --- a zero-dependency lab for Agent Skills.

Three ideas from the Skills chapter, made executable:

  1. Lint this bundle's supported portable frontmatter subset: the required
     ASCII name syntax, directory match, and description bounds. It is a
     teaching lint, not a general YAML implementation, full-schema validator,
     or production gate. In production, use the target harness's maintained
     validator together with your own deployment gate. ``skills-ref`` remains
     a demonstration-only reference implementation for comparison. The optional
     ``--surface anthropic`` profile adds Anthropic-only compatibility
     restrictions; authoring advice stays a warning in either profile.
  2. Price progressive disclosure: what one listed, model-invocable skill costs
     at each loading level, and what listing N such skills costs at startup.
  3. Simulate discovery with an intentionally crude keyword proxy. It illustrates
     the loading path but cannot establish how a production model will trigger.

No third-party packages, API key, or network are required. Python 3.9+ is required;
Bash is required for the fresh-install smoke test and ``check.sh``. Token counts are
estimates (~4 characters per token), and the discovery match is a two-keyword proxy rather
than a production harness. The parser handles plain or basic quoted mappings and folded or
literal block scalars used by this artifact. It rejects unsupported YAML collections and
plain YAML forms that resolve to non-string values, rather than pretending to validate them.

Usage:
    python3 skills_lab.py                              # overview of the bundled skill
    python3 skills_lab.py --validate DIR               # supported portable-subset lint
    python3 skills_lab.py --validate DIR --surface anthropic
    python3 skills_lab.py --budget 100                 # listed-skill startup cost
    python3 skills_lab.py --simulate "..."              # illustrative discovery path
    python3 skills_lab.py --entry "Added: X"            # run the bundled validator
    python3 skills_lab.py --test                        # assertions; non-zero on failure
"""
from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
from typing import Optional

HERE = os.path.dirname(os.path.abspath(__file__))
DEFAULT_SKILL = os.path.join(HERE, "changelog-entry")

# A deliberately illustrative eager tool catalog. Many current MCP hosts defer schemas,
# so this is a contrast configuration, not a claim about every server or host.
EAGER_TOOL_CATALOG_EXAMPLE = 25_000

# The teaching lint deliberately supports the artifact's ASCII name subset: one to 64
# lowercase alphanumeric segments joined by single hyphens. The directory must match.
# The full Agent Skills specification permits more YAML and Unicode lowercase names;
# use the target harness's maintained validator before a production deployment.
VALID_NAME = re.compile(r"[a-z0-9]+(?:-[a-z0-9]+)*")
KEY_LINE = re.compile(r"^([A-Za-z][A-Za-z0-9_-]*):\s?(.*)$")
PERSON = re.compile(
    r"\b(?:i(?!/)(?:'m|'ve|'ll|'d)?|me|my|mine|you(?:'re|'ve|'ll|'d)?|your|yours|yourself)\b",
    re.IGNORECASE,
)
WHEN_CUE = re.compile(r"\b(when|whenever|use this|use for)\b")
REF_PATH = re.compile(r"(?:references|scripts|assets)/[A-Za-z0-9_./-]+")
YAML_NUMBER = re.compile(
    r"[-+]?(?:0|[1-9][0-9_]*)(?:\.[0-9_]+)?(?:[eE][-+]?[0-9_]+)?$"
    r"|[-+]?\.[0-9_]+(?:[eE][-+]?[0-9_]+)?$"
    r"|[-+]?\.(?:inf|nan)$"
    r"|0[xo][0-9a-fA-F_]+$",
    re.IGNORECASE,
)


# --------------------------------------------------------------------------- #
# parsing
# --------------------------------------------------------------------------- #
def parse_scalar(value: str, key: str, errors: list[str]) -> str:
    """Parse the teaching subset's plain and basic quoted scalar values."""
    if value.startswith(("[", "{")):
        errors.append(
            f"{key} has unsupported YAML collection syntax; this teaching lint accepts scalar values only"
        )
        return value
    if not value.startswith(("'", '"')):
        # A YAML comment begins at a hash preceded by whitespace. Strip it before
        # checking scalar type, so `description: # explanation` remains empty.
        value = re.split(r"(?:^|\s)#", value, maxsplit=1)[0].rstrip()
        if not value:
            return ""

        lowered = value.casefold()
        if (
            lowered in {"~", "null", "true", "false"}
            or YAML_NUMBER.fullmatch(value)
        ):
            errors.append(
                f"{key} has a YAML non-string scalar; quote it as a string"
            )
            return ""
        return value
    if value[0] == "'":
        if len(value) < 2 or not value.endswith("'"):
            errors.append(f"{key} has an unterminated single-quoted scalar")
            return value
        return value[1:-1].replace("''", "'")
    try:
        parsed = json.loads(value)
    except json.JSONDecodeError:
        errors.append(f"{key} has unsupported or invalid double-quoted scalar syntax")
        return value
    if not isinstance(parsed, str):
        errors.append(f"{key} must be a string scalar")
        return value
    return parsed


def parse_frontmatter(text: str):
    """Split a SKILL.md into (meta, body, has_frontmatter).

    A minimal YAML reader: enough for plain or basic quoted scalar mappings, indented
    continuation lines, and folded (``>``) or literal (``|``) block scalars used by
    this bundle. It is deliberately not a general YAML implementation or complete
    schema parser.
    """
    lines = text.splitlines()
    if not lines or lines[0].strip() != "---":
        return {}, text, False, []
    end = None
    for i in range(1, len(lines)):
        if lines[i].strip() == "---":
            end = i
            break
    if end is None:
        return {}, text, False, []

    meta: dict[str, str] = {}
    parse_errors: list[str] = []
    unsupported_nested_keys: set[str] = set()
    key = None
    frontmatter = lines[1:end]
    i = 0
    while i < len(frontmatter):
        line = frontmatter[i]
        match = KEY_LINE.match(line)
        if match and not line[:1].isspace():
            key = match.group(1)
            value = match.group(2).strip()
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
            meta[key] = parse_scalar(value, key, parse_errors)
        elif key is not None and line[:1].isspace():
            continuation = line.strip()
            if (
                continuation.startswith(("- ", "? ", ": ", "[", "{"))
                or KEY_LINE.match(continuation)
            ) and key not in unsupported_nested_keys:
                parse_errors.append(
                    f"{key} has unsupported nested YAML collection syntax; this teaching lint accepts scalar values only"
                )
                unsupported_nested_keys.add(key)
            meta[key] = (meta[key] + " " + continuation).strip()
        i += 1
    body = "\n".join(lines[end + 1:]).strip("\n")
    return meta, body, True, parse_errors


def load_skill(skill_dir: str):
    path = os.path.join(skill_dir, "SKILL.md")
    if not os.path.isfile(path):
        return None, f"no SKILL.md in {skill_dir}"
    with open(path, "r", encoding="utf-8") as fh:
        text = fh.read()
    meta, body, has_frontmatter, parse_errors = parse_frontmatter(text)
    return {
        "meta": meta,
        "body": body,
        "has_fm": has_frontmatter,
        "parse_errors": parse_errors,
        "dir": skill_dir,
    }, None


# --------------------------------------------------------------------------- #
# validation
# --------------------------------------------------------------------------- #
def validate_skill(skill, surface: str = "portable") -> tuple[list, list]:
    """Return (errors, warnings) for the lab's named teaching-lint profile.

    P findings are portable rules checked by this supported subset, not a complete
    Agent Skills validation result. A errors are additional Anthropic-surface
    restrictions. W findings are authoring advice.
    """
    errors: list[tuple[str, str]] = []
    warnings: list[tuple[str, str]] = []
    meta, body = skill["meta"], skill["body"]

    if not skill["has_fm"]:
        errors.append(("P1", "no YAML frontmatter (the file must open with a --- fence)"))
        return errors, warnings

    for detail in skill.get("parse_errors", []):
        errors.append(("P0", detail))

    name = meta.get("name", "")
    description = meta.get("description", "")

    # portable name --------------------------------------------------------
    if not name:
        errors.append(("P2", "name is missing or empty"))
    else:
        if len(name) > 64:
            errors.append(("P3", f"name is {len(name)} chars; the portable max is 64"))
        if not VALID_NAME.fullmatch(name):
            errors.append((
                "P4",
                "name must use lowercase letters or digits joined by single hyphens; no leading, trailing, or consecutive hyphens",
            ))
        directory_name = os.path.basename(os.path.normpath(skill["dir"]))
        if name != directory_name:
            errors.append(("P5", f"name {name!r} must match parent directory {directory_name!r}"))

    # portable description -------------------------------------------------
    if not description:
        errors.append(("P6", "description is missing or empty"))
    elif len(description) > 1024:
        errors.append(("P7", f"description is {len(description)} chars; the portable max is 1024"))

    # Anthropic profile ----------------------------------------------------
    if surface == "anthropic":
        lowered = name.lower()
        if "claude" in lowered or "anthropic" in lowered:
            errors.append(("A1", "Anthropic profile: name may not contain 'claude' or 'anthropic'"))
        if any(char in (name + description) for char in "<>"):
            errors.append(("A2", "Anthropic profile: angle brackets are not allowed in frontmatter"))

    # authoring guidance ---------------------------------------------------
    person = PERSON.search(description)
    if person:
        warnings.append(("W1", f"description reads first/second person ({person.group(0)!r}); third person improves discovery"))
    if description and not WHEN_CUE.search(description):
        warnings.append(("W2", "description does not say when to use the skill (add a concrete trigger cue)"))

    line_count = len(body.splitlines())
    if line_count > 500:
        warnings.append(("W3", f"body is {line_count} lines; split detail into references to protect activation context"))
    if not body.strip():
        warnings.append(("W4", "body is empty; the skill has nothing to instruct once it triggers"))
    if "\\" in body:
        warnings.append(("W5", "body contains a backslash path; use forward slashes for portability"))

    for rel in sorted(set(REF_PATH.findall(body))):
        if not os.path.exists(os.path.join(skill["dir"], rel)):
            warnings.append(("W6", f"body references {rel!r}, which is not present in the skill folder"))

    return errors, warnings


def print_validation(skill, surface: str = "portable") -> tuple[list, list]:
    errors, warnings = validate_skill(skill, surface)
    name = skill["meta"].get("name", "(no name)")
    profile = "portable teaching subset" if surface == "portable" else "portable teaching subset + Anthropic surface"
    print(f"// lint: {os.path.relpath(skill['dir'], HERE)}  (name: {name}; profile: {profile})")
    for code, message in warnings:
        print(f"  warn  {code}  {message}")
    for code, message in errors:
        print(f"  ERROR {code}  {message}")
    if not errors and not warnings:
        print("  clean: passes this lab's checked subset")
        print("  production: use the target harness's maintained validator and a deployment gate; skills-ref is reference-only")
    elif not errors:
        print(f"  valid with {len(warnings)} authoring warning(s)")
    else:
        print(f"  FAIL: {len(errors)} error(s), {len(warnings)} warning(s)")
    return errors, warnings


# --------------------------------------------------------------------------- #
# progressive-disclosure cost model
# --------------------------------------------------------------------------- #
def est_tokens(text: str) -> int:
    return 0 if not text else max(1, round(len(text) / 4))


def cost_model(skill) -> dict:
    meta, body = skill["meta"], skill["body"]
    level1 = est_tokens(meta.get("name", "")) + est_tokens(meta.get("description", ""))
    level2 = est_tokens(body)
    resources = []
    for subdirectory in ("references", "scripts", "assets"):
        directory = os.path.join(skill["dir"], subdirectory)
        if os.path.isdir(directory):
            for filename in sorted(os.listdir(directory)):
                path = os.path.join(directory, filename)
                if os.path.isfile(path):
                    resources.append((f"{subdirectory}/{filename}", os.path.getsize(path)))
    return {"level1": level1, "level2": level2, "resources": resources}


def print_cost(skill) -> None:
    cost = cost_model(skill)
    print("// progressive-disclosure cost (token estimates, ~4 chars/token)")
    print(f"  level 1  metadata (name + description)  ~{cost['level1']:>5} tokens   listed, model-invocable")
    print(f"  level 2  SKILL.md body                  ~{cost['level2']:>5} tokens   Claude Code: first/distinct/changed render; identical re-invocation gets a short note")
    if cost["resources"]:
        print("  level 3+ bundled resources                            accessed on demand:")
        for rel, size in cost["resources"]:
            if rel.startswith("scripts/"):
                behavior = "executed; output enters, source need not"
            else:
                behavior = "read; contents enter when read"
            print(f"             {rel:<34} {size:>6} bytes   {behavior}")
    else:
        print("  level 3+ (none bundled)")
    print("  note     user-only manual skills are absent from startup context")


def print_budget(skill, count: int) -> None:
    if count < 0:
        raise ValueError("budget count must be zero or greater")
    cost = cost_model(skill)
    level1 = cost["level1"]
    startup = level1 * count
    eager_bodies = cost["level2"] * count
    print(f"// startup budget for {count} listed, model-invocable skills like this one")
    print(f"  progressive disclosure: ~{startup:,} tokens  ({level1} metadata tokens each; bodies stay on disk)")
    print(f"  if every body loaded up front instead: ~{eager_bodies:,} tokens")
    print(f"  illustrative eager tool catalog:        ~{EAGER_TOOL_CATALOG_EXAMPLE:,} tokens before work")
    print("  user-only manual skills are omitted until a user invokes them")
    if startup:
        print(f"  => {count} listed skills cost about {startup / EAGER_TOOL_CATALOG_EXAMPLE:.2f}x that eager-catalog example at startup")


# --------------------------------------------------------------------------- #
# discovery simulation
# --------------------------------------------------------------------------- #
STOP = set("a an the to for of and or with this that add adds new your you it is are be "
           "on in at as by from into out do does can will use uses using".split())


def keywords(text: str) -> list[str]:
    return [word for word in re.findall(r"[a-z0-9]+", text.lower()) if word not in STOP and len(word) > 1]


def simulate(skill, request: str) -> bool:
    meta, body = skill["meta"], skill["body"]
    description = meta.get("description", "")
    description_terms = set(keywords(description))
    overlap = sorted({word for word in keywords(request) if word in description_terms})
    triggered = len(overlap) >= 2

    print(f"// illustrative discovery proxy for: {request!r}")
    print(f"  request keywords overlap description on: {overlap or '(none)'}")
    if not triggered:
        print("  => below this proxy's threshold; only listed metadata is modeled as loaded")
        print("     (a real model also weighs task difficulty, wording, and its target harness)")
        return False
    print("  => this proxy triggers. possible loading sequence:")
    print(f"     level 1  already listed: name + description (~{est_tokens(description)} description tokens)")
    print(f"     level 2  reads {os.path.basename(skill['dir'])}/SKILL.md (~{est_tokens(body)} tokens); Claude Code: first/distinct/changed render, identical re-invocation gets a short note")
    for rel in sorted(set(REF_PATH.findall(body))):
        if rel.startswith("scripts/"):
            print(f"     level 3  executes {rel}; output enters context while source can stay on disk")
        else:
            print(f"     level 3  reads {rel}; its contents enter context at that point")
    return True


def validator_path(skill) -> str:
    return os.path.join(skill["dir"], "scripts", "validate_entry.py")


def run_entry(skill, entry: str) -> int:
    """Run the bundled validator with the documented Python invocation."""
    script = validator_path(skill)
    if not os.path.isfile(script):
        print(f"no bundled validator at {script}")
        return 1
    print(f"// runs python3 {script!r} {entry!r}")
    proc = subprocess.run(["python3", script, entry], capture_output=True, text=True)
    output = (proc.stdout + proc.stderr).strip()
    print(f"  output: {output}")
    print(f"  exit:   {proc.returncode}   (output, not source, enters the model context)")
    return proc.returncode


# --------------------------------------------------------------------------- #
# tests
# --------------------------------------------------------------------------- #
def run_tests() -> int:
    passed = 0
    failed = 0

    def check(description: str, condition: bool) -> None:
        nonlocal passed, failed
        if condition:
            passed += 1
            print(f"  PASS  {description}")
        else:
            failed += 1
            print(f"  FAIL  {description}")

    def codes(items) -> set[str]:
        return {code for code, _ in items}

    print("// tests")

    good, error = load_skill(DEFAULT_SKILL)
    check("changelog-entry loads", good is not None and error is None)
    if good:
        portable_errors, portable_warnings = validate_skill(good)
        anthropic_errors, anthropic_warnings = validate_skill(good, "anthropic")
        check("changelog-entry passes the portable teaching subset", portable_errors == [])
        check("changelog-entry has no portable authoring warnings", portable_warnings == [])
        check("changelog-entry passes the Anthropic profile", anthropic_errors == [])
        check("changelog-entry has no Anthropic-profile warnings", anthropic_warnings == [])

    bad, error = load_skill(os.path.join(HERE, "bad-skill"))
    check("bad-skill loads", bad is not None and error is None)
    if bad:
        portable_errors, portable_warnings = validate_skill(bad)
        anthropic_errors, anthropic_warnings = validate_skill(bad, "anthropic")
        check("bad-skill trips P4 (portable hyphen syntax)", "P4" in codes(portable_errors))
        check("bad-skill trips P5 (directory mismatch)", "P5" in codes(portable_errors))
        check("bad-skill trips A1 (reserved vendor word) only in Anthropic profile", "A1" in codes(anthropic_errors))
        check("bad-skill trips A2 (angle brackets) only in Anthropic profile", "A2" in codes(anthropic_errors))
        check("bad-skill warns W1 (first person)", "W1" in codes(portable_warnings))
        check("bad-skill warns W2 (no trigger cue)", "W2" in codes(anthropic_warnings))

    # Synthetic frontmatter exercises portable boundaries without a file per case.
    def synth(
        name: str = "ok-name",
        description: str = "Formats a thing. Use when a thing is needed.",
        body: str = "# x\nbody",
        directory: Optional[str] = None,
    ):
        return {
            "meta": {"name": name, "description": description},
            "body": body,
            "has_fm": True,
            "dir": os.path.join(HERE, directory if directory is not None else name),
        }

    check("P2 empty name", "P2" in codes(validate_skill(synth(name=""))[0]))
    check("P3 over-long name", "P3" in codes(validate_skill(synth(name="x" * 65))[0]))
    check("P4 uppercase name", "P4" in codes(validate_skill(synth(name="Bad-Name"))[0]))
    check("P4 leading hyphen", "P4" in codes(validate_skill(synth(name="-bad-name"))[0]))
    check("P4 trailing hyphen", "P4" in codes(validate_skill(synth(name="bad-name-"))[0]))
    check("P4 consecutive hyphens", "P4" in codes(validate_skill(synth(name="bad--name"))[0]))
    check("P5 mismatched directory", "P5" in codes(validate_skill(synth(directory="other-name"))[0]))
    check("P6 empty description", "P6" in codes(validate_skill(synth(description=""))[0]))
    check("P7 over-long description", "P7" in codes(validate_skill(synth(description="d" * 1025))[0]))
    check("W3 over-long body is advisory", "W3" in codes(validate_skill(synth(body="\n".join(["x"] * 501)))[1]))
    check(
        "W1 first-person wording is advisory",
        "W1" in codes(validate_skill(synth(description="I format changelog entries. Use when one is needed."))[1]),
    )
    check(
        "A1 vendor word is Anthropic-only",
        "A1" in codes(validate_skill(synth(name="claude-helper"), "anthropic")[0]),
    )
    check(
        "A2 angle brackets are Anthropic-only",
        "A2" in codes(validate_skill(synth(description="Formats <things>. Use when needed."), "anthropic")[0]),
    )
    check(
        "portable profile accepts angle brackets structurally",
        "A2" not in codes(validate_skill(synth(description="Formats <things>. Use when needed."))[0]),
    )

    folded_meta, folded_body, folded_frontmatter, folded_parse_errors = parse_frontmatter(
        "---\nname: folded-description\ndescription: >\n  Formats changelog entries.\n  Use when one is needed.\n---\n# Body"
    )
    folded_skill = {
        "meta": folded_meta,
        "body": folded_body,
        "has_fm": folded_frontmatter,
        "parse_errors": folded_parse_errors,
        "dir": os.path.join(HERE, "folded-description"),
    }
    folded_errors, _ = validate_skill(folded_skill)
    check(
        "folded YAML description parses",
        folded_meta.get("description") == "Formats changelog entries. Use when one is needed.",
    )
    check("folded YAML description passes the portable teaching subset", folded_errors == [])

    quoted_meta, quoted_body, quoted_frontmatter, quoted_parse_errors = parse_frontmatter(
        '---\nname: quoted-description\ndescription: ""\n---\n# Body'
    )
    quoted_skill = {
        "meta": quoted_meta,
        "body": quoted_body,
        "has_fm": quoted_frontmatter,
        "parse_errors": quoted_parse_errors,
        "dir": os.path.join(HERE, "quoted-description"),
    }
    quoted_errors, _ = validate_skill(quoted_skill)
    check("quoted empty description parses as empty", quoted_meta.get("description") == "")
    check("quoted empty description trips P6", "P6" in codes(quoted_errors))

    comment_meta, comment_body, comment_frontmatter, comment_parse_errors = parse_frontmatter(
        "---\nname: comment-description\ndescription: # use when needed\n---\n# Body"
    )
    comment_skill = {
        "meta": comment_meta,
        "body": comment_body,
        "has_fm": comment_frontmatter,
        "parse_errors": comment_parse_errors,
        "dir": os.path.join(HERE, "comment-description"),
    }
    comment_errors, _ = validate_skill(comment_skill)
    check("comment-only description parses as empty", comment_meta.get("description") == "")
    check("comment-only description trips P6", "P6" in codes(comment_errors))

    for label, scalar in (("null", "null"), ("boolean", "true"), ("numeric", "42")):
        scalar_meta, scalar_body, scalar_frontmatter, scalar_parse_errors = parse_frontmatter(
            f"---\nname: {label}-description\ndescription: {scalar}\n---\n# Body"
        )
        scalar_skill = {
            "meta": scalar_meta,
            "body": scalar_body,
            "has_fm": scalar_frontmatter,
            "parse_errors": scalar_parse_errors,
            "dir": os.path.join(HERE, f"{label}-description"),
        }
        scalar_errors, _ = validate_skill(scalar_skill)
        check(f"{label} description trips P0", "P0" in codes(scalar_errors))

    inline_collection_meta, inline_collection_body, inline_collection_frontmatter, inline_collection_parse_errors = parse_frontmatter(
        "---\nname: inline-collection\ndescription: [not, a scalar]\n---\n# Body"
    )
    inline_collection_skill = {
        "meta": inline_collection_meta,
        "body": inline_collection_body,
        "has_fm": inline_collection_frontmatter,
        "parse_errors": inline_collection_parse_errors,
        "dir": os.path.join(HERE, "inline-collection"),
    }
    inline_collection_errors, _ = validate_skill(inline_collection_skill)
    check("inline YAML collection trips P0", "P0" in codes(inline_collection_errors))

    nested_collection_meta, nested_collection_body, nested_collection_frontmatter, nested_collection_parse_errors = parse_frontmatter(
        "---\nname: nested-collection\ndescription:\n  - not a scalar\n---\n# Body"
    )
    nested_collection_skill = {
        "meta": nested_collection_meta,
        "body": nested_collection_body,
        "has_fm": nested_collection_frontmatter,
        "parse_errors": nested_collection_parse_errors,
        "dir": os.path.join(HERE, "nested-collection"),
    }
    nested_collection_errors, _ = validate_skill(nested_collection_skill)
    check("nested YAML collection trips P0", "P0" in codes(nested_collection_errors))

    indented_flow_collection_meta, indented_flow_collection_body, indented_flow_collection_frontmatter, indented_flow_collection_parse_errors = parse_frontmatter(
        "---\nname: indented-flow-collection\ndescription:\n  [not, a scalar]\n---\n# Body"
    )
    indented_flow_collection_skill = {
        "meta": indented_flow_collection_meta,
        "body": indented_flow_collection_body,
        "has_fm": indented_flow_collection_frontmatter,
        "parse_errors": indented_flow_collection_parse_errors,
        "dir": os.path.join(HERE, "indented-flow-collection"),
    }
    indented_flow_collection_errors, _ = validate_skill(indented_flow_collection_skill)
    check("indented flow YAML collection trips P0", "P0" in codes(indented_flow_collection_errors))

    zero_budget = run_lab_quiet("--budget", "0")
    check("zero budget remains valid", zero_budget.returncode == 0)
    negative_budget = run_lab_quiet("--budget", "-1")
    check(
        "negative budget returns a clear nonzero error",
        negative_budget.returncode != 0 and "must be zero or greater" in negative_budget.stderr,
    )

    if good:
        check("relevant request triggers this proxy", simulate_quiet(good, "add a changelog entry for the export flag"))
        check("irrelevant request does not trigger this proxy", not simulate_quiet(good, "reboot the database server"))

        # The bundled validator aligns with Keep a Changelog's unprescribed punctuation
        # and length while retaining deterministic structural checks.
        check("validator accepts a good entry", run_entry_quiet(good, "Added: --export flag to the CLI") == 0)
        check("validator rejects an unknown type", run_entry_quiet(good, "Nope: something") == 1)
        check("validator accepts a terminal period", run_entry_quiet(good, "Fixed: crash on startup.") == 0)
        check("validator has no arbitrary 120-char cap", run_entry_quiet(good, "Added: " + ("x" * 200)) == 0)
        check("validator rejects leading stdin whitespace", run_entry_stdin_quiet(good, " Added: trimmed?\n") == 1)
        check("validator rejects trailing stdin whitespace", run_entry_stdin_quiet(good, "Added: trimmed? \n") == 1)
        check("validator rejects a carriage-return line break", run_entry_quiet(good, "Added: good\rInjected") == 1)
        check("validator rejects a Unicode line-separator break", run_entry_quiet(good, "Added: good\u2028Injected") == 1)
        bash_available = shutil.which("bash") is not None
        check("Bash is available for the documented install and check workflows", bash_available)
        if bash_available:
            check("root-aware installed command works outside the skill directory", run_installed_workflow_quiet(good, "Added: root-aware path") == 0)
            check(
                "fresh Claude Code install creates its missing skill directory and runs outside it",
                run_fresh_install_quiet("Added: fresh install path") == 0,
            )

    print(f"\n{passed} passed, {failed} failed")
    return 0 if failed == 0 else 1


def simulate_quiet(skill, request: str) -> bool:
    description = skill["meta"].get("description", "")
    description_terms = set(keywords(description))
    return len({word for word in keywords(request) if word in description_terms}) >= 2


def run_entry_quiet(skill, entry: str) -> int:
    proc = subprocess.run(["python3", validator_path(skill), entry], capture_output=True, text=True)
    return proc.returncode


def run_entry_stdin_quiet(skill, entry: str) -> int:
    proc = subprocess.run(
        ["python3", validator_path(skill)], input=entry, capture_output=True, text=True
    )
    return proc.returncode


def run_installed_workflow_quiet(skill, entry: str) -> int:
    """Exercise the literal Claude Code path from a directory outside the skill."""
    env = os.environ.copy()
    env["CLAUDE_SKILL_DIR"] = skill["dir"]
    proc = subprocess.run(
        [
            "bash",
            "-c",
            'python3 "$CLAUDE_SKILL_DIR/scripts/validate_entry.py" "$1"',
            "skills-lab",
            entry,
        ],
        cwd=os.path.dirname(HERE),
        env=env,
        capture_output=True,
        text=True,
    )
    return proc.returncode


def run_fresh_install_quiet(entry: str) -> int:
    """Run the README's install commands with an empty HOME, then exercise the skill."""
    with tempfile.TemporaryDirectory(prefix="skills-lab-home-") as fake_home:
        env = os.environ.copy()
        env["HOME"] = fake_home
        install = subprocess.run(
            [
                "bash",
                "-c",
                "mkdir -p ~/.claude/skills/changelog-entry\n"
                "cp -R changelog-entry/. ~/.claude/skills/changelog-entry/",
            ],
            cwd=HERE,
            env=env,
            capture_output=True,
            text=True,
        )
        installed_dir = os.path.join(fake_home, ".claude", "skills", "changelog-entry")
        installed, error = load_skill(installed_dir)
        if install.returncode != 0 or installed is None or error is not None:
            return 1
        return run_installed_workflow_quiet(installed, entry)


def run_lab_quiet(*args: str) -> subprocess.CompletedProcess[str]:
    """Run this CLI as a subprocess to test parser-level argument failures."""
    return subprocess.run(
        [sys.executable, os.path.abspath(__file__), *args],
        capture_output=True,
        text=True,
    )


# --------------------------------------------------------------------------- #
# cli
# --------------------------------------------------------------------------- #
def nonnegative_int(value: str) -> int:
    try:
        parsed = int(value)
    except ValueError as exc:
        raise argparse.ArgumentTypeError("must be an integer") from exc
    if parsed < 0:
        raise argparse.ArgumentTypeError("must be zero or greater")
    return parsed


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description="A zero-dependency lab for Agent Skills.")
    parser.add_argument("--validate", metavar="DIR", help="lint this bundle's supported frontmatter subset")
    parser.add_argument(
        "--surface",
        choices=("portable", "anthropic"),
        default="portable",
        help="compatibility profile for validation (default: portable)",
    )
    parser.add_argument("--skill", metavar="DIR", default=DEFAULT_SKILL, help="skill used by --budget/--simulate/--entry")
    parser.add_argument("--budget", metavar="N", type=nonnegative_int, help="print the startup cost of N listed skills")
    parser.add_argument("--simulate", metavar="REQUEST", help="illustrate discovery for a request string")
    parser.add_argument("--entry", metavar="LINE", help="run the skill's bundled validator on a changelog entry")
    parser.add_argument("--test", action="store_true", help="run assertions and exit non-zero on failure")
    args = parser.parse_args(argv[1:])

    if args.test:
        return run_tests()

    if args.validate:
        skill, error = load_skill(args.validate)
        if error:
            print(error)
            return 1
        errors, _ = print_validation(skill, args.surface)
        return 0 if not errors else 1

    skill, error = load_skill(args.skill)
    if error:
        print(error)
        return 1

    if args.budget is not None:
        print_budget(skill, args.budget)
        return 0
    if args.simulate is not None:
        simulate(skill, args.simulate)
        return 0
    if args.entry is not None:
        return 0 if run_entry(skill, args.entry) == 0 else 1

    print("=== a skills lab: linted, priced, and simulated ===\n")
    print_validation(skill, args.surface)
    print()
    print_cost(skill)
    print()
    simulate(skill, "add a changelog entry for the new export flag")
    print()
    print("run --test for assertions, --validate bad-skill for portable failures,")
    print("--surface anthropic for that profile, --budget 100 to price a listing, or")
    print("--entry \"Added: X\" to run the bundled validator.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
