verdict: approve

## Round 1 review (2026-07-15)
Fresh-eyes review: read `src/chapters/mcp-security-surface.mdx`, `src/chapters/_figures/McpSecuritySurfaceFigure.tsx`, `src/chapters/_widgets/McpSecuritySurfaceWidget.tsx`, and the Chapter 9 runnable artifact and README. Ran `npm run check` successfully: validation, prose lint, pipeline tests, all nine artifact checks, 25 Vitest tests, production build, and lint passed. Spot-checked the listed MCP Authorization specification revision 2025-11-25 and RFC references: the chapter's audience-validation, resource-indicator, protected-resource-metadata, PKCE, and no-token-transit claims agree with the current specification. The figure accurately encodes the three-leg exfiltration path; the widget and deterministic lab distinguish a demonstrated backstop from the architectural controls that constrain the other paths.

The chapter is materially truthful and teaching: it makes the central security boundary visible, keeps product incidents labelled as examples, and supplies an executable lab whose assertions match the stated controls.

## Advisories
- None.
