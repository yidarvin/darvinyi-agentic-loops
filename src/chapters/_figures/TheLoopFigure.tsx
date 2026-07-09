// TheLoopFigure: the figure for "The Loop".
// The agentic primitive as a four-phase cycle: perceive -> decide -> act -> observe.
// Structure it encodes: the message list sits at the center as the agent's working
// memory, the model is called exactly once per turn (in decide), and the harness owns
// the arrows, including the stop check on the return path. Inline SVG, themed with the
// CSS variables, ASCII labels so it stays crisp and prose-lint clean.
export function TheLoopFigure() {
  return (
    <svg
      viewBox="0 0 680 460"
      className="w-full min-w-[520px]"
      role="img"
      aria-label="A clockwise cycle of four phases: perceive assembles context, decide runs one model forward pass, act runs the tool, observe appends the result. The message list sits at the center as working memory. The harness owns the loop and checks stop_reason right after decide, halting on end_turn before act ever runs."
      fill="none"
    >
      <rect x="1" y="1" width="678" height="458" rx="10" fill="var(--surface-2)" stroke="var(--border)" />

      <text x="22" y="30" fontFamily="var(--font-mono)" fontSize="11" fill="var(--comment)">
        {"// perceive -> decide -> act -> observe"}
      </text>

      <defs>
        <marker
          id="loop-arrow"
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="7"
          markerHeight="7"
          orient="auto"
        >
          <path d="M0 0 L10 5 L0 10 z" fill="var(--accent)" />
        </marker>
      </defs>

      {/* the four clockwise arrows: the harness owns these */}
      <path d="M 416 70 Q 545 95 556 198" stroke="var(--accent)" strokeWidth="2" markerEnd="url(#loop-arrow)" />
      <path d="M 560 260 Q 548 372 418 390" stroke="var(--accent)" strokeWidth="2" markerEnd="url(#loop-arrow)" />
      <path d="M 264 390 Q 108 372 114 262" stroke="var(--accent)" strokeWidth="2" markerEnd="url(#loop-arrow)" />
      <path d="M 114 198 Q 108 95 264 70" stroke="var(--accent)" strokeWidth="2" markerEnd="url(#loop-arrow)" />

      {/* stop check right after decide: end_turn exits before act ever runs */}
      <text x="486" y="322" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="10" fill="var(--accent-dim)">
        {"stop?"}
      </text>
      <text x="486" y="336" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="9" fill="var(--comment)">
        {"end_turn exits"}
      </text>

      {/* center: the message list is the working memory */}
      <rect x="276" y="200" width="128" height="60" rx="8" fill="var(--surface)" stroke="var(--accent)" strokeOpacity="0.4" />
      <text x="340" y="226" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="12" fill="var(--accent)">
        message list
      </text>
      <text x="340" y="243" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="9" fill="var(--comment)">
        working memory
      </text>
      <text x="340" y="290" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="9" fill="var(--accent-dim)">
        grows on decide + observe
      </text>

      {/* PERCEIVE (top) */}
      <rect x="265" y="40" width="150" height="56" rx="8" fill="var(--surface)" stroke="var(--border)" />
      <text x="340" y="66" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="13" fontWeight="600" fill="var(--fg)">
        PERCEIVE
      </text>
      <text x="340" y="84" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="10" fill="var(--comment)">
        assemble context
      </text>

      {/* DECIDE (right) */}
      <rect x="490" y="202" width="150" height="56" rx="8" fill="var(--surface)" stroke="var(--border)" />
      <text x="565" y="228" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="13" fontWeight="600" fill="var(--fg)">
        DECIDE
      </text>
      <text x="565" y="246" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="10" fill="var(--comment)">
        one model forward pass
      </text>
      <text x="565" y="284" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="9" fill="var(--accent-dim)">
        the only model call
      </text>

      {/* ACT (bottom) */}
      <rect x="265" y="364" width="150" height="56" rx="8" fill="var(--surface)" stroke="var(--border)" />
      <text x="340" y="390" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="13" fontWeight="600" fill="var(--fg)">
        ACT
      </text>
      <text x="340" y="408" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="10" fill="var(--comment)">
        harness runs the tool
      </text>

      {/* OBSERVE (left) */}
      <rect x="40" y="202" width="150" height="56" rx="8" fill="var(--surface)" stroke="var(--border)" />
      <text x="115" y="228" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="13" fontWeight="600" fill="var(--fg)">
        OBSERVE
      </text>
      <text x="115" y="246" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="10" fill="var(--comment)">
        append tool_result
      </text>
    </svg>
  );
}
