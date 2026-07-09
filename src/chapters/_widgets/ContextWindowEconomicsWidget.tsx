import { useState } from "react";

// ContextWindowEconomicsWidget: the signature widget for "Context-Window Economics".
// One focused move: drag the session forward one turn at a time and watch the budget
// fill. The stacked bar decomposes the window by category (tools + system as a fixed
// prefix, history + tool_results as the growing body, a reserved output buffer, and a
// shrinking free band). Two markers show the ~40% working-context ceiling and the
// auto-compact line. The secondary toggle drops in a heavy MCP toolset so the reader
// sees the fixed prefix eat the budget before turn one. The number that teaches the
// chapter is the cumulative billed input: it climbs quadratically because every turn
// re-sends everything below it, so it outruns the bar. React state only, no persistence.
// All token and cost numbers are illustrative, in the range of the figures in the
// chapter's research doc, not a live measurement.

const WINDOW = 200_000; // a concrete window, in tokens
const SYSTEM = 3_000; // roughly fixed
const TOOLS_BASE = 12_000; // a lean built-in tool set
const TOOLS_MCP = 45_000; // a heavy multi-server MCP setup added on top
const HISTORY_PER_TURN = 1_500; // assistant/user text added per turn
const RESULTS_PER_TURN = 3_000; // tool results: the fastest-growing category
const OUTPUT_BUFFER = 8_000; // reserved for the model's output this turn
const CEILING = 0.4; // ~40% working-context ceiling
const AUTOCOMPACT = 0.835; // where a harness auto-compacts before the window fills
const INPUT_PRICE = 3 / 1_000_000; // Sonnet-class input, $/token
const MAX_TURNS = 40;

function fmtTokens(n: number): string {
  if (Math.abs(n) >= 1000) return `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}K`;
  return `${Math.round(n)}`;
}

function fmtUSD(n: number): string {
  if (n >= 10) return `$${n.toFixed(2)}`;
  if (n >= 1) return `$${n.toFixed(3)}`;
  return `$${n.toFixed(4)}`;
}

interface Cat {
  key: string;
  label: string;
  tokens: number;
  color: string;
  opacity: number;
}

