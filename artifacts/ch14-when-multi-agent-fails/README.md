# Coordination failure, reproduced

This dependency-free artifact runs the same local deployment task through two control planes. The first loses a credential fact at a handoff, repeats an unchanged action, and exits without proving the task succeeded. The second shares the full trace with its coordinator, records the decision that matters, permits one orchestrator to write the execution plan, and verifies the final objective.

The purpose is not to simulate model quality. It is to make a coordination failure deterministic enough to inspect and test.

## Run it

Requirements: Python 3.9 or newer. No package installation, network access, API key, or external service is required.

```sh
cd artifacts/ch14-when-multi-agent-fails
./check.sh
python3 simulate.py --mode compare
```

Inspect one full trace at a time:

```sh
python3 simulate.py --mode naive
python3 simulate.py --mode fixed
```

Print the comparison followed by both traces:

```sh
python3 simulate.py --mode compare --trace
```

Emit the metrics for automation:

```sh
python3 simulate.py --mode compare --json
python3 simulate.py --mode compare --json --trace
```

## Expected result

| Metric | Naive run | Corrected run |
| --- | --- | --- |
| Credential fact reaches coordinator | No | Yes |
| Login attempts | 3, all identical | 1 |
| Objective-level verification | No | Yes |
| Artifact published | No | Yes |

`check.sh` runs assertions against both traces. It fails if the baseline no longer exposes the coordination failure or if the corrected design stops publishing successfully.

## What the trace demonstrates

The local `DeploymentPortal` accepts a login only when its username is an account phone number. In the naive architecture, the Credential Agent reads that requirement but reduces its handoff to "credentials inspected." The Supervisor then treats the project identifier as the username. The portal returns a discriminating error, but the Supervisor retries the exact same action three times and exits at its retry cap.

This generates three observable MAST categories:

- **FC2, inter-agent misalignment:** the fact was available but did not reach the coordinator.
- **FC1, specification and system design:** a failed action repeats without changing an input or revisiting a decision.
- **FC3, task verification and termination:** the run terminates on a budget, not on evidence that the artifact was published.

The corrected architecture changes the control plane, not the service or task:

1. The orchestrator receives the full source finding rather than a lossy status message.
2. It records the chosen username and its source event in a decision ledger.
3. It is the sole writer of the execution plan. The other agents contribute observations or execute the plan.
4. A verifier checks the external task state before the run can terminate successfully.

`simulate.py` emits a numbered, append-only trace with actor, event kind, and structured details. It redacts the demo passcode in every trace event.

## Adapt the experiment

Replace `DeploymentPortal` with a real service adapter only after preserving the controls demonstrated here: trace correlation, decision provenance, bounded retries that require changed evidence, a single owner for shared writes, and an objective-level verifier. Keep the deterministic scenario as a regression test when the live integration is added.

## Source

The failure labels follow the [Multi-Agent System Failure Taxonomy (MAST)](https://arxiv.org/abs/2503.13657), especially information withholding, step repetition, and incomplete verification.
