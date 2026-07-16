#!/usr/bin/env python3
"""hybrid_lab.py --- solve one problem three ways: server only, skill only, hybrid.

The problem: produce the release notes for a version. It has an access half (reach
the commits merged since the last tag) and a judgment half (turn them into a clean,
categorized section). This lab runs each half alone, then together, so you can see
why neither is a release note on its own and why the production shape is both.

  --server-only   run just the connectivity layer. You get data, no judgment:
                  raw commits, unsorted, chores included. Access without judgment
                  is a faster way to make the same mistakes.
  --skill-only    run just the procedure layer, starved of access. The formatter
                  is correct and produces nothing, because it was never handed the
                  commits. Judgment without access is an expensive search engine.
  --hybrid        the skill orchestrates the server: fetch the commits over the
                  wire, then run the procedure on them. The complete answer.
  --decide        the decision framework in code: answer five questions about a
                  capability and get skill / server / both / neither, with reasons.
  --test          assertions; exits non-zero on failure.

No dependencies, no API key, no network. The "server" is a real separate process
(commit_server.py) the lab spawns and talks to over stdio; the "skill" is the real
folder release-notes/, whose bundled formatter the lab executes.
"""
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
SERVER = os.path.join(HERE, "commit_server.py")
FORMATTER = os.path.join(HERE, "release-notes", "scripts", "format_notes.py")

DIV = "-" * 68


# --------------------------------------------------------------------------- #
# talking to the server (the access layer, across a process boundary)
# --------------------------------------------------------------------------- #
class Server:
    """A spawned commit_server.py, addressed one JSON line at a time."""

    def __init__(self) -> None:
        self.proc = subprocess.Popen(
            [sys.executable, SERVER],
            stdin=subprocess.PIPE, stdout=subprocess.PIPE, text=True, bufsize=1,
        )
        self._id = 0

    def call(self, method: str, params: dict | None = None) -> dict:
        self._id += 1
        req = {"jsonrpc": "2.0", "id": self._id, "method": method}
        if params is not None:
            req["params"] = params
        assert self.proc.stdin and self.proc.stdout
        self.proc.stdin.write(json.dumps(req) + "\n")
        self.proc.stdin.flush()
        line = self.proc.stdout.readline()
        resp = json.loads(line)
        if "error" in resp:
            raise RuntimeError(resp["error"].get("message", "server error"))
        return resp["result"]

    def list_commits(self, tag: str) -> dict:
        return self.call("tools/call", {"name": "list_commits_since", "arguments": {"tag": tag}})

    def close(self) -> None:
        if self.proc.stdin:
            self.proc.stdin.close()
        self.proc.wait(timeout=5)


def run_formatter(commits_json: str, version: str | None = None) -> str:
    """Execute the skill's bundled formatter. Its source never matters here, only
    its stdout: this is level-three execution, the skill running deterministic code."""
    cmd = [sys.executable, FORMATTER]
    if version:
        cmd += ["--version", version]
    proc = subprocess.run(cmd, input=commits_json, capture_output=True, text=True)
    if proc.returncode != 0:
        raise RuntimeError(proc.stderr.strip() or "formatter failed")
    return proc.stdout


# --------------------------------------------------------------------------- #
# the three paths
# --------------------------------------------------------------------------- #
def server_only(tag: str) -> None:
    print("// SERVER ONLY --- the access layer, alone\n")
    srv = Server()
    try:
        result = srv.list_commits(tag)
    finally:
        srv.close()
    commits = result["commits"]
    print(f"list_commits_since({tag!r}) returned {len(commits)} commits from {result['head']}:\n")
    for c in commits:
        print(f"  {c['sha']}  {c['message']}")
    print()
    print(DIV)
    print("You have the data and nothing else: unsorted, uncategorized, chores and")
    print("docs mixed in with features. The connection was the easy part to automate")
    print("and the useless part to ship. Access without judgment.")


def skill_only(from_file: str | None) -> None:
    print("// SKILL ONLY --- the procedure layer, starved of access\n")
    if from_file:
        with open(from_file, "r", encoding="utf-8") as fh:
            payload = fh.read()
        print(f"Commits handed in by hand from {os.path.relpath(from_file, HERE)}:\n")
        print(run_formatter(payload))
        print(DIV)
        print("It works, but only because you fetched the commits yourself and pasted")
        print("them in. That is the missing MCP connection, done manually.")
        return
    # The real skill-only case: the procedure has no way to reach the commits.
    print("The skill has the formatting procedure but no way to reach the commits,")
    print("so it runs on the empty input it actually has:\n")
    print(run_formatter("", version="v0.4.0"))
    print(DIV)
    print("Correct, and empty. No instructions substitute for the missing connection.")
    print("Judgment without access is an expensive search engine.")


