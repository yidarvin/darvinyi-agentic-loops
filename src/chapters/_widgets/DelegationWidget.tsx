import { useEffect, useState } from "react";

// DelegationWidget: the signature widget for "Delegation". One focused move: step a
// subagent through its messy work and watch the two context windows side by side. The
// subagent's window fills as it reads files and backtracks; the lead's window stays
// flat, because none of that crosses the boundary. Then the subagent returns, and one
// toggle decides what crosses back: a distilled summary (a small bump) or the full
// transcript (a bump nearly as large as everything the subagent read). Flipping that
// toggle is the whole lesson: the return channel is a compression boundary, and
// leaking the transcript throws the isolation benefit away. The token numbers mirror
// the chapter's delegate.py. React state only, no persistence.

interface Work {
  label: string;
  tok: number;
}

// The subagent's work, one step at a time. These are the reads and dead ends that
// would otherwise pile up in the lead's window.
const WORK: Work[] = [
  { label: "read store.py", tok: 420 },
  { label: "read models.py", tok: 300 },
  { label: "ran tests → none found; backtrack", tok: 180 },
  { label: "read cli.py", tok: 360 },
  { label: "read api.py", tok: 340 },
  { label: "draft → revise → distill", tok: 220 },
];

const LEAD_BASE = 130; // system + user query + the pending Agent tool call
const SUB_BASE = 180; // the subagent's own system prompt + the prompt string
const SUB_PEAK = SUB_BASE + WORK.reduce((s, w) => s + w.tok, 0); // ~2000
const SUMMARY_TOK = 150; // the distilled return
const SCALE = LEAD_BASE + SUB_PEAK + 60; // common gauge max, so the two bars compare
const STEP_MS = 480;

type Contract = "summary" | "transcript";

function Gauge({ tokens, tone }: { tokens: number; tone: string }) {
  const pct = Math.min(100, (tokens / SCALE) * 100);
  return (
    <div className="h-2.5 w-full overflow-hidden rounded bg-surface-2">
      <div
        className="h-full rounded transition-[width] duration-500 ease-out motion-reduce:transition-none"
        style={{ width: `${pct}%`, background: tone }}
      />
    </div>
  );
}

function Turn({ label, tok, tone }: { label: string; tok: number; tone?: string }) {
  return (
    <li className="flex items-baseline justify-between gap-2 font-mono text-[0.68rem]">
      <span className={tone ?? "text-fg/80"}>{label}</span>
      <span className="shrink-0 text-comment">{tok}</span>
    </li>
  );
}

