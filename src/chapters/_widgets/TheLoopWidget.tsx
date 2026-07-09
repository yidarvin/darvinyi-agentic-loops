import { Fragment, useState } from "react";

// TheLoopWidget: the signature widget for "The Loop".
// One focused move: step the loop one phase at a time and watch two things at once.
// The phase ring cycles perceive -> decide -> act -> observe, and the message list
// grows only on decide (the assistant turn) and observe (the tool_result). React
// state only, no persistence. The trajectory below is a fixed, canned run so the
// reader can step it deterministically without a model or a key. The line count it
// reports (222) mirrors the real output of artifacts/ch01-the-loop/loop.py.

type Phase = "perceive" | "decide" | "act" | "observe" | "halt";

interface Msg {
  role: "system" | "user" | "assistant";
  tag: string;
  body: string;
}

interface Step {
  turn: number;
  phase: Phase;
  note: string;
  append?: Msg;
}

const SEED: Msg[] = [
  { role: "system", tag: "system", body: "coding agent / tools: list_files, count_lines" },
  { role: "user", tag: "task", body: "how many lines are in loop.py?" },
];

const STEPS: Step[] = [
  { turn: 1, phase: "perceive", note: "assemble the 2 messages + tool schemas into one prompt" },
  {
    turn: 1,
    phase: "decide",
    note: "one forward pass -> text + tool_use(list_files)",
    append: { role: "assistant", tag: "assistant / tool_use", body: 'list_files({ glob: "*.py" })' },
  },
  { turn: 1, phase: "act", note: "the harness runs list_files -> [loop.py]" },
  {
    turn: 1,
    phase: "observe",
    note: "append the result; it is context now",
    append: { role: "user", tag: "tool_result", body: "[loop.py]" },
  },
  { turn: 2, phase: "perceive", note: "assemble the 4 messages" },
  {
    turn: 2,
    phase: "decide",
    note: "forward pass -> tool_use(count_lines)",
    append: { role: "assistant", tag: "assistant / tool_use", body: 'count_lines({ path: "loop.py" })' },
  },
  { turn: 2, phase: "act", note: "the harness runs count_lines -> 222" },
  {
    turn: 2,
    phase: "observe",
    note: "append the result",
    append: { role: "user", tag: "tool_result", body: "222" },
  },
  { turn: 3, phase: "perceive", note: "assemble the 6 messages" },
  {
    turn: 3,
    phase: "decide",
    note: "forward pass -> end_turn, no tool_use requested",
    append: { role: "assistant", tag: "assistant / text", body: "loop.py has 222 lines." },
  },
  { turn: 3, phase: "halt", note: "stop_reason != tool_use, so the harness exits the loop" },
];

const RING: Phase[] = ["perceive", "decide", "act", "observe"];

function pill(active: boolean): string {
  return active
    ? "border-accent bg-accent/10 text-accent"
    : "border-border text-muted";
}

export function TheLoopWidget() {
  const [cursor, setCursor] = useState(0);
  const done = cursor >= STEPS.length;
  const current = cursor > 0 ? STEPS[cursor - 1] : null;
  const activePhase: Phase | null = current ? current.phase : null;
  const halted = activePhase === "halt";

  const messages: Msg[] = [...SEED];
  let newestIndex = -1;
  for (let i = 0; i < cursor; i += 1) {
    const a = STEPS[i].append;
    if (a) {
      messages.push(a);
      if (i === cursor - 1) newestIndex = messages.length - 1;
    }
  }

  return (
    <div className="font-sans">
      {/* phase ring: the active phase lights up */}
      <div className="flex flex-wrap items-center gap-2 font-mono text-[0.7rem] uppercase tracking-wide">
        {RING.map((p) => (
          <Fragment key={p}>
            <span className={`rounded border px-2 py-1 transition-colors motion-reduce:transition-none ${pill(activePhase === p)}`}>
              {p}
            </span>
            <span className="text-comment">{"->"}</span>
          </Fragment>
        ))}
        <span className={`rounded border px-2 py-1 transition-colors motion-reduce:transition-none ${pill(halted)}`}>
          halt
        </span>
      </div>

      {/* status: what the current phase is doing */}
      <p
        aria-live="polite"
        className="mt-4 min-h-[2.5rem] font-mono text-xs leading-relaxed text-fg/90"
      >
        {current ? (
          <>
            <span className="text-accent">turn {current.turn}</span>
            <span className="text-comment">{" / "}</span>
            <span className="text-accent">{current.phase}</span>
            <span className="text-comment">{" -> "}</span>
            {current.note}
          </>
        ) : (
          <span className="text-comment">{"// press step to turn the loop"}</span>
        )}
      </p>

      {/* the running message list: the agent's working memory */}
      <div className="mt-4 rounded-md border border-border bg-surface-2 p-3">
        <div className="mb-2 flex items-baseline justify-between font-mono text-[0.7rem] text-comment">
          <span>messages[]</span>
          <span>{messages.length} in context</span>
        </div>
        <ol className="space-y-1.5">
          {messages.map((m, i) => (
            <li
              key={i}
              className={`flex flex-col gap-0.5 rounded border-l-2 px-2 py-1 font-mono text-xs sm:flex-row sm:items-baseline sm:gap-3 ${
                i === newestIndex ? "border-accent bg-accent/5" : "border-border/60"
              }`}
            >
              <span className="shrink-0 text-comment sm:w-40">{m.tag}</span>
              <span className="text-fg/90">{m.body}</span>
            </li>
          ))}
        </ol>
      </div>

      {/* controls: one focused move is stepping */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          onClick={() => setCursor((c) => Math.min(c + 1, STEPS.length))}
          disabled={done}
          className="rounded border border-accent/50 bg-accent/10 px-3 py-1.5 font-mono text-xs text-accent transition-colors hover:bg-accent/20 disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none"
        >
          step
        </button>
        <button
          onClick={() => setCursor((c) => Math.max(c - 1, 0))}
          disabled={cursor === 0}
          className="rounded border border-border px-3 py-1.5 font-mono text-xs text-muted transition-colors hover:text-fg disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none"
        >
          back
        </button>
        <button
          onClick={() => setCursor(0)}
          className="rounded border border-border px-3 py-1.5 font-mono text-xs text-muted transition-colors hover:text-fg motion-reduce:transition-none"
        >
          reset
        </button>
        <span className="ml-auto font-mono text-[0.7rem] text-comment">
          {done ? "loop halted" : "loop running"} / step {cursor} of {STEPS.length}
        </span>
      </div>
    </div>
  );
}
