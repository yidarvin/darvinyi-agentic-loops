import { useState } from "react";

type RegimeId = "working" | "episodic" | "semantic" | "procedural" | "combined";

interface Regime {
  id: RegimeId;
  label: string;
  retained: string[];
  consulted: string;
  answer: string;
  missing: string;
}

const regimes: Regime[] = [
  {
    id: "working",
    label: "fresh working state",
    retained: [
      "Active goal: plan dinner after a deployment incident.",
      "Context projection: the current request only.",
    ],
    consulted: "reset working state and its current context projection",
    answer:
      "This new working state has no prior preference or incident. In a continuing run, it could retain goals and tool results across calls.",
    missing: "The session boundary reset active state. Working memory is not limited to one LLM call.",
  },
  {
    id: "episodic",
    label: "episodic",
    retained: [
      "09:10: Mira said, 'I eat vegetarian food.'",
      "16:40: deployment failed after a migration mismatch.",
    ],
    consulted: "dated event records",
    answer: "Mira said she eats vegetarian food, and the prior deploy failed after a migration mismatch.",
    missing: "The trace is available, but it has not become a current profile or release rule.",
  },
  {
    id: "semantic",
    label: "semantic",
    retained: ["Mira preference: vegetarian.", "Release fact: migration verification is required."],
    consulted: "profile and generalized facts",
    answer: "Plan a vegetarian dinner and include migration verification in the release plan.",
    missing: "The raw incident and its chronology are no longer present.",
  },
  {
    id: "procedural",
    label: "procedural",
    retained: ["Explicit release skill: block production deployment until migration verification passes."],
    consulted: "explicit selected skill; weights are not modeled",
    answer: "Run migration verification before the production deployment.",
    missing:
      "The explicit skill changes behavior, but it does not know Mira's preference or explain the incident. Implicit weights would affect every generation without retrieval.",
  },
  {
    id: "combined",
    label: "combined",
    retained: [
      "Episode: Mira's statement and the migration-mismatch incident.",
      "Fact: Mira is vegetarian.",
      "Procedure: verify migrations before production deployment.",
    ],
    consulted: "typed selected records plus an explicit release skill",
    answer: "Plan a vegetarian dinner, cite the migration mismatch if asked, and enforce verification before release.",
    missing: "Nothing relevant is missing, but every retrieved record still spends context budget.",
  },
];

export function MemoryTaxonomyWidget() {
  const [regimeId, setRegimeId] = useState<RegimeId>("working");
  const regime = regimes.find((item) => item.id === regimeId) ?? regimes[0];

  return (
    <div className="font-sans">
      <div className="rounded border border-border bg-surface-2 p-3 font-mono text-xs leading-relaxed text-comment">
        <span className="text-fg/90">prior session</span>
        <span className="mx-2 text-accent">-&gt;</span>
        Mira states a dietary preference. A deployment later fails after a migration mismatch.
        <span className="mx-2 text-accent">-&gt;</span>
        <span className="text-fg/90">new session: active state resets</span>
      </div>

      <div className="mt-4" role="group" aria-label="Select a memory regime">
        <p className="font-mono text-[0.7rem] text-comment">// choose what survives a fresh working-state reset</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {regimes.map((item) => {
            const selected = item.id === regime.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setRegimeId(item.id)}
                aria-pressed={selected}
                className={`rounded border px-3 py-1.5 font-mono text-xs transition-colors motion-reduce:transition-none ${
                  selected
                    ? "border-accent/50 bg-accent/15 text-accent"
                    : "border-border text-muted hover:border-accent/30 hover:text-fg"
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_1.2fr]" aria-live="polite">
        <section className="rounded border border-border bg-surface-2 p-4" aria-label="Retained records">
          <p className="font-mono text-[0.7rem] uppercase tracking-wide text-comment">retained records</p>
          <ul className="mt-3 space-y-2 font-mono text-xs leading-relaxed text-fg/90">
            {regime.retained.map((record) => (
              <li key={record} className="flex gap-2">
                <span className="text-accent">+</span>
                <span>{record}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded border border-accent/30 bg-surface p-4" aria-label="Resulting answer">
          <p className="font-mono text-[0.7rem] uppercase tracking-wide text-comment">new-session question</p>
          <p className="mt-2 font-mono text-xs leading-relaxed text-fg/90">
            plan dinner, explain the incident if needed, and prepare the next release.
          </p>
          <p className="mt-4 font-mono text-[0.7rem] text-fg">consulted: {regime.consulted}</p>
          <p className="mt-1 font-sans text-sm leading-relaxed text-fg">{regime.answer}</p>
          <p className="mt-4 border-t border-border pt-3 font-mono text-[0.7rem] leading-relaxed text-fg">
            {`// ${regime.missing}`}
          </p>
        </section>
      </div>
    </div>
  );
}
