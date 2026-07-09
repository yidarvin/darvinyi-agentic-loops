import { useState } from "react";

// McpFromTheWireUpWidget: the signature widget for "MCP from the Wire Up".
// One focused move: step through the initialize/capabilities handshake message by
// message and watch the connection cross from negotiating to operating, then run
// the first real exchange (list, call, return). A scenario switch swaps in the
// version-mismatch path, where the server counter-offers a version the client did
// not ask for. The lesson the reader should feel: the whole protocol is negotiate
// -> discover -> invoke -> return, and the handshake gates everything after it.
// React state only, no persistence. The messages are real 2025-11-25 wire shapes.

type Dir = "C" | "S";
type Kind = "request" | "response" | "notification";

interface Step {
  dir: Dir;
  kind: Kind;
  operating: boolean; // has the handshake completed as of this step?
  json: string;
  note: string;
  mark?: string; // a substring to highlight in the JSON (the negotiated version, etc.)
}

// The two shared operation steps (list, call, return) are identical across
// scenarios; only the handshake differs.
const OPERATION: Step[] = [
  {
    dir: "C",
    kind: "request",
    operating: true,
    mark: "tools/list",
    json: `{ "jsonrpc": "2.0", "id": 2, "method": "tools/list" }`,
    note: "discover: with the handshake done, ask what tools the server exposes.",
  },
  {
    dir: "S",
    kind: "response",
    operating: true,
    mark: "get_weather",
    json: `{ "jsonrpc": "2.0", "id": 2, "result": {
    "tools": [ {
      "name": "get_weather",
      "description": "Get current weather for a city",
      "inputSchema": {
        "type": "object",
        "properties": { "city": { "type": "string" } },
        "required": [ "city" ] } } ] } }`,
    note: "one tool, described by a JSON Schema the model reads before it calls.",
  },
  {
    dir: "C",
    kind: "request",
    operating: true,
    mark: "tools/call",
    json: `{ "jsonrpc": "2.0", "id": 3, "method": "tools/call",
  "params": { "name": "get_weather",
    "arguments": { "city": "London" } } }`,
    note: "invoke: call the tool with arguments that fit its input schema.",
  },
  {
    dir: "S",
    kind: "response",
    operating: true,
    mark: "isError",
    json: `{ "jsonrpc": "2.0", "id": 3, "result": {
    "content": [ { "type": "text", "text": "12.5C, overcast" } ],
    "structuredContent": { "temperature": 12.5, "conditions": "Overcast" },
    "isError": false } }`,
    note: "return: human-readable content plus machine-readable structuredContent. Real servers also serialize that structured result into the text block for backward compatibility, as this chapter's artifact does. The whole loop: negotiate, discover, invoke, return.",
  },
];

const CLEAN: Step[] = [
  {
    dir: "C",
    kind: "request",
    operating: false,
    mark: "2025-11-25",
    json: `{ "jsonrpc": "2.0", "id": 1, "method": "initialize",
  "params": {
    "protocolVersion": "2025-11-25",
    "capabilities": { "sampling": {} },
    "clientInfo": { "name": "demo-client", "version": "1.0.0" } } }`,
    note: "negotiate: the client opens with its latest version and what it can do for the server.",
  },
  {
    dir: "S",
    kind: "response",
    operating: false,
    mark: "2025-11-25",
    json: `{ "jsonrpc": "2.0", "id": 1, "result": {
    "protocolVersion": "2025-11-25",
    "capabilities": { "tools": { "listChanged": true } },
    "serverInfo": { "name": "weather-server", "version": "2.1.0" } } }`,
    note: "the server speaks that version, so it echoes it and advertises the one capability it has: tools.",
  },
  {
    dir: "C",
    kind: "notification",
    operating: true,
    mark: "notifications/initialized",
    json: `{ "jsonrpc": "2.0", "method": "notifications/initialized" }`,
    note: "no id, no reply. This one notification closes the handshake. The connection is now operating.",
  },
  ...OPERATION,
];

const MISMATCH: Step[] = [
  {
    dir: "C",
    kind: "request",
    operating: false,
    mark: "2026-07-28",
    json: `{ "jsonrpc": "2.0", "id": 1, "method": "initialize",
  "params": {
    "protocolVersion": "2026-07-28",
    "capabilities": { "sampling": {} },
    "clientInfo": { "name": "demo-client", "version": "1.0.0" } } }`,
    note: "negotiate: the client offers a version this server does not speak yet.",
  },
  {
    dir: "S",
    kind: "response",
    operating: false,
    mark: "2025-11-25",
    json: `{ "jsonrpc": "2.0", "id": 1, "result": {
    "protocolVersion": "2025-11-25",
    "capabilities": { "tools": { "listChanged": true } },
    "serverInfo": { "name": "weather-server", "version": "2.1.0" } } }`,
    note: "the server counter-offers its latest. The client checks 2025-11-25 against its own supported list and accepts. If it could not, it would disconnect here.",
  },
  {
    dir: "C",
    kind: "notification",
    operating: true,
    mark: "notifications/initialized",
    json: `{ "jsonrpc": "2.0", "method": "notifications/initialized" }`,
    note: "both sides now agree on 2025-11-25. The handshake closes and the connection is operating.",
  },
  ...OPERATION,
];

const SCENARIOS: { id: string; label: string; steps: Step[] }[] = [
  { id: "clean", label: "clean handshake", steps: CLEAN },
  { id: "mismatch", label: "version mismatch", steps: MISMATCH },
];

