#!/usr/bin/env python3
"""delegate.py --- an orchestrator that dispatches an isolated subagent, with the
context boundary made observable.

The task: summarize what a small codebase does. Doing it means reading every file,
which is a lot of tokens of mostly-uninteresting content. That is exactly the shape
delegation is for: send the messy reading into a subagent's own context, and let
only the distilled summary cross back.

The boundary is literal in this code, not a metaphor. The lead and the subagent are
separate `Context` objects. `run_subagent` takes a *string* prompt and returns a
`Result`; it is never handed the lead's `Context`, so the only channel from parent to
child is the prompt string, and the only channel back is the returned summary. Read
that as the enforcement of Anthropic's rule for the Claude Agent SDK's Agent tool
(renamed from Task; both names still work): a subagent does not receive the parent's
conversation, and only its final message returns.

Run `python3 delegate.py --help` for the modes. Everything runs offline with the
standard library; `--live` uses a real Claude subagent if ANTHROPIC_API_KEY is set.
"""
from __future__ import annotations

import argparse
import os
import sys
from dataclasses import dataclass, field

REPO = os.path.join(os.path.dirname(os.path.abspath(__file__)), "fixtures", "repo")

# The prompt string is the ONLY channel from lead to subagent. It carries an
# objective, an output format, tool guidance, and boundaries, exactly as Anthropic's
# "teach the orchestrator how to delegate" lesson prescribes. Nothing about the lead's
# own context leaks through except what is written here.
DELEGATION_PROMPT = """\
Objective: read every file in the repository at ./fixtures/repo and report what the
project does and how it is structured.
Output format: one short paragraph (<= 5 sentences), then a one-line-per-file list of
each file's responsibility. Do not paste file contents back.
Tools: read files; you may note dead ends you hit while exploring.
Boundaries: summarize only this repository; do not modify anything."""


