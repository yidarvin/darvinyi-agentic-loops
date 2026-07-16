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
     in a regular Claude Code session, then contrast it with a subagent whose
     named skills are preloaded at startup.
  3. Simulate discovery with an intentionally crude keyword proxy. It illustrates
     the loading path but cannot establish how a production model will trigger.

No third-party packages, API key, or network are required. Python 3.9+ is required;
Bash is required for the fresh-install smoke test and ``check.sh``. Token counts are
estimates (~4 characters per token), and the discovery match is a two-keyword proxy rather
than a production harness. The parser handles this artifact's strict plain or basic quoted
mappings, two-space continuations, and folded or literal block scalars. It rejects
unsupported YAML collections, top-level syntax, non-printing frontmatter characters, and
plain YAML forms that resolve to non-string values, rather than pretending to validate them.

Usage:
    python3 skills_lab.py                              # overview of the bundled skill
    python3 skills_lab.py --validate DIR               # supported portable-subset lint
    python3 skills_lab.py --validate DIR --surface anthropic
    python3 skills_lab.py --budget 100                 # regular-session listing cost
    python3 skills_lab.py --budget 3 --session preloaded
    python3 skills_lab.py --simulate "..."              # illustrative discovery path
    python3 skills_lab.py --simulate "..." --session preloaded
    python3 skills_lab.py --entry-file PATH              # run the bundled validator safely
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
# YAML requires separation space after a mapping colon when a value follows it.
# Keep this teaching subset stricter than a general parser: an empty value may end at
# the colon, but `name:foo` is never treated as a key-value mapping.
KEY_LINE = re.compile(r"^([A-Za-z][A-Za-z0-9_-]*):(?: +(.*))?$")
BLOCK_SCALAR_HEADER = re.compile(r"[>|]")
UNSUPPORTED_PLAIN_PREFIX = re.compile(
    r"^(?:[!&*]|[>|]|\[|\{|\]|\}|,|@|`|%|[-?:](?:\s|$))"
)
INLINE_COMMENT = re.compile(r"(?:^|\s)#")
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
    r"|0[xo][0-9a-fA-F_]+$"
    r"|0b[01_]+$",
    re.IGNORECASE,
)
YAML_DATE_OR_TIMESTAMP = re.compile(
    r"\d{4}-\d{2}-\d{2}(?:[Tt ]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?: ?(?:Z|[+-]\d{2}:?\d{2}))?)?$"
)


# --------------------------------------------------------------------------- #
# parsing
# --------------------------------------------------------------------------- #
def strip_yaml_comment(value: str) -> str:
    """Remove a YAML inline comment from an unquoted scalar or block header."""
    return INLINE_COMMENT.split(value, maxsplit=1)[0].rstrip()


def has_tab_indentation(line: str) -> bool:
    """YAML indentation uses spaces; a leading tab is unsupported in this subset."""
    indentation = line[: len(line) - len(line.lstrip(" \t"))]
    return "\t" in indentation


def has_unsupported_control(text: str) -> bool:
    """Reject non-printing raw frontmatter characters except structural line endings."""
    return any(
        not char.isprintable() and char not in "\n\r"
        for char in text
    )


