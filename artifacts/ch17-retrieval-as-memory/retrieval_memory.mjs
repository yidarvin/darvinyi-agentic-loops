#!/usr/bin/env node

import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";

const DIMENSION = 192;
const DEFAULT_RRF_K = 60;
const DEFAULT_BUDGET = 110;
const DEFAULT_QUESTION = "Can I deploy checkout after ERR-PAY-142?";
const DEFAULT_AS_OF = "2026-06-15";
const DENSE_RELEVANCE_FLOOR = 0.2;

async function main() {
  if (hasFlag("--help")) {
    printHelp();
    return;
  }

  if (hasFlag("--self-test")) {
    await selfTest();
    return;
  }

  const result = await runAgent({
    storePath: option("--store", ".memory/memories.json"),
    fixturesPath: option("--fixtures", "fixtures/memories.json"),
    reset: hasFlag("--reset"),
    tenant: option("--tenant", "acme"),
    asOf: option("--as-of", DEFAULT_AS_OF),
    question: option("--question", DEFAULT_QUESTION),
    budget: numberOption("--budget", DEFAULT_BUDGET),
    rrfK: numberOption("--rrf-k", DEFAULT_RRF_K),
  });

  if (hasFlag("--json")) {
    process.stdout.write(JSON.stringify(result, null, 2) + "\n");
    return;
  }

  printResult(result);
}

class PersistentVectorStore {
  constructor(path) {
    this.path = resolve(path);
  }

  async reset(records) {
    await mkdir(dirname(this.path), { recursive: true });
    const collection = {
      schema: "retrieval-memory/v1",
      dimension: DIMENSION,
      records: records.map((record) => ({
        ...record,
        vector: embed(documentText(record)),
      })),
    };
    await writeFile(this.path, JSON.stringify(collection, null, 2) + "\n", "utf8");
    return collection;
  }

  async load() {
    const parsed = JSON.parse(await readFile(this.path, "utf8"));
    if (parsed.schema !== "retrieval-memory/v1" || parsed.dimension !== DIMENSION || !Array.isArray(parsed.records)) {
      throw new Error("invalid vector store at " + this.path + "; rerun with --reset");
    }
    return parsed;
  }

  async ensure(records, reset) {
    if (reset) return this.reset(records);
    try {
      return await this.load();
    } catch (error) {
      if (error && error.code === "ENOENT") return this.reset(records);
      throw error;
    }
  }

  search(collection, queryVector, filter, limit) {
    return collection.records
      .filter((record) => matchesFilter(record, filter))
      .map((record) => ({ record, score: cosine(queryVector, record.vector) }))
      .sort((left, right) => right.score - left.score || left.record.id.localeCompare(right.record.id))
      .slice(0, limit)
      .map((entry, index) => ({ ...entry, rank: index + 1 }));
  }
}

async function runAgent({ storePath, fixturesPath, reset, tenant, asOf, question, budget, rrfK }) {
  if (!Number.isFinite(budget) || budget < 20) throw new Error("--budget must be a number of at least 20");
  if (!Number.isFinite(rrfK) || rrfK <= 0) throw new Error("--rrf-k must be a positive number");
  assertDate(asOf, "--as-of");

  const fixtures = JSON.parse(await readFile(resolve(fixturesPath), "utf8"));
  if (!Array.isArray(fixtures.records)) throw new Error("fixture file must contain a records array");

  const store = new PersistentVectorStore(storePath);
  const collection = await store.ensure(fixtures.records, reset);
  const filter = { tenant, asOf };
  const retrieval = retrieve(collection, store, question, filter, rrfK);
  const packet = selectEvidence(retrieval.candidates, budget);
  const prompt = buildPrompt(question, packet.evidence);

  return {
    collection: fixtures.collection || "agent-memory",
    store: store.path,
    question,
    filter,
    trace: [
      {
        operation: "memory.search",
        backend: "persistent-exact-vector-store",
        tenant,
        asOf,
        eligibleRecords: retrieval.eligibleRecords,
        denseCandidates: retrieval.denseCandidates,
        sparseCandidates: retrieval.sparseCandidates,
      },
      {
        operation: "memory.inject",
        evidenceCount: packet.evidence.length,
        tokenBudget: budget,
        usedTokens: packet.usedTokens,
      },
    ],
    candidates: packet.candidates,
    evidence: packet.evidence,
    usedTokens: packet.usedTokens,
    tokenBudget: budget,
    decision: packet.evidence.length
      ? "answer with bounded evidence packet"
      : "ask for clarification or retrieve with a new query",
    prompt,
  };
}

