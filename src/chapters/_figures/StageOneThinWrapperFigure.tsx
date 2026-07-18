export function StageOneThinWrapperFigure() {
  return (
    <svg
      viewBox="0 0 920 525"
      className="min-w-[720px] w-full"
      role="img"
      aria-label="A coding-agent REPL sends conversation history and tools to a model. Tool requests flow through dispatch and return as one user message. A response with no tool use ends normally only with end_turn; a truncated or unexpected stop fails loudly."
      fill="none"
    >
      <title>Stage One thin-wrapper control flow</title>
      <defs>
        <marker
          id="stage-one-thin-wrapper-arrow"
          markerWidth="8"
          markerHeight="8"
          refX="7"
          refY="3"
          orient="auto"
        >
          <path d="M0,0 L0,6 L7,3 z" fill="var(--accent)" />
        </marker>
      </defs>

      <rect x="1" y="1" width="918" height="523" rx="10" fill="var(--surface-2)" stroke="var(--border)" />
      <text x="28" y="34" fontFamily="var(--font-mono)" fontSize="12" fill="var(--comment)">
        {"// stage_one: the model plans, the wrapper carries the protocol"}
      </text>

      <rect x="28" y="70" width="150" height="84" rx="8" fill="var(--surface)" stroke="var(--border)" />
      <text x="46" y="101" fontFamily="var(--font-mono)" fontSize="13" fill="var(--accent)">
        REPL input
      </text>
      <text x="46" y="125" fontFamily="var(--font-mono)" fontSize="11" fill="var(--fg-muted)">
        user request
      </text>

      <rect x="220" y="70" width="150" height="84" rx="8" fill="var(--surface)" stroke="var(--border)" />
      <text x="238" y="101" fontFamily="var(--font-mono)" fontSize="13" fill="var(--accent)">
        messages[]
      </text>
      <text x="238" y="125" fontFamily="var(--font-mono)" fontSize="11" fill="var(--fg-muted)">
        full history
      </text>

      <rect x="414" y="55" width="206" height="114" rx="8" fill="var(--surface)" stroke="var(--accent-dim)" />
      <text x="434" y="91" fontFamily="var(--font-mono)" fontSize="13" fill="var(--accent)">
        model request
      </text>
      <text x="434" y="116" fontFamily="var(--font-mono)" fontSize="11" fill="var(--fg-muted)">
        system + schemas
      </text>
      <text x="434" y="137" fontFamily="var(--font-mono)" fontSize="11" fill="var(--fg-muted)">
        history + max tokens
      </text>

      <rect x="676" y="70" width="192" height="84" rx="8" fill="var(--surface)" stroke="var(--border)" />
      <text x="694" y="101" fontFamily="var(--font-mono)" fontSize="13" fill="var(--accent)">
        assistant blocks
      </text>
      <text x="694" y="125" fontFamily="var(--font-mono)" fontSize="11" fill="var(--fg-muted)">
        text + tool_use
      </text>

      <path d="M178 112 H220" stroke="var(--accent)" strokeWidth="1.5" markerEnd="url(#stage-one-thin-wrapper-arrow)" />
      <path d="M370 112 H414" stroke="var(--accent)" strokeWidth="1.5" markerEnd="url(#stage-one-thin-wrapper-arrow)" />
      <path d="M620 112 H676" stroke="var(--accent)" strokeWidth="1.5" markerEnd="url(#stage-one-thin-wrapper-arrow)" />

      <text x="690" y="182" fontFamily="var(--font-mono)" fontSize="10" fill="var(--comment)">
        preserve verbatim
      </text>
      <rect x="696" y="199" width="152" height="38" rx="19" fill="var(--surface)" stroke="var(--border)" />
      <text x="772" y="214" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="16" fill="var(--fg)">
        <tspan x="772" dy="0">tool_use</tspan>
        <tspan x="772" dy="17">blocks?</tspan>
      </text>
      <path d="M772 154 V199" stroke="var(--accent)" strokeWidth="1.5" markerEnd="url(#stage-one-thin-wrapper-arrow)" />

      <text x="576" y="255" fontFamily="var(--font-mono)" fontSize="16" fill="var(--fg-muted)">
        yes, one or many
      </text>
      <path d="M696 218 H584 V316 H570" stroke="var(--accent)" strokeWidth="1.5" markerEnd="url(#stage-one-thin-wrapper-arrow)" />

      <rect x="405" y="280" width="165" height="76" rx="8" fill="var(--surface)" stroke="var(--accent-dim)" />
      <text x="487" y="312" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="13" fill="var(--accent)">
        dispatch
      </text>
      <text x="487" y="334" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="10" fill="var(--fg-muted)">
        name + input
      </text>

      <rect x="105" y="280" width="240" height="76" rx="8" fill="var(--surface)" stroke="var(--border)" />
      <text x="225" y="309" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="12" fill="var(--fg)">
        workspace tools
      </text>
      <text x="225" y="333" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="10" fill="var(--fg-muted)">
        read · list · edit · bash
      </text>
      <path d="M405 318 H345" stroke="var(--accent)" strokeWidth="1.5" markerEnd="url(#stage-one-thin-wrapper-arrow)" />

      <rect x="405" y="390" width="210" height="60" rx="8" fill="var(--surface)" stroke="var(--accent-dim)" />
      <text x="510" y="417" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="12" fill="var(--accent)">
        tool_result[]
      </text>
      <text x="510" y="437" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="10" fill="var(--fg-muted)">
        one next user message
      </text>
      <path d="M225 356 V420 H405" stroke="var(--accent)" strokeWidth="1.5" markerEnd="url(#stage-one-thin-wrapper-arrow)" />
      <path d="M615 420 H646 V171 H560" stroke="var(--accent)" strokeWidth="1.5" markerEnd="url(#stage-one-thin-wrapper-arrow)" />
      <text x="627" y="397" fontFamily="var(--font-mono)" fontSize="10" fill="var(--comment)">
        loop
      </text>

      <text x="795" y="253" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="16" fill="var(--fg-muted)">
        <tspan x="795" dy="0">no tool_use</tspan>
        <tspan x="795" dy="18">+ end_turn</tspan>
      </text>
      <path d="M848 218 H886 V315 H860" stroke="var(--accent)" strokeWidth="1.5" markerEnd="url(#stage-one-thin-wrapper-arrow)" />
      <rect x="730" y="280" width="130" height="76" rx="8" fill="var(--surface)" stroke="var(--border)" />
      <text x="795" y="312" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="12" fill="var(--fg)">
        print final text
      </text>
      <text x="795" y="334" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="10" fill="var(--fg-muted)">
        return to REPL
      </text>
      <text x="795" y="375" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="16" fill="var(--fg-muted)">
        <tspan x="795" dy="0">truncation /</tspan>
        <tspan x="795" dy="18">other stop</tspan>
        <tspan x="795" dy="18">→ error, not completion</tspan>
      </text>

      <rect x="28" y="474" width="864" height="28" rx="6" fill="var(--surface)" stroke="var(--border)" />
      <text x="45" y="493" fontFamily="var(--font-mono)" fontSize="10" fill="var(--comment)">
        not yet →
      </text>
      <text x="122" y="493" fontFamily="var(--font-mono)" fontSize="10" fill="var(--fg-muted)">
        retries · streaming · context control · permissions · sandbox · memory · MCP · evaluation
      </text>
    </svg>
  );
}
