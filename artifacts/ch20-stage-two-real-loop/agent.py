#!/usr/bin/env python3
"""A compact Stage Two coding-agent harness.

The default ScriptedProvider is fully offline. It exercises real workspace tools,
one-owner retries, tool-result pairing, permission checks, shell process-group
timeouts, output caps, and deterministic context management.

AnthropicProvider is a labelled product example. It streams a live turn when the
optional SDK, API key, and current model identifier are supplied. The loop and tool
contracts do not depend on that provider.
"""

from __future__ import annotations

import argparse
from dataclasses import dataclass, field
import json
import os
from pathlib import Path
import random
import shlex
import signal
import subprocess
import sys
import tempfile
import time
from typing import Any, Callable, Protocol
from unittest.mock import patch


MAX_FILE_CHARS = 10_000
MAX_TOOL_OUTPUT_CHARS = 30_000
MAX_LIST_RESULTS = 100
DEFAULT_SHELL_TIMEOUT_SECONDS = 20.0
TRANSIENT_STATUS_CODES = {408, 409, 429, 500, 502, 503, 504, 529}
READ_TOOLS = {"list_files", "read_file", "search_files"}
WRITE_TOOLS = {"replace_once"}


class ConfigurationError(RuntimeError):
    """The requested provider or workspace cannot be configured safely."""


class ToolFailure(RuntimeError):
    """A tool failed in a way that should be returned to the model."""


class TransientModelError(RuntimeError):
    """A model request may be retried by the one configured retry owner."""


class FatalModelError(RuntimeError):
    """A model request needs repair instead of another retry."""


@dataclass(frozen=True)
class ToolCall:
    id: str
    name: str
    arguments: Any


@dataclass(frozen=True)
class ToolResult:
    tool_use_id: str
    content: str
    is_error: bool = False

    def as_block(self) -> dict[str, Any]:
        return {
            "type": "tool_result",
            "tool_use_id": self.tool_use_id,
            "content": self.content,
            "is_error": self.is_error,
        }


@dataclass(frozen=True)
class ProviderTurn:
    content: list[dict[str, Any]]
    calls: list[ToolCall]
    stop_reason: str


@dataclass
class RunReport:
    history: list[dict[str, Any]]
    tool_results: list[ToolResult] = field(default_factory=list)
    retries: int = 0
    context_actions: list[str] = field(default_factory=list)
    completed: bool = False


class Provider(Protocol):
    def next_turn(self, history: list[dict[str, Any]]) -> ProviderTurn:
        """Return one fully reconstructed assistant turn."""


def middle_clip(text: str, limit: int) -> str:
    """Keep useful head and tail context while enforcing a hard character budget."""
    if len(text) <= limit:
        return text
    marker = "\n[... middle truncated by harness ...]\n"
    if limit <= len(marker) + 2:
        return text[:limit]
    keep = (limit - len(marker)) // 2
    return text[:keep] + marker + text[-keep:]


def require_object(arguments: Any, tool_name: str) -> dict[str, Any]:
    if not isinstance(arguments, dict):
        raise ToolFailure("{} arguments must be an object".format(tool_name))
    return arguments


def require_keys(
    arguments: dict[str, Any],
    tool_name: str,
    required: set[str],
    optional: set[str] | None = None,
) -> None:
    optional = optional or set()
    missing = sorted(required - set(arguments))
    extra = sorted(set(arguments) - required - optional)
    if missing:
        raise ToolFailure("{} is missing required fields: {}".format(tool_name, ", ".join(missing)))
    if extra:
        raise ToolFailure("{} received unknown fields: {}".format(tool_name, ", ".join(extra)))