export function DelegationWidget() {
  const [step, setStep] = useState(0);
  const [contract, setContract] = useState<Contract>("summary");
  const [running, setRunning] = useState(false);

  const done = step >= WORK.length;
  const returnTok = contract === "summary" ? SUMMARY_TOK : SUB_PEAK;
  const subTokens = SUB_BASE + WORK.slice(0, step).reduce((s, w) => s + w.tok, 0);
  const leadTokens = LEAD_BASE + (done ? returnTok : 0);

  // Auto-run: advance one work step at a time until the subagent finishes.
  useEffect(() => {
    if (!running) return;
    if (done) {
      setRunning(false);
      return;
    }
    const id = setTimeout(() => setStep((s) => Math.min(WORK.length, s + 1)), STEP_MS);
    return () => clearTimeout(id);
  }, [running, step, done]);

  const prefersReduced =
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const run = () => {
    if (done) return;
    if (prefersReduced) setStep(WORK.length);
    else setRunning(true);
  };
  const stepOnce = () => setStep((s) => Math.min(WORK.length, s + 1));
  const reset = () => {
    setRunning(false);
    setStep(0);
  };

  const btn = "rounded border px-2.5 py-1 font-mono text-[0.68rem] transition-colors motion-reduce:transition-none disabled:opacity-40";

  return (
    <div className="font-sans">
      {/* controls */}
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={run} disabled={running || done} className={`${btn} border-accent/50 bg-accent/15 text-accent hover:bg-accent/25`}>
          run
        </button>
        <button onClick={stepOnce} disabled={running || done} className={`${btn} border-border text-muted hover:text-fg`}>
          step
        </button>
        <button onClick={reset} disabled={step === 0 && !running} className={`${btn} border-border text-muted hover:text-fg`}>
          reset
        </button>

        <span className="ml-1 font-mono text-[0.66rem] text-comment">{"// return contract:"}</span>
        {(["summary", "transcript"] as Contract[]).map((c) => (
          <button
            key={c}
            onClick={() => setContract(c)}
            aria-pressed={contract === c}
            className={`${btn} ${contract === c ? "border-accent/50 bg-accent/15 text-accent" : "border-border text-muted hover:text-fg"}`}
          >
            {c === "summary" ? "distilled summary" : "full transcript"}
          </button>
        ))}
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        {/* lead panel */}
        <div className="rounded border border-border bg-surface-2 p-3">
          <div className="flex items-baseline justify-between">
            <span className="font-mono text-[0.72rem] text-accent">{"// lead context"}</span>
            <span className="font-mono text-[0.66rem] text-comment">the orchestrator</span>
          </div>
          <ul className="mt-2 space-y-1">
            <Turn label="system: you are the lead" tok={40} />
            <Turn label="user: summarize the repo" tok={60} />
            <Turn label={done ? "Agent(research) → returned" : "Agent(research) → running…"} tok={30} tone="text-fg/80" />
            {done && (
              <Turn
                label={contract === "summary" ? "← distilled summary" : "← full transcript (leak)"}
                tok={returnTok}
                tone={contract === "summary" ? "text-accent" : "text-fg"}
              />
            )}
          </ul>
          <div className="mt-3">
            <div className="mb-1 flex items-baseline justify-between font-mono text-[0.64rem] text-comment">
              <span>context used</span>
              <span>{leadTokens} tok</span>
            </div>
            <Gauge tokens={leadTokens} tone="var(--accent)" />
          </div>
        </div>

        {/* subagent panel */}
        <div className="rounded border border-border bg-surface-2 p-3">
          <div className="flex items-baseline justify-between">
            <span className="font-mono text-[0.72rem] text-accent">{"// subagent context"}</span>
            <span className="font-mono text-[0.66rem] text-comment">fresh, isolated window</span>
          </div>
          <ul className="mt-2 space-y-1">
            <Turn label="system + prompt string" tok={SUB_BASE} />
            {WORK.slice(0, step).map((w, i) => (
              <Turn key={i} label={`· ${w.label}`} tok={w.tok} />
            ))}
            {step === 0 && <li className="font-mono text-[0.66rem] text-comment">press run: watch it fill</li>}
          </ul>
          <div className="mt-3">
            <div className="mb-1 flex items-baseline justify-between font-mono text-[0.64rem] text-comment">
              <span>context used</span>
              <span>{subTokens} tok</span>
            </div>
            <Gauge tokens={subTokens} tone="var(--accent-dim)" />
          </div>
        </div>
      </div>

      {/* readout: what the boundary did */}
      <div className="mt-3 rounded border border-accent/30 bg-surface p-3 font-mono text-[0.72rem] leading-relaxed">
        {!done ? (
          <p className="text-fg/80">
            The subagent's window fills as it reads and backtracks. The lead's stays flat: none of that has
            crossed the boundary. It never will, except the one thing that returns.
          </p>
        ) : contract === "summary" ? (
          <p className="text-fg/80">
            The distilled result crossed: <span className="text-accent">+{SUMMARY_TOK} tok</span>. The lead holds{" "}
            <span className="text-accent">{leadTokens} tok</span>. The subagent's {SUB_PEAK} tok of reading never
            crossed and is now discarded. Flip to <span className="text-fg">full transcript</span> to watch the
            boundary leak.
          </p>
        ) : (
          <p className="text-fg/80">
            The full transcript crossed: <span className="text-fg">+{SUB_PEAK} tok</span>. The lead now holds{" "}
            <span className="text-fg">{leadTokens} tok</span>, nearly everything the subagent read. You paid the
            tokens twice and the lead's window is polluted. Delegation bought you almost nothing.
          </p>
        )}
      </div>

      <p className="mt-3 font-mono text-[0.7rem] text-comment">
        {done && contract === "transcript"
          ? "// the return channel is a compression boundary. return a summary, not a transcript."
          : "// isolation is the point: the mess stays on the subagent's side."}
      </p>
    </div>
  );
}
