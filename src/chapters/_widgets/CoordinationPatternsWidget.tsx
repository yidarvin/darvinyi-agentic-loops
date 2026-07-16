import { useState } from "react";

type ProfileId = "pipeline" | "fanout" | "supervisor" | "handoff" | "sharedWrite";
type NodeKind = "lead" | "worker" | "join" | "state" | "answer";

interface GraphNode {
  id: string;
  label: string[];
  kind: NodeKind;
  x: number;
  y: number;
}

interface GraphEdge {
  from: string;
  to: string;
  label?: string;
  transfer?: boolean;
}

interface Profile {
  id: ProfileId;
  button: string;
  title: string;
  topology: string;
  control: string;
  join: string;
  constraint: string;
  readout: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
}

const PROFILES: Profile[] = [
  {
    id: "pipeline",
    button: "linear stages",
    title: "A fixed pipeline keeps every dependency visible.",
    topology: "sequential pipeline",
    control: "code advances one stage at a time",
    join: "no concurrent merge",
    constraint: "latency is the sum of the stages",
    readout: "Each stage can rely on the prior output, so routing is unnecessary. Make the stage schema explicit and keep failures local to a named boundary.",
    nodes: [
      { id: "brief", label: ["brief"], kind: "lead", x: 80, y: 130 },
      { id: "research", label: ["research"], kind: "worker", x: 250, y: 130 },
      { id: "review", label: ["review"], kind: "worker", x: 425, y: 130 },
      { id: "answer", label: ["answer"], kind: "answer", x: 615, y: 130 },
    ],
    edges: [
      { from: "brief", to: "research" },
      { from: "research", to: "review" },
      { from: "review", to: "answer" },
    ],
  },
  {
    id: "fanout",
    button: "parallel research",
    title: "Independent reads fan out, then meet at one reducer.",
    topology: "fan-out / fan-in",
    control: "code releases a bounded worker pool",
    join: "required branches reduce in stable input order",
    constraint: "a failed branch blocks synthesis until policy resolves it",
    readout: "The workers can explore independently because none owns the final claim. The join validates coverage and conflict rules before one lead writes the aggregate.",
    nodes: [
      { id: "lead", label: ["lead"], kind: "lead", x: 80, y: 130 },
      { id: "sources", label: ["sources"], kind: "worker", x: 290, y: 58 },
      { id: "risks", label: ["risks"], kind: "worker", x: 290, y: 130 },
      { id: "options", label: ["options"], kind: "worker", x: 290, y: 202 },
      { id: "join", label: ["join", "reducer"], kind: "join", x: 500, y: 130 },
      { id: "answer", label: ["answer"], kind: "answer", x: 650, y: 130 },
    ],
    edges: [
      { from: "lead", to: "sources", label: "fan-out" },
      { from: "lead", to: "risks" },
      { from: "lead", to: "options" },
      { from: "sources", to: "join" },
      { from: "risks", to: "join" },
      { from: "options", to: "join" },
      { from: "join", to: "answer", label: "aggregate" },
    ],
  },
  {
    id: "supervisor",
    button: "ambiguous triage",
    title: "A supervisor keeps routing and synthesis under one owner.",
    topology: "supervisor with bounded specialists",
    control: "the supervisor chooses a specialist and resumes",
    join: "the supervisor synthesizes returned results",
    constraint: "every round pays a translation and routing cost",
    readout: "Use this when the request needs dynamic classification but the final answer needs central ownership. A specialist call returns. That is different from a handoff.",
    nodes: [
      { id: "supervisor", label: ["supervisor"], kind: "lead", x: 120, y: 130 },
      { id: "specialistA", label: ["policy"], kind: "worker", x: 365, y: 68 },
      { id: "specialistB", label: ["billing"], kind: "worker", x: 365, y: 192 },
      { id: "answer", label: ["answer"], kind: "answer", x: 610, y: 130 },
    ],
    edges: [
      { from: "supervisor", to: "specialistA", label: "call" },
      { from: "supervisor", to: "specialistB", label: "call" },
      { from: "specialistA", to: "supervisor", label: "return" },
      { from: "specialistB", to: "supervisor", label: "return" },
      { from: "supervisor", to: "answer", label: "synthesize" },
    ],
  },
  {
    id: "handoff",
    button: "unknown path",
    title: "A peer network transfers active ownership along the path.",
    topology: "peer handoff network",
    control: "the active agent selects the next owner",
    join: "none by default; the current owner responds",
    constraint: "cap hops and trace every transfer",
    readout: "Use a handoff when a specialist should take over the conversation, not merely contribute a bounded result. The original caller does not automatically resume.",
    nodes: [
      { id: "triage", label: ["triage"], kind: "lead", x: 110, y: 130 },
      { id: "billing", label: ["billing"], kind: "worker", x: 355, y: 66 },
      { id: "support", label: ["support"], kind: "worker", x: 355, y: 194 },
      { id: "reply", label: ["reply"], kind: "answer", x: 610, y: 130 },
    ],
    edges: [
      { from: "triage", to: "billing", label: "transfer", transfer: true },
      { from: "triage", to: "support", label: "transfer", transfer: true },
      { from: "billing", to: "reply", label: "owns reply", transfer: true },
      { from: "support", to: "reply", label: "owns reply", transfer: true },
    ],
  },
  {
    id: "sharedWrite",
    button: "shared-write coding",
    title: "Parallel inspection ends before one accountable writer changes shared state.",
    topology: "read fan-out with serialized writer",
    control: "code protects the write boundary",
    join: "one writer resolves evidence into a mutation",
    constraint: "reads parallelize; contested writes do not",
    readout: "This profile keeps the useful part of parallelism without asking several workers to make coupled decisions in the same repository or record at once.",
    nodes: [
      { id: "lead", label: ["lead"], kind: "lead", x: 76, y: 130 },
      { id: "inspectA", label: ["inspect A"], kind: "worker", x: 270, y: 64 },
      { id: "inspectB", label: ["inspect B"], kind: "worker", x: 270, y: 196 },
      { id: "writer", label: ["one", "writer"], kind: "join", x: 490, y: 130 },
      { id: "repo", label: ["shared", "state"], kind: "state", x: 650, y: 130 },
    ],
    edges: [
      { from: "lead", to: "inspectA", label: "read" },
      { from: "lead", to: "inspectB", label: "read" },
      { from: "inspectA", to: "writer", label: "evidence" },
      { from: "inspectB", to: "writer", label: "evidence" },
      { from: "writer", to: "repo", label: "one write" },
    ],
  },
];

