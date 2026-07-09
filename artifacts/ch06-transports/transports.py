#!/usr/bin/env python3
"""One MCP server, two transports. Watch an identical call travel differently.

Companion to chapter 6, "Transports." The chapter's claim is that MCP is layered:
the protocol layer (JSON-RPC messages, the handshake, the primitives) is one thing,
and the transport layer (how those bytes actually move) is another. The same server
logic serves a local subprocess over stdio and a fleet over HTTP without changing a
line of message handling. This script makes that literal.

There is exactly one server core, `McpCore`, which turns a JSON-RPC message into a
reply and knows nothing about bytes. Two transports wrap it:

  * stdio            newline-delimited JSON over a subprocess's stdin/stdout
  * Streamable HTTP  one POST per message to a single /mcp endpoint, answered with
                     either a JSON body or an upgraded text/event-stream

Run it and the driver sends the SAME logical sequence (initialize, tools/list,
tools/call) over each transport and prints every framed byte in both directions, so
you can lay the two traces side by side and see only the framing change.

Run it:

    python3 transports.py            # stdio, then HTTP-json, then HTTP-sse
    python3 transports.py --stdio    # just the stdio trace
    python3 transports.py --http     # just the Streamable HTTP traces (json + sse)

Internal (the driver starts these for you):

    python3 transports.py --serve-stdio
    python3 transports.py --serve-http [--sse]

No SDK, no API key, no network beyond loopback. The HTTP server binds only to
127.0.0.1 (the spec's mandatory rule for local servers) on an OS-assigned port.
Standard library only.
"""
from __future__ import annotations

import http.client
import json
import socket
import subprocess
import sys
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

# ---- protocol constants --------------------------------------------------------
LATEST = "2025-11-25"
SUPPORTED = ["2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05"]

PARSE_ERROR = -32700
INVALID_REQUEST = -32600
METHOD_NOT_FOUND = -32601
INVALID_PARAMS = -32602
INTERNAL_ERROR = -32603

# The HTTP server accepts requests only from these origins. Validating Origin is the
# spec's first mandatory defense against DNS-rebinding attacks on a local server.
ALLOWED_ORIGINS = {"http://127.0.0.1", "http://localhost", "https://claude.ai"}


# ================================================================================
# THE SERVER CORE: transport-agnostic. It maps a JSON-RPC message to a reply (or to
# None for a notification, which is never answered). It never touches a byte, a
# socket, or a pipe. Both transports below call exactly this.
# ================================================================================

class McpCore:
    TOOLS = [
        {
            "name": "add",
            "description": "Add two numbers and return their sum.",
            "inputSchema": {
                "type": "object",
                "properties": {"a": {"type": "number"}, "b": {"type": "number"}},
                "required": ["a", "b"],
            },
        },
        {
            "name": "search",
            "description": "Pretend to search a corpus; used to show a streamed reply.",
            "inputSchema": {
                "type": "object",
                "properties": {"q": {"type": "string"}},
                "required": ["q"],
            },
        },
    ]

    def __init__(self) -> None:
        self.initialized = False

    def handle(self, msg: dict) -> dict | None:
        """Return the JSON-RPC reply for a message, or None if none is owed."""
        method = msg.get("method")
        mid = msg.get("id")
        if "id" not in msg:  # a notification: no reply, ever
            if method == "notifications/initialized":
                self.initialized = True
            return None

        if method == "initialize":
            requested = msg.get("params", {}).get("protocolVersion")
            version = requested if requested in SUPPORTED else LATEST
            return ok(mid, {
                "protocolVersion": version,
                "capabilities": {"tools": {"listChanged": True}},
                "serverInfo": {"name": "transport-demo", "version": "1.0.0"},
            })

        if method == "tools/list":
            return ok(mid, {"tools": self.TOOLS})

        if method == "tools/call":
            return self.call_tool(mid, msg.get("params", {}))

        return err(mid, METHOD_NOT_FOUND, f"Method not found: {method}")

    def call_tool(self, mid, params: dict) -> dict:
        name = params.get("name")
        args = params.get("arguments", {})
        if name == "add":
            missing = [k for k in ("a", "b") if k not in args]
            if missing:
                return err(mid, INVALID_PARAMS, f"Missing argument(s): {missing}")
            return tool_ok(mid, f"{args['a'] + args['b']}")
        if name == "search":
            return tool_ok(mid, f"3 results for {args.get('q', '')!r} (demo)")
        return err(mid, INVALID_PARAMS, f"Unknown tool: {name}")


def ok(mid, result: dict) -> dict:
    return {"jsonrpc": "2.0", "id": mid, "result": result}


