// SkillsFigure: the figure for "Skills".
// The structure it encodes: progressive disclosure as a three-level loading ladder.
// Listed, model-invocable skills contribute metadata at startup. In a regular Claude Code
// session, a first, distinct, or changed rendered activation can contribute its body; an
// identical re-invocation adds a short already-loaded note. A configured preloaded subagent
// receives named full skill content at startup instead. Distinct skill bodies can stack. At
// level 3, read reference text enters context; executed script output enters context while
// unread resources and uninspected script source remain on disk. A user-only skill is absent
// from regular-session startup context until manual invocation.

export function SkillsFigure() {
  return (
    <svg
      viewBox="0 0 900 570"
      className="w-full min-w-[860px]"
      role="img"
      aria-label="Progressive disclosure drawn as a three-level loading ladder feeding a context window in an Agent Skills-style harness. Metadata for listed model-invocable skills loads at startup; user-only skills do not. In a regular Claude Code session, a first, distinct, or changed rendered SKILL.md body enters context, while an identical re-invocation adds a short already-loaded note. A configured subagent with preloaded skills receives its named full skill content at startup instead. Distinct skill bodies can stack. A reference file enters context when read. A script can execute and return output without loading its source."
      fill="none"
    >
      <rect x="1" y="1" width="898" height="568" rx="10" fill="var(--surface-2)" stroke="var(--border)" />

      <defs>
        <marker id="sk10-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto">
          <path d="M0 0 L10 5 L0 10 z" fill="var(--accent)" />
        </marker>
        <marker id="sk10-arrow-dim" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto">
          <path d="M0 0 L10 5 L0 10 z" fill="var(--comment)" />
        </marker>
      </defs>

      <text x="22" y="20" fontFamily="var(--font-mono)" fontSize="11" fill="var(--comment)">
        {"// progressive disclosure: regular session plus preloaded-subagent exception"}
      </text>

      {/* level 1: metadata, listed/model-invocable only */}
      <rect x="28" y="46" width="440" height="100" rx="8" fill="var(--surface)" stroke="var(--accent)" strokeOpacity="0.6" />
      <text x="44" y="70" fontFamily="var(--font-mono)" fontSize="12" fill="var(--accent)">level 1 · metadata</text>
      <text x="44" y="91" fontFamily="var(--font-mono)" fontSize="10" fill="var(--fg-muted)">loaded: startup, for listed model-invocable skills</text>
      <text x="44" y="110" fontFamily="var(--font-mono)" fontSize="10" fill="var(--fg)">Firecrawl: ~30 to 50 tokens / listed skill</text>
      <text x="44" y="131" fontFamily="var(--font-mono)" fontSize="10" fill="var(--fg-muted)">Anthropic rule of thumb: ~100 tokens / listed skill</text>

      {/* level 2: all activated bodies, not one selected body */}
      <rect x="28" y="166" width="440" height="100" rx="8" fill="var(--surface)" stroke="var(--accent)" strokeOpacity="0.35" strokeDasharray="5 4" />
      <text x="44" y="190" fontFamily="var(--font-mono)" fontSize="12" fill="var(--fg)">level 2 · instructions</text>
      <text x="44" y="211" fontFamily="var(--font-mono)" fontSize="10" fill="var(--fg-muted)">regular session: first, distinct, or changed rendering</text>
      <text x="44" y="230" fontFamily="var(--font-mono)" fontSize="10" fill="var(--fg)">full body: &lt; 5k tokens recommended</text>
      <text x="44" y="251" fontFamily="var(--font-mono)" fontSize="10" fill="var(--fg-muted)">regular: distinct bodies stack; identical re-invocation: short note</text>

      {/* level 3+: read and execute are intentionally separate paths */}
      <rect x="28" y="286" width="440" height="132" rx="8" fill="var(--surface)" stroke="var(--comment)" strokeOpacity="0.6" strokeDasharray="2 3" />
      <text x="44" y="310" fontFamily="var(--font-mono)" fontSize="12" fill="var(--fg)">level 3+ · resources</text>
      <text x="44" y="331" fontFamily="var(--font-mono)" fontSize="10" fill="var(--fg-muted)">loaded: on demand, via agent tools</text>
      <text x="44" y="350" fontFamily="var(--font-mono)" fontSize="10" fill="var(--fg)">reference read → its text enters context</text>
      <text x="44" y="370" fontFamily="var(--font-mono)" fontSize="10" fill="var(--fg)">script run → output enters; source can remain on disk</text>
      <text x="44" y="396" fontFamily="var(--font-mono)" fontSize="10" fill="var(--fg-muted)">unread resources and uninspected script source cost zero tokens</text>

      {/* arrows into the context window */}
      <line x1="468" y1="96" x2="606" y2="123" stroke="var(--accent)" strokeWidth="1.6" markerEnd="url(#sk10-arrow)" />
      <line x1="468" y1="215" x2="606" y2="189" stroke="var(--accent)" strokeWidth="1.4" strokeDasharray="5 4" markerEnd="url(#sk10-arrow)" />
      <line x1="468" y1="345" x2="606" y2="255" stroke="var(--comment)" strokeWidth="1.4" strokeDasharray="2 3" markerEnd="url(#sk10-arrow-dim)" />
      <line x1="468" y1="371" x2="606" y2="321" stroke="var(--comment)" strokeWidth="1.4" strokeDasharray="2 3" markerEnd="url(#sk10-arrow-dim)" />
      <text x="505" y="280" fontFamily="var(--font-mono)" fontSize="10" fill="var(--fg-muted)">reference read</text>
      <text x="510" y="338" fontFamily="var(--font-mono)" fontSize="10" fill="var(--fg-muted)">script output</text>

      {/* the context window: every route that actually lands in it */}
      <rect x="612" y="46" width="256" height="372" rx="9" fill="var(--accent)" fillOpacity="0.06" stroke="var(--accent)" strokeOpacity="0.7" />
      <text x="740" y="72" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="12" fill="var(--accent)">context window</text>
      <text x="740" y="90" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="10" fill="var(--fg-muted)">what actually lands here</text>

      <rect x="632" y="106" width="216" height="48" rx="6" fill="var(--surface)" stroke="var(--accent)" strokeOpacity="0.55" />
      <text x="646" y="126" fontFamily="var(--font-mono)" fontSize="10" fill="var(--fg)">listed skills&#39; metadata</text>
      <text x="646" y="142" fontFamily="var(--font-mono)" fontSize="10" fill="var(--fg-muted)">startup · model-invocable only</text>

      <rect x="632" y="170" width="216" height="48" rx="6" fill="var(--surface)" stroke="var(--accent)" strokeOpacity="0.3" strokeDasharray="4 3" />
      <text x="646" y="190" fontFamily="var(--font-mono)" fontSize="10" fill="var(--fg)">regular: first / distinct / changed</text>
      <text x="646" y="206" fontFamily="var(--font-mono)" fontSize="10" fill="var(--fg-muted)">identical re-invocation: short note</text>

      <rect x="632" y="234" width="216" height="48" rx="6" fill="var(--surface)" stroke="var(--comment)" strokeOpacity="0.55" strokeDasharray="2 3" />
      <text x="646" y="254" fontFamily="var(--font-mono)" fontSize="10" fill="var(--fg)">reference text read</text>
      <text x="646" y="270" fontFamily="var(--font-mono)" fontSize="10" fill="var(--fg-muted)">only after the agent reads it</text>

      <rect x="632" y="298" width="216" height="48" rx="6" fill="var(--surface)" stroke="var(--comment)" strokeOpacity="0.55" strokeDasharray="2 3" />
      <text x="646" y="318" fontFamily="var(--font-mono)" fontSize="10" fill="var(--fg)">script execution output</text>
      <text x="646" y="334" fontFamily="var(--font-mono)" fontSize="10" fill="var(--fg-muted)">source stays available on disk</text>

      <text x="740" y="368" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="10" fill="var(--fg)">preloaded subagent</text>
      <text x="740" y="384" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="10" fill="var(--fg)">named full body at startup</text>
      <text x="740" y="402" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="10" fill="var(--fg-muted)">regular user-only: zero at startup</text>

      {/* lesson band */}
      <rect x="28" y="438" width="840" height="112" rx="8" fill="var(--surface)" stroke="var(--border)" />
      <text x="44" y="462" fontFamily="var(--font-mono)" fontSize="10.5" fill="var(--accent)">
        {"// the payoff: list what might help; load only what the task actually uses"}
      </text>
      <text x="44" y="485" fontFamily="var(--font-mono)" fontSize="10" fill="var(--fg)">
        {"regular startup pays for listed metadata; preloaded subagents choose named bodies up front."}
      </text>
      <text x="44" y="506" fontFamily="var(--font-mono)" fontSize="10" fill="var(--fg)">
        {"unread files and uninspected script source remain off-window in either session shape."}
      </text>
      <text x="44" y="530" fontFamily="var(--font-mono)" fontSize="10" fill="var(--fg-muted)">
        {"100 listed skills: Firecrawl ~3 to 5k; Anthropic rule of thumb ~10k at startup."}
      </text>
    </svg>
  );
}
