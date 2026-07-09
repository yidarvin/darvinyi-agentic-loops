# Run Queue

Run order, top to bottom. The **next** item is the first `PENDING` row. Statuses:
`PENDING`, `DONE`, `SKIPPED`. Update the status cell after each run. Reorder by
moving rows. Adding a chapter means adding a `PENDING` row here and a matching
entry in `content/registry.json`. See `CLAUDE.md` for the trigger phrases and the
`refsite-runner` skill for the per-item procedure.

Per-chapter build notes live in `prompts/notes/<slug>.md`; each points at the
matching research doc in `docs/research/` and carries the runnable-artifact and
widget spec ported from the seed. Open the notes file before building a chapter.

| #  | slug                         | item                                            | status  |
|----|------------------------------|-------------------------------------------------|---------|
| 01 | the-loop                     | The Loop                                        | DONE    |
| 02 | anatomy-of-a-tool-call       | Anatomy of a Tool Call                          | DONE    |
| 03 | context-window-economics     | Context-Window Economics                        | PENDING |
| 04 | the-landscape                | The Landscape                                   | PENDING |
| 05 | mcp-from-the-wire-up         | MCP from the Wire Up                            | PENDING |
| 06 | transports                   | Transports                                      | PENDING |
| 07 | resources-tools-and-prompts  | Resources, Tools, and Prompts                   | PENDING |
| 08 | building-a-real-mcp-server   | Building a Real MCP Server                      | PENDING |
| 09 | mcp-security-surface         | The MCP Security Surface                        | PENDING |
| 10 | skills                       | Skills                                          | PENDING |
| 11 | skill-or-server              | Skill or Server                                 | PENDING |
| 12 | delegation                   | Delegation                                      | PENDING |
| 13 | coordination-patterns        | Coordination Patterns                           | PENDING |
| 14 | when-multi-agent-fails       | When Multi-Agent Fails                          | PENDING |
| 15 | memory-taxonomy              | The Memory Taxonomy                             | PENDING |
| 16 | prompt-caching-economics     | Prompt Caching and the Economics of Remembering | PENDING |
| 17 | retrieval-as-memory          | Retrieval as Memory                             | PENDING |
| 18 | self-managed-memory          | Self-Managed Memory                             | PENDING |
| 19 | stage-one-thin-wrapper       | Stage One: The Thin Wrapper                     | PENDING |
| 20 | stage-two-real-loop          | Stage Two: The Real Loop                        | PENDING |
| 21 | stage-three-production-grade | Stage Three: Production-Grade                   | PENDING |
| 22 | evaluating-agents            | Evaluating Agents                               | PENDING |

<!--
Adding a chapter: append a PENDING row here and a matching pending entry in
content/registry.json (same slug, same relative order). This book is mode "book",
so runs do not auto-append discovered items. Extra columns are fine as long as
every row has them (validate.py checks the column count is consistent).
-->