export function ContextWindowEconomicsWidget() {
  const [turns, setTurns] = useState(12);
  const [heavyMcp, setHeavyMcp] = useState(false);

  const tools = TOOLS_BASE + (heavyMcp ? TOOLS_MCP : 0);
  const history = HISTORY_PER_TURN * turns;
  const results = RESULTS_PER_TURN * turns;
  const prefix = SYSTEM + tools;
  const usedInput = prefix + history + results;
  const reserved = OUTPUT_BUFFER;
  const free = Math.max(0, WINDOW - usedInput - reserved);
  const overflow = usedInput + reserved > WINDOW;
  const usedPct = Math.min(100, (usedInput / WINDOW) * 100);

  // cumulative billed input: every turn k re-sends prefix + the tail accumulated by k.
  // sum_{k=1..t} [prefix + incr*k] = prefix*t + incr*t(t+1)/2.  Quadratic in t.
  const incr = HISTORY_PER_TURN + RESULTS_PER_TURN;
  const cumInput = prefix * turns + (incr * turns * (turns + 1)) / 2;
  const costNoCache = cumInput * INPUT_PRICE;
  // cached prefix: pay it in full once, then 10% on every later turn; the growing tail
  // is not cacheable and still dominates a long loop.
  const cachedBilled =
    turns === 0
      ? 0
      : prefix + 0.1 * prefix * (turns - 1) + (incr * turns * (turns + 1)) / 2;
  const costCached = cachedBilled * INPUT_PRICE;

  const cats: Cat[] = [
    { key: "tools", label: "tool defs", tokens: tools, color: "var(--accent-dim)", opacity: 0.7 },
    { key: "system", label: "system", tokens: SYSTEM, color: "var(--accent-dim)", opacity: 0.4 },
    { key: "history", label: "history", tokens: history, color: "var(--accent)", opacity: 0.3 },
    { key: "results", label: "tool_results", tokens: results, color: "var(--accent)", opacity: 0.55 },
    { key: "reserved", label: "output buffer", tokens: reserved, color: "var(--comment)", opacity: 0.35 },
    { key: "free", label: "free", tokens: free, color: "var(--surface-2)", opacity: 1 },
  ];

  return (
    <div className="font-sans">
      {/* the stacked budget bar: the star of the widget */}
      <div className="relative">
        <div className="mb-1 flex items-baseline justify-between font-mono text-[0.7rem] text-comment">
          <span>context window / {fmtTokens(WINDOW)} tokens</span>
          <span className={overflow ? "text-danger" : "text-comment"}>
            {overflow ? "overflow: no room to reason" : `${usedPct.toFixed(0)}% used`}
          </span>
        </div>

        <div className="relative h-14 w-full overflow-hidden rounded border border-border bg-surface-2">
          <div className="flex h-full w-full">
            {cats.map((c) => (
              <div
                key={c.key}
                className="h-full border-r border-border/40 transition-[width] duration-300 motion-reduce:transition-none last:border-r-0"
                style={{
                  width: `${(c.tokens / WINDOW) * 100}%`,
                  backgroundColor: c.color,
                  opacity: c.opacity,
                }}
                title={`${c.label}: ${fmtTokens(c.tokens)}`}
              />
            ))}
          </div>

          {/* ~40% working-context ceiling */}
          <div
            className="pointer-events-none absolute inset-y-0 border-l-2 border-dashed border-danger"
            style={{ left: `${CEILING * 100}%` }}
          />
          {/* auto-compact line */}
          <div
            className="pointer-events-none absolute inset-y-0 border-l border-dashed border-comment"
            style={{ left: `${AUTOCOMPACT * 100}%` }}
          />
        </div>

        <div className="relative mt-1 h-4 font-mono text-[0.65rem]">
          <span className="absolute -translate-x-1/2 text-danger" style={{ left: `${CEILING * 100}%` }}>
            ~40% ceiling
          </span>
          <span
            className="absolute -translate-x-1/2 whitespace-nowrap text-comment"
            style={{ left: `${AUTOCOMPACT * 100}%` }}
          >
            auto-compact
          </span>
        </div>
      </div>

      {/* the legend: per-category token counts */}
      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-xs sm:grid-cols-3">
        {cats.map((c) => (
          <div key={c.key} className="flex items-center gap-2">
            <span
              className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm border border-border"
              style={{ backgroundColor: c.color, opacity: c.opacity }}
            />
            <span className="text-comment">{c.label}</span>
            <span className={`ml-auto ${c.key === "free" && overflow ? "text-danger" : "text-fg/90"}`}>
              {overflow && c.key === "free" ? "0" : fmtTokens(c.tokens)}
            </span>
          </div>
        ))}
      </div>

      {/* controls: drag the session forward (primary), toggle MCP bloat (secondary) */}
      <div className="mt-5 space-y-4">
        <div>
          <label
            htmlFor="cwe-turns"
            className="flex items-baseline justify-between font-mono text-xs text-comment"
          >
            <span>turns elapsed</span>
            <span className="text-accent">{turns}</span>
          </label>
          <input
            id="cwe-turns"
            type="range"
            min={0}
            max={MAX_TURNS}
            value={turns}
            onChange={(e) => setTurns(Number(e.target.value))}
            className="mt-2 w-full accent-accent"
            aria-label="turns elapsed in the session"
          />
        </div>

        <button
          onClick={() => setHeavyMcp((v) => !v)}
          aria-pressed={heavyMcp}
          className={`rounded border px-3 py-1.5 font-mono text-xs transition-colors motion-reduce:transition-none ${
            heavyMcp
              ? "border-accent/50 bg-accent/15 text-accent"
              : "border-border text-muted hover:text-fg"
          }`}
        >
          heavy MCP toolset {heavyMcp ? "on" : "off"} ({fmtTokens(heavyMcp ? TOOLS_MCP : 0)} added)
        </button>
      </div>

      {/* the readout: the quadratic bill is the number that should surprise */}
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="input this turn" value={`${fmtTokens(usedInput)} tok`} />
        <Stat
          label="cumulative billed"
          value={`${fmtTokens(cumInput)} tok`}
          accent
          hint="re-sent every turn"
        />
        <Stat label="cost, no cache" value={fmtUSD(costNoCache)} />
        <Stat label="cost, cached prefix" value={fmtUSD(costCached)} accent />
      </div>

      <p className="mt-4 font-mono text-[0.7rem] leading-relaxed text-comment">
        {"// the bar fills linearly; the bill climbs quadratically. every turn pays for the whole stack again."}
      </p>
    </div>
  );
}

function Stat({
  label,
  value,
  accent = false,
  hint,
}: {
  label: string;
  value: string;
  accent?: boolean;
  hint?: string;
}) {
  return (
    <div className="rounded border border-border bg-surface-2 px-3 py-2">
      <div className="font-mono text-[0.65rem] uppercase tracking-wide text-comment">{label}</div>
      <div className={`mt-0.5 font-mono text-sm ${accent ? "text-accent" : "text-fg/90"}`}>{value}</div>
      {hint && <div className="font-mono text-[0.6rem] text-comment">{hint}</div>}
    </div>
  );
}
