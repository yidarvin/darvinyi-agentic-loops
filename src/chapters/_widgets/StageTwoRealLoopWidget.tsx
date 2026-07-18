import { useState } from "react";

type TraceStep = {
  channel: "plan" | "retry" | "tool" | "result" | "context" | "final";
  title: string;
  transcript: string[];
  explanation: string;
  invariant: string;
  isError?: boolean;
};

const steps: TraceStep[] = [
  {
    channel: "retry",
    title: "A transient request failure stays outside history",
    transcript: [
      "request: 529 overloaded",
      "harness: retry 1 of 3 after bounded backoff + jitter",
      "request: stream resumes",
    ],
    explanation: "The request never produced a completed assistant turn, so the harness retries it once. A malformed request or credential error would stop here for repair instead.",
    invariant: "One layer owns retries. Do not stack an SDK retry loop and an outer retry loop.",
    isError: true,
  },
  {
    channel: "plan",
    title: "The model proposes a bounded plan",
    transcript: [
      "assistant: inspect config, make one exact edit, run a check",
      "tool_use read_01 -> read_file({ path: config.py })",
    ],
    explanation: "Planning belongs to the completed model turn. The harness records it and prepares to dispatch only a valid call.",
    invariant: "The plan is an observation, not a hard-coded workflow.",
  },
  {
    channel: "result",
    title: "A read turns the workspace into ground truth",
    transcript: [
      "tool_result(tool_use_id=read_01): 1  DEBUG = True",
    ],
    explanation: "The model receives line-numbered local state before it changes anything. Read operations are low risk and do not need a write approval.",
    invariant: "The matching result closes read_01 before the next tool call.",
  },
  {
    channel: "tool",
    title: "An exact edit fails cleanly",
    transcript: [
      "tool_use edit_02 -> replace_once(DEBUG = False)",
      "tool: old text was not found",
    ],
    explanation: "The tool does not guess which text the model meant. It names the failed assumption and leaves the file unchanged.",
    invariant: "Validate arguments and workspace paths before execution.",
    isError: true,
  },
  {
    channel: "result",
    title: "The failure re-enters the protocol",
    transcript: [
      "tool_result(tool_use_id=edit_02, is_error=true)",
      "content: old text was not found; read config.py and retry",
    ],
    explanation: "The error carries the original identifier into the following user turn. The model can now correct its premise instead of recovering from a crashed process.",
    invariant: "Every tool_use receives exactly one matching tool_result, including failures and denials.",
    isError: true,
  },
  {
    channel: "plan",
    title: "The next turn changes course",
    transcript: [
      "assistant: reread current value, then use one exact replacement",
      "tool_use read_03 -> read_file({ path: config.py })",
    ],
    explanation: "The model has a concrete corrective action because the harness supplied a useful error. This is the recovery loop in miniature.",
    invariant: "Errors are data for the model, not exceptions for the host process.",
  },
  {
    channel: "result",
    title: "The corrective read closes before editing",
    transcript: [
      "tool_result(tool_use_id=read_03): 1  DEBUG = True",
    ],
    explanation: "The reread result completes the read_03 pair before the model requests another action. The new value is now grounded in the current file.",
    invariant: "Every tool_use receives exactly one matching tool_result before the next tool call.",
  },
  {
    channel: "tool",
    title: "The approved edit executes once",
    transcript: [
      "tool_use edit_04 -> replace_once(DEBUG = True -> DEBUG = False)",
    ],
    explanation: "An exact-one edit protects against silent multi-match changes. A basic permission gate can allow this write in an accept-edits mode.",
    invariant: "Approval changes who may act. It does not create a sandbox.",
  },
  {
    channel: "result",
    title: "The edit returns its matching result",
    transcript: [
      "tool_result(tool_use_id=edit_04): updated config.py",
    ],
    explanation: "The successful edit closes edit_04 before the harness moves to context management or another model turn.",
    invariant: "The identifier survives success and failure paths alike.",
  },
  {
    channel: "context",
    title: "Old bulk leaves the working set",
    transcript: [
      "context: clear stale read_01 body",
      "context: retain tool id, recent result, task state, and next test",
    ],
    explanation: "The earlier file body is re-fetchable. The record that it was read and the current decision are not. Clearing keeps the useful prefix cheaper than compaction.",
    invariant: "Clear and offload before paying for a lossy summary.",
  },
  {
    channel: "tool",
    title: "Verification runs behind a gate",
    transcript: [
      "tool_use check_05 -> run_shell(python3 -c ...)",
    ],
    explanation: "Shell execution gets a timeout, combined output, and a character cap. In a default permission mode this step returns a denial result until a human approves it.",
    invariant: "A timed-out command must terminate its process group and return an error result.",
  },
  {
    channel: "result",
    title: "The focused check returns its result",
    transcript: [
      "tool_result(tool_use_id=check_05): exit 0",
    ],
    explanation: "The shell result closes check_05 before the final assistant response. A denial or interruption would use the same identifier with is_error: true.",
    invariant: "Every dispatched tool call closes with one result, including interrupted work.",
  },
  {
    channel: "final",
    title: "A clean stop returns control",
    transcript: [
      "assistant: config is updated and the check passed",
      "stop_reason: end_turn",
    ],
    explanation: "There is no unresolved tool call and the model completed normally. The harness records the final message, surfaces metrics, and ends the inner loop.",
    invariant: "A missing terminal stream event is an interruption, not an end_turn.",
  },
];

