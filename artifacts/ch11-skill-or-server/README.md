# ch11-skill-or-server --- one problem, three ways

A zero-dependency lab paired with Chapter 11. It solves a single problem, "produce
the release notes for a version," three ways: with a server alone, with a skill
alone, and with the two layered. Seeing the same task fail as each half and succeed
as the whole is the chapter's thesis made executable: a skill supplies judgment, a
server supplies access, and the production shape is both.

- **Runtime:** Python 3.9+ (standard library only)
- **Requires:** nothing. No API key, no network, no packages.

## The problem, and why it has two halves

Release notes for a version have an **access** half (reach the commits merged since
the last tag) and a **judgment** half (turn them into a clean, categorized section).
The access half is a live external system; the judgment half is a procedure. That
split is exactly the one this chapter is about.

```
ch11-skill-or-server/
  hybrid_lab.py                       # the driver: run each path, decide, test
  commit_server.py                    # the access layer: a stdio server in MCP's shape
  fixtures/commits.json               # the "external system's" data, so it runs offline
  release-notes/                      # the judgment layer: a real skill
    SKILL.md
    references/CONVENTIONS.md          # the category rules, read on demand (level 3)
    scripts/format_notes.py            # the formatter the skill runs (level 3)
```

The server is a genuinely separate process the driver spawns and talks to over
stdin/stdout, one JSON line per message. It is MCP-*shaped* (JSON-RPC framing,
`tools/list` and `tools/call`) but not the real protocol: it skips the handshake
and capability negotiation covered in Chapters 5 and 6. The point is the process
boundary that separates a server from a skill, not a conformant server.

## Run it

```bash
cd artifacts/ch11-skill-or-server

# All three paths in order, then the decision for this problem.
python3 hybrid_lab.py

# The access layer alone: you get data, no judgment. Raw, unsorted, chores included.
python3 hybrid_lab.py --server-only

# The procedure layer alone, starved of access: correct, and empty.
python3 hybrid_lab.py --skill-only

# Hand the starved skill the commits by hand: it works, but you did the server's job.
python3 hybrid_lab.py --skill-only --from fixtures/commits.json

# The production shape: the skill calls the server tool, then formats the result.
python3 hybrid_lab.py --hybrid

# The decision framework in code: five questions -> skill / server / both / neither.
python3 hybrid_lab.py --decide --access --judgment --live     # => both
python3 hybrid_lab.py --decide --judgment                     # => skill
python3 hybrid_lab.py --decide --access --live                # => server
python3 hybrid_lab.py --decide --access --cli-exists          # => skill (wrap the CLI)
python3 hybrid_lab.py --decide --access --live --cli-exists   # => skill (the CLI fetches fresh data)
python3 hybrid_lab.py --decide --access --shared --cli-exists # => server (governance still needs a shared boundary)

# Assertions: the framework routes the canonical cases, and the three paths behave.
python3 hybrid_lab.py --test

# Deterministic artifact check, including the bundled skill's portable validation.
./check.sh
```

## Install the release-notes skill (optional)

`release-notes/` is a valid skill. To use it in Claude Code:

```bash
cp -r release-notes ~/.claude/skills/release-notes
```

Then ask for the release notes of a version. On its own the skill can only format
commits you provide; layered over a GitHub (or git) MCP server that exposes the
commit history, it fetches them itself. That is this lab's chosen access layer. In a
real workflow, first use an existing CLI or server that can make the fresh fetch; add
a server when that access or a shared governance boundary is missing.

## The five questions behind `--decide`

`--decide` routes on the same logic as the chapter's widget:

- `--access` the hard part is reaching a live external system, holding state, or authenticating to a third party.
- `--judgment` the hard part is knowing what to do: a workflow, a procedure, domain expertise the agent lacks.
- `--shared` the same capability must serve many agents or clients under central governance.
- `--cli-exists` a CLI the agent can shell out to, or an existing server, already provides the access.
- `--live` the data changes between invocations and must be fetched fresh.

Access with no existing tool routes to a server; judgment routes to a skill; both
route to both; a CLI or existing server that already provides the access routes to a
skill wrapping it. `--live` requires a fresh fetch, but an existing CLI or server can
make that fetch, so it does not require a duplicate server. `--shared` is separate: a
local CLI does not provide the central, auditable boundary, so it still routes to a
server. Nothing hard routes to "neither, the agent already does this."

## The estimates, stated plainly

The commit fixture stands in for a live system so the lab runs offline. It supports the
single truthful range from `v0.3.0` to `v0.4.0`; an unsupported `--tag` exits with a
visible error rather than returning invented commits. The category rules in
`format_notes.py` are a small, real Conventional-Commit-to-Keep-a-Changelog mapping,
not the whole of either spec. The decision framework is a teaching model of the chapter's
tree, not an oracle; real capabilities sit on a spectrum, and the honest answer to a
close call is usually "both."