def err(mid, code: int, message: str) -> dict:
    return {"jsonrpc": "2.0", "id": mid, "error": {"code": code, "message": message}}


def tool_ok(mid, text: str) -> dict:
    return ok(mid, {"content": [{"type": "text", "text": text}], "isError": False})


# ================================================================================
# TRANSPORT 1 -- stdio. The server reads newline-delimited JSON from stdin and writes
# it to stdout. One line is one message. There are no headers and no addressing: the
# pipe already points at exactly one client, the process that spawned it.
# ================================================================================

def serve_stdio() -> None:
    core = McpCore()
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            msg = json.loads(line)
        except json.JSONDecodeError:
            _stdio_send(err(None, PARSE_ERROR, "Parse error"))
            continue
        reply = core.handle(msg)
        if reply is not None:
            _stdio_send(reply)
    print("stdin closed; server exiting", file=sys.stderr, flush=True)


def _stdio_send(msg: dict) -> None:
    # Compact JSON, one per line, flushed. Nothing but framed messages on stdout.
    sys.stdout.write(json.dumps(msg) + "\n")
    sys.stdout.flush()


def _close_pipes(proc: subprocess.Popen) -> None:
    # Release the child's pipe file descriptors deterministically, so nothing is
    # left dangling (this is what a ResourceWarning under `python3 -X dev` catches).
    for pipe in (proc.stdin, proc.stdout, proc.stderr):
        if pipe and not pipe.closed:
            pipe.close()


class StdioClient:
    """Spawns the server as a subprocess and frames messages as newline JSON."""

    def __init__(self) -> None:
        self.proc = subprocess.Popen(
            [sys.executable, __file__, "--serve-stdio"],
            stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
            text=True, bufsize=1,
        )

    def request(self, msg: dict) -> dict:
        wire = json.dumps(msg)
        show_send("stdio", f"{len(wire) + 1} bytes on stdin (one line)", [wire])
        self.proc.stdin.write(wire + "\n")
        self.proc.stdin.flush()
        line = self.proc.stdout.readline()
        show_recv("stdio", "one line on stdout", [line.rstrip("\n")])
        return json.loads(line)

    def notify(self, msg: dict) -> None:
        wire = json.dumps(msg)
        show_send("stdio", "notification: no id, so no reply is read", [wire])
        self.proc.stdin.write(wire + "\n")
        self.proc.stdin.flush()

    def close(self) -> None:
        # Closing stdin is the stdio shutdown signal; the server sees EOF and exits.
        print("  C -> S  close stdin  (the stdio shutdown signal)")
        if self.proc.stdin and not self.proc.stdin.closed:
            self.proc.stdin.close()
        try:
            self.proc.wait(timeout=5)
        except subprocess.TimeoutExpired:
            self.proc.kill()
        _close_pipes(self.proc)


# ================================================================================
# TRANSPORT 2 -- Streamable HTTP. The server exposes ONE endpoint, POST /mcp. Every
# client message is a fresh POST. A request is answered with either a single JSON
# body or an upgraded text/event-stream; a notification is answered with 202 and no
# body. The session id assigned on initialize is echoed on every later request.
# ================================================================================

def make_handler(stream_mode: bool):
    core = McpCore()
    sessions: set[str] = set()

    class Handler(BaseHTTPRequestHandler):
        protocol_version = "HTTP/1.1"

        def log_message(self, *_args):  # silence the default stderr access log
            pass

        def do_POST(self):
            # (1) DNS-rebinding defense: reject any Origin we did not allow.
            origin = self.headers.get("Origin")
            if origin is not None and origin not in ALLOWED_ORIGINS:
                self._json_status(403, {"error": f"forbidden origin: {origin}"})
                return

            body = self.rfile.read(int(self.headers.get("Content-Length", 0) or 0))
            try:
                msg = json.loads(body)
            except json.JSONDecodeError:
                self._json_body(200, err(None, PARSE_ERROR, "Parse error"))
                return

            method = msg.get("method")
            is_request = "id" in msg
            session = self.headers.get("Mcp-Session-Id")

            # (2) Session required on every request except initialize.
            if is_request and method != "initialize" and session not in sessions:
                self._json_status(400, {"error": "Mcp-Session-Id missing or unknown"})
                return

            reply = core.handle(msg)

            # A notification (no reply owed) is accepted with an empty 202.
            if reply is None:
                self.send_response(202)
                self.send_header("Content-Length", "0")
                self.end_headers()
                return

            extra = {}
            if method == "initialize":
                sid = f"sess-{len(sessions) + 1:04d}"
                sessions.add(sid)
                extra["Mcp-Session-Id"] = sid

            # A request is answered as one JSON body, or (in stream mode, for a
            # tools/call) as an SSE stream that carries progress then the result.
            if stream_mode and method == "tools/call":
                self._sse(msg, reply, extra)
            else:
                self._json_body(200, reply, extra)

        # -- response framers ----------------------------------------------------

        def _json_body(self, code: int, obj: dict, extra: dict | None = None):
            payload = json.dumps(obj).encode()
            self.send_response(code)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(payload)))
            for k, v in (extra or {}).items():
                self.send_header(k, v)
            self.end_headers()
            self.wfile.write(payload)

        def _json_status(self, code: int, obj: dict):
            self._json_body(code, obj)

        def _sse(self, msg: dict, reply: dict, extra: dict):
            self.send_response(200)
            self.send_header("Content-Type", "text/event-stream")
            self.send_header("Cache-Control", "no-cache")
            for k, v in extra.items():
                self.send_header(k, v)
            self.send_header("Connection", "close")
            self.close_connection = True
            self.end_headers()
            token = msg.get("params", {}).get("_meta", {}).get("progressToken", 1)
            progress = {"jsonrpc": "2.0", "method": "notifications/progress",
                        "params": {"progressToken": token, "progress": 0.5,
                                   "message": "searching"}}
            for event in (progress, reply):
                self.wfile.write(f"event: message\ndata: {json.dumps(event)}\n\n".encode())
                self.wfile.flush()

    return Handler


