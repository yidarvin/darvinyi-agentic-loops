verdict: approve

## Round 1 review (2026-07-15)

Fresh-eyes review: read `src/chapters/building-a-real-mcp-server.mdx`, its hardened-call
figure and chaos-client widget, both server implementations, and the Chapter 8 research
backbone; ran the standalone contract suite and `npm run check`; and checked the MCP
specification, release-candidate, FastMCP, and cited empirical-source trail. The chapter is
materially truthful and materially teaching: its figure and widget agree on the critical split
between protocol rejection, intentional tool failures, and masked internal faults.

The SQLite artifact is a real integration with a meaningful failure surface. Its deterministic
suite now verifies a pre-handshake rejection, argument validation, visible and masked failures,
and user-bound, expiring state handles. The same boundaries are visible in the walkthrough.

## Advisories

- FastMCP defaults and transport APIs are version-sensitive. The chapter links the framework
  documentation and correctly treats the framework-backed file as an optional, graceful
  enhancement; re-check it when upgrading the dependency.
- The third-party server and vulnerability measurements are directional evidence, not capacity
  or prevalence guarantees. The chapter keeps that caveat in its source framing.
