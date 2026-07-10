// SkillOrServerFigure: the figure for "Skill or Server".
// The structure it encodes: access and judgment are two independent axes, not two ends
// of one scale. A capability's hard part can be reaching a live system (access), knowing
// what to do (judgment), both, or neither, and those four regions map cleanly to server,
// skill, both, and nothing. The key claim the plane makes visible is that "both" is a
// corner of the space (top-right), the production default, not a compromise between the
// other two. Real cases are plotted where they fall. Inline SVG, themed with the CSS
// variables, mono labels, legible on a phone via the min-w wrapper.

// A worked example plotted on the plane. ax/jx are 0..1 on the access and judgment axes.
interface Point {
  label: string;
  ax: number;
  jx: number;
  dx: number; // label offset x
  dy: number; // label offset y
  anchor: "start" | "middle" | "end";
}

// plane geometry
const X0 = 110;
const X1 = 550;
const Y_TOP = 70;
const Y_BOT = 430;
const px = (a: number) => X0 + a * (X1 - X0);
const py = (j: number) => Y_BOT - j * (Y_BOT - Y_TOP);

const POINTS: Point[] = [
  { label: "git status", ax: 0.2, jx: 0.14, dx: 10, dy: 4, anchor: "start" },
  { label: "postgres access", ax: 0.86, jx: 0.2, dx: -10, dy: -8, anchor: "end" },
  { label: "brand guidelines", ax: 0.12, jx: 0.66, dx: 10, dy: 4, anchor: "start" },
  { label: "gh pr create", ax: 0.38, jx: 0.54, dx: 10, dy: 4, anchor: "start" },
  { label: "release notes", ax: 0.6, jx: 0.56, dx: 10, dy: 14, anchor: "start" },
  { label: "slack + team norms", ax: 0.86, jx: 0.84, dx: -10, dy: -8, anchor: "end" },
];

