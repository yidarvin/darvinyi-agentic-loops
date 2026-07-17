// RetrievalAsMemoryFigure shows retrieval as a controlled read from durable stores
// into a deliberately small working-memory packet.
export function RetrievalAsMemoryFigure() {
  return (
    <svg
      viewBox="0 0 980 590"
      className="w-full min-w-[820px]"
      role="img"
      aria-label="A retrieval pipeline moves semantic, episodic, and temporal records through authorization filters, dense and sparse candidate recall, rank fusion and reranking, then into a bounded evidence packet at the dynamic end of an agent prompt. A controller can take another budgeted retrieval pass or stop."
      fill="none"
    >
      <defs>
        <marker id="retrieval-memory-arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
          <path d="M0,0 L0,6 L7,3 z" fill="var(--accent)" />
        </marker>
        <marker id="retrieval-memory-muted-arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
          <path d="M0,0 L0,6 L7,3 z" fill="var(--fg-muted)" />
        </marker>
      </defs>

      <rect x="1" y="1" width="978" height="588" rx="10" fill="var(--surface-2)" stroke="var(--border)" />
      <text x="28" y="34" fontFamily="var(--font-mono)" fontSize="14" fill="var(--fg-muted)">
        {"// retrieval_as_memory: broad recall outside the prompt, precise evidence inside it"}
      </text>

      <StageCard
        x={28}
        y={72}
        width={166}
        title="long-term stores"
        accent="var(--fg-muted)"
        lines={[
          { text: "semantic docs" },
          { text: "episodic runs" },
          { text: "temporal facts" },
          { text: "provenance + scope", muted: true },
        ]}
      />
      <StageCard
        x={236}
        y={72}
        width={168}
        title="filter + recall"
        accent="var(--accent)"
        lines={[
          { text: "tenant / permission" },
          { text: "valid time" },
          { text: "dense candidates", accent: true },
          { text: "sparse candidates", accent: true },
        ]}
      />
      <StageCard
        x={446}
        y={72}
        width={168}
        title="precision repair"
        accent="var(--accent)"
        lines={[
          { text: "RRF over ranks", accent: true },
          { text: "rerank shortlist", accent: true },
          { text: "freshness" },
          { text: "diversity" },
        ]}
      />
      <StageCard
        x={656}
        y={72}
        width={146}
        title="evidence packet"
        accent="var(--accent)"
        lines={[
          { text: "top 3 to 10", accent: true },
          { text: "citations" },
          { text: "token budget" },
          { text: "replace, do not append", muted: true },
        ]}
      />
      <StageCard
        x={844}
        y={72}
        width={108}
        title="agent"
        accent="var(--fg-muted)"
        lines={[
          { text: "act" },
          { text: "answer" },
          { text: "judge" },
          { text: "stop", muted: true },
        ]}
      />

      <path d="M194 157 H226" stroke="var(--accent)" strokeWidth="1.5" markerEnd="url(#retrieval-memory-arrow)" />
      <path d="M404 157 H436" stroke="var(--accent)" strokeWidth="1.5" markerEnd="url(#retrieval-memory-arrow)" />
      <path d="M614 157 H646" stroke="var(--accent)" strokeWidth="1.5" markerEnd="url(#retrieval-memory-arrow)" />
      <path d="M802 157 H834" stroke="var(--accent)" strokeWidth="1.5" markerEnd="url(#retrieval-memory-arrow)" />

      <text x="28" y="290" fontFamily="var(--font-mono)" fontSize="13" fill="var(--fg-muted)">
        candidate space grows here
      </text>
      <path d="M56 307 H590" stroke="var(--border)" strokeWidth="1" strokeDasharray="4 5" />
      <path d="M56 307 V329 H590 V307" stroke="var(--fg-muted)" strokeWidth="1" markerEnd="url(#retrieval-memory-muted-arrow)" />
      <text x="278" y="352" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="12" fill="var(--comment)">
        recall failure: the needed record never reaches the shortlist
      </text>

      <text x="656" y="290" fontFamily="var(--font-mono)" fontSize="13" fill="var(--fg-muted)">
        context stays small here
      </text>
      <path d="M676 307 H930" stroke="var(--border)" strokeWidth="1" strokeDasharray="4 5" />
      <path d="M676 307 V329 H930 V307" stroke="var(--fg-muted)" strokeWidth="1" markerEnd="url(#retrieval-memory-muted-arrow)" />
      <text x="803" y="352" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="12" fill="var(--comment)">
        precision failure: distractors enter the window
      </text>

      <rect x="28" y="392" width="574" height="132" rx="8" fill="var(--surface)" stroke="var(--border)" />
      <text x="48" y="421" fontFamily="var(--font-mono)" fontSize="14" fill="var(--accent)">
        prompt layout
      </text>
      <rect x="48" y="440" width="155" height="54" rx="5" fill="var(--surface-2)" stroke="var(--border)" />
      <text x="125" y="463" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="12" fill="var(--fg)">
        system + tools
      </text>
      <text x="125" y="481" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="11" fill="var(--fg-muted)">
        stable prefix
      </text>
      <rect x="203" y="440" width="149" height="54" rx="5" fill="var(--surface-2)" stroke="var(--border)" />
      <text x="277" y="463" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="12" fill="var(--fg)">
        current request
      </text>
      <text x="277" y="481" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="11" fill="var(--fg-muted)">
        fresh turn
      </text>
      <rect x="352" y="440" width="222" height="54" rx="5" fill="var(--surface-2)" stroke="var(--accent)" strokeOpacity="0.8" />
      <text x="463" y="463" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="12" fill="var(--accent)">
        retrieved evidence packet
      </text>
      <text x="463" y="481" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="11" fill="var(--fg-muted)">
        dynamic tail, bounded
      </text>

      <rect x="650" y="392" width="302" height="132" rx="8" fill="var(--surface)" stroke="var(--border)" />
      <text x="670" y="421" fontFamily="var(--font-mono)" fontSize="14" fill="var(--accent)">
        retrieval controller
      </text>
      <text x="670" y="451" fontFamily="var(--font-mono)" fontSize="12" fill="var(--fg)">
        evidence sufficient?
      </text>
      <text x="670" y="477" fontFamily="var(--font-mono)" fontSize="12" fill="var(--fg-muted)">
        yes: answer or act
      </text>
      <text x="670" y="500" fontFamily="var(--font-mono)" fontSize="12" fill="var(--fg-muted)">
        no: rewrite, retrieve, replace
      </text>

      <path d="M898 250 V365 H778" stroke="var(--accent)" strokeWidth="1.5" strokeDasharray="5 4" markerEnd="url(#retrieval-memory-arrow)" />
      <text x="906" y="320" fontFamily="var(--font-mono)" fontSize="11" fill="var(--accent)">
        step budget
      </text>
      <text x="906" y="336" fontFamily="var(--font-mono)" fontSize="11" fill="var(--accent)">
        evidence budget
      </text>

      <text x="490" y="560" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="13" fill="var(--fg-muted)">
        retrieval quality = right evidence, right time, right scope, right amount
      </text>
    </svg>
  );
}

function StageCard({
  x,
  y,
  width,
  title,
  accent,
  lines,
}: {
  x: number;
  y: number;
  width: number;
  title: string;
  accent: string;
  lines: Array<{ text: string; accent?: boolean; muted?: boolean }>;
}) {
  return (
    <g>
      <rect x={x} y={y} width={width} height="170" rx="8" fill="var(--surface)" stroke={accent} strokeOpacity="0.75" />
      <text x={x + 18} y={y + 29} fontFamily="var(--font-mono)" fontSize="13" fill={accent}>
        {title}
      </text>
      <line x1={x + 18} y1={y + 42} x2={x + width - 18} y2={y + 42} stroke="var(--border)" />
      {lines.map((line, index) => (
        <text
          key={line.text}
          x={x + 18}
          y={y + 63 + index * 25}
          fontFamily="var(--font-mono)"
          fontSize="12"
          fill={line.accent ? "var(--accent)" : line.muted ? "var(--comment)" : "var(--fg)"}
        >
          {line.text}
        </text>
      ))}
    </g>
  );
}
