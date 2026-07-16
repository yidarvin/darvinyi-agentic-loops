#!/usr/bin/env python3
"""Run an instrumented coordination failure and a corrected design side by side.

The scenario is deliberately deterministic. It isolates coordination design from
model quality so that the same failure can be reproduced, inspected, and tested.
No network call, package, credential, or API key is required.
"""

from __future__ import annotations

import argparse
import json
import sys
from dataclasses import dataclass, field
from typing import Any, Dict, Iterable, List, Sequence


FACT_ID = "credential.username.requires_account_phone"
ACCOUNT_PHONE = "+1-555-0142"
PROJECT_ID = "aurora-release"
DEMO_PASSCODE = "demo-only-passcode"


@dataclass
class Event:
    """One observable event in an agent run."""

    sequence: int
    actor: str
    kind: str
    details: Dict[str, Any]


@dataclass
class Trace:
    """An append-only trace that doubles as the artifact's instrumentation."""

    events: List[Event] = field(default_factory=list)

    def emit(self, actor: str, kind: str, **details: Any) -> Event:
        event = Event(
            sequence=len(self.events) + 1,
            actor=actor,
            kind=kind,
            details=details,
        )
        self.events.append(event)
        return event

    def render(self) -> str:
        lines: List[str] = []
        for event in self.events:
            details = json.dumps(event.details, sort_keys=True, separators=(",", ": "))
            lines.append(
                "{sequence:02d}  {actor:<18} {kind:<18} {details}".format(
                    sequence=event.sequence,
                    actor=event.actor,
                    kind=event.kind,
                    details=details,
                )
            )
        return "\n".join(lines)


class DeploymentPortal:
    """A local service with a contract that the agents must coordinate around."""

    def __init__(self) -> None:
        self.authenticated = False
        self.published = False

    def authenticate(self, username: str, passcode: str) -> Dict[str, Any]:
        if username != ACCOUNT_PHONE:
            return {
                "ok": False,
                "error": "username_must_be_account_phone",
                "hint": "The username field accepts the account phone number.",
            }
        if passcode != DEMO_PASSCODE:
            return {"ok": False, "error": "invalid_passcode"}
        self.authenticated = True
        return {"ok": True, "session": "local-demo-session"}

    def publish(self, artifact: str) -> Dict[str, Any]:
        if not self.authenticated:
            return {"ok": False, "error": "not_authenticated"}
        self.published = True
        return {"ok": True, "artifact": artifact, "state": "published"}


@dataclass
class RunResult:
    """The final state and trace of one architecture."""

    name: str
    coordinator: str
    trace: Trace
    portal: DeploymentPortal
    success: bool


def visible_fact(trace: Trace, recipient: str) -> bool:
    """Return whether the identity-critical fact reached the decision maker."""

    for event in trace.events:
        facts = event.details.get("facts", [])
        recipients = event.details.get("visible_to", [])
        if FACT_ID in facts and recipient in recipients:
            return True
    return False


def login_attempts(trace: Trace) -> List[Event]:
    return [
        event
        for event in trace.events
        if event.kind == "action" and event.details.get("operation") == "authenticate"
    ]


def repeated_login(trace: Trace) -> bool:
    attempts = login_attempts(trace)
    usernames = [attempt.details.get("username") for attempt in attempts]
    return len(usernames) > 1 and len(set(usernames)) == 1


def objective_verified(trace: Trace) -> bool:
    return any(
        event.kind == "objective_check" and event.details.get("ok") is True
        for event in trace.events
    )


def full_trace_shared(trace: Trace) -> bool:
    return any(
        event.kind == "context_share"
        and event.details.get("mode") == "full_trace"
        for event in trace.events
    )


def run_naive() -> RunResult:
    """Run the message-only architecture that loses a critical handoff fact."""

    trace = Trace()
    portal = DeploymentPortal()

    trace.emit(
        "credential-agent",
        "source_read",
        facts=[FACT_ID],
        statement="The portal username field requires the account phone number.",
        visible_to=["credential-agent"],
    )
    trace.emit(
        "credential-agent",
        "handoff",
        to="supervisor",
        facts=[],
        message="Credentials inspected. The deployment portal is ready.",
        visible_to=["supervisor"],
    )
    trace.emit(
        "supervisor",
        "decision",
        key="login.username",
        value=PROJECT_ID,
        rationale="Use the project identifier because the handoff had no field contract.",
        visible_to=["executor"],
    )

    for attempt in range(1, 4):
        trace.emit(
            "executor",
            "action",
            operation="authenticate",
            attempt=attempt,
            username=PROJECT_ID,
            passcode="<redacted>",
        )
        response = portal.authenticate(PROJECT_ID, DEMO_PASSCODE)
        trace.emit(
            "portal",
            "result",
            operation="authenticate",
            attempt=attempt,
            ok=response["ok"],
            error=response.get("error"),
        )
        if response["ok"]:
            break
        if attempt < 3:
            trace.emit(
                "supervisor",
                "retry",
                next_attempt=attempt + 1,
                reason="Retry the same plan after a login failure.",
                changed_inputs=False,
                retry_cap=3,
            )

    trace.emit(
        "supervisor",
        "termination",
        reason="retry_budget_exhausted",
        objective_verified=False,
    )
    return RunResult(
        name="naive messages-only coordination",
        coordinator="supervisor",
        trace=trace,
        portal=portal,
        success=False,
    )


