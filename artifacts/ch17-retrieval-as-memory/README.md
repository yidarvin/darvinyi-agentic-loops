# ch17 - persistent retrieval memory

This artifact runs the read side of an agent memory layer without an API key, network
connection, or service. It writes deterministic embeddings to a local JSON collection, then
the agent calls \`memory.search\` against that persistent vector store during every run. The
search applies tenant and valid-time filters before ranking, fuses dense cosine and BM25
ranks with Reciprocal Rank Fusion, applies a transparent offline reranker, and injects only
a fixed-budget evidence packet in the final, separately labelled user message.

The store is real, persistent vector retrieval with an exact cosine scan. That is the right
trade for this small, inspectable fixture. It is not an ANN implementation. At a scale where
an exact scan is too slow, keep the \`PersistentVectorStore\` interface and replace its storage
and \`search\` method with Qdrant, pgvector, or another measured ANN backend.

## Run it

\`\`\`sh
cd artifacts/ch17-retrieval-as-memory
node retrieval_memory.mjs --reset
\`\`\`

The first run creates \`.memory/memories.json\` from \`fixtures/memories.json\`. It then asks a
checkout deployment question, prints the \`memory.search\` trace, exposes dense, sparse, RRF,
and reranker ranks, and shows the exact retrieved packet in the final native API message.

- **Runtime:** Node.js 18 or later.
- **Dependencies:** none.
- **Network and API key:** neither is required.
- **Persistent state:** \`.memory/memories.json\`, safe to delete and recreate with \`--reset\`.

Try the same memory layer with an explicit question, another tenant, or JSON output for a
harness:

\`\`\`sh
node retrieval_memory.mjs --reset \
  --tenant acme \
  --as-of 2026-06-15 \
  --question "Can I deploy checkout after ERR-PAY-142?"

node retrieval_memory.mjs \
  --tenant acme \
  --as-of 2026-06-15 \
  --question "What approval is required for a checkout deploy?" \
  --json
\`\`\`

\`globex\` records exist in the fixture specifically to prove that tenant filtering happens
before rank fusion. The fixture also contains a checkout policy whose valid interval ended in
March. An April or June question cannot retrieve it. The default \`--budget 110\` accepts the
best records that fit and marks later candidates as held instead of appending them.

## What the lab isolates

The deterministic feature-hash embedding makes the exact run reproducible. It is an
educational stand-in for a production embedding model, not a quality claim. The sparse BM25
stage makes the identifier \`ERR-PAY-142\` recoverable even when dense topical similarity ranks
the release policy first. RRF uses ranks rather than incompatible score scales. The offline
reranker is deliberately visible so the reader can inspect why a record entered the packet.

The script emits an evidence briefing rather than calling an LLM. That keeps retrieval policy
separate from generation variance. In a real agent, pass the returned \`modelInput.messages\`
directly to a role-aware model API. The stable system message stays first, while the query and
retrieved records are separately labelled untrusted JSON data in later user messages. Retain the
trace for evaluation.

The fixture supports generic lookups, release schedules, and checkout deployment decisions. When
it cannot represent an explicit action or every requested service with current, answer-bearing
records, it injects no evidence and asks for clarification instead of substituting topical text.

## Verify it

\`\`\`sh
bash check.sh
\`\`\`

The check creates a temporary collection and runs actual persistent vector retrieval. It
asserts that the agent invoked \`memory.search\`, the exact identifier survives hybrid fusion,
another tenant's record cannot enter the candidate set, the superseded policy cannot enter at
the query time, the packet respects its budget, a generic telemetry query retrieves its evidence,
and hostile query or record markup remains escaped data inside the final native messages.

## Upgrade path

Keep the metadata contract in \`fixtures/memories.json\`: tenant, memory type, provenance,
valid interval, and document text. Preserve the filter-before-ranking order when moving to an
ANN database. Replace \`embed()\` with a chosen embedding model, re-index every vector, then
compare dense-only and hybrid retrieval on a labeled set. The retrieval principles remain the
same even when the storage engine changes.

For the underlying methods, see [Reciprocal Rank Fusion](https://dl.acm.org/doi/10.1145/1571941.1572114),
[Lost in the Middle](https://arxiv.org/abs/2307.03172), and
[RAGAS](https://arxiv.org/abs/2309.15217).
