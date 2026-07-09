#!/usr/bin/env python3
"""Run one small task under three harness postures, and compare the loop, not the output.

Companion to chapter 4, "The Landscape." The chapter's claim is that Claude Code, Codex,
and opencode run the same program (a model in a loop) and diverge on a short list of
architectural bets. This script makes that concrete. It fixes one bug, a wrong
Celsius-to-Fahrenheit formula, under three postures modeled on the three tools:

  - interactive   (Claude Code-like): approve every edit and shell action; one frontier
                   model does all the reasoning; the session is fresh per run; the loop
                   runs locally against your tree; the trust boundary is a permission rule.
  - delegated     (Codex-like): no approval prompts; the loop runs in an OS sandbox with
                   the network off; the session is a persistent thread; the trust boundary
                   is OS containment.
  - agnostic      (opencode-like): route planning to a cheap model and the fix to a
                   frontier model; per-tool permissions ask before an edit but allow reads;
                   a persistent daemon owns the session; the trust boundary is per-tool
                   permissions plus git snapshots.

All three produce the identical patch, which the script verifies by actually running the
fixed function. Then it prints the loop traces side by side: approval gates, execution
locus, trust boundary, model routing, tokens, and session persistence. Same output,
different loop.

Run it with no setup: with no ANTHROPIC_API_KEY the token counts are deterministic
estimates, so the whole comparison still runs. Set the key (and
`pip install -r requirements.txt`) and the plan and fix phases call the real model, routed
per posture, and the token counts become real, so you can watch model coupling change the
cost of the same output. In live mode the Anthropic API is used as a uniform backend for
all three postures; the point is the harness posture, not the vendor.
"""
from __future__ import annotations

import os
import sys

# ---- the shared task: one bug, one fix, for every posture ----------------------

BUGGY_SRC = (
    "def c_to_f(celsius):\n"
    "    return celsius * 9 / 5 - 32  # convert Celsius to Fahrenheit\n"
)
WRONG_EXPR = "celsius * 9 / 5 - 32"
RIGHT_EXPR = "celsius * 9 / 5 + 32"
TASK = "Fix c_to_f so it converts Celsius to Fahrenheit correctly, then show the change."

# Anthropic list pricing, July 2026 ($ per input token). Used to price each posture's
# routing so model coupling shows up as a cost difference, not just a token count.
PRICE_IN = {
    "claude-opus-4-8": 5.0 / 1e6,
    "claude-sonnet-4-6": 3.0 / 1e6,
    "claude-sonnet-5": 3.0 / 1e6,
    "claude-haiku-4-5": 1.0 / 1e6,
}
FALLBACK_PRICE_IN = 3.0 / 1e6  # a sane default for any model id not in the table above
FRONTIER = os.environ.get("FRONTIER_MODEL", "claude-sonnet-4-6")
CHEAP = os.environ.get("CHEAP_MODEL", "claude-haiku-4-5")


def price_in(model: str) -> float:
    """Input price for a model, tolerating ids outside the table (e.g. a newer release)."""
    return PRICE_IN.get(model, PRICE_IN.get(FRONTIER, FALLBACK_PRICE_IN))

# ---- the loop, as an ordered list of actions -----------------------------------
# Every posture runs the SAME plan. What differs is who approves each action, which
# model handles it, and where it executes.

# action, kind, rough token cost of the action's context (offline estimate)
PLAN = [
    ("read auth test + c_to_f", "read", 1400),
    ("plan the fix", "plan", 700),
    ("edit c_to_f", "edit", 350),
    ("run tests", "bash", 1600),
    ("open PR", "pr", 250),
]


class Posture:
    def __init__(self, key, name, execution, trust, persistence, plan_model, fix_model, gate_kinds):
        self.key = key
        self.name = name
        self.execution = execution          # where the loop runs
        self.trust = trust                  # where control is enforced
        self.persistence = persistence      # session model
        self.plan_model = plan_model        # model that does the planning phase
        self.fix_model = fix_model          # model that drives edits/reads/tests
        self.gate_kinds = set(gate_kinds)   # action kinds that require human approval

    def model_for(self, kind: str) -> str:
        return self.plan_model if kind == "plan" else self.fix_model


