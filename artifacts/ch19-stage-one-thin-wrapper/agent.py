#!/usr/bin/env python3
"""A supervised Stage One coding-agent REPL.

Provider example: Anthropic Messages API. The loop and tool lifecycle are portable;
the response shape and client construction below are specific to this SDK.
"""

from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
from types import SimpleNamespace
from typing import Any, Callable
from unittest.mock import patch


MAX_OUTPUT_CHARS = 10_000
COMMAND_TIMEOUT_SECONDS = 120
NORMAL_COMPLETION_STOP_REASON = "end_turn"
TRUNCATED_STOP_REASONS = ("max_tokens", "model_context_window_exceeded")
SYSTEM_PROMPT = (
    "You are a coding agent operating in the selected workspace. "
    "Use the available tools to inspect files, make careful changes, and verify them. "
    "Explain the completed work when no more tools are needed."
)

TOOL_SCHEMAS: list[dict[str, Any]] = [
    {
        "name": "read_file",
        "description": "Read a UTF-8 file inside the workspace with line numbers. Read before editing.",
        "input_schema": {
            "type": "object",
            "properties": {"path": {"type": "string"}},
            "required": ["path"],
        },
    },
    {
        "name": "list_files",
        "description": "List files and directories below a workspace-relative path. Default is the workspace root.",
        "input_schema": {
            "type": "object",
            "properties": {"path": {"type": "string"}},
        },
    },
    {
        "name": "edit_file",
        "description": (
            "Replace one unique exact old_str with new_str in a workspace file. "
            "To create a new file, use an empty old_str only when the path does not exist."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "path": {"type": "string"},
                "old_str": {"type": "string"},
                "new_str": {"type": "string"},
            },
            "required": ["path", "old_str", "new_str"],
        },
    },
    {
        "name": "run_bash",
        "description": (
            "Run a shell command in the workspace and return combined output. "
            "Use for tests, searches, builds, and inspection."
        ),
        "input_schema": {
            "type": "object",
            "properties": {"command": {"type": "string"}},
            "required": ["command"],
        },
    },
]


def clip(text: str, limit: int = MAX_OUTPUT_CHARS) -> str:
    if len(text) <= limit:
        return text
    return text[:limit] + "\n[output truncated by Stage One]"


class WorkspaceTools:
    """The local action surface for one REPL session."""

    def __init__(self, workspace: Path) -> None:
        self.workspace = workspace.resolve()
        self.command_environment = {
            name: value
            for name, value in os.environ.items()
            if name != "ANTHROPIC_API_KEY"
        }
        self.command_environment.update(
            {
                "PAGER": "cat",
                "GIT_PAGER": "cat",
                "MANPAGER": "cat",
                "PIP_PROGRESS_BAR": "off",
                "TQDM_DISABLE": "1",
            }
        )

    def resolve_path(self, raw_path: str) -> Path:
        requested = Path(raw_path).expanduser()
        candidate = requested.resolve() if requested.is_absolute() else (self.workspace / requested).resolve()
        try:
            candidate.relative_to(self.workspace)
        except ValueError as error:
            raise ValueError("path must stay inside the selected workspace") from error
        return candidate

    def read_file(self, path: str) -> str:
        file_path = self.resolve_path(path)
        if not file_path.is_file():
            raise FileNotFoundError("not a file: {}".format(path))
        lines = file_path.read_text(encoding="utf-8").splitlines()
        return "\n".join("{:>6}\t{}".format(number, line) for number, line in enumerate(lines, start=1))

    def list_files(self, path: str = ".") -> str:
        directory = self.resolve_path(path)
        if not directory.is_dir():
            raise NotADirectoryError("not a directory: {}".format(path))
        entries: list[str] = []
        for candidate in sorted(directory.rglob("*")):
            if ".git" in candidate.parts:
                continue
            relative = candidate.relative_to(self.workspace)
            suffix = "/" if candidate.is_dir() else ""
            entries.append(str(relative) + suffix)
        return "\n".join(entries) if entries else "(empty)"

    def edit_file(self, path: str, old_str: str, new_str: str) -> str:
        file_path = self.resolve_path(path)
        if not file_path.exists():
            if old_str:
                raise FileNotFoundError("file does not exist, so old_str cannot be replaced: {}".format(path))
            file_path.parent.mkdir(parents=True, exist_ok=True)
            file_path.write_text(new_str, encoding="utf-8")
            return "Created {}".format(path)
        if not file_path.is_file():
            raise ValueError("not a file: {}".format(path))
        if not old_str:
            raise ValueError("old_str must be non-empty when editing an existing file")
        if old_str == new_str:
            raise ValueError("old_str and new_str must differ")

        content = file_path.read_text(encoding="utf-8")
        first_match = content.find(old_str)
        if first_match == -1:
            raise ValueError("old_str was not found in {}".format(path))
        if content.find(old_str, first_match + 1) != -1:
            raise ValueError("old_str matched more than once in {}; make it unique".format(path))

        file_path.write_text(content.replace(old_str, new_str, 1), encoding="utf-8")
        return "Updated {}".format(path)

    def run_bash(self, command: str) -> str:
        result = subprocess.run(
            command,
            shell=True,
            cwd=self.workspace,
            capture_output=True,
            text=True,
            timeout=COMMAND_TIMEOUT_SECONDS,
            env=self.command_environment,
        )
        output = clip(result.stdout + result.stderr)
        return "(exit {})\n{}".format(result.returncode, output)


