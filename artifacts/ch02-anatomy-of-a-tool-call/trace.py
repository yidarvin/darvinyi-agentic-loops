#!/usr/bin/env python3
"""Trace one tool-use exchange and print the raw blocks it is made of.

This is the runnable companion to chapter 2. It runs a real tool-use exchange and,
at each step, prints the exact block structure the model emits and the harness
returns:

    assistant content -> the tool_use block(s): {id, name, input} + stop_reason
    tool_result       -> what your harness sends back: {tool_use_id, content, is_error?}

That is the whole anatomy of a tool call. The model emits a request as content and
stops; your code runs the tool and returns the result as the next turn's input. The
model never touches the file itself.

It also measures what your tool definitions cost. In live mode it calls the
token-counting endpoint twice, once with the tools array and once without, and prints
the difference: the exact number of input tokens your tools add to every request.

Run it with no setup: with no ANTHROPIC_API_KEY the tracer replays a scripted
exchange and prints the same block structure, with a labeled character-based estimate
in place of the real token count. Set the key (and `pip install -r requirements.txt`)
to run the identical trace against a live model.
"""
from __future__ import annotations

import glob as globlib
import json
import os
from dataclasses import dataclass

MAX_TURNS = 6  # a hard stop the harness owns; the model never decides this
TASK = "Read sample.txt and tell me, in one sentence, what it is about."


# ---- normalized blocks, so live and offline print the same shape ------------

@dataclass
class Text:
    text: str


@dataclass
class ToolUse:
    id: str
    name: str
    input: dict


@dataclass
class Reply:
    content: list          # normalized Text / ToolUse blocks, for the loop's logic
    stop_reason: str
    raw: object = None     # the provider's native content, re-sent verbatim


def block_to_dict(b) -> dict:
    """Render a normalized block as the Messages-API dict, exactly as it goes on the wire."""
    if isinstance(b, Text):
        return {"type": "text", "text": b.text}
    if isinstance(b, ToolUse):
        return {"type": "tool_use", "id": b.id, "name": b.name, "input": b.input}
    raise TypeError(f"unknown block: {b!r}")


# ---- tools: real, safe execution confined to this directory -----------------

TOOLS = [
    {
        "name": "read_file",
        "description": (
            "Read a UTF-8 text file in the current directory and return its contents. "
            "Use this to inspect a file before answering questions about it. "
            "path must name a file in this directory, with no path separators."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "path": {"type": "string", "description": "file name, e.g. 'sample.txt'"}
            },
            "required": ["path"],
        },
    },
    {
        "name": "list_dir",
        "description": (
            "List files in the current directory matching a glob such as '*.txt'. "
            "Use this when you do not know the exact file name."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "glob": {"type": "string", "description": "a glob with no path separators"}
            },
            "required": ["glob"],
        },
    },
]


def run_tool(name: str, args: dict) -> tuple[str, bool]:
    """Execute the tool. Returns (content, is_error). Confined to the current dir."""
    if name == "read_file":
        target = os.path.basename(args.get("path", ""))  # strip any dirs: stay in cwd
        if not target or not os.path.isfile(target):
            return f"error: no such file: {args.get('path')!r}", True
        with open(target, encoding="utf-8", errors="replace") as fh:
            return fh.read()[:2000], False
    if name == "list_dir":
        pattern = args.get("glob", "*")
        if "/" in pattern or "\\" in pattern or ".." in pattern:
            return "error: glob must name files in the current directory, no path separators", True
        return json.dumps(sorted(p for p in globlib.glob(pattern) if os.path.isfile(p))), False
    return f"error: unknown tool {name}", True


# ---- the offline model: a scripted exchange so the trace runs with no key ----

class OfflineModel:
    def __init__(self) -> None:
        self.calls = 0

    def create(self, messages: list, tools: list) -> Reply:
        self.calls += 1
        if self.calls == 1:
            return Reply(
                [Text("I'll read sample.txt to see what it is about."),
                 ToolUse("toolu_offline_0001", "read_file", {"path": "sample.txt"})],
                "tool_use",
            )
        content = _last_tool_result(messages)
        n = len(content.splitlines())
        return Reply(
            [Text(f"sample.txt is a {n}-line note on the agent loop: the loop is the primitive, "
                  f"the model is stateless, and the harness owns termination.")],
            "end_turn",
        )