class WorkspaceTools:
    """Small, high-leverage filesystem and shell tools for one selected workspace."""

    def __init__(
        self,
        workspace: Path,
        *,
        max_file_chars: int = MAX_FILE_CHARS,
        max_output_chars: int = MAX_TOOL_OUTPUT_CHARS,
        shell_timeout_seconds: float = DEFAULT_SHELL_TIMEOUT_SECONDS,
    ) -> None:
        self.workspace = workspace.resolve()
        self.max_file_chars = max_file_chars
        self.max_output_chars = max_output_chars
        self.shell_timeout_seconds = shell_timeout_seconds
        if not self.workspace.is_dir():
            raise ConfigurationError("workspace is not a directory: {}".format(self.workspace))
        self.shell_environment = {
            name: value
            for name, value in os.environ.items()
            if name != "ANTHROPIC_API_KEY"
        }
        self.shell_environment.update(
            {
                "PAGER": "cat",
                "GIT_PAGER": "cat",
                "MANPAGER": "cat",
                "PIP_PROGRESS_BAR": "off",
            }
        )

    def resolve_path(self, raw_path: str) -> Path:
        if not isinstance(raw_path, str) or not raw_path.strip():
            raise ToolFailure("path must be a non-empty string")
        requested = Path(raw_path).expanduser()
        candidate = requested.resolve() if requested.is_absolute() else (self.workspace / requested).resolve()
        try:
            candidate.relative_to(self.workspace)
        except ValueError as error:
            raise ToolFailure("path must stay inside the selected workspace: {}".format(raw_path)) from error
        return candidate

    def list_files(self, path: str = ".") -> str:
        directory = self.resolve_path(path)
        if not directory.is_dir():
            raise ToolFailure("not a directory: {}".format(path))
        entries: list[str] = []
        for candidate in sorted(directory.rglob("*")):
            if ".git" in candidate.parts:
                continue
            relative = candidate.relative_to(self.workspace)
            entries.append(str(relative) + ("/" if candidate.is_dir() else ""))
            if len(entries) == MAX_LIST_RESULTS:
                return "\n".join(entries) + "\n[list truncated at {} entries]".format(MAX_LIST_RESULTS)
        return "\n".join(entries) if entries else "(empty workspace)"

    def read_file(self, path: str, max_chars: int | None = None) -> str:
        file_path = self.resolve_path(path)
        if not file_path.is_file():
            raise ToolFailure("not a file: {}".format(path))
        if max_chars is not None and (isinstance(max_chars, bool) or not isinstance(max_chars, int) or max_chars <= 0):
            raise ToolFailure("max_chars must be a positive integer")
        limit = min(max_chars or self.max_file_chars, self.max_file_chars)
        try:
            lines = file_path.read_text(encoding="utf-8").splitlines()
        except UnicodeDecodeError as error:
            raise ToolFailure("file is not UTF-8 text: {}".format(path)) from error
        numbered = "\n".join(
            "{:>6}\t{}".format(number, line) for number, line in enumerate(lines, start=1)
        )
        return middle_clip(numbered, limit)

    def search_files(self, query: str, path: str = ".") -> str:
        if not isinstance(query, str) or not query:
            raise ToolFailure("query must be a non-empty string")
        directory = self.resolve_path(path)
        if not directory.is_dir():
            raise ToolFailure("search path is not a directory: {}".format(path))
        matches: list[str] = []
        for candidate in sorted(directory.rglob("*")):
            if ".git" in candidate.parts:
                continue
            try:
                resolved_candidate = candidate.resolve(strict=True)
                resolved_candidate.relative_to(self.workspace)
            except (OSError, ValueError):
                continue
            if not resolved_candidate.is_file():
                continue
            try:
                lines = resolved_candidate.read_text(encoding="utf-8").splitlines()
            except (OSError, UnicodeDecodeError):
                continue
            for line_number, line in enumerate(lines, start=1):
                if query in line:
                    relative = candidate.relative_to(self.workspace)
                    matches.append("{}:{}:{}".format(relative, line_number, line))
                    if len(matches) == MAX_LIST_RESULTS:
                        matches.append("[search truncated at {} matches]".format(MAX_LIST_RESULTS))
                        return middle_clip("\n".join(matches), self.max_output_chars)
        rendered = "\n".join(matches) if matches else "no matches for {!r}".format(query)
        return middle_clip(rendered, self.max_output_chars)

    def replace_once(self, path: str, old_str: str, new_str: str) -> str:
        if not isinstance(old_str, str) or not isinstance(new_str, str):
            raise ToolFailure("old_str and new_str must be strings")
        file_path = self.resolve_path(path)
        if not file_path.is_file():
            raise ToolFailure("replace_once requires an existing file: {}".format(path))
        if not old_str:
            raise ToolFailure("old_str must be non-empty; read the file and use one exact span")
        if old_str == new_str:
            raise ToolFailure("old_str and new_str are identical; no edit was made")
        try:
            content = file_path.read_text(encoding="utf-8")
        except UnicodeDecodeError as error:
            raise ToolFailure("file is not UTF-8 text: {}".format(path)) from error
        count = content.count(old_str)
        if count == 0:
            raise ToolFailure(
                "old_str was not found in {}; read the current file and retry with an exact span".format(path)
            )
        if count > 1:
            raise ToolFailure(
                "old_str matched {} times in {}; add surrounding lines to make the replacement unique".format(
                    count, path
                )
            )
        file_path.write_text(content.replace(old_str, new_str, 1), encoding="utf-8")
        return "updated {} once; review the changed line and run a focused check".format(path)

    def run_shell(self, command: str) -> str:
        if not isinstance(command, str) or not command.strip():
            raise ToolFailure("command must be a non-empty string")
        try:
            process = subprocess.Popen(
                command,
                shell=True,
                cwd=self.workspace,
                stdin=subprocess.DEVNULL,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                env=self.shell_environment,
                start_new_session=True,
            )
        except OSError as error:
            raise ToolFailure("could not start shell command: {}".format(error)) from error

        try:
            output, _ = process.communicate(timeout=self.shell_timeout_seconds)
        except KeyboardInterrupt:
            self._stop_process_group(process)
            output, _ = process.communicate()
            raise ToolFailure(
                "[Request interrupted by user] command interrupted; its process group was terminated\n{}".format(
                    middle_clip(output or "", self.max_output_chars)
                )
            )
        except subprocess.TimeoutExpired:
            self._stop_process_group(process)
            output, _ = process.communicate()
            raise ToolFailure(
                "command timed out after {:.1f}s; its process group was terminated\n{}".format(
                    self.shell_timeout_seconds, middle_clip(output or "", self.max_output_chars)
                )
            )

        output = middle_clip(output or "", self.max_output_chars)
        if process.returncode != 0:
            raise ToolFailure("command exited {}\n{}".format(process.returncode, output))
        return "(exit 0)\n{}".format(output)

    @staticmethod
    def _stop_process_group(process: subprocess.Popen[str]) -> None:
        if os.name != "posix":
            process.kill()
            return
        try:
            os.killpg(process.pid, signal.SIGTERM)
        except ProcessLookupError:
            return
        try:
            process.wait(timeout=0.2)
        except subprocess.TimeoutExpired:
            try:
                os.killpg(process.pid, signal.SIGKILL)
            except ProcessLookupError:
                return


