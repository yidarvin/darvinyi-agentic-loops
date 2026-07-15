verdict: approve

## Round 1 review (2026-07-15)

Fresh-eyes review: read `src/chapters/transports.mdx`, its transport-framing figure and widget,
the `transports.py` artifact, and the Chapter 6 research backbone; ran the artifact's
deterministic core check and `npm run check`; and checked the current MCP transport
specification and the cited benchmark methodology. The chapter teaches the separation of
JSON-RPC meaning from byte framing well. Its one-server/two-transport artifact uses the same
`McpCore` for a subprocess pipe and loopback HTTP, so the central claim is executable rather
than decorative.

The review corrected the security modality: `Origin` validation is required, while localhost
binding and authentication are specification recommendations. The prose, README, and artifact
now make that distinction consistently.

## Advisories

- The throughput figures are intentionally framed as directional: they come from a trivial
  echo server on a local kind cluster. Re-run a representative benchmark before turning them
  into a production capacity estimate.
- The artifact demonstrates the stateful `2025-11-25` HTTP session model. Revisit it in the
  release audit when the `2026-07-28` specification finalizes.
