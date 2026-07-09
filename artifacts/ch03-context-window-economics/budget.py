#!/usr/bin/env python3
"""Decompose a captured agent session's context window by category, and price it.

This is the runnable companion to chapter 3. It loads a session (a system prompt, a
tools array, and a multi-turn message history with tool results) from session.json and
answers two questions:

  1. Where did the window go?  It attributes input tokens to each category the way
     Claude Code's /context does: tool definitions, system prompt, message history, and
     tool results, each as a token count and a share of the window, with alarms when the
     tools cross ~10% or free space falls below the ~40% working-context floor.

  2. What will the session cost?  Because the API is stateless, every turn re-sends the
     whole history, so the cumulative input you are billed for is the area of a triangle,
     not the height of one bar. The analyzer sums the per-turn input to show that
     quadratic total and prices it at current rates, with and without a cached prefix.

Run it with no setup: with no ANTHROPIC_API_KEY it uses a clearly labeled
character-based estimate (chars / 4) for every count, so the whole decomposition still
runs. Set the key (and `pip install -r requirements.txt`) to use the real count_tokens
endpoint for exact counts. Do not use tiktoken here: it is OpenAI's tokenizer and
undercounts Claude.
"""
from __future__ import annotations

import copy
import json
import os
import sys

WINDOW = int(os.environ.get("CONTEXT_WINDOW", "200000"))  # tokens; the budget to fit in
OUTPUT_BUFFER = 8_000       # reserved for the model's output this turn
CEILING = 0.40              # ~40% working-context ceiling; quality erodes past here
TOOLS_ALARM = 0.10          # flag when tool defs cross 10% of the window
MIN_MESSAGES = [{"role": "user", "content": "."}]  # a minimal valid request, for baselines

# Anthropic list pricing, July 2026, ($ per input token, $ per output token).
PRICING = {
    "claude-opus-4-8": (5.0 / 1e6, 25.0 / 1e6),
    "claude-sonnet-4-6": (3.0 / 1e6, 15.0 / 1e6),
    "claude-sonnet-5": (3.0 / 1e6, 15.0 / 1e6),
    "claude-haiku-4-5": (1.0 / 1e6, 5.0 / 1e6),
}
CACHE_READ = 0.10   # cached reads are 0.1x input
CACHE_WRITE = 1.25  # a 5-minute cache write is 1.25x input


# ---- the count primitive: exact in live mode, estimated offline ---------------

class Counter:
    """count(system, tools, messages) -> input tokens. One interface, two backends."""

    def __init__(self, client, model: str):
        self.client = client
        self.model = model
        self.estimated = False  # set if any count fell back to the char estimate

    def _estimate(self, system, tools, messages) -> int:
        payload = {"system": system or "", "tools": tools or [], "messages": messages or []}
        return len(json.dumps(payload, ensure_ascii=False)) // 4

    def count(self, system=None, tools=None, messages=None) -> int:
        messages = messages if messages is not None else MIN_MESSAGES
        if self.client is None:
            self.estimated = True
            return self._estimate(system, tools, messages)
        kwargs = {"model": self.model, "messages": messages}
        if system:
            kwargs["system"] = system
        if tools:
            kwargs["tools"] = tools
        try:
            return self.client.messages.count_tokens(**kwargs).input_tokens
        except Exception as exc:  # noqa: BLE001 -- fall back to an estimate, keep running
            print(f"  (count_tokens fell back to estimate: {exc})")
            self.estimated = True
            return self._estimate(system, tools, messages)


def make_counter() -> Counter:
    key = os.environ.get("ANTHROPIC_API_KEY")
    model = os.environ.get("ANTHROPIC_MODEL", "claude-sonnet-4-6")
    if not key:
        return Counter(None, model)
    try:
        from anthropic import Anthropic
    except ImportError:
        print("note: anthropic SDK missing; run 'pip install -r requirements.txt' for exact counts.\n")
        return Counter(None, model)
    return Counter(Anthropic(api_key=key), model)


# ---- attribute the window to categories ---------------------------------------

def blank_tool_results(messages: list) -> list:
    """A copy of the history with tool_result contents emptied, to isolate their cost."""
    out = copy.deepcopy(messages)
    for msg in out:
        content = msg.get("content")
        if isinstance(content, list):
            for block in content:
                if isinstance(block, dict) and block.get("type") == "tool_result":
                    block["content"] = ""
    return out


def count_turns(messages: list) -> int:
    """A turn is one assistant step. Used to model the per-turn re-send."""
    return max(1, sum(1 for m in messages if m.get("role") == "assistant"))


def decompose(counter: Counter, system: str, tools: list, messages: list) -> dict:
    base = counter.count(messages=MIN_MESSAGES)
    with_sys = counter.count(system=system, messages=MIN_MESSAGES)
    with_tools = counter.count(system=system, tools=tools, messages=MIN_MESSAGES)

    system_tokens = max(0, with_sys - base)
    tools_tokens = max(0, with_tools - with_sys)

    all_msgs = counter.count(messages=messages)
    text_msgs = counter.count(messages=blank_tool_results(messages))
    results_tokens = max(0, all_msgs - text_msgs)
    history_tokens = max(0, text_msgs - base)  # history text, minus the minimal baseline

    # the authoritative total for a real request: system + tools + full history
    total = counter.count(system=system, tools=tools, messages=messages)
    free = WINDOW - total - OUTPUT_BUFFER

    return {
        "categories": [
            ("tool defs", tools_tokens),
            ("system", system_tokens),
            ("history", history_tokens),
            ("tool_results", results_tokens),
            ("output buffer", OUTPUT_BUFFER),
        ],
        "total_input": total,
        "prefix": system_tokens + tools_tokens,
        "tail": history_tokens + results_tokens,
        "free": free,
        "turns": count_turns(messages),
    }


