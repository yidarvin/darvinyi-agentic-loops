import { useState } from "react";

// SkillOrServerWidget: the signature widget for "Skill or Server". One focused move:
// answer seven yes/no questions about a capability and watch it route to skill, server,
// both, or neither, with the reasoning and a dot that lands in the matching quadrant of
// the same access-by-judgment plane the figure draws. Flipping the access or judgment
// answer moves the verdict across a boundary, so the reader feels the decision rather
// than reading it. The routing and effective build axes mirror classify() in the
// chapter's artifact exactly: existing access removes the need to build anything unless
// procedure is missing; a workflow-local script can use runtime-provided credentials;
// central Skill delivery stays instruction, while an unmet shared *access* adapter needs
// a server boundary. React state only, no
// persistence.

type Key = "access" | "judgment" | "sharedAccess" | "skillDistributed" | "cliOrExisting" | "scriptAccess" | "live";
type Verdict = "skill" | "server" | "both" | "neither";

interface Question {
  key: Key;
  short: string;
  ask: string;
}

const QUESTIONS: Question[] = [
  { key: "access", short: "access", ask: "Is the hard part reaching a live external system, holding state, or authenticating to a third party?" },
  { key: "judgment", short: "judgment", ask: "Is the hard part knowing what to do: a workflow, a procedure, or domain expertise the agent lacks?" },
  { key: "sharedAccess", short: "shared access", ask: "Is an unmet reusable access adapter still needed for many agents or clients under central governance? Say yes only for the access boundary, not when a Skill is merely centrally distributed." },
  { key: "skillDistributed", short: "skill delivery", ask: "Will this Skill be centrally provisioned or managed across agents? That governs instruction distribution; it does not create a server access gap." },
  { key: "cliOrExisting", short: "cli or existing", ask: "Does a CLI the agent can shell out to, or an existing server, already provide access? Existing access is not a missing procedure. Answer shared access yes only when its reusable adapter is still missing." },
  { key: "scriptAccess", short: "local script", ask: "Can a workflow-local Skill script safely use runtime-provided network access and credentials? This is not a shared server boundary." },
  { key: "live", short: "live data", ask: "Does the data change between invocations, so it must be fetched fresh each time?" },
];

type Answers = Record<Key, boolean>;

const PRESETS: { label: string; answers: Answers }[] = [
  { label: "postgres access", answers: { access: true, judgment: false, sharedAccess: true, skillDistributed: false, cliOrExisting: false, scriptAccess: false, live: true } },
  { label: "brand guidelines", answers: { access: false, judgment: true, sharedAccess: false, skillDistributed: false, cliOrExisting: false, scriptAccess: false, live: false } },
  { label: "team review policy", answers: { access: false, judgment: true, sharedAccess: false, skillDistributed: true, cliOrExisting: false, scriptAccess: false, live: false } },
  { label: "gh pr create", answers: { access: true, judgment: true, sharedAccess: false, skillDistributed: false, cliOrExisting: true, scriptAccess: false, live: false } },
  { label: "workflow-local deploy", answers: { access: true, judgment: false, sharedAccess: false, skillDistributed: false, cliOrExisting: false, scriptAccess: true, live: true } },
  { label: "slack + team norms", answers: { access: true, judgment: true, sharedAccess: true, skillDistributed: false, cliOrExisting: false, scriptAccess: false, live: true } },
  { label: "release notes", answers: { access: true, judgment: true, sharedAccess: false, skillDistributed: false, cliOrExisting: false, scriptAccess: false, live: true } },
];

interface Result {
  verdict: Verdict;
  reasons: string[];
  example: string;
  effectiveAccessBoundary: boolean;
  effectiveSkillWork: boolean;
}