def run_fixed() -> RunResult:
    """Run the same task with trace sharing, a ledger, and objective verification."""

    trace = Trace()
    portal = DeploymentPortal()

    finding = trace.emit(
        "credential-agent",
        "source_read",
        facts=[FACT_ID],
        statement="The portal username field requires the account phone number.",
        visible_to=["credential-agent"],
    )
    trace.emit(
        "orchestrator",
        "context_share",
        mode="full_trace",
        facts=[FACT_ID],
        source_event=finding.sequence,
        visible_to=["orchestrator"],
    )
    trace.emit(
        "orchestrator",
        "decision_ledger",
        decision_id="D-001",
        key="login.username",
        value=ACCOUNT_PHONE,
        source_event=finding.sequence,
        writer="orchestrator",
        visible_to=["executor", "verifier"],
    )
    trace.emit(
        "orchestrator",
        "execution_plan",
        writer="orchestrator",
        action="authenticate_then_publish",
        retry_cap=1,
        termination="publish succeeds and objective verifier passes",
        visible_to=["executor", "verifier"],
    )

    trace.emit(
        "executor",
        "action",
        operation="authenticate",
        attempt=1,
        username=ACCOUNT_PHONE,
        passcode="<redacted>",
    )
    login = portal.authenticate(ACCOUNT_PHONE, DEMO_PASSCODE)
    trace.emit(
        "portal",
        "result",
        operation="authenticate",
        attempt=1,
        ok=login["ok"],
        error=login.get("error"),
    )

    if login["ok"]:
        trace.emit(
            "executor",
            "action",
            operation="publish",
            artifact=PROJECT_ID,
        )
        publication = portal.publish(PROJECT_ID)
        trace.emit(
            "portal",
            "result",
            operation="publish",
            ok=publication["ok"],
            state=publication.get("state"),
            error=publication.get("error"),
        )

    verified = portal.authenticated and portal.published
    trace.emit(
        "verifier",
        "objective_check",
        objective="artifact is authenticated and published",
        authenticated=portal.authenticated,
        published=portal.published,
        ok=verified,
    )
    trace.emit(
        "orchestrator",
        "termination",
        reason="objective_verified" if verified else "objective_failed",
        objective_verified=verified,
    )
    return RunResult(
        name="corrected trace-and-ledger coordination",
        coordinator="orchestrator",
        trace=trace,
        portal=portal,
        success=verified,
    )


def diagnoses(result: RunResult) -> List[str]:
    """Map observed trace properties onto the MAST failure categories."""

    findings: List[str] = []
    if not visible_fact(result.trace, result.coordinator):
        findings.append(
            "FC2 inter-agent misalignment: the credential field contract never reached "
            "the coordinator. This is information withholding by the architecture."
        )
    if repeated_login(result.trace):
        findings.append(
            "FC1 specification and system design: the coordinator repeated an unchanged "
            "action after the service returned a discriminating error."
        )
    if not objective_verified(result.trace):
        findings.append(
            "FC3 task verification and termination: the run stopped on a retry budget, "
            "not on proof that the artifact was published."
        )
    if not findings and result.success:
        findings.append(
            "Controls held: the fact reached the coordinator, one orchestrator wrote the "
            "execution plan, and an objective-level verifier confirmed publication."
        )
    return findings


def metrics(result: RunResult) -> Dict[str, Any]:
    attempts = login_attempts(result.trace)
    return {
        "success": result.success,
        "fact_reached_coordinator": visible_fact(result.trace, result.coordinator),
        "full_trace_shared": full_trace_shared(result.trace),
        "login_attempts": len(attempts),
        "repeated_unchanged_login": repeated_login(result.trace),
        "objective_verified": objective_verified(result.trace),
        "events": len(result.trace.events),
    }


