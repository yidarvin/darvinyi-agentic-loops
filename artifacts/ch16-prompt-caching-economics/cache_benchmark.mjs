#!/usr/bin/env node

/*
 * Cache-layout benchmark
 *
 * The workload is held constant while one non-semantic namespace field moves:
 *
 *   cache-friendly: static namespace + stable prefix + dynamic user tail
 *   cache-breaking: dynamic nonce + stable prefix + dynamic user tail
 *
 * Live mode is a DeepSeek Chat Completions product example because its response
 * reports prompt_cache_hit_tokens and prompt_cache_miss_tokens. The benchmark's
 * cache-boundary design applies to any provider with prefix caching.
 */

const DEFAULTS = {
  mode: "simulate",
  trials: 6,
  prefixWords: 1200,
  tailWords: 80,
  maxOutputTokens: 8,
  model: "deepseek-v4-flash",
  baseUrl: "https://api.deepseek.com",
  inputPrice: 0.14,
  cachedInputPrice: 0.0028,
  json: false,
  help: false,
};

function usage() {
  return `
Usage:
  node cache_benchmark.mjs --simulate [options]
  DEEPSEEK_API_KEY=... node cache_benchmark.mjs --live [options]

Modes:
  --simulate                  Run a deterministic offline model. This is the default.
  --live                      Send sequential requests to DeepSeek Chat Completions.

Workload options:
  --trials N                  Requests per layout. Default: ${DEFAULTS.trials}
  --prefix-words N            Approximate stable-prefix word count. Default: ${DEFAULTS.prefixWords}
  --tail-words N              Approximate changing-tail word count. Default: ${DEFAULTS.tailWords}
  --max-output-tokens N       Live completion cap. Default: ${DEFAULTS.maxOutputTokens}

Live API options:
  --model NAME                Default: ${DEFAULTS.model}
  --base-url URL              Default: ${DEFAULTS.baseUrl}
  --input-price USD_PER_MTOK  Ordinary input price. Default: ${DEFAULTS.inputPrice}
  --cached-input-price USD_PER_MTOK
                               Cached-input price. Default: ${DEFAULTS.cachedInputPrice}

Output:
  --json                      Emit one JSON document for scripts.
  --help                      Print this help text.

The two price defaults are benchmark knobs seeded from the chapter's mid-2026 research.
They are not a billing quote. Pass current values before treating live cost output as a
budget estimate.
`.trim();
}

function requiredValue(argv, index, flag) {
  const value = argv[index + 1];
  if (value === undefined || value.startsWith("--")) {
    throw new Error(`${flag} requires a value`);
  }
  return value;
}

function positiveInteger(value, flag) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${flag} must be a positive integer`);
  }
  return parsed;
}

function positiveNumber(value, flag) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${flag} must be a positive number`);
  }
  return parsed;
}

function parseArgs(argv) {
  const options = { ...DEFAULTS };
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    switch (flag) {
      case "--simulate":
        options.mode = "simulate";
        break;
      case "--live":
        options.mode = "live";
        break;
      case "--trials":
        options.trials = positiveInteger(requiredValue(argv, index, flag), flag);
        index += 1;
        break;
      case "--prefix-words":
        options.prefixWords = positiveInteger(requiredValue(argv, index, flag), flag);
        index += 1;
        break;
      case "--tail-words":
        options.tailWords = positiveInteger(requiredValue(argv, index, flag), flag);
        index += 1;
        break;
      case "--max-output-tokens":
        options.maxOutputTokens = positiveInteger(requiredValue(argv, index, flag), flag);
        index += 1;
        break;
      case "--model":
        options.model = requiredValue(argv, index, flag);
        index += 1;
        break;
      case "--base-url":
        options.baseUrl = requiredValue(argv, index, flag).replace(/\/$/, "");
        index += 1;
        break;
      case "--input-price":
        options.inputPrice = positiveNumber(requiredValue(argv, index, flag), flag);
        index += 1;
        break;
      case "--cached-input-price":
        options.cachedInputPrice = positiveNumber(requiredValue(argv, index, flag), flag);
        index += 1;
        break;
      case "--json":
        options.json = true;
        break;
      case "--help":
      case "-h":
        options.help = true;
        break;
      default:
        throw new Error(`unknown option: ${flag}`);
    }
  }
  return options;
}

function repeatedWords(count, words) {
  return Array.from({ length: count }, (_, index) => words[index % words.length]).join(" ");
}

