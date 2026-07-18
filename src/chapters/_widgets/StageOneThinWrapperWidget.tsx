import { useState } from "react";

type WalkthroughStep = {
  label: string;
  title: string;
  transcript: string[];
  explanation: string;
  invariant: string;
};

const steps: WalkthroughStep[] = [
  {
    label: "01 / REPL",
    title: "A user request joins history",
    transcript: [
      "you> Fix the failing slug test.",
      'messages += {"role": "user", "content": request}',
    ],
    explanation: "The REPL records the request. It does not choose a file, test command, or edit strategy.",
    invariant: "The model sees this turn together with every earlier retained message.",
  },
  {
    label: "02 / request",
    title: "The wrapper sends history and schemas",
    transcript: [
      "request.messages = messages",
      "request.tools = [read_file, list_files, edit_file, run_bash]",
      "request.system = coding-agent instruction",
    ],
    explanation: "The model receives a complete action vocabulary and the accumulated conversation in one request.",
    invariant: "The harness supplies capabilities. The model selects the next move.",
  },
  {
    label: "03 / assistant",
    title: "The model chooses a test command",
    transcript: [
      'assistant: tool_use call_01 run_bash({"command": "pytest -x"})',
      "messages += assistant.content",
    ],
    explanation: "The assistant block is saved exactly as returned, including call_01.",
    invariant: "Do not reconstruct tool calls by hand. Preserve the identifier that the result must answer.",
  },
  {
    label: "04 / tool result",
    title: "Dispatch returns an observation",
    transcript: [
      "tool: run_bash → exit 1, failing slug assertion",
      'user: tool_result {tool_use_id: "call_01", content: "..."}',
    ],
    explanation: "The wrapper executes the action and returns the failing test output as data for the next model call.",
    invariant: "If several tools were requested, their results belong together in this one following user turn.",
  },
  {
    label: "05 / loop",
    title: "The model can inspect, edit, and verify",
    transcript: [
      "assistant: read_file → edit_file → run_bash",
      "each result appends to messages before the next request",
    ],
    explanation: "The wrapper never hard-codes this sequence. The model adapts to each observation and chooses the next tool.",
    invariant: "A non-unique exact match becomes an error result, not a process crash.",
  },
  {
    label: "06 / exit",
    title: "Text without a tool call ends the turn",
    transcript: [
      "assistant: Updated slugify and the test now passes.",
      "tool_uses = []",
      "REPL waits for the next user request",
    ],
    explanation: "The final response contains no action block, so the wrapper exits the inner loop.",
    invariant: "No tool_use is the termination signal. A stop_reason alone is not enough.",
  },
];

export function StageOneThinWrapperWidget() {
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
          next
        </button>
        <button
          type="button"
          onClick={() => setStep(0)}
          disabled={atFirst}
          className="rounded px-2 py-1.5 font-mono text-xs text-comment transition-colors hover:text-fg disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none"
        >
          reset
        </button>
        <span className="ml-auto font-mono text-xs text-comment" aria-live="polite">
          {current.label}
        </span>
      </div>

      <div className="mt-4 rounded-md border border-border bg-bg p-4">
        <h3 className="font-mono text-sm text-fg">{current.title}</h3>
        <div className="mt-3 space-y-1 border-l border-accent/40 pl-3 font-mono text-xs leading-6 text-fg-muted">
          {current.transcript.map((line, index) => (
            <p key={index}>{line}</p>
          ))}
        </div>
      </div>

      <p className="mt-4 text-sm leading-6 text-fg-muted">{current.explanation}</p>
      <p className="mt-3 border-l-2 border-accent pl-3 font-mono text-xs leading-5 text-accent">
        {current.invariant}
      </p>
      <p className="mt-4 font-mono text-xs text-comment">
        {"// absent here: retries, streaming, compaction, permission gate, sandbox"}
      </p>
    </div>
  );
}