def serve_http(stream_mode: bool) -> None:
    # Bind loopback only. Port 0 lets the OS pick a free port; we announce it on
    # stdout so the parent can find us, then serve.
    server = ThreadingHTTPServer(("127.0.0.1", 0), make_handler(stream_mode))
    print(f"MCP_HTTP_READY {server.server_address[1]}", flush=True)
    server.serve_forever()


class HttpClient:
    """Drives the HTTP server. Every message is a fresh POST to /mcp."""

    def __init__(self, stream_mode: bool) -> None:
        self.stream_mode = stream_mode
        self.session: str | None = None
        self.proc = subprocess.Popen(
            [sys.executable, __file__, "--serve-http"] + (["--sse"] if stream_mode else []),
            stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, bufsize=1,
        )
        ready = self.proc.stdout.readline().split()
        self.port = int(ready[1])  # "MCP_HTTP_READY <port>"

    def post(self, msg: dict, origin: str | None = None,
             drop_session: bool = False) -> dict | None:
        headers = {
            "Content-Type": "application/json",
            "Accept": "application/json, text/event-stream",
            "MCP-Protocol-Version": LATEST,
        }
        if self.session and not drop_session:
            headers["Mcp-Session-Id"] = self.session
        if origin:
            headers["Origin"] = origin

        req_lines = [f"POST /mcp HTTP/1.1", f"Host: 127.0.0.1:{self.port}"]
        req_lines += [f"{k}: {v}" for k, v in headers.items()]
        req_lines += ["", json.dumps(msg)]
        show_send("http", "a fresh POST to the one endpoint", req_lines)

        conn = http.client.HTTPConnection("127.0.0.1", self.port, timeout=5)
        conn.request("POST", "/mcp", body=json.dumps(msg), headers=headers)
        resp = conn.getresponse()
        ctype = resp.getheader("Content-Type", "")
        status_line = f"HTTP/1.1 {resp.status} {resp.reason}"

        if ctype.startswith("text/event-stream"):
            lines = [status_line, f"Content-Type: {ctype}", ""]
            final = None
            for raw in iter(resp.readline, b""):
                text = raw.decode().rstrip("\n")
                lines.append(text or "(blank)")
                if text.startswith("data:"):
                    final = json.loads(text[5:].strip())
            show_recv("http", "200 upgraded to an SSE stream: progress, then result", lines)
            conn.close()
            return final

        payload = resp.read().decode()
        head = [status_line]
        if resp.getheader("Mcp-Session-Id"):
            head.append(f"Mcp-Session-Id: {resp.getheader('Mcp-Session-Id')}")
        if payload:
            head += [f"Content-Type: {ctype}", "", payload]
            summary = f"{resp.status} {resp.reason}, one JSON body"
        else:
            head += ["", "(empty body)"]
            summary = f"{resp.status} {resp.reason}, no body"
        show_recv("http", summary, head)
        conn.close()
        if resp.status == 202 or not payload:
            return None
        parsed = json.loads(payload)
        if resp.getheader("Mcp-Session-Id"):
            self.session = resp.getheader("Mcp-Session-Id")
        return parsed

    def close(self) -> None:
        self.proc.terminate()
        try:
            self.proc.wait(timeout=5)
        except subprocess.TimeoutExpired:
            self.proc.kill()
        _close_pipes(self.proc)


