# ch09 - the MCP security surface: exploit, then defend

This is an **in-process threat-model simulation**, not a runnable MCP server. It has no
MCP/JSON-RPC transport, initialization handshake, live authorization server, or
cryptographic access-token validation. It models the information-flow and authorization
decisions that make the four attacks dangerous, so every result is deterministic and
safe to run locally.

An untrusted MCP tool provider supplies descriptions and results to a deliberately
**credulous agent**. A separate **trusted agent host/gateway** mediates private-resource
access, downstream authorization, and external actions. Each attack runs twice: once
with that trusted boundary permissive, once with its architectural controls enabled. You
watch the exploit land, then watch the trusted boundary block it.

The agent is credulous on purpose. It treats the text inside a tool result and the text
inside a tool description as instructions to follow, because that is exactly what a
language model does: it cannot separate a trusted instruction from attacker-controlled
data once both sit in the same context window. That credulity is not a bug in the file.
It is the faithful model of the vulnerability the chapter is about.

## Run it

```
cd artifacts/ch09-mcp-security-surface
python3 mcp_security.py           # every attack with a permissive boundary, then a hardened one
python3 mcp_security.py --test    # deterministic assertions: all four land when permissive, all four block when hardened
python3 mcp_security.py --attack 1   # run one attack (1..4) on both postures, verbose
bash check.sh                     # run the deterministic artifact check
```

- **Runtime:** Python 3.9+, standard library only.
- **No key, no network, no third-party package.** Nothing here reaches the internet; the
  "attacker endpoint" is a string an exfiltration tool writes to an in-process log.
- The SSH key is a fake. Never put a real secret anywhere an agent can read.
- `check.sh` resolves its own directory, so `bash artifacts/ch09-mcp-security-surface/check.sh`
  also works from the repository root.

## The four attacks and the control that stops each

| # | attack | where the poison lives | stopped by |
|---|--------|------------------------|------------|
| 1 | indirect prompt injection (GitHub toxic-agent flow) | a public issue's text | per-session **resource locking** |
| 2 | tool poisoning (TPA) | a tool's **description** | trusted **catalog integrity**; scanner is a backstop |
| 3 | confused deputy / token passthrough | an injected escalation | MCP **authorization policy**, no token transit |
| 4 | output poisoning (ATPA) | a tool's runtime **result** | trusted **egress gate** (Rule of Two) |

The scoreboard is a `World` object: an attack **succeeds** only when a secret actually
crosses the trust boundary and lands somewhere the attacker controls. Not whether the
agent misbehaved, but whether private data escaped. On the hardened boundary, nothing does.

### Why the controls differ, and why that is the point

Each attack is stopped by a *different* control, and none of them is a classifier that
tries to decide whether some text is malicious.

- **Attack 1** is stopped before the exfiltration even starts: the trusted host scopes
  the session to one repo, so the injected read of a *different* private repo is denied.
  This models Docker's "one repository per session" interceptor policy. It structurally
  blocks the public-to-private jump the toxic-agent flow depends on.
- **Attack 2** is stopped at the trusted host before the agent sees the changed tool
  definition. The host compares the provider's catalog against an approved pin; the
  description scanner is shown only as a diagnostic backstop. Full-Schema Poisoning can
  hide an instruction where a description scanner never looks, and adaptive attacks can
  bypass classifiers. If catalog integrity is not available, the egress gate must still
  contain the resulting exfiltration attempt.
- **Attack 3** starts with a client token whose `aud=acme-mcp`, which is valid at MCP
  ingress. The hardened host then denies the injected direct billing-record action under
  its MCP authorization policy, before it calls Billing at all. A legitimate
  `read_orders` call uses a distinct token issued for `aud=billing` with only
  `read:orders`; the client token is never sent downstream. RFC 8693 token exchange is
  one possible issuance pattern when supported, not an MCP requirement.
- **Attack 4** hides the instruction in a tool's *runtime output*, so no static scan of
  tool definitions can ever see it. The trusted egress gate stops it: one session that
  combines untrusted input, private data, and an external send is the full lethal
  trifecta, and the host refuses the send without human approval.
  The "private data" leg is tracked by provenance, a session flag set the moment any
  private file or record is read, not by matching the outgoing bytes against known
  secrets. That is deliberate: the gate removes a leg, it does not inspect the payload.
  Note also that repo-locking (attack 1's control) deliberately does not govern the local
  home directory `~`, so the SSH-key read here is not caught by the lock; a real deployment
  would reach `~/.ssh` through a different server entirely, which is exactly why the
  exfiltration gate, not the resource lock, has to be the control that contains this path.

## What is modeled and what is reduced

Modeled: a client credential has an audience and exact scopes; the trusted host validates
the client audience at ingress, requires exact `read:orders` scope before a legitimate
order read, never transits that credential downstream, and uses a separately issued
least-privilege billing credential. The
`World` records exactly what crossed the simulated egress boundary.

Reduced: this is not a wire-level MCP or OAuth implementation. It does not send or parse
JSON-RPC, perform MCP initialization, verify signatures, discover protected-resource
metadata, or contact an authorization server. Its `Token` objects stand in for already
validated claims. To keep the agent deterministic without a live model, injected prose
carries a machine-readable `<<PLAN>>...<<END>>` block that the credulous agent honors. A
real LLM needs no marker; it just follows the English. The simplification is in the
*transport and parser*, not in the information-flow lesson: architecture, not detection,
is what contains an attacker-controlled instruction.