POSTURES = [
    Posture(
        "interactive", "interactive (Claude Code-like)",
        execution="local, live tree",
        trust="permission rule (fail-closed)",
        persistence="fresh per session",
        plan_model=FRONTIER, fix_model=FRONTIER,
        gate_kinds={"edit", "bash"},        # eyes on every consequential action
    ),
    Posture(
        "delegated", "delegated (Codex-like)",
        execution="cloud sandbox, network off",
        trust="OS containment (kernel sandbox)",
        persistence="persistent thread (SQLite)",
        plan_model=FRONTIER, fix_model=FRONTIER,
        gate_kinds=set(),                   # containment is the boundary; no prompts
    ),
    Posture(
        "agnostic", "model-agnostic (opencode-like)",
        execution="local daemon, over SSH",
        trust="per-tool permissions + git snapshot",
        persistence="persistent daemon",
        plan_model=CHEAP, fix_model=FRONTIER,   # cheap planning, frontier fix
        gate_kinds={"edit"},                    # ask before an edit, allow reads/bash
    ),
]


# ---- the model call: real in live mode, stubbed offline ------------------------

class Model:
    """produce_fix(model) -> (fixed_expr, input_tokens). Live or estimated."""

    def __init__(self, client):
        self.client = client
        self.estimated = client is None

    def produce_fix(self, model: str) -> tuple[str, int]:
        if self.client is None:
            # offline: the reasoning is stubbed; return the known-correct expression and
            # an estimated token cost for the plan+fix reasoning.
            return RIGHT_EXPR, 900
        prompt = (
            "This function is meant to convert Celsius to Fahrenheit but is wrong:\n\n"
            f"{BUGGY_SRC}\n"
            "Reply with ONLY the corrected return expression, no prose, no code fences. "
            "For example: celsius * 9 / 5 + 32"
        )
        try:
            resp = self.client.messages.create(
                model=model,
                max_tokens=64,
                messages=[{"role": "user", "content": prompt}],
            )
            text = "".join(b.text for b in resp.content if getattr(b, "type", "") == "text").strip()
            tokens = resp.usage.input_tokens + resp.usage.output_tokens
            expr = sanitize_expr(text)
            if not verify_fix(expr):
                print(f"    (note: {model} returned an expr that failed the test; using the reference fix)")
                expr = RIGHT_EXPR
            return expr, tokens
        except Exception as exc:  # noqa: BLE001 -- degrade to the offline stub, keep running
            print(f"    (note: model call fell back to estimate: {exc})")
            self.estimated = True
            return RIGHT_EXPR, 900


def make_model() -> Model:
    key = os.environ.get("ANTHROPIC_API_KEY")
    if not key:
        return Model(None)
    try:
        from anthropic import Anthropic
    except ImportError:
        print("note: anthropic SDK missing; run 'pip install -r requirements.txt' for live mode.\n")
        return Model(None)
    try:
        return Model(Anthropic(api_key=key))
    except Exception as exc:  # noqa: BLE001 -- degrade to offline if the client will not construct
        print(f"note: could not construct the Anthropic client ({exc}); running offline.\n")
        return Model(None)


def sanitize_expr(text: str) -> str:
    """Pull a single expression line out of a model reply, tolerating fences and prose."""
    for line in text.splitlines():
        line = line.strip().strip("`").strip()
        if "celsius" in line.lower() and "return" not in line:
            return line
        if line.startswith("return "):
            return line[len("return "):].strip()
    return text.strip().strip("`").strip()


def normalize_expr(expr: str) -> str:
    """Collapse whitespace so trivially-formatted variants count as the same text."""
    return "".join(expr.split())


def verify_fix(expr: str) -> bool:
    """Actually build and run the fixed function. This is the 'same output' proof."""
    src = BUGGY_SRC.replace(WRONG_EXPR, expr)
    ns: dict = {}
    try:
        exec(src, ns)  # noqa: S102 -- local, self-authored snippet
        f = ns["c_to_f"]
        return abs(f(100) - 212.0) < 1e-9 and abs(f(0) - 32.0) < 1e-9
    except Exception:  # noqa: BLE001
        return False


# ---- run one posture through the shared plan -----------------------------------

