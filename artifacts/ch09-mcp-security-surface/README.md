# ch09 - the MCP security surface: exploit, then defend

The earlier chapters built a server that survives a chaos client. This one survives a
hostile world. The same tools are wired to a deliberately **credulous agent**, and four
attacks are run against them twice: once against a **vulnerable** server that trusts
everything, once against a **hardened** server whose controls are architectural, not
probabilistic. You watch the exploit land, then watch it get blocked.

The agent is credulous on purpose. It treats the text inside a tool result and the text
inside a tool description as instructions to follow, because that is exactly what a
language model does: it cannot separate a trusted instruction from attacker-controlled
data once both sit in the same context window. That credulity is not a bug in the file.
It is the faithful model of the vulnerability the chapter is about.

## Run it

```
cd artifacts/ch09-mcp-security-surface
python3 mcp_security.py           # every attack on the vulnerable server, then the hardened one
python3 mcp_security.py --test    # deterministic assertions: all four land on vulnerable, all four blocked on hardened
python3 mcp_security.py --attack 1   # run one attack (1..4) on both postures, verbose
```

- **Runtime:** Python 3.9+, standard library only.
- **No key, no network, no third-party package.** Nothing here reaches the internet; the
  "attacker endpoint" is a string an exfiltration tool writes to an in-process log.
- The SSH key is a fake. Never put a real secret anywhere an agent can read.

## The four attacks and the control that stops each

| # | attack | where the poison lives | stopped by |
|---|--------|------------------------|------------|
| 1 | indirect prompt injection (GitHub toxic-agent flow) | a public issue's text | per-session **resource locking** |
| 2 | tool poisoning (TPA) | a tool's **description** | **description scanning + pinning** (a backstop) |
| 3 | confused deputy / token passthrough | an injected escalation | **audience validation, no passthrough** |
| 4 | output poisoning (ATPA) | a tool's runtime **result** | the **exfiltration gate** (Rule of Two) |

The scoreboard is a `World` object: an attack **succeeds** only when a secret actually
crosses the trust boundary and lands somewhere the attacker controls. Not whether the
agent misbehaved, but whether private data escaped. On the hardened server, nothing does.

### Why the controls differ, and why that is the point

Each attack is stopped by a *different* control, and none of them is a classifier that
tries to decide whether some text is malicious.

- **Attack 1** is stopped before the exfiltration even starts: the session is scoped to
  one repo, so the injected read of a *different* private repo is denied. This is the
  Docker MCP Gateway "one repository per session" idea. It structurally blocks the
  public to private jump the toxic-agent flow depends on.
- **Attack 2** is caught by a description scan and a trust-on-first-use pin. This one is
  honest defense in depth, **not** a boundary: Full-Schema Poisoning hides the same
  instruction in a parameter name, type, or enum where a description scan never looks,
  and adaptive attacks defeat classifiers. If the scan is bypassed, attack 2 becomes
  attack 4, and the exfiltration gate is what has to catch it.
- **Attack 3** is stopped by refusing to present a token downstream unless its audience
  is the downstream service. The vulnerable `BillingAPI` trusts by issuer alone, so a
  token minted for the MCP server (`aud=acme-mcp`, `scope=read:orders`) is served billing
  data it was never meant to touch. The hardened server validates the audience and never
  passes a client token through, per the 2025-11-25 spec's `MUST NOT`.
- **Attack 4** hides the instruction in a tool's *runtime output*, so no static scan of
  tool definitions can ever see it. It is stopped by the Rule of Two exfiltration gate:
  one session that combines untrusted input, private data, and an external send is the
  full lethal trifecta, and the hardened server refuses the send without human approval.
  The "private data" leg is tracked by provenance, a session flag set the moment any
  private file or record is read, not by matching the outgoing bytes against known
  secrets. That is deliberate: the gate removes a leg, it does not inspect the payload.
  Note also that repo-locking (attack 1's control) deliberately does not govern the local
  home directory `~`, so the SSH-key read here is not caught by the lock; a real deployment
  would reach `~/.ssh` through a different server entirely, which is exactly why the
  exfiltration gate, not the resource lock, has to be the control that contains this path.

## What is real and what is reduced

Real: the tokens carry audience and scope claims and are checked the way the spec
requires; the downstream service trusts the wrong thing the way real services do; the
`World` records exactly what left the boundary. Reduced: to keep the run deterministic
without a live model, injected prose carries a machine-readable `<<PLAN>>...<<END>>`
block that the credulous agent honors. A real LLM needs no marker; it just follows the
English. The simplification is in the *parser*, not in the *lesson*: the lesson is that
following instructions found in data is the whole vulnerability, and only architecture,
not detection, reliably contains it.
