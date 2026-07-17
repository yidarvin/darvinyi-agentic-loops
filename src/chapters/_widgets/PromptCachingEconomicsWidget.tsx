import { useState } from "react";

type Boundary = "stable" | "dynamic";
type PricingMode = "ordinary-write" | "premium-write";

const BASE_INPUT_PRICE = 3;
const READ_MULTIPLIER = 0.1;

const pricingModes: Array<{ id: PricingMode; label: string; writeMultiplier: number; detail: string }> = [
  {
    id: "ordinary-write",
    label: "ordinary write",
    writeMultiplier: 1,
    detail: "a miss is billed at the ordinary input rate",
  },
  {
    id: "premium-write",
    label: "1.25x write",
    writeMultiplier: 1.25,
    detail: "a miss pays a cache-creation premium",
  },
];

function money(value: number) {
  return `$${value.toFixed(value < 0.01 ? 5 : 3)}`;
}

function tokens(value: number) {
  return `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}K`;
}

export function PromptCachingEconomicsWidget() {
  const [boundary, setBoundary] = useState<Boundary>("stable");
  const [pricingMode, setPricingMode] = useState<PricingMode>("premium-write");
  const [stablePrefix, setStablePrefix] = useState(6000);
  const [variableTail, setVariableTail] = useState(2000);
  const [turns, setTurns] = useState(8);
  const [hitRate, setHitRate] = useState(85);

  const pricing = pricingModes.find((item) => item.id === pricingMode) ?? pricingModes[0];
  const realizedHitRate = boundary === "stable" ? hitRate / 100 : 0;
  const cacheableTokens = boundary === "stable" ? stablePrefix : stablePrefix + variableTail;
  const cacheReadTokens = cacheableTokens * (turns - 1) * realizedHitRate;
  const cacheWriteTokens = cacheableTokens * (1 + (turns - 1) * (1 - realizedHitRate));
  const uncachedTokens = (stablePrefix + variableTail) * turns;
  const uncachedCost = (uncachedTokens * BASE_INPUT_PRICE) / 1_000_000;
  const cachedCostThroughTurn = (turn: number) => {
    const reads = cacheableTokens * (turn - 1) * realizedHitRate;
    const writes = cacheableTokens * (1 + (turn - 1) * (1 - realizedHitRate));
    const variableTokens = boundary === "stable" ? variableTail * turn : 0;
    return (
      (variableTokens * BASE_INPUT_PRICE) / 1_000_000 +
      (writes * BASE_INPUT_PRICE * pricing.writeMultiplier) / 1_000_000 +
      (reads * BASE_INPUT_PRICE * READ_MULTIPLIER) / 1_000_000
    );
  };
  const cachedCost = cachedCostThroughTurn(turns);
  const savings = uncachedCost - cachedCost;
  const savingsPercent = uncachedCost === 0 ? 0 : (savings / uncachedCost) * 100;

  const curve = Array.from({ length: turns }, (_, index) => {
    const turn = index + 1;
    const uncached = turn * (stablePrefix + variableTail) * BASE_INPUT_PRICE / 1_000_000;
    return { turn, uncached, cached: cachedCostThroughTurn(turn) };
  });
  const maxCurveValue = Math.max(...curve.flatMap((point) => [point.uncached, point.cached]));

  const boundaryMessage =
    boundary === "stable"
      ? "The prefix ends before the varying tail, so later requests can read it from cache."
      : "The dynamic tail sits inside the cacheable prefix, so every turn writes a distinct prefix and the hit-rate slider is ignored.";

  return (
    <div className="font-sans">
      <div className="rounded border border-border bg-surface-2 p-3 font-mono text-xs leading-relaxed text-muted">
        <span className="text-fg/90">system + tools + stable reference</span>
        <span className="mx-2 text-accent">→</span>
        <span className="text-fg/90">cache seam</span>
        <span className="mx-2 text-accent">→</span>
        retrieved memory + latest turn
      </div>

      <fieldset className="mt-5">
        <legend className="font-mono text-[0.7rem] text-muted">// place the cache boundary</legend>
        <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Choose cache boundary placement">
          <button
            type="button"
            onClick={() => setBoundary("stable")}
            aria-pressed={boundary === "stable"}
            className={`rounded border px-3 py-1.5 font-mono text-xs transition-colors motion-reduce:transition-none ${
              boundary === "stable"
                ? "border-accent/50 bg-accent/15 text-accent"
                : "border-border text-muted hover:border-accent/30 hover:text-fg"
            }`}
          >
            after stable prefix
          </button>
          <button
            type="button"
            onClick={() => setBoundary("dynamic")}
            aria-pressed={boundary === "dynamic"}
            className={`rounded border px-3 py-1.5 font-mono text-xs transition-colors motion-reduce:transition-none ${
              boundary === "dynamic"
                ? "border-danger/60 bg-danger/10 text-danger"
                : "border-border text-muted hover:border-danger/50 hover:text-fg"
            }`}
          >
            after dynamic tail
          </button>
        </div>
      </fieldset>

      <div className="mt-5 grid gap-x-6 gap-y-4 sm:grid-cols-2">
        <RangeControl
          id="cache-stable-prefix"
          label="stable prefix"
          value={stablePrefix}
          min={1000}
          max={20000}
          step={1000}
          valueLabel={tokens(stablePrefix)}
          onChange={setStablePrefix}
        />
        <RangeControl
          id="cache-variable-tail"
          label="variable tail / turn"
          value={variableTail}
          min={500}
          max={8000}
          step={500}
          valueLabel={tokens(variableTail)}
          onChange={setVariableTail}
        />
        <RangeControl
          id="cache-turns"
          label="agent turns"
          value={turns}
          min={2}
          max={20}
          step={1}
          valueLabel={String(turns)}
          onChange={setTurns}
        />
        <RangeControl
          id="cache-hit-rate"
          label="realized hit rate"
          value={hitRate}
          min={0}
          max={100}
          step={5}
          valueLabel={boundary === "stable" ? `${hitRate}%` : "forced to 0%"}
          onChange={setHitRate}
          disabled={boundary === "dynamic"}
        />
      </div>

      <fieldset className="mt-5">
        <legend className="font-mono text-[0.7rem] text-muted">// cache-write terms</legend>
        <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Choose cache write pricing">
          {pricingModes.map((item) => {
            const selected = item.id === pricing.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setPricingMode(item.id)}
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
        <p className="mt-2 font-mono text-[0.7rem] text-muted">// {pricing.detail}; reads modelled at 0.1x input</p>
      </fieldset>

      <div className="mt-5 grid gap-3 sm:grid-cols-3" aria-live="polite">
        <Metric label="uncached input" value={money(uncachedCost)} detail={`${tokens(uncachedTokens)} token-equivalents`} />
        <Metric
          label="cache-aware input"
          value={money(cachedCost)}
          detail={`${tokens(cacheReadTokens)} read · ${tokens(cacheWriteTokens)} write`}
          accent
        />
        <Metric
          label={savings >= 0 ? "input saving" : "input overhead"}
          value={`${savings >= 0 ? "" : "-"}${Math.abs(savingsPercent).toFixed(0)}%`}
          detail={savings >= 0 ? `${money(savings)} across ${turns} turns` : `${money(Math.abs(savings))} above uncached`}
          danger={savings < 0}
        />
      </div>

      <section className="mt-5 rounded border border-border bg-surface-2 p-4" aria-label="Cost curve by agent turn">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <p className="font-mono text-[0.7rem] uppercase tracking-wide text-muted">cumulative input cost through turn</p>
          <p className="font-mono text-[0.7rem] text-muted">example base input price: ${BASE_INPUT_PRICE.toFixed(2)}/M</p>
        </div>
        <div className="mt-3 space-y-2">
          {curve.map((point) => (
            <div key={point.turn} className="grid grid-cols-[2.5rem_1fr_auto] items-center gap-2 font-mono text-[0.7rem]">
              <span className="text-muted">t_{point.turn}</span>
              <div className="space-y-1" aria-label={`Cumulative input cost through turn ${point.turn}`}>
                <div className="h-1.5 overflow-hidden rounded bg-border">
                  <div className="h-full rounded bg-fg-muted/70" style={{ width: `${(point.uncached / maxCurveValue) * 100}%` }} />
                </div>
                <div className="h-1.5 overflow-hidden rounded bg-border">
                  <div
                    className={`h-full rounded ${savings >= 0 ? "bg-accent" : "bg-danger"}`}
                    style={{ width: `${(point.cached / maxCurveValue) * 100}%` }}
                  />
                </div>
              </div>
              <span className="text-muted">
                {money(point.uncached)} <span className="text-muted">/</span> {money(point.cached)}
              </span>
            </div>
          ))}
        </div>
        <p className="mt-3 font-mono text-[0.7rem] leading-relaxed text-muted">
          <span className="text-fg-muted">upper bar</span> uncached <span className="mx-1 text-accent">/</span>
          <span className={savings >= 0 ? "text-accent" : "text-danger"}>lower bar</span> cache-aware
        </p>
      </section>

      <p className="mt-4 rounded border border-accent/25 bg-surface p-3 font-mono text-xs leading-relaxed text-fg/90">
        <span className="text-accent">// </span>
        {boundaryMessage}
      </p>
    </div>
  );
}

function RangeControl({
  id,
  label,
  value,
  min,
  max,
  step,
  valueLabel,
  onChange,
  disabled = false,
}: {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  valueLabel: string;
  onChange: (value: number) => void;
  disabled?: boolean;
}) {
  return (
    <label htmlFor={id} className={`block ${disabled ? "opacity-50" : ""}`}>
      <span className="flex items-baseline justify-between gap-3 font-mono text-[0.7rem] text-muted">
        <span>{label}</span>
        <output htmlFor={id} className="text-accent">
          {valueLabel}
        </output>
      </span>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        disabled={disabled}
        className="mt-2 w-full accent-accent disabled:cursor-not-allowed"
      />
    </label>
  );
}

function Metric({
  label,
  value,
  detail,
  accent = false,
  danger = false,
}: {
  label: string;
  value: string;
  detail: string;
  accent?: boolean;
  danger?: boolean;
}) {
  const valueColor = danger ? "text-danger" : accent ? "text-accent" : "text-fg";
  return (
    <section className="rounded border border-border bg-surface-2 p-3">
      <p className="font-mono text-[0.7rem] uppercase tracking-wide text-muted">{label}</p>
      <p className={`mt-1 font-mono text-lg ${valueColor}`}>{value}</p>
      <p className="mt-1 font-mono text-[0.7rem] leading-relaxed text-muted">{detail}</p>
    </section>
  );
}
