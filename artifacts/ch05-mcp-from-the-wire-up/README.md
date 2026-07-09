# ch05 - mcp on the wire

A minimal MCP client and server that complete the handshake and print every framed
message on the wire. The runnable companion to chapter 5: MCP looks large, but the
protocol is small and knowable. This implements just enough of the 2025-11-25 wire
format, by hand, in the standard library, to watch that be true.

## Run it

```
cd artifacts/ch05-mcp-from-the-wire-up
python3 mcp_wire.py
```

- **Runtime:** Python 3.9+, standard library only.
- **No key, no network, no SDK.** The client spawns this same file in `--serve` mode
  as a subprocess and talks to it over stdio (newline-delimited JSON, the real MCP
  stdio transport). Every line it prints is an actual message between two processes.

## What you will see

The trace walks the four moves every MCP interaction is built from, then the two
failure paths the chapter keeps separate.

1. **Negotiate.** The client sends `initialize` with its protocol version and
   capabilities; the server echoes a negotiated version, its own capabilities, and
   `serverInfo`; the client sends the `notifications/initialized` notification (no
   `id`, no reply). The handshake gates everything after it.
2. **Discover.** `tools/list` returns each tool's `name`, `description`, and JSON
   Schema `inputSchema` / `outputSchema`.
3. **Invoke (success).** `tools/call` for `add(2, 3)` returns human-readable
   `content` plus machine-readable `structuredContent` conforming to the tool's
   `outputSchema`, with `isError: false`.
4. **Invoke (tool failure).** `divide(1, 0)` returns a **successful JSON-RPC
   result** carrying `isError: true`. The tool ran and failed; the model sees the
   failure and can retry. This is not a protocol error.
5. **Protocol errors.** Bad params (a missing required argument), an unknown tool
   name, and an un-negotiated method all come back as JSON-RPC `error` objects
   (`-32602`, `-32602`, `-32601`). The request could not be processed at all, and a
   malformed call returns an error rather than crashing the server.

The server logs to stderr, never to stdout, which is what keeps the stdio framing
readable. The client forwards those logs as `server-log:` lines at the end.

## Try the version counter-offer

```
python3 mcp_wire.py --bad-version
```

The client offers `2099-01-01`, a version the server does not speak. The server
counter-offers its latest (`2025-11-25`); the client checks that against its own
supported list and accepts. That is capability negotiation in one exchange: had the
client been unable to accept, it would disconnect instead.

## The one file

`mcp_wire.py` is both sides. Run with `--serve` and it is the server loop, reading
newline-delimited JSON from stdin and writing responses to stdout. Run with no
arguments and it is the client, which starts the server for you. Reading it top to
bottom is reading the protocol: three message shapes, one handshake, a capabilities
object, and namespaced methods.
