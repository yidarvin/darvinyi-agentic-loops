import { useState } from "react";

// TheLandscapeWidget: the signature widget for "The Landscape".
// One focused move: pick the two axes of the design space, and watch the tools
// relocate. A tool that looks extreme on one pair of axes sits in the middle on
// another, which is the lesson: a tool's position is relative to the coordinate
// system you measure it in, not an absolute ranking. Select a tool to read its
// headline bet and its rationale on the two active axes. React state only, no
// persistence. Positions are the author's placements from the chapter's research
// doc on a 0..1 scale, not a benchmark; they are meant to be argued with.

interface Axis {
  key: AxisKey;
  label: string;
  lo: string;
  hi: string;
}

type AxisKey =
  | "locus"
  | "coupling"
  | "autonomy"
  | "persistence"
  | "extensibility"
  | "safety"
  | "interface";

const AXES: Axis[] = [
  { key: "locus", label: "execution locus", lo: "local / interactive", hi: "cloud / async" },
  { key: "coupling", label: "model coupling", lo: "single-vendor", hi: "model-agnostic" },
  { key: "autonomy", label: "autonomy", lo: "collaborative pair", hi: "autonomous delegate" },
  { key: "persistence", label: "session persistence", lo: "fresh per session", hi: "persistent daemon" },
  { key: "extensibility", label: "extensibility", lo: "first-party", hi: "open / pluggable" },
  { key: "safety", label: "trust boundary", lo: "permission rules", hi: "OS sandbox" },
  { key: "interface", label: "interface", lo: "terminal", hi: "web / IDE" },
];

interface Tool {
  key: string;
  name: string;
  primary: boolean;
  bet: string;
  pos: Record<AxisKey, number>;
  why: Record<AxisKey, string>;
}

const TOOLS: Tool[] = [
  {
    key: "claude",
    name: "Claude Code",
    primary: true,
    bet: "Small loop, large harness. Trusted, inspectable, human-in-the-loop local steering.",
    pos: { locus: 0.15, coupling: 0.05, autonomy: 0.3, persistence: 0.1, extensibility: 0.6, safety: 0.35, interface: 0.2 },
    why: {
      locus: "Runs in your terminal against your live tree; each turn calls the API.",
      coupling: "Bonded to Anthropic models, enforced against third-party harnesses in 2026.",
      autonomy: "Collaborative by default; eyes on every consequential action even with auto mode.",
      persistence: "Fresh per session with a flat message history; compaction, not a database.",
      extensibility: "Five layers by context cost: hooks, skills, plugins, MCP, all first-party.",
      safety: "Fail-closed permission pipeline; deny rules win in every mode; sandbox optional.",
      interface: "Terminal-first, with IDE and SDK surfaces on the same engine.",
    },
  },
  {
    key: "codex",
    name: "Codex",
    primary: true,
    bet: "Delegate at scale. Throughput over steering, with safety by OS containment.",
    pos: { locus: 0.85, coupling: 0.15, autonomy: 0.85, persistence: 0.7, extensibility: 0.5, safety: 0.9, interface: 0.8 },
    why: {
      locus: "Fire a task at an isolated cloud container and review the PR minutes later.",
      coupling: "OpenAI-first engine, with an open-source CLI and MCP support.",
      autonomy: "Built for delegation: assign a ticket, queue four more, walk away.",
      persistence: "SQLite-backed threads you can resume, fork, archive, and roll back.",
      extensibility: "apply_patch, tool_search, MCP; a Rust core extended over a wire protocol.",
      safety: "OS-level sandbox is the spine: Seatbelt, Landlock, network off by default.",
      interface: "Meets you on web, desktop, IDE, and CLI, all sharing one engine.",
    },
  },
  {
    key: "opencode",
    name: "opencode",
    primary: true,
    bet: "Never bond to one vendor. A persistent server as the durable primitive.",
    pos: { locus: 0.3, coupling: 0.95, autonomy: 0.35, persistence: 0.95, extensibility: 0.75, safety: 0.25, interface: 0.35 },
    why: {
      locus: "Local terminal, but a persistent daemon you reconnect to over SSH.",
      coupling: "75+ providers, BYOK; switch models mid-session. The defining bet.",
      autonomy: "Plan and Build modes with fine-grained per-tool permissions; you steer.",
      persistence: "A background server owns session state between terminal sessions.",
      extensibility: "Open-source, ACP for editors, provider plugins, per-tool permissions.",
      safety: "Per-tool permissions plus git snapshots; no default OS sandbox.",
      interface: "A TUI over an HTTP engine; desktop and ACP editors are clients too.",
    },
  },
  {
    key: "cursor",
    name: "Cursor",
    primary: false,
    bet: "IDE-native, with the deepest multi-model selection of any editor.",
    pos: { locus: 0.55, coupling: 0.8, autonomy: 0.55, persistence: 0.5, extensibility: 0.5, safety: 0.4, interface: 0.95 },
    why: {
      locus: "IDE-local edits, plus background agents that run async server-side.",
      coupling: "Deepest multi-model selection of any editor.",
      autonomy: "Agent mode plans then acts; background agents pick up tickets and open PRs.",
      persistence: "Background-agent state lives on isolated git worktrees.",
      extensibility: "Composer and Agent modes; up to eight parallel agents in 2.x.",
      safety: "An isolated git worktree per agent; you review the diff.",
      interface: "The IDE-native reference: a VS Code fork built around the agent.",
    },
  },
  {
    key: "aider",
    name: "Aider",
    primary: false,
    bet: "Context engineering as the product. Git is the safety net.",
    pos: { locus: 0.1, coupling: 0.9, autonomy: 0.25, persistence: 0.15, extensibility: 0.2, safety: 0.15, interface: 0.1 },
    why: {
      locus: "Local terminal, git-centric; the purest single-machine loop.",
      coupling: "Model-agnostic via LiteLLM; matches edit format to the model.",
      autonomy: "Interactive and git-centric; auto-commits so you can roll back.",
      persistence: "Git history is the memory; no daemon, no database.",
      extensibility: "A minimal harness; a token-budgeted repo-map is the differentiator.",
      safety: "Git rollback is the safety net; no default sandbox.",
      interface: "Terminal only, the minimalist end of the space.",
    },
  },
];