def summary(result: RunResult, include_trace: bool = False) -> Dict[str, Any]:
    data: Dict[str, Any] = {
        "architecture": result.name,
        "coordinator": result.coordinator,
        "metrics": metrics(result),
        "diagnosis": diagnoses(result),
    }
    if include_trace:
        data["trace"] = [
            {
                "sequence": event.sequence,
                "actor": event.actor,
                "kind": event.kind,
                "details": event.details,
            }
            for event in result.trace.events
        ]
    return data


def render_run(result: RunResult) -> str:
    run_metrics = metrics(result)
    lines = ["", "// {0}".format(result.name), "trace:", result.trace.render(), "", "diagnosis:"]
    lines.extend("- {0}".format(item) for item in diagnoses(result))
    lines.append("")
    lines.append("metrics:")
    for key, value in run_metrics.items():
        lines.append("- {0}: {1}".format(key, value))
    return "\n".join(lines)


def render_comparison(results: Sequence[RunResult]) -> str:
    labels = [
        ("success", "success"),
        ("fact reached coordinator", "fact_reached_coordinator"),
        ("full trace shared", "full_trace_shared"),
        ("login attempts", "login_attempts"),
        ("repeated unchanged login", "repeated_unchanged_login"),
        ("objective verified", "objective_verified"),
        ("trace events", "events"),
    ]
    first, second = results
    first_metrics = metrics(first)
    second_metrics = metrics(second)
    width = max(len(label) for label, _ in labels)
    lines = [
        "// coordination failure: same local service, different control plane",
        "",
        "{0:<{width}}  {1:<16}  {2}".format(
            "metric", "naive", "corrected", width=width
        ),
        "{0}  {1}  {2}".format("-" * width, "-" * 16, "-" * 16),
    ]
    for label, key in labels:
        lines.append(
            "{0:<{width}}  {1:<16}  {2}".format(
                label,
                str(first_metrics[key]),
                str(second_metrics[key]),
                width=width,
            )
        )
    lines.extend(
        [
            "",
            "naive diagnosis:",
            *["- {0}".format(item) for item in diagnoses(first)],
            "",
            "corrected controls:",
            *["- {0}".format(item) for item in diagnoses(second)],
            "",
            "Inspect individual traces with --mode naive or --mode fixed.",
        ]
    )
    return "\n".join(lines)


def self_test() -> int:
    naive = run_naive()
    fixed = run_fixed()

    assert not naive.success, "The naive architecture should fail the portal contract."
    assert not visible_fact(naive.trace, naive.coordinator), "The handoff must lose the fact."
    assert len(login_attempts(naive.trace)) == 3, "The naive run must retry three times."
    assert repeated_login(naive.trace), "The naive run must repeat unchanged work."
    assert not objective_verified(naive.trace), "The naive run must lack objective verification."

    assert fixed.success, "The corrected architecture should publish successfully."
    assert visible_fact(fixed.trace, fixed.coordinator), "The fact must reach the coordinator."
    assert full_trace_shared(fixed.trace), "The corrected run must share the full trace."
    assert len(login_attempts(fixed.trace)) == 1, "The corrected run should not retry."
    assert objective_verified(fixed.trace), "The corrected run must verify the objective."

    print("self-test: PASS")
    print("naive: failed through FC2 information loss, FC1 repeated action, and FC3 absent verification")
    print("corrected: published after trace sharing, a decision ledger, and objective verification")
    return 0


def parse_args(argv: Iterable[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Compare a coordination failure with a corrected multi-agent control plane."
    )
    parser.add_argument(
        "--mode",
        choices=("naive", "fixed", "compare"),
        default="compare",
        help="Run one architecture or print the side-by-side comparison (default: compare).",
    )
    parser.add_argument(
        "--trace",
        action="store_true",
        help="Include both detailed traces when using --mode compare.",
    )
    parser.add_argument(
        "--json",
        action="store_true",
        help="Emit structured instrumentation for scripts and tests.",
    )
    parser.add_argument(
        "--self-test",
        action="store_true",
        help="Assert the expected failure and fix. Used by check.sh.",
    )
    return parser.parse_args(list(argv))


def main(argv: Iterable[str]) -> int:
    args = parse_args(argv)
    if args.self_test:
        return self_test()

    naive = run_naive()
    fixed = run_fixed()
    if args.mode == "naive":
        results = [naive]
    elif args.mode == "fixed":
        results = [fixed]
    else:
        results = [naive, fixed]

    if args.json:
        print(
            json.dumps(
                {
                    "runs": [summary(result, include_trace=args.trace) for result in results],
                },
                indent=2,
                sort_keys=True,
            )
        )
        return 0

    if args.mode == "compare":
        print(render_comparison(results))
        if args.trace:
            for result in results:
                print(render_run(result))
        return 0

    print(render_run(results[0]))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
