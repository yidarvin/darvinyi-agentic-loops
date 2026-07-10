import { useState } from "react";

// SkillOrServerWidget: the signature widget for "Skill or Server". One focused move:
// answer five yes/no questions about a capability and watch it route to skill, server,
// both, or neither, with the reasoning and a dot that lands in the matching quadrant of
// the same access-by-judgment plane the figure draws. Flipping the access or judgment
// answer moves the verdict across a boundary, so the reader feels the decision rather
// than reading it. The routing mirrors classify() in the chapter's artifact exactly, so
// the code and the UI cannot disagree. React state only, no persistence.

type Key = "access" | "judgment" | "shared" | "cliOrExisting" | "live";
type Verdict = "skill" | "server" | "both" | "neither";

interface Question {
  key: Key;
  short: string;
  ask: string;
}

const QUESTIONS: Question[] = [
  { key: "access", short: "access", ask: "Is the hard part reaching a live external system, holding state, or authenticating to a third party?" },
  { key: "judgment", short: "judgment", ask: "Is the hard part knowing what to do: a workflow, a procedure, or domain expertise the agent lacks?" },
  { key: "shared", short: "shared", ask: "Must the same capability serve many agents or clients under central governance?" },
  { key: "cliOrExisting", short: "cli or existing", ask: "Does a CLI the agent can shell out to, or an existing server, already provide the access?" },
  { key: "live", short: "live data", ask: "Does the data change between invocations, so it must be fetched fresh each time?" },
];

type Answers = Record<Key, boolean>;

const PRESETS: { label: string; answers: Answers }[] = [
  { label: "postgres access", answers: { access: true, judgment: false, shared: true, cliOrExisting: false, live: true } },
  { label: "brand guidelines", answers: { access: false, judgment: true, shared: false, cliOrExisting: false, live: false } },
  { label: "gh pr create", answers: { access: true, judgment: true, shared: false, cliOrExisting: true, live: false } },
  { label: "slack + team norms", answers: { access: true, judgment: true, shared: true, cliOrExisting: false, live: true } },
  { label: "release notes", answers: { access: true, judgment: true, shared: false, cliOrExisting: false, live: true } },
];

interface Result {
  verdict: Verdict;
  reasons: string[];
  example: string;
}

// The same routing as hybrid_lab.py's classify(): access with no existing tool needs a
// server; judgment needs a skill; both needs both; an existing CLI turns access into a
// skill that wraps it; nothing hard needs nothing.
function classify(a: Answers): Result {
  const { access, judgment, shared, cliOrExisting, live } = a;

  if (!access && !judgment && !shared && !live) {
    return {
      verdict: "neither",
      reasons: ["The agent can already do this in one step. Build nothing; if it forgets, a line in context is enough."],
      example: "e.g. a two-line summary of git status",
    };
  }

  const serverNeeded = shared || live || (access && !cliOrExisting);

  if (serverNeeded && judgment) {
    const reasons = ["Both access and judgment are hard. Layer them: a server for the live connection, a skill that supplies the procedure and calls its tools."];
    if (shared) reasons.push("Shared across clients under governance, which wants a server as the auditable chokepoint.");
    if (live) reasons.push("The data changes between runs, so it must be fetched live, not written down once.");
    return { verdict: "both", reasons, example: "e.g. Slack access plus your team's posting norms" };
  }

  if (serverNeeded && !judgment) {
    const reasons = ["The hard part is access to a live or shared system and no existing tool covers it. Build or adopt an MCP server."];
    if (shared) reasons.push("It serves many clients with governance, which a server centralizes.");
    if (live) reasons.push("The data changes between runs, so it must be fetched live.");
    return { verdict: "server", reasons, example: "e.g. an internal Postgres your agent queries live" };
  }

  if (access && cliOrExisting) {
    const reasons = ["Access is needed, but a CLI or an existing server already provides it. Wrap that in a skill before building a server of your own."];
    if (judgment) reasons.push("Add the procedure the agent lacks on top of the wrapped access.");
    return { verdict: "skill", reasons, example: "e.g. gh pr create wrapped with your PR conventions" };
  }

  return {
    verdict: "skill",
    reasons: ["The agent can already reach what it needs; the hard part is knowing what to do with it. That is a skill."],
    example: "e.g. your brand guidelines and report formatting",
  };
}

const VERDICT_COPY: Record<Verdict, string> = {
  skill: "SKILL",
  server: "SERVER",
  both: "BOTH, layered",
  neither: "NEITHER",
};

// Where the verdict lands on the mini access-by-judgment plane, matching the figure's
// quadrants: skill top-left, server bottom-right, both top-right, neither bottom-left.
function dot(v: Verdict, judgment: boolean): { x: number; y: number } {
  switch (v) {
    case "server": return { x: 162, y: 116 };
    case "both": return { x: 162, y: 50 };
    case "neither": return { x: 78, y: 116 };
    case "skill": return { x: 84, y: judgment ? 50 : 60 };
  }
}

const START: Answers = { access: false, judgment: true, shared: false, cliOrExisting: false, live: false };

export function SkillOrServerWidget() {
  const [answers, setAnswers] = useState<Answers>(START);
  const result = classify(answers);
  const both = result.verdict === "both";
  const d = dot(result.verdict, answers.judgment);

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
        {/* the five questions */}
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
          <svg viewBox="0 0 220 150" className="mt-2 w-full" role="img" aria-label={`The capability lands in the ${result.verdict} region of the access by judgment plane.`}>
            <rect x="40" y="12" width="160" height="126" rx="4" fill="var(--surface-2)" stroke="var(--border)" />
            {/* both quadrant tint (top-right) */}
            <rect x="120" y="12" width="80" height="63" fill="var(--accent)" fillOpacity="0.1" />
            <line x1="120" y1="12" x2="120" y2="138" stroke="var(--border)" strokeDasharray="3 3" />
            <line x1="40" y1="75" x2="200" y2="75" stroke="var(--border)" strokeDasharray="3 3" />
            <text x="80" y="45" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="7" fill="var(--comment)">skill</text>
            <text x="160" y="45" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="7" fill="var(--accent)">both</text>
            <text x="80" y="112" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="7" fill="var(--comment)">neither</text>
            <text x="160" y="112" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="7" fill="var(--comment)">server</text>
            <text x="120" y="149" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="6.5" fill="var(--fg-muted)">access →</text>
            <text x="34" y="75" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="6.5" fill="var(--fg-muted)" transform="rotate(-90 34 75)">judgment →</text>
            <circle cx={d.x} cy={d.y} r="5" fill="var(--accent)" className="[transition:cx_300ms,cy_300ms] motion-reduce:transition-none" />
          </svg>

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
          ? "// the top-right corner: a live connection and the judgment to use it. the production default."
          : "// flip access or judgment and watch the verdict cross a boundary."}
      </p>
    </div>
  );
}
