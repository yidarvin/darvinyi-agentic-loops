// MemoryTaxonomyFigure shows the context window as the live hub and the three
// persistent stores around it. The arrows distinguish retrieve, encode, and
// consolidation so the diagram encodes the taxonomy's operational movement.
export function MemoryTaxonomyFigure() {
  return (
    <svg
      viewBox="0 0 860 510"
      className="w-full min-w-[720px]"
      role="img"
      aria-label="A memory taxonomy diagram. Working memory is a context-window hub at the top. Below it are episodic memory for dated events, semantic memory for generalized facts, and procedural memory for skills, code, prompts, and weights. Arrows show retrieval into working memory, writing from working memory to persistent stores, and consolidation from episodic records into semantic facts."
      fill="none"
    >
      <defs>
        <marker id="memory-taxonomy-arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
          <path d="M0,0 L0,6 L7,3 z" fill="var(--accent)" />
        </marker>
        <marker id="memory-taxonomy-muted-arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
          <path d="M0,0 L0,6 L7,3 z" fill="var(--comment)" />
        </marker>
      </defs>

      <rect x="1" y="1" width="858" height="508" rx="10" fill="var(--surface-2)" stroke="var(--border)" />
      <text x="28" y="31" fontFamily="var(--font-mono)" fontSize="11" fill="var(--comment)">
        {"// agent memory: persistent state only matters after retrieval"}
      </text>

      <rect x="252" y="64" width="356" height="112" rx="8" fill="var(--surface)" stroke="var(--accent)" strokeOpacity="0.65" />
      <text x="278" y="93" fontFamily="var(--font-mono)" fontSize="12" fill="var(--accent)">
        WORKING MEMORY
      </text>
      <text x="278" y="115" fontFamily="var(--font-mono)" fontSize="11" fill="var(--fg)">
        context window / active task / tool results
      </text>
      <text x="278" y="141" fontFamily="var(--font-mono)" fontSize="10" fill="var(--comment)">
        fast, finite, re-sent, ephemeral
      </text>

      <rect x="31" y="94" width="159" height="52" rx="6" fill="var(--surface)" stroke="var(--border)" />
      <text x="110" y="116" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="10" fill="var(--fg)">
        current input
      </text>
      <text x="110" y="132" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="9" fill="var(--comment)">
        user + environment
      </text>
      <path d="M190 120 H244" stroke="var(--accent)" strokeWidth="1.5" markerEnd="url(#memory-taxonomy-arrow)" />

      <rect x="670" y="94" width="159" height="52" rx="6" fill="var(--surface)" stroke="var(--border)" />
      <text x="749" y="116" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="10" fill="var(--fg)">
        next action
      </text>
      <text x="749" y="132" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="9" fill="var(--comment)">
        response + tool call
      </text>
      <path d="M616 120 H670" stroke="var(--accent)" strokeWidth="1.5" markerEnd="url(#memory-taxonomy-arrow)" />

      <text x="33" y="220" fontFamily="var(--font-mono)" fontSize="10" fill="var(--comment)">
        PERSISTENT OUTSIDE THE WINDOW
      </text>
      <line x1="31" y1="231" x2="829" y2="231" stroke="var(--border)" strokeWidth="1" />

      <MemoryStore
        x={46}
        title="EPISODIC"
        question="what happened?"
        detail="dated interactions, trajectories, examples"
        failure="too much raw history"
      />
      <MemoryStore
        x={326}
        title="SEMANTIC"
        question="what is true?"
        detail="facts, profiles, knowledge, current state"
        failure="stale or contradicted facts"
      />
      <MemoryStore
        x={606}
        title="PROCEDURAL"
        question="how do we act?"
        detail="skills, code, prompts, weights"
        failure="risky behavior change"
      />

      <path d="M151 300 C151 244 282 242 334 184" stroke="var(--accent)" strokeWidth="1.5" markerEnd="url(#memory-taxonomy-arrow)" />
      <text x="180" y="253" fontFamily="var(--font-mono)" fontSize="9" fill="var(--accent)">
        retrieve episode
      </text>
      <path d="M430 300 C430 247 430 242 430 184" stroke="var(--accent)" strokeWidth="1.5" markerEnd="url(#memory-taxonomy-arrow)" />
      <text x="441" y="251" fontFamily="var(--font-mono)" fontSize="9" fill="var(--accent)">
        retrieve fact
      </text>
      <path d="M710 300 C710 244 580 242 527 184" stroke="var(--accent)" strokeWidth="1.5" markerEnd="url(#memory-taxonomy-arrow)" />
      <text x="600" y="253" fontFamily="var(--font-mono)" fontSize="9" fill="var(--accent)">
        apply rule
      </text>

      <path d="M273 174 C218 207 168 222 151 298" stroke="var(--comment)" strokeWidth="1.25" strokeDasharray="5 4" markerEnd="url(#memory-taxonomy-muted-arrow)" />
      <text x="194" y="201" fontFamily="var(--font-mono)" fontSize="9" fill="var(--comment)">
        encode event
      </text>
      <path d="M474 174 C450 218 435 242 430 298" stroke="var(--comment)" strokeWidth="1.25" strokeDasharray="5 4" markerEnd="url(#memory-taxonomy-muted-arrow)" />
      <text x="450" y="214" fontFamily="var(--font-mono)" fontSize="9" fill="var(--comment)">
        write fact
      </text>
      <path d="M259 403 C292 446 433 446 469 403" stroke="var(--comment)" strokeWidth="1.25" strokeDasharray="5 4" markerEnd="url(#memory-taxonomy-muted-arrow)" />
      <text x="355" y="466" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="9" fill="var(--comment)">
        consolidate: episode -&gt; compact fact
      </text>

      <text x="430" y="494" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="9" fill="var(--comment)">
        store less, retrieve deliberately, keep provenance
      </text>
    </svg>
  );
}

function MemoryStore({
  x,
  title,
  question,
  detail,
  failure,
}: {
  x: number;
  title: string;
  question: string;
  detail: string;
  failure: string;
}) {
  return (
    <g>
      <rect x={x} y="300" width="208" height="104" rx="8" fill="var(--surface)" stroke="var(--border)" />
      <text x={x + 18} y="327" fontFamily="var(--font-mono)" fontSize="11" fill="var(--accent)">
        {title}
      </text>
      <text x={x + 18} y="347" fontFamily="var(--font-mono)" fontSize="10" fill="var(--fg)">
        {question}
      </text>
      <text x={x + 18} y="367" fontFamily="var(--font-mono)" fontSize="8.7" fill="var(--comment)">
        {detail}
      </text>
      <text x={x + 18} y="387" fontFamily="var(--font-mono)" fontSize="8.7" fill="var(--comment)">
        {`risk: ${failure}`}
      </text>
    </g>
  );
}
