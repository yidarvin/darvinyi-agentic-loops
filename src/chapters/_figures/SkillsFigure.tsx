// SkillsFigure: the figure for "Skills".
// The structure it encodes: progressive disclosure as a three-level loading ladder.
// A Skill is not one thing that loads; it is three tiers that load at different times
// and cost the context window very different amounts. Level 1 (metadata: name +
// description) is always resident, and it is paid once per installed skill, so it scales
// with how many skills you have. Level 2 (the SKILL.md body) loads after a harness selects
// a skill for the task. Level 3+ (bundled scripts and reference docs) is read or executed
// from disk on demand. A harness can return a script's output without first loading its
// source, so the bundle is effectively unbounded. The right panel is the context window itself, showing what
// actually lands in it. The lesson band states why 100 skills cost kilotokens at startup
// rather than hundreds of thousands. Inline SVG, themed with the CSS variables, mono labels.

export function SkillsFigure() {
  return (
    <svg
      viewBox="0 0 900 500"
      className="w-full min-w-[860px]"
      role="img"
      aria-label="Progressive disclosure drawn as a three-level loading ladder feeding one context window in an Agent Skills-style harness. Metadata loads at startup for each installed skill. The SKILL.md body loads after a harness selects a skill. Bundled references and scripts stay on disk until the agent reads or executes them. A script run can return output without first loading source into the context window. The payoff is low startup context at the cost of filesystem round trips when work activates."
      fill="none"
    >
      <rect x="1" y="1" width="898" height="498" rx="10" fill="var(--surface-2)" stroke="var(--border)" />

      <defs>
        <marker id="sk10-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto">
          <path d="M0 0 L10 5 L0 10 z" fill="var(--accent)" />
        </marker>
        <marker id="sk10-arrow-dim" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto">
          <path d="M0 0 L10 5 L0 10 z" fill="var(--comment)" />
        </marker>
      </defs>

      <text x="22" y="20" fontFamily="var(--font-mono)" fontSize="11" fill="var(--comment)">
        {"// progressive disclosure: three tiers, loaded at different times, costing the window very differently"}
      </text>

      {/* level 1: metadata, always resident, paid per skill */}
      <rect x="28" y="46" width="440" height="96" rx="8" fill="var(--surface)" stroke="var(--accent)" strokeOpacity="0.6" />
      <text x="44" y="70" fontFamily="var(--font-mono)" fontSize="12" fill="var(--accent)">level 1 · metadata</text>
      <text x="44" y="90" fontFamily="var(--font-mono)" fontSize="9.5" fill="var(--comment)">loaded: always, at startup</text>
      <text x="44" y="107" fontFamily="var(--font-mono)" fontSize="9.5" fill="var(--fg)">~100 tokens</text>
      <text x="150" y="107" fontFamily="var(--font-mono)" fontSize="9.5" fill="var(--comment)">× every skill installed</text>
      <text x="44" y="128" fontFamily="var(--font-mono)" fontSize="10.5" fill="var(--fg)">name + description</text>

      {/* level 2: the body, on trigger, one skill */}
      <rect x="28" y="166" width="440" height="96" rx="8" fill="var(--surface)" stroke="var(--accent)" strokeOpacity="0.35" strokeDasharray="5 4" />
      <text x="44" y="190" fontFamily="var(--font-mono)" fontSize="12" fill="var(--fg)">level 2 · instructions</text>
      <text x="44" y="210" fontFamily="var(--font-mono)" fontSize="9.5" fill="var(--comment)">loaded: after the harness selects the skill</text>
      <text x="44" y="227" fontFamily="var(--font-mono)" fontSize="9.5" fill="var(--fg)">&lt; 5k tokens</text>
      <text x="150" y="227" fontFamily="var(--font-mono)" fontSize="9.5" fill="var(--comment)">× one selected skill</text>
      <text x="44" y="248" fontFamily="var(--font-mono)" fontSize="10.5" fill="var(--fg)">the SKILL.md body</text>

      {/* level 3+: resources, read or run from disk, source stays off-window */}
      <rect x="28" y="286" width="440" height="112" rx="8" fill="var(--surface)" stroke="var(--comment)" strokeOpacity="0.6" strokeDasharray="2 3" />
      <text x="44" y="310" fontFamily="var(--font-mono)" fontSize="12" fill="var(--fg)">level 3+ · resources</text>
      <text x="44" y="330" fontFamily="var(--font-mono)" fontSize="9.5" fill="var(--comment)">loaded: on demand, via agent tools</text>
      <text x="44" y="347" fontFamily="var(--font-mono)" fontSize="9.5" fill="var(--fg)">effectively unbounded</text>
      <text x="200" y="347" fontFamily="var(--font-mono)" fontSize="9.5" fill="var(--comment)">source need not enter context</text>
      <text x="44" y="368" fontFamily="var(--font-mono)" fontSize="10.5" fill="var(--fg)">bundled scripts + reference docs</text>
      <text x="44" y="386" fontFamily="var(--font-mono)" fontSize="9" fill="var(--comment)">read a doc one hop away; run a script, return its output</text>

      {/* arrows into the context window */}
      <line x1="468" y1="94" x2="606" y2="118" stroke="var(--accent)" strokeWidth="1.6" markerEnd="url(#sk10-arrow)" />
      <line x1="468" y1="214" x2="606" y2="198" stroke="var(--accent)" strokeWidth="1.4" strokeDasharray="5 4" markerEnd="url(#sk10-arrow)" />
      <line x1="468" y1="342" x2="606" y2="278" stroke="var(--comment)" strokeWidth="1.4" strokeDasharray="2 3" markerEnd="url(#sk10-arrow-dim)" />
      <text x="500" y="286" fontFamily="var(--font-mono)" fontSize="8.5" fill="var(--comment)">run output</text>

      {/* the context window: what actually lands in it */}
      <rect x="612" y="46" width="256" height="352" rx="9" fill="var(--accent)" fillOpacity="0.06" stroke="var(--accent)" strokeOpacity="0.7" />
      <text x="740" y="72" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="12" fill="var(--accent)">context window</text>
      <text x="740" y="88" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="8.5" fill="var(--comment)">what actually lands here</text>

      <rect x="632" y="104" width="216" height="52" rx="6" fill="var(--surface)" stroke="var(--accent)" strokeOpacity="0.55" />
      <text x="646" y="124" fontFamily="var(--font-mono)" fontSize="10" fill="var(--fg)">all skills&#39; metadata</text>
      <text x="646" y="140" fontFamily="var(--font-mono)" fontSize="8.5" fill="var(--comment)">always · scales with skill count</text>

      <rect x="632" y="172" width="216" height="52" rx="6" fill="var(--surface)" stroke="var(--accent)" strokeOpacity="0.3" strokeDasharray="4 3" />
      <text x="646" y="192" fontFamily="var(--font-mono)" fontSize="10" fill="var(--fg)">one skill&#39;s body</text>
      <text x="646" y="208" fontFamily="var(--font-mono)" fontSize="8.5" fill="var(--comment)">only when triggered</text>

      <rect x="632" y="240" width="216" height="52" rx="6" fill="var(--surface)" stroke="var(--comment)" strokeOpacity="0.55" strokeDasharray="2 3" />
      <text x="646" y="260" fontFamily="var(--font-mono)" fontSize="10" fill="var(--fg)">script run output</text>
      <text x="646" y="276" fontFamily="var(--font-mono)" fontSize="8.5" fill="var(--comment)">source can remain on disk</text>

      <text x="740" y="326" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="8.5" fill="var(--comment)">the rest stays on disk,</text>
      <text x="740" y="340" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="8.5" fill="var(--comment)">costing zero tokens until touched</text>

      {/* lesson band */}
      <rect x="28" y="418" width="840" height="66" rx="8" fill="var(--surface)" stroke="var(--border)" />
      <text x="44" y="442" fontFamily="var(--font-mono)" fontSize="10.5" fill="var(--accent)">
        {"// the payoff: pay for what you might need, load what you do need"}
      </text>
      <text x="44" y="462" fontFamily="var(--font-mono)" fontSize="9.5" fill="var(--fg)">
        {"startup pays only for metadata; the body loads just in time; a script can return a result without loading its source."}
      </text>
      <text x="44" y="478" fontFamily="var(--font-mono)" fontSize="9.5" fill="var(--comment)">
        {"that is why 100 installed skills cost a few kilotokens at startup, not hundreds of thousands."}
      </text>
    </svg>
  );
}