class PermissionGate:
    """A basic human-in-the-loop gate, deliberately not a security boundary."""

    def __init__(self, mode: str, interactive: bool) -> None:
        self.mode = mode
        self.interactive = interactive

    def allows(self, call: ToolCall) -> bool:
        if call.name in READ_TOOLS:
            return True
        if self.mode == "dangerously-skip-permissions":
            return True
        if self.mode == "accept-edits" and call.name in WRITE_TOOLS:
            return True
        if not self.interactive:
            return False
        answer = input(
            "approve {} with {}? [y/N] ".format(
                call.name, json.dumps(call.arguments, ensure_ascii=False, sort_keys=True)
            )
        )
        return answer.strip().lower() in {"y", "yes"}


def run_tool_safely(tools: WorkspaceTools, gate: PermissionGate, call: ToolCall) -> ToolResult:
    handlers: dict[str, Callable[..., str]] = {
        "list_files": tools.list_files,
        "read_file": tools.read_file,
        "search_files": tools.search_files,
        "replace_once": tools.replace_once,
        "run_shell": tools.run_shell,
    }
    handler = handlers.get(call.name)
    if handler is None:
        return ToolResult(
            call.id,
            "unknown tool {!r}; available tools: {}".format(call.name, ", ".join(sorted(handlers))),
            True,
        )
    try:
        arguments = require_object(call.arguments, call.name)
        _validate_tool_arguments(call.name, arguments)
        if not gate.allows(call):
            return ToolResult(
                call.id,
                "permission denied for {}; request approval or choose a read-only next step".format(call.name),
                True,
            )
        return ToolResult(call.id, handler(**arguments))
    except Exception as error:
        return ToolResult(call.id, "error running {}: {}".format(call.name, error), True)


def _validate_tool_arguments(name: str, arguments: dict[str, Any]) -> None:
    if name == "list_files":
        require_keys(arguments, name, set(), {"path"})
    elif name == "read_file":
        require_keys(arguments, name, {"path"}, {"max_chars"})
    elif name == "search_files":
        require_keys(arguments, name, {"query"}, {"path"})
    elif name == "replace_once":
        require_keys(arguments, name, {"path", "old_str", "new_str"})
    elif name == "run_shell":
        require_keys(arguments, name, {"command"})


