// McpSecuritySurfaceFigure: the figure for "The MCP Security Surface".
// The structure it encodes: the lethal trifecta. Three legs feed one context window
// where DATA BECOMES INSTRUCTIONS, because the model cannot tell an instruction it was
// given from data it merely read. Leg A is untrusted content arriving on a tool result;
// it carries the injected instruction. Leg B is a legitimate private-data tool. Leg C is
// a legitimate exfiltration sink. The injection (danger-colored) rides in on A, drives the
// read on B, receives the private result back through the context window, and routes the
// secret out through C, all with tools the agent is ALLOWED to use. Numbered arrows make
// the model-mediated request/result path explicit. The lesson band makes the capability
// overlap explicit: a private retrieved record can itself carry untrusted text, so [B]+[C]
// is not a safety condition. For a defined flow, policy removes or gates a capability
// (resource-lock severs the reach into B, the exfil gate closes C). Inspection can lower
// exposure but does not prove the flow safe.
// Inline SVG, themed with the CSS variables, mono labels.

export function McpSecuritySurfaceFigure() {
  return (
    <svg
      viewBox="0 0 880 486"
      className="w-full min-w-[840px]"
      role="img"
      aria-label="The lethal trifecta, drawn as three legs feeding one context window. Leg A, top left, is untrusted content: a tool result from a public issue or web page, which carries a hidden injected instruction. Leg B, bottom left, is private data: a legitimate tool that reads a private repository or a secret file. Leg C, right, is an exfiltration sink: a legitimate tool that can send data out, such as opening a public pull request or fetching a URL. All arrows pass through the center, the agent's context window, where data becomes instructions because the model cannot separate an instruction it was given from data it merely read. Numbered danger-colored arrows show the attack sequence: the injected result reaches the model, the model requests private data, the private result returns to the model, and the model routes the secret out through the sink using only tools it is allowed to use. The lower band distinguishes capability combinations, not mutually exclusive safety states: private retrieved data can itself carry untrusted text, so the B plus C combination is not safe by itself. All three legs together complete the lethal trifecta. For a defined flow, policy can remove or gate a capability, for example per-session resource locking severs the reach into private data and the exfiltration gate closes the outbound sink. Inspection can lower exposure but does not prove the flow safe."
      fill="none"
    >
      <rect x="1" y="1" width="878" height="484" rx="10" fill="var(--surface-2)" stroke="var(--border)" />

      <defs>
        <marker id="mcp9-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto">
          <path d="M0 0 L10 5 L0 10 z" fill="var(--accent)" />
        </marker>
        <marker id="mcp9-arrow-danger" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7.5" markerHeight="7.5" orient="auto">
          <path d="M0 0 L10 5 L0 10 z" fill="var(--danger)" />
        </marker>
      </defs>

      <text x="22" y="18" fontFamily="var(--font-mono)" fontSize="11" fill="var(--comment)">
        {"// the lethal trifecta: three legs the agent is allowed to use, closed into a leak"}
      </text>

      <text x="450" y="40" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="10" fill="var(--danger)">
        {"attack sequence stays inside the model loop: [1] ingest -> [2] request -> [3] result -> [4] action"}
      </text>

      {/* leg A: untrusted content, carrying the injection */}
      <rect x="34" y="62" width="214" height="72" rx="8" fill="var(--surface)" stroke="var(--danger)" strokeOpacity="0.5" />
      <text x="48" y="84" fontFamily="var(--font-mono)" fontSize="11.5" fill="var(--fg)">[A] untrusted content</text>
      <text x="48" y="101" fontFamily="var(--font-mono)" fontSize="10" fill="var(--comment)">tool result: a public issue,</text>
      <text x="48" y="114" fontFamily="var(--font-mono)" fontSize="10" fill="var(--comment)">a web page, an email</text>
      <text x="48" y="128" fontFamily="var(--font-mono)" fontSize="10" fill="var(--danger)">carries the injected instruction</text>

      {/* leg B: private data */}
      <rect x="34" y="326" width="214" height="72" rx="8" fill="var(--surface)" stroke="var(--accent)" strokeOpacity="0.45" />
      <text x="48" y="348" fontFamily="var(--font-mono)" fontSize="11.5" fill="var(--fg)">[B] private data</text>
      <text x="48" y="365" fontFamily="var(--font-mono)" fontSize="10" fill="var(--comment)">a legitimate tool that reads</text>
      <text x="48" y="378" fontFamily="var(--font-mono)" fontSize="10" fill="var(--comment)">a private repo, a secret file,</text>
      <text x="48" y="391" fontFamily="var(--font-mono)" fontSize="10" fill="var(--comment)">a downstream record</text>

      {/* the center: the context window where data becomes instructions */}
      <rect x="352" y="182" width="196" height="98" rx="9" fill="var(--accent)" fillOpacity="0.08" stroke="var(--accent)" strokeOpacity="0.7" />
      <text x="450" y="210" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="11.5" fill="var(--accent)">context window</text>
      <text x="450" y="234" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="12.5" fill="var(--fg)">data becomes</text>
      <text x="450" y="250" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="12.5" fill="var(--fg)">instructions</text>
      <text x="450" y="269" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="10" fill="var(--comment)">no instruction / data boundary</text>

      {/* leg C: exfiltration sink */}
      <rect x="646" y="196" width="200" height="72" rx="8" fill="var(--surface)" stroke="var(--danger)" strokeOpacity="0.5" />
      <text x="660" y="218" fontFamily="var(--font-mono)" fontSize="11.5" fill="var(--fg)">[C] exfiltration sink</text>
      <text x="660" y="235" fontFamily="var(--font-mono)" fontSize="10" fill="var(--comment)">a legitimate tool that sends:</text>
      <text x="660" y="248" fontFamily="var(--font-mono)" fontSize="10" fill="var(--comment)">a public PR, a fetched URL,</text>
      <text x="660" y="261" fontFamily="var(--font-mono)" fontSize="10" fill="var(--comment)">a rendered markdown image</text>

      {/* numbered attack path: every request and result passes through model context */}
      <line x1="248" y1="102" x2="349" y2="196" stroke="var(--danger)" strokeWidth="1.6" strokeDasharray="5 4" markerEnd="url(#mcp9-arrow-danger)" />
      <line x1="352" y1="250" x2="248" y2="348" stroke="var(--danger)" strokeWidth="1.6" strokeDasharray="5 4" markerEnd="url(#mcp9-arrow-danger)" />
      <line x1="248" y1="379" x2="349" y2="266" stroke="var(--danger)" strokeWidth="1.6" strokeDasharray="5 4" markerEnd="url(#mcp9-arrow-danger)" />
      <line x1="548" y1="231" x2="642" y2="231" stroke="var(--danger)" strokeWidth="1.6" strokeDasharray="5 4" markerEnd="url(#mcp9-arrow-danger)" />
      <text x="280" y="151" fontFamily="var(--font-mono)" fontSize="10" fill="var(--danger)">[1] ingest</text>
      <text x="258" y="287" fontFamily="var(--font-mono)" fontSize="10" fill="var(--danger)">[2] request</text>
      <text x="258" y="310" fontFamily="var(--font-mono)" fontSize="10" fill="var(--danger)">[3] result</text>
      <text x="560" y="220" fontFamily="var(--font-mono)" fontSize="10" fill="var(--danger)">[4] action</text>

      {/* lesson band: the legs are capabilities, and one source can supply more than one */}
      <rect x="300" y="306" width="558" height="162" rx="8" fill="var(--surface)" stroke="var(--border)" />
      <text x="316" y="330" fontFamily="var(--font-mono)" fontSize="11" fill="var(--accent)">
        {"// capability combinations can overlap; inspection can lower exposure"}
      </text>
      <text x="316" y="354" fontFamily="var(--font-mono)" fontSize="10" fill="var(--fg)">
        {"[A]+[B]      no external send in this session"}
      </text>
      <text x="316" y="374" fontFamily="var(--font-mono)" fontSize="10" fill="var(--fg)">
        {"[A]+[C]      no private-data read in this session"}
      </text>
      <text x="316" y="394" fontFamily="var(--font-mono)" fontSize="10" fill="var(--danger)">
        {"[B]+[C]      not safe if [B] carries untrusted text"}
      </text>
      <text x="316" y="414" fontFamily="var(--font-mono)" fontSize="10" fill="var(--danger)">
        {"[A]+[B]+[C]  the lethal trifecta: autonomous exfiltration"}
      </text>
      <text x="316" y="436" fontFamily="var(--font-mono)" fontSize="10.5" fill="var(--danger)">
        {"overlap: private retrieved data can carry untrusted text"}
      </text>
      <text x="316" y="458" fontFamily="var(--font-mono)" fontSize="10" fill="var(--comment)">
        {"policy gates a capability; inspection can lower exposure, not prove safety."}
      </text>
    </svg>
  );
}