def has_non_printing_scalar(text: str) -> bool:
    """Reject decoded scalar characters that cannot appear visibly in frontmatter."""
    return any(not char.isprintable() for char in text)


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
        value = strip_yaml_comment(value)
        if not value:
            return ""

        clear_digit_led_name = (
            key == "name"
            and VALID_NAME.fullmatch(value) is not None
            and any(char.isalpha() or char == "-" for char in value)
        )
        if (
            (not value[0].isascii() or not value[0].isalpha())
            and not clear_digit_led_name
        ) or UNSUPPORTED_PLAIN_PREFIX.match(value):
            errors.append(
                f"{key} has unsupported plain-scalar YAML syntax; quote it as a string"
            )
            return value

        lowered = value.casefold()
        if (
            lowered in {"~", "null", "true", "false", "yes", "no", "on", "off", "y", "n"}
            or YAML_NUMBER.fullmatch(value)
            or YAML_DATE_OR_TIMESTAMP.fullmatch(value)
        ):
            errors.append(
                f"{key} has a YAML non-string scalar; quote it as a string"
            )
            return ""
        if re.search(r":(?:\s|$)", value):
            errors.append(
                f"{key} has unsupported plain-scalar YAML syntax; quote it as a string"
            )
            return value
        return value
    if value[0] == "'":
        if len(value) < 2 or not value.endswith("'"):
            errors.append(f"{key} has an unterminated single-quoted scalar")
            return value
        inner = value[1:-1]
        # YAML escapes a literal apostrophe by doubling it. Reject any lone quote
        # rather than accepting a malformed scalar as this subset's clean result.
        if "'" in inner.replace("''", ""):
            errors.append(f"{key} has invalid single-quoted scalar syntax")
            return value
        return inner.replace("''", "'")
    try:
        parsed = json.loads(value)
    except json.JSONDecodeError:
        errors.append(f"{key} has unsupported or invalid double-quoted scalar syntax")
        return value
    if not isinstance(parsed, str):
        errors.append(f"{key} must be a string scalar")
        return value
    if any(0xD800 <= ord(char) <= 0xDFFF for char in parsed):
        errors.append(f"{key} has an invalid Unicode surrogate escape")
        return value
    if has_non_printing_scalar(parsed):
        errors.append(
            f"{key} has a non-printing character; this teaching lint accepts printable scalar values only"
        )
        return parsed
    return parsed


