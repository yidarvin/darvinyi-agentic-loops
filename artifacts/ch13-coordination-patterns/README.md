# ch13-coordination-patterns: fan-out / fan-in lab

This is a zero-dependency, deterministic coordination lab paired with Chapter 13. It
models the control-plane contract behind parallel subagents without calling a model or a
framework: independent workers queue behind one release gate, a semaphore bounds the
active branch count, the coordinator waits at a join, and a reducer emits exactly one
aggregate after every required result succeeds.

- **Runtime:** Python 3.9+.
- **Dependencies:** standard library only.
- **Network and API keys:** none.

The local workers are fixtures, not pretend intelligence. Replace `run_worker` with real
agent calls only after preserving the same input schema, concurrency bound, failure policy,
and reducer contract.

## Run it

```bash
cd artifacts/ch13-coordination-patterns

# Show three workers queued, released, completed out of input order, joined, and reduced.
python3 fanout.py

# The same successful run as structured data.
python3 fanout.py --json

# Bound the scheduler to two active workers. The join and reducer rules do not change.
python3 fanout.py --workers 2

# Simulate a required branch failure. The program exits 2 and emits no aggregate.
python3 fanout.py --fail risks

# Assert the full coordination contract without timing-based tests.
python3 fanout.py --test

# The repository artifact gate uses this command.
bash check.sh
```

## What the trace proves

The trace has four boundaries worth inspecting.

1. `queued` appears once per worker before `fan_out_released`, so the coordinator has
   defined the full branch set before work starts.
2. `started` appears for all unconstrained workers before any terminal result. With the
   default limit of three, all three branches run concurrently.
3. `completed` arrives in duration order, deliberately different from the input order.
   The reducer sorts structured results by their stable index, so timing cannot choose the
   synthesis.
4. `join_closed` occurs only after every branch reports a terminal result. A required
   failure produces `join_blocked`, not a partial aggregate.

This is the narrow operational rule behind the chapter: parallelism needs a join contract,
and a join contract needs an owner.