class ContextManager:
    """Local demonstration of clear-first, compact-last context management."""

    def __init__(self, task: str, clear_at_chars: int, compact_at_chars: int) -> None:
        if clear_at_chars >= compact_at_chars:
            raise ValueError("clear threshold must be lower than compact threshold")
        self.task = task
        self.clear_at_chars = clear_at_chars
        self.compact_at_chars = compact_at_chars

    def manage(self, history: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], str | None]:
        used = len(json.dumps(history, ensure_ascii=False, default=str))
        if used >= self.compact_at_chars:
            return self._compact(history, used)
        if used >= self.clear_at_chars:
            return self._clear_old_results(history, used)
        return history, None

    def _clear_old_results(
        self, history: list[dict[str, Any]], used: int
    ) -> tuple[list[dict[str, Any]], str | None]:
        result_indexes = [
            index
            for index, message in enumerate(history)
            if _contains_tool_result(message.get("content"))
        ]
        if len(result_indexes) < 2:
            return history, None
        newest = result_indexes[-1]
        cleared: list[dict[str, Any]] = []
        for index, message in enumerate(history):
            copy = dict(message)
            content = message.get("content")
            if index != newest and _contains_tool_result(content):
                copy["content"] = [
                    {
                        **block,
                        "content": "[cleared stale tool output; tool_use_id retained, re-fetch if needed]",
                    }
                    if isinstance(block, dict) and block.get("type") == "tool_result"
                    else block
                    for block in content
                ]
            cleared.append(copy)
        return cleared, "cleared stale tool output at {} local characters".format(used)

    def _compact(
        self, history: list[dict[str, Any]], used: int
    ) -> tuple[list[dict[str, Any]], str]:
        completed: list[str] = []
        failures: list[str] = []
        for message in history:
            content = message.get("content")
            if not isinstance(content, list):
                continue
            for block in content:
                if not isinstance(block, dict) or block.get("type") != "tool_result":
                    continue
                identifier = str(block.get("tool_use_id", "unknown"))
                (failures if block.get("is_error") else completed).append(identifier)
        summary = "\n".join(
            [
                "structured continuation summary",
                "task: {}".format(self.task),
                "completed tool calls: {}".format(", ".join(completed[-8:]) or "none"),
                "failed tool calls: {}".format(", ".join(failures[-8:]) or "none"),
                "next step: inspect the most recent result, preserve workspace facts, and continue without replaying old bulk",
            ]
        )
        tail: list[dict[str, Any]] = []
        if len(history) >= 2 and [message.get("role") for message in history[-2:]] == ["assistant", "user"]:
            tail = history[-2:]
        compacted = [
            {
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": "Context continuation supplied by the harness:\n{}".format(summary),
                    }
                ],
            },
            *tail,
        ]
        _assert_legal_anthropic_history(compacted)
        return compacted, "compacted {} local characters into a structured continuation summary".format(used)


def _contains_tool_result(content: Any) -> bool:
    return isinstance(content, list) and any(
        isinstance(block, dict) and block.get("type") == "tool_result" for block in content
    )


def _assert_legal_anthropic_history(history: list[dict[str, Any]]) -> None:
    """Assert the user-first, alternating client-tool history sent to Anthropic."""
    assert history, "Anthropic history must contain at least one user message"
    assert history[0].get("role") == "user", "Anthropic history must start with a user message"
    previous_role: str | None = None
    for index, message in enumerate(history):
        role = message.get("role")
        assert role in {"user", "assistant"}, "Anthropic history has an unsupported role"
        assert role != previous_role, "Anthropic history roles must alternate"
        previous_role = role

        if role != "assistant":
            continue
        content = message.get("content")
        if not isinstance(content, list):
            continue
        tool_use_ids = [
            str(block.get("id", ""))
            for block in content
            if isinstance(block, dict) and block.get("type") == "tool_use"
        ]
        if not tool_use_ids:
            continue
        assert index + 1 < len(history), "assistant tool calls need a following user result message"
        next_message = history[index + 1]
        assert next_message.get("role") == "user", "tool results must immediately follow assistant tool calls"
        result_content = next_message.get("content")
        assert isinstance(result_content, list), "tool results must be content blocks"
        tool_result_ids = [
            str(block.get("tool_use_id", ""))
            for block in result_content
            if isinstance(block, dict) and block.get("type") == "tool_result"
        ]
        assert tool_result_ids == tool_use_ids, "tool results must match the adjacent assistant tool calls"


def invoke_with_retry(
    operation: Callable[[], ProviderTurn],
    *,
    max_attempts: int,
    emit: Callable[[str, str], None],
    sleep_fn: Callable[[float], None],
    random_fn: Callable[[], float] = random.random,
) -> tuple[ProviderTurn, int]:
    for attempt in range(1, max_attempts + 1):
        try:
            return operation(), attempt
        except TransientModelError as error:
            if attempt == max_attempts:
                raise
            delay = min(0.5 * (2 ** (attempt - 1)), 8.0) * (1.0 - 0.25 * random_fn())
            emit(
                "retry",
                "transient model error on attempt {}/{}: {}; retrying in {:.2f}s".format(
                    attempt, max_attempts, error, delay
                ),
            )
            sleep_fn(delay)
    raise AssertionError("retry loop must return or raise")


