const mono = "var(--font-mono)";

export function StageThreeProductionGradeFigure() {
  return (
    <svg
      viewBox="0 0 920 650"
      className="min-w-[820px]"
      role="img"
      aria-label="A production agent architecture with a central dispatch core and separate MCP, durable-memory, and subagent seams. Policy and kernel containment apply to launched MCP and verification processes, while host-owned memory and read-only subagent I/O use separate descriptor-contained paths."
      fill="none"
    >
      <defs>
        <marker id="stage-three-call-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
          <path d="M0,0 L8,4 L0,8 Z" fill="var(--accent)" />
        </marker>
        <marker id="stage-three-return-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
          <path d="M0,0 L8,4 L0,8 Z" fill="var(--comment)" />
        </marker>
      </defs>

      <rect x="1" y="1" width="918" height="648" rx="10" fill="var(--surface-2)" stroke="var(--border)" />
      <text x="30" y="34" fontFamily={mono} fontSize="12" fill="var(--comment)">
        {"// stage_three: one dispatch core, separate capability seams"}
      </text>

      <rect x="318" y="58" width="284" height="70" rx="8" fill="var(--surface)" stroke="var(--accent)" />
      <text x="460" y="86" textAnchor="middle" fontFamily={mono} fontSize="13" fill="var(--fg)">
        {"Stage Two robust loop"}
      </text>
      <text x="460" y="108" textAnchor="middle" fontFamily={mono} fontSize="10" fill="var(--comment)">
        {"stream · retry · validate · compact"}
      </text>

      <rect x="348" y="158" width="224" height="56" rx="8" fill="var(--accent-dim)" stroke="var(--accent)" />
      <text x="460" y="182" textAnchor="middle" fontFamily={mono} fontSize="12" fill="var(--fg)">
        {"dispatch core"}
      </text>
      <text x="460" y="200" textAnchor="middle" fontFamily={mono} fontSize="10" fill="var(--fg)">
        {"route by capability + provenance"}
      </text>

      <path d="M460 128 V158" stroke="var(--accent)" strokeWidth="1.5" markerEnd="url(#stage-three-call-arrow)" />
      <path d="M160 93 H318" stroke="var(--accent)" strokeWidth="1.5" markerEnd="url(#stage-three-call-arrow)" />
      <text x="34" y="88" fontFamily={mono} fontSize="11" fill="var(--fg)">
        {"task + project context"}
      </text>
      <text x="34" y="107" fontFamily={mono} fontSize="10" fill="var(--comment)">
        {"startup: rules + selected memory"}
      </text>

      <rect x="34" y="270" width="250" height="108" rx="8" fill="var(--surface)" stroke="var(--border)" />
      <text x="54" y="298" fontFamily={mono} fontSize="12" fill="var(--accent)">
        {"MCP client"}
      </text>
      <text x="54" y="320" fontFamily={mono} fontSize="10" fill="var(--fg-muted)">
        {"mcp__server__tool"}
      </text>
      <text x="54" y="340" fontFamily={mono} fontSize="10" fill="var(--comment)">
        {"hash definitions · bounded frames"}
      </text>
      <text x="54" y="358" fontFamily={mono} fontSize="10" fill="var(--comment)">
        {"server text is untrusted"}
      </text>

      <rect x="335" y="270" width="250" height="108" rx="8" fill="var(--surface)" stroke="var(--border)" />
      <text x="355" y="298" fontFamily={mono} fontSize="12" fill="var(--accent)">
        {"durable memory"}
      </text>
      <text x="355" y="320" fontFamily={mono} fontSize="10" fill="var(--fg-muted)">
        {"project context + progress"}
      </text>
      <text x="355" y="340" fontFamily={mono} fontSize="10" fill="var(--comment)">
        {"host-owned startup load"}
      </text>
      <text x="355" y="358" fontFamily={mono} fontSize="10" fill="var(--comment)">
        {"descriptor-contained I/O"}
      </text>

      <rect x="636" y="270" width="250" height="108" rx="8" fill="var(--surface)" stroke="var(--border)" />
      <text x="656" y="298" fontFamily={mono} fontSize="12" fill="var(--accent)">
        {"subagent loop"}
      </text>
      <text x="656" y="320" fontFamily={mono} fontSize="10" fill="var(--fg-muted)">
        {"fresh context · read-only"}
      </text>
      <text x="656" y="340" fontFamily={mono} fontSize="10" fill="var(--comment)">
        {"MAX_DEPTH = 1"}
      </text>
      <text x="656" y="358" fontFamily={mono} fontSize="10" fill="var(--comment)">
        {"return final summary only"}
      </text>

      <path
        d="M378 214 C330 234 250 248 159 270"
        stroke="var(--accent)"
        strokeWidth="1.5"
        markerEnd="url(#stage-three-call-arrow)"
      />
      <path
        d="M225 378 C292 363 344 302 410 214"
        stroke="var(--comment)"
        strokeWidth="1.25"
        strokeDasharray="5 4"
        markerEnd="url(#stage-three-return-arrow)"
      />

      <path
        d="M438 214 C422 233 422 249 431 270"
        stroke="var(--accent)"
        strokeWidth="1.5"
        markerEnd="url(#stage-three-call-arrow)"
      />
      <path
        d="M500 378 C514 333 507 271 482 214"
        stroke="var(--comment)"
        strokeWidth="1.25"
        strokeDasharray="5 4"
        markerEnd="url(#stage-three-return-arrow)"
      />

      <path
        d="M542 214 C592 234 670 248 761 270"
        stroke="var(--accent)"
        strokeWidth="1.5"
        markerEnd="url(#stage-three-call-arrow)"
      />
      <path
        d="M695 378 C628 363 576 302 510 214"
        stroke="var(--comment)"
        strokeWidth="1.25"
        strokeDasharray="5 4"
        markerEnd="url(#stage-three-return-arrow)"
      />

      <path d="M42 421 H78" stroke="var(--accent)" strokeWidth="1.5" markerEnd="url(#stage-three-call-arrow)" />
      <text x="90" y="425" fontFamily={mono} fontSize="10" fill="var(--fg-muted)">
        {"call / lifecycle action"}
      </text>
      <path
        d="M260 421 H296"
        stroke="var(--comment)"
        strokeWidth="1.25"
        strokeDasharray="5 4"
        markerEnd="url(#stage-three-return-arrow)"
      />
      <text x="308" y="425" fontFamily={mono} fontSize="10" fill="var(--fg-muted)">
        {"result / startup input"}
      </text>

      <rect x="42" y="465" width="370" height="58" rx="8" fill="var(--surface)" stroke="var(--accent)" />
      <text x="66" y="489" fontFamily={mono} fontSize="12" fill="var(--accent)">
        {"permission policy"}
      </text>
      <text x="66" y="508" fontFamily={mono} fontSize="10" fill="var(--fg-muted)">
        {"MCP launch + verification process  // should it start?"}
      </text>

      <rect x="42" y="546" width="370" height="60" rx="8" fill="var(--surface)" stroke="var(--accent-dim)" strokeWidth="2" />
      <text x="66" y="570" fontFamily={mono} fontSize="12" fill="var(--accent)">
        {"kernel sandbox"}
      </text>
      <text x="66" y="589" fontFamily={mono} fontSize="10" fill="var(--fg-muted)">
        {"launched MCP + verification children  // what can they touch?"}
      </text>

      <rect x="456" y="465" width="422" height="141" rx="8" fill="var(--surface)" stroke="var(--border)" />
      <text x="480" y="489" fontFamily={mono} fontSize="12" fill="var(--accent)">
        {"host-owned boundaries"}
      </text>
      <text x="480" y="511" fontFamily={mono} fontSize="10" fill="var(--fg-muted)">
        {"memory: descriptor-relative, no-follow reads + writes"}
      </text>
      <text x="480" y="531" fontFamily={mono} fontSize="10" fill="var(--fg-muted)">
        {"worker: fixed files, read-only, bounded summary"}
      </text>
      <text x="480" y="567" fontFamily={mono} fontSize="10" fill="var(--comment)">
        {"not policy-gated or Seatbelt-contained in this probe"}
      </text>
      <text x="480" y="587" fontFamily={mono} fontSize="10" fill="var(--comment)">
        {"contain those paths separately before extending the harness"}
      </text>

      <path d="M159 378 V465" stroke="var(--accent)" strokeWidth="1.5" markerEnd="url(#stage-three-call-arrow)" />
      <path d="M227 523 V546" stroke="var(--accent)" strokeWidth="1.5" markerEnd="url(#stage-three-call-arrow)" />
      <path d="M460 378 V465" stroke="var(--comment)" strokeWidth="1.25" strokeDasharray="5 4" />
      <path d="M761 378 V465" stroke="var(--comment)" strokeWidth="1.25" strokeDasharray="5 4" />
    </svg>
  );
}
