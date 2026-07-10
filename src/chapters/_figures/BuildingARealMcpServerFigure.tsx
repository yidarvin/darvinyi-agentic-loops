// BuildingARealMcpServerFigure: the figure for "Building a Real MCP Server". The
// structure it encodes: a toy server is just the tool body; a real server is the shell
// of engineering wrapped around it. One tools/call from a non-deterministic agent
// crosses a pipeline the toy never built. Validation rejects malformed arguments as a
// PROTOCOL error before the body runs. Authorization checks the token audience and
// scope. The tool body (the whole of the toy, shaded) is reached only with resources
// the lifespan opened once at startup and injected. Then the error boundary forks three
// ways: a clean result, a VISIBLE ToolError the model can recover from, and an
// unexpected exception logged in full to stderr but MASKED to a generic message so
// nothing internal leaks. Inline SVG, themed with the CSS variables, mono labels.

export function BuildingARealMcpServerFigure() {
  return (
    <svg
      viewBox="0 0 860 470"
      className="w-full min-w-[820px]"
      role="img"
      aria-label="One tools/call from a non-deterministic agent crosses the pipeline a real MCP server wraps around its tool body, a pipeline the toy server never built. The request first hits schema validation: malformed arguments are rejected here as a JSON-RPC protocol error, code -32602, before the tool body ever runs. Next is authorization, which validates the token audience and per-tool scope and can reject with 401 or 403 for a remote server. Only then does the request reach the tool body, which is the entire toy server, shaded, and it is reached with the database pool and HTTP client that the lifespan opened once at startup and injected, not globals opened lazily. Finally the error boundary forks three ways. A success returns a structured result with isError false. A raised ToolError returns a visible message with isError true that the model reads and recovers from. An unexpected exception is logged in full to stderr and masked to a generic message with isError true, so no stack trace, SQL, or path leaks to the client. The lesson: the tool body is small; the shell around it is the engineering that separates a real server from a toy."
      fill="none"
    >
      <rect x="1" y="1" width="858" height="468" rx="10" fill="var(--surface-2)" stroke="var(--border)" />

      <defs>
        <marker id="mcp8-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto">
          <path d="M0 0 L10 5 L0 10 z" fill="var(--accent)" />
        </marker>
        <marker id="mcp8-arrow-dim" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto">
          <path d="M0 0 L10 5 L0 10 z" fill="var(--comment)" />
        </marker>
      </defs>

      <text x="22" y="28" fontFamily="var(--font-mono)" fontSize="11" fill="var(--comment)">
        {"// one tools/call from a non-deterministic agent. the toy is only the shaded box."}
      </text>

      {/* lifespan band: resources opened once at startup, injected into the body */}
      <rect x="150" y="52" width="470" height="30" rx="6" fill="var(--surface)" stroke="var(--accent)" strokeOpacity="0.35" strokeDasharray="4 3" />
      <text x="164" y="71" fontFamily="var(--font-mono)" fontSize="10" fill="var(--accent-dim)">
        {"lifespan: db pool + http client  ·  opened once at startup  ·  injected below"}
      </text>

      {/* the inbound request */}
      <rect x="22" y="150" width="96" height="52" rx="7" fill="var(--surface)" stroke="var(--border)" />
      <text x="70" y="172" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="11" fill="var(--fg)">tools/call</text>
      <text x="70" y="189" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="8" fill="var(--comment)">untrusted args</text>

      {/* stage: validate */}
      <line x1="118" y1="176" x2="146" y2="176" stroke="var(--accent)" strokeWidth="1.5" markerEnd="url(#mcp8-arrow)" />
      <rect x="150" y="150" width="104" height="52" rx="7" fill="var(--surface)" stroke="var(--border)" />
      <text x="202" y="170" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="11.5" fill="var(--accent)">validate</text>
      <text x="202" y="187" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="8" fill="var(--comment)">inputSchema</text>

      {/* validate -> protocol error branch (down) */}
      <line x1="202" y1="202" x2="202" y2="242" stroke="var(--comment)" strokeWidth="1.2" markerEnd="url(#mcp8-arrow-dim)" />
      <rect x="150" y="244" width="104" height="34" rx="6" fill="var(--surface-2)" stroke="var(--border)" />
      <text x="202" y="258" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="9.5" fill="var(--danger)">-32602</text>
      <text x="202" y="271" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="7.5" fill="var(--comment)">protocol error</text>

      {/* stage: authorize */}
      <line x1="254" y1="176" x2="282" y2="176" stroke="var(--accent)" strokeWidth="1.5" markerEnd="url(#mcp8-arrow)" />
      <rect x="286" y="150" width="104" height="52" rx="7" fill="var(--surface)" stroke="var(--border)" />
      <text x="338" y="170" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="11.5" fill="var(--accent)">authorize</text>
      <text x="338" y="187" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="8" fill="var(--comment)">aud + scope</text>

      {/* authorize -> 401/403 branch (down) */}
      <line x1="338" y1="202" x2="338" y2="242" stroke="var(--comment)" strokeWidth="1.2" markerEnd="url(#mcp8-arrow-dim)" />
      <rect x="286" y="244" width="104" height="34" rx="6" fill="var(--surface-2)" stroke="var(--border)" />
      <text x="338" y="258" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="9.5" fill="var(--danger)">401 / 403</text>
      <text x="338" y="271" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="7.5" fill="var(--comment)">no / wrong token</text>

      {/* stage: tool body (the toy) */}
      <line x1="390" y1="176" x2="418" y2="176" stroke="var(--accent)" strokeWidth="1.5" markerEnd="url(#mcp8-arrow)" />
      <rect x="422" y="146" width="118" height="60" rx="7" fill="var(--accent)" fillOpacity="0.1" stroke="var(--accent)" strokeOpacity="0.7" />
      <text x="481" y="168" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="11.5" fill="var(--accent)">tool body</text>
      <text x="481" y="184" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="8" fill="var(--comment)">the whole toy</text>
      <text x="481" y="197" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="8" fill="var(--comment)">is only this</text>

      {/* lifespan injects into the body */}
      <line x1="481" y1="82" x2="481" y2="144" stroke="var(--accent)" strokeWidth="1.1" strokeOpacity="0.55" strokeDasharray="3 3" markerEnd="url(#mcp8-arrow)" />

      {/* stage: error boundary */}
      <line x1="540" y1="176" x2="568" y2="176" stroke="var(--accent)" strokeWidth="1.5" markerEnd="url(#mcp8-arrow)" />
      <rect x="572" y="146" width="70" height="60" rx="7" fill="var(--surface)" stroke="var(--border)" />
      <text x="607" y="170" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="10" fill="var(--accent)">error</text>
      <text x="607" y="184" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="10" fill="var(--accent)">boundary</text>
      <text x="607" y="197" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="7.5" fill="var(--comment)">try / except</text>

      {/* three exits from the error boundary */}
      {/* success */}
      <line x1="642" y1="160" x2="672" y2="120" stroke="var(--accent)" strokeWidth="1.4" markerEnd="url(#mcp8-arrow)" />
      <rect x="676" y="98" width="168" height="44" rx="6" fill="var(--surface)" stroke="var(--accent)" strokeOpacity="0.4" />
      <text x="688" y="116" fontFamily="var(--font-mono)" fontSize="9.5" fill="var(--fg)">success</text>
      <text x="688" y="132" fontFamily="var(--font-mono)" fontSize="8.5" fill="var(--comment)">structured · isError:false</text>

      {/* visible ToolError */}
      <line x1="642" y1="176" x2="672" y2="176" stroke="var(--accent)" strokeWidth="1.4" markerEnd="url(#mcp8-arrow)" />
      <rect x="676" y="154" width="168" height="44" rx="6" fill="var(--surface)" stroke="var(--accent)" strokeOpacity="0.4" />
      <text x="688" y="172" fontFamily="var(--font-mono)" fontSize="9.5" fill="var(--accent)">ToolError (visible)</text>
      <text x="688" y="188" fontFamily="var(--font-mono)" fontSize="8.5" fill="var(--comment)">isError:true · model recovers</text>

      {/* masked exception */}
      <line x1="642" y1="192" x2="672" y2="232" stroke="var(--comment)" strokeWidth="1.4" markerEnd="url(#mcp8-arrow-dim)" />
      <rect x="676" y="210" width="168" height="58" rx="6" fill="var(--surface)" stroke="var(--border)" />
      <text x="688" y="228" fontFamily="var(--font-mono)" fontSize="9.5" fill="var(--danger)">exception (masked)</text>
      <text x="688" y="243" fontFamily="var(--font-mono)" fontSize="8" fill="var(--comment)">client: generic message</text>
      <text x="688" y="256" fontFamily="var(--font-mono)" fontSize="8" fill="var(--comment)">stderr: full stack trace</text>

      {/* the lesson band across the bottom */}
      <rect x="22" y="316" width="822" height="130" rx="8" fill="var(--surface)" stroke="var(--border)" />
      <text x="38" y="340" fontFamily="var(--font-mono)" fontSize="11" fill="var(--accent)">
        {"// the shell is the engineering"}
      </text>
      <text x="38" y="364" fontFamily="var(--font-mono)" fontSize="10" fill="var(--fg)">
        {"validate before the body runs      malformed args never reach your logic"}
      </text>
      <text x="38" y="384" fontFamily="var(--font-mono)" fontSize="10" fill="var(--fg)">
        {"authorize against the token         audience + per-tool scope, no passthrough downstream"}
      </text>
      <text x="38" y="404" fontFamily="var(--font-mono)" fontSize="10" fill="var(--fg)">
        {"lifespan owns the resources         open once, inject, tear down; never a lazy global"}
      </text>
      <text x="38" y="424" fontFamily="var(--font-mono)" fontSize="10" fill="var(--fg)">
        {"two error channels, one masked       ToolError teaches the model; exceptions stay on stderr"}
      </text>
    </svg>
  );
}
