verdict: revise

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

## Round 5 review (2026-07-15)
Fresh independent re-review: read `prompts/critique-rubric.md`, the chapter notes and
research reference, `src/chapters/mcp-security-surface.mdx`, its figure and widget, the
full Chapter 9 artifact (README, deterministic check, client, protocol core, and both
stdio entrypoints), and the complete prior critique history. Re-verified that the
resolved Round 2 through Round 4 fixes remain present. Ran `npm run check` successfully
(validation, prose lint, all artifact checks, 25 Vitest tests, typecheck, production
build, and lint) and ran `bash artifacts/ch09-mcp-security-surface/check.sh`
successfully. Spot-checked the current MCP Tools and Authorization specifications,
Willison's lethal-trifecta analysis, Invariant's demonstrations, MCPTox, The Attacker
Moves Second, CaMeL, Meta's Rule of Two, and the cited ecosystem reports. I also ran a
safe local combined-source probe against the hardened gateway. The executable pair runs
its four programmed paths, but that probe bypasses its egress model; the current prose
and figure also make consequential claims beyond their evidence.

## Required fixes
1. **`src/chapters/mcp-security-surface.mdx:4-10,41-44,54-60` --- separate the MCP protocol from the host's trust-boundary failure.** The opening says every tool result is attacker-controlled and calls MCP itself an indirect-injection machine. That contradicts the artifact's correct provenance model, where the trusted gateway taints only results from an explicitly untrusted provider (`artifacts/ch09-mcp-security-surface/security_mcp.py:348-350,515-523`; `README.md:60-64`). The [MCP Tools specification](https://modelcontextprotocol.io/specification/2025-11-25/server/tools) does not mandate a user-interaction or model-context architecture, and [Willison's trifecta](https://simonwillison.net/2025/Jun/16/the-lethal-trifecta/) requires exposure to content an attacker can control. Recast the thesis as vendor-neutral dataflow: an *untrusted* tool result or metadata can enter a host's model context, and risk closes only when that host also grants sensitive capability and an outbound or destructive action. Remove the claims that every MCP-equipped agent, tool result, or the protocol itself has those properties.
2. **`src/chapters/mcp-security-surface.mdx:9-10,50-52,167-181,183-211,223-229` --- scope the claims about what defenses prove.** “Injection cannot be solved,” “the only containment that holds is architectural,” and the repeated universal contrast between classifiers and architecture are not established by the cited evidence. [The Attacker Moves Second](https://arxiv.org/abs/2510.09023) bypasses 12 evaluated defenses under stated adaptive threat models, not every non-architectural control; [CaMeL](https://arxiv.org/abs/2503.18813) proves properties only under its design and threat assumptions; [Meta's Rule of Two](https://ai.meta.com/blog/practical-ai-agent-security/) is a supplement rather than a sufficient condition. State the supported conclusion: current detection is not a reliable universal boundary, while trusted policy enforcement can constrain defined flows only within its threat model. Preserve the explicit need to gate destructive as well as exfiltration-capable actions.
3. **`src/chapters/mcp-security-surface.mdx:146-162` and `docs/research/ch09-mcp-security-surface.md:36,45,48,100` --- repair the evidence populations and attribution for the ecosystem claims.** Astrix analyzed 5,205 GitHub repositories and their README-level credential signals with LLM-assisted inference, not live “scanned servers”; Equixly describes assessments of selected popular implementations, not deployed servers; and Trend Micro correlates crawled public-directory metadata with a prior automated analysis plus randomized manual verification, rather than auditing production deployments. Name those methods and retain the directional-evidence caveat beside the figures, rather than leaving it only in the source list. Also attribute the “first documented full RCE on a client's own operating system” wording for CVE-2025-6514 to [JFrog's report](https://jfrog.com/blog/2025-6514-critical-mcp-remote-rce-vulnerability/) or remove it: the linked [NVD record](https://nvd.nist.gov/vuln/detail/CVE-2025-6514) supports the CVE and RCE, not the historical superlative.
4. **`src/chapters/_figures/McpSecuritySurfaceFigure.tsx:85-95` --- do not draw the three lethal-trifecta legs as mutually exclusive.** The `[B]+[C] no untrusted input in this session` row reads as a safe pair, yet the chapter itself says a single email or RAG tool can be both private-data access and an untrusted-input source (`mcp-security-surface.mdx:41-44`). [Noma's Rule-of-Two critique](https://noma.security/blog/mcp-servers-agentic-risk-and-the-framework-that-protects-it/) makes the same point: untrusted text can be embedded in retrieved sensitive data. Redraw the overlap or add a prominent qualification such as “only if the private-data source is not also untrusted,” so the figure cannot teach a false two-property safety condition.
5. **`artifacts/ch09-mcp-security-surface/security_mcp.py:414-416,515-523,550-571` and its deterministic tests --- make the hardened egress gate handle a result that is both untrusted and private.** The gateway marks every provider result tainted, but only separate file and Billing reads set `read_private`; the gate requires both flags. A safe local probe that returns the modeled `roadmap.md` value from untrusted `read_issue`, then calls `http_get`, reports `tainted: true`, `secret_escaped: true`, and one exfiltration. That is the chapter's own email/RAG overlap, and it contradicts the stated full-trifecta control. Track sensitivity and untrusted provenance independently, add a modeled A+B source path, and assert that hardened egress blocks it.
6. **`src/chapters/mcp-security-surface.mdx:124-136` and `docs/research/ch09-mcp-security-surface.md:41-43` --- do not require a literal `aud` claim for every MCP access token.** The 2025-11-25 authorization specification requires a server to validate that a token is intended for it, including the audience claim **or otherwise verifying that it is the intended recipient**. The deterministic lab can use `aud` to make the JWT-style case visible, but the prose and research reference must not present that one mechanism as the only compliant path, especially for opaque or introspected tokens. Source: [MCP Authorization 2025-11-25](https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization).

## Advisories
- `src/chapters/_widgets/McpSecuritySurfaceWidget.tsx:75-76` says an egress gate “must still contain a bypass.” Make the direction explicit: the egress gate contains the attempted exfiltration *after* a scanner or catalog-integrity bypass.
- `artifacts/ch09-mcp-security-surface/mcp_security.py:604-607` labels its assertion as an stdout-cleanliness check, but it directly asserts only empty stderr. JSON parsing gives partial stdout coverage; rename the assertion or add an explicit stdout assertion.
- Tighten the remaining categorical source language: Full-Schema Poisoning depends on what a client parses into model context, tool-description pinning addresses post-approval change rather than a general “last gap,” and closed-source or `0.0.0.0`-bound servers are elevated-review conditions rather than automatically unsafe in every deployment.

## Round 6 review (2026-07-15)
Fresh independent follow-up: read the complete critique history, the current chapter,
figure, widget, research reference, runnable artifact, and Chapter 9 notes. Re-ran
`npm run check` and `bash artifacts/ch09-mcp-security-surface/check.sh`; both pass.
Reproduced the Round 5 combined-source egress bypass and ran a separate safe malformed-
catalog probe against the hardened server. Checked the current MCP Authorization and
Security Best Practices documents. The current `revise` state remains correct. This
round records only two new material defects and does not re-litigate prior findings.

## Required fixes
1. **`artifacts/ch09-mcp-security-surface/security_mcp.py:691-739,806-825` --- reject malformed untrusted tool descriptors before schema validation can crash the hardened stdio server.** `_call_tool` invokes `_validate_args` before the `try` block and before the trusted catalog boundary. `_validate_args` dereferences `descriptor["inputSchema"].get(...)` from the raw provider catalog. With an initialized hardened server whose provider advertises `{"name":"web_search","inputSchema":null}`, `tools/call` raises `AttributeError: 'NoneType' object has no attribute 'get'`; `serve_stdio` does not catch it, so the process terminates instead of quarantining or returning a protocol error. A malicious provider can use malformed schema metadata as a denial-of-service rug pull, contradicting the artifact's claim that the hardened gateway owns full-catalog integrity. Structurally validate and vet the descriptor at the trusted boundary before accessing its schema, return a deterministic rejection, and add a regression test for the executable hardened endpoint.
2. **`src/chapters/mcp-security-surface.mdx:117-122` and `docs/research/ch09-mcp-security-surface.md:38-43` --- state all confused-deputy preconditions and the actual authorization-code attack flow.** The current prose says a static client ID plus a retained consent cookie causes the authorization server to skip consent and lets an attacker obtain a code. The MCP Security Best Practices instead requires four conditions: a static client ID, dynamic MCP-client registration, the third-party consent cookie, and absent per-client consent. The attacker must then send a malicious link containing a crafted authorization request and redirect URI, which the user follows before the code reaches the attacker. Name those conditions and the required per-client-consent mitigation so a reader does not mistake the two stated conditions for a sufficient exploit. Source: [MCP Security Best Practices](https://modelcontextprotocol.io/docs/tutorials/security/security_best_practices).

## Advisories
- No new advisories. The unresolved Round 5 advisories remain advisory.

## Builder resolution (2026-07-15)
Regression gate: re-verified every required fix from Rounds 1 through 6 against the
current chapter, figure, widget, research reference, README, deterministic client, and
vulnerable and hardened MCP stdio pair. Round 1 had no required fixes. The Round 2
authorization, trusted-boundary, scope, simulation-fidelity, and source repairs remain
true. The Round 3 catalog-integrity, provenance, scoreboard, empirical-scope, and evidence
repairs remain true. The Round 4 real-server, factual, isolation-boundary, and illustrative
example repairs remain true. The following closes all six Round 5 and both Round 6 fixes.

1. Recast the chapter opening, trifecta, indirect-injection, metadata, and defense sections
   in `src/chapters/mcp-security-surface.mdx` around host-controlled dataflow. An untrusted
   result or metadata field becomes dangerous when a host places it in model context alongside
   sensitive capability and an outbound or destructive action. The chapter no longer assigns
   those properties to every MCP tool, agent, or the wire protocol itself.
2. Scoped the detector and architectural-control claims in the chapter and
   `docs/research/ch09-mcp-security-surface.md`. The Attacker Moves Second now remains tied
   to its twelve tested defenses and adaptive threat models, CaMeL to its interpreter and
   policy assumptions, and the Rule of Two to a useful supplement rather than a sufficient
   proof. The revised guidance explicitly gates destructive as well as exfiltration-capable
   actions.
3. Repaired the ecosystem evidence trail in the chapter and research reference. Astrix is
   now a 5,205-GitHub-repository README and LLM-inference study, Equixly is an assessment of
   selected popular implementations, Trend Micro is a public-directory correlation with prior
   automated analysis and randomized manual verification, and the CVE-2025-6514 historical
   characterization is attributed to JFrog.
4. Updated `McpSecuritySurfaceFigure.tsx` so `[B]+[C]` is not presented as safe when private
   retrieved data can also carry untrusted text. Its visible label, accessibility text, and
   lesson band now make the overlap explicit.
5. Extended `security_mcp.py` with a trusted-host classification for a modeled private inbox
   source that is also untrusted. The session records untrusted provenance and sensitivity
   independently before returning the result, and the egress gate blocks the combined
   `[A]+[B]+[C]` flow. In-memory and real hardened-stdio regressions assert an empty
   `World.exfiltrated` log.
6. Corrected authorization wording in the chapter and research reference. MCP validates that
   a token is intended for its server; the lab's `aud` fixture is now explicitly a JWT-style
   example rather than the only compliant mechanism for opaque or introspected tokens.
7. Hardened catalog handling in `security_mcp.py`: a descriptor is structurally validated and
   vetted at the trusted boundary before argument validation accesses `inputSchema`.
   `malformed-schema` now produces a deterministic catalog-integrity rejection, and the
   executable hardened endpoint remains usable after it.
8. Completed the confused-deputy account in the chapter and research reference with all four
   preconditions, the crafted authorization-request and redirect-URI link flow, and the
   required per-client-consent mitigation.
9. Tightened the hardened egress policy in `security_mcp.py` so any modeled private value
   needs human approval before it crosses an external boundary, including a direct
   private-data-plus-egress path with no untrusted-provider taint. Added in-memory and
   executable-stdio regressions in `mcp_security.py`, then documented the conservative
   policy in the chapter, widget, and artifact README.
10. Narrowed the GitHub toxic-agent summary in the research reference to the host/context
    composition that ingests attacker-controlled issue content beside private capability and
    a public sink, rather than assigning the failure to every agent or model using the server.

Advisories taken: clarified that the egress gate contains an attempted exfiltration after a
scanner or catalog-integrity bypass, renamed the stdio assertion to cover its actual stderr
check, and narrowed remaining categorical wording about tool-schema parsing, description
pinning, and elevated-review server signals.

Verification: `bash artifacts/ch09-mcp-security-surface/check.sh` passes all deterministic
assertions, including the combined-source, direct-private-egress, and malformed-descriptor
executable regressions.
`npm run check` passes validation, prose lint, pipeline and artifact tests, Vitest, typecheck,
production build, and lint. The registry status remains `draft` for independent re-review.

## Round 7 review (2026-07-15)
Fresh independent re-review: read `prompts/critique-rubric.md`, the chapter notes and
research reference, `src/chapters/mcp-security-surface.mdx`, its figure and widget, the
complete runnable artifact and README, and the complete prior critique history. Re-verified
that the resolved Round 2 through Round 6 fixes remain present in the current artifacts.
Ran `npm run check` successfully, including the Chapter 9 deterministic MCP artifact suite,
Vitest, typecheck, production build, and lint. Checked the consequential claims below against
the current [MCP Authorization specification](https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization),
[MCP Security Best Practices](https://modelcontextprotocol.io/docs/tutorials/security/security_best_practices),
and [Equixly's March 2025 assessment](https://equixly.com/blog/2025/03/29/mcp-server-new-security-nightmare/).
The figure, widget, and executable pair remain materially truthful and teaching. The two new
required fixes are source-precision issues in the prose.

## Required fixes
1. **`src/chapters/mcp-security-surface.mdx:165-169` --- do not assign Equixly's path-traversal and SSRF rates to the shell-concatenation pattern.** Equixly reports 43% command injection, 22% path traversal or arbitrary file read, and 30% unrestricted URL fetching as separate findings. Its shell-metacharacter example appears under its distinct command-injection section. The chapter's trailing "from the familiar pattern of user parameters concatenated into a shell call" grammatically explains all three rates, which teaches the wrong cause and remedy for path traversal and SSRF. Split the claims: retain the three directional rates, then say that the command-injection cases illustrate the string-built shell-call pattern; give path traversal and SSRF their own mechanisms or leave them as separately reported classes.
2. **`src/chapters/mcp-security-surface.mdx:133-146` --- make the downstream-credential rule conditional rather than a universal MCP requirement.** The HTTP authorization profile requires intended-recipient validation and prohibits transiting the client token. It says an MCP server *may* act as an OAuth client to an upstream API, in which case that API uses a separate token issued by its authorization server. It does not require every downstream integration to obtain a separately issued token: another independently authorized mechanism can be appropriate. Replace "it must obtain a separately issued token" with a conditional rule such as: if the server calls a downstream API with OAuth, use a separate credential issued for that resource and never transit the client token. Keep RFC 8693 as one optional issuance pattern.

## Advisories
- **`src/chapters/mcp-security-surface.mdx:138-141` --- attribute the detailed token-passthrough risk list to Security Best Practices.** The authorization specification establishes validation and no transit; the enumerated control-circumvention, audit-trail, and cross-service-reuse rationale is presented in the linked Security Best Practices page. This is correct in substance, but the attribution can be exact.
- **`artifacts/ch09-mcp-security-surface/security_mcp.py:472,687-697`, README, and chapter run instructions --- consider making the positive human-approval handoff observable.** The lab correctly demonstrates refusal without approval, but `human_approved` has no modeled approval transition or positive regression. This is non-blocking because the artifact explicitly models a safe local boundary and its failure mode is meaningful; a future polish pass could document the handoff as out of band or add a constrained approved-flow test.

## Round 8 review (2026-07-15)
Fresh independent follow-up: read `prompts/critique-rubric.md`, the Chapter 9 notes and
research reference, the current chapter, figure, widget, full runnable artifact, README,
and the complete critique history. Re-ran `npm run check` and
`bash artifacts/ch09-mcp-security-surface/check.sh`; both pass. Drove the local vulnerable
and hardened paths for attacks 1 and 3, then checked the current MCP Authorization and
Security Best Practices documents, Equixly's cited assessment, and Willison's
lethal-trifecta analysis. Round 7's source-precision fixes remain open and are not
re-litigated here. This round records two new widget defects that materially misstate the
chapter's dataflow model.

## Required fixes
1. **`src/chapters/_widgets/McpSecuritySurfaceWidget.tsx:83-103` --- show the confused-deputy egress step, or stop calling the displayed result an exfiltration.** The vulnerable trace stops after Billing returns the record, yet the widget hard-codes `EXFILTRATED` for every vulnerable posture. The executable attack instead follows `read_billing` with `http_get` to `attacker.example` (`artifacts/ch09-mcp-security-surface/security_mcp.py:77-91`). Add that send to the widget's vulnerable path and align its injected source text, or label the shown result as unauthorized data access. As drawn, it skips the external leg that the chapter's own lethal-trifecta model requires for the claimed loss.
2. **`src/chapters/_widgets/McpSecuritySurfaceWidget.tsx:117-127` --- do not say that only an egress-leg control can contain output poisoning.** Static catalog inspection cannot see a runtime payload, but a trusted resource lock, dataflow isolation that prevents private data reaching the requested action, or an egress gate can each break this modeled trifecta path. The categorical claim contradicts the chapter's own rule at `src/chapters/mcp-security-surface.mdx:36-53` that removing or gating any leg breaks the autonomous-exfiltration path. Reword it as the egress control used in this scenario, while retaining the point that static catalog scanning alone cannot contain runtime output poisoning.

## Advisories
- `src/chapters/mcp-security-surface.mdx:104-106` makes a precise historical claim about MCP re-approval requirements without a direct source in the list. Add a source such as [Semgrep's MCP security guide](https://semgrep.dev/blog/2025/a-security-engineers-guide-to-mcp/) for traceability. This is non-blocking because the claim is otherwise substantively supported.

## Round 9 review (2026-07-15)
Fresh independent review: read `prompts/critique-rubric.md`, the Chapter 9 notes and
research reference, the current chapter, figure, widget, full runnable artifact, README,
and complete critique history. Ran `bash artifacts/ch09-mcp-security-surface/check.sh` and
`npm run check`; both pass. Reviewed the current artifacts for regressions of the resolved
Round 2 through Round 6 findings and found none. The unresolved Round 7 and Round 8 findings
remain recorded and are not re-litigated here. Checked the new findings against the official
[MCP Tools error-handling contract](https://modelcontextprotocol.io/specification/2025-11-25/server/tools#error-handling),
[MCP 2025-11-25 changelog](https://github.com/modelcontextprotocol/modelcontextprotocol/blob/main/docs/specification/2025-11-25/changelog.mdx),
[Meta's Agents Rule of Two](https://ai.meta.com/blog/practical-ai-agent-security/), and
[Trail of Bits' mcp-context-protector description](https://blog.trailofbits.com/2025/07/28/we-built-the-security-layer-mcp-always-needed/).
The figure remains truthful, and the artifact's deterministic safety model remains useful,
but the following new protocol and source-attribution defects block approval.

## Required fixes
1. **`artifacts/ch09-mcp-security-surface/security_mcp.py:589-590,830-836` and `artifacts/ch09-mcp-security-surface/mcp_security.py:601-615` --- align the advertised MCP endpoint with the 2025-11-25 tool-error contract.** A known tool called with an invalid schema value currently returns JSON-RPC `-32602` at `security_mcp.py:830-834`, and the deterministic test asserts that behavior. The MCP Tools specification puts input validation errors in a `tools/call` result with `isError: true`. In the other direction, an unknown tool raises `Blocked("unknown-tool")` at `589-590` and the broad handler maps it to `tool_err` at `835-836`, although the specification classifies unknown tools as protocol errors. Keep policy denials such as catalog integrity and authorization as tool errors, but make an absent tool name a protocol-error path, make known-tool argument validation a tool-execution-error path, and update the regression tests for both cases.
2. **`src/chapters/mcp-security-surface.mdx:211-217` and `docs/research/ch09-mcp-security-surface.md:80,93-95` --- do not attribute an unconditional fresh-context-plus-human rule to Meta's Agents Rule of Two.** Meta says that when all three properties are needed *without starting a new session*, the agent must not operate autonomously and needs supervision, which can be human approval or another reliable validation mechanism. It also gives a safe one-way configuration transition as an alternative. The chapter says Meta requires both a fresh context and a human in the loop for every all-three task, which changes the framework's prescribed tradeoff. Describe the source's conditional rule accurately, then label any stricter fresh-context-and-human deployment policy as this chapter's recommendation rather than Meta's.

## Advisories
- **`src/chapters/mcp-security-surface.mdx:225-228` --- qualify the trust-on-first-use description of `mcp-context-protector`.** The tool blocks a newly seen server until a user manually reviews and approves its instructions, descriptions, and parameter descriptions, then pins that reviewed configuration and blocks unapproved changes. Add the manual initial review so "pins ... on first use" does not imply automatic trust on first contact. The post-approval change-detection lesson remains sound.
- The Round 7 and Round 8 advisories remain as recorded.

## Builder resolution (2026-07-15)
Regression gate: re-verified every required fix from Rounds 1 through 9 against the
current chapter, figure, widget, research reference, README, deterministic client, and
vulnerable and hardened MCP stdio pair. Round 1 had no required fixes. The Round 2 through
Round 4 authorization, trusted-boundary, source, provenance, catalog-integrity, and
artifact-fidelity repairs remain present. The Round 5 and Round 6 host-controlled dataflow,
combined-source egress, malformed-descriptor, and confused-deputy fixes remain covered by
both in-memory and executable-stdio regressions. The following closes the six required
items from Rounds 7 through 9.

1. Split Equixly's findings in `src/chapters/mcp-security-surface.mdx` and
   `docs/research/ch09-mcp-security-surface.md`: only its command-injection examples
   illustrate string-built shell calls; the reported path-traversal and SSRF rates remain
   distinct vulnerability classes with their own controls.
2. Made the downstream-credential rule conditional in the chapter and research reference.
   The HTTP authorization profile requires intended-recipient validation and no client-token
   transit. When an MCP server acts as an OAuth client to an upstream API, it uses that API's
   separately issued credential; other integrations can use another independently authorized
   mechanism. RFC 8693 remains an optional issuance pattern.
3. Corrected the widget's confused-deputy trace to include the vulnerable
   `http_get attacker.example` egress step before displaying `EXFILTRATED`, and scoped the
   output-poisoning lesson to the egress control used in that modeled path. The widget now
   names trusted resource locking, dataflow isolation, and egress policy as alternative ways
   to break a comparable trifecta path.
4. Aligned `security_mcp.py` with the MCP Tools error contract. Known-tool argument
   validation now returns a `tools/call` result with `isError: true`; an absent tool name
   returns JSON-RPC `-32602`; policy denials remain tool execution errors. The deterministic
   in-memory and hardened-stdio suites assert both response shapes and that the session
   remains usable afterward.
5. Corrected the Rule of Two account in the chapter and research reference. Meta's
   supervision condition applies when all three properties are needed without a fresh session,
   allows human approval or another reliable validation mechanism, and includes a safe
   one-way transition. The stricter fresh-context-plus-human approach is now identified as
   this chapter's conservative deployment policy.
6. Took the cheap source-precision advisories: attributed the detailed token-passthrough
   rationale to Security Best Practices, added Semgrep's historical changed-tool source,
   and described `mcp-context-protector` as blocking a first-seen server until manual review
   before pinning the reviewed configuration.

Verification: `bash artifacts/ch09-mcp-security-surface/check.sh` passes every deterministic
artifact regression. `npm run check` passes validation, prose lint, pipeline and artifact
tests, Vitest, typecheck, production build, and lint. The registry status remains `draft` for
independent re-review.

## Round 10 review (2026-07-15)

### Method

Read `prompts/critique-rubric.md`, the full prior critique history, chapter note and research
brief, the complete chapter MDX, its figure and widget, and every Chapter 9 artifact file
(`README.md`, `check.sh`, both MCP endpoint wrappers, `mcp_security.py`, and
`security_mcp.py`). Rechecked the Round 9 resolutions for regression. Ran `npm run check` and
`bash artifacts/ch09-mcp-security-surface/check.sh`, both of which passed. I also exercised
attack 3 directly and sent a malformed `initialize` request to the hardened in-memory server.
Source checks covered the [MCP 2025-11-25 schema](https://modelcontextprotocol.io/specification/2025-11-25/schema),
the [MCP Tools specification](https://modelcontextprotocol.io/specification/2025-11-25/server/tools),
[MCP Security Best Practices](https://modelcontextprotocol.io/docs/tutorials/security/security_best_practices),
the [NVD record for CVE-2025-49596](https://nvd.nist.gov/vuln/detail/CVE-2025-49596), and
[Oligo's Inspector analysis](https://www.oligo.security/blog/critical-rce-vulnerability-in-anthropic-mcp-inspector-cve-2025-49596).

## Required fixes

1. **`artifacts/ch09-mcp-security-surface/security_mcp.py:780-807` --- Reject malformed
   `initialize` parameters before the lifecycle begins.** The 2025-11-25 schema requires
   `protocolVersion`, `capabilities`, and a `clientInfo` object containing string `name` and
   `version` fields. The current server accepts an `initialize` request containing only
   `{"protocolVersion":"2025-11-25"}`, accepts `notifications/initialized`, and then serves
   `tools/list`. That contradicts the artifact's advertised protocol-level MCP lifecycle.
   Validate the required fields and types, return JSON-RPC `-32602` without setting
   `initialize_received` on failure, and add in-memory and stdio regressions showing that a
   rejected malformed request is followed by a valid successful handshake.

2. **`src/chapters/_figures/McpSecuritySurfaceFigure.tsx:73-83` --- Restore the visible
   third leg of the attack path.** The opaque lesson-band rectangle is painted after the
   `[3] result` label and the B-to-context arrow. It begins at `x=300, y=306`, clipping the
   label and masking part of that arrow. The figure therefore presents the central four-step
   sequence as discontinuous. Reposition or resize the lesson band and reroute the label and
   path as needed so all four numbered steps remain fully visible, then visually verify the
   result at its rendered size.

3. **`src/chapters/mcp-security-surface.mdx:174-176` --- State the Inspector RCE's local
   vulnerable-service precondition.** The current wording implies that merely visiting a
   malicious page reaches RCE. CVE-2025-49596 affects MCP Inspector versions below `0.14.1`;
   the attack route requires its unauthenticated local Inspector proxy to be running, with a
   malicious page supplying the browser-side request. Qualify the claim with that precondition
   while retaining the CVE, CVSS, and cited Oligo/NVD sources.

## Advisories

- Carry forward Round 7's non-blocking suggestion to make a positive human-approval handoff
  observable in the runnable artifact. `human_approved` still has no modeled transition or
  positive regression, but this unchanged condition remains an advisory under the prior
  review's explicit classification.
- `src/chapters/mcp-security-surface.mdx:74-77` overstates EchoLeak's reported avoidance as a
  classifier that scans for exactly one term. Cato's account is more precise: recipient-directed
  framing and omission of AI, assistant, or Copilot terminology made XPIA detection difficult
  in that chain.
- `src/chapters/mcp-security-surface.mdx:104-111` would be more technically exact if it said
  the host/model invokes a trusted tool with attacker-directed parameters, rather than saying
  the trusted server itself "complies." The surrounding explanation already assigns the boundary
  to the host.
- The widget's live region reports the binary outcome but not the selected scenario or path.
  Adding a concise scenario-specific summary, plus interaction coverage for each scenario and
  the hardened toggle, would make the signature widget more accessible and less prone to UI
  regression.

## Round 11 review (2026-07-15)

Fresh independent re-review: read `prompts/critique-rubric.md`, the complete critique
history, the chapter note and research reference, the full chapter MDX, figure, widget, and
every Chapter 9 artifact file. Re-ran `npm run check` and
`bash artifacts/ch09-mcp-security-surface/check.sh`, both of which pass. Direct protocol
probes confirmed that the hardened endpoint accepts an underspecified `initialize` request and
that a session scoped to `acme/website` successfully reads `acme/private-inbox#99` through
`read_issue`, marking it sensitive. I checked the MCP 2025-11-25 Lifecycle and Schema
Reference, the NVD and Oligo records for CVE-2025-49596, and the cited Trail of Bits
description. The current Round 10 required fixes remain open and are not re-litigated here.
This round records one additional artifact and widget contradiction.

## Required fixes

1. **`artifacts/ch09-mcp-security-surface/security_mcp.py:621-633,672-684`,
   `artifacts/ch09-mcp-security-surface/mcp_security.py:571-597`, and
   `src/chapters/_widgets/McpSecuritySurfaceWidget.tsx:42-52` --- Make the claimed
   resource lock match every private-read path.** `TrustedHostGateway.call_tool()` sends every
   `read_issue` request directly to the provider, without the `allowed_repo` check used only
   by `read_repo_file`. A hardened `acme/website` session therefore returns the modeled private
   `acme/private-inbox#99` source with `isError: false`; the current deterministic suite
   intentionally proves that behavior and relies on the later egress gate to contain it. The
   widget nevertheless says that the trusted host scopes the session to `acme/website` and
   denies a read of *any other repo*. That is false, and it makes the resource-lock lesson
   overstate what the hardened boundary contains. Either enforce resource authorization across
   `read_issue` and every private source, or narrow the chapter, README, and widget to describe
   the attack-1 `read_repo_file` restriction and the separate combined-source egress policy.
   Add an in-memory and stdio regression for a cross-repository `read_issue` so the stated
   boundary cannot drift again.

## Advisories

- No new advisories. The existing Round 10 advisories remain advisory.

## Round 12 review (2026-07-15)

Fresh independent review: read prompts/critique-rubric.md, the complete critique history,
the chapter note and research reference, the current chapter, figure, widget, and all
Chapter 9 artifact files. Ran npm run check successfully, including validation, all
artifact assertions, Vitest, typecheck, production build, and lint. Checked the official
MCP 2025-11-25 schema and the cited primary/first-party accounts for CaMeL and EchoLeak:
Willison's Dual LLM write-up and later CaMeL analysis, the CaMeL paper, and Cato's
EchoLeak report. The open Round 10 and Round 11 required fixes remain recorded and are
not re-litigated here. This round adds two new source-accuracy defects.

## Required fixes

1. **src/chapters/mcp-security-surface.mdx:74-81 --- correct the EchoLeak egress
   topology.** The chapter says Copilot placed sensitive data in a markdown image URL that
   the client auto-fetched directly to the attacker. Cato's account says an evil.com image
   was blocked by the page's img-src CSP; the successful chain placed the attacker URL and
   secret inside a CSP-allowlisted Microsoft Teams asyncgw proxy URL, and that proxy fetched
   the attacker endpoint. Name the allowlisted-proxy hop and retain the distinction between
   an automatic client image fetch and the eventual server-side attacker request. This is
   material to the chapter's CSP and outbound-capability lesson. Source: Cato, “Breaking
   down EchoLeak,” steps 3–4.

2. **src/chapters/mcp-security-surface.mdx:225-231 --- separate Willison's Dual LLM
   pattern from CaMeL's architecture.** The joined sentence makes the privileged-model /
   quarantined-model / tagged-variable design sound like the shared mechanism of Dual LLM
   and CaMeL. Willison describes that as his two-LLM proposal, then explicitly says CaMeL
   addresses a flaw in it. The CaMeL paper instead centers a protective layer that extracts
   control and data flows from the trusted query and enforces capability policy at tool
   calls. Split the accounts: describe Dual LLM's two-model isolation and variable handoff
   as Willison's pattern, then describe CaMeL's restricted interpreter and capability
   tracking as its distinct design. Its optional quarantined-LLM use in examples should not
   erase that architectural difference. Sources: Willison, “The Dual LLM pattern” and
   “CaMeL offers a promising new direction”; Debenedetti et al., “Defeating Prompt
   Injections by Design” (arXiv:2503.18813).

## Advisories

- The Round 10 XPIA precision advisory remains: Cato documents recipient-directed wording
  that omits AI, assistant, and Copilot terms, not a classifier that scans for one exact
  word.
- **src/chapters/mcp-security-surface.mdx:74 --- attribute the EchoLeak CVSS score.**
  Microsoft assigns CVSS 3.1 9.3, while NVD assigns 7.5. “Microsoft CVSS 9.3” retains the
  cited score without implying that it is the only assessment.

## Builder resolution (2026-07-15)

Regression gate: re-verified every required fix from Rounds 1 through 12 against the
current chapter, figure, widget, research reference, README, deterministic client, and
vulnerable and hardened MCP stdio pair. Round 1 had no required fixes. The resolved
Rounds 2 through 9 authorization, trusted-boundary, provenance, catalog-integrity,
artifact-fidelity, source-scope, combined-source, no-transit, error-contract, and
Rule-of-Two repairs remain covered by the chapter and deterministic regressions.

1. Hardened `initialize` validation in
   `artifacts/ch09-mcp-security-surface/security_mcp.py`: `protocolVersion`, a
   `capabilities` object, and `clientInfo.name` plus `clientInfo.version` are required
   before the lifecycle state changes. New in-memory and stdio regressions reject the
   malformed request with `-32602`, ignore the premature initialized notification, and
   complete a valid handshake on the same connection.
2. Moved the Figure 9.1 lesson-band rectangle behind the numbered attack path in
   `src/chapters/_figures/McpSecuritySurfaceFigure.tsx`, so the B-to-context arrow and
   `[3] result` label paint above it and the four-step sequence remains continuous.
3. Qualified the MCP Inspector case in the chapter and research reference: the
   browser-side route requires an unauthenticated local Inspector proxy in a vulnerable
   version below `0.14.1` to already be running before a malicious page can send it a
   request.
4. Applied the trusted resource lock to `read_issue` before any provider result reaches
   model context. The artifact now has in-memory and stdio regressions for a denied
   cross-repository issue read, while the combined private-and-untrusted source runs only
   in an explicitly authorized session. The widget and README describe that boundary
   precisely.
5. Corrected EchoLeak's egress topology and source attribution in the chapter and
   research reference. The direct attacker image is CSP-blocked; the successful automatic
   request goes through the CSP-allowlisted Microsoft Teams `asyncgw` proxy, which fetches
   the attacker endpoint. The text now attributes the 9.3 score to Microsoft and uses
   Cato's recipient-directed XPIA account.
6. Split Willison's Dual LLM pattern from CaMeL in the chapter and research reference.
   Dual LLM now owns the privileged/quarantined-model and symbolic-variable handoff;
   CaMeL now owns its distinct control-and-data-flow extraction, restricted interpreter,
   and capability enforcement at tool calls.

Advisories taken: the EchoLeak wording and CVSS attribution from Round 10 and Round 12
are now precise. The remaining previously recorded advisories remain non-blocking.

Verification: `bash artifacts/ch09-mcp-security-surface/check.sh` passes all deterministic
artifact regressions. `npm run check` passes validation, prose lint, pipeline and artifact
tests, Vitest, typecheck, production build, and lint. The registry status remains `draft`
for independent re-review.

## Builder resolution (2026-07-15)

Follow-up self-review: re-verified the Round 10 through Round 12 fixes against the current
chapter, figure, widget, research reference, README, and MCP artifact. The lifecycle,
resource-lock, EchoLeak-topology, and Dual-LLM/CaMeL repairs remain in place.

1. Corrected `src/chapters/_widgets/McpSecuritySurfaceWidget.tsx` so its indirect-injection
   explanation says the allowed untrusted issue can reach context, while the resource lock
   blocks the later cross-repository private result before it returns to the model.
2. Added a scenario-specific polite live announcement to the widget, so changing either the
   attack or the hardened posture produces meaningful screen-reader feedback.
3. Increased the contrast of Figure 9.1's critical explanatory labels with `--fg-muted`.
   The attack path remains painted above the lesson band. A live browser preview was not
   available in this environment, so the figure layering was checked in source and through
   the production build.

Verification: `npm run check` passes. The critique remains `verdict: resolved`, and the
registry status remains `draft` for independent re-review.

## Round 13 review (2026-07-15)

Fresh independent re-review: read `prompts/critique-rubric.md`, the complete critique
history, Chapter 9 notes and research reference, the full chapter, figure, widget, and
every Chapter 9 artifact file. Re-verified the resolved source-scope, trusted-boundary,
lifecycle, resource-lock, EchoLeak-topology, and Dual-LLM/CaMeL fixes in the current
artifacts. Ran `bash artifacts/ch09-mcp-security-surface/check.sh` and `npm run check`;
both pass. Exercised the real vulnerable stdio endpoint with a percent-encoded local fake
SSH fixture and replayed attacks 2 and 4. Spot-checked the current
[MCP Authorization specification](https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization),
[MCP Security Best Practices](https://modelcontextprotocol.io/docs/tutorials/security/security_best_practices),
[Cato's EchoLeak report](https://www.catonetworks.com/blog/breaking-down-echoleak/),
[Noma's GitLost report](https://noma.security/blog/gitlost-how-we-tricked-githubs-ai-agent-into-leaking-private-repos/),
and the [Attacker Moves Second](https://arxiv.org/abs/2510.09023) and
[CaMeL](https://arxiv.org/abs/2503.18813) papers. The prose, figure, cited claims, and
the prior material repairs remain sound. These two new artifact and widget defects block
approval.

## Required fixes

1. **`artifacts/ch09-mcp-security-surface/security_mcp.py:153-166,699-709`, `artifacts/ch09-mcp-security-surface/mcp_security.py:823-967`, and `artifacts/ch09-mcp-security-surface/README.md:85-88` --- make the scoreboard correctly recognize a modeled secret after ordinary URL transport encoding.** `World.leaked_secret()` searches only for a literal raw fixture inside the recorded URL. In a real vulnerable stdio session, read the fake SSH key with `read_repo_file`, percent-encode it for the `http_get` URL, then call `lab_status`: it reports `exfiltration_count: 1` but `secret_escaped: false`. The secret crossed the modeled external boundary, yet the stated test oracle calls it safe. This is new rather than a re-opened Round 3 finding: that round added every raw fixture to the tracked set, while the current transport representation still creates a false negative. Track modeled-secret provenance at the boundary or normalize the modeled URL payload consistently, and add both in-memory and stdio regressions for the encoded form. The hardened endpoint currently blocks this request, but the artifact's advertised vulnerable-leak proof is false for a normal encoding path.
2. **`src/chapters/_widgets/McpSecuritySurfaceWidget.tsx:58-76,110-128` and `artifacts/ch09-mcp-security-surface/security_mcp.py:97-127` --- align each displayed poisoned input with the exfiltration action its trace executes.** The rug-pull source says only to send the key so results can be personalized, while the trace jumps to `http_get attacker.example`. The output-poisoning source says to resend the key as an `auth` argument, while its trace also jumps to `http_get attacker.example`. The executable strings repeat the same visible text but hide the actual HTTP action in a separate `<<PLAN>>`; `python3 mcp_security.py --attack 2` and `--attack 4` execute that hidden action. The signature widget therefore asks the reader to infer the [C] leg rather than showing that the displayed malicious content causes it. Make the visible untrusted excerpt and executable plan name the same outbound action, or change the trace to perform the action the source actually specifies. Keep one shared scenario definition or add a regression so the widget and runnable path cannot drift again.

## Advisories

- The Round 7 advisory remains appropriately non-blocking: `human_approved` has no modeled
  positive transition. The current boundary fails closed, but the README should label approval
  as an out-of-band trusted-host handoff or add a constrained approved-flow regression.
- `src/chapters/mcp-security-surface.mdx:20-23` could say that role markers do not create a
  hard trusted code/data enforcement boundary, rather than implying a model has no role
  hierarchy at all. The current wording supports the chapter's thesis but is unnecessarily
  absolute for this audience.

## Round 14 review (2026-07-15)

Fresh independent re-review: read `prompts/critique-rubric.md`, the complete critique
history, Chapter 9 notes and research reference, the full chapter MDX, figure, widget, and
all Chapter 9 artifact files. Re-ran `npm run check`, which passes validation, prose lint,
pipeline and artifact tests, Vitest, typecheck, production build, and lint. Reproduced the
open Round 13 encoded-secret false negative without re-litigating it. I then sent the
hardened server an otherwise valid `initialize` request with `id: {"malformed": true}`; it
returned a successful response with that object as its ID and set `initialize_received`.
Checked the official [MCP 2025-11-25 Schema Reference](https://modelcontextprotocol.io/specification/2025-11-25/schema), which defines `RequestId` as `string | number`. The local preview compiled, but a live browser binding was unavailable for a separate visual pass. Round 13's required fixes remain open and are not re-litigated here.

## Required fixes

1. **`artifacts/ch09-mcp-security-surface/security_mcp.py:786-800` and the deterministic artifact suite --- reject invalid JSON-RPC request IDs before lifecycle state changes.** `handle()` treats any present `id` as a request, so an object, boolean, or `null` ID is accepted, echoed in a successful `initialize` response, and advances the MCP lifecycle. The 2025-11-25 schema permits only string or number `RequestId` values. Validate IDs before the notification/request branch and before `initialize_received` can change, excluding Python `bool`; return `InvalidRequest` with a null response ID for malformed IDs. Add in-memory and stdio regressions that prove a malformed-ID `initialize` is rejected and a valid handshake can still complete on the same connection. The artifact describes itself as a protocol-level MCP pair, so accepting an invalid request as a successful lifecycle transition is material.

## Advisories

- No new advisories. The Round 13 advisories remain advisory.
