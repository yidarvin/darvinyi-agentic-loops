// CoordinationPatternsFigure: a task dependency becomes a topology, then an
// operating constraint. The diagram keeps the selection rule visible at once.
export function CoordinationPatternsFigure() {
  return (
    <svg
      viewBox="0 0 1040 690"
      className="w-full min-w-[900px]"
      role="img"
      aria-label="Six task dependency shapes map to pipeline, fan-out and join, supervisor, hierarchy, peer handoff, and blackboard coordination patterns. A bottom dial shows code-driven control on the structured side and model-driven routing on the emergent side."
      fill="none"
    >
      <defs>
        <marker id="coordination-patterns-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 0 L 8 4 L 0 8 z" fill="var(--accent)" />
        </marker>
      </defs>

      <rect x="1" y="1" width="1038" height="688" rx="12" fill="var(--surface-2)" stroke="var(--border)" />

      <text x="26" y="32" fontFamily="var(--font-mono)" fontSize="12" fill="var(--accent)">
        {"// choose the graph from the dependency"}
      </text>
      <text x="26" y="52" fontFamily="var(--font-mono)" fontSize="9.5" fill="var(--fg-muted)">
        topology is a consequence of what can proceed independently, not an agent roster to admire
      </text>

      <text x="26" y="76" fontFamily="var(--font-mono)" fontSize="9.5" fill="var(--comment)">task dependency</text>
      <text x="332" y="76" fontFamily="var(--font-mono)" fontSize="9.5" fill="var(--comment)">smallest useful graph</text>
      <text x="693" y="76" fontFamily="var(--font-mono)" fontSize="9.5" fill="var(--comment)">non-negotiable constraint</text>

      <rect x="26" y="86" width="275" height="64" rx="7" fill="var(--surface)" stroke="var(--border)" />
      <text x="44" y="112" fontFamily="var(--font-mono)" fontSize="11" fill="var(--fg)">linear stages</text>
      <text x="44" y="132" fontFamily="var(--font-mono)" fontSize="9" fill="var(--fg-muted)">each output feeds the next</text>
      <line x1="302" y1="118" x2="323" y2="118" stroke="var(--accent)" strokeWidth="1.2" markerEnd="url(#coordination-patterns-arrow)" />

      <rect x="332" y="86" width="330" height="64" rx="7" fill="var(--surface)" stroke="var(--border)" />
      <text x="350" y="112" fontFamily="var(--font-mono)" fontSize="11" fill="var(--accent)">pipeline</text>
      <circle cx="500" cy="118" r="8" fill="var(--surface-2)" stroke="var(--accent)" />
      <circle cx="542" cy="118" r="8" fill="var(--surface-2)" stroke="var(--accent)" />
      <circle cx="584" cy="118" r="8" fill="var(--surface-2)" stroke="var(--accent)" />
      <line x1="509" y1="118" x2="533" y2="118" stroke="var(--accent)" strokeWidth="1.2" markerEnd="url(#coordination-patterns-arrow)" />
      <line x1="551" y1="118" x2="575" y2="118" stroke="var(--accent)" strokeWidth="1.2" markerEnd="url(#coordination-patterns-arrow)" />
      <text x="350" y="134" fontFamily="var(--font-mono)" fontSize="8.8" fill="var(--fg-muted)">control follows fixed order</text>
      <line x1="663" y1="118" x2="684" y2="118" stroke="var(--accent)" strokeWidth="1.2" markerEnd="url(#coordination-patterns-arrow)" />

      <rect x="693" y="86" width="321" height="64" rx="7" fill="var(--surface)" stroke="var(--border)" />
      <text x="711" y="112" fontFamily="var(--font-mono)" fontSize="10.2" fill="var(--fg)">fixed edges · serial latency</text>
      <text x="711" y="132" fontFamily="var(--font-mono)" fontSize="8.8" fill="var(--fg-muted)">stage contracts must be explicit</text>

      <rect x="26" y="168" width="275" height="64" rx="7" fill="var(--surface)" stroke="var(--border)" />
      <text x="44" y="194" fontFamily="var(--font-mono)" fontSize="11" fill="var(--fg)">independent reads</text>
      <text x="44" y="214" fontFamily="var(--font-mono)" fontSize="9" fill="var(--fg-muted)">same question, separable evidence</text>
      <line x1="302" y1="200" x2="323" y2="200" stroke="var(--accent)" strokeWidth="1.2" markerEnd="url(#coordination-patterns-arrow)" />

      <rect x="332" y="168" width="330" height="64" rx="7" fill="var(--surface)" stroke="var(--border)" />
      <text x="350" y="194" fontFamily="var(--font-mono)" fontSize="11" fill="var(--accent)">fan-out / join</text>
      <circle cx="496" cy="190" r="7" fill="var(--accent-dim)" stroke="var(--accent)" />
      <circle cx="548" cy="184" r="6" fill="var(--surface-2)" stroke="var(--accent)" />
      <circle cx="548" cy="200" r="6" fill="var(--surface-2)" stroke="var(--accent)" />
      <circle cx="548" cy="216" r="6" fill="var(--surface-2)" stroke="var(--accent)" />
      <circle cx="604" cy="200" r="7" fill="var(--accent-dim)" stroke="var(--accent)" />
      <line x1="503" y1="189" x2="541" y2="184" stroke="var(--accent)" strokeWidth="1.1" markerEnd="url(#coordination-patterns-arrow)" />
      <line x1="503" y1="191" x2="541" y2="200" stroke="var(--accent)" strokeWidth="1.1" markerEnd="url(#coordination-patterns-arrow)" />
      <line x1="503" y1="193" x2="541" y2="216" stroke="var(--accent)" strokeWidth="1.1" markerEnd="url(#coordination-patterns-arrow)" />
      <line x1="555" y1="184" x2="597" y2="198" stroke="var(--accent)" strokeWidth="1.1" markerEnd="url(#coordination-patterns-arrow)" />
      <line x1="555" y1="200" x2="597" y2="200" stroke="var(--accent)" strokeWidth="1.1" markerEnd="url(#coordination-patterns-arrow)" />
      <line x1="555" y1="216" x2="597" y2="202" stroke="var(--accent)" strokeWidth="1.1" markerEnd="url(#coordination-patterns-arrow)" />
      <text x="350" y="216" fontFamily="var(--font-mono)" fontSize="8.8" fill="var(--fg-muted)">parallel work becomes one result</text>
      <line x1="663" y1="200" x2="684" y2="200" stroke="var(--accent)" strokeWidth="1.2" markerEnd="url(#coordination-patterns-arrow)" />

      <rect x="693" y="168" width="321" height="64" rx="7" fill="var(--surface)" stroke="var(--border)" />
      <text x="711" y="194" fontFamily="var(--font-mono)" fontSize="10.2" fill="var(--fg)">bounded pool · deterministic reducer</text>
      <text x="711" y="214" fontFamily="var(--font-mono)" fontSize="8.8" fill="var(--fg-muted)">latency tracks the slowest branch</text>

      <rect x="26" y="250" width="275" height="64" rx="7" fill="var(--surface)" stroke="var(--border)" />
      <text x="44" y="276" fontFamily="var(--font-mono)" fontSize="11" fill="var(--fg)">triage + central synthesis</text>
      <text x="44" y="296" fontFamily="var(--font-mono)" fontSize="9" fill="var(--fg-muted)">classification changes the worker</text>
      <line x1="302" y1="282" x2="323" y2="282" stroke="var(--accent)" strokeWidth="1.2" markerEnd="url(#coordination-patterns-arrow)" />

      <rect x="332" y="250" width="330" height="64" rx="7" fill="var(--surface)" stroke="var(--border)" />
      <text x="350" y="276" fontFamily="var(--font-mono)" fontSize="11" fill="var(--accent)">supervisor</text>
      <rect x="494" y="262" width="58" height="18" rx="4" fill="var(--accent-dim)" stroke="var(--accent)" />
      <text x="523" y="274" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="7.5" fill="var(--fg)">route</text>
      <circle cx="580" cy="260" r="7" fill="var(--surface-2)" stroke="var(--accent)" />
      <circle cx="580" cy="282" r="7" fill="var(--surface-2)" stroke="var(--accent)" />
      <line x1="553" y1="269" x2="572" y2="261" stroke="var(--accent)" strokeWidth="1.1" markerEnd="url(#coordination-patterns-arrow)" />
      <line x1="553" y1="273" x2="572" y2="281" stroke="var(--accent)" strokeWidth="1.1" markerEnd="url(#coordination-patterns-arrow)" />
      <path d="M 573 257 C 558 245, 508 244, 503 260" stroke="var(--accent-dim)" strokeWidth="1.1" strokeDasharray="3 3" markerEnd="url(#coordination-patterns-arrow)" />
      <path d="M 573 285 C 558 298, 508 298, 503 280" stroke="var(--accent-dim)" strokeWidth="1.1" strokeDasharray="3 3" markerEnd="url(#coordination-patterns-arrow)" />
      <text x="350" y="298" fontFamily="var(--font-mono)" fontSize="8.8" fill="var(--fg-muted)">workers return to one owner</text>
      <line x1="663" y1="282" x2="684" y2="282" stroke="var(--accent)" strokeWidth="1.2" markerEnd="url(#coordination-patterns-arrow)" />

      <rect x="693" y="250" width="321" height="64" rx="7" fill="var(--surface)" stroke="var(--border)" />
      <text x="711" y="276" fontFamily="var(--font-mono)" fontSize="10.2" fill="var(--fg)">return control · translation tax</text>
      <text x="711" y="296" fontFamily="var(--font-mono)" fontSize="8.8" fill="var(--fg-muted)">routing and synthesis stay inspectable</text>

      <rect x="26" y="332" width="275" height="64" rx="7" fill="var(--surface)" stroke="var(--border)" />
      <text x="44" y="358" fontFamily="var(--font-mono)" fontSize="11" fill="var(--fg)">nested decomposition</text>
      <text x="44" y="378" fontFamily="var(--font-mono)" fontSize="9" fill="var(--fg-muted)">subproblems contain worker teams</text>
      <line x1="302" y1="364" x2="323" y2="364" stroke="var(--accent)" strokeWidth="1.2" markerEnd="url(#coordination-patterns-arrow)" />

      <rect x="332" y="332" width="330" height="64" rx="7" fill="var(--surface)" stroke="var(--border)" />
      <text x="350" y="358" fontFamily="var(--font-mono)" fontSize="11" fill="var(--accent)">hierarchy</text>
      <circle cx="510" cy="346" r="7" fill="var(--accent-dim)" stroke="var(--accent)" />
      <circle cx="478" cy="370" r="7" fill="var(--surface-2)" stroke="var(--accent)" />
      <circle cx="542" cy="370" r="7" fill="var(--surface-2)" stroke="var(--accent)" />
      <circle cx="462" cy="384" r="4.5" fill="var(--surface-2)" stroke="var(--border)" />
      <circle cx="494" cy="384" r="4.5" fill="var(--surface-2)" stroke="var(--border)" />
      <circle cx="526" cy="384" r="4.5" fill="var(--surface-2)" stroke="var(--border)" />
      <circle cx="558" cy="384" r="4.5" fill="var(--surface-2)" stroke="var(--border)" />
      <line x1="506" y1="352" x2="482" y2="365" stroke="var(--accent)" strokeWidth="1.1" markerEnd="url(#coordination-patterns-arrow)" />
      <line x1="514" y1="352" x2="538" y2="365" stroke="var(--accent)" strokeWidth="1.1" markerEnd="url(#coordination-patterns-arrow)" />
      <line x1="474" y1="376" x2="466" y2="380" stroke="var(--accent-dim)" strokeWidth="1" />
      <line x1="482" y1="376" x2="490" y2="380" stroke="var(--accent-dim)" strokeWidth="1" />
      <line x1="538" y1="376" x2="530" y2="380" stroke="var(--accent-dim)" strokeWidth="1" />
      <line x1="546" y1="376" x2="554" y2="380" stroke="var(--accent-dim)" strokeWidth="1" />
      <text x="350" y="380" fontFamily="var(--font-mono)" fontSize="8.8" fill="var(--fg-muted)">one coordination problem per tier</text>
      <line x1="663" y1="364" x2="684" y2="364" stroke="var(--accent)" strokeWidth="1.2" markerEnd="url(#coordination-patterns-arrow)" />

      <rect x="693" y="332" width="321" height="64" rx="7" fill="var(--surface)" stroke="var(--border)" />
      <text x="711" y="358" fontFamily="var(--font-mono)" fontSize="10.2" fill="var(--fg)">depth compounds latency and error</text>
      <text x="711" y="378" fontFamily="var(--font-mono)" fontSize="8.8" fill="var(--fg-muted)">stop nesting when a flat join works</text>

      <rect x="26" y="414" width="275" height="64" rx="7" fill="var(--surface)" stroke="var(--border)" />
      <text x="44" y="440" fontFamily="var(--font-mono)" fontSize="11" fill="var(--fg)">path unknown upfront</text>
      <text x="44" y="460" fontFamily="var(--font-mono)" fontSize="9" fill="var(--fg-muted)">the next peer takes over</text>
      <line x1="302" y1="446" x2="323" y2="446" stroke="var(--accent)" strokeWidth="1.2" markerEnd="url(#coordination-patterns-arrow)" />

      <rect x="332" y="414" width="330" height="64" rx="7" fill="var(--surface)" stroke="var(--border)" />
      <text x="350" y="440" fontFamily="var(--font-mono)" fontSize="11" fill="var(--accent)">peer handoff</text>
      <circle cx="514" cy="434" r="8" fill="var(--surface-2)" stroke="var(--accent)" />
      <circle cx="554" cy="454" r="8" fill="var(--surface-2)" stroke="var(--accent)" />
      <circle cx="474" cy="454" r="8" fill="var(--surface-2)" stroke="var(--accent)" />
      <line x1="521" y1="438" x2="547" y2="451" stroke="var(--accent)" strokeWidth="1.1" markerEnd="url(#coordination-patterns-arrow)" />
      <line x1="548" y1="456" x2="482" y2="456" stroke="var(--accent)" strokeWidth="1.1" markerEnd="url(#coordination-patterns-arrow)" />
      <line x1="478" y1="449" x2="508" y2="439" stroke="var(--accent)" strokeWidth="1.1" markerEnd="url(#coordination-patterns-arrow)" />
      <text x="350" y="462" fontFamily="var(--font-mono)" fontSize="8.8" fill="var(--fg-muted)">active control changes owner</text>
      <line x1="663" y1="446" x2="684" y2="446" stroke="var(--accent)" strokeWidth="1.2" markerEnd="url(#coordination-patterns-arrow)" />

      <rect x="693" y="414" width="321" height="64" rx="7" fill="var(--surface)" stroke="var(--border)" />
      <text x="711" y="440" fontFamily="var(--font-mono)" fontSize="10.2" fill="var(--fg)">transfer control · hop budget</text>
      <text x="711" y="460" fontFamily="var(--font-mono)" fontSize="8.8" fill="var(--fg-muted)">trace every transfer and stopping rule</text>

      <rect x="26" y="496" width="275" height="64" rx="7" fill="var(--surface)" stroke="var(--border)" />
      <text x="44" y="522" fontFamily="var(--font-mono)" fontSize="11" fill="var(--fg)">shared working record</text>
      <text x="44" y="542" fontFamily="var(--font-mono)" fontSize="9" fill="var(--fg-muted)">contributors read and update state</text>
      <line x1="302" y1="528" x2="323" y2="528" stroke="var(--accent)" strokeWidth="1.2" markerEnd="url(#coordination-patterns-arrow)" />

      <rect x="332" y="496" width="330" height="64" rx="7" fill="var(--surface)" stroke="var(--border)" />
      <text x="350" y="522" fontFamily="var(--font-mono)" fontSize="11" fill="var(--accent)">blackboard</text>
      <rect x="476" y="512" width="112" height="28" rx="4" fill="var(--surface-2)" stroke="var(--accent)" />
      <text x="532" y="530" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="8" fill="var(--fg)">shared state</text>
      <circle cx="448" cy="526" r="7" fill="var(--surface-2)" stroke="var(--accent)" />
      <circle cx="616" cy="512" r="7" fill="var(--surface-2)" stroke="var(--accent)" />
      <circle cx="616" cy="540" r="7" fill="var(--surface-2)" stroke="var(--accent)" />
      <line x1="455" y1="526" x2="469" y2="526" stroke="var(--accent)" strokeWidth="1.1" markerEnd="url(#coordination-patterns-arrow)" />
      <line x1="595" y1="517" x2="608" y2="513" stroke="var(--accent)" strokeWidth="1.1" markerEnd="url(#coordination-patterns-arrow)" />
      <line x1="595" y1="535" x2="608" y2="539" stroke="var(--accent)" strokeWidth="1.1" markerEnd="url(#coordination-patterns-arrow)" />
      <text x="350" y="544" fontFamily="var(--font-mono)" fontSize="8.8" fill="var(--fg-muted)">coordination through a state schema</text>
      <line x1="663" y1="528" x2="684" y2="528" stroke="var(--accent)" strokeWidth="1.2" markerEnd="url(#coordination-patterns-arrow)" />

      <rect x="693" y="496" width="321" height="64" rx="7" fill="var(--surface)" stroke="var(--border)" />
      <text x="711" y="522" fontFamily="var(--font-mono)" fontSize="10.2" fill="var(--fg)">schemas · reducers · write owner</text>
      <text x="711" y="542" fontFamily="var(--font-mono)" fontSize="8.8" fill="var(--fg-muted)">parallelize reads; serialize contested writes</text>

      <rect x="26" y="584" width="988" height="80" rx="9" fill="var(--surface)" stroke="var(--border)" />
      <text x="44" y="608" fontFamily="var(--font-mono)" fontSize="10" fill="var(--accent)">{"// who drives the next edge?"}</text>
      <text x="44" y="638" fontFamily="var(--font-mono)" fontSize="10" fill="var(--fg)">code-driven</text>
      <text x="44" y="654" fontFamily="var(--font-mono)" fontSize="8.8" fill="var(--fg-muted)">predicates · quotas · retries · locks</text>
      <line x1="258" y1="641" x2="782" y2="641" stroke="var(--border)" strokeWidth="3" strokeLinecap="round" />
      <line x1="258" y1="641" x2="516" y2="641" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" />
      <circle cx="516" cy="641" r="7" fill="var(--accent)" />
      <text x="530" y="635" fontFamily="var(--font-mono)" fontSize="8.8" fill="var(--accent)">default: code owns predictable transitions</text>
      <text x="994" y="638" textAnchor="end" fontFamily="var(--font-mono)" fontSize="10" fill="var(--fg)">model-driven</text>
      <text x="994" y="654" textAnchor="end" fontFamily="var(--font-mono)" fontSize="8.8" fill="var(--fg-muted)">novel discovery · dynamic routing</text>
    </svg>
  );
}
