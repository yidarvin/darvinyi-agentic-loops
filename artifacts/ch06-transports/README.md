# ch06 - one server, two transports

A single MCP server core exposed over both transports at once, with a client that
drives each and prints every framed byte. The runnable companion to chapter 6: MCP
separates the protocol (JSON-RPC messages, the handshake, the primitives) from the
transport (how those bytes move). The same `McpCore` serves a local subprocess over
stdio and a network client over Streamable HTTP without a single change to its
message handling. This makes that literal.

## Run it

```
cd artifacts/ch06-transports
python3 transports.py
```

- **Runtime:** Python 3.9+, standard library only.
- **No key, no SDK, no network beyond loopback.** The HTTP server binds only to
  `127.0.0.1`, following the specification's localhost-binding recommendation for local servers,
  on an OS-assigned port.

## What you will see

The driver sends the same logical sequence (`initialize`, `notifications/initialized`,
`tools/list`, `tools/call`) over each transport, so only the framing changes.

1. **stdio.** Each message is one line of JSON written to the subprocess's stdin and
   read back from its stdout. No headers, no session id, no addressing: the pipe
   already points at exactly one client. Closing stdin is the shutdown signal.
2. **Streamable HTTP, JSON response mode.** Every message is a fresh `POST /mcp` with
   headers. The `initialize` response carries an `Mcp-Session-Id` the client echoes on
   every later request; a notification is answered with `202 Accepted` and no body; a
   request is answered with a single `application/json` body. Two protections are
   shown refusing bad input on purpose: a foreign `Origin` is refused with `403`
   (the DNS-rebinding defense) and a request missing its session id is refused with
   `400` (session enforcement). The server also binds loopback only.
3. **Streamable HTTP, SSE stream mode.** The identical `tools/call` is answered not
   with one JSON body but with a `text/event-stream`: a `notifications/progress` event,
   then the result event, then the stream closes. Same request, richer frame.

The closing line makes the point: same `initialize`, same `tools/call`, only the
bytes around them changed.

## Flags

```
python3 transports.py --stdio   # just the stdio trace
python3 transports.py --http    # just the HTTP traces (JSON, then SSE)
```

Internal, started for you by the driver:

```
python3 transports.py --serve-stdio
python3 transports.py --serve-http [--sse]
```

## The one file

`transports.py` is server and client both. `McpCore` is transport-agnostic: it turns
a JSON-RPC message into a reply and never touches a byte. `serve_stdio` /
`StdioClient` frame messages as newline-delimited JSON; `serve_http` / `HttpClient`
frame them as HTTP requests and responses. Reading the two transports side by side is
the whole lesson: the framing is swappable, the protocol underneath is not.