ToolHandler = Callable[..., str]


def dispatch(tools: WorkspaceTools, name: str, arguments: Any) -> tuple[str, bool]:
    handlers: dict[str, ToolHandler] = {
        "read_file": tools.read_file,
        "list_files": tools.list_files,
        "edit_file": tools.edit_file,
        "run_bash": tools.run_bash,
    }
    handler = handlers.get(name)
    if handler is None:
        return "Error: unknown tool {}".format(name), True
    if not isinstance(arguments, dict):
        return "Error: tool arguments must be an object", True
    try:
        return handler(**arguments), False
    except Exception as error:
        return "Error: {}".format(error), True


def configured_model() -> str:
    model = os.environ.get("THIN_WRAPPER_MODEL", "").strip()
    if not model:
        raise RuntimeError("THIN_WRAPPER_MODEL is required. Set it to a current tool-capable model ID.")
    return model


def create_client() -> Any:
    api_key = os.environ.get("ANTHROPIC_API_KEY", "").strip()
    if not api_key:
        raise RuntimeError("ANTHROPIC_API_KEY is required. Export it before starting the REPL.")
    try:
        import anthropic
    except ImportError as error:
        raise RuntimeError("Missing SDK. Run: python3 -m pip install -r requirements.txt") from error
    return anthropic.Anthropic(api_key=api_key)


def print_assistant_text(response: Any) -> None:
    for block in response.content:
        if getattr(block, "type", None) != "text":
            continue
        text = getattr(block, "text", "").strip()
        if text:
            print("agent: {}".format(text))


def run_agent(
    client: Any,
    model: str,
    tools: WorkspaceTools,
    messages: list[dict[str, Any]],
    max_steps: int,
) -> None:
    for step in range(1, max_steps + 1):
        response = client.messages.create(
            model=model,
            max_tokens=4096,
            system=SYSTEM_PROMPT,
            tools=TOOL_SCHEMAS,
            messages=messages,
        )
        messages.append({"role": "assistant", "content": response.content})

        tool_uses = [block for block in response.content if getattr(block, "type", None) == "tool_use"]
        if not tool_uses:
            stop_reason = getattr(response, "stop_reason", None)
            if stop_reason == NORMAL_COMPLETION_STOP_REASON:
                print_assistant_text(response)
                return
            if stop_reason in TRUNCATED_STOP_REASONS:
                raise RuntimeError(
                    "model response was truncated ({}) instead of completing the turn".format(stop_reason)
                )
            raise RuntimeError(
                "model returned no tool use with stop_reason {!r}; "
                "Stage One accepts only end_turn as a completed turn".format(stop_reason)
            )

        print_assistant_text(response)

        results: list[dict[str, Any]] = []
        for tool_use in tool_uses:
            name = str(getattr(tool_use, "name", ""))
            arguments = getattr(tool_use, "input", {})
            print("tool: {}({})".format(name, json.dumps(arguments, ensure_ascii=False)))
            content, is_error = dispatch(tools, name, arguments)
            results.append(
                {
                    "type": "tool_result",
                    "tool_use_id": getattr(tool_use, "id"),
                    "content": content,
                    "is_error": is_error,
                }
            )

        messages.append({"role": "user", "content": results})
        print("loop: completed step {}".format(step))

    raise RuntimeError("max_steps reached; this Stage One wrapper stops instead of looping forever")


def run_repl(client: Any, model: str, tools: WorkspaceTools, max_steps: int) -> None:
    messages: list[dict[str, Any]] = []
    print("Stage One coding agent ready. Type /quit to exit.")
    while True:
        try:
            request = input("you> ").strip()
        except (EOFError, KeyboardInterrupt):
            print()
            return
        if request in {"/quit", "/exit"}:
            return
        if not request:
            continue

        turn_start = len(messages)
        messages.append({"role": "user", "content": request})
        try:
            run_agent(client, model, tools, messages, max_steps)
        except Exception as error:
            del messages[turn_start:]
            print(
                "agent error: {}; incomplete turn removed from history".format(error),
                file=sys.stderr,
            )


