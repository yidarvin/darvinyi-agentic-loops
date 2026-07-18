const mono = "var(--font-mono)";

export function StageThreeProductionGradeFigure() {
  return (
    <svg
      viewBox="0 0 860 570"
      className="min-w-[760px]"
      role="img"
      aria-label="A production agent architecture with a Stage Two loop at the center, MCP, memory, and subagent capability branches, plus permission and sandbox boundaries around effectful execution."
      fill="none"
    >
      <defs>
        <marker id="stage-three-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
          <path d="M0,0 L8,4 L0,8 Z" fill="var(--accent)" />
        </marker>
        <marker id="stage-three-muted-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
          <path d="M0,0 L8,4 L0,8 Z" fill="var(--comment)" />
        </marker>
      </defs>

      <rect x="1" y="1" width="858" height="568" rx="10" fill="var(--surface-2)" stroke="var(--border)" />
      <text x="30" y="34" fontFamily={mono} fontSize="12" fill="var(--comment)">
        {"// stage_three: one dispatch core, bounded capability"}
      </text>

      <rect x="288" y="58" width="284" height="70" rx="8" fill="var(--surface)" stroke="var(--accent)" />
      <text x="430" y="86" textAnchor="middle" fontFamily={mono} fontSize="13" fill="var(--fg)">
        {"Stage Two robust loop"}
      </text>
      <text x="430" y="108" textAnchor="middle" fontFamily={mono} fontSize="10" fill="var(--comment)">
        {"stream · retry · validate · compact"}
      </text>

      <rect x="318" y="168" width="224" height="56" rx="8" fill="var(--accent-dim)" stroke="var(--accent)" />
      <text x="430" y="192" textAnchor="middle" fontFamily={mono} fontSize="12" fill="var(--fg)">
        {"dispatch core"}
      </text>
      <text x="430" y="210" textAnchor="middle" fontFamily={mono} fontSize="10" fill="var(--fg)">
        {"route by capability + provenance"}
      </text>

      <path d="M430 128 V168" stroke="var(--accent)" strokeWidth="1.5" markerEnd="url(#stage-three-arrow)" />
      <path d="M134 93 H288" stroke="var(--accent)" strokeWidth="1.5" markerEnd="url(#stage-three-arrow)" />
      <text x="34" y="88" fontFamily={mono} fontSize="11" fill="var(--fg)">
        {"task + project context"}
      </text>
      <text x="34" y="107" fontFamily={mono} fontSize="10" fill="var(--comment)">
        {"startup: memory + rules"}
      </text>

      <rect x="38" y="262" width="210" height="102" rx="8" fill="var(--surface)" stroke="var(--border)" />
      <text x="58" y="290" fontFamily={mono} fontSize="12" fill="var(--accent)">
        {"MCP client"}
      </text>
      <text x="58" y="312" fontFamily={mono} fontSize="10" fill="var(--fg-muted)">
        {"mcp__server__tool"}
      </text>
      <text x="58" y="332" fontFamily={mono} fontSize="10" fill="var(--comment)">
        {"hash definitions · timeout"}
      </text>
      <text x="58" y="348" fontFamily={mono} fontSize="10" fill="var(--comment)">
        {"server output is untrusted"}
      </text>
      <path d="M248 313 H318" stroke="var(--accent)" strokeWidth="1.5" markerEnd="url(#stage-three-arrow)" />
      <path d="M204 262 C236 240 286 232 344 224" stroke="var(--comment)" strokeWidth="1.25" strokeDasharray="5 4" markerEnd="url(#stage-three-muted-arrow)" />

      <rect x="612" y="262" width="210" height="102" rx="8" fill="var(--surface)" stroke="var(--border)" />
      <text x="632" y="290" fontFamily={mono} fontSize="12" fill="var(--accent)">
        {"subagent loop"}
      </text>
      <text x="632" y="312" fontFamily={mono} fontSize="10" fill="var(--fg-muted)">
        {"fresh context · read-only"}
      </text>
      <text x="632" y="332" fontFamily={mono} fontSize="10" fill="var(--comment)">
        {"MAX_DEPTH = 1"}
      </text>
      <text x="632" y="348" fontFamily={mono} fontSize="10" fill="var(--comment)">
        {"return final summary only"}
      </text>
      <path d="M542 313 H612" stroke="var(--accent)" strokeWidth="1.5" markerEnd="url(#stage-three-arrow)" />
      <path d="M612 344 C578 350 550 330 518 224" stroke="var(--comment)" strokeWidth="1.25" strokeDasharray="5 4" markerEnd="url(#stage-three-muted-arrow)" />

      <rect x="325" y="262" width="210" height="102" rx="8" fill="var(--surface)" stroke="var(--border)" />
      <text x="345" y="290" fontFamily={mono} fontSize="12" fill="var(--accent)">
        {"durable memory"}
      </text>
      <text x="345" y="312" fontFamily={mono} fontSize="10" fill="var(--fg-muted)">
        {"project context + progress"}
      </text>
      <text x="345" y="332" fontFamily={mono} fontSize="10" fill="var(--comment)">
        {"resolve path under root"}
      </text>
      <text x="345" y="348" fontFamily={mono} fontSize="10" fill="var(--comment)">
        {"prune and inspect writes"}
      </text>
      <path d="M430 224 V262" stroke="var(--accent)" strokeWidth="1.5" markerEnd="url(#stage-three-arrow)" />

      <rect x="66" y="406" width="728" height="58" rx="8" fill="var(--surface)" stroke="var(--accent)" />
      <text x="94" y="430" fontFamily={mono} fontSize="12" fill="var(--accent)">
        {"permission policy"}
      </text>
      <text x="94" y="449" fontFamily={mono} fontSize="10" fill="var(--fg-muted)">
        {"deny  →  ask  →  allow     // should this run?"}
      </text>
      <text x="534" y="439" fontFamily={mono} fontSize="10" fill="var(--comment)">
        {"secrets · destructive ops · irreversible egress"}
      </text>

      <rect x="66" y="486" width="728" height="54" rx="8" fill="var(--surface)" stroke="var(--accent-dim)" strokeWidth="2" />
      <text x="94" y="509" fontFamily={mono} fontSize="12" fill="var(--accent)">
        {"kernel sandbox"}
      </text>
      <text x="94" y="527" fontFamily={mono} fontSize="10" fill="var(--fg-muted)">
        {"workspace-scoped writes + constrained egress     // if it runs, what can it touch?"}
      </text>

      <path d="M143 364 V406" stroke="var(--accent)" strokeWidth="1.5" markerEnd="url(#stage-three-arrow)" />
      <path d="M430 364 V406" stroke="var(--accent)" strokeWidth="1.5" markerEnd="url(#stage-three-arrow)" />
      <path d="M717 364 V406" stroke="var(--accent)" strokeWidth="1.5" markerEnd="url(#stage-three-arrow)" />
      <path d="M430 464 V486" stroke="var(--accent)" strokeWidth="1.5" markerEnd="url(#stage-three-arrow)" />
    </svg>
  );
}
