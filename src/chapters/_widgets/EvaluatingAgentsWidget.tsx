import { useMemo, useState } from "react";

type Verdict = "pass" | "fail";

type Trial = {
  verdict: Verdict;
  steps: number;
  cost: number;
  tag?: string;
  note: string;
};

type EvalTask = {
  id: string;
  title: string;
  grader: string;
  trials: Trial[];
};

const suite: EvalTask[] = [
  {
    id: "patch",
    title: "Patch with tests",
    grader: "final state + test suite",
    trials: [
      { verdict: "pass", steps: 5, cost: 0.09, note: "Target test and regression suite passed." },
      { verdict: "pass", steps: 4, cost: 0.07, note: "Applied the same repair with fewer tool calls." },
      { verdict: "pass", steps: 5, cost: 0.08, note: "Verified the patch before stopping." },
    ],
  },
  {
    id: "boundary",
    title: "Preserve a boundary",
    grader: "final state + protected file",
    trials: [
      { verdict: "pass", steps: 4, cost: 0.06, note: "Changed the target file and preserved the protected file." },
      { verdict: "pass", steps: 5, cost: 0.08, note: "The constraint check remained green." },
      { verdict: "pass", steps: 4, cost: 0.06, note: "No prohibited action appeared in the trace." },
    ],
  },
  {
    id: "verification",
    title: "Verify before stop",
    grader: "outcome + verification trace",
    trials: [
      { verdict: "pass", steps: 6, cost: 0.1, note: "The agent ran the required verification." },
      {
        verdict: "fail",
        steps: 3,
        cost: 0.05,
        tag: "verification_miss",
        note: "The patch looked plausible, but the agent stopped before verification.",
      },
      { verdict: "pass", steps: 6, cost: 0.11, note: "A later trial completed the verification loop." },
    ],
  },
  {
    id: "tool",
    title: "Use the tool contract",
    grader: "final state + parameter check",
    trials: [
      {
        verdict: "fail",
        steps: 4,
        cost: 0.07,
        tag: "invalid_arguments",
        note: "The tool call used an unsupported mode and produced the wrong final state.",
      },
      { verdict: "pass", steps: 5, cost: 0.09, note: "The correct arguments produced the expected state." },
      { verdict: "pass", steps: 5, cost: 0.08, note: "The agent repeated the valid tool contract." },
    ],
  },
];

const MAX_RUNS = suite[0].trials.length;

function asPercent(value: number): string {
  return Math.round(value * 100) + "%";
}

function money(value: number): string {
  return "$" + value.toFixed(2);
}

