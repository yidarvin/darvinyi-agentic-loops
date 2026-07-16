verdict: resolved

## Round 1 review (2026-07-15)
Fresh-eyes review: read `src/chapters/mcp-security-surface.mdx`, `src/chapters/_figures/McpSecuritySurfaceFigure.tsx`, `src/chapters/_widgets/McpSecuritySurfaceWidget.tsx`, and the Chapter 9 runnable artifact and README. Ran `npm run check` successfully: validation, prose lint, pipeline tests, all nine artifact checks, 25 Vitest tests, production build, and lint passed. Spot-checked the listed MCP Authorization specification revision 2025-11-25 and RFC references: the chapter's audience-validation, resource-indicator, protected-resource-metadata, PKCE, and no-token-transit claims agree with the current specification. The figure accurately encodes the three-leg exfiltration path; the widget and deterministic lab distinguish a demonstrated backstop from the architectural controls that constrain the other paths.

The chapter is materially truthful and teaching: it makes the central security boundary visible, keeps product incidents labelled as examples, and supplies an executable lab whose assertions match the stated controls.

## Advisories
- None.

## Round 2 review (2026-07-15)
Independent re-review of the current artifacts and the prior approval: read `src/chapters/mcp-security-surface.mdx`, `src/chapters/_figures/McpSecuritySurfaceFigure.tsx`, `src/chapters/_widgets/McpSecuritySurfaceWidget.tsx`, `artifacts/ch09-mcp-security-surface/{README.md,check.sh,mcp_security.py}`, and `docs/research/ch09-mcp-security-surface.md`. Ran `bash artifacts/ch09-mcp-security-surface/check.sh` and `npm run check`; both passed. Directly exercised the untested hardened `read_orders` path and its scope check. Checked the listed MCP Authorization specification revision 2025-11-25, the live Aim Labs EchoLeak URL, the cited MCPTox preprint and current AAAI publication, and the linked Equixly report. This round replaces the prior approval because the current artifact and cited evidence contain the material issues below.

