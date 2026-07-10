// DelegationFigure: the figure for "Delegation".
// The structure it encodes: delegation is a context boundary, not just a fan-out. A
// lead (orchestrator) and a subagent (worker) hold separate context windows, drawn as
// two panels split by a membrane. The asymmetry is the whole point. Down the only
// channel is the prompt string; up the only channel is a distilled result. The
// subagent's messy reading and backtracking fill ITS window and never cross back, so
// the lead's window stays low while the subagent's runs high. Two gauges make that
// asymmetry literal. The legend states exactly what each channel carries; the lesson
// band states why the return channel is a compression boundary. Inline SVG, themed
// with the CSS variables, mono labels, legible on a phone via the min-w wrapper.

export function DelegationFigure() {
  return (
    <svg
      viewBox="0 0 920 580"
      className="w-full min-w-[900px]"
      role="img"
      aria-label="Two context windows side by side, split by a dashed vertical membrane labeled the boundary. On the left, the lead (the orchestrator) holds a clean, short context: a plan persisted to memory, the user query, an Agent research tool call, and a synthesis; a gauge shows its context used is low, and a note says the subagent's reading never lands in this window. On the right, the subagent (a worker with a fresh, isolated window) accumulates messy work: its system prompt and the prompt string, reading store.py, models.py, cli.py, and api.py, running tests that find none and backtracking, then drafting and distilling; a gauge shows its context used is high, and a note says all this burns here and is then discarded. Across the membrane two arrows show the asymmetry: down from lead to subagent crosses only the prompt string, the only way in; up from subagent to lead crosses only the distilled result, the only way back. A legend states what crosses down (objective, output format, tool and source guidance, task boundaries, file paths) versus what crosses up (one distilled summary, or a filesystem reference for large artifacts, never the raw transcript). A lesson band states that isolation is the point and parallelism the bonus, and that if the subagent returns its full context you lose the whole benefit."
      fill="none"
    >
      <rect x="1" y="1" width="918" height="578" rx="10" fill="var(--surface-2)" stroke="var(--border)" />

      <defs>
        <marker id="deleg-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto">
          <path d="M0 0 L10 5 L0 10 z" fill="var(--accent)" />
        </marker>
      </defs>

      <text x="22" y="24" fontFamily="var(--font-mono)" fontSize="11" fill="var(--comment)">
        {"// delegation is a context-engineering move: the mess stays in the subagent"}
      </text>

      {/* the membrane */}
      <line x1="445" y1="58" x2="445" y2="470" stroke="var(--border)" strokeDasharray="3 5" />
      <text x="445" y="52" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="9" fill="var(--comment)">the boundary</text>

      {/* ---- lead panel ---- */}
      <rect x="26" y="66" width="350" height="256" rx="9" fill="var(--surface)" stroke="var(--border)" />
      <text x="44" y="92" fontFamily="var(--font-mono)" fontSize="12" fill="var(--accent)">{"// lead context"}</text>
      <text x="44" y="107" fontFamily="var(--font-mono)" fontSize="9" fill="var(--comment)">the orchestrator</text>

      <text x="44" y="136" fontFamily="var(--font-mono)" fontSize="10" fill="var(--fg)">· plan → persisted to memory</text>
      <text x="44" y="158" fontFamily="var(--font-mono)" fontSize="10" fill="var(--fg)">· user query</text>
      <text x="44" y="180" fontFamily="var(--font-mono)" fontSize="10" fill="var(--fg)">· Agent(research) tool call</text>
      <text x="44" y="202" fontFamily="var(--font-mono)" fontSize="10" fill="var(--fg)">· synthesis → answer</text>

      <text x="44" y="232" fontFamily="var(--font-mono)" fontSize="9" fill="var(--comment)">the subagent's reading</text>
      <text x="44" y="245" fontFamily="var(--font-mono)" fontSize="9" fill="var(--comment)">never lands in this window</text>

      <text x="44" y="284" fontFamily="var(--font-mono)" fontSize="8.5" fill="var(--comment)">context used: low</text>
      <rect x="44" y="290" width="310" height="12" rx="3" fill="var(--surface-2)" stroke="var(--border)" />
      <rect x="44" y="290" width="46" height="12" rx="3" fill="var(--accent)" fillOpacity="0.6" />

      {/* ---- subagent panel ---- */}
      <rect x="512" y="66" width="380" height="256" rx="9" fill="var(--surface)" stroke="var(--border)" />
      <text x="530" y="92" fontFamily="var(--font-mono)" fontSize="12" fill="var(--accent)">{"// subagent context"}</text>
      <text x="530" y="107" fontFamily="var(--font-mono)" fontSize="9" fill="var(--comment)">a worker: fresh, isolated window</text>

      <text x="530" y="132" fontFamily="var(--font-mono)" fontSize="9.5" fill="var(--fg)">· system prompt + the prompt string</text>
      <text x="530" y="150" fontFamily="var(--font-mono)" fontSize="9.5" fill="var(--fg)">· read store.py           +tokens</text>
      <text x="530" y="168" fontFamily="var(--font-mono)" fontSize="9.5" fill="var(--fg)">· read models.py          +tokens</text>
      <text x="530" y="186" fontFamily="var(--font-mono)" fontSize="9.5" fill="var(--fg)">· ran tests → none, backtrack</text>
      <text x="530" y="204" fontFamily="var(--font-mono)" fontSize="9.5" fill="var(--fg)">· read cli.py, api.py     +tokens</text>
      <text x="530" y="222" fontFamily="var(--font-mono)" fontSize="9.5" fill="var(--fg)">· draft → revise → distill</text>

      <text x="530" y="250" fontFamily="var(--font-mono)" fontSize="9" fill="var(--comment)">all this burns here,</text>
      <text x="530" y="263" fontFamily="var(--font-mono)" fontSize="9" fill="var(--comment)">then it is discarded</text>

      <text x="530" y="284" fontFamily="var(--font-mono)" fontSize="8.5" fill="var(--comment)">context used: high</text>
      <rect x="530" y="290" width="344" height="12" rx="3" fill="var(--surface-2)" stroke="var(--border)" />
      <rect x="530" y="290" width="310" height="12" rx="3" fill="var(--accent-dim)" />

      <text x="530" y="316" fontFamily="var(--font-mono)" fontSize="8.5" fill="var(--comment)">the lead may spawn 1..N of these, in parallel</text>

      {/* ---- crossing channels ---- */}
      <text x="443" y="112" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="9.5" fill="var(--accent)">the prompt string</text>
      <line x1="376" y1="122" x2="504" y2="122" stroke="var(--accent)" strokeWidth="1.4" markerEnd="url(#deleg-arrow)" />
      <text x="443" y="140" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="8" fill="var(--comment)">the only way in</text>

      <text x="443" y="258" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="9.5" fill="var(--accent)">distilled result</text>
      <line x1="504" y1="268" x2="376" y2="268" stroke="var(--accent)" strokeWidth="1.4" markerEnd="url(#deleg-arrow)" />
      <text x="443" y="286" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="8" fill="var(--comment)">the only way back</text>

      {/* ---- legend: what each channel carries ---- */}
      <rect x="26" y="342" width="430" height="120" rx="9" fill="var(--surface)" stroke="var(--border)" />
      <text x="44" y="366" fontFamily="var(--font-mono)" fontSize="10.5" fill="var(--accent)">{"// what crosses down"}</text>
      <text x="44" y="388" fontFamily="var(--font-mono)" fontSize="9" fill="var(--fg)">objective · output format · tool guidance</text>
      <text x="44" y="405" fontFamily="var(--font-mono)" fontSize="9" fill="var(--fg)">task boundaries · file paths + decisions</text>
      <text x="44" y="432" fontFamily="var(--font-mono)" fontSize="9" fill="var(--comment)">the prompt is the only channel in;</text>
      <text x="44" y="446" fontFamily="var(--font-mono)" fontSize="9" fill="var(--comment)">write everything the worker needs into it</text>

      <rect x="466" y="342" width="426" height="120" rx="9" fill="var(--surface)" stroke="var(--border)" />
      <text x="484" y="366" fontFamily="var(--font-mono)" fontSize="10.5" fill="var(--accent)">{"// what crosses up"}</text>
      <text x="484" y="388" fontFamily="var(--font-mono)" fontSize="9" fill="var(--fg)">one distilled summary, or a filesystem</text>
      <text x="484" y="405" fontFamily="var(--font-mono)" fontSize="9" fill="var(--fg)">reference for a large artifact</text>
      <text x="484" y="432" fontFamily="var(--font-mono)" fontSize="9" fill="var(--comment)">never the raw transcript; the return</text>
      <text x="484" y="446" fontFamily="var(--font-mono)" fontSize="9" fill="var(--comment)">channel is a compression boundary</text>

      {/* ---- lesson band ---- */}
      <rect x="26" y="482" width="866" height="72" rx="8" fill="var(--surface)" stroke="var(--border)" />
      <text x="44" y="510" fontFamily="var(--font-mono)" fontSize="10.5" fill="var(--accent)">
        {"// isolation is the point; parallelism is the bonus."}
      </text>
      <text x="44" y="534" fontFamily="var(--font-mono)" fontSize="9.5" fill="var(--comment)">
        {"if the subagent returns its full context instead of a distilled result, you pay the tokens twice and lose the whole benefit."}
      </text>
    </svg>
  );
}