function retrieve(collection, store, question, filter, rrfK) {
  const eligible = collection.records.filter((record) => matchesFilter(record, filter));
  if (!eligible.length) {
    return { eligibleRecords: 0, denseCandidates: 0, sparseCandidates: 0, candidates: [] };
  }

  const dense = store.search(collection, embed(question), filter, Math.min(eligible.length, 12));
  const sparse = bm25(question, eligible)
    .filter((item) => item.score > 0)
    .slice(0, Math.min(eligible.length, 12));
  const byId = new Map();

  for (const item of dense) {
    byId.set(item.record.id, {
      record: item.record,
      denseRank: item.rank,
      denseScore: item.score,
      sparseRank: null,
      sparseScore: 0,
    });
  }
  for (const item of sparse) {
    const current = byId.get(item.record.id) || {
      record: item.record,
      denseRank: null,
      denseScore: 0,
      sparseRank: null,
      sparseScore: 0,
    };
    current.sparseRank = item.rank;
    current.sparseScore = item.score;
    byId.set(item.record.id, current);
  }

  const queryTerms = new Set(tokenize(question));
  const candidates = [...byId.values()]
    .map((item) => {
      const rrf =
        (item.denseRank ? 1 / (rrfK + item.denseRank) : 0) +
        (item.sparseRank ? 1 / (rrfK + item.sparseRank) : 0);
      const overlap = lexicalOverlap(queryTerms, tokenize(documentText(item.record)));
      const freshness = freshnessScore(item.record.validFrom, filter.asOf);
      const rerankScore = 0.35 * (rrf * rrfK) + 0.5 * overlap + 0.15 * freshness;
      const hasRelevanceSignal = item.sparseScore > 0 || item.denseScore >= DENSE_RELEVANCE_FLOOR;
      return { ...item, rrf, overlap, freshness, rerankScore, hasRelevanceSignal };
    })
    .sort((left, right) => right.rerankScore - left.rerankScore || left.record.id.localeCompare(right.record.id))
    .map((item, index) => ({ ...item, finalRank: index + 1 }));

  return {
    eligibleRecords: eligible.length,
    denseCandidates: dense.length,
    sparseCandidates: sparse.length,
    candidates,
  };
}

function selectEvidence(candidates, budget) {
  let usedTokens = 0;
  const evidence = [];
  const annotated = candidates.map((candidate) => {
    const content = evidenceText(candidate.record);
    const tokens = estimateTokens(content);
    const shouldInject =
      candidate.hasRelevanceSignal && candidate.rerankScore >= 0.3 && usedTokens + tokens <= budget;
    if (shouldInject) {
      usedTokens += tokens;
      evidence.push({
        id: candidate.record.id,
        memoryType: candidate.record.memoryType,
        provenance: candidate.record.provenance,
        validFrom: candidate.record.validFrom,
        text: candidate.record.text,
        tokens,
      });
    }
    return {
      id: candidate.record.id,
      memoryType: candidate.record.memoryType,
      provenance: candidate.record.provenance,
      validFrom: candidate.record.validFrom,
      denseRank: candidate.denseRank,
      sparseRank: candidate.sparseRank,
      rrfRank: rankByRrf(candidates, candidate.record.id),
      finalRank: candidate.finalRank,
      denseScore: round(candidate.denseScore),
      sparseScore: round(candidate.sparseScore),
      rrfScore: round(candidate.rrf),
      rerankScore: round(candidate.rerankScore),
      relevanceSignal: candidate.hasRelevanceSignal,
      tokens,
      status: shouldInject
        ? "injected"
        : !candidate.hasRelevanceSignal
          ? "held-no-relevance"
          : candidate.rerankScore < 0.3
          ? "held-low-relevance"
          : "held-budget",
    };
  });
  return { candidates: annotated, evidence, usedTokens };
}

function rankByRrf(candidates, id) {
  return (
    [...candidates]
      .sort((left, right) => right.rrf - left.rrf || left.record.id.localeCompare(right.record.id))
      .findIndex((candidate) => candidate.record.id === id) + 1
  );
}

