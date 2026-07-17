// MemoryTaxonomyFigure separates memory type from access mechanism. Active working state
// persists across calls, each LLM call sees a context projection, and procedural memory has
// both an implicit parametric path and explicit skills that can be selected or retrieved.
export function MemoryTaxonomyFigure() {
  return (
    <svg
      viewBox="0 0 720 620"
      className="w-full min-w-[720px]"
      role="img"
      aria-label="A memory taxonomy diagram. Working memory is active agent state that persists across LLM calls. Each call receives a context projection selected from that state, and its result returns to working memory. Episodic and semantic records, plus explicit code-based skills, can be selected into working memory. Procedural model weights influence every generation directly. Consolidation transforms dated episodes into compact facts."
      fill="none"
    >
      <defs>
        <marker id="memory-taxonomy-arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
          <path d="M0,0 L0,6 L7,3 z" fill="var(--accent)" />
        </marker>
        <marker id="memory-taxonomy-muted-arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
          <path d="M0,0 L0,6 L7,3 z" fill="var(--fg-muted)" />
        </marker>
      </defs>

      <rect x="1" y="1" width="718" height="618" rx="10" fill="var(--surface-2)" stroke="var(--border)" />
      <text x="28" y="32" fontFamily="var(--font-mono)" fontSize="13" fill="var(--fg-muted)">
        {"// active state persists; each call sees a projection"}
      </text>

      <rect x="28" y="58" width="420" height="162" rx="8" fill="var(--surface)" stroke="var(--accent)" strokeOpacity="0.7" />
      <text x="50" y="87" fontFamily="var(--font-mono)" fontSize="16" fill="var(--accent)">
        WORKING MEMORY
      </text>
      <text x="50" y="112" fontFamily="var(--font-mono)" fontSize="13" fill="var(--fg)">
        active goals, variables, tool results
      </text>
      <text x="50" y="132" fontFamily="var(--font-mono)" fontSize="13" fill="var(--fg)">
        retrieved records, current plan
      </text>
      <text x="50" y="151" fontFamily="var(--font-mono)" fontSize="13" fill="var(--fg-muted)">
        persists across LLM calls in a decision loop
      </text>

      <rect x="50" y="166" width="376" height="36" rx="5" fill="var(--surface-2)" stroke="var(--border)" />
      <text x="64" y="189" fontFamily="var(--font-mono)" fontSize="13" fill="var(--fg)">
        per-call context projection: relevant subset
      </text>

      <rect x="486" y="78" width="206" height="120" rx="8" fill="var(--surface)" stroke="var(--border)" />
      <text x="508" y="108" fontFamily="var(--font-mono)" fontSize="16" fill="var(--accent)">
        LLM CALL
      </text>
      <text x="508" y="135" fontFamily="var(--font-mono)" fontSize="13" fill="var(--fg)">
        input: projection
      </text>
      <text x="508" y="158" fontFamily="var(--font-mono)" fontSize="13" fill="var(--fg)">
        output: action + variables
      </text>
      <text x="508" y="180" fontFamily="var(--font-mono)" fontSize="13" fill="var(--fg-muted)">
        parse result into state
      </text>

      <path d="M448 184 H478" stroke="var(--accent)" strokeWidth="1.75" markerEnd="url(#memory-taxonomy-arrow)" />
      <path
        d="M533 198 C514 228 442 238 400 220"
        stroke="var(--fg-muted)"
        strokeWidth="1.5"
        strokeDasharray="5 5"
        markerEnd="url(#memory-taxonomy-muted-arrow)"
      />

      <text x="486" y="247" fontFamily="var(--font-mono)" fontSize="13" fill="var(--fg-muted)">
        implicit weights
      </text>
      <text x="486" y="267" fontFamily="var(--font-mono)" fontSize="13" fill="var(--fg-muted)">
        shape every generation
      </text>
      <path
        d="M662 338 C706 300 708 226 682 198"
        stroke="var(--accent)"
        strokeWidth="1.75"
        strokeDasharray="6 4"
        markerEnd="url(#memory-taxonomy-arrow)"
      />

      <text x="28" y="312" fontFamily="var(--font-mono)" fontSize="14" fill="var(--fg-muted)">
        LONG-TERM MEMORY MODULES
      </text>
      <line x1="28" y1="320" x2="692" y2="320" stroke="var(--border)" strokeWidth="1" />

      <path d="M132 338 C132 291 166 269 190 220" stroke="var(--accent)" strokeWidth="1.5" markerEnd="url(#memory-taxonomy-arrow)" />
      <path d="M360 338 C360 291 304 269 294 220" stroke="var(--accent)" strokeWidth="1.5" markerEnd="url(#memory-taxonomy-arrow)" />
      <path d="M588 338 C588 294 414 269 386 220" stroke="var(--accent)" strokeWidth="1.5" markerEnd="url(#memory-taxonomy-arrow)" />

      <MemoryStore
        x={28}
        title="EPISODIC"
        question="what happened?"
        lines={["dated events", "traces + examples", "select into state", "risk: raw history"]}
      />
      <MemoryStore
        x={256}
        title="SEMANTIC"
        question="what is true?"
        lines={["facts + profiles", "durable knowledge", "select into state", "risk: stale facts"]}
      />
      <MemoryStore
        x={484}
        title="PROCEDURAL"
        question="how do we act?"
        lines={[
          "weights: direct path",
          "to every generation",
          "code + skills: select",
          "retrieve or execute",
          "risk: behavior change",
        ]}
      />

      <path d="M226 526 C270 563 405 563 469 526" stroke="var(--fg-muted)" strokeWidth="1.5" strokeDasharray="5 5" markerEnd="url(#memory-taxonomy-muted-arrow)" />
      <text x="348" y="586" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="13" fill="var(--fg-muted)">
        consolidate: dated episode -&gt; compact fact
      </text>
      <text x="348" y="607" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="13" fill="var(--fg-muted)">
        memory type and selection mechanism are separate axes
      </text>
    </svg>
  );
}

function MemoryStore({
  x,
  title,
  question,
  lines,
}: {
  x: number;
  title: string;
  question: string;
  lines: string[];
}) {
  return (
    <g>
      <rect x={x} y="338" width="208" height="188" rx="8" fill="var(--surface)" stroke="var(--border)" />
      <text x={x + 18} y="367" fontFamily="var(--font-mono)" fontSize="16" fill="var(--accent)">
        {title}
      </text>
      <text x={x + 18} y="392" fontFamily="var(--font-mono)" fontSize="13" fill="var(--fg)">
        {question}
      </text>
      {lines.map((line, index) => (
        <text
          key={line}
          x={x + 18}
          y={416 + index * 20}
          fontFamily="var(--font-mono)"
          fontSize="13"
          fill="var(--fg-muted)"
        >
          {line}
        </text>
      ))}
    </g>
  );
}
