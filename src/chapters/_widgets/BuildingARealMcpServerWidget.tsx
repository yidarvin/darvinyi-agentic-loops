import { useState } from "react";

// BuildingARealMcpServerWidget: the signature widget for "Building a Real MCP Server".
// One focused move: send a call to a hardened server and watch two panels diverge, what
// the agent sees versus the internal server log. The gap between them IS the chapter.
// A well-formed call returns a clean result. A malformed one is a protocol error caught
// before the tool body runs. A not-found and a blocked query are VISIBLE ToolErrors the
// model can recover from. An internal fault is logged in full on the left but MASKED to
// a generic line on the right, so nothing internal leaks. The one secondary control,
// mask_error_details, is the lever that decides scenario five: flip it off and the real
// SQLite error leaks straight to the agent. React state only, no persistence. Shapes
// track MCP revision 2025-11-25.

type Channel = "ok" | "protocol" | "visible" | "masked";

interface Scenario {
  id: string;
  call: string;
  request: string;
  channel: Channel;
  channelLabel: string;
  // what the agent receives back over the wire
  client: string;
  clientLeaked?: string; // only differs from `client` when masking is off
  // the server-side log, which never crosses the wire
  log: string[];
  takeaway: string;
}

const SCENARIOS: Scenario[] = [
  {
    id: "ok",
    call: "get_ticket · id 101",
    request: `tools/call get_ticket {"ticket_id":101}`,
    channel: "ok",
    channelLabel: "clean result",
    client: `{"content":[{"type":"text","text":"{...\\"subject\\":\\"Export fails on large reports\\"}"}],"isError":false}`,
    log: ["get_ticket ok  (1 row, 0.4ms)"],
    takeaway: "The happy path. A structured result, isError:false. This is all the toy ever handled.",
  },
  {
    id: "protocol",
    call: "get_ticket · no id",
    request: `tools/call get_ticket {}`,
    channel: "protocol",
    channelLabel: "protocol error -32602",
    client: `{"error":{"code":-32602,"message":"missing required argument: ticket_id"}}`,
    log: ["reject  get_ticket: missing required argument: ticket_id", "tool body NOT run"],
    takeaway:
      "A malformed call is a protocol error on the JSON-RPC error channel, caught by schema validation before the tool body runs. Your logic never sees a bad argument.",
  },
  {
    id: "notfound",
    call: "get_ticket · id 9999",
    request: `tools/call get_ticket {"ticket_id":9999}`,
    channel: "visible",
    channelLabel: "ToolError · visible",
    client: `{"content":[{"type":"text","text":"ticket 9999 not found"}],"isError":true}`,
    log: ["get_ticket -> ToolError: ticket 9999 not found  (expected)"],
    takeaway:
      "A ToolError rides inside a normal result with isError:true, so the model reads it and can self-correct on the next turn. This is the error channel you design for.",
  },
  {
    id: "guard",
    call: "run_query · DROP TABLE",
    request: `tools/call run_query {"sql":"DROP TABLE tickets"}`,
    channel: "visible",
    channelLabel: "ToolError · visible",
    client: `{"content":[{"type":"text","text":"only SELECT queries are allowed here"}],"isError":true}`,
    log: ["run_query guard tripped: non-SELECT rejected  (DROP TABLE tickets)"],
    takeaway:
      "The guard is a deliberate, visible ToolError, not a crash. The agent is a chaos client; assume it will send exactly the query you fear.",
  },
  {
    id: "internal",
    call: "run_query · bad table",
    request: `tools/call run_query {"sql":"SELECT * FROM ghosts"}`,
    channel: "masked",
    channelLabel: "exception · masked",
    client: `{"content":[{"type":"text","text":"An internal error occurred. The failure has been logged."}],"isError":true}`,
    clientLeaked: `{"content":[{"type":"text","text":"[unmasked] OperationalError: no such table: ghosts"}],"isError":true}`,
    log: [
      "UNEXPECTED ERROR in tool 'run_query':",
      "  Traceback (most recent call last):",
      "    ...support_analytics.py, line 288, in run_query",
      "  sqlite3.OperationalError: no such table: ghosts",
    ],
    takeaway:
      "An unexpected exception is logged in full for the operator and masked to a generic message for the client. Flip mask_error_details off and the real database error, table names and all, leaks straight to the model.",
  },
];