def run_self_test() -> None:
    class OfflineClient:
        def __init__(self, responses: list[Any]) -> None:
            self._responses = iter(responses)
            self.messages = self

        def create(self, **_: Any) -> Any:
            return next(self._responses)

    def fake_response(stop_reason: str, content: list[Any]) -> Any:
        return SimpleNamespace(content=content, stop_reason=stop_reason)

    with tempfile.TemporaryDirectory(prefix="thin-wrapper-check-") as temporary_directory:
        workspace = Path(temporary_directory)
        tools = WorkspaceTools(workspace)
        sample = workspace / "sample.txt"
        sample.write_text("alpha\nbeta\n", encoding="utf-8")

        rendered = tools.read_file("sample.txt")
        assert "     1\talpha" in rendered
        assert tools.edit_file("sample.txt", "beta", "gamma") == "Updated sample.txt"
        assert "gamma" in sample.read_text(encoding="utf-8")
        assert "sample.txt" in tools.list_files()

        error_text, is_error = dispatch(tools, "edit_file", {"path": "sample.txt", "old_str": "missing", "new_str": "x"})
        assert is_error
        assert "not found" in error_text

        overlap = workspace / "overlap.txt"
        overlap.write_text("aaaa", encoding="utf-8")
        overlap_error_text, overlap_is_error = dispatch(
            tools,
            "edit_file",
            {"path": "overlap.txt", "old_str": "aaa", "new_str": "X"},
        )
        assert overlap_is_error
        assert "more than once" in overlap_error_text
        assert overlap.read_text(encoding="utf-8") == "aaaa"

        escape_text, escape_error = dispatch(tools, "read_file", {"path": "../outside.txt"})
        assert escape_error
        assert "inside the selected workspace" in escape_text

        command_output = tools.run_bash("printf 'agent-check'")
        assert "(exit 0)" in command_output
        assert "agent-check" in command_output

        fixture_key = "self-test-key-must-not-reach-shell"
        with patch.dict(os.environ, {"ANTHROPIC_API_KEY": fixture_key}, clear=False):
            credential_tools = WorkspaceTools(workspace)
            credential_output = credential_tools.run_bash("printf '%s' \"$ANTHROPIC_API_KEY\"")
        assert fixture_key not in credential_output
        assert credential_output == "(exit 0)\n"

        for stop_reason in TRUNCATED_STOP_REASONS:
            truncated_client = OfflineClient(
                [
                    fake_response(
                        stop_reason,
                        [SimpleNamespace(type="text", text="partial response")],
                    )
                ]
            )
            try:
                run_agent(truncated_client, "offline-test-model", tools, [], max_steps=1)
            except RuntimeError as error:
                assert stop_reason in str(error)
            else:
                raise AssertionError("{} must fail loudly".format(stop_reason))

        tool_then_complete_client = OfflineClient(
            [
                fake_response(
                    "max_tokens",
                    [
                        SimpleNamespace(
                            type="tool_use",
                            id="toolu_offline_check",
                            name="read_file",
                            input={"path": "sample.txt"},
                        )
                    ],
                ),
                fake_response(
                    NORMAL_COMPLETION_STOP_REASON,
                    [SimpleNamespace(type="text", text="offline check complete")],
                ),
            ]
        )
        tool_history: list[dict[str, Any]] = []
        run_agent(tool_then_complete_client, "offline-test-model", tools, tool_history, max_steps=2)
        tool_result = tool_history[1]["content"][0]
        assert tool_result["type"] == "tool_result"
        assert tool_result["is_error"] is False

    print("self-check passed")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run the Stage One thin-wrapper coding agent.")
    parser.add_argument("--workspace", type=Path, default=Path.cwd(), help="Directory the REPL starts in.")
    parser.add_argument("--max-steps", type=int, default=50, help="Maximum model calls for one user request.")
    parser.add_argument("--self-test", action="store_true", help="Run an offline tool and dispatch check.")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    if args.self_test:
        run_self_test()
        return 0
    if args.max_steps < 1:
        print("--max-steps must be at least 1", file=sys.stderr)
        return 2

    workspace = args.workspace.expanduser().resolve()
    if not workspace.is_dir():
        print("workspace is not a directory: {}".format(workspace), file=sys.stderr)
        return 2

    try:
        model = configured_model()
        client = create_client()
    except RuntimeError as error:
        print("startup error: {}".format(error), file=sys.stderr)
        return 2

    run_repl(client, model, WorkspaceTools(workspace), args.max_steps)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
