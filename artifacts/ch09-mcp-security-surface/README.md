# ch09: the MCP security surface, exploit then defend

This artifact is a pair of real, local MCP stdio servers:

| file | posture |
|---|---|
| vulnerable_mcp_server.py | deliberately permits the four demonstrated attack paths |
| hardened_mcp_server.py | enforces catalog integrity, resource locking, authorization policy, and egress gating |

Both endpoints speak newline-delimited JSON-RPC and implement the MCP lifecycle,
tools/list, and tools/call for protocol revision 2025-11-25. The deterministic client
in mcp_security.py has a readable walkthrough of the same JSON-RPC server core. Its
`--test` suite launches both stdio endpoints, performs the handshake, and drives every
exploit through those methods. It is safe to run: no tool contacts a network, reads a
local file, or uses a real secret.

## Run it

    cd artifacts/ch09-mcp-security-surface
    python3 mcp_security.py
    python3 mcp_security.py --attack 2
    python3 mcp_security.py --test
    bash check.sh

- Runtime: Python 3.9+ and the standard library only.
- No API key, network, or third-party package is required.
- The SSH key and every secret value are obvious local fakes. Never put a real secret in
  a tool result, test fixture, or model context.
- check.sh resolves its own directory, so it also runs from the repository root.

The two server files are normal stdio endpoints. A real client can spawn either one.
The test suite starts both entrypoints as child processes, sends lifecycle messages and
tool calls over stdout and stdin for all four paths, and verifies that the vulnerable
endpoint leaks while the hardened endpoint blocks the same sequence.

## What the pair demonstrates

| # | demonstrated path | where the poison lives | hardened control |
|---|---|---|---|
| 1 | indirect prompt injection | public issue text | per-session resource locking |
| 2 | reviewed-baseline rug pull | a changed tool catalog after approval | canonical full-catalog integrity |
| 3 | confused deputy | injected request for downstream billing data | authorization policy and no token transit |
| 4 | output poisoning | a provider runtime result | trusted egress gate |

The second row is deliberately a **rug pull**, not an initial Tool Poisoning Attack.
The reviewed catalog in the lab is the benign `web_search` baseline; the rug-pull
scenario supplies its later changed descriptor.
The hardened host compares the whole canonical tool definition, including name, title,
description, input schema, annotations, and execution metadata. It withholds unknown
tools and every changed descriptor until review. The scanner only adds a diagnostic. It
does not decide trust, and it does not establish an initial baseline.

That distinction matters. Initial tool poisoning needs onboarding review and an allowlist.
Post-approval catalog mutation needs a pin and change detection. The suite proves both
boundaries: an unknown clean descriptor and a clean description with a changed schema are
both quarantined.

## Trusted provenance and the scoreboard

The trusted gateway classifies every result from an untrusted provider as
attacker-controlled and marks the session tainted **before** returning the text to the
client. Neither a provider-supplied hint nor a credulous client decides that provenance. A
direct protocol sequence that omits any agent-level metadata still hits the egress gate
after an untrusted result, private read, and external send.

Sensitivity is tracked independently. A private inbox or RAG retrieval can contain
attacker-controlled text while also returning private data, so one source can set both
labels before the result reaches the client. The deterministic suite drives that combined
source through the hardened stdio endpoint and proves the egress gate blocks the send.
It also proves that a direct private-data send without a preceding untrusted result needs
explicit human approval. The policy therefore cannot label a plain [B]+[C] path as benign.
It does not try to discover sensitivity by scanning returned strings.

The World scoreboard records only simulated external sends. It reports success only when
one of the modeled private values reaches that boundary. Its tracked secret set is derived
from every value in PRIVATE_FILES plus the modeled billing record, so the fake .env value
cannot silently evade the result.

The test suite also feeds a malformed provider `inputSchema` to the hardened endpoint. The
trusted catalog boundary quarantines it before argument validation, returns a deterministic
rejection, and keeps the same stdio session usable.

The pair also follows the MCP Tools error contract: invalid values for a known tool return a
`tools/call` result with `isError: true`, while an unknown tool name returns JSON-RPC
`-32602`. Both paths leave the local session usable.

## Authentication boundary modeled here

The pair uses a deterministic, already-validated Token fixture to make the trusted issuer,
intended-recipient check, exact scope, and no-transit rules observable. Its `aud` field makes
the JWT-style case easy to see. The vulnerable Billing path checks only the fixture's trusted
issuer, which models the issuer-only failure. The hardened endpoint also accepts a client
token for audience acme-mcp at its local ingress, rejects injected direct billing access before
Billing is called, and gives a legitimate order read a separate audience billing token with
only read:orders. The client token never reaches Billing.

This is real MCP over stdio, not a live OAuth deployment. It does not verify JWT signatures,
discover protected-resource metadata, contact an authorization server, or perform token
exchange. Those omissions are intentional and stated so a reader does not mistake the
fixture for production authentication. The security lesson is the boundary placement and
data flow, which the local protocol exchanges exercise deterministically.
