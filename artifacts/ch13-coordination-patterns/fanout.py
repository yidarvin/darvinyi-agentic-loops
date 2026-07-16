#!/usr/bin/env python3
"""A deterministic fan-out and fan-in coordination lab.

The workers are local fixtures instead of model calls. The important runtime contract is
real: every worker is queued before a release gate opens, a semaphore bounds concurrent
execution, the join waits for every required result, and the reducer owns the only final
aggregate.
"""

from __future__ import annotations

import argparse
import asyncio
import json
from dataclasses import asdict, dataclass
from typing import Iterable, List, Optional, Sequence, Tuple


@dataclass(frozen=True)
class WorkItem:
    index: int
    worker: str
    question: str
    finding: str
    delay_seconds: float


@dataclass(frozen=True)
class WorkerResult:
    index: int
    worker: str
    question: str
    finding: str
    ok: bool
    error: Optional[str] = None


@dataclass(frozen=True)
class TraceEvent:
    sequence: int
    kind: str
    worker: str
    detail: str


@dataclass(frozen=True)
class Aggregate:
    worker_order: Tuple[str, ...]
    findings: Tuple[str, ...]
    synthesis: str


@dataclass(frozen=True)
class RunReport:
    max_concurrency: int
    results: Tuple[WorkerResult, ...]
    events: Tuple[TraceEvent, ...]
    aggregate: Aggregate


DEFAULT_ITEMS: Tuple[WorkItem, ...] = (
    WorkItem(
        index=0,
        worker="sources",
        question="Which primary sources establish the baseline?",
        finding="Primary sources are sufficient for the factual baseline.",
        delay_seconds=0.06,
    ),
    WorkItem(
        index=1,
        worker="risks",
        question="Which failure mode changes the routing choice?",
        finding="Shared writes need one owner and an explicit conflict rule.",
        delay_seconds=0.02,
    ),
    WorkItem(
        index=2,
        worker="options",
        question="Which independent alternative should the lead compare?",
        finding="Fan-out is justified only for separable branches with a defined join.",
        delay_seconds=0.10,
    ),
)


class Trace:
    def __init__(self) -> None:
        self.events: List[TraceEvent] = []

    def emit(self, kind: str, worker: str = "system", detail: str = "") -> None:
        self.events.append(
            TraceEvent(
                sequence=len(self.events) + 1,
                kind=kind,
                worker=worker,
                detail=detail,
            )
        )


class FanoutFailure(RuntimeError):
    def __init__(self, failed_workers: Sequence[str], events: Sequence[TraceEvent]) -> None:
        self.failed_workers = tuple(failed_workers)
        self.events = tuple(events)
        super().__init__("required branches failed: " + ", ".join(self.failed_workers))


async def run_worker(
    item: WorkItem,
    release_gate: asyncio.Event,
    semaphore: asyncio.Semaphore,
    trace: Trace,
    fail_worker: Optional[str],
) -> WorkerResult:
    """Run one isolated branch after the orchestrator opens the release gate."""
    trace.emit("queued", item.worker, item.question)
    await release_gate.wait()

    async with semaphore:
        trace.emit("started", item.worker)
        await asyncio.sleep(item.delay_seconds)
        if item.worker == fail_worker:
            message = "simulated required-branch failure"
            trace.emit("failed", item.worker, message)
            return WorkerResult(
                index=item.index,
                worker=item.worker,
                question=item.question,
                finding="",
                ok=False,
                error=message,
            )

        trace.emit("completed", item.worker, item.finding)
        return WorkerResult(
            index=item.index,
            worker=item.worker,
            question=item.question,
            finding=item.finding,
            ok=True,
        )


def reduce_results(results: Iterable[WorkerResult]) -> Aggregate:
    """Validate and merge results without depending on completion order."""
    ordered = tuple(sorted(results, key=lambda result: result.index))
    expected_indexes = tuple(range(len(ordered)))
    actual_indexes = tuple(result.index for result in ordered)
    if actual_indexes != expected_indexes:
        raise ValueError(f"reducer expected indexes {expected_indexes}, got {actual_indexes}")

    worker_names = tuple(result.worker for result in ordered)
    if len(set(worker_names)) != len(worker_names):
        raise ValueError("reducer requires one unique result per worker")
    if any(not result.ok for result in ordered):
        raise ValueError("reducer refuses unsuccessful results")

    findings = tuple(result.finding for result in ordered)
    return Aggregate(
        worker_order=worker_names,
        findings=findings,
        synthesis=" ".join(findings),
    )


async def run_fanout(
    items: Sequence[WorkItem] = DEFAULT_ITEMS,
    max_concurrency: int = 3,
    fail_worker: Optional[str] = None,
) -> RunReport:
    """Queue independent work, release it together, join, then aggregate once."""
    if not items:
        raise ValueError("fan-out needs at least one work item")
    if max_concurrency < 1:
        raise ValueError("max_concurrency must be at least one")
    worker_names = {item.worker for item in items}
    if fail_worker is not None and fail_worker not in worker_names:
        raise ValueError(f"unknown worker: {fail_worker}")

    trace = Trace()
    release_gate = asyncio.Event()
    semaphore = asyncio.Semaphore(max_concurrency)
    tasks = [
        asyncio.create_task(run_worker(item, release_gate, semaphore, trace, fail_worker))
        for item in items
    ]

    # Let every worker reach the same release point. This gives the trace a clear
    # fan-out boundary before the semaphore decides how many can run at once.
    while sum(event.kind == "queued" for event in trace.events) < len(items):
        await asyncio.sleep(0)
    trace.emit("all_queued", detail=f"{len(items)} branches are ready")
    release_gate.set()
    trace.emit("fan_out_released", detail=f"concurrency limit = {max_concurrency}")

    results = tuple(await asyncio.gather(*tasks))
    trace.emit("join_closed", detail=f"{len(results)} terminal branch results received")

    failures = tuple(result.worker for result in results if not result.ok)
    if failures:
        trace.emit("join_blocked", detail="aggregate withheld until required failures are handled")
        raise FanoutFailure(failures, trace.events)

    aggregate = reduce_results(results)
    trace.emit("aggregate_emitted", detail="ordered reducer produced one synthesis")
    return RunReport(
        max_concurrency=max_concurrency,
        results=results,
        events=tuple(trace.events),
        aggregate=aggregate,
    )


