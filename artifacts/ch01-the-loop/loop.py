#!/usr/bin/env python3
"""A minimal agent loop that narrates its four phases as it turns.

perceive  -> assemble the message list into a prompt
decide    -> one model forward pass, emitting text and/or tool_use
act       -> the harness runs the requested tool
observe   -> the tool result is appended back to the message list

The point of chapter 1: the agent is the loop, not the model. The model is a pure
function from a message list to the next block; every bit of state, every stop
condition, and every side effect lives in the harness around it.

Run it with no setup at all: with no ANTHROPIC_API_KEY the loop falls back to a
deterministic offline model that replays a scripted trajectory, so you can still
watch the four phases turn. Set the key (and `pip install -r requirements.txt`) to
run the identical loop against a live model.
"""
from __future__ import annotations

import glob as globlib
import json
import os
from dataclasses import dataclass, field

MAX_TURNS = 8  # a hard stop condition the harness owns; the model never decides this
TASK = "How many lines are in loop.py? Use the tools, then answer in one sentence."


# ---- a model-agnostic reply, so live and offline share one loop body -------

@dataclass
class Text:
    text: str
    type: str = "text"


@dataclass
class ToolUse:
    id: str
    name: str
    input: dict
    type: str = "tool_use"


@dataclass
class Reply:
    content: list          # normalized Text / ToolUse blocks, for the loop's own logic
    stop_reason: str
    raw: object = None     # the provider's native content, re-sent verbatim (see main)


def to_api_content(blocks: list) -> list:
    """Serialize normalized blocks back into Messages-API shape for the next call."""
    out = []
    for b in blocks:
        if isinstance(b, Text):
            out.append({"type": "text", "text": b.text})
        elif isinstance(b, ToolUse):
            out.append({"type": "tool_use", "id": b.id, "name": b.name, "input": b.input})
    return out


# ---- tools: the agent-computer interface (read-only, scoped to this dir) ----

TOOLS = [
    {
        "name": "list_files",
        "description": "List files in the current directory matching a glob, e.g. '*.py'.",
        "input_schema": {
            "type": "object",
            "properties": {"glob": {"type": "string"}},
            "required": ["glob"],
        },
    },
    {
        "name": "count_lines",
        "description": "Count the lines in a text file in the current directory.",
        "input_schema": {
            "type": "object",
            "properties": {"path": {"type": "string"}},
            "required": ["path"],
        },
    },
]


def run_tool(name: str, args: dict) -> str:
    if name == "list_files":
        pattern = args.get("glob", "*")
        if "/" in pattern or "\\" in pattern or ".." in pattern:
            return "error: glob must name files in the current directory, with no path separators"
        return json.dumps(sorted(p for p in globlib.glob(pattern) if os.path.isfile(p)))
    if name == "count_lines":
        target = os.path.basename(args.get("path", ""))  # strip any dirs: stay in cwd
        if not os.path.isfile(target):
            return f"error: no such file: {target}"
        with open(target, encoding="utf-8", errors="replace") as fh:
            return str(sum(1 for _ in fh))
    return f"error: unknown tool {name}"


# ---- the offline model: a pure function of the message list, scripted by turn ----

@dataclass
class OfflineModel:
    calls: int = field(default=0)

    def create(self, messages: list, tools: list) -> Reply:
        self.calls += 1
        if self.calls == 1:
            return Reply(
                [Text("Let me see which Python files are here."),
                 ToolUse("call_1", "list_files", {"glob": "*.py"})],
                "tool_use",
            )
        if self.calls == 2:
            return Reply([ToolUse("call_2", "count_lines", {"path": "loop.py"})], "tool_use")
        count = _last_tool_result(messages) or "an unknown number of"
        return Reply([Text(f"loop.py has {count} lines.")], "end_turn")


def _last_tool_result(messages: list) -> str:
    for msg in reversed(messages):
        content = msg.get("content")
        if isinstance(content, list):
            for block in content:
                if isinstance(block, dict) and block.get("type") == "tool_result":
                    return str(block.get("content", ""))
    return ""


