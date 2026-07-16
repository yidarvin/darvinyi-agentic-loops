// DelegationFigure: the figure for "Delegation".
// The structure it encodes: delegation is a context boundary, not just a fan-out. A
// lead (orchestrator) and a subagent (worker) hold separate context windows, drawn as
// two panels split by a membrane. This is a deliberately narrow lab model: one-shot,
// non-fork, and no-message. The worker starts with an inherited runtime baseline, then
// receives a task-specific briefing and returns a normal final report that a runtime may
// scan. The worker's messy reading and backtracking fill ITS window and never cross back,
// so the lead's window stays low while the worker's runs high. Two gauges make that
// asymmetry literal. The legend distinguishes baseline, briefing, and return. The lesson
// band states why the return channel is a compression boundary. Inline SVG, themed with
// the CSS variables, mono labels, legible on a phone via the min-w wrapper.

export function DelegationFigure() {
  return (
    <svg
      viewBox="0 0 920 610"
      className="w-full min-w-[900px]"
      role="img"
      aria-label="A deliberately narrow one-shot, non-fork, no-message delegation model. Two context windows sit side by side, split by a dashed boundary. On the left, the lead holds a short context: a persisted plan, user query, Agent research tool call, and synthesis. On the right, the isolated worker starts with a runtime baseline of its own system and environment, project rules and memory, git snapshot, and preloaded skills, then receives a task-specific briefing. It reads repository files, backtracks, drafts, and distills in its own high-use window. Across the boundary, the task-specific briefing is the lab model's direct lead input, while the normal return is a final report that can be scanned by the runtime before the lead reads it. Legends distinguish the inherited baseline, briefing, and final report. A lesson band explains that returning a full transcript defeats the compression benefit."
      fill="none"
    >
      <rect x="1" y="1" width="918" height="608" rx="10" fill="var(--surface-2)" stroke="var(--border)" />

      <defs>
        <marker id="deleg-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto">
          <path d="M0 0 L10 5 L0 10 z" fill="var(--accent)" />
        </marker>
      </defs>

      <text x="22" y="24" fontFamily="var(--font-mono)" fontSize="11" fill="var(--comment)">
        {"// delegation is a context-engineering move: the mess stays in the subagent"}
      </text>

      {/* the membrane */}
      <line x1="445" y1="58" x2="445" y2="500" stroke="var(--border)" strokeDasharray="3 5" />
      <text x="445" y="52" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="9" fill="var(--comment)">the boundary</text>

      {/* ---- lead panel ---- */}
      <rect x="26" y="66" width="350" height="286" rx="9" fill="var(--surface)" stroke="var(--border)" />
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
      <rect x="512" y="66" width="380" height="286" rx="9" fill="var(--surface)" stroke="var(--border)" />
      <text x="530" y="92" fontFamily="var(--font-mono)" fontSize="12" fill="var(--accent)">{"// subagent context"}</text>
      <text x="530" y="107" fontFamily="var(--font-mono)" fontSize="9" fill="var(--comment)">a worker: fresh, isolated window</text>

      <text x="530" y="132" fontFamily="var(--font-mono)" fontSize="8.8" fill="var(--fg)">· baseline: system + environment</text>
      <text x="530" y="148" fontFamily="var(--font-mono)" fontSize="8.8" fill="var(--fg)">· rules/memory · git snapshot · skills</text>
      <text x="530" y="164" fontFamily="var(--font-mono)" fontSize="8.8" fill="var(--fg)">· task-specific briefing</text>
      <text x="530" y="184" fontFamily="var(--font-mono)" fontSize="9.5" fill="var(--fg)">· read store.py, models.py  +tokens</text>
      <text x="530" y="202" fontFamily="var(--font-mono)" fontSize="9.5" fill="var(--fg)">· ran tests → none, backtrack</text>
      <text x="530" y="220" fontFamily="var(--font-mono)" fontSize="9.5" fill="var(--fg)">· read cli.py, api.py      +tokens</text>
      <text x="530" y="238" fontFamily="var(--font-mono)" fontSize="9.5" fill="var(--fg)">· draft → revise → distill</text>

      <text x="530" y="266" fontFamily="var(--font-mono)" fontSize="9" fill="var(--comment)">all this burns here,</text>
      <text x="530" y="279" fontFamily="var(--font-mono)" fontSize="9" fill="var(--comment)">then it is discarded</text>

      <text x="530" y="308" fontFamily="var(--font-mono)" fontSize="8.5" fill="var(--comment)">context used: high</text>
      <rect x="530" y="314" width="344" height="12" rx="3" fill="var(--surface-2)" stroke="var(--border)" />
      <rect x="530" y="314" width="310" height="12" rx="3" fill="var(--accent-dim)" />

      <text x="530" y="342" fontFamily="var(--font-mono)" fontSize="8.5" fill="var(--comment)">the lead may spawn 1..N of these, in parallel</text>

      {/* ---- crossing channels ---- */}
      <text x="443" y="112" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="9.5" fill="var(--accent)">task-specific briefing</text>
      <line x1="376" y1="122" x2="504" y2="122" stroke="var(--accent)" strokeWidth="1.4" markerEnd="url(#deleg-arrow)" />
      <text x="443" y="140" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="8" fill="var(--comment)">direct lead input in lab model</text>

      <text x="443" y="258" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="9.5" fill="var(--accent)">final report</text>
      <line x1="504" y1="268" x2="376" y2="268" stroke="var(--accent)" strokeWidth="1.4" markerEnd="url(#deleg-arrow)" />
      <text x="443" y="286" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="8" fill="var(--comment)">runtime may scan it</text>

      {/* ---- legend: what each channel carries ---- */}
      <rect x="26" y="372" width="430" height="120" rx="9" fill="var(--surface)" stroke="var(--border)" />
      <text x="44" y="396" fontFamily="var(--font-mono)" fontSize="10.5" fill="var(--accent)">{"// worker runtime baseline"}</text>
      <text x="44" y="418" fontFamily="var(--font-mono)" fontSize="9" fill="var(--fg)">system/env · rules/memory · git snapshot</text>
      <text x="44" y="435" fontFamily="var(--font-mono)" fontSize="9" fill="var(--fg)">preloaded skills</text>
      <text x="44" y="462" fontFamily="var(--font-mono)" fontSize="9" fill="var(--comment)">briefing adds task-specific facts and boundaries</text>

      <rect x="466" y="372" width="426" height="120" rx="9" fill="var(--surface)" stroke="var(--border)" />
      <text x="484" y="396" fontFamily="var(--font-mono)" fontSize="10.5" fill="var(--accent)">{"// normal return"}</text>
      <text x="484" y="418" fontFamily="var(--font-mono)" fontSize="9" fill="var(--fg)">final report becomes an Agent tool result</text>
      <text x="484" y="435" fontFamily="var(--font-mono)" fontSize="9" fill="var(--fg)">runtime may scan or mark the report</text>
      <text x="484" y="462" fontFamily="var(--font-mono)" fontSize="9" fill="var(--comment)">the lab compares distilled result vs transcript</text>

      {/* ---- lesson band ---- */}
      <rect x="26" y="512" width="866" height="72" rx="8" fill="var(--surface)" stroke="var(--border)" />
      <text x="44" y="540" fontFamily="var(--font-mono)" fontSize="10.5" fill="var(--accent)">
        {"// isolation is the point; parallelism is the bonus."}
      </text>
      <text x="44" y="564" fontFamily="var(--font-mono)" fontSize="9.5" fill="var(--comment)">
        {"if the subagent returns its full context instead of a distilled result, you pay the tokens twice and lose the whole benefit."}
      </text>
    </svg>
  );
}
