# Stage Three harness probe

This directory is a small, observable production-harness lab. It is not a
general-purpose autonomous coding agent and it does not call a model by default.
Its deterministic planner makes the seams around a real agent loop visible before
you attach a provider: stdio MCP, tool-definition pinning, bounded file memory,
read-only subagents, NDJSON streaming, deny-first permissions, and macOS Seatbelt.

## Requirements

- macOS with Python 3.9 or newer and `/usr/bin/sandbox-exec` available.
- No package install, API key, network connection, or external MCP server for the
  bundled demo.

The normal demo fails closed when Seatbelt is missing. It never silently falls back
to an unsandboxed child process. `sandbox-exec` is deprecated by Apple, so treat this
as an instructional macOS boundary. Use a short-lived container, VM, or microVM when
your assurance requirement exceeds the threat model of a local development tool.

## Run the deterministic demo

From this directory:

```bash
bash check.sh
python3 stage_three_agent.py demo \
  --workspace ./demo_workspace \
  --approve-verification \
  --stream ndjson
```

The demo writes `.agent-memory/`, `mcp-tool-lock.json`, and `verification.txt` under
the chosen workspace. The first two record durable project state and pinned tool
definitions. The last file proves that the approved process could write inside the
workspace. It cannot write outside the workspace when the Seatbelt profile starts.

The NDJSON stream includes events such as:

```text
memory.loaded
mcp.tool_pinned
mcp.connected
mcp.tool_result
subagent.started
subagent.summary
permission.decided
sandbox.started
sandbox.completed
run.completed
```

Omit `--approve-verification` to see the ask-tier shell operation stop before any
process starts. There is no global bypass-permissions flag.

## What the harness actually exercises

1. `stage_three_agent.py` loads a bounded project-memory file through
   `Path.resolve()` plus `relative_to()` containment checks.
2. It starts `mcp_demo_server.py` as a local stdio JSON-RPC server inside Seatbelt,
   performs `initialize`, discovers `tools/list`, maps the tool to
   `mcp__demo__read_project_brief`, and pins its normalized definition hash.
3. It records the MCP tool result as untrusted data rather than treating it as an
   instruction.
4. It runs a fresh, read-only depth-one worker. The parent receives only the worker's
   capped summary, not a tool transcript.
5. It evaluates a permission rule in `deny`, `ask`, `allow` order. A denial always
   wins over a broader allow rule.
6. It launches the one approved shell command through Seatbelt. The generated profile
   allows writes only below `--workspace`, denies network, and scrubs common
   credential-shaped environment variables from child processes.

`check.sh` runs deterministic invariants, then records and validates a full demo
trace in a temporary workspace. On non-macOS systems it uses the explicit `test`
sandbox double only for the portable artifact gate. That test double is not available
to the normal demo command and has no security meaning.

## Connect another local stdio MCP server

The probe accepts a quoted command for a compatible local stdio server and invokes a
named zero-argument tool. The server is still launched through the same fail-closed
sandbox, and its tool definitions still need to match the recorded lock file. A
non-demo server receives no blanket allow rule, so give it a reviewed policy entry or
use the single-invocation approval flag while testing.

```bash
python3 stage_three_agent.py demo \
  --workspace ./demo_workspace \
  --server-name filesystem \
  --mcp-command 'python3 /absolute/path/to/server.py' \
  --mcp-tool read_project_brief \
  --approve-mcp-tool \
  --approve-verification
```

This lab intentionally implements the local stdio path only. A real host should use
a maintained MCP SDK, pin its protocol and SDK version, add timeouts and retries, and
separate credentials by server. Remote transports, OAuth, resources, prompts, and a
model adapter are deliberate next steps rather than hidden dependencies.

## Security boundary and limits

The policy is useful because it makes intent auditable. It is not the containment
boundary. Seatbelt constrains the subprocess after policy allows it to start. The
profile has an intentionally narrow writable area and no network. It still needs
defense in depth: inspect tool definitions, isolate credentials, preserve human
approval for irreversible actions, and prefer stronger VM isolation for high-value
secrets or untrusted content.

The bundled MCP server is trusted only for demonstration. Treat every external tool
description and result as untrusted input. If the lock file changes, the client emits
`mcp.tool_definition_changed` and refuses the tool call rather than accepting a
silent capability change.

## Further reading

- [MCP architecture and lifecycle](https://modelcontextprotocol.io/docs/learn/architecture)
- [MCP security best practices](https://modelcontextprotocol.io/docs/tutorials/security/security_best_practices)
- [Anthropic's sandboxing report](https://www.anthropic.com/engineering/claude-code-sandboxing)
- [Claude Code subagents](https://code.claude.com/docs/en/sub-agents)
