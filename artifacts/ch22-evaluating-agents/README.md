# Evaluating Agents: local eval harness

This artifact is a small, standard-library evaluation harness for a coding-style
agent. It runs a task set repeatedly, creates a fresh temporary workspace for every
task attempt, grades final state and declared actions, emits a trace-shaped JSON
report, and summarizes pass@1, pass@k, pass^k, cost, steps, and failure tags.

The bundled agent is deterministic and intentionally imperfect. It gives the
harness a real reliability pattern to report:

    pass@1=75.0%
    pass@3=100.0%
    pass^3=50.0%

That difference is the lesson. Three attempts can find a working path for every
task while only half of the tasks remain reliable across all three attempts.
The pass and failure pattern is scripted by trial number so this artifact stays
deterministic. It is test data for the harness, not independent evidence about a
live model.

## Quick start

The artifact requires Python 3.9 or later and no package installation, API key, or
network access.

    cd artifacts/ch22-evaluating-agents
    bash check.sh
    python3 harness.py --runs 3 --report report.json

The harness prints a compact per-task table and writes the detailed report to
report.json. Inspect the trials array to see individual outcome checks, trajectory
evidence, cost, turns, stderr, duration, and failure tags.

## What the harness does

For each task and each trial, harness.py:

1. Creates a new temporary directory and writes the task's initial files.
2. Writes an agent-facing task JSON that contains the prompt, requirements, and
   action constraints but not grader expectations.
3. Invokes the agent without a shell.
4. Applies deterministic final-state checks after the agent exits.
5. Scores declared actions by required-action recall, allowed-action precision, and
   prohibited actions.
6. Records the complete result, then removes the temporary workspace.

Final state determines the core outcome verdict. A required-action miss or prohibited
action still disqualifies the overall trial, so pass@k and pass^k report accepted
trials rather than a convenient final file alone. Trajectory grading remains
diagnostic: it identifies which constraint failed without requiring one rigid tool
sequence. The bundled tasks cover a simple patch, a protected-file boundary, an
incomplete verification loop, and an unsafe tool-mode argument.

## Replace the fixture agent

Pass a compatible command through --agent-command:

    python3 harness.py --runs 3 --agent-command "python3 /absolute/path/to/my_agent.py" --report my-report.json

The harness parses that option with shlex and does not execute a shell. It appends
these arguments to the command:

    --task /temporary/workspace/agent_task.json
    --workspace /temporary/workspace
    --trial 1

Your agent must:

1. Read the JSON file named by --task.
2. Modify only the supplied --workspace.
3. Print exactly one JSON object to stdout after it finishes.

The required stdout shape is:

    {
      "actions": ["write:result.txt"],
      "turns": 4,
      "cost_usd": 0.012,
      "summary": "optional short explanation"
    }

The actions, turns, and cost_usd fields are required. Summary is optional. Cost and
turn values must be finite, non-negative JSON numbers.

Actions are a lightweight trace interface, not a trusted audit log. For a production
agent, capture tool events outside the agent process as well. The harness fails a
missing command, timeout, nonzero exit, malformed JSON, or invalid metric field,
including NaN or infinity, with an agent_error result instead of treating it as a
pass.

## Task schema

tasks.json holds a top-level tasks array. Each task has:

    {
      "id": "short-stable-id",
      "prompt": "What the agent should do",
      "requirements": ["Agent-visible constraint"],
      "initial_files": {"relative/path.txt": "initial content\n"},
      "checks": [
        {"kind": "file_equals", "path": "relative/path.txt", "expected": "final content\n"}
      ],
      "trajectory": {
        "required_actions": ["write:relative/path.txt"],
        "allowed_actions": ["write:relative/path.txt"],
        "forbidden_actions": ["delete:protected.txt"]
      },
      "failure_tags": {
        "outcome": "wrong_patch",
        "trajectory": "tool_contract",
        "policy": "policy_violation"
      }
    }

Supported deterministic check kinds are file_equals, file_contains, and file_absent.
All task paths are resolved beneath the trial workspace. A traversal attempt fails
the harness configuration instead of writing outside that workspace. Malformed
top-level documents, checks, trajectory fields, and failure tags also fail with a
readable harness error before any agent is invoked. Text checks treat a missing or
non-UTF-8 file as a controlled failed check rather than crashing the harness.

## Limits and upgrade path

The temporary directory isolates fixture state between trials. It is not an operating
system sandbox. A custom agent process can still access the host according to the
permissions of the user who starts it. Run untrusted agents in a real sandbox, with
network and credential boundaries set outside this artifact.

The fixture's reported cost and turns are agent-supplied demonstration values. A real
adapter should populate them from provider usage and trace instrumentation. Add
language-aware tests, a repository image, model-based rubrics calibrated against
human labels, and CI reporting only after the basic task contract stays stable.