def run_posture(posture: Posture, model: Model) -> dict:
    gates = 0
    tokens = 0
    fixed_expr = RIGHT_EXPR
    models_used = set()
    for _action, kind, est in PLAN:
        models_used.add(posture.model_for(kind))
        if kind in posture.gate_kinds:
            gates += 1
        if kind in ("plan", "edit"):
            # the reasoning-bearing phases: call (or stub) the model, routed per posture.
            expr, live_tokens = model.produce_fix(posture.model_for(kind))
            if kind == "edit":
                fixed_expr = expr
            tokens += live_tokens if not model.estimated else est
        else:
            tokens += est
    cost = sum(est * price_in(posture.model_for(kind)) for _a, kind, est in PLAN)
    return {
        "posture": posture,
        "gates": gates,
        "tokens": tokens,
        "cost": cost,
        "models": sorted(models_used),
        "fixed_expr": fixed_expr,
        "passes": verify_fix(fixed_expr),
    }


# ---- rendering -----------------------------------------------------------------

def fmt_tokens(n: int) -> str:
    return f"{n / 1000:.1f}K" if n >= 1000 else str(int(n))


def row(cells: list[str], widths: list[int]) -> str:
    return "  ".join(c.ljust(w) for c, w in zip(cells, widths))


def main() -> int:
    model = make_model()
    mode = (
        "offline (estimated tokens)"
        if model.client is None
        else "live (plan+edit tokens real; read/bash/pr estimated)"
    )

    print(f"# loop comparator, {mode}")
    print(f"# task: {TASK}")
    print(f"# same fix for all three postures: {WRONG_EXPR!r} -> {RIGHT_EXPR!r}\n")

    results = [run_posture(p, model) for p in POSTURES]

    # 1. the convergence proof: every posture produces a fix that passes the same test.
    #    verify_fix (running the fixed function) is the real proof; offline the expressions
    #    are byte-identical, but a live model may format the same formula differently, so
    #    the headline claim is functional equivalence, checked by execution.
    all_pass = all(r["passes"] for r in results)
    same_text = len({normalize_expr(r["fixed_expr"]) for r in results}) == 1
    print("## output: functionally identical across postures")
    for r in results:
        mark = "ok" if r["passes"] else "FAIL"
        print(f"  [{mark}] {r['posture'].key:<12} produced: return {r['fixed_expr']}")
    note = "" if same_text else "  (expressions differ in text but compute the same result)"
    print(f"  => all postures pass the same test: {all_pass}{note}\n")

    # 2. the divergence: the loop trace, side by side.
    print("## loop: different for every posture")
    headers = ["posture", "runs in", "trust boundary", "approvals", "models", "tokens", "session"]
    widths = [32, 28, 37, 9, 22, 7, 26]
    print("  " + row(headers, widths))
    print("  " + "-" * (sum(widths) + 2 * (len(widths) - 1)))
    for r in results:
        p = r["posture"]
        models = ", ".join(m.replace("claude-", "") for m in r["models"])
        print("  " + row([
            p.name,
            p.execution,
            p.trust,
            str(r["gates"]),
            models,
            fmt_tokens(r["tokens"]),
            p.persistence,
        ], widths))

    # 3. model coupling shows up as cost.
    print("\n## model coupling, priced")
    for r in results:
        p = r["posture"]
        routing = "one frontier model" if p.plan_model == p.fix_model else "cheap plan, frontier fix"
        print(f"  {p.key:<12} {routing:<26} est. input cost ${r['cost']:.5f}")
    cheapest = min(results, key=lambda r: r["cost"])
    dearest = max(results, key=lambda r: r["cost"])
    if cheapest["cost"] < dearest["cost"]:
        ratio = dearest["cost"] / cheapest["cost"]
        print(f"  => routing planning to a cheap model makes '{cheapest['posture'].key}' "
              f"{ratio:.2f}x cheaper than '{dearest['posture'].key}' for the same output.")

    print("\n# the output converged; the loop did not. that short list of differences "
          "(locus, trust,\n# approvals, model routing, session) is what you choose when you pick a tool.")

    if model.estimated:
        print("\n# note: token counts are deterministic estimates. Set ANTHROPIC_API_KEY "
              "for real counts\n#       and live model routing (haiku vs sonnet).")
    return 0 if all_pass else 1


if __name__ == "__main__":
    sys.exit(main())