def est_tokens(text: str) -> int:
    """A rough token estimate: ~4 characters per token. Good enough to watch a
    context fill; not a real tokenizer."""
    return max(1, len(text) // 4)


@dataclass
class Context:
    """One agent's context window: an ordered list of (role, text) turns and the
    running token estimate. Separate agents own separate Context objects, which is
    the whole point of delegation."""

    label: str
    turns: list[tuple[str, str]] = field(default_factory=list)

    def add(self, role: str, text: str) -> None:
        self.turns.append((role, text))

    def tokens(self) -> int:
        return sum(est_tokens(t) for _, t in self.turns)

    def text(self) -> str:
        return "\n".join(t for _, t in self.turns)


@dataclass
class Result:
    """What a subagent hands back. `summary` is the distilled return (small);
    `transcript` is everything it did (large). Which one crosses the boundary is
    the design decision that determines whether delegation paid off."""

    summary: str
    transcript: str
    peak_tokens: int
    files_read: int


def load_repo() -> dict[str, str]:
    files: dict[str, str] = {}
    for name in sorted(os.listdir(REPO)):
        path = os.path.join(REPO, name)
        if os.path.isfile(path):
            with open(path, "r", encoding="utf-8") as fh:
                files[name] = fh.read()
    return files


# --- the two "models" the subagent can use to compress ------------------------------

def offline_summarize(files: dict[str, str]) -> str:
    """A deterministic stand-in for a model call: distill each file to its first
    docstring or heading line, and compose a short summary. Genuine compression, no
    key required."""
    def gist(name: str, body: str) -> str:
        if name.endswith(".py"):
            # first line inside the module docstring
            if '"""' in body:
                inner = body.split('"""', 2)[1].strip().splitlines()
                if inner:
                    return inner[0].rstrip(".")
        for line in body.splitlines():
            line = line.strip()
            if line and not line.startswith("#"):
                return line.lstrip("# ").rstrip(".")
            if line.startswith("# "):
                return line.lstrip("# ").rstrip(".")
        return "(no description)"

    per_file = {name: gist(name, body) for name, body in files.items()}
    lead = (
        f"tasktrack is a small task tracker in {len(files)} files. A JSON-backed "
        "store is the single source of truth; a CLI is the only writer and a "
        "read-only HTTP API is a second reader, so writes stay single-threaded."
    )
    lines = "\n".join(f"- {name}: {g}" for name, g in per_file.items())
    return f"{lead}\n{lines}"


def live_summarize(prompt: str, files: dict[str, str]) -> str | None:
    """Use a real Claude subagent to produce the summary. Returns None (so the caller
    falls back to offline) if the SDK or the key is missing, or the call fails."""
    if not os.environ.get("ANTHROPIC_API_KEY"):
        return None
    try:
        import anthropic
    except ImportError:
        print("  [live] anthropic SDK not installed; falling back to offline.", file=sys.stderr)
        return None
    model = os.environ.get("DELEGATE_MODEL", "claude-sonnet-5")
    corpus = "\n\n".join(f"=== {name} ===\n{body}" for name, body in files.items())
    try:
        client = anthropic.Anthropic()
        msg = client.messages.create(
            model=model,
            max_tokens=400,
            system="You are a codebase-summary subagent. Return only the distilled "
            "summary in the requested format. Never paste file contents back.",
            messages=[{"role": "user", "content": f"{prompt}\n\nThe files:\n{corpus}"}],
        )
        return "".join(block.text for block in msg.content if block.type == "text").strip()
    except Exception as exc:  # noqa: BLE001 - degrade gracefully on any API error
        print(f"  [live] call failed ({exc}); falling back to offline.", file=sys.stderr)
        return None


# --- the subagent: a fresh context that only ever sees the prompt string ------------

def run_subagent(prompt: str, use_live: bool) -> Result:
    """Spin up an isolated agent loop. It is handed ONLY the prompt string; it builds
    its own context by reading files and reasoning, then returns a distilled result.
    Note the signature: no lead Context comes in, so isolation is enforced by the
    call, not by convention."""
    ctx = Context("subagent")
    # The subagent's context starts fresh but not empty: its own system prompt plus
    # the delegation prompt. It never contains the lead's conversation.
    ctx.add("system", "You are a research subagent with a clean context window.")
    ctx.add("user", prompt)

    files = load_repo()
    # The messy work: read every file into the subagent's own context...
    for name, body in files.items():
        ctx.add("tool", f"read {name}:\n{body}")
    # ...and record the dead ends real exploration produces. This is the noise that
    # would otherwise rot the lead's window; here it stays on the subagent's side.
    ctx.add("assistant", "Looked for a test suite to infer intent; none present. "
                          "Checked for a config file; none. Re-read store.py to confirm "
                          "the API never writes. Backtracked from the HTTP angle.")

    peak = ctx.tokens()

    summary = None
    if use_live:
        summary = live_summarize(prompt, files)
    if summary is None:
        summary = offline_summarize(files)

    ctx.add("assistant", summary)
    return Result(
        summary=summary,
        transcript=ctx.text(),
        peak_tokens=peak,
        files_read=len(files),
    )


# --- the three orchestration modes --------------------------------------------------

@dataclass
class Report:
    mode: str
    lead_before: int
    lead_after: int
    subagent_peak: int
    files_read: int
    crossed_down: str
    crossed_up: str
    lead_context_text: str


def orchestrate(mode: str, use_live: bool) -> Report:
    """Build a lead context, then handle the summary task three ways.

    - "delegate": spawn an isolated subagent; append only its distilled summary.
    - "inline": no subagent; the lead reads every file into its own context.
    - "leak": spawn a subagent, but append its full transcript instead of the
      summary, which defeats the isolation and bloats the lead.
    """
    lead = Context("lead")
    lead.add("system", "You are the lead. Plan, delegate, and synthesize.")
    lead.add("user", "Summarize the repository at ./fixtures/repo for me.")
    lead_before = lead.tokens()

    if mode == "inline":
        # No boundary at all: every file lands in the lead's own window.
        files = load_repo()
        for name, body in files.items():
            lead.add("tool", f"read {name}:\n{body}")
        summary = offline_summarize(files)
        lead.add("assistant", summary)
        return Report(
            mode=mode,
            lead_before=lead_before,
            lead_after=lead.tokens(),
            subagent_peak=0,
            files_read=len(files),
            crossed_down="(nothing: the lead did the work itself)",
            crossed_up="(nothing crossed a boundary; all reads are in the lead)",
            lead_context_text=lead.text(),
        )

    # delegate / leak: the lead emits a tool call and receives a result.
    lead.add("assistant", "This is verbose reading work. Delegating to a subagent.")
    result = run_subagent(DELEGATION_PROMPT, use_live)

    crossed_up = result.summary if mode == "delegate" else result.transcript
    lead.add("tool", f"Agent(research) result:\n{crossed_up}")

    return Report(
        mode=mode,
        lead_before=lead_before,
        lead_after=lead.tokens(),
        subagent_peak=result.peak_tokens,
        files_read=result.files_read,
        crossed_down=DELEGATION_PROMPT,
        crossed_up=crossed_up,
        lead_context_text=lead.text(),
    )


# --- presentation -------------------------------------------------------------------

def bar(tokens: int, scale: int, width: int = 36) -> str:
    filled = 0 if scale <= 0 else min(width, round(width * tokens / scale))
    return "#" * filled + "." * (width - filled)


def print_report(rep: Report) -> None:
    print(f"\n// mode: {rep.mode}")
    scale = max(rep.subagent_peak, rep.lead_after, 1)
    if rep.subagent_peak:
        print(f"  subagent peak context : {rep.subagent_peak:6d} tok  [{bar(rep.subagent_peak, scale)}]")
        print(f"  subagent files read   : {rep.files_read}")
    print(f"  lead context (before) : {rep.lead_before:6d} tok  [{bar(rep.lead_before, scale)}]")
    print(f"  lead context (after)  : {rep.lead_after:6d} tok  [{bar(rep.lead_after, scale)}]")
    grew = rep.lead_after - rep.lead_before
    print(f"  the lead grew by      : {grew:6d} tok")
    if rep.mode == "delegate":
        saved = rep.subagent_peak - grew
        print(f"  isolation saved       : {saved:6d} tok never entered the lead window")


def print_boundary(use_live: bool) -> None:
    rep = orchestrate("delegate", use_live)
    print("\n// what crossed DOWN (lead -> subagent): the prompt string, and nothing else")
    print("-" * 72)
    print(rep.crossed_down)
    print("-" * 72)
    print("\n// what crossed UP (subagent -> lead): the distilled summary, and nothing else")
    print("-" * 72)
    print(rep.crossed_up)
    print("-" * 72)
    leaked = any(marker in rep.lead_context_text for marker in ("def move", "class Store", "BaseHTTPRequestHandler"))
    print(f"\n// did any file body reach the lead context? {'YES (leak!)' if leaked else 'no'}")


def print_compare(use_live: bool) -> None:
    modes = [("inline", "no delegation: the lead reads everything"),
             ("delegate", "delegation: only the summary crosses back"),
             ("leak", "delegation, but the subagent returns its transcript")]
    print("\n// same task, three ways. watch the lead's final context size.\n")
    print(f"  {'mode':10} {'lead after':>11}   {'':4} explanation")
    reps = {}
    for mode, note in modes:
        rep = orchestrate(mode, use_live)
        reps[mode] = rep
        print(f"  {mode:10} {rep.lead_after:>8d} tok   ->   {note}")
    inline_t = reps["inline"].lead_after
    deleg_t = reps["delegate"].lead_after
    factor = inline_t / max(deleg_t, 1)
    print(f"\n  delegation kept the lead {factor:.1f}x smaller than doing the work inline.")
    print(f"  leaking the transcript threw that away: {reps['leak'].lead_after} tok, "
          f"back near the inline {inline_t}.")


# --- tests --------------------------------------------------------------------------

def run_tests(use_live: bool) -> int:
    """Assert the boundary actually holds. Offline only, so it is deterministic."""
    inline = orchestrate("inline", use_live=False)
    deleg = orchestrate("delegate", use_live=False)
    leak = orchestrate("leak", use_live=False)

    checks: list[tuple[str, bool]] = []

    # 1. Isolation: no file body reaches the lead under delegation.
    file_markers = ("def move", "class Store", "BaseHTTPRequestHandler")
    isolated = not any(m in deleg.lead_context_text for m in file_markers)
    checks.append(("delegation keeps every file body out of the lead context", isolated))

    # 2. The only thing that crossed down is the prompt string.
    checks.append(("the down-channel is exactly the delegation prompt",
                   deleg.crossed_down == DELEGATION_PROMPT))

    # 3. Compression: the lead grew far less than the subagent's peak.
    grew = deleg.lead_after - deleg.lead_before
    checks.append(("the lead grew < 40% of the subagent's peak context",
                   grew < 0.40 * deleg.subagent_peak))

    # 4. Counterfactual: inline pays essentially the same reading cost the subagent
    #    absorbed (both read every file; the subagent's peak also carries the prompt
    #    and its dead-end notes, so it edges slightly higher).
    checks.append(("inline lead absorbs ~the subagent's peak (it read everything itself)",
                   inline.lead_after >= 0.85 * deleg.subagent_peak))
    checks.append(("delegated lead is much smaller than inline lead",
                   deleg.lead_after < 0.6 * inline.lead_after))

    # 5. Leaking the transcript defeats isolation: back near inline.
    checks.append(("returning the transcript bloats the lead back near inline",
                   leak.lead_after >= 0.8 * inline.lead_after))

    ok = True
    for label, passed in checks:
        print(f"  [{'PASS' if passed else 'FAIL'}] {label}")
        ok = ok and passed
    print(f"\n{'all checks passed' if ok else 'SOME CHECKS FAILED'}")
    return 0 if ok else 1


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description="An orchestrator that delegates to an isolated subagent.")
    group = parser.add_mutually_exclusive_group()
    group.add_argument("--run", action="store_true", help="delegate to a subagent (default)")
    group.add_argument("--inline", action="store_true", help="no delegation: the lead reads everything")
    group.add_argument("--leak", action="store_true", help="delegate but return the full transcript")
    group.add_argument("--compare", action="store_true", help="run all three and compare lead sizes")
    group.add_argument("--show-boundary", action="store_true", help="print exactly what crosses each way")
    group.add_argument("--test", action="store_true", help="assert the boundary holds")
    parser.add_argument("--live", action="store_true", help="use a real Claude subagent if a key is set")
    args = parser.parse_args(argv)

    if args.test:
        return run_tests(args.live)
    if args.show_boundary:
        print_boundary(args.live)
        return 0
    if args.compare:
        print_compare(args.live)
        return 0
    if args.inline:
        print_report(orchestrate("inline", args.live))
        return 0
    if args.leak:
        print_report(orchestrate("leak", args.live))
        return 0
    # default
    print_report(orchestrate("delegate", args.live))
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