function bm25(question, records) {
  const queryTerms = [...new Set(tokenize(question))];
  const documents = records.map((record) => ({ record, terms: tokenize(documentText(record)) }));
  const averageLength =
    documents.reduce((sum, document) => sum + document.terms.length, 0) / documents.length || 1;
  const documentFrequency = new Map();
  for (const document of documents) {
    for (const term of new Set(document.terms)) {
      documentFrequency.set(term, (documentFrequency.get(term) || 0) + 1);
    }
  }

  const k1 = 1.2;
  const b = 0.75;
  return documents
    .map((document) => {
      const frequencies = new Map();
      for (const term of document.terms) frequencies.set(term, (frequencies.get(term) || 0) + 1);
      let score = 0;
      for (const term of queryTerms) {
        const frequency = frequencies.get(term) || 0;
        if (!frequency) continue;
        const df = documentFrequency.get(term) || 0;
        const idf = Math.log(1 + (documents.length - df + 0.5) / (df + 0.5));
        score +=
          (idf * (frequency * (k1 + 1))) /
          (frequency + k1 * (1 - b + (b * document.terms.length) / averageLength));
      }
      return { record: document.record, score };
    })
    .sort((left, right) => right.score - left.score || left.record.id.localeCompare(right.record.id))
    .map((item, index) => ({ ...item, rank: index + 1 }));
}

function buildPrompt(question, evidence) {
  const lines = [
    "<system>Follow production safety policy and cite memory provenance.</system>",
    "<tools>memory.search, deployment.status</tools>",
    "<user>" + question + "</user>",
    "<retrieved_memory>",
    ...evidence.map(
      (item) =>
        "- [" + item.id + " | " + item.provenance + " | " + item.validFrom + "] " + item.text,
    ),
    "</retrieved_memory>",
  ];
  return lines.join("\n");
}

function matchesFilter(record, { tenant, asOf }) {
  return record.tenant === tenant && record.validFrom <= asOf && (!record.validTo || asOf <= record.validTo);
}

function documentText(record) {
  return [record.id, (record.tags || []).join(" "), record.text].join(" ");
}

function evidenceText(record) {
  return "[" + record.id + " | " + record.provenance + " | " + record.validFrom + "] " + record.text;
}

function tokenize(value) {
  return value.toLowerCase().match(/[a-z0-9]+(?:[-_][a-z0-9]+)*/g) || [];
}

function embed(value) {
  const vector = Array.from({ length: DIMENSION }, () => 0);
  for (const token of featureTokens(value)) {
    const hash = fnv1a(token);
    const index = (hash >>> 1) % DIMENSION;
    vector[index] += hash & 1 ? 1 : -1;
  }
  const magnitude = Math.hypot(...vector);
  return magnitude ? vector.map((value) => value / magnitude) : vector;
}

function* featureTokens(value) {
  for (const token of tokenize(value)) {
    yield "word:" + token;
    if (token.length < 3) continue;
    for (let index = 0; index <= token.length - 3; index += 1) {
      yield "tri:" + token.slice(index, index + 3);
    }
  }
}

function fnv1a(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function cosine(left, right) {
  return left.reduce((sum, value, index) => sum + value * right[index], 0);
}

function lexicalOverlap(queryTerms, documentTerms) {
  if (!queryTerms.size) return 0;
  const documentSet = new Set(documentTerms);
  let matches = 0;
  for (const term of queryTerms) if (documentSet.has(term)) matches += 1;
  return matches / queryTerms.size;
}

function freshnessScore(validFrom, asOf) {
  const days = Math.max(
    0,
    (Date.parse(asOf + "T00:00:00Z") - Date.parse(validFrom + "T00:00:00Z")) / 86400000,
  );
  return Math.max(0, 1 - days / 730);
}

function estimateTokens(value) {
  return tokenize(value).length;
}

function round(value) {
  return Number(value.toFixed(4));
}

function option(name, fallback) {
  const index = process.argv.indexOf(name);
  if (index === -1) return fallback;
  const value = process.argv[index + 1];
  if (!value || value.startsWith("--")) throw new Error(name + " requires a value");
  return value;
}

function numberOption(name, fallback) {
  return Number(option(name, String(fallback)));
}

function hasFlag(name) {
  return process.argv.includes(name);
}

function assertDate(value, label) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error(label + " must use YYYY-MM-DD");
  const parsed = new Date(value + "T00:00:00.000Z");
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new Error(label + " must be a real calendar date");
  }
}

function printResult(result) {
  console.log("memory.store " + result.store);
  console.log("memory.search tenant=" + result.filter.tenant + " as_of=" + result.filter.asOf);
  console.log("query: " + result.question);
  console.log(
    "eligible: " +
      result.trace[0].eligibleRecords +
      " | dense: " +
      result.trace[0].denseCandidates +
      " | sparse: " +
      result.trace[0].sparseCandidates,
  );
  console.log("");
  console.log("rank  candidate                    dense  sparse  rrf  rerank  status");
  for (const candidate of result.candidates) {
    const row = [
      String(candidate.finalRank).padEnd(5),
      candidate.id.padEnd(28),
      String(candidate.denseRank || "-").padEnd(7),
      String(candidate.sparseRank || "-").padEnd(8),
      String(candidate.rrfRank).padEnd(5),
      String(candidate.rerankScore).padEnd(8),
      candidate.status,
    ];
    console.log(row.join(" "));
  }
  console.log("");
  console.log("memory.inject " + result.usedTokens + "/" + result.tokenBudget + " tokens");
  console.log(result.prompt);
  console.log("");
  console.log("agent.decision: " + result.decision);
}

