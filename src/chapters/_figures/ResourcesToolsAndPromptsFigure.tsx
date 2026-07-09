// ResourcesToolsAndPromptsFigure: the figure for "Resources, Tools, and Prompts".
// The structure it encodes: an MCP server exposes exactly three server-side
// primitives, and the single axis that separates them is the controller, who
// decides when the primitive fires. Three controllers across the top (the model,
// the application, the user) each own one primitive (tools, resources, prompts),
// each with its own discover/invoke wire methods and REST analogy, and all three
// reach the one dataset below. Choosing the primitive is choosing the controller.
// Inline SVG, themed with the CSS variables, ASCII labels so it stays crisp.

interface Col {
  x: number;
  controller: string;
  primitive: string;
  control: string;
  discover: string;
  invoke: string;
  rest: string;
  example: string;
}

const W = 226;
const COLS: Col[] = [
  {
    x: 30,
    controller: "the model",
    primitive: "tools",
    control: "// model-controlled",
    discover: "tools/list",
    invoke: "tools/call",
    rest: "~ POST  (acts, side effects)",
    example: "ex: run_query, insert_order",
  },
  {
    x: 287,
    controller: "the application",
    primitive: "resources",
    control: "// application-controlled",
    discover: "resources/list",
    invoke: "resources/read",
    rest: "~ GET  (read-only, addressed)",
    example: "ex: db://schema",
  },
  {
    x: 544,
    controller: "the user",
    primitive: "prompts",
    control: "// user-controlled",
    discover: "prompts/list",
    invoke: "prompts/get",
    rest: "~ stored template",
    example: "ex: /weekly_report",
  },
];

export function ResourcesToolsAndPromptsFigure() {
  return (
    <svg
      viewBox="0 0 800 470"
      className="w-full min-w-[720px]"
      role="img"
      aria-label="An MCP server exposes exactly three server-side primitives, separated by one axis: who controls when the primitive fires. Across the top sit three controllers, each owning one primitive below it. The model controls tools, invoked with tools/list then tools/call, analogous to an HTTP POST that acts and has side effects, for example run_query and insert_order. The application controls resources, invoked with resources/list then resources/read, analogous to a read-only GET addressed by a URI, for example db://schema. The user controls prompts, invoked with prompts/list then prompts/get, analogous to a stored template or slash command, for example /weekly_report. All three primitives reach the one dataset at the bottom, the orders database: three controllers, three primitives, one source of truth. Choosing the primitive is choosing the controller."
      fill="none"
    >
      <rect x="1" y="1" width="798" height="468" rx="10" fill="var(--surface-2)" stroke="var(--border)" />

      <defs>
        <marker id="rtp-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto">
          <path d="M0 0 L10 5 L0 10 z" fill="var(--accent)" />
        </marker>
      </defs>

      {/* the organizing axis */}
      <text x="22" y="26" fontFamily="var(--font-mono)" fontSize="11" fill="var(--comment)">
        {"// one axis decides the primitive: who controls when it fires?"}
      </text>

      {COLS.map((c) => {
        const mid = c.x + W / 2;
        return (
          <g key={c.primitive}>
            {/* controller (the differentiator, in accent) */}
            <rect x={c.x} y="42" width={W} height="36" rx="7" fill="var(--surface)" stroke="var(--border)" />
            <text x={mid} y="65" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="12.5" fill="var(--accent)">
              {c.controller}
            </text>

            {/* controller decides -> primitive */}
            <line x1={mid} y1="78" x2={mid} y2="118" stroke="var(--accent)" strokeWidth="1.5" markerEnd="url(#rtp-arrow)" />
            <text x={mid + 8} y="100" fontFamily="var(--font-mono)" fontSize="8" fill="var(--comment)">
              decides
            </text>

            {/* the primitive door */}
            <rect x={c.x} y="120" width={W} height="210" rx="8" fill="var(--surface)" stroke="var(--accent)" strokeOpacity="0.4" />
            <text x={c.x + 16} y="150" fontFamily="var(--font-mono)" fontSize="17" fill="var(--accent)">
              {c.primitive}
            </text>
            <text x={c.x + 16} y="170" fontFamily="var(--font-mono)" fontSize="9.5" fill="var(--comment)">
              {c.control}
            </text>
            <line x1={c.x + 16} y1="182" x2={c.x + W - 16} y2="182" stroke="var(--border)" strokeWidth="1" />

            {/* discover, then invoke: the two wire methods */}
            <text x={c.x + 16} y="203" fontFamily="var(--font-mono)" fontSize="8.5" fill="var(--comment)">
              discover
            </text>
            <text x={c.x + 16} y="218" fontFamily="var(--font-mono)" fontSize="11.5" fill="var(--accent-dim)">
              {c.discover}
            </text>
            <text x={c.x + 16} y="240" fontFamily="var(--font-mono)" fontSize="8.5" fill="var(--comment)">
              invoke
            </text>
            <text x={c.x + 16} y="255" fontFamily="var(--font-mono)" fontSize="11.5" fill="var(--accent-dim)">
              {c.invoke}
            </text>

            <line x1={c.x + 16} y1="270" x2={c.x + W - 16} y2="270" stroke="var(--border)" strokeWidth="1" strokeDasharray="3 3" />
            <text x={c.x + 16} y="291" fontFamily="var(--font-mono)" fontSize="10" fill="var(--fg)">
              {c.rest}
            </text>
            <text x={c.x + 16} y="313" fontFamily="var(--font-mono)" fontSize="9" fill="var(--comment)">
              {c.example}
            </text>

            {/* primitive -> the one dataset */}
            <line x1={mid} y1="330" x2={mid} y2="372" stroke="var(--accent)" strokeWidth="1.3" strokeOpacity="0.7" markerEnd="url(#rtp-arrow)" />
          </g>
        );
      })}

      {/* the shared dataset all three reach */}
      <rect x="30" y="372" width="740" height="58" rx="8" fill="var(--surface-2)" stroke="var(--border)" />
      <text x="400" y="396" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="12" fill="var(--fg)">
        one dataset: the orders database
      </text>
      <text x="400" y="414" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="9" fill="var(--comment)">
        {"// three controllers, three primitives, one source of truth"}
      </text>
    </svg>
  );
}
