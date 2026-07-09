#!/usr/bin/env python3
"""A minimal MCP client and server that complete the handshake and print every
framed message on the wire.

Companion to chapter 5, "MCP from the Wire Up." The chapter's claim is that MCP
looks large (an SDK, a foundation, ten thousand servers) but the protocol is small
and knowable: JSON-RPC 2.0, a mandatory initialize/initialized handshake, a
capabilities object you negotiate, and namespaced methods. This script implements
just enough of the 2025-11-25 wire protocol, by hand, in the standard library, to
watch that be true.

No SDK, no API key, no network. The client spawns this same file in --serve mode as
a subprocess and talks to it over stdio (newline-delimited JSON, the real MCP stdio
transport), then logs each message both directions with a decoded summary. What you
see is the actual bytes on the wire.

Run it:

    python3 mcp_wire.py                 # the full trace: handshake, list, call
    python3 mcp_wire.py --bad-version   # client offers an unsupported version;
                                        # watch the server counter-offer

Internal:

    python3 mcp_wire.py --serve         # the server loop (client starts this for you)

The trace walks the four moves every MCP interaction is built from: negotiate the
version and capabilities, discover the tools, invoke one, read the result. It also
shows the two failure paths the chapter insists you keep separate: a protocol error
(a JSON-RPC `error` object, for a malformed or unknown request) versus a tool that
runs and fails (a successful `result` carrying `isError: true`).
"""
from __future__ import annotations

import json
import subprocess
import sys
import threading

# ---- the protocol constants ----------------------------------------------------
# Date-based versions; the date marks the last backwards-incompatible change. A
# well-behaved server keeps a descending list and negotiates down to a shared one.
LATEST = "2025-11-25"
SERVER_SUPPORTED = ["2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05"]
CLIENT_SUPPORTED = ["2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05"]

# JSON-RPC error codes inherited by MCP. -32000..-32099 are server-defined.
PARSE_ERROR = -32700
INVALID_REQUEST = -32600
METHOD_NOT_FOUND = -32601
INVALID_PARAMS = -32602
INTERNAL_ERROR = -32603


# ================================================================================
# SERVER: reads newline-delimited JSON from stdin, writes responses to stdout.
# Nothing but valid JSON-RPC messages ever touches stdout; logs go to stderr. That
# rule is the whole reason stdio framing works.
# ================================================================================