def _last_tool_result(messages: list) -> str:
    for msg in reversed(messages):
        content = msg.get("content")
        if isinstance(content, list):
            for block in content:
                if isinstance(block, dict) and block.get("type") == "tool_result":
                    return str(block.get("content", ""))
    return ""


# ---- the live model: the same interface over the Anthropic Messages API ------

class AnthropicModel:
    def __init__(self, client, model: str) -> None:
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
        # raw is the provider's full content (thinking blocks included), re-sent
        # verbatim so the tool_use ids stay aligned across turns.
        return Reply(blocks, resp.stop_reason, raw=resp.content)


def choose_model():
    key = os.environ.get("ANTHROPIC_API_KEY")
    if not key:
        return OfflineModel(), None, "offline (no ANTHROPIC_API_KEY)"
    try:
        from anthropic import Anthropic
    except ImportError:
        print("note: anthropic SDK missing; run 'pip install -r requirements.txt' for live mode.\n")
        return OfflineModel(), None, "offline (SDK not installed)"
    model_id = os.environ.get("ANTHROPIC_MODEL", "claude-sonnet-5")
    client = Anthropic(api_key=key)
    return AnthropicModel(client, model_id), client, f"live ({model_id})"


# ---- what the tools cost, in input tokens, on every request -----------------

def report_tool_cost(model, client) -> None:
    print("# tool-definition cost: what your tools add to every request")
    base = [{"role": "user", "content": TASK}]
    if client is None:
        est = len(json.dumps(TOOLS)) // 4
        print(f"  offline estimate: ~{est} tokens for {len(TOOLS)} tools (chars / 4, not a real tokenizer)")
        print("  set ANTHROPIC_API_KEY for exact counts from the count_tokens endpoint.\n")
        return
    try:
        without = client.messages.count_tokens(model=model.model, messages=base).input_tokens
        witht = client.messages.count_tokens(model=model.model, messages=base, tools=TOOLS).input_tokens
        print(f"  without tools: {without} input tokens")
        print(f"  with {len(TOOLS)} tools:  {witht} input tokens")
        print(f"  the tool definitions add {witht - without} tokens to every request this session.\n")
    except Exception as exc:  # noqa: BLE001 -- token counting is best-effort here
        print(f"  (count_tokens unavailable: {exc})\n")


# ---- the trace --------------------------------------------------------------

def show(label: str, obj) -> None:
    print(f"{label}:")
    for line in json.dumps(obj, indent=2, ensure_ascii=False).splitlines():
        print("    " + line)


def main() -> None:
    model, client, mode = choose_model()
    print(f"# tool-call tracer, {mode}")
    print(f"# task: {TASK}\n")
    report_tool_cost(model, client)

    messages: list = [{"role": "user", "content": TASK}]
    for turn in range(1, MAX_TURNS + 1):
        print(f"=== turn {turn} " + "=" * 40)

        # decide: one forward pass emits content and stops
        reply = model.create(messages, TOOLS)
        assistant_dicts = [block_to_dict(b) for b in reply.content]
        show("assistant content (what the model emitted)", assistant_dicts)
        print(f"    stop_reason: {reply.stop_reason!r}\n")

        # append the assistant turn verbatim (raw in live mode, rebuilt offline)
        assistant_content = reply.raw if reply.raw is not None else assistant_dicts
        messages.append({"role": "assistant", "content": assistant_content})

        # the harness owns termination: no tool_use means the model is done
        tool_uses = [b for b in reply.content if isinstance(b, ToolUse)]
        if reply.stop_reason != "tool_use" or not tool_uses:
            final = next((b.text for b in reversed(reply.content) if isinstance(b, Text)), "(no text)")
            print(f">> {final}")
            return

        # execute each tool, then return the results as the next user turn
        results = []
        for b in tool_uses:
            content, is_error = run_tool(b.name, b.input)
            block = {"type": "tool_result", "tool_use_id": b.id, "content": content}
            if is_error:
                block["is_error"] = True
            results.append(block)
        show("tool_result blocks (what your harness returns)", results)
        print()
        messages.append({"role": "user", "content": results})

    print("hit MAX_TURNS: the harness stops the loop.")


if __name__ == "__main__":
    main()