## Required fixes
1. **`src/chapters/mcp-security-surface.mdx:123-137` and `artifacts/ch09-mcp-security-surface/mcp_security.py:329-342` --- do not present RFC 8693 Token Exchange as a mechanism the MCP 2025-11-25 authorization specification adopts or mandates.** The official authorization specification contains no `RFC 8693` or `Token Exchange` requirement. It requires audience validation, RFC 8707 resource indicators, and no client-token transit, with a separately issued token required for an upstream API. Reword RFC 8693 as one possible downstream implementation pattern when supported, and retain the actual MCP requirements as the normative rule. Source: [MCP Authorization 2025-11-25](https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization).
2. **`src/chapters/_widgets/McpSecuritySurfaceWidget.tsx:49-125`, `src/chapters/mcp-security-surface.mdx:207-209`, and the matching lab paths --- put the security controls on the trusted boundary that can actually enforce them.** The widget calls this the "same server" in a hardened posture, but a malicious MCP server cannot be trusted to scan or quarantine its own poisoned description. Per-session resource locking, description integrity, and egress gating belong to an agent host, gateway, or resource service outside the malicious server. Refactor the widget and lab to name those components and show their boundary. Keep description scanning explicitly as defense in depth, not the architectural control that proves the tool-poisoning outcome. The scanner-plus-TOFU display now conflicts with the chapter's central claim that classifiers are only a backstop.
3. **`src/chapters/_widgets/McpSecuritySurfaceWidget.tsx:85-101`, `artifacts/ch09-mcp-security-surface/mcp_security.py:329-358`, and exercise 03 --- teach the confused-deputy flow in the correct direction.** A client token with `aud=acme-mcp` is valid at the MCP server's ingress and must be validated there. The server must not offer that token to billing at all. A legitimate authorized downstream operation needs a distinct, scope-reduced billing-audience token; an injected billing read should be denied by the MCP server's authorization policy before a downstream call. The current hardened widget presents the client token to billing and describes billing's rejection as audience validation, which reverses the trust boundary the chapter is teaching. Align the widget, artifact, and exercise with the no-transit rule.
4. **`artifacts/ch09-mcp-security-surface/mcp_security.py:193-202,329-342,537-544` --- make the lab's authorization model and deterministic check prove their advertised invariant.** The hardened `read_orders` path creates `scope="read:orders"`, but `BillingAPI.read` requires the unrelated substring `read:billing`, so a legitimate secure request raises `Blocked: [scope] ...`; conversely, the direct probe accepted `scope="notread:billing"`. Implement resource-specific exact scope membership and test both the valid least-privilege path and a near-match rejection. The current test also treats a returned `BLOCKED` as proof that nothing leaked, even though it does not inspect `World.exfiltrated` after the attack functions catch `Blocked`. Assert the no-leak state directly so a leak followed by a block cannot pass the advertised security check.
5. **`artifacts/ch09-mcp-security-surface/{README.md,mcp_security.py}` and the chapter's runnable-artifact description --- make the artifact's fidelity claim accurate.** The lab directly calls an in-process Python method and has no MCP/JSON-RPC transport, initialization, or access-token validation, despite claiming that its protocol framing tracks MCP revision 2025-11-25 and that only the `<<PLAN>>` parser is reduced. Either implement the stated MCP boundary or consistently label this as an in-process threat-model simulation and remove the stronger claims. An expert reader must not mistake the demonstration for a runnable MCP server.
6. **`src/chapters/mcp-security-surface.mdx:71-72,149-161,171,182-195,281-310` --- repair the consequential evidence trail.** The listed Aim Labs EchoLeak URL now redirects to Cato's generic research index and no longer supports the case study. Replace it with a stable direct report, such as [Cato's EchoLeak analysis](https://www.catonetworks.com/blog/breaking-down-echoleak/), alongside the Microsoft advisory. Add direct Sources entries for the 2026 GitHub-defense bypass, Trend Micro's 9,695/2,259 result, Backslash's `0.0.0.0` finding, Prompt Guard 2's 97.5%/1% result, Docker's gateway example, and Meta's Agents Rule of Two. The rubric requires source links for consequential claims. Also reconcile the March 2025 date attributed to Equixly with the linked report, which is dated 2026-02-12, or cite the actual March 2025 assessment.

## Advisories
- The chapter calls MCPTox an AAAI benchmark while retaining the 1,312-case figure from the linked arXiv preprint. The final AAAI publication reports 1,348 cases. This does not change the lesson, but update the number and link to [the final paper](https://ojs.aaai.org/index.php/AAAI/article/view/40895) for a current source.
- The figure's danger path runs directly from untrusted content to the exfiltration sink while the normal arrows omit the agent's request to private data and its return. Add numbered request/result arrows so the figure cannot look as if injection bypasses the model.
- Several critical figure labels use 8 to 9.5px muted text. Increase their size or contrast for phone legibility. The figure's SVG semantics and overflow handling are otherwise sound.
- The widget controls are live and keyboard-operable. Consider making the changing outcome a polite live region for screen-reader feedback.

## Builder resolution (2026-07-15)
Regression gate: re-verified Round 1, which had no required fixes, and all six required
fixes from Round 2 against the current chapter, figure, widget, README, simulation, and
research reference. None regressed.

1. Rewrote the authorization discussion in `src/chapters/mcp-security-surface.mdx` and
   `docs/research/ch09-mcp-security-surface.md`: audience validation, resource indicators,
   protected-resource metadata, PKCE, and no client-token transit remain normative; RFC
   8693 is now an optional downstream issuance pattern rather than an MCP requirement.
2. Refactored `artifacts/ch09-mcp-security-surface/mcp_security.py` around an
   `UntrustedMcpProvider` and a separate `TrustedHostGateway`. Resource locking, catalog
   integrity, authorization policy, and egress gating now live at the trusted boundary.
   The tool-poisoning outcome is stopped by an approved catalog pin; the scanner is a
   diagnostic backstop. The chapter, README, and widget use the same boundary model.
3. Corrected the confused-deputy flow in the widget, exercise, and simulation. A client
   token for `aud=acme-mcp` is validated at gateway ingress; injected direct billing access
   is denied by authorization policy before Billing is called. Legitimate `read_orders`
   requires exact client `read:orders` scope and uses a distinct downstream
   `aud=billing`, `read:orders` token.
4. Replaced substring scope checks with exact scope membership and strengthened the
   deterministic lab. It now proves the valid least-privilege order path, rejects
   `notread:orders` and `notread:billing`, asserts an empty hardened `World.exfiltrated`,
   and confirms the blocked deputy path makes no Billing call.
5. Relabelled the runnable artifact consistently as an in-process threat-model simulation.
   Its README, module docstring, and chapter text now explicitly exclude MCP/JSON-RPC
   transport, initialization, live authorization-server interaction, and cryptographic
   token validation.
6. Repaired the evidence trail: replaced the stale EchoLeak link with Cato plus
   Microsoft's advisory; added direct sources for GitLost, Trend Micro, Backslash, Prompt
   Guard 2, Docker's interceptor demonstration, and Meta's Rule of Two; linked Equixly's
   actual March 2025 report; and updated MCPTox to the final AAAI paper and its 1,348 cases.

Advisories taken: updated the MCPTox figure, added numbered model-mediated request/result
arrows and larger figure labels, and made the widget outcome a polite live region.

Verification: `bash artifacts/ch09-mcp-security-surface/check.sh` passes 22 assertions and
`npm run check` passes.

## Round 3 review (2026-07-15)
Fresh independent re-review: read `src/chapters/mcp-security-surface.mdx`,
`src/chapters/_figures/McpSecuritySurfaceFigure.tsx`,
`src/chapters/_widgets/McpSecuritySurfaceWidget.tsx`,
`artifacts/ch09-mcp-security-surface/{README.md,check.sh,mcp_security.py}`, and
`docs/research/ch09-mcp-security-surface.md`. Read the full prior critique history and
re-verified the Round 2 resolution against the current artifacts. The resolved RFC 8693,
trusted-boundary placement, confused-deputy, exact-scope, simulation-fidelity, and prior
source-link fixes remain present. Ran `bash artifacts/ch09-mcp-security-surface/check.sh`
and `npm run check`; both pass, including the 22 artifact assertions, 25 Vitest tests,
typecheck, production build, and lint. I then exercised three safe probes outside the
happy-path drivers: a poisoned provider result replayed through a hardened gateway without
the agent-supplied taint marker produced `tainted: False` and a recorded leak; a new
unapproved descriptor with no scanner signature was accepted by the hardened catalog; and a
defined `.env` secret recorded in `World` was reported as `BLOCKED`. I also checked the
current MCP authorization specification, the two cited NVD records, MCPTox, The Attacker
Moves Second, Prompt Overflow, and the Noma Rule-of-Two critique against the chapter's
claims. These are new material defects, not re-litigation of the resolved Round 2 work.

## Required fixes
1. **`src/chapters/_widgets/McpSecuritySurfaceWidget.tsx:55-77`, `artifacts/ch09-mcp-security-surface/mcp_security.py:256-304`, and `artifacts/ch09-mcp-security-surface/README.md:42-65` --- make catalog integrity teach the threat it can actually contain.** The displayed attack begins with a malicious `web_search` description, while the hardened path calls it a description that "changed" from an approved pin. That models a post-approval rug pull, not an initial Tool Poisoning Attack. The chapter itself distinguishes the two at `mcp-security-surface.mdx:90-105`. The lab has only one approved description and `_vet_tool_descriptor` returns every unpinned, scanner-clean descriptor unchanged; a hardened probe of `new_export` had no approved baseline, no scanner match, and `quarantined: False`. Trust-on-first-use can detect a later change, not establish that the first definition was safe, and a description-only pin does not cover the full schema. Either relabel and model this explicitly as a reviewed-baseline rug pull, including a canonical full-catalog/schema pin and unknown-tool quarantine, or add a distinct initial-poisoning case that teaches onboarding review/allowlisting and the egress backstop. Add deterministic coverage for an unknown descriptor and a changed schema.
2. **`artifacts/ch09-mcp-security-surface/mcp_security.py:218-225,307-309,348-357,440-443` --- move untrusted-input provenance into the trusted gateway rather than trusting an agent boolean.** `untrusted_output` is declared on provider tools but never consumed by `call_tool`; the egress gate only blocks when `CredulousAgent.ingest(..., untrusted=True)` has set `Session.tainted`. Retrieving the poisoned `currency_convert` result from a hardened gateway and driving its contained plan through that same gateway without calling `ingest` left `tainted` false and recorded a secret leak. This contradicts the chapter and README claim that the trusted host owns the egress boundary. Make the gateway attach or persist provenance when it returns untrusted provider content, carry it through tool-call inputs, and add a regression test proving that a caller cannot bypass the gate by omitting an agent-supplied flag.
3. **`artifacts/ch09-mcp-security-surface/mcp_security.py:60-64,154-159,487-489` and `README.md:47-49` --- make the scoreboard recognize every secret the model declares private.** `PRIVATE_FILES` includes the `.env`/JWT value, but `World.leaked_secret()` tests only the SSH key, roadmap, and billing suffix. A direct safe probe recorded that `.env` value in `World` and `_world_result()` returned `BLOCKED`. Derive the tracked secret set from the modeled private data, or explicitly reduce the model's stated secret set, and add a regression assertion that this leak is classified as exfiltration.
4. **`src/chapters/mcp-security-surface.mdx:110-113,223-224` and `docs/research/ch09-mcp-security-surface.md` --- restore the scope of the two empirical security claims.** MCPTox reports that more capable models were *often* more susceptible in its 20 evaluated settings, not an unqualified universal relationship. The Attacker Moves Second achieved above-90% attack success against most of 12 tested recent defenses, not against published classifier defenses generally. Qualify both passages and the corresponding research notes to match their sources: [MCPTox](https://ojs.aaai.org/index.php/AAAI/article/view/40895/44856) and [The Attacker Moves Second](https://arxiv.org/abs/2510.09023).
5. **`src/chapters/mcp-security-surface.mdx:155-177,200-201,290-329` --- complete the remaining consequential evidence trail.** The listed NVD records substantiate the basic CVE descriptions, but not the fuller Inspector and `mcp-remote` narratives at lines 155-158; either narrow those claims or add the underlying [Oligo](https://www.oligo.security/blog/critical-rce-vulnerability-in-anthropic-mcp-inspector-cve-2025-49596) and [JFrog](https://jfrog.com/blog/2025-6514-critical-mcp-remote-rce-vulnerability/) reports with accurate attribution. Lines 162-163 assert that rates barely moved after a year without a named, comparable longitudinal source. Lines 175-177 need the directly relevant [Prompt Overflow](https://arxiv.org/abs/2605.23196) source for the segment-splitting mechanism. Lines 200-201 attribute the Rule-of-Two limitation to unnamed critics; name and link a critique such as [Noma's analysis](https://noma.security/blog/mcp-servers-agentic-risk-and-the-framework-that-protects-it/), or present the point as the chapter's own inference. The project rubric makes these linked, scoped claims required rather than optional polish.

## Advisories
- `src/chapters/mcp-security-surface.mdx:124-135` accurately describes the cited authorization requirements, but should note that this is the optional HTTP authorization profile. The current specification says STDIO implementations should not follow that profile.
- `src/chapters/mcp-security-surface.mdx:90-94` presents users as seeing only a tool name. Phrase this as a common simplified UI rather than a universal interface behavior.

## Round 4 review (2026-07-15)
Independent follow-up: read `prompts/notes/mcp-security-surface.md`, the current
chapter, figure, widget, full runnable artifact, README, research reference, and the full
critique history. Ran `npm run check`, which passes validation, prose lint, pipeline and
artifact checks, 25 Vitest tests, production build, and lint. Re-exercised the hardened
artifact boundary with safe local probes and checked the linked Invariant and CyberArk
primary reports plus the MCP authorization specification. The Round 3 required fixes remain
open. This round records only new defects, without re-litigating those findings.

## Required fixes
1. **`prompts/notes/mcp-security-surface.md:16-23`, `src/chapters/mcp-security-surface.mdx:233-253`, and `artifacts/ch09-mcp-security-surface/{README.md,mcp_security.py}` --- deliver the specified runnable MCP server pair.** The chapter note makes a deliberately vulnerable MCP server paired with a hardened counterpart a hard artifact requirement. The delivered artifact accurately labels itself an in-process threat-model simulation and explicitly omits MCP/JSON-RPC transport, initialization, live authorization, and cryptographic token validation. That simulation is useful, but it cannot satisfy a requirement to run the exploit and mitigation through an MCP server. Add a minimal, locally safe vulnerable/hardened MCP pair with deterministic tests that exercise both paths, or obtain an explicit change to the chapter's hard requirement.
2. **`src/chapters/mcp-security-surface.mdx:67-68` and `docs/research/ch09-mcp-security-surface.md:19` --- remove or directly substantiate the asserted JWT secret from a private `.env`.** The listed [Invariant toxic-agent report](https://invariantlabs.ai/blog/mcp-github-vulnerability) and its linked [public proof-of-concept pull request](https://github.com/ukend0464/pacman/pull/2) support the private-repository names, relocation plan, and salary details, but not the JWT claim. This is a precise factual claim in the chapter's canonical attack example. Link a durable trace that establishes it or generalize the sentence to the evidence the listed source actually provides.
3. **`src/chapters/mcp-security-surface.mdx:105-109` --- put the missing isolation boundary on the host/context architecture rather than assert a protocol-level MCP guarantee.** The chapter says “MCP enforces no isolation between connected servers.” Invariant's [tool-poisoning report](https://invariantlabs.ai/blog/mcp-security-notification-tool-poisoning-attacks) instead demonstrates a client or agent whose context includes descriptions from all connected servers and recommends cross-server protection at that layer. Recast the claim as a property of a host that aggregates those descriptions into one model context, then state that the host must impose the isolation and dataflow boundary. The current wording misplaces the security responsibility.
4. **`src/chapters/mcp-security-surface.mdx:136-139` and the Sources list --- substantiate or de-attribute the exact “Zuplo” two-resource-server example.** The chapter attributes the `/mcp/orders` and `/mcp/billing` scenario to Zuplo, but the source list contains no Zuplo reference and the exact example is not independently verifiable from the listed evidence. Add the direct source or present it clearly as an illustrative two-resource-server scenario rather than a cited case.

## Advisories
- `src/chapters/mcp-security-surface.mdx:95` and `docs/research/ch09-mcp-security-surface.md:28` date CyberArk's Full-Schema and Advanced Tool Poisoning report to June 2025. The primary [CyberArk post](https://www.cyberark.com/resources/threat-research-blog/poison-everywhere-no-output-from-your-mcp-server-is-safe) is dated May 30, 2025. “Late May 2025” is exact.
- `src/chapters/mcp-security-surface.mdx:98-101` should narrow “no static analysis of tool definitions can catch it” to static catalog or metadata inspection. A runtime-only payload is absent from the definition, but static analysis of the tool's own source or logic can still be useful.

## Builder resolution (2026-07-15)
Regression gate: re-verified Rounds 1 through 4 against the current chapter, figure,
widget, research reference, and runnable artifact. Round 1 had no required fixes. The six
Round 2 fixes remain true: the authorization profile no longer presents RFC 8693 as
mandatory, trusted controls remain outside the provider, the deputy flow checks ingress and
does not transit the client token, exact scopes remain enforced, artifact fidelity now exceeds
the earlier simulation, and the prior source repairs remain present. Every Round 3 and Round
4 required fix is implemented below.

1. Replaced the simulation-only artifact with a real local MCP stdio server pair in
   artifacts/ch09-mcp-security-surface/security_mcp.py,
   vulnerable_mcp_server.py, and hardened_mcp_server.py. Both endpoints implement
   initialize, notifications/initialized, tools/list, and tools/call over JSON-RPC. The
   deterministic client and check suite drive attacks through those MCP methods and also
   start both entrypoints as subprocesses.
2. Recast attack 2 as a reviewed-baseline rug pull in the artifact, README, widget, and
   chapter. The hardened host now pins a canonical complete tool definition, quarantines
   unknown descriptors, and detects a changed input schema even when a scanner has no match.
   The scanner remains a diagnostic backstop, while onboarding review and allowlisting cover
   initial tool poisoning.
3. Moved untrusted-result provenance into the trusted gateway. The gateway marks a session
   tainted before returning an untrusted provider result, and a direct MCP tools/call
   regression sequence proves the egress gate cannot be bypassed by omitting an agent flag.
4. Derived World scoreboard secrets from all modeled private values, including the fake
   .env value and billing record, and added an assertion for each modeled secret.
5. Preserved the no-transit authorization invariant with protocol-level tests for a distinct
   downstream billing token, exact scope membership, near-match rejection, ingress audience
   validation, and the absence of a downstream call on the injected billing path.
6. Qualified the MCPTox and The Attacker Moves Second claims in the chapter and research
   reference to their stated evaluated settings and tested defenses.
7. Completed the consequential evidence trail: added Oligo, JFrog, Prompt Overflow, and
   Noma links; removed the unsupported longitudinal claim; and scoped the Rule-of-Two
   limitation to Noma's cited analysis.
8. Removed the unsupported JWT-from-.env claim from the toxic-agent example and research
   reference. The artifact's fake .env value remains only a local scoreboard fixture.
9. Recast cross-server isolation as a host/context boundary, de-attributed the two-resource
   server example as illustrative, took the two low-cost wording advisories, and corrected
   CyberArk's date to late May 2025.

Verification: bash artifacts/ch09-mcp-security-surface/check.sh and npm run check pass.

## Builder resolution (2026-07-15)
Follow-up regression gate: re-verified every required fix from Rounds 1 through 4 against
the current chapter, figure, widget, research reference, README, and MCP server pair. The
prior fixes still hold. This pass also closed three material artifact regressions discovered
during the final chapter-scoped self-review.

1. Made output provenance a policy owned by `TrustedHostGateway` in
   `artifacts/ch09-mcp-security-surface/security_mcp.py`. Every result from a modeled
   untrusted provider now taints the hardened session before it reaches the client. A forged
   provider provenance marker cannot clear that taint, and the direct protocol regression
   confirms the egress gate leaves `World.exfiltrated` empty.
2. Made `tools/call` validate the provider's currently advertised input schema, including
   scalar types and enum values, then let the trusted catalog boundary quarantine unapproved
   descriptors. The lab now accepts valid dynamic schemas where the vulnerable endpoint
   advertises them, returns `-32602` rather than crashing on a malformed URL, and proves the
   same session remains usable after that error.
3. Made the confused-deputy simulation truthful about issuer-only validation. `BillingAPI`
   always checks the deterministic trusted issuer; only the vulnerable path omits audience
   and resource-scope checks. The hardened path still validates ingress audience, denies the
   injected billing operation before a downstream call, and mints a distinct least-privilege
   billing token for `read_orders`.
4. Removed the remaining uncited 2026 longitudinal rates from
   `docs/research/ch09-mcp-security-surface.md` and states the limitation instead of implying
   a comparable longitudinal result.

Verification: `bash artifacts/ch09-mcp-security-surface/check.sh` passes, and `npm run check`
passes validation, prose lint, pipeline tests, all artifact checks, 25 Vitest tests, the
production build, and lint.

## Builder resolution (2026-07-15)
Follow-up regression gate: re-verified every required fix from Rounds 1 through 4 against
the current chapter, figure, widget, research reference, README, and MCP server pair.
Round 1 had no required fixes. The Round 2 trusted-boundary, authorization, and source
repairs remain true; the Round 3 catalog-integrity, provenance, scoreboard, empirical-scope,
and evidence repairs remain true; and the Round 4 real-server, factual, isolation-boundary,
and illustrative-example repairs remain true.

1. Corrected MCP lifecycle version negotiation in
   `artifacts/ch09-mcp-security-surface/security_mcp.py`. An unsupported requested revision
   now receives a normal `initialize` response advertising the server's supported
   `2025-11-25` revision, and the deterministic suite verifies that a client which accepts
   that revision can proceed to `tools/list`.
2. Expanded `artifacts/ch09-mcp-security-surface/mcp_security.py` so its deterministic gate
   launches both stdio entrypoints and drives every one of the four attacks through the MCP
   lifecycle and `tools/call`, proving vulnerable leaks and hardened no-leak outcomes on the
   executable pair rather than only the in-memory core.
3. Clarified the chapter and artifact README: the walkthrough uses the same JSON-RPC server
   core, while `--test` drives each attack through the executable stdio endpoints; the
   reviewed catalog remains the explicit baseline for the rug-pull scenario.

Verification: `bash artifacts/ch09-mcp-security-surface/check.sh` and `npm run check` pass.