// The same routing as hybrid_lab.py's classify(): a reusable access gap needs a server;
// judgment needs a skill; both needs both. A CLI or existing server can provide a fresh
// fetch without creating a procedure gap. A Skill can also run a workflow-local script
// when its runtime supplies network access and credentials. Central Skill distribution
// stays instruction; only an unmet reusable or shared *access* adapter creates the
// server axis.
function classify(a: Answers): Result {
  const { access, judgment, sharedAccess, skillDistributed, cliOrExisting, scriptAccess, live } = a;
  const distributionNote = "Central Skill provisioning governs instruction distribution; it does not create a shared access boundary.";
  const withDistribution = (reasons: string[]) => skillDistributed ? [...reasons, distributionNote] : reasons;

  if (!access && !judgment && !sharedAccess && !live) {
    return {
      verdict: "neither",
      reasons: withDistribution(["The agent can already do this in one step. Build nothing; if it forgets, a line in context is enough."]),
      example: "e.g. a two-line summary of git status",
      effectiveAccessBoundary: false,
      effectiveSkillWork: false,
    };
  }

  // Fresh data requires a path to the system, not necessarily a server. Existing access
  // can supply it, or a Skill can bundle a workflow-local script when the runtime supplies
  // network and credentials. The mini-plane tracks effective build needs, not raw toggles.
  const accessNeeded = access || live || sharedAccess;
  const existingAccess = (access || live) && cliOrExisting;
  const workflowScript = accessNeeded && scriptAccess && !cliOrExisting && !sharedAccess;
  const effectiveAccessBoundary = sharedAccess || (accessNeeded && !cliOrExisting && !scriptAccess);
  const effectiveSkillWork = judgment || workflowScript;

  if (effectiveAccessBoundary && effectiveSkillWork) {
    const reasons = ["Both a reusable access boundary and a procedure are hard. Layer them: a server for the connection, a skill that supplies the procedure and calls its tools."];
    if (sharedAccess) reasons.push("The missing access adapter must serve many clients under governance, so a server is the auditable chokepoint.");
    if (live) reasons.push("The data changes between runs, so it must be fetched live, not written down once.");
    return {
      verdict: "both",
      reasons: withDistribution(reasons),
      example: "e.g. Slack access plus your team's posting norms",
      effectiveAccessBoundary,
      effectiveSkillWork,
    };
  }

  if (effectiveAccessBoundary) {
    const reasons = ["The hard part is an unmet reusable access boundary, and neither an existing tool nor a workflow-local script covers it. Build or adopt an MCP server."];
    if (sharedAccess) reasons.push("It is a shared access adapter for many clients under governance, which a server centralizes.");
    if (live) reasons.push("The data changes between runs, so it must be fetched live.");
    return {
      verdict: "server",
      reasons: withDistribution(reasons),
      example: "e.g. an internal Postgres your agent queries live",
      effectiveAccessBoundary,
      effectiveSkillWork,
    };
  }

  if (effectiveSkillWork) {
    if (workflowScript) {
      const reasons = ["The runtime already supplies network access and credentials, and this access belongs to one workflow. Bundle and run a local script in a skill; no reusable server boundary is needed."];
      if (judgment) reasons.push("The same skill can carry the procedure the agent lacks.");
      if (live) reasons.push("The script fetches fresh data when the workflow runs.");
      return {
        verdict: "skill",
        reasons: withDistribution(reasons),
        example: "e.g. a workflow-local deploy script",
        effectiveAccessBoundary,
        effectiveSkillWork,
      };
    }
    if (existingAccess) {
      const reasons = ["A CLI or existing server already provides the access. The missing piece is procedure, so add a skill that directs the existing access."];
      if (live) reasons.push("The existing access can fetch fresh data; freshness does not require a second server.");
      return {
        verdict: "skill",
        reasons: withDistribution(reasons),
        example: "e.g. gh pr create wrapped with your PR conventions",
        effectiveAccessBoundary,
        effectiveSkillWork,
      };
    }
    return {
      verdict: "skill",
      reasons: withDistribution(["The agent can already reach what it needs; the hard part is knowing what to do with it. That is a skill."]),
      example: "e.g. your brand guidelines and report formatting",
      effectiveAccessBoundary,
      effectiveSkillWork,
    };
  }

  if (existingAccess) {
    const reasons = ["A CLI or existing server already provides the access, and no procedure is missing. Adopt it; build nothing."];
    if (live) reasons.push("The existing access can fetch fresh data; freshness does not require a second server.");
    return {
      verdict: "neither",
      reasons: withDistribution(reasons),
      example: "e.g. use an existing CLI directly",
      effectiveAccessBoundary,
      effectiveSkillWork,
    };
  }

  return {
    verdict: "neither",
    reasons: withDistribution(["No reusable access boundary or procedure is missing. Build nothing."]),
    example: "e.g. a two-line summary of git status",
    effectiveAccessBoundary,
    effectiveSkillWork,
  };
}

const VERDICT_COPY: Record<Verdict, string> = {
  skill: "SKILL",
  server: "SERVER",
  both: "BOTH, layered",
  neither: "NEITHER",
};

// The mini plane draws effective build needs. Existing access moves left without creating
// skill work; a workflow-local script moves up; centrally delivered Skills stay left; only
// an unmet shared access adapter moves right.
function dot(accessBoundary: boolean, skillWork: boolean): { x: number; y: number } {
  return { x: accessBoundary ? 162 : 78, y: skillWork ? 50 : 116 };
}

const START: Answers = { access: false, judgment: true, sharedAccess: false, skillDistributed: false, cliOrExisting: false, scriptAccess: false, live: false };

