export function WhenMultiAgentFailsFigure() {
  return (
    <svg
      viewBox="0 0 760 418"
      className="min-w-[680px] w-full"
      role="img"
      aria-label="A topology decision: keep coupled writes in one contextual loop, and fan out only independent reads before a single writer. The bottom row names the three MAST failure categories added by coordination."
      fill="none"
    >
      <title>Choose topology from dependency shape</title>
      <desc>
        Coupled work stays in one agent context with one write path. Independent research can fan out,
        but its results converge on one writer. Multi-agent coordination introduces MAST design,
        alignment, and verification failure surfaces.
      </desc>
      <defs>
        <marker
          id="when-multi-agent-fails-arrow"
          markerWidth="7"
          markerHeight="7"
          refX="6"
          refY="3.5"
          orient="auto"
        >
          <path d="M0,0 L7,3.5 L0,7 Z" fill="var(--accent)" />
        </marker>
      </defs>

      <rect x="1" y="1" width="758" height="416" rx="8" fill="var(--surface-2)" stroke="var(--border)" />
      <text x="24" y="29" fontFamily="var(--font-mono)" fontSize="12" fill="var(--accent)">
        {"// choose topology from dependency shape"}
      </text>

      <rect x="20" y="52" width="348" height="222" rx="6" fill="var(--surface)" stroke="var(--border)" />
      <text x="42" y="78" fontFamily="var(--font-mono)" fontSize="11" fill="var(--fg)">
        {"// coupled task"}
      </text>
      <text x="42" y="98" fontFamily="var(--font-mono)" fontSize="10" fill="var(--fg-muted)">
        {"shared decisions or shared write state"}
      </text>

      <rect x="48" y="126" width="188" height="48" rx="5" fill="var(--surface-2)" stroke="var(--accent)" />
      <text x="142" y="147" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="11" fill="var(--fg)">
        {"one well-contexted agent"}
      </text>
      <text x="142" y="163" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="9" fill="var(--comment)">
        {"decisions remain continuous"}
      </text>

      <path d="M142 174 L142 203" stroke="var(--accent)" strokeWidth="1.5" markerEnd="url(#when-multi-agent-fails-arrow)" />
      <rect x="48" y="211" width="188" height="42" rx="5" fill="var(--surface-2)" stroke="var(--border)" />
      <text x="142" y="237" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="11" fill="var(--fg)">
        {"one write path"}
      </text>

      <path d="M258 143 L314 143" stroke="var(--border)" strokeWidth="1.5" />
      <path d="M258 232 L314 232" stroke="var(--border)" strokeWidth="1.5" />
      <text x="324" y="146" fontFamily="var(--font-mono)" fontSize="9" fill="var(--comment)">
        {"no handoff"}
      </text>
      <text x="324" y="235" fontFamily="var(--font-mono)" fontSize="9" fill="var(--comment)">
        {"no merge"}
      </text>

      <rect x="392" y="52" width="348" height="222" rx="6" fill="var(--surface)" stroke="var(--border)" />
      <text x="414" y="78" fontFamily="var(--font-mono)" fontSize="11" fill="var(--fg)">
        {"// independent reads"}
      </text>
      <text x="414" y="98" fontFamily="var(--font-mono)" fontSize="10" fill="var(--fg-muted)">
        {"bounded fan-out, then one owner mutates state"}
      </text>

      <rect x="414" y="123" width="72" height="40" rx="5" fill="var(--surface-2)" stroke="var(--border)" />
      <rect x="508" y="123" width="72" height="40" rx="5" fill="var(--surface-2)" stroke="var(--border)" />
      <rect x="602" y="123" width="72" height="40" rx="5" fill="var(--surface-2)" stroke="var(--border)" />
      <text x="450" y="147" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="10" fill="var(--fg)">
        {"read 1"}
      </text>
      <text x="544" y="147" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="10" fill="var(--fg)">
        {"read 2"}
      </text>
      <text x="638" y="147" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="10" fill="var(--fg)">
        {"read n"}
      </text>

      <path d="M450 163 L535 203" stroke="var(--accent)" strokeWidth="1.5" markerEnd="url(#when-multi-agent-fails-arrow)" />
      <path d="M544 163 L544 203" stroke="var(--accent)" strokeWidth="1.5" markerEnd="url(#when-multi-agent-fails-arrow)" />
      <path d="M638 163 L553 203" stroke="var(--accent)" strokeWidth="1.5" markerEnd="url(#when-multi-agent-fails-arrow)" />
      <rect x="481" y="211" width="126" height="42" rx="5" fill="var(--surface-2)" stroke="var(--accent)" />
      <text x="544" y="228" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="10" fill="var(--fg)">
        {"single writer"}
      </text>
      <text x="544" y="243" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="9" fill="var(--comment)">
        {"joins evidence"}
      </text>

      <text x="20" y="304" fontFamily="var(--font-mono)" fontSize="10" fill="var(--comment)">
        {"// every coordination boundary must pay for its failure surface"}
      </text>

      <rect x="20" y="322" width="228" height="70" rx="5" fill="var(--surface)" stroke="var(--border)" />
      <text x="34" y="347" fontFamily="var(--font-mono)" fontSize="10" fill="var(--accent)">
        {"FC1  44.2%"}
      </text>
      <text x="34" y="366" fontFamily="var(--font-mono)" fontSize="10" fill="var(--fg)">
        {"design and system state"}
      </text>
      <text x="34" y="381" fontFamily="var(--font-mono)" fontSize="9" fill="var(--comment)">
        {"roles, loops, history, termination"}
      </text>

      <rect x="266" y="322" width="228" height="70" rx="5" fill="var(--surface)" stroke="var(--border)" />
      <text x="280" y="347" fontFamily="var(--font-mono)" fontSize="10" fill="var(--accent)">
        {"FC2  32.3%"}
      </text>
      <text x="280" y="366" fontFamily="var(--font-mono)" fontSize="10" fill="var(--fg)">
        {"inter-agent alignment"}
      </text>
      <text x="280" y="381" fontFamily="var(--font-mono)" fontSize="9" fill="var(--comment)">
        {"missing facts and conflicting decisions"}
      </text>

      <rect x="512" y="322" width="228" height="70" rx="5" fill="var(--surface)" stroke="var(--border)" />
      <text x="526" y="347" fontFamily="var(--font-mono)" fontSize="10" fill="var(--accent)">
        {"FC3  23.5%"}
      </text>
      <text x="526" y="366" fontFamily="var(--font-mono)" fontSize="10" fill="var(--fg)">
        {"verification and exit"}
      </text>
      <text x="526" y="381" fontFamily="var(--font-mono)" fontSize="9" fill="var(--comment)">
        {"premature or false completion"}
      </text>
    </svg>
  );
}