class ScriptedProvider:
    """Offline provider that makes the recovery path deterministic and inspectable."""

    def __init__(self, transient_failures: int = 1) -> None:
        self.transient_failures = transient_failures
        self.index = 0
        verify_command = "{} -c {}".format(
            shlex.quote(sys.executable), shlex.quote("print('focused check passed')")
        )
        self.turns = [
            _tool_turn(
                "plan: inspect config.py, use one exact edit, then run a focused check",
                ToolCall("read_01", "read_file", {"path": "config.py"}),
            ),
            _tool_turn(
                "attempting the requested exact edit",
                ToolCall(
                    "edit_02",
                    "replace_once",
                    {"path": "config.py", "old_str": "DEBUG = False", "new_str": "DEBUG = False"},
                ),
            ),
            _tool_turn(
                "the edit failed cleanly; reread the current line before retrying",
                ToolCall("read_03", "read_file", {"path": "config.py"}),
            ),
            _tool_turn(
                "the current value is known; replace it exactly once",
                ToolCall(
                    "edit_04",
                    "replace_once",
                    {"path": "config.py", "old_str": "DEBUG = True", "new_str": "DEBUG = False"},
                ),
            ),
            _tool_turn(
                "the edit is complete; ask the shell to run a tiny focused check",
                ToolCall("check_05", "run_shell", {"command": verify_command}),
            ),
            ProviderTurn(
                content=[
                    {
                        "type": "text",
                        "text": "final: config.py is updated. Any denied tool result remains visible for the next human decision.",
                    }
                ],
                calls=[],
                stop_reason="end_turn",
            ),
        ]

    def next_turn(self, history: list[dict[str, Any]]) -> ProviderTurn:
        del history
        if self.transient_failures:
            self.transient_failures -= 1
            raise TransientModelError("simulated 529 overload")
        if self.index >= len(self.turns):
            return ProviderTurn(
                content=[{"type": "text", "text": "final: scripted plan is complete"}],
                calls=[],
                stop_reason="end_turn",
            )
        turn = self.turns[self.index]
        self.index += 1
        return turn


def _tool_turn(text: str, call: ToolCall) -> ProviderTurn:
    return ProviderTurn(
        content=[
            {"type": "text", "text": text},
            {"type": "tool_use", "id": call.id, "name": call.name, "input": call.arguments},
        ],
        calls=[call],
        stop_reason="tool_use",
    )


TOOL_SCHEMAS: list[dict[str, Any]] = [
    {
        "name": "list_files",
        "description": "List up to 100 workspace-relative entries. Use it to discover the local shape.",
        "input_schema": {
            "type": "object",
            "properties": {"path": {"type": "string"}},
        },
    },
    {
        "name": "read_file",
        "description": "Read a UTF-8 workspace file with line numbers and a character cap. Read before editing.",
        "input_schema": {
            "type": "object",
            "properties": {
                "path": {"type": "string"},
                "max_chars": {"type": "integer", "minimum": 1},
            },
            "required": ["path"],
        },
    },
    {
        "name": "search_files",
        "description": "Search UTF-8 workspace files and return capped matching lines with file paths and line numbers.",
        "input_schema": {
            "type": "object",
            "properties": {"query": {"type": "string"}, "path": {"type": "string"}},
            "required": ["query"],
        },
    },
    {
        "name": "replace_once",
        "description": "Replace one unique exact span in an existing workspace file. Errors name absent or ambiguous text.",
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
        "name": "run_shell",
        "description": "Run a shell command in the workspace with no stdin, timeout, process-group termination, and capped output.",
        "input_schema": {
            "type": "object",
            "properties": {"command": {"type": "string"}},
            "required": ["command"],
        },
    },
]


class AnthropicProvider:
    """Product example: a streaming adapter with SDK retries disabled."""

    def __init__(self, model: str, api_key: str, emit: Callable[[str, str], None]) -> None:
        if not model:
            raise ConfigurationError("the Anthropic provider needs --model with a current tool-capable model ID")
        if not api_key:
            raise ConfigurationError("set ANTHROPIC_API_KEY before using --provider anthropic")
        try:
            import anthropic
        except ImportError as error:
            raise ConfigurationError(
                "missing anthropic package; run python3 -m pip install anthropic before using this provider"
            ) from error
        self.anthropic = anthropic
        self.client = anthropic.Anthropic(api_key=api_key, max_retries=0)
        self.model = model
        self.emit = emit

    def next_turn(self, history: list[dict[str, Any]]) -> ProviderTurn:
        saw_message_stop = False
        text_parts: list[str] = []
        try:
            with self.client.messages.stream(
                model=self.model,
                max_tokens=4096,
                system=(
                    "You are a careful coding agent in one selected workspace. "
                    "Plan briefly, inspect before editing, use tools for ground truth, "
                    "and run focused checks after approved changes."
                ),
                tools=TOOL_SCHEMAS,
                messages=history,
            ) as stream:
                for event in stream:
                    event_type = getattr(event, "type", "")
                    if event_type == "content_block_delta":
                        delta = getattr(event, "delta", None)
                        if getattr(delta, "type", "") == "text_delta":
                            fragment = getattr(delta, "text", "")
                            text_parts.append(fragment)
                            self.emit("stream", fragment)
                    elif event_type == "error":
                        error = getattr(event, "error", None)
                        error_type = getattr(error, "type", "stream_error")
                        message = getattr(error, "message", "stream returned an error event")
                        if error_type in {"overloaded_error", "rate_limit_error", "timeout_error"}:
                            raise TransientModelError("{}: {}".format(error_type, message))
                        raise FatalModelError("{}: {}".format(error_type, message))
                    elif event_type == "message_stop":
                        saw_message_stop = True
                final = stream.get_final_message()
        except (KeyboardInterrupt, SystemExit):
            raise
        except TransientModelError:
            raise
        except Exception as error:
            status = getattr(error, "status_code", None)
            transient_types = tuple(
                candidate
                for candidate in (
                    getattr(self.anthropic, "RateLimitError", None),
                    getattr(self.anthropic, "APIConnectionError", None),
                    getattr(self.anthropic, "APITimeoutError", None),
                    getattr(self.anthropic, "InternalServerError", None),
                )
                if isinstance(candidate, type) and issubclass(candidate, BaseException)
            )
            if (transient_types and isinstance(error, transient_types)) or status in TRANSIENT_STATUS_CODES:
                raise TransientModelError(str(error)) from error
            raise FatalModelError(str(error)) from error

        if not saw_message_stop:
            raise TransientModelError("stream ended without message_stop; no tool dispatch occurred")

        content: list[dict[str, Any]] = []
        calls: list[ToolCall] = []
        for block in final.content:
            block_type = getattr(block, "type", "")
            if block_type == "text":
                content.append({"type": "text", "text": getattr(block, "text", "")})
            elif block_type == "tool_use":
                arguments = getattr(block, "input", {})
                identifier = str(getattr(block, "id", ""))
                name = str(getattr(block, "name", ""))
                content.append({"type": "tool_use", "id": identifier, "name": name, "input": arguments})
                calls.append(ToolCall(identifier, name, arguments))
            else:
                dump = getattr(block, "model_dump", None)
                if not callable(dump):
                    raise FatalModelError("unsupported streamed content block: {}".format(block_type))
                content.append(dump(mode="json"))

        if text_parts:
            self.emit("stream", "\n")
        return ProviderTurn(content=content, calls=calls, stop_reason=str(getattr(final, "stop_reason", "")))


