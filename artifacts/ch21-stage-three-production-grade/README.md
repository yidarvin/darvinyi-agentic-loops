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

The demo writes `.agent-memory/` and `verification.txt` under the chosen workspace.
It keeps `mcp-tool-lock.json` in a sibling `.stage-three-agent-state/` directory that
the sandboxed server cannot write. The memory file records durable project context;
the host-owned lock records pinned tool definitions. The verification file proves that
the approved process could write inside the workspace. It cannot write outside the
workspace when the Seatbelt profile starts.

The NDJSON stream includes events such as:

```text
memory.loaded
mcp.server_launch_requested
permission.decided
mcp.tool_pinned
mcp.connected
mcp.tool_result
subagent.started
subagent.summary
sandbox.started
sandbox.completed
run.completed
```

Omit `--approve-verification` to see the ask-tier shell operation stop before any
process starts. There is no global bypass-permissions flag.

## What the harness actually exercises

1. `stage_three_agent.py` establishes the project-memory root and performs host
   memory reads and writes through descriptor-relative, no-follow operations.
   It validates regular files before use and caps reads before decoding.
2. It displays the exact MCP server command and evaluates a distinct launch policy
   before `popen`. The bundled read-only server is reviewed; a custom command needs a
   matching policy rule or one task-scoped approval. The automatic demo-tool allowance
   applies only to the reviewed command and exact exposed tool, not a custom server
   that claims the `demo` namespace.
3. It starts an approved `mcp_demo_server.py` inside Seatbelt, performs `initialize`,
   discovers `tools/list`, maps the tool to `mcp__demo__read_project_brief`, and pins
   its normalized definition hash in host-owned state outside the server workspace.
   The client starts the direct server in its own session. The profile permits exec
   but denies process forks, preventing a server from daemonizing with `setsid()` and
   escaping lifecycle cleanup; the client also terminates and reaps the original
   process group on close or protocol abort. It also denies MCP reads and mutations
   for root `.env*` paths and `secrets/**`, matching the policy's secret boundary and
   rejecting protected pathnames. The bundled MCP server and host-owned readers also
   reject pre-existing multi-link files before reading them, so a protected file
   cannot be relabeled as an allowed workspace input.
4. It records the MCP tool result as untrusted data rather than treating it as an
   instruction.
5. It runs a fresh, read-only depth-one worker. The parent receives only the worker's
   capped summary, not a tool transcript.
6. It evaluates every permission rule in `deny`, `ask`, `allow` order. A denial always
   wins over a broader allow rule.
7. It launches the one approved shell command through Seatbelt. The generated profile
   allows writes only below `--workspace`, denies network, and scrubs common
   credential-shaped environment variables from child processes.

`check.sh` runs deterministic invariants, including a regression that forces Seatbelt
unavailable and proves the public demo cannot launch a child. On macOS with Seatbelt,
it also records and validates a full demo trace in a temporary workspace.

## Connect another local stdio MCP server

The probe accepts a quoted command for a compatible local stdio server and invokes a
named zero-argument tool. The supported custom-source contract is deliberately
narrow: put the Python server script inside the selected `--workspace` and invoke it
by a workspace-relative path. That source is inside the Seatbelt-readable workspace;
an arbitrary external absolute path is not a supported extension and fails closed.
Supported custom servers are single-process: the profile allows execution but rejects
forks so task-scoped approval cannot leave a detached workspace writer behind.
The exact server command appears in a distinct launch-policy decision before the
server starts. The server is still launched through the same fail-closed sandbox, and
its tool definitions still need to match the host-owned lock file. A non-demo server
receives no blanket allow rule, so give it a reviewed policy entry or use the
task-scoped launch approval while testing. It also needs a task-scoped tool approval
unless a policy rule matches that exact reviewed server and tool.

```bash
cp /absolute/path/to/server.py ./demo_workspace/custom_server.py
python3 stage_three_agent.py demo \
  --workspace ./demo_workspace \
  --server-name filesystem \
  --mcp-command 'python3 ./custom_server.py' \
  --mcp-tool read_project_brief \
  --approve-mcp-server \
  --approve-mcp-tool \
  --approve-verification
```

This lab intentionally implements the local stdio path only. A real host should use
a maintained MCP SDK, pin its protocol and SDK version, add timeouts and retries, and
separate credentials by server. Remote transports, OAuth, resources, prompts, and a
model adapter are deliberate next steps rather than hidden dependencies.

## Security boundary and limits

The policy is useful because it makes intent auditable. It is not the containment
boundary. Seatbelt constrains the subprocess after policy allows it to start. For
MCP children, the generated profile enforces the policy's `.env*` and `secrets/**`
denials for both reads and mutations. The bundled MCP server and host-owned readers
also reject pre-existing multi-link inputs before reading them, because pathname
rules alone cannot establish file provenance. Custom server code must apply the same
content-safe read rule to every workspace file it consumes. The profile has an
intentionally narrow writable area and no network. It still needs defense in depth:
inspect tool definitions, isolate credentials, preserve human approval for
irreversible actions, and prefer stronger VM isolation for high-value secrets or
untrusted content.

The bundled MCP server is trusted only for demonstration. Treat every external tool
description and result as untrusted input. The host keeps the lock outside the server's
writable workspace. If the definition changes, the client emits
`mcp.tool_definition_changed` and refuses the tool call rather than accepting a
silent capability change.

## Further reading

- [MCP architecture and lifecycle](https://modelcontextprotocol.io/docs/learn/architecture)
- [MCP security best practices](https://modelcontextprotocol.io/docs/tutorials/security/security_best_practices)
- [Anthropic's sandboxing report](https://www.anthropic.com/engineering/claude-code-sandboxing)
- [Claude Code subagents](https://code.claude.com/docs/en/sub-agents)
