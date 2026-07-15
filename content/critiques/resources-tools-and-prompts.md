verdict: approve

## Round 1 review (2026-07-15)

Fresh-eyes review: read `src/chapters/resources-tools-and-prompts.mdx`, its controller
taxonomy figure and primitive-explorer widget, the `primitives.py` artifact, and the Chapter 7
research backbone; ran the standalone artifact check and `npm run check`; and checked the MCP
server-concepts and specification sources plus Anthropic's tool-design and tool-search articles.
The chapter's one axis, who controls invocation, is materially accurate and consistently carried
through prose, diagram, widget, and a server that exposes all three primitives over one dataset.

The artifact now rejects a pre-handshake primitive request and only accepts calls after
`notifications/initialized`. That makes its claim to be a real stdio MCP server testable instead
of merely presenting wire-shaped JSON.

## Advisories

- Client support for resources and prompts changes quickly. The chapter appropriately frames its
  issue-tracker evidence as time-sensitive; re-test the target client rather than treating a
  support matrix as permanent.
- The tool-search evaluation results are vendor-reported and model-specific. They demonstrate
  the value of lazy discovery, not a universal expected gain.
