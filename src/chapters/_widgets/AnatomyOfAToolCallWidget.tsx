import { useState } from "react";

// AnatomyOfAToolCallWidget: the signature widget for "Anatomy of a Tool Call".
// One focused move: hold a single tool-use exchange fixed and change the level you
// view it at. rendered -> blocks -> tokens walks down the abstraction ladder, from
// the friendly card a chat client shows a human, to the typed JSON your harness
// sends and receives, to the (illustrative) token stream the model actually
// generates and consumes. The correlation id is highlighted in the two machine-facing
// views (blocks and tokens); the friendly rendered card drops it, which is what makes
// it lossy. It is the one handle that links a call to its result. React state only,
// no persistence. The token view is labeled illustrative because the real
// serialization template is provider-controlled and undocumented.

type Level = "rendered" | "blocks" | "tokens";

const TOOL_USE_ID = "toolu_01H8x2Qm7Rd";
const ASSISTANT_TEXT = "I'll read sample.txt to see what's inside.";
const RESULT = "the loop is the primitive.\nthe model is stateless.\nthe harness owns termination.";

const LEVELS: { id: Level; label: string; note: string }[] = [
  { id: "rendered", label: "rendered", note: "what a chat client shows a human. Friendly and lossy." },
  { id: "blocks", label: "blocks", note: "the typed JSON your harness sends and receives. The id links call to result." },
  { id: "tokens", label: "tokens", note: "what the model generates and consumes. A learned format, not a separate channel." },
];

// The typed blocks, as your SDK hands them to you.
const CALL_BLOCKS = `// assistant turn  (stop_reason: "tool_use")
[
  { "type": "text", "text": "${ASSISTANT_TEXT}" },
  {
    "type": "tool_use",
    "id": "${TOOL_USE_ID}",
    "name": "read_file",
    "input": { "path": "sample.txt" }
  }
]`;

const RESULT_BLOCKS = `// user turn  (your harness sends this back, verbatim id)
[
  {
    "type": "tool_result",
    "tool_use_id": "${TOOL_USE_ID}",
    "content": "the loop is the primitive.\\nthe model is stateless.\\n..."
  }
]`;

// The same exchange as an illustrative token stream. Real delimiter tokens are
// provider-controlled; this shows the shape, not the exact bytes.
const CALL_TOKENS = `...<|assistant|>${ASSISTANT_TEXT}<|tool_use|>
{"name":"read_file","input":{"path":"sample.txt"}}<|/tool_use|>`;

const RESULT_TOKENS = `<|tool_result id=${TOOL_USE_ID}|>
the loop is the primitive.
the model is stateless.
...<|/tool_result|>`;

// Highlight the correlation id wherever it appears in a code pane.
function withId(text: string) {
  const parts = text.split(TOOL_USE_ID);
  return parts.flatMap((part, i) =>
    i === 0
      ? [<span key={`p${i}`}>{part}</span>]
      : [
          <span key={`id${i}`} className="text-accent">{TOOL_USE_ID}</span>,
          <span key={`p${i}`}>{part}</span>,
        ],
  );
}

function CodePane({ text }: { text: string }) {
  return (
    <pre className="overflow-x-auto rounded border border-border bg-surface-2 p-3 font-mono text-xs leading-relaxed text-fg/90">
      {withId(text)}
    </pre>
  );
}

function RenderedCall() {
  return (
    <div className="rounded border border-border bg-surface-2 p-3 font-sans text-sm">
      <div className="font-mono text-[0.7rem] uppercase tracking-wider text-comment">tool request</div>
      <p className="mt-1 text-fg/90">
        Claude wants to run <span className="font-mono text-accent">read_file</span> with{" "}
        <span className="font-mono text-fg">path = "sample.txt"</span>.
      </p>
      <div className="mt-2 flex gap-2 font-mono text-xs text-comment">
        <span className="rounded border border-border px-2 py-0.5">Allow</span>
        <span className="rounded border border-border px-2 py-0.5">Deny</span>
      </div>
    </div>
  );
}

function RenderedResult() {
  return (
    <div className="rounded border border-border bg-surface-2 p-3 font-sans text-sm">
      <div className="font-mono text-[0.7rem] uppercase tracking-wider text-comment">result</div>
      <p className="mt-1 font-mono text-xs text-muted">read_file returned 3 lines:</p>
      <blockquote className="mt-1 border-l-2 border-border pl-3 font-mono text-xs text-fg/80">
        {RESULT.split("\n").map((line, i) => (
          <div key={i}>{line}</div>
        ))}
      </blockquote>
    </div>
  );
}

export function AnatomyOfAToolCallWidget() {
  const [level, setLevel] = useState<Level>("rendered");
  const active = LEVELS.find((l) => l.id === level)!;

  return (
    <div className="font-sans">
      {/* the one control: change the representation level */}
      <div
        role="group"
        aria-label="representation level"
        className="inline-flex rounded border border-border p-0.5 font-mono text-xs"
      >
        {LEVELS.map((l) => (
          <button
            key={l.id}
            onClick={() => setLevel(l.id)}
            aria-pressed={level === l.id}
            className={`rounded px-3 py-1.5 transition-colors motion-reduce:transition-none ${
              level === l.id
                ? "bg-accent/15 text-accent"
                : "text-muted hover:text-fg"
            }`}
          >
            {l.label}
          </button>
        ))}
      </div>

      <p aria-live="polite" className="mt-3 min-h-[2.5rem] font-mono text-xs leading-relaxed text-fg/90">
        <span className="text-accent">{active.label}</span>
        <span className="text-comment">{" -> "}</span>
        {active.note}
      </p>

      {/* the same exchange, redrawn at the chosen level: request then result */}
      <div className="mt-2 space-y-3">
        <div>
          <div className="mb-1 font-mono text-[0.7rem] text-comment">the call the model emits</div>
          {level === "rendered" && <RenderedCall />}
          {level === "blocks" && <CodePane text={CALL_BLOCKS} />}
          {level === "tokens" && <CodePane text={CALL_TOKENS} />}
        </div>
        <div>
          <div className="mb-1 font-mono text-[0.7rem] text-comment">the result your harness returns</div>
          {level === "rendered" && <RenderedResult />}
          {level === "blocks" && <CodePane text={RESULT_BLOCKS} />}
          {level === "tokens" && <CodePane text={RESULT_TOKENS} />}
        </div>
      </div>

      <p className="mt-4 font-mono text-[0.7rem] leading-relaxed text-comment">
        {"// same call, three views, descending from human to model-native."}
        {level === "tokens" && " token delimiters here are illustrative; the real template is provider-controlled."}
      </p>
    </div>
  );
}
