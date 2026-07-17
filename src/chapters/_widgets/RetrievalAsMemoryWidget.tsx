import { useState, type FormEvent } from "react";

type CandidateState = "injected" | "held" | "filtered";

type Candidate = {
  id: string;
  source: string;
  date: string;
  dense: string;
  sparse: string;
  rrf: string;
  rerank: string;
  state: CandidateState;
  detail: string;
};

type Scenario = {
  id: string;
  label: string;
  query: string;
  budget: number;
  packetTokens: number;
  decision: string;
  candidates: Candidate[];
  packet: string[];
};

const scenarios: Scenario[] = [
  {
    id: "identifier",
    label: "identifier",
    query: "Can I deploy checkout after ERR-PAY-142?",
    budget: 120,
    packetTokens: 93,
    decision: "RRF ties the exact incident and current policy; reranking orders the answer-bearing packet",
    candidates: [
      {
        id: "incident_pay_142",
        source: "run/2026-05-28",
        date: "2026-05-28",
        dense: "3",
        sparse: "1",
        rrf: "1 (tie)",
        rerank: "0.96",
        state: "injected",
        detail: "exact identifier rescued by sparse rank; reranker breaks the RRF tie",
      },
      {
        id: "checkout_policy_2026",
        source: "policy/2026-04",
        date: "2026-04-01",
        dense: "1",
        sparse: "3",
        rrf: "1 (tie)",
        rerank: "0.92",
        state: "injected",
        detail: "current approval and migration gate; reranker keeps it second after the tie",
      },
      {
        id: "checkout_telemetry",
        source: "runbook/observability",
        date: "2026-03-12",
        dense: "2",
        sparse: "4",
        rrf: "3",
        rerank: "0.51",
        state: "held",
        detail: "related, but not answer-bearing",
      },
      {
        id: "globex_incident_pay_142",
        source: "other tenant",
        date: "2026-05-29",
        dense: "n/a",
        sparse: "n/a",
        rrf: "filtered",
        rerank: "n/a",
        state: "filtered",
        detail: "tenant filter runs before ranking",
      },
    ],
    packet: [
      "incident_pay_142: retry workers saturated after duplicate suppression changed.",
      "checkout_policy_2026: on-call approval and green migration verification are required.",
    ],
  },
  {
    id: "freshness",
    label: "freshness",
    query: "What approval is required for an Acme checkout deploy in June?",
    budget: 100,
    packetTokens: 72,
    decision: "valid-time filtering removes the superseded policy before similarity can favor it",
    candidates: [
      {
        id: "checkout_policy_2026",
        source: "policy/2026-04",
        date: "valid from 2026-04-01",
        dense: "1",
        sparse: "1",
        rrf: "1",
        rerank: "0.98",
        state: "injected",
        detail: "current at the query time",
      },
      {
        id: "checkout_policy_2025",
        source: "policy/2025-10",
        date: "valid to 2026-03-31",
        dense: "n/a",
        sparse: "n/a",
        rrf: "filtered",
        rerank: "n/a",
        state: "filtered",
        detail: "superseded before the June query",
      },
      {
        id: "checkout_telemetry",
        source: "runbook/observability",
        date: "2026-03-12",
        dense: "2",
        sparse: "3",
        rrf: "2",
        rerank: "0.40",
        state: "held",
        detail: "operationally close, but not a policy",
      },
    ],
    packet: ["checkout_policy_2026: on-call approval and green migration verification are required."],
  },
  {
    id: "paraphrase",
    label: "paraphrase",
    query: "How do we ship a repair without ignoring a recent payment incident?",
    budget: 120,
    packetTokens: 98,
    decision: "dense recall finds paraphrases; reranking joins the incident to the release rule",
    candidates: [
      {
        id: "incident_pay_142",
        source: "run/2026-05-28",
        date: "2026-05-28",
        dense: "1",
        sparse: "3",
        rrf: "1",
        rerank: "0.93",
        state: "injected",
        detail: "episode provides the live constraint",
      },
      {
        id: "checkout_policy_2026",
        source: "policy/2026-04",
        date: "2026-04-01",
        dense: "2",
        sparse: "2",
        rrf: "2",
        rerank: "0.90",
        state: "injected",
        detail: "semantic rule provides the safe action",
      },
      {
        id: "release_calendar",
        source: "calendar/2026-q2",
        date: "2026-05-01",
        dense: "3",
        sparse: "4",
        rrf: "3",
        rerank: "0.43",
        state: "held",
        detail: "timing context is not evidence for approval",
      },
    ],
    packet: [
      "incident_pay_142: retry workers saturated after duplicate suppression changed.",
      "checkout_policy_2026: on-call approval and green migration verification are required.",
    ],
  },
];

const defaultScenario: Scenario = scenarios[0]!;

