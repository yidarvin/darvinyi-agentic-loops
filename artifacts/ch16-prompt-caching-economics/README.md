# ch16 - cache-layout benchmark

This is the runnable companion to Chapter 16, "Prompt Caching and the Economics of
Remembering." It holds an agent-like workload constant and compares two prompt layouts:

- **cache-friendly** puts a fixed session namespace and stable system material before the
  changing user tail;
- **cache-breaking** moves a changing nonce ahead of that same stable material.

The second layout makes the first token differ on every request. A prefix cache cannot
reuse the stable material after that difference. The task and changing user tail remain the
same across both arms.

## Run it offline

```sh
cd artifacts/ch16-prompt-caching-economics
node cache_benchmark.mjs --simulate
```

- **Runtime:** Node.js 18 or later.
- **Dependencies:** none.
- **Network and API key:** neither is needed for simulation.

Simulation is deterministic. It models a cache hit for the cache-friendly prefix after the
first write, then prints cache-token, input-cost, and elapsed-time deltas. It exists to
make the layout and accounting inspectable without an account. It is not a latency claim.

## Measure a live provider path

Live mode is a clearly labeled **DeepSeek Chat Completions product example**. It uses the
provider's `prompt_cache_hit_tokens` and `prompt_cache_miss_tokens` fields, which makes the
comparison an observation instead of a guess from prompt shape.

```sh
export DEEPSEEK_API_KEY=...
node cache_benchmark.mjs --live \
  --model deepseek-v4-flash \
  --trials 6 \
  --prefix-words 1200 \
  --tail-words 80 \
  --input-price 0.14 \
  --cached-input-price 0.0028
```

The request uses native `fetch`, no SDK. Calls are sequential so a cache write has time to
become readable before the next request. Live output reports total wall-clock elapsed time,
not streaming time-to-first-token. The only differing input is the placement of a
non-semantic namespace field. If the provider's best-effort cache misses, the output shows
it instead of assuming success.

The two price arguments are USD per million input tokens. Their defaults use DeepSeek V4
Flash's listed $0.14 cache-miss and $0.0028 cache-hit input prices. See the official
[Models & Pricing](https://api-docs.deepseek.com/quick_start/pricing/) page before using the
estimated input-cost result for a budget. Output-token cost is deliberately excluded,
because prompt caching does not discount generation.

If `DEEPSEEK_API_KEY` is absent, `--live` exits with a short setup message and makes no
network request. Use `--simulate` when credentials or network access are unavailable.

## Inspect and automate the result

```sh
node cache_benchmark.mjs --simulate --trials 8 --json
bash check.sh
```

`--json` emits one report containing both layouts and their cost and elapsed deltas. The
deterministic check verifies that the cache-friendly arm produces cached input tokens,
lower estimated input cost, and lower modeled elapsed time than the cache-breaking arm.

## Adapt the workload

`--prefix-words` and `--tail-words` are approximate word counts used to generate a portable
workload. Live mode reports the provider's actual token counts, which are the numbers to
use for diagnosis. Replace the generated stable body and user tail in `makeMessages()` with
a non-sensitive trace from an agent you operate. Keep the task, completion cap, model, and
request count constant while moving only the cache boundary.

Do not send secrets or regulated material to a benchmark account. Prefix caching is a
provider-managed feature with isolation, retention, and routing behavior that must fit your
own data policy.

## Reference

- [DeepSeek Context Caching documentation](https://api-docs.deepseek.com/guides/kv_cache/), for the usage fields and its best-effort cache behavior.
- [DeepSeek Models & Pricing](https://api-docs.deepseek.com/quick_start/pricing/), for the benchmark's DeepSeek V4 Flash cache-miss and cache-hit input prices.
