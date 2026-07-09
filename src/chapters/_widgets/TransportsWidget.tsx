import { useState } from "react";

// TransportsWidget: the signature widget for "Transports".
// One focused move: hold a single tools/call fixed and reframe it across the two
// standard transports (and, for HTTP, the two response modes). Every frame is
// split into envelope lines (the transport's own bytes: pipe framing or HTTP
// headers) and payload lines (the identical JSON-RPC message). The reader should
// feel the thesis directly: the message never changes, only the bytes around it.
// A properties strip names the deciding axis. React state only, no persistence.

type Kind = "envelope" | "payload" | "blank";
interface Line {
  text: string;
  kind: Kind;
  // an envelope-colored prefix on a payload line (the SSE "data: " wrapper)
  prefix?: string;
}
interface Frame {
  dir: "C -> S" | "S -> C";
  summary: string;
  lines: Line[];
}

const env = (text: string): Line => ({ text, kind: "envelope" });
const pay = (text: string): Line => ({ text, kind: "payload" });
const blank: Line = { text: "", kind: "blank" };
// An SSE line: the "data: " prefix is transport framing, the JSON is the message.
const sse = (text: string): Line => ({ text, kind: "payload", prefix: "data: " });

// The one message, identical in every frame below. This is the protocol layer. It
// opts into progress with a progressToken (distinct from the JSON-RPC id) so the SSE
// reply may legally stream a progress notification for it.
const REQUEST = `{"jsonrpc":"2.0","id":5,"method":"tools/call","params":{"name":"search","arguments":{"q":"otters"},"_meta":{"progressToken":7}}}`;
const RESULT = `{"jsonrpc":"2.0","id":5,"result":{"content":[{"type":"text","text":"3 results"}],"isError":false}}`;
const PROGRESS = `{"jsonrpc":"2.0","method":"notifications/progress","params":{"progressToken":7,"progress":0.5}}`;

const STDIO: Frame[] = [
  {
    dir: "C -> S",
    summary: "one line written to the server's stdin",
    lines: [env("// stdin, newline-delimited. no headers, no addressing."), pay(REQUEST + "\\n")],
  },
  {
    dir: "S -> C",
    summary: "one line read back from its stdout",
    lines: [env("// stdout, one line. the pipe already points at one client."), pay(RESULT + "\\n")],
  },
];

const HTTP_REQUEST: Frame = {
  dir: "C -> S",
  summary: "a fresh POST to the one endpoint",
  lines: [
    env("POST /mcp HTTP/1.1"),
    env("Content-Type: application/json"),
    env("Accept: application/json, text/event-stream"),
    env("Mcp-Session-Id: 1868a90c..."),
    env("MCP-Protocol-Version: 2025-11-25"),
    blank,
    pay(REQUEST),
  ],
};

const HTTP_JSON: Frame[] = [
  HTTP_REQUEST,
  {
    dir: "S -> C",
    summary: "answered with a single JSON body, then done",
    lines: [env("HTTP/1.1 200 OK"), env("Content-Type: application/json"), blank, pay(RESULT)],
  },
];

const HTTP_SSE: Frame[] = [
  HTTP_REQUEST,
  {
    dir: "S -> C",
    summary: "the same request, upgraded to a stream of events",
    lines: [
      env("HTTP/1.1 200 OK"),
      env("Content-Type: text/event-stream"),
      blank,
      env("event: message"),
      sse(PROGRESS),
      blank,
      env("event: message"),
      sse(RESULT),
    ],
  },
];

interface Props {
  location: string;
  clients: string;
  latency: string;
  scaling: string;
  auth: string;
}

const STDIO_PROPS: Props = {
  location: "local only",
  clients: "one per subprocess",
  latency: "sub-ms (IPC)",
  scaling: "none",
  auth: "environment variables",
};
const HTTP_PROPS: Props = {
  location: "local or remote",
  clients: "many, concurrent",
  latency: "+1 network round trip",
  scaling: "horizontal",
  auth: "bearer / OAuth / TLS",
};

function WireFrame({ frame }: { frame: Frame }) {
  return (
    <div>
      <div className="flex items-baseline gap-2 font-mono text-[0.7rem]">
        <span className="text-accent">{frame.dir}</span>
        <span className="text-comment">{`// ${frame.summary}`}</span>
      </div>
      <pre className="mt-1.5 overflow-x-auto rounded border border-border bg-surface-2 p-3 font-mono text-[0.7rem] leading-relaxed">
        {frame.lines.map((line, i) =>
          line.kind === "blank" ? (
            <span key={i} className="block">
              {" "}
            </span>
          ) : (
            <span
              key={i}
              className={`block ${line.kind === "payload" ? "text-accent" : "text-comment"}`}
            >
              {line.prefix && <span className="text-comment">{line.prefix}</span>}
              {line.text}
            </span>
          ),
        )}
      </pre>
    </div>
  );
}

export function TransportsWidget() {
  const [transport, setTransport] = useState<"stdio" | "http">("stdio");
  const [mode, setMode] = useState<"json" | "sse">("json");

  const frames = transport === "stdio" ? STDIO : mode === "json" ? HTTP_JSON : HTTP_SSE;
  const props = transport === "stdio" ? STDIO_PROPS : HTTP_PROPS;

  return (
    <div className="font-sans">
      {/* the invariant: the message that does not change */}
      <div className="rounded border border-accent/30 bg-surface p-3">
        <span className="font-mono text-[0.7rem] text-comment">
          {"// the protocol message, identical on every transport"}
        </span>
        <pre className="mt-1.5 overflow-x-auto font-mono text-[0.7rem] leading-relaxed text-accent">
          {REQUEST}
        </pre>
      </div>

      {/* control 1: pick the transport */}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <div
          role="group"
          aria-label="transport"
          className="inline-flex rounded border border-border p-0.5 font-mono text-xs"
        >
          {(["stdio", "http"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTransport(t)}
              aria-pressed={transport === t}
              className={`rounded px-3 py-1.5 transition-colors motion-reduce:transition-none ${
                transport === t ? "bg-accent/15 text-accent" : "text-muted hover:text-fg"
              }`}
            >
              {t === "stdio" ? "stdio" : "Streamable HTTP"}
            </button>
          ))}
        </div>

        {/* control 2 (contextual): the HTTP response mode */}
        {transport === "http" && (
          <div
            role="group"
            aria-label="HTTP response mode"
            className="inline-flex rounded border border-border p-0.5 font-mono text-xs"
          >
            {(["json", "sse"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                aria-pressed={mode === m}
                className={`rounded px-3 py-1.5 transition-colors motion-reduce:transition-none ${
                  mode === m ? "bg-accent/15 text-accent" : "text-muted hover:text-fg"
                }`}
              >
                {m === "json" ? "JSON body" : "SSE stream"}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* the framed bytes for the chosen transport */}
      <div className="mt-4 space-y-3">
        {frames.map((frame, i) => (
          <WireFrame key={`${transport}-${mode}-${i}`} frame={frame} />
        ))}
      </div>

      {/* the deciding axis, named */}
      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-1.5 rounded border border-border bg-surface p-3 font-mono text-[0.7rem] sm:grid-cols-3">
        {(
          [
            ["location", props.location],
            ["clients", props.clients],
            ["latency", props.latency],
            ["scaling", props.scaling],
            ["auth", props.auth],
          ] as const
        ).map(([k, v]) => (
          <div key={k}>
            <dt className="text-comment">{`// ${k}`}</dt>
            <dd className="text-fg/90">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