function makeMessages(layout, trial, options, runId) {
  const stableBody = repeatedWords(options.prefixWords, [
    "policy",
    "tool",
    "contract",
    "context",
    "invariant",
    "evidence",
    "review",
    "plan",
  ]);
  const changingTail = `case_${String(trial).padStart(3, "0")} ${repeatedWords(options.tailWords, [
    "current",
    "evidence",
    "task",
    "detail",
  ])}`;
  const sessionPrefix = [
    `session_namespace_${runId}`,
    "You are a deterministic benchmark assistant.",
    "Use the stable material below as operating context.",
    stableBody,
  ].join("\n");
  const staticPad = "layout_namespace_static_000000000000000000000000000000";
  const dynamicNonce = `layout_nonce_${runId}_${String(trial).padStart(6, "0")}`;
  const system = layout === "cache-friendly" ? `${staticPad}\n${sessionPrefix}` : `${dynamicNonce}\n${sessionPrefix}`;

  return [
    { role: "system", content: system },
    {
      role: "user",
      content: `${changingTail}\n\nReply with exactly: ACK`,
    },
  ];
}

function sum(records, key) {
  return records.reduce((total, record) => total + record[key], 0);
}

function round(value, places = 3) {
  return Number(value.toFixed(places));
}

function inputCost(promptCacheMissTokens, promptCacheHitTokens, options) {
  return (
    (promptCacheMissTokens * options.inputPrice) / 1_000_000 +
    (promptCacheHitTokens * options.cachedInputPrice) / 1_000_000
  );
}

function summarize(layout, records, options, measurement) {
  const promptTokens = sum(records, "promptTokens");
  const promptCacheHitTokens = sum(records, "promptCacheHitTokens");
  const promptCacheMissTokens = sum(records, "promptCacheMissTokens");
  const completionTokens = sum(records, "completionTokens");
  const elapsedMs = sum(records, "elapsedMs");
  const estimatedInputCostUsd = inputCost(promptCacheMissTokens, promptCacheHitTokens, options);
  return {
    layout,
    measurement,
    requests: records.length,
    promptTokens,
    promptCacheHitTokens,
    promptCacheMissTokens,
    completionTokens,
    cacheHitRateByInputToken: promptTokens === 0 ? 0 : round(promptCacheHitTokens / promptTokens, 4),
    elapsedMs: round(elapsedMs),
    meanElapsedMs: round(elapsedMs / records.length),
    estimatedInputCostUsd: round(estimatedInputCostUsd, 8),
  };
}

function modelledRecord(layout, trial, options) {
  const fixedOverheadTokens = 28;
  const promptTokens = options.prefixWords + options.tailWords + fixedOverheadTokens;
  const promptCacheHitTokens = layout === "cache-friendly" && trial > 0 ? options.prefixWords : 0;
  const promptCacheMissTokens = promptTokens - promptCacheHitTokens;
  const completionTokens = 1;
  const elapsedMs = 35 + promptCacheMissTokens * 0.08 + completionTokens * 2;
  return {
    promptTokens,
    promptCacheHitTokens,
    promptCacheMissTokens,
    completionTokens,
    elapsedMs,
  };
}

