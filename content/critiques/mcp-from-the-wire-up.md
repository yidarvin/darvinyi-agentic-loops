verdict: approve

## Round 1 review (2026-07-15)

Fresh-eyes review: read `src/chapters/mcp-from-the-wire-up.mdx`, its handshake figure and
sequence widget, the `mcp_wire` subprocess artifact, and the Chapter 5 research backbone; ran
the standalone artifact gate and `npm run check`; and checked the current MCP specification,
release-candidate announcement, and AAIF announcement. The chapter teaches the wire-level
contract accurately at the `2025-11-25` boundary. In particular, it makes the useful distinction
between a JSON-RPC error and a successful tool result with `isError: true` visible in prose,
figure, widget, and executable trace.

The artifact is genuinely runnable from its own directory or the repository root. It uses two
processes and stdio framing rather than simulating a transcript, so the main teaching claim can
actually fail if the handshake or framing is broken.

## Advisories

- `2026-07-28` remains a release candidate at review time. Re-check the proposed stateless
  protocol migration and update the handshaking artifact during the release audit after the final
  specification and supported SDK versions are known.