const CHANNEL_COLOR: Record<Channel, string> = {
  ok: "text-fg/90",
  protocol: "text-danger",
  visible: "text-accent",
  masked: "text-danger",
};

export function BuildingARealMcpServerWidget() {
  const [id, setId] = useState<string>("ok");
  const [masked, setMasked] = useState<boolean>(true);
  const s = SCENARIOS.find((x) => x.id === id)!;

  const leaks = s.channel === "masked" && !masked && s.clientLeaked;
  const clientBody = leaks ? s.clientLeaked! : s.client;

  return (
    <div className="font-sans">
      {/* the one move: pick a call to send */}
      <div className="font-mono text-[0.7rem] text-comment">{"// send a call to a hardened server"}</div>
      <div role="group" aria-label="call to send" className="mt-1.5 flex flex-wrap gap-1.5 font-mono text-xs">
        {SCENARIOS.map((sc) => (
          <button
            key={sc.id}
            onClick={() => setId(sc.id)}
            aria-pressed={id === sc.id}
            className={`rounded border px-2.5 py-1.5 transition-colors motion-reduce:transition-none ${
              id === sc.id
                ? "border-accent/50 bg-accent/15 text-accent"
                : "border-border text-muted hover:text-fg"
            }`}
          >
            {sc.call}
          </button>
        ))}
      </div>

      {/* the secondary lever: masking on or off */}
      <div className="mt-3 flex items-center gap-2 font-mono text-xs">
        <span id="mask-label" className="text-comment">mask_error_details</span>
        <button
          id="mask-toggle"
          onClick={() => setMasked((v) => !v)}
          aria-pressed={masked}
          aria-labelledby="mask-label mask-toggle"
          className={`rounded border px-2.5 py-1 transition-colors motion-reduce:transition-none ${
            masked ? "border-accent/50 bg-accent/15 text-accent" : "border-danger/50 bg-danger/10 text-danger"
          }`}
        >
          {masked ? "True  (production)" : "False  (leaks)"}
        </button>
      </div>

      {/* the outbound request */}
      <pre className="mt-4 overflow-x-auto rounded border border-border bg-surface-2 p-2.5 font-mono text-[0.72rem] leading-relaxed">
        <span className="text-comment">{"C -> S  "}</span>
        <span className="text-fg/90">{s.request}</span>
      </pre>

      {/* the two views, diverging */}
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <div className="rounded border border-border bg-surface p-3">
          <div className="flex items-baseline justify-between">
            <span className="font-mono text-[0.7rem] text-comment">{"// what the agent sees"}</span>
            <span className={`font-mono text-[0.65rem] ${CHANNEL_COLOR[s.channel]}`}>{s.channelLabel}</span>
          </div>
          <pre className={`mt-1.5 overflow-x-auto font-mono text-[0.7rem] leading-relaxed ${CHANNEL_COLOR[s.channel]}`}>
            {clientBody}
          </pre>
          {leaks && (
            <p className="mt-2 font-mono text-[0.65rem] text-danger">
              {"// internal detail just crossed the wire"}
            </p>
          )}
        </div>

        <div className="rounded border border-border bg-surface p-3">
          <div className="font-mono text-[0.7rem] text-comment">{"// server log  ·  stderr, never leaves the box"}</div>
          <pre className="mt-1.5 overflow-x-auto font-mono text-[0.7rem] leading-relaxed text-muted">
            {s.log.join("\n")}
          </pre>
        </div>
      </div>

      {/* what the reader should take from this call */}
      <dl className="mt-3 rounded border border-border bg-surface p-3 font-mono text-[0.7rem]">
        <dt className="text-comment">{"// the point"}</dt>
        <dd className="mt-0.5 font-sans text-sm leading-relaxed text-fg/80">{s.takeaway}</dd>
      </dl>
    </div>
  );
}