async function callDeepSeek(layout, trial, options, runId) {
  const started = performance.now();
  const response = await fetch(`${options.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
    },
    body: JSON.stringify({
      model: options.model,
      messages: makeMessages(layout, trial, options, runId),
      temperature: 0,
      max_tokens: options.maxOutputTokens,
      stream: false,
    }),
  });
  const elapsedMs = performance.now() - started;
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 500);
    throw new Error(`DeepSeek returned HTTP ${response.status}: ${detail}`);
  }
  const payload = await response.json();
  const usage = payload.usage ?? {};
  const promptCacheHitTokens = Number(usage.prompt_cache_hit_tokens ?? 0);
  const promptCacheMissTokens = Number(usage.prompt_cache_miss_tokens ?? 0);
  const promptTokens = Number(usage.prompt_tokens ?? promptCacheHitTokens + promptCacheMissTokens);
  const completionTokens = Number(usage.completion_tokens ?? 0);

  if (!Number.isFinite(promptTokens) || promptTokens <= 0) {
    throw new Error("DeepSeek response did not include a usable prompt_tokens count");
  }
  if (!Number.isFinite(promptCacheHitTokens) || !Number.isFinite(promptCacheMissTokens)) {
    throw new Error("DeepSeek response contained invalid prompt-cache usage fields");
  }

  return {
    promptTokens,
    promptCacheHitTokens,
    promptCacheMissTokens,
    completionTokens: Number.isFinite(completionTokens) ? completionTokens : 0,
    elapsedMs,
  };
}

async function runLayout(layout, options, runId) {
  const records = [];
  for (let trial = 0; trial < options.trials; trial += 1) {
    if (options.mode === "simulate") {
      records.push(modelledRecord(layout, trial, options));
    } else {
      // Sequential calls give a cache write time to become readable before the next request.
      records.push(await callDeepSeek(layout, trial, options, runId));
    }
  }
  return summarize(layout, records, options, options.mode === "simulate" ? "deterministic model" : "live API response");
}

function compare(cacheFriendly, cacheBreaking) {
  const costDeltaUsd = cacheBreaking.estimatedInputCostUsd - cacheFriendly.estimatedInputCostUsd;
  const elapsedDeltaMs = cacheBreaking.elapsedMs - cacheFriendly.elapsedMs;
  return {
    inputCostDeltaUsd: round(costDeltaUsd, 8),
    inputCostReductionPercent:
      cacheBreaking.estimatedInputCostUsd === 0 ? 0 : round((costDeltaUsd / cacheBreaking.estimatedInputCostUsd) * 100, 2),
    elapsedDeltaMs: round(elapsedDeltaMs),
    elapsedReductionPercent:
      cacheBreaking.elapsedMs === 0 ? 0 : round((elapsedDeltaMs / cacheBreaking.elapsedMs) * 100, 2),
  };
}

function formatUsd(value) {
  return `$${value.toFixed(6)}`;
}

function printHuman(report) {
  const modeLabel = report.mode === "simulate" ? "SIMULATION: deterministic model, not API measurements" : "LIVE: DeepSeek Chat Completions";
  console.log(modeLabel);
  console.log(`workload: ${report.options.trials} sequential requests per layout, ~${report.options.prefixWords} stable words + ~${report.options.tailWords} changing words`);
  console.log(`input-price model: $${report.options.inputPrice}/M miss, $${report.options.cachedInputPrice}/M cache hit`);

  for (const summary of report.layouts) {
    console.log(`\n${summary.layout.toUpperCase()}`);
    console.log(`  cache-hit tokens: ${summary.promptCacheHitTokens} / ${summary.promptTokens} (${(summary.cacheHitRateByInputToken * 100).toFixed(1)}%)`);
    console.log(`  elapsed: ${summary.elapsedMs.toFixed(1)} ms total, ${summary.meanElapsedMs.toFixed(1)} ms/request`);
    console.log(`  estimated input cost: ${formatUsd(summary.estimatedInputCostUsd)}`);
  }

  console.log("\nDELTA: cache-friendly minus cache-breaking");
  console.log(`  input cost reduction: ${formatUsd(report.comparison.inputCostDeltaUsd)} (${report.comparison.inputCostReductionPercent.toFixed(1)}%)`);
  console.log(`  elapsed reduction: ${report.comparison.elapsedDeltaMs.toFixed(1)} ms (${report.comparison.elapsedReductionPercent.toFixed(1)}%)`);
  if (report.mode === "simulate") {
    console.log("\nSimulation assumes the cache-friendly prefix hits after its first write. Run --live to measure best-effort cache behavior and actual elapsed time.");
  } else {
    console.log("\nLive elapsed time is full request wall-clock time, not streaming time-to-first-token. Compare repeated runs and inspect returned usage before drawing a production conclusion.");
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log(usage());
    return;
  }
  if (options.mode === "live" && !process.env.DEEPSEEK_API_KEY) {
    console.error("--live requires DEEPSEEK_API_KEY. Use --simulate for the offline deterministic path.");
    process.exitCode = 2;
    return;
  }

  const runId = options.mode === "simulate" ? "deterministic" : `${Date.now().toString(36)}_${process.pid}`;
  const cacheFriendly = await runLayout("cache-friendly", options, runId);
  const cacheBreaking = await runLayout("cache-breaking", options, runId);
  const report = {
    mode: options.mode,
    productExample: options.mode === "live" ? "DeepSeek Chat Completions" : null,
    options: {
      trials: options.trials,
      prefixWords: options.prefixWords,
      tailWords: options.tailWords,
      inputPrice: options.inputPrice,
      cachedInputPrice: options.cachedInputPrice,
      model: options.mode === "live" ? options.model : null,
    },
    layouts: [cacheFriendly, cacheBreaking],
    comparison: compare(cacheFriendly, cacheBreaking),
  };

  if (options.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    printHuman(report);
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`benchmark failed: ${message}`);
  process.exitCode = 1;
});