# ================================================================================
# THE DRIVER: the same logical sequence over each transport, framing printed.
# ================================================================================

# The one tools/call the demo sends over every transport, byte-for-byte identical.
# It opts into progress with a progressToken (a value distinct from the JSON-RPC id)
# so the SSE pass may legally stream a notifications/progress before the result. The
# other transports carry the same token and simply never act on it.
CALL_PARAMS = {"name": "search", "arguments": {"q": "otters"},
               "_meta": {"progressToken": 7}}

def show_send(transport: str, summary: str, lines: list[str]) -> None:
    print(f"  C -> S  [{transport}] {summary}")
    for ln in lines:
        print(f"          {ln}")


def show_recv(transport: str, summary: str, lines: list[str]) -> None:
    print(f"  S -> C  [{transport}] {summary}")
    for ln in lines:
        print(f"          {ln}")


def banner(title: str) -> None:
    print("\n" + "=" * 78)
    print(f"== {title}")
    print("=" * 78)


def trace_stdio() -> None:
    banner("stdio: newline-delimited JSON over a subprocess pipe")
    c = StdioClient()
    c.request({"jsonrpc": "2.0", "id": 1, "method": "initialize",
               "params": {"protocolVersion": LATEST, "capabilities": {},
                          "clientInfo": {"name": "demo", "version": "1.0.0"}}})
    c.notify({"jsonrpc": "2.0", "method": "notifications/initialized"})
    c.request({"jsonrpc": "2.0", "id": 2, "method": "tools/list"})
    c.request({"jsonrpc": "2.0", "id": 3, "method": "tools/call", "params": CALL_PARAMS})
    c.close()
    print("  note: no headers, no session id, no addressing. The pipe is the session.")


def trace_http(stream_mode: bool) -> None:
    label = "SSE stream mode" if stream_mode else "JSON response mode"
    banner(f"Streamable HTTP: one POST per message, {label}")
    c = HttpClient(stream_mode)
    print(f"  server bound to 127.0.0.1:{c.port} (loopback only, OS-assigned port)")
    init = c.post({"jsonrpc": "2.0", "id": 1, "method": "initialize",
                   "params": {"protocolVersion": LATEST, "capabilities": {},
                              "clientInfo": {"name": "demo", "version": "1.0.0"}}},
                  origin="http://127.0.0.1")
    print(f"  note: the server assigned a session id; the client echoes it from here on.")
    c.post({"jsonrpc": "2.0", "method": "notifications/initialized"},
           origin="http://127.0.0.1")

    if not stream_mode:
        c.post({"jsonrpc": "2.0", "id": 2, "method": "tools/list"},
               origin="http://127.0.0.1")
        c.post({"jsonrpc": "2.0", "id": 3, "method": "tools/call", "params": CALL_PARAMS},
               origin="http://127.0.0.1")
        # Two HTTP protections, shown refusing bad input on purpose.
        print("\n  -- security probes (these are supposed to be rejected) --")
        c.post({"jsonrpc": "2.0", "id": 4, "method": "tools/list"},
               origin="http://evil.example")
        print("  note: a foreign Origin is refused with 403 (DNS-rebinding defense).")
        c.post({"jsonrpc": "2.0", "id": 5, "method": "tools/list"},
               origin="http://127.0.0.1", drop_session=True)
        print("  note: a request with no session id is refused with 400.")
    else:
        # The very same tools/call, but the server upgrades the response to a stream
        # that carries a progress notification before the result. Same call, richer
        # frame. The progressToken it references is the one CALL_PARAMS opted into.
        c.post({"jsonrpc": "2.0", "id": 3, "method": "tools/call", "params": CALL_PARAMS},
               origin="http://127.0.0.1")
        print("  note: identical request; the reply is a stream of events, not one body.")
    c.close()


def main(argv: list[str]) -> int:
    if "--serve-stdio" in argv:
        serve_stdio()
        return 0
    if "--serve-http" in argv:
        serve_http("--sse" in argv)
        return 0

    only_stdio = "--stdio" in argv
    only_http = "--http" in argv
    print("# transports: one MCP server core, two ways of moving its messages")
    print(f"# protocol MCP {LATEST}; watch the framing change while the calls do not")
    try:
        if not only_http:
            trace_stdio()
        if not only_stdio:
            trace_http(stream_mode=False)
            trace_http(stream_mode=True)
    except (OSError, socket.error, http.client.HTTPException) as exc:
        print(f"\n!! trace failed: {exc}")
        return 1
    print("\n# same initialize, same tools/call. Only the bytes around them changed.")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