async function selfTest() {
  const directory = await mkdtemp(resolve(tmpdir(), "retrieval-memory-"));
  try {
    const result = await runAgent({
      storePath: resolve(directory, "memory.json"),
      fixturesPath: resolve("fixtures/memories.json"),
      reset: true,
      tenant: "acme",
      asOf: DEFAULT_AS_OF,
      question: DEFAULT_QUESTION,
      budget: DEFAULT_BUDGET,
      rrfK: DEFAULT_RRF_K,
    });
    const incident = result.candidates.find((candidate) => candidate.id === "acme_incident_pay_142");
    const currentPolicy = result.candidates.find(
      (candidate) => candidate.id === "acme_checkout_policy_2026",
    );
    if (result.trace[0].operation !== "memory.search") throw new Error("agent did not call memory.search");
    if (!incident || incident.sparseRank !== 1) {
      throw new Error("hybrid retrieval did not surface ERR-PAY-142 through sparse rank");
    }
    if (!currentPolicy || currentPolicy.status !== "injected") {
      throw new Error("current deployment policy was not injected");
    }
    if (result.candidates.some((candidate) => candidate.id.includes("globex"))) {
      throw new Error("tenant filter leaked another tenant");
    }
    if (result.candidates.some((candidate) => candidate.id === "acme_checkout_policy_2025")) {
      throw new Error("expired policy survived valid-time filter");
    }
    if (result.usedTokens > result.tokenBudget) throw new Error("evidence packet exceeded its token budget");
    if (!result.prompt.endsWith("</retrieved_memory>")) {
      throw new Error("retrieved evidence was not placed at the dynamic prompt tail");
    }

    const irrelevant = await runAgent({
      storePath: resolve(directory, "irrelevant-memory.json"),
      fixturesPath: resolve("fixtures/memories.json"),
      reset: true,
      tenant: "acme",
      asOf: DEFAULT_AS_OF,
      question: "florpquux nebula xylophone",
      budget: DEFAULT_BUDGET,
      rrfK: DEFAULT_RRF_K,
    });
    if (irrelevant.evidence.length !== 0 || irrelevant.usedTokens !== 0) {
      throw new Error("irrelevant query injected unrelated records into the evidence packet");
    }
    if (irrelevant.decision !== "ask for clarification or retrieve with a new query") {
      throw new Error("irrelevant query did not take the abstention path");
    }

    let invalidDateRejected = false;
    try {
      await runAgent({
        storePath: resolve(directory, "invalid-date-memory.json"),
        fixturesPath: resolve("fixtures/memories.json"),
        reset: true,
        tenant: "acme",
        asOf: "2026-02-31",
        question: DEFAULT_QUESTION,
        budget: DEFAULT_BUDGET,
        rrfK: DEFAULT_RRF_K,
      });
    } catch (error) {
      invalidDateRejected = String(error).includes("--as-of must be a real calendar date");
    }
    if (!invalidDateRejected) throw new Error("impossible --as-of date was not rejected");

    console.log("persistent retrieval memory: checks passed");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

function printHelp() {
  console.log(
    [
      "Usage: node retrieval_memory.mjs [options]",
      "",
      "Options:",
      "  --reset                 recreate the persistent vector collection from fixtures",
      "  --store PATH            vector collection path (default: .memory/memories.json)",
      "  --fixtures PATH         fixture corpus path",
      "  --tenant ID             tenant filter (default: acme)",
      "  --as-of YYYY-MM-DD      valid-time filter (default: " + DEFAULT_AS_OF + ")",
      "  --question TEXT         memory query",
      "  --budget N              maximum evidence tokens (default: " + DEFAULT_BUDGET + ")",
      "  --rrf-k N               Reciprocal Rank Fusion constant (default: " + DEFAULT_RRF_K + ")",
      "  --json                  print the complete retrieval trace as JSON",
      "  --self-test             run deterministic retrieval assertions",
      "  --help                  show this message",
    ].join("\n"),
  );
}

main().catch((error) => {
  console.error("retrieval memory failed: " + error.message);
  process.exitCode = 1;
});
