// TheLandscapeFigure: the figure for "The Landscape".
// The structure it encodes is the chapter's central claim, in two panels. Left, the
// "small loop, large harness" split: the AI decision logic is a hairline (~1.6%) atop
// a large operational harness (~98.4%), so the interesting design lives in the harness,
// not the model call. Right, "convergent core, divergent surface": every tool shares
// the same substrate (the loop, the file/shell tools, subagents, plan mode, memory
// files, MCP, sandbox primitives) and genuinely diverges on only a short list of bets
// (execution locus, model coupling, trust boundary, session persistence, autonomy), the
// highest-blast-radius axes the widget plots; the widget adds two lower-stakes ones
// (extensibility, interface). Inline SVG, themed with the CSS variables, ASCII labels so
// it stays crisp and prose-lint clean.
export function TheLandscapeFigure() {
  const axes = [
    "execution locus",
    "model coupling",
    "trust boundary",
    "session persistence",
    "default autonomy",
  ];

  return (
    <svg
      viewBox="0 0 820 470"
      className="w-full min-w-[700px]"
      role="img"
      aria-label="Two panels. Left, a single tall bar labelled small loop, large harness: a hairline accent sliver at the very top is annotated as roughly 1.6% AI decision logic, the model-in-a-loop, and the entire block beneath it is roughly 98.4% operational harness holding permissions, tools, context, state, and the sandbox, with the note that the interesting design lives in that 98.4%. Right, a large box labelled shared substrate lists what every tool has in common: the loop that calls the model, runs tools, and feeds results back; read, write, glob, grep, and bash; subagents with isolated context; a plan or read-only mode; memory files such as CLAUDE.md and AGENTS.md; MCP for external tools; and sandbox primitives. An arrow labelled only points from that shared box to a narrow column, where they diverge, listing the five axes that actually differ between tools: execution locus, model coupling, trust boundary, session persistence, and default autonomy. A closing line reads: the tools converge on a shared loop and diverge on a short list of bets."
      fill="none"
    >
      <rect x="1" y="1" width="818" height="468" rx="10" fill="var(--surface-2)" stroke="var(--border)" />
      <line x1="400" y1="30" x2="400" y2="410" stroke="var(--border)" strokeWidth="1" strokeDasharray="4 4" />

      {/* ============ LEFT: small loop, large harness ============ */}
      <text x="24" y="28" fontFamily="var(--font-mono)" fontSize="11" fill="var(--comment)">
        {"// small loop, large harness"}
      </text>

      {/* the split bar, roughly to scale: the loop is a hairline, the harness is the rest */}
      <rect x="96" y="76" width="104" height="334" fill="var(--surface)" stroke="var(--border)" />
      {/* ~1.6% AI decision logic: a genuine hairline at the top */}
      <rect x="96" y="70" width="104" height="6" fill="var(--accent)" />
      {/* leader from the hairline out to its label */}
      <line x1="200" y1="73" x2="246" y2="73" stroke="var(--accent)" strokeWidth="1" strokeDasharray="3 2" />
      <text x="250" y="70" fontFamily="var(--font-mono)" fontSize="10" fill="var(--accent)">
        ~1.6% AI logic
      </text>
      <text x="250" y="83" fontFamily="var(--font-mono)" fontSize="8.5" fill="var(--comment)">
        the model-in-a-loop
      </text>

      {/* the harness block label */}
      <text x="148" y="228" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="21" fill="var(--fg)">
        ~98.4%
      </text>
      <text x="148" y="248" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="11" fill="var(--fg)">
        operational harness
      </text>
      <text x="148" y="284" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="8.5" fill="var(--comment)">
        permissions
      </text>
      <text x="148" y="298" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="8.5" fill="var(--comment)">
        tools · context · state
      </text>
      <text x="148" y="312" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="8.5" fill="var(--comment)">
        sandbox
      </text>

      <text x="96" y="432" fontFamily="var(--font-mono)" fontSize="9" fill="var(--comment)">
        the interesting design lives in the 98.4%
      </text>

      {/* ============ RIGHT: convergent core, divergent surface ============ */}
      <text x="414" y="28" fontFamily="var(--font-mono)" fontSize="11" fill="var(--comment)">
        {"// convergent core, divergent surface"}
      </text>

      {/* the shared substrate box */}
      <rect x="414" y="52" width="228" height="322" rx="8" fill="var(--surface)" stroke="var(--accent)" strokeOpacity="0.45" />
      <text x="428" y="76" fontFamily="var(--font-mono)" fontSize="11" fill="var(--accent)">
        shared substrate
      </text>
      {[
        "the loop: call -> tools -> feed back",
        "read · write · glob · grep · bash",
        "subagents (isolated context)",
        "plan / read-only mode",
        "memory: CLAUDE.md · AGENTS.md",
        "MCP (external tools)",
        "sandbox primitives",
      ].map((row, i) => (
        <text
          key={row}
          x="428"
          y={104 + i * 26}
          fontFamily="var(--font-mono)"
          fontSize="9"
          fill="var(--fg)"
          fillOpacity="0.9"
        >
          {row}
        </text>
      ))}
      <line x1="414" y1="300" x2="642" y2="300" stroke="var(--border)" strokeWidth="1" />
      <text x="428" y="320" fontFamily="var(--font-mono)" fontSize="9" fill="var(--comment)">
        {"~ identical in every tool"}
      </text>

      {/* arrow: only this short list actually diverges */}
      <text x="652" y="200" fontFamily="var(--font-mono)" fontSize="8.5" fill="var(--comment)">
        only
      </text>
      <line x1="644" y1="212" x2="668" y2="212" stroke="var(--accent)" strokeWidth="1.5" />
      <path d="M 668 212 l -6 -3 l 0 6 z" fill="var(--accent)" />

      {/* the divergence column: the axes the widget uses */}
      <text x="672" y="76" fontFamily="var(--font-mono)" fontSize="10.5" fill="var(--danger)">
        where they diverge
      </text>
      {axes.map((label, i) => {
        const y = 92 + i * 40;
        return (
          <g key={label}>
            <rect x="672" y={y} width="132" height="30" rx="5" fill="var(--surface-2)" stroke="var(--border)" />
            <text
              x="738"
              y={y + 19}
              textAnchor="middle"
              fontFamily="var(--font-mono)"
              fontSize="9.5"
              fill="var(--fg)"
              fillOpacity="0.9"
            >
              {label}
            </text>
          </g>
        );
      })}
      <text x="672" y="320" fontFamily="var(--font-mono)" fontSize="8.5" fill="var(--comment)">
        the widget's core axes
      </text>

      {/* closing line: the thesis in one sentence */}
      <text x="24" y="458" fontFamily="var(--font-mono)" fontSize="11" fill="var(--accent)">
        {"// the tools converge on a shared loop and diverge on a short list of bets"}
      </text>
    </svg>
  );
}