def hybrid(tag: str) -> None:
    print("// HYBRID --- the skill orchestrates the server\n")
    srv = Server()
    try:
        print(f"1. the skill calls the server tool: list_commits_since({tag!r})")
        result = srv.list_commits(tag)
    finally:
        srv.close()
    commits = result["commits"]
    print(f"   -> {len(commits)} commits fetched across the wire")
    print("2. the skill runs its bundled formatter on them (level-three execution)\n")
    notes = run_formatter(json.dumps(result))
    print(notes)
    print(DIV)
    print("The skill supplied the know-how; the server supplied the connection.")
    print("Notice what the procedure did that the raw data could not: dropped the")
    print("chore and docs and refactor commits, grouped the rest, ordered the")
    print("sections, and flagged the breaking security change. Both halves, layered.")


# --------------------------------------------------------------------------- #
# the decision framework, in code
# --------------------------------------------------------------------------- #
def classify(access: bool, judgment: bool, shared: bool,
             cli_or_existing: bool, live: bool) -> tuple[str, list[str]]:
    """Route a capability to skill / server / both / neither.

    access          the hard part is reaching a live external system, holding state,
                    or authenticating to a third party
    judgment        the hard part is knowing what to do: a workflow, a procedure,
                    domain expertise the agent lacks
    shared          the same capability must serve many agents or clients under
                    central governance
    cli_or_existing a CLI the agent can shell out to, or an existing server, already
                    provides the access
    live            the data changes between invocations and must be fetched fresh
    """
    if not (access or judgment or shared or live):
        return "neither", [
            "The agent can already do this in one step. Build nothing; if it forgets, "
            "a line in context is enough.",
        ]

    # Fresh data requires an access layer, not necessarily a newly built server. A
    # usable CLI or existing server can make that fetch. Central governance is the
    # exception: a local CLI does not create the shared, auditable server boundary.
    access_needed = access or live
    existing_access = access_needed and cli_or_existing
    server_needed = shared or (access_needed and not cli_or_existing)
    skill_needed = judgment or (existing_access and not shared)

    if server_needed and skill_needed:
        if shared and cli_or_existing:
            reasons = [
                "Judgment is hard, and shared governance still needs a server boundary. "
                "Reuse an existing shared server if it meets policy; otherwise adopt one, "
                "then layer a skill over it.",
            ]
        else:
            reasons = [
                "Both access and judgment are hard. Layer them: a server for the live "
                "connection, a skill that supplies the procedure and calls the server's tools.",
            ]
        if shared:
            reasons.append("Shared across clients under governance, which wants a server as the auditable chokepoint.")
        if live:
            reasons.append("The data changes between runs, so it must be fetched live, not written down once.")
        return "both", reasons

    if server_needed:
        if shared and cli_or_existing:
            reasons = [
                "Access may already exist, but shared governance still needs a server "
                "boundary. Reuse an existing shared server if it meets policy; otherwise "
                "adopt one.",
            ]
        else:
            reasons = [
                "The hard part is access to a live or shared system and no existing tool "
                "covers it. Build or adopt an MCP server.",
            ]
        if shared:
            reasons.append("It serves many clients with governance, which a server centralizes.")
        if live:
            reasons.append("The data changes between runs, so it must be fetched live.")
        return "server", reasons

    if existing_access:
        reasons = [
            "A CLI or existing server already provides the access. Wrap that access "
            "in a skill before building a server of your own.",
        ]
        if live:
            reasons.append("The existing access can fetch the fresh data; freshness does not require a second server.")
        if judgment:
            reasons.append("Add the procedure the agent lacks on top of the wrapped access.")
        return "skill", reasons

    return "skill", [
        "The agent can already reach what it needs; the hard part is knowing what to "
        "do with it. That is a skill.",
    ]


def decide(args: argparse.Namespace) -> None:
    verdict, reasons = classify(
        access=args.access, judgment=args.judgment, shared=args.shared,
        cli_or_existing=args.cli_exists, live=args.live,
    )
    inputs = {
        "access": args.access, "judgment": args.judgment, "shared": args.shared,
        "cli_or_existing": args.cli_exists, "live": args.live,
    }
    print("// DECIDE --- is the hard part access or judgment?\n")
    for k, v in inputs.items():
        print(f"  {k:<16} {'yes' if v else 'no'}")
    print()
    print(f"  => {verdict.upper()}")
    for r in reasons:
        print(f"     - {r}")