def run_agent(
    provider: Provider,
    tools: WorkspaceTools,
    gate: PermissionGate,
    context: ContextManager,
    task: str,
    *,
    emit: Callable[[str, str], None],
    sleep_fn: Callable[[float], None] = time.sleep,
    max_steps: int = 12,
) -> RunReport:
    history: list[dict[str, Any]] = [{"role": "user", "content": task}]
    report = RunReport(history=history)

    for step in range(1, max_steps + 1):
        history, context_action = context.manage(history)
        if context_action:
            report.context_actions.append(context_action)
            emit("context", context_action)

        turn, attempts = invoke_with_retry(
            lambda: provider.next_turn(history),
            max_attempts=3,
            emit=emit,
            sleep_fn=sleep_fn,
        )
        report.retries += attempts - 1
        history.append({"role": "assistant", "content": turn.content})
        for block in turn.content:
            if block.get("type") == "text" and block.get("text"):
                emit("assistant", str(block["text"]))

        if not turn.calls:
            if turn.stop_reason != "end_turn":
                raise FatalModelError(
                    "assistant returned no tool calls with stop reason {!r}; expected end_turn".format(
                        turn.stop_reason
                    )
                )
            report.history = history
            report.completed = True
            emit("complete", "clean end_turn after {} inner steps".format(step))
            return report

        if turn.stop_reason != "tool_use":
            raise FatalModelError(
                "assistant returned tool calls with stop reason {!r}; dispatch refused".format(turn.stop_reason)
            )

        result_blocks: list[dict[str, Any]] = []
        for call in turn.calls:
            emit("tool", "{}({})".format(call.name, json.dumps(call.arguments, ensure_ascii=False)))
            result = run_tool_safely(tools, gate, call)
            report.tool_results.append(result)
            result_blocks.append(result.as_block())
            marker = "error" if result.is_error else "ok"
            preview = result.content.replace("\n", " | ")
            emit("result", "{} {} -> {}".format(marker, call.id, middle_clip(preview, 260)))
        history.append({"role": "user", "content": result_blocks})

    raise FatalModelError("max_steps reached; stop rather than spend indefinitely")


def run_demo(
    mode: str,
    *,
    emit: Callable[[str, str], None],
    sleep_fn: Callable[[float], None] = time.sleep,
) -> RunReport:
    with tempfile.TemporaryDirectory(prefix="stage-two-demo-") as raw_workspace:
        workspace = Path(raw_workspace)
        (workspace / "config.py").write_text("DEBUG = True\n", encoding="utf-8")
        provider = ScriptedProvider()
        tools = WorkspaceTools(workspace, max_output_chars=500, shell_timeout_seconds=2.0)
        gate = PermissionGate(mode, interactive=False)
        context = ContextManager(
            "Change DEBUG in config.py and run one focused check.",
            clear_at_chars=850,
            compact_at_chars=1_600,
        )
        return run_agent(
            provider,
            tools,
            gate,
            context,
            "Change DEBUG in config.py. Inspect before editing and run a focused check.",
            emit=emit,
            sleep_fn=sleep_fn,
        )