class Server:
    def __init__(self) -> None:
        self.initialized = False
        self.negotiated_version: str | None = None

    # -- the tools this server exposes, as wire-shaped definitions ----------------
    TOOLS = [
        {
            "name": "add",
            "title": "Add",
            "description": "Add two numbers and return their sum.",
            "inputSchema": {
                "type": "object",
                "properties": {"a": {"type": "number"}, "b": {"type": "number"}},
                "required": ["a", "b"],
            },
            "outputSchema": {
                "type": "object",
                "properties": {"sum": {"type": "number"}},
                "required": ["sum"],
            },
        },
        {
            "name": "divide",
            "title": "Divide",
            "description": "Divide a by b. Fails, as a tool, on division by zero.",
            "inputSchema": {
                "type": "object",
                "properties": {"a": {"type": "number"}, "b": {"type": "number"}},
                "required": ["a", "b"],
            },
            "outputSchema": {
                "type": "object",
                "properties": {"quotient": {"type": "number"}},
                "required": ["quotient"],
            },
        },
    ]

    def log(self, msg: str) -> None:
        # stderr, never stdout. The client forwards these as `server-log:` lines.
        print(msg, file=sys.stderr, flush=True)

    def run(self) -> None:
        """Read a message per line until stdin closes (the stdio shutdown signal)."""
        for line in sys.stdin:
            line = line.strip()
            if not line:
                continue
            try:
                msg = json.loads(line)
            except json.JSONDecodeError:
                self.send(error_response(None, PARSE_ERROR, "Parse error"))
                continue
            # Defense in depth: no single message may tear down the whole session.
            try:
                self.handle(msg)
            except Exception as exc:  # noqa: BLE001 -- demo: keep the server alive
                self.send(error_response(msg.get("id"), INTERNAL_ERROR, f"Internal error: {exc}"))
        self.log("stdin closed; server exiting")

    def send(self, msg: dict) -> None:
        # One compact JSON object per line: the stdio framing.
        sys.stdout.write(json.dumps(msg) + "\n")
        sys.stdout.flush()

    def handle(self, msg: dict) -> None:
        method = msg.get("method")
        mid = msg.get("id")  # absent on a notification
        is_notification = "id" not in msg

        # Notifications carry no id and never get a response.
        if is_notification:
            if method == "notifications/initialized":
                self.initialized = True
                self.log("handshake complete; entering operation phase")
            return

        if method == "initialize":
            self.send(self.on_initialize(mid, msg.get("params", {})))
            return

        # Before the handshake finishes, the only real work allowed is the
        # initialize exchange itself (pings aside). Reject early operation.
        if not self.initialized:
            self.send(error_response(mid, INVALID_REQUEST,
                                     "Received request before initialization completed"))
            return

        if method == "tools/list":
            self.send({"jsonrpc": "2.0", "id": mid, "result": {"tools": self.TOOLS}})
        elif method == "tools/call":
            self.send(self.on_tools_call(mid, msg.get("params", {})))
        else:
            # Unknown method: a protocol error, not a tool result.
            self.send(error_response(mid, METHOD_NOT_FOUND, f"Method not found: {method}"))

    def on_initialize(self, mid, params: dict) -> dict:
        requested = params.get("protocolVersion")
        # Echo the requested version if we speak it; otherwise counter-offer our
        # latest and let the client decide whether it can accept.
        version = requested if requested in SERVER_SUPPORTED else LATEST
        self.negotiated_version = version
        self.log(f"initialize: client asked {requested!r}, negotiated {version!r}")
        return {
            "jsonrpc": "2.0",
            "id": mid,
            "result": {
                "protocolVersion": version,
                # Presence of a key advertises the feature. We only serve tools.
                "capabilities": {"tools": {"listChanged": True}},
                "serverInfo": {"name": "wire-demo-server", "version": "1.0.0"},
                "instructions": "A tiny arithmetic server for the chapter 5 wire trace.",
            },
        }

    def on_tools_call(self, mid, params: dict) -> dict:
        name = params.get("name")
        args = params.get("arguments", {})

        # A well-formed request with bad arguments is a protocol error (-32602), the
        # same category as an unknown tool. Validate against the declared required
        # fields before doing any work, so a missing argument returns an error object
        # instead of crashing the server mid-session.
        if name in ("add", "divide"):
            missing = [k for k in ("a", "b") if k not in args]
            if missing:
                return error_response(mid, INVALID_PARAMS,
                                      f"Missing required argument(s): {missing}")
            if not all(isinstance(args[k], (int, float)) and not isinstance(args[k], bool)
                       for k in ("a", "b")):
                return error_response(mid, INVALID_PARAMS,
                                      "Arguments 'a' and 'b' must be numbers")

        if name == "add":
            total = args["a"] + args["b"]
            return tool_result(mid, {"sum": total})

        if name == "divide":
            if args["b"] == 0:
                # The tool RAN and failed. This is a successful JSON-RPC result
                # with isError set, so the model sees the failure and can retry.
                # No structuredContent here: strict clients validate it against the
                # outputSchema on every result, so an error envelope in that slot
                # would spuriously fail validation. Keep errors schema-compatible.
                return tool_error(mid, "Division by zero is undefined.")
            return tool_result(mid, {"quotient": args["a"] / args["b"]})

        # An unknown tool NAME is a protocol error (bad params), not a tool result.
        return error_response(mid, INVALID_PARAMS, f"Unknown tool: {name}")


# ---- response builders (kept tiny so the wire shapes stay visible) --------------

def error_response(mid, code: int, message: str) -> dict:
    """A JSON-RPC error object: the request could not be processed at all."""
    return {"jsonrpc": "2.0", "id": mid, "error": {"code": code, "message": message}}