const channelColor: Record<TraceStep["channel"], string> = {
  plan: "var(--accent)",
  retry: "var(--danger)",
  tool: "var(--fg)",
  result: "var(--accent)",
  context: "var(--comment)",
  final: "var(--accent)",
};

export function StageTwoRealLoopWidget() {
  const [step, setStep] = useState(0);
  const current = steps[step]!;
  const atFirst = step === 0;
  const atLast = step === steps.length - 1;

  return (
    <div className="font-sans">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setStep((value) => Math.max(0, value - 1))}
          disabled={atFirst}
          className="rounded border border-border px-3 py-1.5 font-mono text-xs text-fg transition-colors hover:border-accent/50 disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none"
        >
          previous
        </button>
        <button
          type="button"
          onClick={() => setStep((value) => Math.min(steps.length - 1, value + 1))}
          disabled={atLast}
          className="rounded border border-accent/50 bg-accent/10 px-3 py-1.5 font-mono text-xs text-accent transition-colors hover:bg-accent/20 disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none"
        >
          advance event
        </button>
        <button
          type="button"
          onClick={() => setStep(0)}
          disabled={atFirst}
          className="rounded px-2 py-1.5 font-mono text-xs text-comment transition-colors hover:text-fg disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none"
        >
          replay
        </button>
        <span className="ml-auto font-mono text-xs text-comment" aria-live="polite">
          {String(step + 1).padStart(2, "0")} / {String(steps.length).padStart(2, "0")}
        </span>
      </div>

      <div className="mt-4 overflow-hidden rounded-md border border-border bg-bg">
        <div className="border-b border-border px-4 py-3">
          <span
            className="font-mono text-[0.7rem] uppercase tracking-wider"
            style={{ color: channelColor[current.channel] }}
          >
            {current.channel}
          </span>
          <h3 className="mt-1 font-mono text-sm text-fg">{current.title}</h3>
        </div>
        <div className="space-y-2 p-4 font-mono text-xs leading-6 text-fg-muted">
          {steps.slice(0, step + 1).map((entry, index) => (
            <p
              key={entry.channel + "-" + index}
              className={index === step ? "border-l-2 border-accent pl-3 text-fg" : "pl-3 opacity-60"}
              style={entry.isError && index === step ? { borderColor: "var(--danger)" } : undefined}
            >
              <span style={{ color: channelColor[entry.channel] }}>{entry.channel.padEnd(7)}</span>
              {" "}
              {entry.transcript[0]}
            </p>
          ))}
        </div>
      </div>

      <div className="mt-4 rounded-md border border-border bg-surface-2 p-4">
        <div className="space-y-1 border-l border-accent/40 pl-3 font-mono text-xs leading-6 text-fg-muted">
          {current.transcript.map((line, index) => (
            <p key={index}>{line}</p>
          ))}
        </div>
      </div>

      <p className="mt-4 text-sm leading-6 text-fg-muted">{current.explanation}</p>
      <p
        className="mt-3 border-l-2 pl-3 font-mono text-xs leading-5"
        style={{ borderColor: channelColor[current.channel], color: channelColor[current.channel] }}
      >
        {current.invariant}
      </p>
    </div>
  );
}