def self_test() -> None:
    """Run deterministic offline assertions against every hardening layer."""
    silent = lambda _kind, _message: None
    no_sleep = lambda _delay: None

    with tempfile.TemporaryDirectory(prefix="stage-two-self-test-") as raw_workspace, tempfile.TemporaryDirectory(
        prefix="stage-two-outside-"
    ) as raw_outside:
        workspace = Path(raw_workspace)
        outside = Path(raw_outside)
        (workspace / "config.py").write_text("DEBUG = True\nDEBUG = True\n", encoding="utf-8")
        (workspace / "notes.txt").write_text("alpha\nbeta\n", encoding="utf-8")
        outside_secret = outside / "audit-secret.txt"
        outside_secret.write_text("audit-secret\n", encoding="utf-8")
        (workspace / "linked.txt").symlink_to(outside_secret)
        tools = WorkspaceTools(
            workspace,
            max_file_chars=80,
            max_output_chars=100,
            shell_timeout_seconds=0.1,
        )

        listing = tools.list_files()
        assert "config.py" in listing and "notes.txt" in listing
        assert "1\talpha" in tools.read_file("notes.txt")
        assert "notes.txt:2:beta" in tools.search_files("beta")
        assert "linked.txt" not in tools.search_files("audit-secret")

        (workspace / "long-match.txt").write_text("needle " + "x" * 400 + "\n", encoding="utf-8")
        capped_search = tools.search_files("needle")
        assert "[... middle truncated by harness ...]" in capped_search
        assert len(capped_search) <= tools.max_output_chars

        ambiguous = run_tool_safely(
            tools,
            PermissionGate("accept-edits", interactive=False),
            ToolCall("edit_ambiguous", "replace_once", {"path": "config.py", "old_str": "DEBUG = True", "new_str": "DEBUG = False"}),
        )
        assert ambiguous.is_error and ambiguous.tool_use_id == "edit_ambiguous"
        assert "matched 2 times" in ambiguous.content

        traversal = run_tool_safely(
            tools,
            PermissionGate("default", interactive=False),
            ToolCall("escape_01", "read_file", {"path": "../outside.txt"}),
        )
        assert traversal.is_error and traversal.tool_use_id == "escape_01"
        assert "inside the selected workspace" in traversal.content

        denied = run_tool_safely(
            tools,
            PermissionGate("default", interactive=False),
            ToolCall("shell_denied", "run_shell", {"command": "echo should-not-run"}),
        )
        assert denied.is_error and "permission denied" in denied.content

        output_command = "{} -c {}".format(
            shlex.quote(sys.executable), shlex.quote("print('x' * 400)")
        )
        capped = tools.run_shell(output_command)
        assert "[... middle truncated by harness ...]" in capped
        assert len(capped) <= 110

        timeout_command = "{} -c {}".format(
            shlex.quote(sys.executable), shlex.quote("import time; time.sleep(2)")
        )
        timeout_result = run_tool_safely(
            tools,
            PermissionGate("dangerously-skip-permissions", interactive=False),
            ToolCall("timeout_01", "run_shell", {"command": timeout_command}),
        )
        assert timeout_result.is_error and "process group was terminated" in timeout_result.content
        assert timeout_result.tool_use_id == "timeout_01"

        interrupt_marker = workspace / "interrupted-marker.txt"
        interrupt_command = "{} -c {}".format(
            shlex.quote(sys.executable),
            shlex.quote(
                "from pathlib import Path; import time; "
                "time.sleep(0.2); Path('interrupted-marker.txt').write_text('unexpected')"
            ),
        )
        interrupt_provider = ScriptedProvider(transient_failures=0)
        interrupt_provider.turns = [
            _tool_turn(
                "run a cancellable child",
                ToolCall("interrupt_01", "run_shell", {"command": interrupt_command}),
            ),
            ProviderTurn(
                content=[{"type": "text", "text": "interrupted shell result received"}],
                calls=[],
                stop_reason="end_turn",
            ),
        ]
        original_communicate = subprocess.Popen.communicate
        interrupted_once = {"value": False}

        def interrupt_first_communicate(process: Any, *args: Any, **kwargs: Any) -> Any:
            if not interrupted_once["value"]:
                interrupted_once["value"] = True
                raise KeyboardInterrupt
            return original_communicate(process, *args, **kwargs)

        with patch.object(subprocess.Popen, "communicate", new=interrupt_first_communicate):
            interrupted_report = run_agent(
                interrupt_provider,
                tools,
                PermissionGate("dangerously-skip-permissions", interactive=False),
                ContextManager("interrupt a shell child", clear_at_chars=10_000, compact_at_chars=20_000),
                "Run a cancellable shell command.",
                emit=silent,
                sleep_fn=no_sleep,
                max_steps=2,
            )
        time.sleep(0.3)
        interrupted_result = interrupted_report.tool_results[0]
        assert interrupted_report.completed and interrupted_result.tool_use_id == "interrupt_01"
        assert interrupted_result.is_error and "[Request interrupted by user]" in interrupted_result.content
        recorded_results = [
            message["content"]
            for message in interrupted_report.history
            if message.get("role") == "user" and isinstance(message.get("content"), list)
        ]
        assert len(recorded_results) == 1
        assert recorded_results[0][0]["tool_use_id"] == "interrupt_01"
        assert recorded_results[0][0]["is_error"] is True
        assert not interrupt_marker.exists()

    attempts = {"count": 0}

    def flaky_turn() -> ProviderTurn:
        attempts["count"] += 1
        if attempts["count"] < 3:
            raise TransientModelError("injected overload")
        return ProviderTurn(content=[{"type": "text", "text": "recovered"}], calls=[], stop_reason="end_turn")

    recovered, used_attempts = invoke_with_retry(
        flaky_turn,
        max_attempts=3,
        emit=silent,
        sleep_fn=no_sleep,
        random_fn=lambda: 0.0,
    )
    assert recovered.stop_reason == "end_turn" and used_attempts == 3

    manager = ContextManager("retain the task and next test", clear_at_chars=40, compact_at_chars=80)
    large_history = [
        {"role": "user", "content": "retain task state"},
        {
            "role": "assistant",
            "content": [
                {"type": "tool_use", "id": "read_large", "name": "read_file", "input": {"path": "notes.txt"}}
            ],
        },
        {
            "role": "user",
            "content": [
                {
                    "type": "tool_result",
                    "tool_use_id": "read_large",
                    "content": "x" * 200,
                    "is_error": False,
                }
            ],
        },
    ]
    compacted, action = manager.manage(large_history)
    assert action and action.startswith("compacted")
    summary = compacted[0]["content"][0]["text"]
    assert "retain the task and next test" in summary and "read_large" in summary
    assert [message["role"] for message in compacted] == ["user", "assistant", "user"]
    _assert_legal_anthropic_history(compacted)
    assert compacted[-2]["content"][0]["id"] == compacted[-1]["content"][0]["tool_use_id"] == "read_large"

    report = run_demo("dangerously-skip-permissions", emit=silent, sleep_fn=no_sleep)
    assert report.completed and report.retries == 1
    assert any(result.tool_use_id == "edit_02" and result.is_error for result in report.tool_results)
    assert any(result.tool_use_id == "check_05" and not result.is_error for result in report.tool_results)
    print("self-test: all Stage Two checks passed")


