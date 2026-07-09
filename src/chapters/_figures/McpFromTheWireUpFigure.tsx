// McpFromTheWireUpFigure: the figure for "MCP from the Wire Up".
// The structure it encodes: the whole protocol is built from three JSON-RPC
// message shapes, and one rule tells them apart -- an id means a reply is
// expected, no id means it is a fire-and-forget notification. The bottom lane
// encodes the distinction the chapter insists on: a tools/call can fail in two
// different places, and the two look different on the wire. A malformed or
// unknown request comes back as a JSON-RPC error object (the request was never
// processed). A tool that runs and then fails comes back as a successful result
// carrying isError:true (the model reads the failure and can retry). Inline SVG,
// themed with the CSS variables, ASCII labels so it stays crisp and prose-clean.
export function McpFromTheWireUpFigure() {
  return (
    <svg
      viewBox="0 0 780 430"
      className="w-full min-w-[680px]"
      role="img"
      aria-label="Top lane: the three JSON-RPC message shapes MCP is built from. A request carries an id, a method, and params and expects a response. A response echoes that id and carries exactly one of result or error. A notification has no id and gets no reply. The rule that tells them apart is the presence of an id. Bottom lane: a single tools/call request forks into two kinds of failure that look different on the wire. If the request is malformed or names an unknown method or tool, the reply is a JSON-RPC error object, meaning the request was never processed. If the tool runs and then fails, the reply is a successful result with isError set to true, which the model reads and can retry from."
      fill="none"
    >
      <rect x="1" y="1" width="778" height="428" rx="10" fill="var(--surface-2)" stroke="var(--border)" />

      <defs>
        <marker id="mcp-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto">
          <path d="M0 0 L10 5 L0 10 z" fill="var(--accent)" />
        </marker>
      </defs>

      <text x="22" y="30" fontFamily="var(--font-mono)" fontSize="11" fill="var(--comment)">
        {"// every MCP message is one of three JSON-RPC 2.0 shapes"}
      </text>
      <text x="22" y="50" fontFamily="var(--font-mono)" fontSize="10" fill="var(--comment)">
        {"// the rule that tells them apart: an id means a reply is expected"}
      </text>

      {/* ---- TOP LANE: the three message shapes ---- */}

      {/* request */}
      <rect x="30" y="66" width="220" height="104" rx="8" fill="var(--surface)" stroke="var(--accent)" strokeOpacity="0.4" />
      <text x="46" y="90" fontFamily="var(--font-mono)" fontSize="13" fill="var(--accent)">request</text>
      <text x="46" y="114" fontFamily="var(--font-mono)" fontSize="10.5" fill="var(--comment)">{"{ \"id\": 1,"}</text>
      <text x="46" y="130" fontFamily="var(--font-mono)" fontSize="10.5" fill="var(--comment)">{"  \"method\": \"tools/call\","}</text>
      <text x="46" y="146" fontFamily="var(--font-mono)" fontSize="10.5" fill="var(--comment)">{"  \"params\": { ... } }"}</text>
      <text x="46" y="164" fontFamily="var(--font-mono)" fontSize="9" fill="var(--accent-dim)">has an id: expects a response</text>

      {/* response */}
      <rect x="280" y="66" width="220" height="104" rx="8" fill="var(--surface)" stroke="var(--border)" />
      <text x="296" y="90" fontFamily="var(--font-mono)" fontSize="13" fill="var(--accent)">response</text>
      <text x="296" y="114" fontFamily="var(--font-mono)" fontSize="10.5" fill="var(--comment)">{"{ \"id\": 1,"}</text>
      <text x="296" y="130" fontFamily="var(--font-mono)" fontSize="10.5" fill="var(--comment)">{"  \"result\": { ... } }"}</text>
      <text x="296" y="146" fontFamily="var(--font-mono)" fontSize="10.5" fill="var(--comment)">{"// result | error, never both"}</text>
      <text x="296" y="164" fontFamily="var(--font-mono)" fontSize="9" fill="var(--accent-dim)">echoes the request id</text>

      {/* notification */}
      <rect x="530" y="66" width="220" height="104" rx="8" fill="var(--surface)" stroke="var(--border)" />
      <text x="546" y="90" fontFamily="var(--font-mono)" fontSize="13" fill="var(--accent)">notification</text>
      <text x="546" y="114" fontFamily="var(--font-mono)" fontSize="10.5" fill="var(--comment)">{"{ \"method\":"}</text>
      <text x="546" y="130" fontFamily="var(--font-mono)" fontSize="10.5" fill="var(--comment)">{"  \"notifications/...\" }"}</text>
      <text x="546" y="146" fontFamily="var(--font-mono)" fontSize="10.5" fill="var(--comment)">{"// no id present"}</text>
      <text x="546" y="164" fontFamily="var(--font-mono)" fontSize="9" fill="var(--accent-dim)">no id: gets no reply</text>

      {/* the request -> response pairing arrow */}
      <path d="M 250 128 L 280 128" stroke="var(--accent)" strokeWidth="1.5" markerEnd="url(#mcp-arrow)" />

      {/* divider between lanes */}
      <line x1="30" y1="212" x2="750" y2="212" stroke="var(--border)" strokeWidth="1.5" strokeDasharray="4 4" />

      <text x="22" y="242" fontFamily="var(--font-mono)" fontSize="11" fill="var(--comment)">
        {"// a tools/call can fail in two places, and they look different on the wire"}
      </text>

      {/* ---- BOTTOM LANE: the two-failure fork ---- */}

      {/* source: the tools/call request */}
      <rect x="30" y="300" width="200" height="72" rx="8" fill="var(--surface)" stroke="var(--accent)" strokeOpacity="0.4" />
      <text x="130" y="330" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="12" fill="var(--accent)">tools/call</text>
      <text x="130" y="350" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="10" fill="var(--comment)">a request, id: 5</text>

      {/* fork lines */}
      <path d="M 230 322 L 300 288 L 430 288" stroke="var(--accent)" strokeWidth="1.5" markerEnd="url(#mcp-arrow)" fill="none" />
      <path d="M 230 350 L 300 384 L 430 384" stroke="var(--accent)" strokeWidth="1.5" markerEnd="url(#mcp-arrow)" fill="none" />

      {/* upper outcome: protocol error */}
      <rect x="432" y="256" width="318" height="64" rx="8" fill="var(--surface)" stroke="var(--border)" />
      <text x="448" y="278" fontFamily="var(--font-mono)" fontSize="11" fill="var(--fg)">protocol error</text>
      <text x="448" y="296" fontFamily="var(--font-mono)" fontSize="10" fill="var(--comment)">{"{ \"id\": 5, \"error\": { \"code\": -32602 } }"}</text>
      <text x="448" y="312" fontFamily="var(--font-mono)" fontSize="9" fill="var(--accent-dim)">unknown tool or bad params: never processed</text>

      {/* lower outcome: tool-execution error */}
      <rect x="432" y="352" width="318" height="64" rx="8" fill="var(--surface)" stroke="var(--accent)" strokeOpacity="0.35" />
      <text x="448" y="374" fontFamily="var(--font-mono)" fontSize="11" fill="var(--fg)">tool ran, then failed</text>
      <text x="448" y="392" fontFamily="var(--font-mono)" fontSize="10" fill="var(--comment)">{"{ \"id\": 5, \"result\": { \"isError\": true } }"}</text>
      <text x="448" y="408" fontFamily="var(--font-mono)" fontSize="9" fill="var(--accent-dim)">a real result: the model reads it and can retry</text>
    </svg>
  );
}
