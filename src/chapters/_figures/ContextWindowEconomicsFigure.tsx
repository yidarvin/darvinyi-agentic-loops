// ContextWindowEconomicsFigure: the figure for "Context-Window Economics".
// The structure it encodes: two truths about the budget, side by side. Left, the
// window at one turn is a single stacked budget: a fixed prefix (tools + system) at
// the bottom, a monotonically growing body (history + tool results) above it, a
// reserved output buffer, and a free band that shrinks toward the ~40% working-context
// ceiling. Right, the same stack is re-sent on every turn, so the per-turn input grows
// linearly and the cumulative billed input is the area of the triangle, N(N+1)/2
// increments, which is why session cost is quadratic. Inline SVG, themed with the CSS
// variables, ASCII labels so it stays crisp and prose-lint clean.
export function ContextWindowEconomicsFigure() {
  // right panel: six turns, per-turn stack height grows by a fixed step. Tops of the
  // bars trace the linear per-turn growth; the shaded area under them is cumulative.
  const bars = [0, 1, 2, 3, 4, 5].map((i) => {
    const x = 470 + i * 48;
    const h = 34 + i * 28; // per-turn re-sent size grows by a fixed increment
    return { x, w: 30, top: 392 - h, turn: i + 1 };
  });
  const last = bars[bars.length - 1];
  const envelope =
    `M ${bars[0].x} 392 ` +
    bars.map((b) => `L ${b.x} ${b.top}`).join(" ") +
    ` L ${last.x + last.w} ${last.top} L ${last.x + last.w} 392 Z`;

  return (
    <svg
      viewBox="0 0 800 470"
      className="w-full min-w-[680px]"
      role="img"
      aria-label="Two panels. Left, one turn's context window drawn as a single vertical stacked budget: a fixed prefix of tool definitions and the system prompt at the bottom, a growing block of message history and tool results above it that already crosses the dashed forty-percent working-context ceiling, a reserved output buffer near the top, and a shrinking free band. Right, the same stack re-sent across six turns: each turn's bar is taller than the last because the whole history is re-sent, so per-turn input grows linearly and the shaded triangle under the bar tops is the cumulative billed input, N times N plus one over two increments, which makes total session cost grow with the square of the turn count."
      fill="none"
    >
      <rect x="1" y="1" width="798" height="468" rx="10" fill="var(--surface-2)" stroke="var(--border)" />

      {/* divider between the two panels */}
      <line x1="400" y1="30" x2="400" y2="440" stroke="var(--border)" strokeWidth="1" strokeDasharray="4 4" />

      {/* ============ LEFT: one turn's window, decomposed ============ */}
      <text x="24" y="30" fontFamily="var(--font-mono)" fontSize="11" fill="var(--comment)">
        {"// one turn: what fills the window"}
      </text>

      {/* the window bar, bottom-up: tools, system, growing body, output buffer, free */}
      {/* tool defs (fixed) */}
      <rect x="150" y="360" width="96" height="50" fill="var(--accent-dim)" fillOpacity="0.55" stroke="var(--border)" />
      <text x="252" y="389" fontFamily="var(--font-mono)" fontSize="10" fill="var(--fg)">tool defs</text>
      <text x="252" y="402" fontFamily="var(--font-mono)" fontSize="8.5" fill="var(--comment)">fixed</text>

      {/* system (fixed, thin) */}
      <rect x="150" y="336" width="96" height="24" fill="var(--accent-dim)" fillOpacity="0.35" stroke="var(--border)" />
      <text x="252" y="352" fontFamily="var(--font-mono)" fontSize="10" fill="var(--fg)">system</text>

      {/* history + tool results (growing) */}
      <rect x="150" y="188" width="96" height="148" fill="var(--accent)" fillOpacity="0.28" stroke="var(--accent)" strokeOpacity="0.5" />
      <text x="252" y="252" fontFamily="var(--font-mono)" fontSize="10" fill="var(--fg)">history +</text>
      <text x="252" y="266" fontFamily="var(--font-mono)" fontSize="10" fill="var(--fg)">tool_results</text>
      <text x="252" y="281" fontFamily="var(--font-mono)" fontSize="8.5" fill="var(--accent)">grows every turn</text>

      {/* reserved output buffer */}
      <rect x="150" y="156" width="96" height="32" fill="var(--surface)" stroke="var(--border)" strokeDasharray="3 3" />
      <text x="252" y="176" fontFamily="var(--font-mono)" fontSize="10" fill="var(--comment)">output buffer</text>

      {/* free space (shrinking), top of the bar */}
      <rect x="150" y="70" width="96" height="86" fill="var(--surface)" stroke="var(--border)" />
      <text x="252" y="110" fontFamily="var(--font-mono)" fontSize="10" fill="var(--comment)">free</text>
      <text x="252" y="123" fontFamily="var(--font-mono)" fontSize="8.5" fill="var(--comment)">shrinking</text>

      {/* window bracket label */}
      <text x="140" y="66" textAnchor="end" fontFamily="var(--font-mono)" fontSize="9" fill="var(--comment)">context</text>
      <text x="140" y="78" textAnchor="end" fontFamily="var(--font-mono)" fontSize="9" fill="var(--comment)">window</text>

      {/* ~40% working-context ceiling: 40% up from the bottom of the 340px bar (y=410 -> y=70) */}
      <line x1="132" y1="274" x2="246" y2="274" stroke="var(--danger)" strokeWidth="1.5" strokeDasharray="5 3" />
      <text x="128" y="271" textAnchor="end" fontFamily="var(--font-mono)" fontSize="8.5" fill="var(--danger)">~40% ceiling</text>
      <text x="128" y="283" textAnchor="end" fontFamily="var(--font-mono)" fontSize="8" fill="var(--comment)">quality erodes</text>

      {/* ============ RIGHT: the re-send makes it quadratic ============ */}
      <text x="424" y="30" fontFamily="var(--font-mono)" fontSize="11" fill="var(--comment)">
        {"// every turn re-sends the whole stack"}
      </text>

      {/* baseline */}
      <line x1="455" y1="392" x2="748" y2="392" stroke="var(--border)" strokeWidth="1" />

      {/* cumulative area under the per-turn tops: the triangle you are billed for */}
      <path d={envelope} fill="var(--accent)" fillOpacity="0.09" />

      {/* the per-turn bars, each taller than the last */}
      {bars.map((b) => (
        <g key={b.turn}>
          <rect
            x={b.x}
            y={b.top}
            width={b.w}
            height={392 - b.top}
            fill="var(--accent)"
            fillOpacity="0.25"
            stroke="var(--accent)"
            strokeOpacity="0.45"
          />
          <text x={b.x + b.w / 2} y="405" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="8.5" fill="var(--comment)">
            t{b.turn}
          </text>
        </g>
      ))}

      {/* the linear envelope of per-turn size */}
      <line
        x1={bars[0].x}
        y1={bars[0].top}
        x2={last.x + last.w}
        y2={last.top}
        stroke="var(--accent)"
        strokeWidth="1.5"
        strokeDasharray="4 3"
      />
      <text x="470" y="196" fontFamily="var(--font-mono)" fontSize="9" fill="var(--accent)">
        per-turn input grows linearly
      </text>

      <text x="455" y="428" fontFamily="var(--font-mono)" fontSize="9.5" fill="var(--fg)">
        cumulative billed input = area
      </text>
      <text x="455" y="442" fontFamily="var(--font-mono)" fontSize="9" fill="var(--comment)">
        {"= N(N+1)/2 increments  ->  cost is quadratic"}
      </text>
    </svg>
  );
}