def event_index(events: Sequence[TraceEvent], kind: str) -> int:
    return next(index for index, event in enumerate(events) if event.kind == kind)


def completion_order(events: Sequence[TraceEvent]) -> Tuple[str, ...]:
    return tuple(event.worker for event in events if event.kind == "completed")


def peak_parallelism(events: Sequence[TraceEvent]) -> int:
    active = 0
    peak = 0
    for event in events:
        if event.kind == "started":
            active += 1
            peak = max(peak, active)
        elif event.kind in {"completed", "failed"}:
            active -= 1
    return peak


def render_trace(events: Sequence[TraceEvent]) -> str:
    return "\n".join(
        f"  {event.sequence:02d}  {event.kind:<16} {event.worker:<10} {event.detail}".rstrip()
        for event in events
    )


def render_report(report: RunReport) -> str:
    completed = completion_order(report.events)
    lines = [
        "fan-out / fan-in coordination lab",
        f"concurrency limit: {report.max_concurrency}",
        "",
        "trace:",
        render_trace(report.events),
        "",
        f"completion order: {' -> '.join(completed)}",
        f"peak active branches: {peak_parallelism(report.events)}",
        f"join: closed before one aggregate from {', '.join(report.aggregate.worker_order)}",
        "aggregate:",
    ]
    lines.extend(f"  - {finding}" for finding in report.aggregate.findings)
    lines.extend(["", f"synthesis: {report.aggregate.synthesis}"])
    return "\n".join(lines)


def report_as_json(report: RunReport) -> str:
    return json.dumps(asdict(report), indent=2, sort_keys=True)


async def run_self_test() -> None:
    """Assert the orchestration contract without using wall-clock timing assertions."""
    report = await run_fanout(max_concurrency=3)
    events = report.events
    input_order = tuple(item.worker for item in DEFAULT_ITEMS)

    queued_positions = [index for index, event in enumerate(events) if event.kind == "queued"]
    release_position = event_index(events, "fan_out_released")
    first_terminal_position = min(
        index for index, event in enumerate(events) if event.kind in {"completed", "failed"}
    )
    last_completion_position = max(index for index, event in enumerate(events) if event.kind == "completed")

    assert len(queued_positions) == len(DEFAULT_ITEMS), "every branch must reach the release gate"
    assert max(queued_positions) < release_position, "release must occur after every branch is queued"
    assert all(
        index < first_terminal_position for index, event in enumerate(events) if event.kind == "started"
    ), "no branch may complete before all unconstrained branches begin"
    assert peak_parallelism(events) == 3, "the lab must show three concurrent branches"
    assert completion_order(events) != input_order, "completion order must not determine aggregate order"
    assert event_index(events, "join_closed") > last_completion_position, "the join waits for all results"
    assert event_index(events, "aggregate_emitted") > event_index(events, "join_closed"), "aggregate follows join"
    assert report.aggregate.worker_order == input_order, "reducer restores stable input order"

    try:
        await run_fanout(max_concurrency=3, fail_worker="risks")
    except FanoutFailure as failure:
        failure_kinds = tuple(event.kind for event in failure.events)
        assert failure.failed_workers == ("risks",), "the intended branch must fail"
        assert "join_closed" in failure_kinds and "join_blocked" in failure_kinds, "failure still closes the join"
        assert "aggregate_emitted" not in failure_kinds, "failed required work cannot yield a partial aggregate"
    else:
        raise AssertionError("the failure path must block aggregation")

    print("ok: fan-out queues workers, the join waits, the reducer is stable, and failure blocks synthesis")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run a deterministic fan-out and fan-in coordination lab.")
    parser.add_argument("--workers", type=int, default=3, help="maximum concurrent workers, default: 3")
    parser.add_argument("--fail", choices=[item.worker for item in DEFAULT_ITEMS], help="simulate one required branch failing")
    parser.add_argument("--json", action="store_true", help="print the successful report as JSON")
    parser.add_argument("--test", action="store_true", help="run offline orchestration assertions")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    if args.test:
        asyncio.run(run_self_test())
        return 0

    try:
        report = asyncio.run(run_fanout(max_concurrency=args.workers, fail_worker=args.fail))
    except (FanoutFailure, ValueError) as error:
        if isinstance(error, FanoutFailure):
            print("fan-out / fan-in coordination lab")
            print(f"join blocked: {error}")
            print("trace:")
            print(render_trace(error.events))
            return 2
        print(f"configuration error: {error}")
        return 2

    print(report_as_json(report) if args.json else render_report(report))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