# ---- the live model: the same interface over the Anthropic Messages API -----

class AnthropicModel:
    def __init__(self, client, model: str):
        self.client = client
        self.model = model

    def create(self, messages: list, tools: list) -> Reply:
        resp = self.client.messages.create(
            model=self.model, max_tokens=1024, tools=tools, messages=messages,
        )
        blocks: list = []
        for b in resp.content:
            if b.type == "text":
                blocks.append(Text(b.text))
            elif b.type == "tool_use":
                blocks.append(ToolUse(b.id, b.name, b.input))
        # keep resp.content as raw: on models with thinking on (e.g. adaptive thinking,
        # the default when the param is omitted), the assistant turn holds thinking
        # blocks that must be echoed back unchanged, or the next call is rejected.
        return Reply(blocks, resp.stop_reason, raw=resp.content)


def choose_model():
    key = os.environ.get("ANTHROPIC_API_KEY")
    if not key:
        return OfflineModel(), "offline (no ANTHROPIC_API_KEY)"
    try:
        from anthropic import Anthropic
    except ImportError:
        print("note: anthropic SDK missing; run 'pip install -r requirements.txt' for live mode.\n")
        return OfflineModel(), "offline (SDK not installed)"
    model_id = os.environ.get("ANTHROPIC_MODEL", "claude-sonnet-5")
    return AnthropicModel(Anthropic(api_key=key), model_id), f"live ({model_id})"


# ---- the loop -------------------------------------------------------------

def log(tag: str, detail: str) -> None:
    print(f"  {tag:<9}{detail}")


def truncate(s: str, n: int = 60) -> str:
    s = s.replace("\n", " ")
    return s if len(s) <= n else s[: n - 1] + "..."


def main() -> None:
    model, mode = choose_model()
    print(f"# minimal agent loop, {mode}\n# task: {TASK}\n")
    messages: list = [{"role": "user", "content": TASK}]

    for turn in range(1, MAX_TURNS + 1):
        print(f"--- turn {turn} " + "-" * 30)

        # perceive: the harness assembles the whole message list into one prompt
        log("PERCEIVE", f"{len(messages)} message(s) assembled into the prompt")

        # decide: one forward pass; the model is stateless, this is its only turn
        reply = model.create(messages, TOOLS)
        tool_uses = [b for b in reply.content if isinstance(b, ToolUse)]
        has_text = any(isinstance(b, Text) for b in reply.content)
        parts = (["text"] if has_text else []) + [f"tool_use({b.name})" for b in tool_uses]
        log("DECIDE", f"stop_reason={reply.stop_reason}; emitted {' + '.join(parts) or 'nothing'}")
        # append the assistant turn verbatim: live mode re-sends the provider's own
        # blocks (thinking included); offline mode rebuilds from normalized blocks.
        assistant_content = reply.raw if reply.raw is not None else to_api_content(reply.content)
        messages.append({"role": "assistant", "content": assistant_content})

        # the harness owns termination, not the model
        if reply.stop_reason != "tool_use":
            final = next((b.text for b in reversed(reply.content) if isinstance(b, Text)), "(no text)")
            log("HALT", "no tool_use requested, so the harness exits the loop")
            print(f"\n>> {final}")
            return

        # act: run each requested tool.  observe: append the results as context
        results = []
        for b in tool_uses:
            out = run_tool(b.name, b.input)
            log("ACT", f"{b.name}({json.dumps(b.input)}) -> {truncate(out)}")
            results.append({"type": "tool_result", "tool_use_id": b.id, "content": out})
        messages.append({"role": "user", "content": results})
        log("OBSERVE", f"appended {len(results)} tool_result(s); context is now {len(messages)} messages")
        print()

    print("hit MAX_TURNS: the harness stops the loop (a budget guard the model cannot override).")


if __name__ == "__main__":
    main()
