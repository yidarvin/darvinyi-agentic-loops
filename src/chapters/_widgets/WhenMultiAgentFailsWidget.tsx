import { useState } from "react";

type Category = "FC1" | "FC2" | "FC3";

type Failure = {
  id: string;
  category: Category;
  label: string;
  name: string;
  prevalence: string;
  signal: string;
  mitigation: string;
};

const categories: Record<Category, { name: string; prevalence: string }> = {
  FC1: { name: "Specification and system design", prevalence: "44.2%" },
  FC2: { name: "Inter-agent misalignment", prevalence: "32.3%" },
  FC3: { name: "Task verification and termination", prevalence: "23.5%" },
};

const failures: Failure[] = [
  {
    id: "task-specification",
    category: "FC1",
    label: "The task requirement is ignored",
    name: "Disobey task specification",
    prevalence: "11.8%",
    signal: "The output looks polished but violates an explicit acceptance criterion.",
    mitigation: "Turn acceptance criteria into a preflight contract and an objective-level check.",
  },
  {
    id: "role-specification",
    category: "FC1",
    label: "A role acts outside its boundary",
    name: "Disobey role specification",
    prevalence: "1.5%",
    signal: "Two agents believe they own the same decision, or nobody owns it.",
    mitigation: "Name one decision owner, require structured outputs, and reject out-of-role actions.",
  },
  {
    id: "step-repetition",
    category: "FC1",
    label: "The same action repeats",
    name: "Step repetition",
    prevalence: "15.7%",
    signal: "A retry replays the same input after a discriminating failure signal.",
    mitigation: "Allow a retry only when new evidence changes the plan; enforce idempotency and a cap.",
  },
  {
    id: "history-loss",
    category: "FC1",
    label: "A prior decision disappears",
    name: "Loss of conversation history",
    prevalence: "2.8%",
    signal: "A later agent revisits a settled constraint because the decision was not durable.",
    mitigation: "Share the relevant trace and maintain a compact, source-linked decision ledger.",
  },
  {
    id: "termination-unaware",
    category: "FC1",
    label: "The run does not know when to stop",
    name: "Unaware of termination conditions",
    prevalence: "12.4%",
    signal: "The system keeps exploring after success or retries until cost becomes the stop rule.",
    mitigation: "Encode a goal predicate, maximum iterations, retry budget, and cost ceiling.",
  },
  {
    id: "conversation-reset",
    category: "FC2",
    label: "A handoff resets the conversation",
    name: "Conversation reset",
    prevalence: "2.2%",
    signal: "The recipient acts as if the work has just started.",
    mitigation: "Pass a bounded state object or full trace reference, not an unstructured status sentence.",
  },
  {
    id: "clarification",
    category: "FC2",
    label: "The agent guesses instead of asking",
    name: "Fail to ask for clarification",
    prevalence: "6.8%",
    signal: "A missing dependency is silently replaced with an assumption.",
    mitigation: "Make uncertainty an explicit return state and route it to a named resolver.",
  },
  {
    id: "derailment",
    category: "FC2",
    label: "Work drifts from the assigned task",
    name: "Task derailment",
    prevalence: "7.4%",
    signal: "The trace accumulates activity that no longer advances the declared objective.",
    mitigation: "Attach each action to a task id and have the coordinator reject unsupported branches.",
  },
  {
    id: "withholding",
    category: "FC2",
    label: "A worker has the fact but omits it",
    name: "Information withholding",
    prevalence: "0.85%",
    signal: "The needed fact exists in one trace but never reaches its decision owner.",
    mitigation: "Require findings with provenance and make critical facts visible to the next owner.",
  },
  {
    id: "ignored-input",
    category: "FC2",
    label: "A handoff is ignored",
    name: "Ignored other agent's input",
    prevalence: "1.9%",
    signal: "A recipient receives a constraint, then selects an action that contradicts it.",
    mitigation: "Record acknowledgement and the decision derived from each required handoff.",
  },
  {
    id: "reasoning-action",
    category: "FC2",
    label: "The action contradicts the stated plan",
    name: "Reasoning-action mismatch",
    prevalence: "13.2%",
    signal: "The explanation names one route while the tool call takes another.",
    mitigation: "Bind tool arguments to the approved plan and validate them before execution.",
  },
  {
    id: "premature-termination",
    category: "FC3",
    label: "The run ends before the task is complete",
    name: "Premature termination",
    prevalence: "6.2%",
    signal: "A worker reports progress and the coordinator treats it as outcome evidence.",
    mitigation: "Separate progress signals from success and test the external objective before exit.",
  },
  {
    id: "incomplete-verification",
    category: "FC3",
    label: "Verification is absent or shallow",
    name: "No or incomplete verification",
    prevalence: "8.2%",
    signal: "The run checks that a command executed but not that the user goal holds.",
    mitigation: "Add a verifier with an objective rubric, independent inputs, and a blocking failure path.",
  },
  {
    id: "incorrect-verification",
    category: "FC3",
    label: "The verifier proves the wrong thing",
    name: "Incorrect verification",
    prevalence: "9.1%",
    signal: "A test passes while the real contract remains broken.",
    mitigation: "Validate against the user-visible contract, then include adversarial counterexamples.",
  },
];

export function WhenMultiAgentFailsWidget() {
  const [selectedId, setSelectedId] = useState("step-repetition");
  const selected = failures.find((failure) => failure.id === selectedId) ?? failures[0];
  const category = categories[selected.category];

  return (
    <div className="space-y-4 font-sans">
      <p className="text-sm leading-relaxed text-fg/90">
        Select the trace symptom you can actually observe. The diagnosis names the MAST failure mode,
        then converts it into a control-plane change.
      </p>

      <div className="grid gap-2 sm:grid-cols-2" role="group" aria-label="Observed multi-agent failure symptoms">
        {failures.map((failure) => {
          const isSelected = failure.id === selected.id;
          return (
            <button
              key={failure.id}
              type="button"
              aria-pressed={isSelected}
              onClick={() => setSelectedId(failure.id)}
              className={`rounded-md border p-3 text-left transition-colors focus:outline-none focus:ring-2 focus:ring-accent ${
                isSelected
                  ? "border-accent bg-accent/10"
                  : "border-border bg-surface-2 hover:border-accent/50"
              }`}
            >
              <span className="block font-mono text-[0.7rem] text-accent">{failure.category}</span>
              <span className="mt-1 block text-sm leading-snug text-fg">{failure.label}</span>
            </button>
          );
        })}
      </div>

      <section className="rounded-md border border-border bg-surface-2 p-4" aria-live="polite">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <p className="font-mono text-xs text-accent">{`// ${selected.category}: ${category.name}`}</p>
          <p className="font-mono text-xs text-comment">{`${category.prevalence} category prevalence in MAST-Data`}</p>
        </div>
        <h3 className="mt-3 font-mono text-sm text-fg">{selected.name}</h3>
        <p className="mt-2 text-sm leading-relaxed text-fg/90">
          <span className="font-mono text-xs text-comment">signal: </span>
          {selected.signal}
        </p>
        <p className="mt-3 text-sm leading-relaxed text-fg/90">
          <span className="font-mono text-xs text-accent">mitigation: </span>
          {selected.mitigation}
        </p>
        <p className="mt-3 font-mono text-xs text-comment">{`MAST trace prevalence for this mode: ${selected.prevalence}`}</p>
      </section>
    </div>
  );
}