def parse_frontmatter(text: str):
    """Split a SKILL.md into (meta, body, has_frontmatter).

    A minimal YAML reader: enough for letter-led plain or basic quoted scalar mappings,
    two-space plain continuations, and bare folded (``>``) or literal (``|``) block
    scalars with two-space content used by this bundle. It is deliberately not a general
    YAML implementation or complete schema parser.
    """
    preflight_errors = []
    opening = re.match(r"\A---\r?\n", text)
    closing = (
        re.compile(r"^---\r?$", re.MULTILINE).search(text, opening.end())
        if opening
        else None
    )
    # Scan the raw frontmatter slice before splitlines() can reinterpret a forbidden
    # control byte as a line boundary. The Markdown body is intentionally outside this
    # frontmatter lint.
    if closing and has_unsupported_control(text[opening.end():closing.start()]):
        preflight_errors.append(
            "unsupported control character; this teaching lint accepts printable frontmatter only"
        )

    lines = text.splitlines()
    if not lines or lines[0] != "---":
        return {}, text, False, preflight_errors
    end = None
    for i in range(1, len(lines)):
        if lines[i] == "---":
            end = i
            break
    if end is None:
        return {}, text, False, preflight_errors

    frontmatter = lines[1:end]
    meta: dict[str, str] = {}
    parse_errors: list[str] = preflight_errors
    key: Optional[str] = None
    allows_plain_continuation = False
    i = 0
    while i < len(frontmatter):
        line = frontmatter[i]
        if has_tab_indentation(line):
            parse_errors.append(
                "tab indentation is unsupported YAML syntax; this teaching lint accepts space indentation only"
            )
            i += 1
            continue
        match = KEY_LINE.match(line)
        if match and not line[:1].isspace():
            key = match.group(1)
            value = (match.group(2) or "").strip()
            allows_plain_continuation = False
            if key in meta:
                parse_errors.append(
                    f"duplicate top-level field {key!r}; this teaching lint accepts each field once"
                )
            block_header = strip_yaml_comment(value)
            if BLOCK_SCALAR_HEADER.fullmatch(block_header):
                style = block_header[0]
                block: list[str] = []
                i += 1
                while i < len(frontmatter) and (
                    not frontmatter[i].strip() or frontmatter[i][:1].isspace()
                ):
                    block_line = frontmatter[i]
                    if has_tab_indentation(block_line):
                        parse_errors.append(
                            "tab indentation is unsupported YAML syntax; this teaching lint accepts space indentation only"
                        )
                    elif block_line.strip():
                        # This small parser accepts the artifact's two-space block
                        # indentation only. More or less indentation might be valid
                        # YAML in another context, but is unsupported here and must
                        # not receive a clean result.
                        indentation = len(block_line) - len(block_line.lstrip(" "))
                        if indentation != 2:
                            parse_errors.append(
                                "block scalar content must use two-space indentation in this teaching subset"
                            )
                        else:
                            block.append(block_line[2:])
                    else:
                        block.append("")
                    i += 1
                if style == ">":
                    meta[key] = " ".join(part for part in block if part).strip()
                else:
                    meta[key] = "\n".join(block).strip()
                key = None
                continue
            meta[key] = parse_scalar(value, key, parse_errors)
            # Only an unquoted plain scalar may continue on indented lines in this
            # subset. YAML quoted scalars need their closing quote on the same line;
            # treating a following indented line as continuation would accept malformed
            # frontmatter as clean.
            allows_plain_continuation = (
                bool(meta[key])
                and not value.startswith(("'", '"'))
                and not INLINE_COMMENT.search(value)
            )
        elif key is not None and line[:1].isspace():
            indentation = len(line) - len(line.lstrip(" "))
            continuation = line[indentation:].strip()
            if not continuation or continuation.startswith("#"):
                pass
            elif indentation != 2:
                parse_errors.append(
                    f"{key} has unsupported indentation; this teaching lint accepts two-space plain continuations only"
                )
            elif not allows_plain_continuation:
                parse_errors.append(
                    f"{key} has unsupported nested YAML syntax; keep scalar values on the key line"
                )
            elif (
                not continuation[0].isascii()
                or not continuation[0].isalpha()
                or continuation.startswith(("'", '"', "- ", "? ", ": ", "[", "{", "!", "&", "*", ">", "|", ",", "]", "}", "%", "@", "`"))
                or re.search(r":(?:\s|$)", continuation)
            ):
                parse_errors.append(
                    f"{key} has unsupported nested YAML syntax; this teaching lint accepts plain scalar continuations only"
                )
            else:
                meta[key] = (meta[key] + " " + strip_yaml_comment(continuation)).strip()
                if INLINE_COMMENT.search(continuation):
                    allows_plain_continuation = False
        elif line.strip() and not line.lstrip().startswith("#"):
            parse_errors.append(
                "unsupported top-level YAML syntax; this teaching lint accepts top-level key-value fields only"
            )
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

    for detail in skill.get("parse_errors", []):
        errors.append(("P0", detail))

    if not skill["has_fm"]:
        errors.append(("P1", "no YAML frontmatter (the file must open with a --- fence)"))
        return errors, warnings

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


def print_cost(skill, session: str = "regular") -> None:
    cost = cost_model(skill)
    print("// progressive-disclosure cost (token estimates, ~4 chars/token)")
    if session == "preloaded":
        print(f"  startup  SKILL.md body                  ~{cost['level2']:>5} tokens   configured preloaded subagent: full skill content")
        print(f"  contrast regular-session metadata        ~{cost['level1']:>5} tokens   listed, model-invocable skill")
        print("  regular  full body loads only after a first, distinct, or changed rendering")
    else:
        print(f"  level 1  metadata (name + description)  ~{cost['level1']:>5} tokens   listed, model-invocable")
        print(f"  level 2  SKILL.md body                  ~{cost['level2']:>5} tokens   regular Claude Code session: first/distinct/changed render; identical re-invocation gets a short note")
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
    if session == "preloaded":
        print("  note     level-3 resources remain on demand after preloading")
    else:
        print("  note     user-only manual skills are absent from regular-session startup context")