// Highlight one substring wherever it appears in a message, following the
// correlation-id pattern from the anatomy widget.
function highlight(text: string, term?: string) {
  if (!term || !text.includes(term)) return text;
  const parts = text.split(term);
  return parts.flatMap((part, i) =>
    i === 0
      ? [<span key={`p${i}`}>{part}</span>]
      : [
          <span key={`m${i}`} className="text-accent">{term}</span>,
          <span key={`p${i}`}>{part}</span>,
        ],
  );
}

function Lane({ dir, kind }: { dir: Dir; kind: Kind }) {
  // A minimal two-lane sequence: client on the left, server on the right, with the
  // current message traveling between them in its direction.
  const rightward = dir === "C";
  const box = (label: string, active: boolean) => (
    <div
      className={`rounded border px-3 py-1.5 font-mono text-xs ${
        active ? "border-accent/60 bg-accent/10 text-accent" : "border-border text-muted"
      }`}
    >
      {label}
    </div>
  );
  return (
    <div className="flex items-center gap-3">
      {box("client", rightward)}
      <div className="flex flex-1 items-center gap-2 font-mono text-[0.7rem] text-accent">
        {!rightward && <span aria-hidden>{"◀"}</span>}
        <span className="flex-1 border-t border-dashed border-accent/40" />
        <span className="whitespace-nowrap text-comment">{kind}</span>
        <span className="flex-1 border-t border-dashed border-accent/40" />
        {rightward && <span aria-hidden>{"▶"}</span>}
      </div>
      {box("server", !rightward)}
    </div>
  );
}

export function McpFromTheWireUpWidget() {
  const [scenarioId, setScenarioId] = useState("clean");
  const [i, setI] = useState(0);
  const scenario = SCENARIOS.find((s) => s.id === scenarioId)!;
  const steps = scenario.steps;
  const step = steps[i];
  const phase = step.operating ? "operating" : "negotiating";

  const pick = (id: string) => {
    setScenarioId(id);
    setI(0);
  };

  return (
    <div className="font-sans">
      {/* control 1: choose the scenario */}
      <div className="flex flex-wrap items-center gap-3">
        <div
          role="group"
          aria-label="handshake scenario"
          className="inline-flex rounded border border-border p-0.5 font-mono text-xs"
        >
          {SCENARIOS.map((s) => (
            <button
              key={s.id}
              onClick={() => pick(s.id)}
              aria-pressed={scenarioId === s.id}
              className={`rounded px-3 py-1.5 transition-colors motion-reduce:transition-none ${
                scenarioId === s.id ? "bg-accent/15 text-accent" : "text-muted hover:text-fg"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* the phase badge flips when the handshake closes */}
        <span
          aria-live="polite"
          className={`rounded-full border px-3 py-1 font-mono text-[0.7rem] uppercase tracking-wider ${
            phase === "operating"
              ? "border-accent/50 text-accent"
              : "border-border text-comment"
          }`}
        >
          {phase}
        </span>
      </div>

      {/* the step rail: each message as a clickable dot */}
      <div className="mt-4 flex flex-wrap items-center gap-1.5" role="group" aria-label="message steps">
        {steps.map((s, idx) => (
          <button
            key={idx}
            onClick={() => setI(idx)}
            aria-label={`step ${idx + 1}: ${s.dir === "C" ? "client to server" : "server to client"} ${s.kind}`}
            aria-current={idx === i ? "step" : undefined}
            className={`h-6 w-6 rounded font-mono text-[0.65rem] transition-colors motion-reduce:transition-none ${
              idx === i
                ? "bg-accent text-bg"
                : idx < i
                  ? "bg-accent/20 text-accent"
                  : "bg-surface-2 text-comment hover:text-fg"
            }`}
          >
            {idx + 1}
          </button>
        ))}
      </div>

      {/* the current message: direction, then the wire bytes, then a plain note */}
      <div className="mt-4">
        <Lane dir={step.dir} kind={step.kind} />
        <pre
          tabIndex={0}
          aria-label={`step ${i + 1} JSON message`}
          className="mt-3 overflow-x-auto rounded border border-border bg-surface-2 p-3 font-mono text-xs leading-relaxed text-fg/90"
        >
          {highlight(step.json, step.mark)}
        </pre>
        <p aria-live="polite" className="mt-3 min-h-[2.5rem] font-mono text-xs leading-relaxed text-fg/90">
          <span className="text-comment">{`// step ${i + 1}/${steps.length}  `}</span>
          {step.note}
        </p>
      </div>

      {/* control 2: walk the sequence */}
      <div className="mt-3 flex gap-2 font-mono text-xs">
        <button
          onClick={() => setI((v) => Math.max(0, v - 1))}
          disabled={i === 0}
          className="rounded border border-border px-3 py-1.5 text-muted transition-colors motion-reduce:transition-none hover:text-fg disabled:opacity-40 disabled:hover:text-muted"
        >
          prev
        </button>
        <button
          onClick={() => setI((v) => Math.min(steps.length - 1, v + 1))}
          disabled={i === steps.length - 1}
          className="rounded border border-accent/50 bg-accent/10 px-3 py-1.5 text-accent transition-colors motion-reduce:transition-none hover:bg-accent/20 disabled:opacity-40 disabled:hover:bg-accent/10"
        >
          next
        </button>
        <button
          onClick={() => setI(0)}
          className="rounded border border-border px-3 py-1.5 text-muted transition-colors motion-reduce:transition-none hover:text-fg"
        >
          reset
        </button>
      </div>
    </div>
  );
}