export function SkillOrServerWidget() {
  const [answers, setAnswers] = useState<Answers>(START);
  const result = classify(answers);
  const both = result.verdict === "both";
  const d = dot(result.effectiveAccessBoundary, result.effectiveSkillWork);

  const toggle = (k: Key) => setAnswers((a) => ({ ...a, [k]: !a[k] }));
  const equalsPreset = (p: Answers) => QUESTIONS.every((q) => answers[q.key] === p[q.key]);

  return (
    <div className="font-sans">
      {/* presets: jump to a plotted case from the figure */}
      <div className="flex flex-wrap items-center gap-1 font-mono text-[0.68rem]">
        <span className="mr-1 text-comment">{"// try:"}</span>
        {PRESETS.map((p) => (
          <button
            key={p.label}
            onClick={() => setAnswers(p.answers)}
            aria-pressed={equalsPreset(p.answers)}
            className={`rounded border px-2 py-1 transition-colors motion-reduce:transition-none ${
              equalsPreset(p.answers)
                ? "border-accent/50 bg-accent/15 text-accent"
                : "border-border text-muted hover:text-fg"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        {/* the seven questions */}
        <div className="rounded border border-border bg-surface-2 p-3">
          <div className="mb-2 font-mono text-[0.7rem] text-comment">{"// answer for your capability"}</div>
          <ul className="space-y-2">
            {QUESTIONS.map((q) => {
              const on = answers[q.key];
              return (
                <li key={q.key} className="flex items-start gap-3">
                  <button
                    onClick={() => toggle(q.key)}
                    aria-pressed={on}
                    aria-label={`${q.short}: ${on ? "yes" : "no"}`}
                    className={`mt-0.5 w-12 shrink-0 rounded border px-1 py-1 text-center font-mono text-[0.62rem] transition-colors motion-reduce:transition-none ${
                      on ? "border-accent/50 bg-accent/15 text-accent" : "border-border text-muted hover:text-fg"
                    }`}
                  >
                    {on ? "yes" : "no"}
                  </button>
                  <div>
                    <div className="font-mono text-[0.72rem] text-fg">{q.short}</div>
                    <div className="text-[0.8rem] leading-snug text-fg/70">{q.ask}</div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        {/* the verdict, its reasons, and its place on the plane */}
        <div className={`rounded border p-3 ${both ? "border-accent/50 bg-accent/5" : "border-accent/30 bg-surface"}`}>
          <div className="flex items-baseline justify-between gap-2">
            <span className="font-mono text-comment text-[0.7rem]">{"// verdict"}</span>
            <span className="font-mono text-sm text-accent">{VERDICT_COPY[result.verdict]}</span>
          </div>

          {/* mini plane, echoing the figure */}
          <svg viewBox="0 0 220 150" className="mt-2 w-full" role="img" aria-label={`The capability lands in the ${result.verdict} region of the effective shared-access-boundary by skill-work plane. Existing access is accounted for before the dot is placed, a workflow-local script counts as skill work rather than a shared server boundary, and centrally provisioned Skills stay on the skill side.`}>
            <rect x="40" y="12" width="160" height="126" rx="4" fill="var(--surface-2)" stroke="var(--border)" />
            {/* both quadrant tint (top-right) */}
            <rect x="120" y="12" width="80" height="63" fill="var(--accent)" fillOpacity="0.1" />
            <line x1="120" y1="12" x2="120" y2="138" stroke="var(--border)" strokeDasharray="3 3" />
            <line x1="40" y1="75" x2="200" y2="75" stroke="var(--border)" strokeDasharray="3 3" />
            <text x="80" y="45" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="7" fill="var(--comment)">skill</text>
            <text x="160" y="45" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="7" fill="var(--accent)">both</text>
            <text x="80" y="112" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="7" fill="var(--comment)">neither</text>
            <text x="160" y="112" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="7" fill="var(--comment)">server</text>
            <text x="120" y="149" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="6.5" fill="var(--fg-muted)">new shared access →</text>
            <text x="34" y="75" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="6.5" fill="var(--fg-muted)" transform="rotate(-90 34 75)">skill work →</text>
            <circle cx={d.x} cy={d.y} r="5" fill="var(--accent)" className="[transition:cx_300ms,cy_300ms] motion-reduce:transition-none" />
          </svg>

          <p className="mt-1 font-mono text-[0.62rem] leading-snug text-comment">
            {"// existing access shifts left; local scripts move up; shared Skill delivery stays left."}
          </p>

          <ul className="mt-2 space-y-1.5 text-[0.82rem] leading-snug text-fg/80">
            {result.reasons.map((r, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-accent">·</span>
                <span>{r}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 font-mono text-[0.68rem] text-comment">{result.example}</p>
        </div>
      </div>

      <p className="mt-3 font-mono text-[0.7rem] text-comment">
        {both
          ? "// the top-right corner: a shared connection and skill work. the production default."
          : "// flip access or judgment and watch the verdict cross a boundary."}
      </p>
    </div>
  );
}