def print_budget(skill, count: int, session: str = "regular") -> None:
    if count < 0:
        raise ValueError("budget count must be zero or greater")
    cost = cost_model(skill)
    level1 = cost["level1"]
    startup = level1 * count
    eager_bodies = cost["level2"] * count
    if session == "preloaded":
        print(f"// startup budget for {count} skills preloaded into a Claude Code subagent")
        print(f"  full skill bodies at startup:         ~{eager_bodies:,} tokens  ({cost['level2']} body tokens each)")
        print(f"  regular-session metadata contrast:    ~{startup:,} tokens  ({level1} metadata tokens each)")
        print("  preloading is a configured subagent exception, not the regular-session lifecycle")
        return
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


def simulate(skill, request: str, session: str = "regular") -> bool:
    meta, body = skill["meta"], skill["body"]
    description = meta.get("description", "")
    description_terms = set(keywords(description))
    overlap = sorted({word for word in keywords(request) if word in description_terms})
    triggered = len(overlap) >= 2

    print(f"// illustrative discovery proxy for: {request!r}")
    print(f"  request keywords overlap description on: {overlap or '(none)'}")
    if session == "preloaded":
        print(f"  preloaded-subagent mode: {os.path.basename(skill['dir'])}/SKILL.md full content was injected at startup")
        print("  no trigger or read is needed for this named skill; level-3 resources remain on demand")
        for rel in sorted(set(REF_PATH.findall(body))):
            if rel.startswith("scripts/"):
                print(f"     level 3  executes {rel}; output enters context while source can stay on disk")
            else:
                print(f"     level 3  reads {rel}; its contents enter context at that point")
        return True
    if not triggered:
        print("  => below this proxy's threshold; only listed metadata is modeled as loaded")
        print("     (a real model also weighs task difficulty, wording, and its target harness)")
        return False
    print("  => this proxy triggers. possible loading sequence:")
    print(f"     level 1  already listed: name + description (~{est_tokens(description)} description tokens)")
    print(f"     level 2  reads {os.path.basename(skill['dir'])}/SKILL.md (~{est_tokens(body)} tokens); regular Claude Code session: first/distinct/changed render, identical re-invocation gets a short note")
    for rel in sorted(set(REF_PATH.findall(body))):
        if rel.startswith("scripts/"):
            print(f"     level 3  executes {rel}; output enters context while source can stay on disk")
        else:
            print(f"     level 3  reads {rel}; its contents enter context at that point")
    return True


def validator_path(skill) -> str:
    return os.path.join(skill["dir"], "scripts", "validate_entry.py")