// plot geometry, in SVG user units
const W = 360;
const H = 300;
const PAD = 36;
const px = (v: number) => PAD + v * (W - 2 * PAD);
const py = (v: number) => H - PAD - v * (H - 2 * PAD); // invert so hi is up

export function TheLandscapeWidget() {
  const [xKey, setXKey] = useState<AxisKey>("locus");
  const [yKey, setYKey] = useState<AxisKey>("coupling");
  const [selected, setSelected] = useState<string>("claude");

  const xAxis = AXES.find((a) => a.key === xKey)!;
  const yAxis = AXES.find((a) => a.key === yKey)!;
  const tool = TOOLS.find((t) => t.key === selected)!;

  return (
    <div className="font-sans">
      {/* axis pickers: the one move that reorganizes the map */}
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <AxisPicker id="x-axis" label="x axis" value={xKey} onChange={setXKey} />
        <AxisPicker id="y-axis" label="y axis" value={yKey} onChange={setYKey} />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-[auto,1fr]">
        {/* the map */}
        <div className="overflow-x-auto">
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="w-full min-w-[320px]"
            role="img"
            aria-label={`Design-space map. Horizontal axis: ${xAxis.label}, from ${xAxis.lo} on the left to ${xAxis.hi} on the right. Vertical axis: ${yAxis.label}, from ${yAxis.lo} at the bottom to ${yAxis.hi} at the top. ${TOOLS.map((t) => `${t.name} sits ${labelFor(t.pos[xKey])} on ${xAxis.label} and ${labelFor(t.pos[yKey])} on ${yAxis.label}`).join(". ")}.`}
            fill="none"
          >
            {/* plot frame */}
            <rect x={PAD} y={PAD} width={W - 2 * PAD} height={H - 2 * PAD} fill="var(--surface-2)" stroke="var(--border)" />
            {/* quartile gridlines */}
            {[0.25, 0.5, 0.75].map((f) => (
              <g key={f}>
                <line x1={px(f)} y1={PAD} x2={px(f)} y2={H - PAD} stroke="var(--border)" strokeOpacity="0.5" strokeDasharray="2 3" />
                <line x1={PAD} y1={py(f)} x2={W - PAD} y2={py(f)} stroke="var(--border)" strokeOpacity="0.5" strokeDasharray="2 3" />
              </g>
            ))}

            {/* axis labels */}
            <text x={PAD} y={H - 10} fontFamily="var(--font-mono)" fontSize="8.5" fill="var(--comment)">
              {xAxis.lo}
            </text>
            <text x={W - PAD} y={H - 10} textAnchor="end" fontFamily="var(--font-mono)" fontSize="8.5" fill="var(--comment)">
              {xAxis.hi}
            </text>
            <text x={PAD} y={H - 22} fontFamily="var(--font-mono)" fontSize="9" fill="var(--accent)">
              {`x: ${xAxis.label}`}
            </text>
            <text
              transform={`translate(14 ${H - PAD}) rotate(-90)`}
              fontFamily="var(--font-mono)"
              fontSize="8.5"
              fill="var(--comment)"
            >
              {yAxis.lo}
            </text>
            <text
              transform={`translate(14 ${PAD}) rotate(-90)`}
              textAnchor="end"
              fontFamily="var(--font-mono)"
              fontSize="8.5"
              fill="var(--comment)"
            >
              {yAxis.hi}
            </text>
            <text
              transform={`translate(26 ${PAD}) rotate(-90)`}
              textAnchor="end"
              fontFamily="var(--font-mono)"
              fontSize="9"
              fill="var(--accent)"
            >
              {`y: ${yAxis.label}`}
            </text>

            {/* the tools, positioned by the two active axes */}
            {TOOLS.map((t) => {
              const isSel = t.key === selected;
              const x = px(t.pos[xKey]);
              const y = py(t.pos[yKey]);
              const r = t.primary ? 7 : 5;
              return (
                <g
                  key={t.key}
                  className="cursor-pointer transition-transform duration-500 ease-out motion-reduce:transition-none"
                  style={{ transform: `translate(${x}px, ${y}px)` }}
                  onClick={() => setSelected(t.key)}
                >
                  {isSel && <circle r={r + 5} fill="none" stroke="var(--accent)" strokeWidth="1.5" />}
                  <circle
                    r={r}
                    fill={t.primary ? "var(--accent)" : "var(--comment)"}
                    fillOpacity={t.primary ? (isSel ? 1 : 0.85) : isSel ? 0.9 : 0.55}
                    stroke="var(--bg)"
                    strokeWidth="1.5"
                  />
                  <text
                    x={0}
                    y={-r - 6}
                    textAnchor="middle"
                    fontFamily="var(--font-mono)"
                    fontSize="9"
                    fill={isSel ? "var(--accent)" : "var(--fg)"}
                    fillOpacity={t.primary || isSel ? 1 : 0.6}
                  >
                    {t.name}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        {/* the rationale panel for the selected tool */}
        <div className="rounded-lg border border-border bg-surface-2 p-4">
          <div className="flex flex-wrap gap-1.5">
            {TOOLS.map((t) => (
              <button
                key={t.key}
                onClick={() => setSelected(t.key)}
                aria-pressed={t.key === selected}
                className={`rounded border px-2 py-1 font-mono text-[0.7rem] transition-colors motion-reduce:transition-none ${
                  t.key === selected
                    ? "border-accent/60 bg-accent/15 text-accent"
                    : "border-border text-muted hover:text-fg"
                }`}
              >
                {t.name}
              </button>
            ))}
          </div>

          <p className="mt-3 font-mono text-[0.7rem] uppercase tracking-wide text-comment">the bet</p>
          <p className="mt-1 font-sans text-sm leading-relaxed text-fg/90">{tool.bet}</p>

          <div className="mt-4 space-y-3">
            <Rationale axis={xAxis} pos={tool.pos[xKey]} why={tool.why[xKey]} tag="x" />
            <Rationale axis={yAxis} pos={tool.pos[yKey]} why={tool.why[yKey]} tag="y" />
          </div>
        </div>
      </div>

      <p className="mt-4 font-mono text-[0.7rem] leading-relaxed text-comment">
        {"// change the axes and watch the tools move. a tool is extreme on one pair and central on another; position is relative to what you measure."}
      </p>
    </div>
  );
}

function labelFor(v: number): string {
  if (v < 0.34) return "low";
  if (v < 0.67) return "mid";
  return "high";
}

function AxisPicker({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: AxisKey;
  onChange: (k: AxisKey) => void;
}) {
  return (
    <label htmlFor={id} className="block font-mono text-xs text-comment">
      <span className="mb-1 block">{label}</span>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value as AxisKey)}
        className="w-full rounded border border-border bg-surface px-2 py-1.5 font-mono text-xs text-fg accent-accent focus:border-accent focus:outline-none"
      >
        {AXES.map((a) => (
          <option key={a.key} value={a.key}>
            {a.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function Rationale({
  axis,
  pos,
  why,
  tag,
}: {
  axis: Axis;
  pos: number;
  why: string;
  tag: string;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between font-mono text-[0.7rem]">
        <span className="text-accent">
          {tag}: {axis.label}
        </span>
        <span className="text-comment">
          {axis.lo} <span className="text-fg/80">→</span> {axis.hi}
        </span>
      </div>
      {/* a mini position bar for this axis */}
      <div className="relative mt-1 h-1.5 w-full rounded-full bg-surface">
        <div
          className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border border-bg bg-accent"
          style={{ left: `${pos * 100}%` }}
        />
      </div>
      <p className="mt-1.5 font-sans text-[0.8rem] leading-relaxed text-fg/80">{why}</p>
    </div>
  );
}