def console_emit(kind: str, message: str) -> None:
    print("[{}] {}".format(kind, message), flush=True)


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description="Run the Stage Two coding-agent harness.")
    parser.add_argument("--demo", action="store_true", help="run the offline scripted provider in a disposable workspace")
    parser.add_argument("--self-test", action="store_true", help="run deterministic, offline robustness checks")
    parser.add_argument("--provider", choices=["scripted", "anthropic"], default="scripted")
    parser.add_argument("--workspace", help="workspace for the optional live provider")
    parser.add_argument("--model", help="current model ID for the optional Anthropic provider")
    parser.add_argument("--task", help="task for the optional live provider")
    parser.add_argument(
        "--mode",
        choices=["default", "accept-edits", "dangerously-skip-permissions"],
        default="default",
        help="basic permission mode; this is not sandboxing",
    )
    parser.add_argument("--max-steps", type=int, default=12)
    args = parser.parse_args(argv[1:])

    try:
        if args.self_test:
            self_test()
            return 0

        if args.demo or args.provider == "scripted":
            report = run_demo(args.mode, emit=console_emit)
            print(
                "demo complete: retries={}, tool_results={}, context_actions={}".format(
                    report.retries, len(report.tool_results), len(report.context_actions)
                )
            )
            return 0

        if not args.workspace:
            raise ConfigurationError("--workspace is required for --provider anthropic")
        if not args.task:
            raise ConfigurationError("--task is required for --provider anthropic")
        api_key = os.environ.get("ANTHROPIC_API_KEY", "")
        provider = AnthropicProvider(args.model or "", api_key, console_emit)
        tools = WorkspaceTools(Path(args.workspace))
        gate = PermissionGate(args.mode, interactive=sys.stdin.isatty())
        context = ContextManager(args.task, clear_at_chars=50_000, compact_at_chars=80_000)
        report = run_agent(
            provider,
            tools,
            gate,
            context,
            args.task,
            emit=console_emit,
            max_steps=args.max_steps,
        )
        print(
            "live run complete: retries={}, tool_results={}, context_actions={}".format(
                report.retries, len(report.tool_results), len(report.context_actions)
            )
        )
        return 0
    except (ConfigurationError, FatalModelError, TransientModelError, ToolFailure) as error:
        print("error: {}".format(error), file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