# --------------------------------------------------------------------------- #
# tests
# --------------------------------------------------------------------------- #
def run_tests() -> int:
    passed = failed = 0

    def check(desc: str, cond: bool) -> None:
        nonlocal passed, failed
        if cond:
            passed += 1
            print(f"  PASS  {desc}")
        else:
            failed += 1
            print(f"  FAIL  {desc}")

    print("// tests\n")

    # the decision framework routes the canonical cases
    check("both when access and judgment are both hard",
          classify(True, True, False, False, True)[0] == "both")
    check("server when access is hard and no existing tool, no judgment",
          classify(True, False, False, False, True)[0] == "server")
    check("skill wraps a CLI when access exists via a CLI",
          classify(True, False, False, True, False)[0] == "skill")
    check("skill wraps a CLI that can fetch live data",
          classify(True, False, False, True, True)[0] == "skill")
    check("skill adds procedure over existing live access",
          classify(True, True, False, True, True)[0] == "skill")
    check("skill when only judgment is hard",
          classify(False, True, False, False, False)[0] == "skill")
    check("neither when nothing is hard",
          classify(False, False, False, False, False)[0] == "neither")
    check("shared capability forces a server even with judgment (both)",
          classify(False, True, True, False, False)[0] == "both")
    check("shared governance still needs a server when a local CLI exists",
          classify(True, False, True, True, False)[0] == "server")

    # the server (access layer) returns commits across the process boundary
    srv = Server()
    try:
        tools = srv.call("tools/list")["tools"]
        check("server advertises list_commits_since", any(t["name"] == "list_commits_since" for t in tools))
        result = srv.list_commits("v0.3.0")
        try:
            srv.list_commits("does-not-exist")
        except RuntimeError as exc:
            unsupported_tag_rejected = "unsupported tag" in str(exc)
        else:
            unsupported_tag_rejected = False
    finally:
        srv.close()
    check("server returns commits for its supported fixture range",
          result["since_tag"] == "v0.3.0" and len(result["commits"]) >= 1)
    check("server rejects unsupported fixture tags", unsupported_tag_rejected)
    unsupported_cli = subprocess.run(
        [sys.executable, os.path.join(HERE, "hybrid_lab.py"), "--server-only", "--tag", "does-not-exist"],
        capture_output=True, text=True,
    )
    check("CLI visibly rejects unsupported fixture tags",
          unsupported_cli.returncode != 0 and "unsupported tag" in unsupported_cli.stderr)

    # the skill (procedure layer) starved of access produces nothing
    starved = run_formatter("", version="v0.4.0")
    check("skill-only output has no populated sections", "###" not in starved)
    check("skill-only output states there are no changes", "No user-facing changes" in starved)

    # the hybrid produces real, categorized notes
    notes = run_formatter(json.dumps(result))
    check("hybrid output has an Added section", "### Added" in notes)
    check("hybrid keeps the export feature", "--export flag" in notes)
    check("hybrid keeps a fix under Fixed", "### Fixed" in notes)
    check("hybrid drops the chore commit", "vite" not in notes)
    check("hybrid drops the docs commit", "install steps" not in notes.lower())
    check("hybrid flags the breaking security change",
          "### Security" in notes and "**Breaking:**" in notes)
    check("hybrid orders Added before Fixed",
          notes.index("### Added") < notes.index("### Fixed"))

    print(f"\n{passed} passed, {failed} failed")
    return 0 if failed == 0 else 1


# --------------------------------------------------------------------------- #
# cli
# --------------------------------------------------------------------------- #
def main(argv: list[str]) -> int:
    ap = argparse.ArgumentParser(description="Solve one problem three ways: server, skill, hybrid.")
    ap.add_argument("--tag", default="v0.3.0", help="fetch fixture commits since its supported tag (v0.3.0)")
    mode = ap.add_mutually_exclusive_group()
    mode.add_argument("--server-only", action="store_true", help="run the access layer alone")
    mode.add_argument("--skill-only", action="store_true", help="run the procedure layer alone, starved of access")
    mode.add_argument("--hybrid", action="store_true", help="the skill orchestrates the server (the production shape)")
    mode.add_argument("--decide", action="store_true", help="route a capability to skill / server / both / neither")
    mode.add_argument("--test", action="store_true", help="run assertions and exit non-zero on failure")
    ap.add_argument("--from", dest="from_file", metavar="FILE", help="with --skill-only, hand the skill commits from a file")
    # flags for --decide
    ap.add_argument("--access", action="store_true", help="[decide] the hard part is reaching a live/external system")
    ap.add_argument("--judgment", action="store_true", help="[decide] the hard part is knowing what to do")
    ap.add_argument("--shared", action="store_true", help="[decide] shared across many clients with governance")
    ap.add_argument("--cli-exists", action="store_true", help="[decide] a CLI or existing server already provides access")
    ap.add_argument("--live", action="store_true", help="[decide] the data changes between invocations")
    args = ap.parse_args(argv[1:])

    # --from is a rider on --skill-only, not its own mode. Reject it against the other
    # modes loudly, the way the mutually-exclusive group already rejects clashing modes,
    # instead of silently running skill-only.
    if args.from_file and (args.server_only or args.hybrid or args.decide or args.test):
        ap.error("--from can only be used with --skill-only")

    try:
        if args.test:
            return run_tests()
        if args.server_only:
            server_only(args.tag)
            return 0
        if args.skill_only or args.from_file:
            skill_only(args.from_file)
            return 0
        if args.hybrid:
            hybrid(args.tag)
            return 0
        if args.decide:
            decide(args)
            return 0

        # default: run all three paths in order, then the decision for this problem
        print("=== one problem, three ways: release notes for a version ===\n")
        server_only(args.tag)
        print("\n" + DIV + "\n")
        skill_only(None)
        print("\n" + DIV + "\n")
        hybrid(args.tag)
        print("\n" + DIV + "\n")
        print("This problem needs both, so it lands on 'both':\n")
        decide(argparse.Namespace(access=True, judgment=True, shared=False, cli_exists=False, live=True))
        print("\nrun --test for assertions, or --decide with the five flags to classify your own capability.")
        return 0
    except RuntimeError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
