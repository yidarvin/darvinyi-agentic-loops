#!/usr/bin/env node

// A deterministic lab model. It holds a prior interaction fixed and changes only the
// memory regime available after the session boundary. No network or model API is used.

const transcript = [
  "09:10 Mira: I eat vegetarian food.",
  "16:40 Deploy: production failed after a migration mismatch.",
  "16:55 Team: add migration verification before the next production deploy.",
];

const stores = {
  episodic: [
    "09:10 event: Mira said she eats vegetarian food.",
    "16:40 event: production failed after a migration mismatch.",
  ],
  semantic: ["Mira preference: vegetarian.", "Release fact: migration verification is required."],
  procedural: ["Release skill: block production deployment until migration verification passes."],
};

const regimes = {
  working: {
    label: "working only",
    consulted: "context window from the new session",
    records: ["New request: plan dinner after a deployment incident."],
  },
  episodic: {
    label: "episodic",
    consulted: "timestamped event log",
    records: stores.episodic,
  },
  semantic: {
    label: "semantic",
    consulted: "profile and generalized facts",
    records: stores.semantic,
  },
  procedural: {
    label: "procedural",
    consulted: "release skill",
    records: stores.procedural,
  },
  all: {
    label: "combined",
    consulted: "typed retrieval across all stores",
    records: [...stores.episodic, ...stores.semantic, ...stores.procedural],
  },
};

const questions = [
  {
    prompt: "What did Mira say about dinner?",
    answer: {
      working: "Unknown. The old session is not in this context window.",
      episodic: "At 09:10, Mira said she eats vegetarian food.",
      semantic: "Mira's profile says: vegetarian.",
      procedural: "Unknown. The release skill contains no user preference.",
      all: "Mira's profile says vegetarian; the episode preserves the original statement.",
    },
  },
  {
    prompt: "What happened in the previous deployment?",
    answer: {
      working: "Unknown. The prior trajectory was not persisted.",
      episodic: "At 16:40, production failed after a migration mismatch.",
      semantic: "The current fact is that migration verification is required; the detailed event is absent.",
      procedural: "The skill knows the guardrail, not the incident chronology.",
      all: "The episode reports a migration mismatch; the fact and rule preserve the remediation.",
    },
  },
  {
    prompt: "How should the next production release proceed?",
    answer: {
      working: "No durable release policy is available.",
      episodic: "The trace suggests a migration problem, but it does not enforce a next step.",
      semantic: "Migration verification is required, but no executable release behavior is attached.",
      procedural: "Run migration verification and block production deployment until it passes.",
      all: "Run migration verification before production deployment, with the incident available for explanation.",
    },
  },
];

function printRegime(id) {
  const regime = regimes[id];
  if (!regime) throw new Error(`Unknown regime: ${id}`);

  console.log(`\n=== REGIME: ${id} (${regime.label}) ===`);
  console.log(`consulted: ${regime.consulted}`);
  console.log("retained:");
  for (const record of regime.records) console.log(`  - ${record}`);
  console.log("answers:");
  for (const question of questions) {
    console.log(`  Q: ${question.prompt}`);
    console.log(`  A: ${question.answer[id]}`);
  }
}

function printStores() {
  console.log("=== FIXED PRIOR INTERACTION ===");
  for (const event of transcript) console.log(`- ${event}`);
  console.log("\n=== DERIVED STORES ===");
  for (const [name, records] of Object.entries(stores)) {
    console.log(`${name}:`);
    for (const record of records) console.log(`  - ${record}`);
  }
}

function usage() {
  console.log("Usage:");
  console.log("  node memory_harness.mjs --compare");
  console.log("  node memory_harness.mjs --regime working|episodic|semantic|procedural|all");
  console.log("  node memory_harness.mjs --show-stores");
}

function main(argv) {
  if (argv.length === 0 || argv.includes("--compare")) {
    for (const id of Object.keys(regimes)) printRegime(id);
    return;
  }
  if (argv.length === 1 && argv[0] === "--show-stores") {
    printStores();
    return;
  }
  if (argv.length === 2 && argv[0] === "--regime") {
    if (!Object.hasOwn(regimes, argv[1])) {
      console.error(`Unknown regime: ${argv[1]}`);
      usage();
      process.exitCode = 2;
      return;
    }
    printRegime(argv[1]);
    return;
  }
  usage();
  process.exitCode = 2;
}

main(process.argv.slice(2));