export function EvaluatingAgentsWidget() {
  const [runs, setRuns] = useState(0);
  const [selectedId, setSelectedId] = useState(suite[0].id);

  const selectedTask = suite.find((task) => task.id === selectedId) ?? suite[0];
  const selectedTrials = selectedTask.trials.slice(0, runs);

  const summary = useMemo(() => {
    if (runs === 0) {
      return null;
    }

    const attempts = suite.flatMap((task) => task.trials.slice(0, runs));
    const passAtK = suite.filter((task) => task.trials.slice(0, runs).some((trial) => trial.verdict === "pass")).length;
    const passToK = suite.filter((task) => task.trials.slice(0, runs).every((trial) => trial.verdict === "pass")).length;
    const averageCost = attempts.reduce((total, trial) => total + trial.cost, 0) / attempts.length;
    const averageSteps = attempts.reduce((total, trial) => total + trial.steps, 0) / attempts.length;

    return {
      passAtK: passAtK / suite.length,
      passToK: passToK / suite.length,
      averageCost,
      averageSteps,
    };
  }, [runs]);

  const runNext = () => {
    setRuns((current) => Math.min(current + 1, MAX_RUNS));
  };

  return (
    <div className="font-sans">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
        <div>
          <p className="font-mono text-xs text-comment">{"// illustrative_local_suite"}</p>
          <p className="mt-1 text-sm text-fg">Each click runs one fresh trial for all four tasks.</p>
        </div>
        <div className="flex items-center gap-2">
          {runs > 0 && (
            <button
              type="button"
              onClick={() => setRuns(0)}
              className="rounded border border-border px-3 py-1.5 font-mono text-xs text-fg-muted transition-colors hover:border-accent/50 hover:text-fg"
            >
              reset
            </button>
          )}
          <button
            type="button"
            onClick={runNext}
            disabled={runs === MAX_RUNS}
            className="rounded border border-accent/50 bg-accent/10 px-3 py-1.5 font-mono text-xs text-accent transition-colors hover:bg-accent/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {runs === MAX_RUNS ? "suite complete" : "run trial " + (runs + 1)}
          </button>
        </div>
      </div>

      {summary ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-4" aria-live="polite">
          <Metric label={"pass@" + runs} value={asPercent(summary.passAtK)} detail="one success is enough" />
          <Metric label={"pass^" + runs} value={asPercent(summary.passToK)} detail="every trial must pass" />
          <Metric label="mean cost" value={money(summary.averageCost)} detail="per task trial" />
          <Metric label="mean steps" value={summary.averageSteps.toFixed(1)} detail="per task trial" />
        </div>
      ) : (
        <p className="mt-4 rounded border border-border bg-surface-2 p-3 font-mono text-xs text-fg-muted">
          Run the first trial to create evidence. A score without repeated attempts cannot describe reliability.
        </p>
      )}

      <div className="mt-5 grid gap-2 sm:grid-cols-2">
        {suite.map((task) => {
          const visibleTrials = task.trials.slice(0, runs);
          const latest = visibleTrials[visibleTrials.length - 1];
          const isSelected = task.id === selectedId;
          return (
            <button
              key={task.id}
              type="button"
              aria-pressed={isSelected}
              onClick={() => setSelectedId(task.id)}
              className="rounded border p-3 text-left transition-colors hover:border-accent/50"
              style={{ borderColor: isSelected ? "var(--accent)" : "var(--border)" }}
            >
              <span className="block font-mono text-xs text-fg">{task.title}</span>
              <span className="mt-1 block font-mono text-[0.7rem] text-comment">{task.grader}</span>
              {latest ? (
                <span
                  className="mt-2 block font-mono text-xs"
                  style={{ color: latest.verdict === "pass" ? "var(--accent)" : "var(--danger)" }}
                >
                  {latest.verdict === "pass" ? "pass" : "fail"} {" / "} {latest.tag ?? "evidence recorded"}
                </span>
              ) : (
                <span className="mt-2 block font-mono text-xs text-fg-muted">pending</span>
              )}
            </button>
          );
        })}
      </div>

      <section className="mt-5 rounded border border-border bg-surface-2 p-4" aria-label="Selected task trace">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <p className="font-mono text-xs text-accent">{"// task_trace"}</p>
            <h3 className="mt-1 font-mono text-sm text-fg">{selectedTask.title}</h3>
          </div>
          <span className="font-mono text-[0.7rem] text-comment">{selectedTask.grader}</span>
        </div>

        {selectedTrials.length > 0 ? (
          <ol className="mt-3 space-y-2">
            {selectedTrials.map((trial, index) => (
              <li key={index} className="flex items-start gap-3 border-t border-border pt-2 first:border-t-0 first:pt-0">
                <span className="font-mono text-xs text-comment">{"0" + (index + 1)}</span>
                <div className="min-w-0 flex-1">
                  <p
                    className="font-mono text-xs"
                    style={{ color: trial.verdict === "pass" ? "var(--accent)" : "var(--danger)" }}
                  >
                    {trial.verdict} {" / "} {trial.tag ?? "outcome_and_trajectory_clear"}
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-fg-muted">{trial.note}</p>
                </div>
                <span className="whitespace-nowrap font-mono text-[0.7rem] text-comment">
                  {trial.steps} steps {" / "} {money(trial.cost)}
                </span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="mt-3 font-mono text-xs text-fg-muted">Select a run first. The trace is evidence, not decoration.</p>
        )}
      </section>
    </div>
  );
}

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded border border-border bg-surface-2 p-3">
      <p className="font-mono text-[0.7rem] text-comment">{label}</p>
      <p className="mt-1 font-mono text-lg text-accent">{value}</p>
      <p className="mt-1 font-mono text-[0.7rem] text-fg-muted">{detail}</p>
    </div>
  );
}
