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
  --decide        the decision framework in code: answer seven questions about a
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
def classify(access: bool, judgment: bool, shared_access: bool,
             cli_or_existing: bool, live: bool,
             script_access: bool = False,
             skill_distributed: bool = False) -> tuple[str, list[str]]:
    """Route a capability to skill / server / both / neither.

    access          the hard part is reaching a live external system, holding state,
                    or authenticating to a third party
    judgment        the hard part is knowing what to do: a workflow, a procedure,
                    domain expertise the agent lacks
    shared_access   a new reusable access adapter remains missing and must serve
                    many agents or clients under central governance
    cli_or_existing a CLI the agent can shell out to, or an existing server, already
                    provides the access
    live            the data changes between invocations and must be fetched fresh
    script_access   a workflow-local Skill script can use runtime-provided network
                    access and credentials; it is not a shared server boundary
    skill_distributed
                    the Skill itself will be centrally provisioned or managed for
                    many agents; that governs instruction distribution, not access
    """
    distribution_note = (
        "Central Skill provisioning governs instruction distribution; it does not "
        "create a shared access boundary."
    )

    def with_distribution(reasons: list[str]) -> list[str]:
        return reasons + [distribution_note] if skill_distributed else reasons

    if not (access or judgment or shared_access or live):
        return "neither", with_distribution([
            "The agent can already do this in one step. Build nothing; if it forgets, "
            "a line in context is enough.",
        ])

    # Fresh data requires a path to the system, not necessarily a server. An existing
    # CLI or server can make the fetch. A Skill can also bundle a workflow-local
    # script when its runtime supplies network access and credentials. A centrally
    # distributed Skill is still instruction. Only an unmet shared or reusable *access*
    # adapter creates the server axis.
    access_needed = access or live or shared_access
    existing_access = (access or live) and cli_or_existing
    workflow_script = access_needed and script_access and not cli_or_existing and not shared_access
    server_needed = shared_access or (access_needed and not cli_or_existing and not script_access)
    skill_needed = judgment or workflow_script

    if server_needed and skill_needed:
        reasons = [
            "Both a reusable access boundary and a procedure are hard. Layer them: "
            "a server for the connection, a skill that supplies the procedure and "
            "calls its tools.",
        ]
        if shared_access:
            reasons.append("The missing access adapter must serve many clients under governance, so a server is the auditable chokepoint.")
        if live:
            reasons.append("The data changes between runs, so it must be fetched live, not written down once.")
        return "both", with_distribution(reasons)

    if server_needed:
        reasons = [
            "The hard part is an unmet reusable access boundary, and neither an existing "
            "tool nor a workflow-local script covers it. Build or adopt an MCP server.",
        ]
        if shared_access:
            reasons.append("It is a shared access adapter for many clients under governance, which a server centralizes.")
        if live:
            reasons.append("The data changes between runs, so it must be fetched live.")
        return "server", with_distribution(reasons)

    if skill_needed:
        if workflow_script:
            reasons = [
                "The runtime already supplies network access and credentials, and this "
                "access belongs to one workflow. Bundle and run a local script in a "
                "skill; no reusable server boundary is needed.",
            ]
            if judgment:
                reasons.append("The same skill can carry the procedure the agent lacks.")
            if live:
                reasons.append("The script fetches fresh data when the workflow runs.")
            return "skill", with_distribution(reasons)
        if existing_access:
            reasons = [
                "A CLI or existing server already provides the access. The missing piece "
                "is procedure, so add a skill that directs the existing access.",
            ]
            if live:
                reasons.append("The existing access can fetch fresh data; freshness does not require a second server.")
            return "skill", with_distribution(reasons)
        return "skill", with_distribution([
            "The agent can already reach what it needs; the hard part is knowing what to "
            "do with it. That is a skill.",
        ])

    if existing_access:
        reasons = [
            "A CLI or existing server already provides the access, and no procedure is "
            "missing. Adopt it; build nothing.",
        ]
        if live:
            reasons.append("The existing access can fetch fresh data; freshness does not require a second server.")
        return "neither", with_distribution(reasons)

    return "neither", with_distribution([
        "No reusable access boundary or procedure is missing. Build nothing.",
    ])


def decide(args: argparse.Namespace) -> None:
    verdict, reasons = classify(
        access=args.access, judgment=args.judgment, shared_access=args.shared_access,
        cli_or_existing=args.cli_exists, live=args.live,
        script_access=args.script_access,
        skill_distributed=args.skill_distributed,
    )
    inputs = {
        "access": args.access, "judgment": args.judgment,
        "shared_access": args.shared_access,
        "cli_or_existing": args.cli_exists, "live": args.live,
        "script_access": args.script_access,
        "skill_distributed": args.skill_distributed,
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
    check("neither when an existing CLI already covers access and no procedure is missing",
          classify(True, False, False, True, False)[0] == "neither")
    check("neither when an existing CLI can fetch live data and no procedure is missing",
          classify(True, False, False, True, True)[0] == "neither")
    check("skill adds procedure over existing live access",
          classify(True, True, False, True, True)[0] == "skill")
    check("skill can bundle a workflow-local script with runtime access",
          classify(True, False, False, False, True, True)[0] == "skill")
    check("workflow-local script does not replace an unmet shared access boundary",
          classify(True, False, True, False, True, True)[0] == "server")
    check("skill when only judgment is hard",
          classify(False, True, False, False, False)[0] == "skill")
    check("neither when nothing is hard",
          classify(False, False, False, False, False)[0] == "neither")
    check("centrally distributed Skill plus judgment stays a skill",
          classify(False, True, False, False, False, skill_distributed=True)[0] == "skill")
    check("an unmet shared access boundary routes to a server",
          classify(False, False, True, False, False)[0] == "server")
    check("an unmet shared access boundary plus judgment needs both",
          classify(False, True, True, False, False)[0] == "both")
    check("an unmet shared access boundary remains a server need when a local CLI exists",
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
    ap.add_argument("--shared-access", action="store_true", help="[decide] an unmet reusable access adapter must serve many clients under governance")
    ap.add_argument("--skill-distributed", action="store_true", help="[decide] the Skill is centrally provisioned; this does not create an access boundary")
    ap.add_argument("--cli-exists", action="store_true", help="[decide] a CLI or existing server already provides access")
    ap.add_argument("--live", action="store_true", help="[decide] the data changes between invocations")
    ap.add_argument("--script-access", action="store_true", help="[decide] a workflow-local script can use runtime network and credentials")
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
        decide(argparse.Namespace(
            access=True, judgment=True, shared_access=False, cli_exists=False, live=True,
            script_access=False, skill_distributed=False,
        ))
        print("\nrun --test for assertions, or --decide with the seven flags to classify your own capability.")
        return 0
    except RuntimeError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