def tool_result(mid, structured: dict) -> dict:
    """A successful tool call: human-readable content plus machine-readable
    structuredContent that conforms to the tool's outputSchema."""
    return {
        "jsonrpc": "2.0",
        "id": mid,
        "result": {
            "content": [{"type": "text", "text": json.dumps(structured)}],
            "structuredContent": structured,
            "isError": False,
        },
    }


def tool_error(mid, message: str) -> dict:
    """A tool that ran and failed: still a JSON-RPC result, but isError is true and
    the failure rides in the content array for the model to read."""
    return {
        "jsonrpc": "2.0",
        "id": mid,
        "result": {
            "content": [{"type": "text", "text": message}],
            "isError": True,
        },
    }


# ================================================================================
# CLIENT: spawns the server over stdio and drives the exchange, logging the wire.
# ================================================================================

class Client:
    def __init__(self, offered_version: str) -> None:
        self.offered_version = offered_version
        self.next_id = 0
        self.phase = "initialization"
        self.proc = subprocess.Popen(
            [sys.executable, __file__, "--serve"],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            bufsize=1,  # line-buffered
        )
        # Drain server stderr on a thread so its logs never block the pipe.
        self._logs: list[str] = []
        self._log_thread = threading.Thread(target=self._drain_stderr, daemon=True)
        self._log_thread.start()

    def _drain_stderr(self) -> None:
        assert self.proc.stderr is not None
        for line in self.proc.stderr:
            self._logs.append(line.rstrip("\n"))

    def _new_id(self) -> int:
        self.next_id += 1
        return self.next_id

    # -- the wire log ------------------------------------------------------------

    def banner(self, phase: str) -> None:
        self.phase = phase
        line = f"-- phase: {phase} "
        print("\n" + line + "-" * (74 - len(line)))

    def log_out(self, msg: dict, summary: str) -> None:
        kind = "notify " if "id" not in msg else "request"
        tag = "" if "id" not in msg else f"#{msg['id']}"
        print(f"C -> S  {kind} {tag:<3}  {summary}")
        print(f"        {json.dumps(msg)}")

    def log_in(self, msg: dict, summary: str) -> None:
        tag = f"#{msg['id']}" if msg.get("id") is not None else ""
        kind = "error   " if "error" in msg else "result  "
        print(f"S -> C  {kind}{tag:<3}  {summary}")
        print(f"        {json.dumps(msg)}")

    # -- transport ---------------------------------------------------------------

    def send(self, msg: dict) -> None:
        assert self.proc.stdin is not None
        self.proc.stdin.write(json.dumps(msg) + "\n")
        self.proc.stdin.flush()

    def recv(self) -> dict:
        assert self.proc.stdout is not None
        line = self.proc.stdout.readline()
        if not line:
            raise RuntimeError("server closed the connection unexpectedly")
        return json.loads(line)

    def request(self, method: str, params: dict | None, summary: str) -> dict:
        msg = {"jsonrpc": "2.0", "id": self._new_id(), "method": method}
        if params is not None:
            msg["params"] = params
        self.log_out(msg, summary)
        self.send(msg)
        reply = self.recv()
        self.log_in(reply, describe_reply(method, reply))
        return reply

    def notify(self, method: str, summary: str) -> None:
        msg = {"jsonrpc": "2.0", "method": method}  # no id: no reply expected
        self.log_out(msg, summary)
        self.send(msg)

    # -- the exchange ------------------------------------------------------------

    def run(self) -> int:
        ok = True

        # 1) NEGOTIATE. The handshake must come first.
        self.banner("initialization")
        init = self.request(
            "initialize",
            {
                "protocolVersion": self.offered_version,
                "capabilities": {"sampling": {}},  # what the client can do for the server
                "clientInfo": {"name": "wire-demo-client", "version": "1.0.0"},
            },
            f"negotiate: offer version {self.offered_version}",
        )
        negotiated = init.get("result", {}).get("protocolVersion")
        if negotiated not in CLIENT_SUPPORTED:
            print(f"        !! server counter-offered {negotiated!r}, which the client "
                  f"cannot accept; disconnecting")
            self.close()
            return 1
        if negotiated != self.offered_version:
            print(f"        .. server counter-offered {negotiated!r}; client accepts")
        self.notify("notifications/initialized", "acknowledge: handshake done")

        # 2) DISCOVER.
        self.banner("operation")
        listed = self.request("tools/list", None, "discover: what tools exist?")
        tools = [t["name"] for t in listed.get("result", {}).get("tools", [])]
        print(f"        .. server offers tools: {tools}")

        # 3) INVOKE (success): a tool that returns structured output.
        self.request(
            "tools/call",
            {"name": "add", "arguments": {"a": 2, "b": 3}},
            "invoke: add(2, 3)",
        )

        # 4) INVOKE (tool-execution error): a tool that RUNS and fails. Note the
        #    reply is a result with isError:true, NOT a JSON-RPC error.
        div = self.request(
            "tools/call",
            {"name": "divide", "arguments": {"a": 1, "b": 0}},
            "invoke: divide(1, 0)  -- expect isError:true, not a protocol error",
        )
        if "error" in div:
            print("        !! expected a tool result with isError, got a protocol error")
            ok = False

        # 5) PROTOCOL errors: bad params, an unknown tool name, then an unknown
        #    method. All three come back as JSON-RPC error objects, never a result.
        self.request(
            "tools/call",
            {"name": "add", "arguments": {"a": 5}},
            "invoke: add(5) with 'b' missing  -- expect invalid params, not a crash",
        )
        self.request(
            "tools/call",
            {"name": "nope", "arguments": {}},
            "invoke: unknown tool  -- expect a JSON-RPC error",
        )
        self.request("resources/read", {"uri": "file:///x"},
                     "call an un-negotiated method  -- expect method not found")

        # Shutdown: closing the server's stdin is the stdio termination signal.
        self.banner("shutdown")
        print("C -> S  (close stdin)  the stdio shutdown signal; server exits")
        self.close()
        self._print_server_logs()
        return 0 if ok else 1

    def close(self) -> None:
        if self.proc.stdin and not self.proc.stdin.closed:
            self.proc.stdin.close()
        try:
            self.proc.wait(timeout=5)
        except subprocess.TimeoutExpired:
            self.proc.kill()
        self._log_thread.join(timeout=1)

    def _print_server_logs(self) -> None:
        if self._logs:
            print("\n-- server stderr (logs, never on the wire) " + "-" * 30)
            for line in self._logs:
                print(f"        server-log: {line}")