export function RetrievalAsMemoryWidget() {
  const [query, setQuery] = useState(defaultScenario.query);
  const [activeId, setActiveId] = useState(defaultScenario.id);
  const active = scenarios.find((scenario) => scenario.id === activeId) ?? defaultScenario;
  const packetPercent = Math.min(100, (active.packetTokens / active.budget) * 100);

  function issueQuery(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setActiveId(matchScenario(query));
  }

  return (
    <div className="font-sans">
      <form onSubmit={issueQuery} className="rounded border border-border bg-surface-2 p-4">
        <label htmlFor="retrieval-query" className="font-mono text-xs text-muted">
          // memory.search(query, tenant="acme", as_of="2026-06-15")
        </label>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <input
            id="retrieval-query"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="min-w-0 flex-1 rounded border border-border bg-surface px-3 py-2 font-mono text-xs text-fg outline-none placeholder:text-comment focus:border-accent"
            aria-describedby="retrieval-query-help"
          />
          <button
            type="submit"
            className="rounded border border-accent/50 bg-accent/10 px-3 py-2 font-mono text-xs text-accent transition-colors hover:bg-accent/20 motion-reduce:transition-none"
          >
            inspect read
          </button>
        </div>
        <p id="retrieval-query-help" className="mt-2 font-mono text-xs leading-relaxed text-muted">
          This instructional inspector recognizes the three probes below. Its ranks are deterministic examples, not an embedding benchmark.
        </p>
      </form>

      <fieldset className="mt-4">
        <legend className="font-mono text-xs text-muted">// load a query shape</legend>
        <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Choose a retrieval query shape">
          {scenarios.map((scenario) => {
            const selected = scenario.id === active.id;
            return (
              <button
                key={scenario.id}
                type="button"
                onClick={() => {
                  setQuery(scenario.query);
                  setActiveId(scenario.id);
                }}
                aria-pressed={selected}
                className={`rounded border px-3 py-1.5 font-mono text-xs transition-colors motion-reduce:transition-none ${
                  selected
                    ? "border-accent/50 bg-accent/15 text-accent"
                    : "border-border text-muted hover:border-accent/30 hover:text-fg"
                }`}
              >
                {scenario.label}
              </button>
            );
          })}
        </div>
      </fieldset>

      <section className="mt-5 overflow-hidden rounded border border-border" aria-label="Retrieval candidate inspection" aria-live="polite">
        <div className="border-b border-border bg-surface-2 px-4 py-3">
          <p className="font-mono text-xs text-fg">{active.query}</p>
          <p className="mt-1 font-mono text-xs leading-relaxed text-muted">// {active.decision}</p>
        </div>
        <div className="overflow-x-auto">
          <div className="min-w-[650px]">
            <div className="grid grid-cols-[1.55fr_repeat(4,0.52fr)_1.05fr] gap-x-2 border-b border-border px-4 py-2 font-mono text-xs uppercase tracking-wide text-muted">
              <span>candidate</span>
              <span>dense</span>
              <span>sparse</span>
              <span>rrf</span>
              <span>rerank</span>
              <span>context</span>
            </div>
            {active.candidates.map((candidate) => (
              <div
                key={candidate.id}
                className="grid grid-cols-[1.55fr_repeat(4,0.52fr)_1.05fr] gap-x-2 border-b border-border px-4 py-3 last:border-b-0"
              >
                <div className="min-w-0">
                  <p className="truncate font-mono text-xs text-fg">{candidate.id}</p>
                  <p className="mt-1 font-mono text-xs leading-relaxed text-muted">{candidate.source} · {candidate.date}</p>
                </div>
                <Rank value={candidate.dense} />
                <Rank value={candidate.sparse} />
                <Rank value={candidate.rrf} />
                <Rank value={candidate.rerank} />
                <div>
                  <p className={`font-mono text-xs ${stateClass(candidate.state)}`}>{candidate.state}</p>
                  <p className="mt-1 font-mono text-xs leading-relaxed text-muted">{candidate.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mt-5 rounded border border-accent/25 bg-surface-2 p-4" aria-label="Evidence packet injected into prompt">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <p className="font-mono text-xs uppercase tracking-wide text-muted">evidence packet at prompt tail</p>
          <p className="font-mono text-xs text-accent">{active.packetTokens} / {active.budget} token budget</p>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded bg-border" aria-label={`${active.packetTokens} of ${active.budget} context tokens used`}>
          <div className="h-full rounded bg-accent" style={{ width: `${packetPercent}%` }} />
        </div>
        <ol className="mt-4 space-y-2">
          {active.packet.map((record) => (
            <li key={record} className="rounded border border-border bg-surface px-3 py-2 font-mono text-xs leading-relaxed text-fg/90">
              {record}
            </li>
          ))}
        </ol>
        <pre className="mt-4 overflow-x-auto rounded border border-border bg-surface p-3 font-mono text-xs leading-relaxed text-muted">{`system + tools + stable reference\ncurrent user request\n<retrieved_memory>\n${active.packet.map((record) => `${record}`).join("\n")}\n</retrieved_memory>`}</pre>
      </section>
    </div>
  );
}

function Rank({ value }: { value: string }) {
  return <span className="self-start font-mono text-xs text-fg/90">{value}</span>;
}

function stateClass(state: CandidateState) {
  if (state === "injected") return "text-accent";
  if (state === "filtered") return "text-danger";
  return "text-muted";
}

function matchScenario(query: string) {
  const normalized = query.toLowerCase();
  if (normalized.includes("err-pay-142") || normalized.includes("identifier")) return "identifier";
  if (normalized.includes("june") || normalized.includes("approval") || normalized.includes("fresh")) return "freshness";
  return "paraphrase";
}