export function SkillOrServerFigure() {
  return (
    <svg
      viewBox="0 0 900 520"
      className="w-full min-w-[860px]"
      role="img"
      aria-label="A plane with two axes: the horizontal axis is how much access is the hard part, from low on the left to high on the right; the vertical axis is how much judgment is the hard part, from low at the bottom to high at the top. The plane splits into four quadrants. Bottom-left, low access and low judgment, is labeled neither: the agent already does this, build nothing. Top-left, high judgment and low access, is a skill: procedure over tools the agent already has. Bottom-right, high access and low judgment, is a server: connectivity to a live or shared system. Top-right, high on both, is both, layered: a skill that orchestrates a server, and it is highlighted as the production default. Six real cases are plotted: git status sits in the neither corner; brand guidelines and gh pr create wrapped with your conventions sit in the skill corner; postgres access sits in the server corner; release notes and slack with team norms sit in the both corner. A side panel states the single test, is the hard part access or judgment, and maps each quadrant to its verdict. A lower band states that both is a corner of the space, not a compromise."
      fill="none"
    >
      <rect x="1" y="1" width="898" height="518" rx="10" fill="var(--surface-2)" stroke="var(--border)" />

      <defs>
        <marker id="sos-ax" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto">
          <path d="M0 0 L10 5 L0 10 z" fill="var(--fg-muted)" />
        </marker>
      </defs>

      <text x="22" y="20" fontFamily="var(--font-mono)" fontSize="11" fill="var(--comment)">
        {"// access and judgment are two axes, not two ends of one scale"}
      </text>

      {/* quadrant fills: emphasize the both corner (top-right) */}
      <rect x={px(0.5)} y={Y_TOP} width={px(1) - px(0.5)} height={py(0.5) - Y_TOP} fill="var(--accent)" fillOpacity="0.08" />

      {/* quadrant divider lines */}
      <line x1={px(0.5)} y1={Y_TOP} x2={px(0.5)} y2={Y_BOT} stroke="var(--border)" strokeDasharray="3 4" />
      <line x1={X0} y1={py(0.5)} x2={X1} y2={py(0.5)} stroke="var(--border)" strokeDasharray="3 4" />

      {/* axes */}
      <line x1={X0} y1={Y_BOT} x2={X1 + 16} y2={Y_BOT} stroke="var(--fg-muted)" strokeWidth="1.4" markerEnd="url(#sos-ax)" />
      <line x1={X0} y1={Y_BOT} x2={X0} y2={Y_TOP - 16} stroke="var(--fg-muted)" strokeWidth="1.4" markerEnd="url(#sos-ax)" />
      <text x={px(0.5)} y={Y_BOT + 30} textAnchor="middle" fontFamily="var(--font-mono)" fontSize="10.5" fill="var(--fg-muted)">
        access is the hard part →
      </text>
      <text x={X0 - 16} y={py(0.5)} textAnchor="middle" fontFamily="var(--font-mono)" fontSize="10.5" fill="var(--fg-muted)" transform={`rotate(-90 ${X0 - 16} ${py(0.5)})`}>
        judgment is the hard part →
      </text>

      {/* quadrant labels */}
      <text x={px(0.25)} y={py(0.28)} textAnchor="middle" fontFamily="var(--font-mono)" fontSize="12" fill="var(--comment)">neither</text>
      <text x={px(0.25)} y={py(0.28) + 16} textAnchor="middle" fontFamily="var(--font-mono)" fontSize="8.5" fill="var(--comment)">the agent already does it</text>

      <text x={px(0.25)} y={py(0.78)} textAnchor="middle" fontFamily="var(--font-mono)" fontSize="13" fill="var(--fg)">SKILL</text>
      <text x={px(0.25)} y={py(0.78) + 16} textAnchor="middle" fontFamily="var(--font-mono)" fontSize="8.5" fill="var(--comment)">procedure over tools it has</text>

      <text x={px(0.75)} y={py(0.28)} textAnchor="middle" fontFamily="var(--font-mono)" fontSize="13" fill="var(--fg)">SERVER</text>
      <text x={px(0.75)} y={py(0.28) + 16} textAnchor="middle" fontFamily="var(--font-mono)" fontSize="8.5" fill="var(--comment)">connectivity to a live system</text>

      <text x={px(0.75)} y={py(0.74)} textAnchor="middle" fontFamily="var(--font-mono)" fontSize="13" fill="var(--accent)">BOTH, layered</text>
      <text x={px(0.75)} y={py(0.74) + 16} textAnchor="middle" fontFamily="var(--font-mono)" fontSize="8.5" fill="var(--accent)" fillOpacity="0.8">a skill that drives a server</text>
      <text x={px(0.75)} y={py(0.74) + 30} textAnchor="middle" fontFamily="var(--font-mono)" fontSize="8" fill="var(--comment)">the production default</text>

      {/* plotted cases */}
      {POINTS.map((p) => {
        const inBoth = p.ax >= 0.5 && p.jx >= 0.5;
        const color = inBoth ? "var(--accent)" : "var(--fg-muted)";
        return (
          <g key={p.label}>
            <circle cx={px(p.ax)} cy={py(p.jx)} r="4" fill={color} />
            <text
              x={px(p.ax) + p.dx}
              y={py(p.jx) + p.dy}
              textAnchor={p.anchor}
              fontFamily="var(--font-mono)"
              fontSize="9.5"
              fill={inBoth ? "var(--accent)" : "var(--fg)"}
            >
              {p.label}
            </text>
          </g>
        );
      })}

      {/* side panel: the test and the mapping */}
      <rect x="596" y="70" width="282" height="360" rx="9" fill="var(--surface)" stroke="var(--border)" />
      <text x="614" y="96" fontFamily="var(--font-mono)" fontSize="11" fill="var(--accent)">{"// the single test"}</text>
      <text x="614" y="118" fontFamily="var(--font-mono)" fontSize="10.5" fill="var(--fg)">is the hard part</text>
      <text x="614" y="135" fontFamily="var(--font-mono)" fontSize="10.5" fill="var(--fg)">access, or judgment?</text>

      <line x1="614" y1="152" x2="860" y2="152" stroke="var(--border)" />

      <text x="614" y="178" fontFamily="var(--font-mono)" fontSize="10" fill="var(--comment)">access only</text>
      <text x="860" y="178" textAnchor="end" fontFamily="var(--font-mono)" fontSize="10.5" fill="var(--fg)">→ server</text>
      <text x="614" y="204" fontFamily="var(--font-mono)" fontSize="10" fill="var(--comment)">judgment only</text>
      <text x="860" y="204" textAnchor="end" fontFamily="var(--font-mono)" fontSize="10.5" fill="var(--fg)">→ skill</text>
      <text x="614" y="230" fontFamily="var(--font-mono)" fontSize="10" fill="var(--comment)">both</text>
      <text x="860" y="230" textAnchor="end" fontFamily="var(--font-mono)" fontSize="10.5" fill="var(--accent)">→ both, layered</text>
      <text x="614" y="256" fontFamily="var(--font-mono)" fontSize="10" fill="var(--comment)">neither</text>
      <text x="860" y="256" textAnchor="end" fontFamily="var(--font-mono)" fontSize="10.5" fill="var(--fg)">→ build nothing</text>

      <line x1="614" y1="276" x2="860" y2="276" stroke="var(--border)" />

      <text x="614" y="300" fontFamily="var(--font-mono)" fontSize="9.5" fill="var(--comment)">two corrections before</text>
      <text x="614" y="315" fontFamily="var(--font-mono)" fontSize="9.5" fill="var(--comment)">you build a server:</text>
      <text x="614" y="338" fontFamily="var(--font-mono)" fontSize="9" fill="var(--fg)">· a CLI the agent can run</text>
      <text x="626" y="352" fontFamily="var(--font-mono)" fontSize="9" fill="var(--comment)">→ a skill wrapping it wins</text>
      <text x="614" y="374" fontFamily="var(--font-mono)" fontSize="9" fill="var(--fg)">· an official server exists</text>
      <text x="626" y="388" fontFamily="var(--font-mono)" fontSize="9" fill="var(--comment)">→ adopt it, do not rebuild</text>
      <text x="614" y="412" fontFamily="var(--font-mono)" fontSize="9" fill="var(--comment)">shared across clients pulls</text>
      <text x="614" y="424" fontFamily="var(--font-mono)" fontSize="9" fill="var(--comment)">toward a server either way</text>

      {/* lesson band */}
      <rect x="22" y="466" width="856" height="42" rx="8" fill="var(--surface)" stroke="var(--border)" />
      <text x="38" y="490" fontFamily="var(--font-mono)" fontSize="10" fill="var(--accent)">
        {"// both is a corner of the space, not a compromise between the other two."}
      </text>
      <text x="38" y="503" fontFamily="var(--font-mono)" fontSize="9" fill="var(--comment)">
        {"most real capabilities that matter live in the top-right: they need a live connection and the judgment to use it."}
      </text>
    </svg>
  );
}