def describe_reply(method: str, reply: dict) -> str:
    if "error" in reply:
        e = reply["error"]
        return f"PROTOCOL ERROR {e['code']}: {e['message']}"
    result = reply.get("result", {})
    if method == "initialize":
        caps = ",".join(result.get("capabilities", {}).keys())
        return f"agreed version {result.get('protocolVersion')}, capabilities: {caps or 'none'}"
    if method == "tools/list":
        return f"{len(result.get('tools', []))} tool(s)"
    if method == "tools/call":
        if result.get("isError"):
            return "tool ran and FAILED (isError:true) -- the model sees this and can retry"
        sc = result.get("structuredContent")
        return f"ok, structuredContent={json.dumps(sc)}" if sc is not None else "ok"
    return "ok"


# ================================================================================

def main(argv: list[str]) -> int:
    if "--serve" in argv:
        Server().run()
        return 0

    offered = "2099-01-01" if "--bad-version" in argv else LATEST
    header = "version-mismatch trace" if "--bad-version" in argv else "clean wire trace"
    print(f"# mcp_wire: {header}")
    print(f"# transport: stdio (newline-delimited JSON) | protocol: MCP {LATEST}")
    print(f"# every line below is a real message on the wire between two processes")
    client = Client(offered)
    try:
        return client.run()
    except Exception as exc:  # noqa: BLE001 -- demo: report and exit non-zero
        print(f"\n!! trace failed: {exc}")
        client.close()
        return 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
