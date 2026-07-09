// TransportsFigure: the figure for "Transports".
// The structure it encodes: MCP is layered. One JSON-RPC message (the protocol
// layer, top) travels unchanged no matter how its bytes move (the transport layer,
// below). The two standard transports frame that same message differently, and the
// deciding axis is drawn into the shapes: stdio is one client that owns one server
// subprocess over a pipe; Streamable HTTP is many clients reaching one server over
// a single endpoint, whose reply forks into a plain JSON body or an SSE stream.
// Inline SVG, themed with the CSS variables, ASCII labels so it stays crisp.
export function TransportsFigure() {
  return (
    <svg
      viewBox="0 0 800 470"
      className="w-full min-w-[720px]"
      role="img"
      aria-label="MCP is layered. At the top, the protocol layer holds one JSON-RPC tools/call message that is identical on every transport. Below a dashed line marking the transport layer, two panels frame that same message differently. The stdio panel shows one client stacked over one server subprocess, joined by a stdin/stdout pipe that carries the message as a single newline-delimited line with no headers; it is local, one client owns the process, sub-millisecond, authenticated by environment variables, and does not scale. The Streamable HTTP panel shows three clients reaching one server at a single POST /mcp endpoint, whose reply forks into either a 200 application/json body or a 200 text/event-stream of events; it is remote or local, serves many clients over one endpoint, adds a network round trip, uses standard HTTP auth and TLS, and scales horizontally."
      fill="none"
    >
      <rect x="1" y="1" width="798" height="468" rx="10" fill="var(--surface-2)" stroke="var(--border)" />

      <defs>
        <marker id="tr-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto">
          <path d="M0 0 L10 5 L0 10 z" fill="var(--accent)" />
        </marker>
      </defs>

      {/* ---- PROTOCOL LAYER: the one message that never changes ---- */}
      <text x="22" y="26" fontFamily="var(--font-mono)" fontSize="11" fill="var(--comment)">
        {"// MCP is layered: the protocol layer is one message, the transport is only its bytes"}
      </text>

      <rect x="30" y="38" width="740" height="56" rx="8" fill="var(--surface)" stroke="var(--accent)" strokeOpacity="0.4" />
      <text x="46" y="58" fontFamily="var(--font-mono)" fontSize="12" fill="var(--accent)">protocol layer</text>
      <text x="46" y="80" fontFamily="var(--font-mono)" fontSize="10" fill="var(--comment)">
        {"{ \"id\": 5, \"method\": \"tools/call\", \"params\": { \"name\": \"search\", \"arguments\": { \"q\": \"otters\" } } }"}
      </text>
      <text x="754" y="58" textAnchor="end" fontFamily="var(--font-mono)" fontSize="9" fill="var(--accent-dim)">identical on every transport</text>

      {/* transport-layer divider */}
      <line x1="30" y1="112" x2="770" y2="112" stroke="var(--border)" strokeWidth="1.5" strokeDasharray="4 4" />
      <text x="30" y="130" fontFamily="var(--font-mono)" fontSize="11" fill="var(--comment)">
        {"// transport layer: the same message, different bytes on the wire"}
      </text>

      {/* ================= LEFT PANEL: stdio ================= */}
      <rect x="30" y="140" width="350" height="306" rx="8" fill="var(--surface)" stroke="var(--border)" />
      <text x="48" y="168" fontFamily="var(--font-mono)" fontSize="14" fill="var(--accent)">stdio</text>
      <text x="48" y="186" fontFamily="var(--font-mono)" fontSize="9" fill="var(--comment)">{"// local subprocess"}</text>

      {/* one client over one server subprocess, joined by a pipe */}
      <rect x="70" y="198" width="150" height="40" rx="6" fill="var(--surface-2)" stroke="var(--accent)" strokeOpacity="0.4" />
      <text x="145" y="223" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="11" fill="var(--fg)">client (host)</text>

      <rect x="70" y="330" width="150" height="40" rx="6" fill="var(--surface-2)" stroke="var(--border)" />
      <text x="145" y="349" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="10.5" fill="var(--fg)">server</text>
      <text x="145" y="362" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="8.5" fill="var(--comment)">(subprocess)</text>

      {/* the pipe: bidirectional stdin/stdout */}
      <line x1="145" y1="330" x2="145" y2="238" stroke="var(--accent)" strokeWidth="1.5" markerStart="url(#tr-arrow)" markerEnd="url(#tr-arrow)" />
      <text x="120" y="288" textAnchor="end" fontFamily="var(--font-mono)" fontSize="8.5" fill="var(--comment)">stdin</text>
      <text x="120" y="300" textAnchor="end" fontFamily="var(--font-mono)" fontSize="8.5" fill="var(--comment)">stdout</text>

      {/* the framed bytes callout */}
      <rect x="232" y="256" width="132" height="58" rx="6" fill="var(--surface-2)" stroke="var(--border)" />
      <text x="246" y="274" fontFamily="var(--font-mono)" fontSize="8.5" fill="var(--comment)">on the wire:</text>
      <text x="246" y="290" fontFamily="var(--font-mono)" fontSize="9" fill="var(--accent-dim)">{"{...tools/call...}\\n"}</text>
      <text x="246" y="305" fontFamily="var(--font-mono)" fontSize="8" fill="var(--comment)">one line, no headers</text>
      <line x1="220" y1="284" x2="232" y2="284" stroke="var(--border)" strokeWidth="1" strokeDasharray="3 3" />

      <text x="48" y="404" fontFamily="var(--font-mono)" fontSize="9" fill="var(--comment)">{"// one client owns the process, sub-ms"}</text>
      <text x="48" y="418" fontFamily="var(--font-mono)" fontSize="9" fill="var(--comment)">{"// env-var auth, no network, no scaling"}</text>

      {/* ================= RIGHT PANEL: Streamable HTTP ================= */}
      <rect x="400" y="140" width="370" height="306" rx="8" fill="var(--surface)" stroke="var(--border)" />
      <text x="418" y="168" fontFamily="var(--font-mono)" fontSize="14" fill="var(--accent)">Streamable HTTP</text>
      <text x="418" y="186" fontFamily="var(--font-mono)" fontSize="9" fill="var(--comment)">{"// remote or local, many clients"}</text>

      {/* many clients */}
      {[200, 236, 272].map((y) => (
        <g key={y}>
          <rect x="418" y={y} width="90" height="28" rx="5" fill="var(--surface-2)" stroke="var(--border)" />
          <text x="463" y={y + 18} textAnchor="middle" fontFamily="var(--font-mono)" fontSize="10" fill="var(--fg)">client</text>
        </g>
      ))}

      {/* one endpoint */}
      <rect x="620" y="224" width="130" height="46" rx="6" fill="var(--surface-2)" stroke="var(--accent)" strokeOpacity="0.4" />
      <text x="685" y="243" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="11" fill="var(--fg)">server</text>
      <text x="685" y="258" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="8.5" fill="var(--comment)">one /mcp endpoint</text>

      {/* converging POSTs */}
      {[214, 250, 286].map((y) => (
        <path key={y} d={`M 508 ${y} L 620 247`} stroke="var(--accent)" strokeWidth="1.3" strokeOpacity="0.7" markerEnd="url(#tr-arrow)" />
      ))}
      <text x="512" y="203" fontFamily="var(--font-mono)" fontSize="8.5" fill="var(--comment)">POST /mcp + headers</text>

      {/* reply forks into JSON body or SSE stream */}
      <path d="M 660 270 L 560 316" stroke="var(--accent)" strokeWidth="1.3" markerEnd="url(#tr-arrow)" />
      <path d="M 712 270 L 690 316" stroke="var(--accent)" strokeWidth="1.3" markerEnd="url(#tr-arrow)" />

      <rect x="418" y="318" width="152" height="58" rx="6" fill="var(--surface-2)" stroke="var(--border)" />
      <text x="432" y="336" fontFamily="var(--font-mono)" fontSize="9.5" fill="var(--fg)">200 application/json</text>
      <text x="432" y="351" fontFamily="var(--font-mono)" fontSize="8.5" fill="var(--comment)">one body, then done</text>
      <text x="432" y="366" fontFamily="var(--font-mono)" fontSize="8.5" fill="var(--accent-dim)">stateless-friendly</text>

      <rect x="586" y="318" width="164" height="58" rx="6" fill="var(--surface-2)" stroke="var(--accent)" strokeOpacity="0.35" />
      <text x="600" y="336" fontFamily="var(--font-mono)" fontSize="9.5" fill="var(--fg)">200 text/event-stream</text>
      <text x="600" y="351" fontFamily="var(--font-mono)" fontSize="8.5" fill="var(--comment)">event, event, ... then close</text>
      <text x="600" y="366" fontFamily="var(--font-mono)" fontSize="8.5" fill="var(--accent-dim)">progress, resumable</text>

      <text x="418" y="404" fontFamily="var(--font-mono)" fontSize="9" fill="var(--comment)">{"// many clients, one endpoint, +1 round trip"}</text>
      <text x="418" y="418" fontFamily="var(--font-mono)" fontSize="9" fill="var(--comment)">{"// HTTP auth + TLS, scales horizontally"}</text>
    </svg>
  );
}