def run_entry_file(skill, candidate_path: str) -> int:
    """Run the validator with a candidate file, keeping data out of shell source."""
    script = validator_path(skill)
    if not os.path.isfile(script):
        print(f"no bundled validator at {script}")
        return 1
    try:
        with open(candidate_path, "r", encoding="utf-8", newline="") as candidate:
            proc = subprocess.run(["python3", script], stdin=candidate, capture_output=True, text=True)
    except OSError as exc:
        print(f"cannot read candidate file {candidate_path!r}: {exc}")
        return 1
    output = (proc.stdout + proc.stderr).strip()
    print(f"// runs python3 {script!r} < {candidate_path!r}")
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

    malformed_meta, malformed_body, malformed_frontmatter, malformed_parse_errors = parse_frontmatter(
        "---\nname: malformed-frontmatter\ndescription: Formats a thing. Use when needed.\nthis is not YAML\n---\n# Body"
    )
    malformed_skill = {
        "meta": malformed_meta,
        "body": malformed_body,
        "has_fm": malformed_frontmatter,
        "parse_errors": malformed_parse_errors,
        "dir": os.path.join(HERE, "malformed-frontmatter"),
    }
    malformed_errors, _ = validate_skill(malformed_skill)
    check("unsupported top-level YAML syntax trips P0", "P0" in codes(malformed_errors))

    def public_validate_document(
        document: str, directory_name: str = "supported-skill"
    ) -> subprocess.CompletedProcess[str]:
        """Exercise the public validator with an arbitrary temporary SKILL.md."""
        with tempfile.TemporaryDirectory(prefix="skills-lab-public-validator-") as temp_dir:
            skill_dir = os.path.join(temp_dir, directory_name)
            os.mkdir(skill_dir)
            with open(os.path.join(skill_dir, "SKILL.md"), "w", encoding="utf-8") as fh:
                fh.write(document)
            return run_lab_quiet("--validate", skill_dir)

    def public_validate(frontmatter: str) -> subprocess.CompletedProcess[str]:
        """Exercise the public validator with a name matching its temp directory."""
        return public_validate_document(
            "---\n"
            "name: supported-skill\n"
            + frontmatter
            + "---\n"
            "# Body\n"
        )

    def check_public_p0(label: str, frontmatter: str) -> None:
        result = public_validate(frontmatter)
        check(
            label,
            result.returncode != 0 and "ERROR P0" in result.stdout,
        )

    malformed_cli = public_validate(
        "description: Formats entries: Use when adding one.\n"
    )
    check(
        "malformed plain YAML scalar fails through the public validator",
        malformed_cli.returncode != 0 and "ERROR P0" in malformed_cli.stdout,
    )
    no_space_mapping_cli = public_validate(
        "name:supported-skill\n"
        "description: Formats entries. Use when adding one.\n"
    )
    check(
        "no-space YAML mapping fails through the public validator",
        no_space_mapping_cli.returncode != 0 and "ERROR P0" in no_space_mapping_cli.stdout,
    )
    quoted_continuation_cli = public_validate(
        "description: 'Formats entries.'\n"
        "  Use when adding one.\n"
    )
    check(
        "quoted scalar continuation fails through the public validator",
        quoted_continuation_cli.returncode != 0 and "ERROR P0" in quoted_continuation_cli.stdout,
    )
    malformed_single_quote_cli = public_validate(
        "description: 'It's a formatter. Use when adding one.'\n"
    )
    check(
        "malformed single-quoted scalar fails through the public validator",
        malformed_single_quote_cli.returncode != 0 and "ERROR P0" in malformed_single_quote_cli.stdout,
    )
    escaped_single_quote_cli = public_validate(
        "description: 'It''s a formatter. Use when adding one.'\n"
    )
    check(
        "escaped single-quoted scalar stays supported",
        escaped_single_quote_cli.returncode == 0
        and "clean: passes this lab's checked subset" in escaped_single_quote_cli.stdout,
    )
    digit_led_name_cli = public_validate_document(
        "---\n"
        "name: 1-skill\n"
        "description: Formats entries. Use when adding one.\n"
        "---\n"
        "# Body\n",
        "1-skill",
    )
    check(
        "clear digit-led ASCII name stays supported",
        digit_led_name_cli.returncode == 0
        and "clean: passes this lab's checked subset" in digit_led_name_cli.stdout,
    )
    uneven_block_indent_cli = public_validate(
        "description: >\n"
        "   Formats entries.\n"
        "  Use when adding one.\n"
    )
    check(
        "uneven block indentation fails through the public validator",
        uneven_block_indent_cli.returncode != 0 and "ERROR P0" in uneven_block_indent_cli.stdout,
    )
    inline_comment_continuation_cli = public_validate(
        "description: Formats entries. # note\n"
        "  Use when adding one.\n"
    )
    check(
        "plain scalar continuation after an inline comment fails through the public validator",
        inline_comment_continuation_cli.returncode != 0 and "ERROR P0" in inline_comment_continuation_cli.stdout,
    )
    dotted_nested_cli = public_validate(
        "description: Formats entries.\n"
        "  nested.key: Use when adding one.\n"
    )
    check(
        "dotted nested mapping fails through the public validator",
        dotted_nested_cli.returncode != 0 and "ERROR P0" in dotted_nested_cli.stdout,
    )
    check_public_p0(
        "legacy octal-looking YAML number fails through the public validator",
        "description: 0123\n",
    )
    check_public_p0(
        "timestamp-looking YAML scalar fails through the public validator",
        "description: 2026-07-16T12:34:56 +00\n",
    )
    control_character_cli = public_validate(
        "description: Formats\x07 entries. Use when adding one.\n"
    )
    check(
        "control character fails through the public validator",
        control_character_cli.returncode != 0 and "ERROR P0" in control_character_cli.stdout,
    )
    splitline_control_cli = public_validate(
        "description: Formats entries.\x0b  Use when adding one.\n"
    )
    check(
        "line-splitting control character fails through the public validator",
        splitline_control_cli.returncode != 0 and "ERROR P0" in splitline_control_cli.stdout,
    )
    lone_surrogate_cli = public_validate(
        'description: "Formats entries. Use when adding \\uD800 one."\n'
    )
    check(
        "lone Unicode surrogate escape fails through the public validator",
        lone_surrogate_cli.returncode != 0 and "ERROR P0" in lone_surrogate_cli.stdout,
    )
    escaped_bell_cli = public_validate(
        'description: "Formats\\u0007 entries. Use when adding one."\n'
    )
    check(
        "escaped BEL scalar fails through the public validator",
        escaped_bell_cli.returncode != 0
        and "ERROR P0" in escaped_bell_cli.stdout
        and "clean:" not in escaped_bell_cli.stdout,
    )
    escaped_c1_cli = public_validate(
        'description: "Formats\\u0085 entries. Use when adding one."\n'
    )
    check(
        "escaped C1 scalar fails through the public validator",
        escaped_c1_cli.returncode != 0
        and "ERROR P0" in escaped_c1_cli.stdout
        and "clean:" not in escaped_c1_cli.stdout,
    )
    indented_open_fence_cli = public_validate_document(
        "  ---\n"
        "name: supported-skill\n"
        "description: Formats entries. Use when adding one.\n"
        "  ---\n"
    )
    check(
        "indented opening fence cannot produce a clean result",
        indented_open_fence_cli.returncode != 0 and "ERROR P1" in indented_open_fence_cli.stdout,
    )
    indented_block_fence_cli = public_validate_document(
        "---\n"
        "name: supported-skill\n"
        "description: >\n"
        "  Formats entries.\n"
        "  ---\n"
        "this is not YAML\n"
        "---\n"
        "# Body\n"
    )
    check(
        "indented block fence cannot close frontmatter early",
        indented_block_fence_cli.returncode != 0 and "ERROR P0" in indented_block_fence_cli.stdout,
    )
    body_tab_cli = public_validate_document(
        "---\n"
        "name: supported-skill\n"
        "description: Formats entries. Use when adding one.\n"
        "---\n"
        "# Body\n"
        "\tA literal tab belongs to the Markdown body, not frontmatter.\n"
    )
    check(
        "Markdown-body tabs do not affect frontmatter validation",
        body_tab_cli.returncode == 0
        and "clean: passes this lab's checked subset" in body_tab_cli.stdout,
    )
    for style in (">", "|"):
        block_comment_cli = public_validate(
            f"description: {style} # supported YAML block comment\n"
            "  Formats entries.\n"
            "  Use when adding one.\n"
        )
        check(
            f"{style} block scalar with a header comment stays supported",
            block_comment_cli.returncode == 0
            and "clean: passes this lab's checked subset" in block_comment_cli.stdout,
        )
    check_public_p0(
        "block scalar modifiers fail through the public validator",
        "description: >-\n  Formats entries. Use when adding one.\n",
    )
    for label, scalar in (
        ("YAML anchor", "&summary Formats entries. Use when adding one."),
        ("YAML tag", "!summary Formats entries. Use when adding one."),
        ("YAML alias", "*summary"),
    ):
        check_public_p0(
            f"unsupported {label} fails through the public validator",
            f"description: {scalar}\n",
        )
    duplicate_cli = public_validate(
        "description: Formats entries. Use when adding one.\n"
        "description: Another description. Use when adding one.\n"
    )
    check(
        "duplicate top-level fields fail through the public validator",
        duplicate_cli.returncode != 0 and "ERROR P0" in duplicate_cli.stdout,
    )
    comment_only_nested_cli = public_validate("description:\n  # comment only\n")
    check(
        "comment-only nested description stays empty",
        comment_only_nested_cli.returncode != 0 and "ERROR P6" in comment_only_nested_cli.stdout,
    )
    continuation_comment_cli = public_validate(
        "description: Formats entries.\n"
        "  # Use when adding one.\n"
    )
    check(
        "plain-scalar continuation comments do not suppress a missing-when warning",
        continuation_comment_cli.returncode == 0 and "warn  W2" in continuation_comment_cli.stdout,
    )
    check_public_p0(
        "tab-indented YAML fails through the public validator",
        "description: Formats entries.\n\tUse when adding one.\n",
    )
    check_public_p0(
        "nested quoted scalar fails through the public validator",
        "description:\n  \"Formats entries. Use when adding one.\"\n",
    )
    for label, scalar in (
        ("malformed block header", "> Formats entries. Use when adding one."),
        ("sequence indicator", "- Formats entries. Use when adding one."),
        ("mapping indicator", "? Formats entries. Use when adding one."),
        ("reserved comma indicator", ", Formats entries. Use when adding one."),
        ("reserved closing-bracket indicator", "] Formats entries. Use when adding one."),
        ("reserved percent indicator", "% Formats entries. Use when adding one."),
    ):
        check_public_p0(
            f"unsupported {label} fails through the public validator",
            f"description: {scalar}\n",
        )
    for label, scalar in (
        ("legacy YAML boolean", "yes"),
        ("binary YAML number", "0b101"),
        ("YAML date", "2026-07-16"),
    ):
        check_public_p0(
            f"non-string {label} fails through the public validator",
            f"description: {scalar}\n",
        )

    zero_budget = run_lab_quiet("--budget", "0")
    check("zero budget remains valid", zero_budget.returncode == 0)
    negative_budget = run_lab_quiet("--budget", "-1")
    check(
        "negative budget returns a clear nonzero error",
        negative_budget.returncode != 0 and "must be zero or greater" in negative_budget.stderr,
    )
    preloaded_budget = run_lab_quiet("--budget", "2", "--session", "preloaded")
    check(
        "preloaded-subagent budget prices full bodies at startup",
        preloaded_budget.returncode == 0 and "full skill bodies at startup" in preloaded_budget.stdout,
    )
    preloaded_overview = run_lab_quiet("--session", "preloaded")
    check(
        "preloaded-subagent overview separates full-body startup from regular metadata",
        preloaded_overview.returncode == 0 and "contrast regular-session metadata" in preloaded_overview.stdout,
    )
    preloaded_simulation = run_lab_quiet(
        "--simulate", "add a changelog entry for the export flag", "--session", "preloaded"
    )
    check(
        "preloaded-subagent simulation skips the regular trigger path",
        preloaded_simulation.returncode == 0 and "full content was injected at startup" in preloaded_simulation.stdout,
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
        terminal_control = "Added: \x1b[2Jterminal-control"
        terminal_control_validator = subprocess.run(
            ["python3", validator_path(good)],
            input=terminal_control,
            capture_output=True,
            text=True,
        )
        check(
            "validator rejects terminal-control input without echoing it",
            terminal_control_validator.returncode == 1
            and "\x1b" not in (
                terminal_control_validator.stdout + terminal_control_validator.stderr
            )
            and "OK:" not in terminal_control_validator.stdout,
        )
        with tempfile.NamedTemporaryFile(
            mode="w",
            encoding="utf-8",
            newline="",
            prefix="skills-lab-terminal-control-",
        ) as candidate:
            candidate.write(terminal_control)
            candidate.flush()
            terminal_control_relay = run_lab_quiet("--entry-file", candidate.name)
        check(
            "entry-file keeps terminal-control input out of relay output and the write gate",
            terminal_control_relay.returncode != 0
            and "\x1b" not in (
                terminal_control_relay.stdout + terminal_control_relay.stderr
            )
            and "OK:" not in terminal_control_relay.stdout,
        )
        bash_available = shutil.which("bash") is not None
        check("Bash is available for the documented install and check workflows", bash_available)
        if bash_available:
            installed = run_installed_workflow_quiet(good, "Added: root-aware path")
            check("root-aware installed command works outside the skill directory", installed.returncode == 0)
            literal_shell_syntax = run_installed_workflow_quiet(good, "Added: $(printf injected)")
            check(
                "installed stdin workflow preserves literal shell syntax without executing it",
                literal_shell_syntax.returncode == 0
                and "OK: Added: $(printf injected)" in literal_shell_syntax.stdout,
            )
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
    proc = subprocess.run(["python3", validator_path(skill)], input=entry, capture_output=True, text=True)
    return proc.returncode


def run_entry_stdin_quiet(skill, entry: str) -> int:
    proc = subprocess.run(
        ["python3", validator_path(skill)], input=entry, capture_output=True, text=True
    )
    return proc.returncode


def run_installed_workflow_quiet(skill, entry: str) -> subprocess.CompletedProcess:
    """Exercise the documented root-aware stdin path outside the skill directory."""
    with tempfile.NamedTemporaryFile(
        mode="w", encoding="utf-8", newline="", prefix="skills-lab-candidate-"
    ) as candidate:
        candidate.write(entry + "\n")
        candidate.flush()
        env = os.environ.copy()
        env["CLAUDE_SKILL_DIR"] = skill["dir"]
        return subprocess.run(
            [
                "bash",
                "-c",
                'python3 "$CLAUDE_SKILL_DIR/scripts/validate_entry.py" < "$1"',
                "skills-lab",
                candidate.name,
            ],
            cwd=os.path.dirname(HERE),
            env=env,
            capture_output=True,
            text=True,
        )


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
        return run_installed_workflow_quiet(installed, entry).returncode


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
    parser.add_argument("--skill", metavar="DIR", default=DEFAULT_SKILL, help="skill used by --budget, --simulate, or --entry-file")
    parser.add_argument("--budget", metavar="N", type=nonnegative_int, help="print the startup cost of N listed skills")
    parser.add_argument(
        "--session",
        choices=("regular", "preloaded"),
        default="regular",
        help="Claude Code lifecycle to model: regular session or a subagent with named skills preloaded",
    )
    parser.add_argument("--simulate", metavar="REQUEST", help="illustrate discovery for a request string")
    parser.add_argument("--entry-file", metavar="PATH", help="run the bundled validator with literal entry data from a file")
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
        print_budget(skill, args.budget, args.session)
        return 0
    if args.simulate is not None:
        simulate(skill, args.simulate, args.session)
        return 0
    if args.entry_file is not None:
        return 0 if run_entry_file(skill, args.entry_file) == 0 else 1

    print("=== a skills lab: linted, priced, and simulated ===\n")
    print_validation(skill, args.surface)
    print()
    print_cost(skill, args.session)
    print()
    simulate(skill, "add a changelog entry for the new export flag", args.session)
    print()
    print("run --test for assertions, --validate bad-skill for portable failures,")
    print("--surface anthropic for that profile, --budget 100 to price a listing, or")
    print("--entry-file PATH to run the bundled validator without putting candidate text in shell source.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