function nodeFill(kind: NodeKind) {
  if (kind === "lead" || kind === "join") return "var(--accent-dim)";
  if (kind === "state") return "var(--surface)";
  return "var(--surface-2)";
}

export function CoordinationPatternsWidget() {
  const [profileId, setProfileId] = useState<ProfileId>("fanout");
  const profile = PROFILES.find((item) => item.id === profileId) ?? PROFILES[0];

  const nodeFor = (id: string) => profile.nodes.find((node) => node.id === id);
  const buttonClass = "rounded border px-2.5 py-1.5 font-mono text-[0.68rem] transition-colors motion-reduce:transition-none";

  return (
    <div className="font-sans">
      <div className="flex flex-wrap gap-2" aria-label="Work profile">
        {PROFILES.map((item) => {
          const selected = item.id === profile.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setProfileId(item.id)}
              aria-pressed={selected}
              className={`${buttonClass} ${selected ? "border-accent/50 bg-accent/15 text-accent" : "border-border bg-surface-2 text-muted hover:border-accent/30 hover:text-fg"}`}
            >
              {item.button}
            </button>
          );
        })}
      </div>

      <div className="mt-3 overflow-x-auto rounded border border-border bg-surface-2 p-2">
        <svg
          viewBox="0 0 720 260"
          className="h-auto min-w-[660px] w-full"
          role="img"
          aria-label={`${profile.topology}: ${profile.title}`}
          fill="none"
        >
          <defs>
            <marker id="coordination-patterns-widget-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 0 L 8 4 L 0 8 z" fill="var(--accent)" />
            </marker>
          </defs>
          <rect x="1" y="1" width="718" height="258" rx="8" fill="var(--surface)" stroke="var(--border)" />
          <text x="20" y="25" fontFamily="var(--font-mono)" fontSize="10" fill="var(--accent)">{`// ${profile.topology}`}</text>
          <text x="20" y="45" fontFamily="var(--font-mono)" fontSize="8.8" fill="var(--fg-muted)">{profile.title}</text>

          {profile.edges.map((edge, index) => {
            const from = nodeFor(edge.from);
            const to = nodeFor(edge.to);
            if (!from || !to) return null;
            const middleX = (from.x + to.x) / 2;
            const middleY = (from.y + to.y) / 2 - 8;
            return (
              <g key={`${edge.from}-${edge.to}-${index}`}>
                <line
                  x1={from.x + 38}
                  y1={from.y}
                  x2={to.x - 38}
                  y2={to.y}
                  stroke={edge.transfer ? "var(--accent)" : "var(--accent-dim)"}
                  strokeWidth={edge.transfer ? "1.7" : "1.3"}
                  strokeDasharray={edge.transfer ? "4 3" : undefined}
                  markerEnd="url(#coordination-patterns-widget-arrow)"
                />
                {edge.label && (
                  <text x={middleX} y={middleY} textAnchor="middle" fontFamily="var(--font-mono)" fontSize="7.8" fill="var(--fg-muted)">
                    {edge.label}
                  </text>
                )}
              </g>
            );
          })}

          {profile.nodes.map((node) => {
            const isState = node.kind === "state";
            const width = isState ? 82 : 76;
            const height = isState ? 42 : 38;
            const top = node.y - height / 2;
            return (
              <g key={node.id}>
                <rect
                  x={node.x - width / 2}
                  y={top}
                  width={width}
                  height={height}
                  rx="6"
                  fill={nodeFill(node.kind)}
                  stroke={node.kind === "answer" ? "var(--accent)" : "var(--border)"}
                />
                {node.label.map((line, index) => (
                  <text
                    key={line}
                    x={node.x}
                    y={node.y - (node.label.length - 1) * 5 + index * 11 + 3}
                    textAnchor="middle"
                    fontFamily="var(--font-mono)"
                    fontSize="9"
                    fill="var(--fg)"
                  >
                    {line}
                  </text>
                ))}
              </g>
            );
          })}

          <text x="20" y="238" fontFamily="var(--font-mono)" fontSize="8.5" fill="var(--comment)">
            {profile.id === "handoff" ? "dashed edges transfer active ownership" : "results cross into one explicit ownership boundary"}
          </text>
        </svg>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <div className="rounded border border-border bg-surface-2 p-2.5">
          <p className="font-mono text-[0.63rem] text-comment">// control</p>
          <p className="mt-1 font-mono text-[0.72rem] leading-relaxed text-fg/85">{profile.control}</p>
        </div>
        <div className="rounded border border-border bg-surface-2 p-2.5">
          <p className="font-mono text-[0.63rem] text-comment">// join or state</p>
          <p className="mt-1 font-mono text-[0.72rem] leading-relaxed text-fg/85">{profile.join}</p>
        </div>
        <div className="rounded border border-accent/30 bg-surface p-2.5">
          <p className="font-mono text-[0.63rem] text-accent">// constraint</p>
          <p className="mt-1 font-mono text-[0.72rem] leading-relaxed text-fg/85">{profile.constraint}</p>
        </div>
      </div>

      <p className="mt-3 rounded border border-border bg-surface p-3 font-mono text-[0.75rem] leading-relaxed text-fg/85">
        {profile.readout}
      </p>
    </div>
  );
}