# ---- the re-send model: why the bill is quadratic -----------------------------

def resend_cost(prefix: int, tail: int, turns: int, price: float) -> dict:
    """Model the session as `turns` steps that grow the tail from ~0 to its final size.

    per-turn input at step k = prefix + incr*k, where incr = tail / turns.
    cumulative = sum_{k=1..turns} (prefix + incr*k) = prefix*turns + incr*turns(turns+1)/2.
    """
    incr = tail / turns
    cumulative = prefix * turns + incr * turns * (turns + 1) / 2
    naive_linear = prefix + tail  # what one final-turn footprint would suggest
    cached = (
        prefix * CACHE_WRITE                      # write the prefix once
        + CACHE_READ * prefix * (turns - 1)       # re-read it cheaply thereafter
        + incr * turns * (turns + 1) / 2          # the growing tail is not cacheable
    )
    return {
        "cumulative": cumulative,
        "naive_linear": naive_linear,
        "multiple": cumulative / naive_linear if naive_linear else 0.0,
        "cost_no_cache": cumulative * price,
        "cost_cached": cached * price,
    }


# ---- rendering ----------------------------------------------------------------

def bar(fraction: float, width: int = 28) -> str:
    fraction = max(0.0, min(1.0, fraction))
    filled = round(fraction * width)
    return "#" * filled + "." * (width - filled)


def fmt(n: float) -> str:
    n = round(n)
    if abs(n) >= 1000:
        return f"{n / 1000:.1f}K"
    return str(int(n))


def main() -> None:
    here = os.path.dirname(os.path.abspath(__file__))
    with open(os.path.join(here, "session.json"), encoding="utf-8") as fh:
        session = json.load(fh)
    system = session.get("system", "")
    tools = session.get("tools", [])
    messages = session.get("messages", [])

    counter = make_counter()
    mode = "offline (char estimate)" if counter.client is None else f"live ({counter.model})"
    known_price = counter.model in PRICING
    price_in, _ = PRICING.get(counter.model, PRICING["claude-sonnet-4-6"])
    price_note = "" if known_price else "  [fallback rate; model not in PRICING]"

    print(f"# context-budget analyzer, {mode}")
    print(f"# window: {fmt(WINDOW)} tokens   pricing: {counter.model}  (${price_in * 1e6:.0f}/M input){price_note}\n")

    d = decompose(counter, system, tools, messages)

    print("category        tokens     % window   share of window")
    print("-" * 62)
    for label, toks in d["categories"]:
        frac = toks / WINDOW
        print(f"{label:<14}  {fmt(toks):>7}    {frac * 100:5.1f}%    [{bar(frac)}]")
    free_frac = d["free"] / WINDOW
    print(f"{'free':<14}  {fmt(d['free']):>7}    {free_frac * 100:5.1f}%    [{bar(free_frac)}]")
    print("-" * 62)
    print(f"{'used input':<14}  {fmt(d['total_input']):>7}    {d['total_input'] / WINDOW * 100:5.1f}%")

    print("\n# alarms")
    tool_toks = dict(d["categories"]).get("tool defs", 0)
    if tool_toks > TOOLS_ALARM * WINDOW:
        print(f"  ! tool defs are {tool_toks / WINDOW * 100:.1f}% of the window (> {TOOLS_ALARM * 100:.0f}%). Prune the tool set.")
    else:
        print(f"  ok tool defs are {tool_toks / WINDOW * 100:.1f}% of the window (<= {TOOLS_ALARM * 100:.0f}%).")
    if free_frac < (1 - CEILING):
        print(f"  ! free space is {free_frac * 100:.1f}%; you are past the ~{CEILING * 100:.0f}% working-context ceiling. Reclaim room.")
    else:
        print(f"  ok free space is {free_frac * 100:.1f}%; under the ~{CEILING * 100:.0f}% ceiling.")

    r = resend_cost(d["prefix"], d["tail"], d["turns"], price_in)
    print(f"\n# the re-send: this session is {d['turns']} turn(s); every turn re-sends the whole stack")
    print(f"  one final-turn footprint : {fmt(r['naive_linear'])} input tokens")
    print(f"  cumulative billed input  : {fmt(r['cumulative'])} input tokens  ({r['multiple']:.1f}x the single-turn footprint)")
    print(f"  cost, no cache           : ${r['cost_no_cache']:.4f}")
    print(f"  cost, cached prefix      : ${r['cost_cached']:.4f}   (prefix re-read at {CACHE_READ:.0%} of input)")
    print("\n  the tail dominates a long loop: caching amortizes the prefix, not the growing history.")

    if counter.estimated:
        print("\n# note: counts are char-based estimates (chars / 4). Set ANTHROPIC_API_KEY for exact counts.")


if __name__ == "__main__":
    sys.exit(main())
