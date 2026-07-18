type BoxLine = {
  text: string;
  accent?: boolean;
  muted?: boolean;
};

type BoxProps = {
  x: number;
  y: number;
  width: number;
  height: number;
  title: string;
  lines: BoxLine[];
  tone?: "accent" | "muted" | "danger";
};

// SelfManagedMemoryFigure shows bounded agency over the persistent write path.
export function SelfManagedMemoryFigure() {
  return (
    <svg
      viewBox="0 0 1000 650"
      className="w-full min-w-[880px]"
      role="img"
      aria-label="A self-managed memory write loop. In session N an agent proposes a memory change, which moves through a policy gate. The gate replaces volatile facts, appends dated history, or quarantines an untrusted candidate. An idle consolidator compacts recall and archive into a bounded hot block before session N plus one reloads it."
      fill="none"
    >
      <defs>
        <marker id="self-memory-arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
          <path d="M0,0 L0,6 L7,3 z" fill="var(--accent)" />
        </marker>
        <marker id="self-memory-muted-arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
          <path d="M0,0 L0,6 L7,3 z" fill="var(--fg-muted)" />
        </marker>
        <marker id="self-memory-danger-arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
          <path d="M0,0 L0,6 L7,3 z" fill="var(--danger)" />
        </marker>
      </defs>

      <rect x="1" y="1" width="998" height="648" rx="10" fill="var(--surface-2)" stroke="var(--border)" />
      <text x="30" y="35" fontFamily="var(--font-mono)" fontSize="16" fill="var(--fg-muted)">
        {"// self_managed_memory: agent proposes; runtime promotes; maintenance compacts"}
      </text>

      <text x="35" y="72" fontFamily="var(--font-mono)" fontSize="14" fill="var(--accent)">
        session_n / interaction path
      </text>
      <text x="464" y="72" fontFamily="var(--font-mono)" fontSize="14" fill="var(--fg-muted)">
        idle / maintenance path
      </text>
      <text x="790" y="72" fontFamily="var(--font-mono)" fontSize="14" fill="var(--accent)">
        session_n_plus_1
      </text>

      <Box
        x={30}
        y={95}
        width={170}
        height={158}
        title="primary agent"
        lines={[
          { text: "read hot block", accent: true },
          { text: "answer the user" },
          { text: "propose a write", accent: true },
          { text: "do not self-authorize", muted: true },
        ]}
      />
      <Box
        x={240}
        y={95}
        width={180}
        height={158}
        title="candidate memory"
        lines={[
          { text: "key + value" },
          { text: "source + namespace" },
          { text: "valid time" },
          { text: "untrusted by default", muted: true },
        ]}
        tone="muted"
      />
      <Box
        x={460}
        y={95}
        width={206}
        height={158}
        title="promotion policy"
        lines={[
          { text: "schema + size cap" },
          { text: "provenance + scope" },
          { text: "replace or append", accent: true },
          { text: "protected blocks", muted: true },
        ]}
        tone="accent"
      />
      <Box
        x={706}
        y={95}
        width={264}
        height={158}
        title="fresh session"
        lines={[
          { text: "reload project memory", accent: true },
          { text: "retrieve archive if needed" },
          { text: "act from current facts" },
          { text: "new context, same state", muted: true },
        ]}
      />

      <path d="M200 174 H230" stroke="var(--accent)" strokeWidth="1.5" markerEnd="url(#self-memory-arrow)" />
      <path d="M420 174 H450" stroke="var(--accent)" strokeWidth="1.5" markerEnd="url(#self-memory-arrow)" />

      <text x="299" y="285" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="14" fill="var(--fg-muted)">
        proposal, not a durable fact
      </text>
      <text x="563" y="285" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="14" fill="var(--accent)">
        agent chooses what to propose
      </text>
      <text x="563" y="304" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="14" fill="var(--accent)">
        runtime chooses what persists
      </text>

      <rect x="30" y="337" width="940" height="252" rx="10" fill="var(--surface)" stroke="var(--border)" />
      <text x="52" y="370" fontFamily="var(--font-mono)" fontSize="15" fill="var(--fg-muted)">
        memory tiers and maintenance
      </text>

      <Box
        x={52}
        y={397}
        width={215}
        height={145}
        title="hot block / project.md"
        lines={[
          { text: "bounded current facts", accent: true },
          { text: "always in context" },
          { text: "replace volatile truth" },
          { text: "token-priced", muted: true },
        ]}
        tone="accent"
      />
      <Box
        x={315}
        y={397}
        width={194}
        height={145}
        title="recall log"
        lines={[
          { text: "turns + tool traces" },
          { text: "dated observations" },
          { text: "raw material", muted: true },
        ]}
        tone="muted"
      />
      <Box
        x={557}
        y={397}
        width={194}
        height={145}
        title="archive"
        lines={[
          { text: "superseded facts" },
          { text: "episodic history" },
          { text: "retrieve on demand", muted: true },
        ]}
        tone="muted"
      />
      <Box
        x={799}
        y={397}
        width={149}
        height={145}
        title="quarantine"
        lines={[
          { text: "bad provenance" },
          { text: "prompt injection" },
          { text: "review or reject", muted: true },
        ]}
        tone="danger"
      />

      <path d="M563 253 V372 H160 V387" stroke="var(--accent)" strokeWidth="1.5" markerEnd="url(#self-memory-arrow)" />
      <text x="355" y="358" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="14" fill="var(--accent)">
        replace current fact
      </text>
      <path d="M603 253 V374 H654 V387" stroke="var(--fg-muted)" strokeWidth="1.5" markerEnd="url(#self-memory-muted-arrow)" />
      <text x="694" y="358" fontFamily="var(--font-mono)" fontSize="14" fill="var(--fg-muted)">
        append dated history
      </text>
      <path d="M642 253 V374 H873 V387" stroke="var(--danger)" strokeWidth="1.5" markerEnd="url(#self-memory-danger-arrow)" />
      <text x="838" y="358" fontFamily="var(--font-mono)" fontSize="14" fill="var(--danger)">
        reject
      </text>

      <rect x="306" y="564" width="448" height="58" rx="7" fill="var(--surface-2)" stroke="var(--fg-muted)" strokeDasharray="5 4" />
      <text x="530" y="588" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="14" fill="var(--fg)">
        idle consolidator: reflect, dedupe, time-normalize, compact
      </text>
      <text x="530" y="608" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="13" fill="var(--fg-muted)">
        reads raw history; proposes a diff; never bypasses promotion
      </text>
      <path d="M412 542 V554" stroke="var(--fg-muted)" strokeWidth="1.5" strokeDasharray="5 4" markerEnd="url(#self-memory-muted-arrow)" />
      <path d="M654 542 V554" stroke="var(--fg-muted)" strokeWidth="1.5" strokeDasharray="5 4" markerEnd="url(#self-memory-muted-arrow)" />
      <path d="M306 592 H278 V486 H277" stroke="var(--accent)" strokeWidth="1.5" strokeDasharray="5 4" markerEnd="url(#self-memory-arrow)" />
      <path d="M267 466 H696 V253" stroke="var(--accent)" strokeWidth="1.5" strokeDasharray="5 4" markerEnd="url(#self-memory-arrow)" />
      <text x="475" y="452" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="14" fill="var(--accent)">
        bounded summary is available at the next session
      </text>
    </svg>
  );
}

function Box({ x, y, width, height, title, lines, tone = "muted" }: BoxProps) {
  const stroke = tone === "danger" ? "var(--danger)" : tone === "accent" ? "var(--accent)" : "var(--border)";
  const titleColor = tone === "danger" ? "var(--danger)" : tone === "accent" ? "var(--accent)" : "var(--fg)";

  return (
    <g>
      <rect x={x} y={y} width={width} height={height} rx="8" fill="var(--surface-2)" stroke={stroke} strokeOpacity="0.8" />
      <text x={x + 17} y={y + 28} fontFamily="var(--font-mono)" fontSize="14" fill={titleColor}>
        {title}
      </text>
      <line x1={x + 17} y1={y + 41} x2={x + width - 17} y2={y + 41} stroke="var(--border)" />
      {lines.map((line, index) => (
        <text
          key={line.text}
          x={x + 17}
          y={y + 65 + index * 22}
          fontFamily="var(--font-mono)"
          fontSize="13.5"
          fill={line.accent ? "var(--accent)" : line.muted ? "var(--fg-muted)" : "var(--fg)"}
        >
          {line.text}
        </text>
      ))}
    </g>
  );
}
