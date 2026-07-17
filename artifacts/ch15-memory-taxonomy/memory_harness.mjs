#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// A deterministic lab model. It resets active working state at a session boundary,
// then changes only the durable records selected from an editable structured trace.
// The current request is a context projection, not the whole definition of working memory.
// No network or model API is used.

const defaultTracePath = fileURLToPath(new URL("./trace.json", import.meta.url));

function requiredString(value, name) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`Trace field ${name} must be a non-empty string.`);
  }
  return value.trim();
}

function normalizeTrace(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Trace must be a JSON object.");
  }

  return {
    working: {
      goal: requiredString(value.working?.goal, "working.goal"),
      request: requiredString(value.working?.request, "working.request"),
    },
    preference: {
      time: requiredString(value.preference?.time, "preference.time"),
      person: requiredString(value.preference?.person, "preference.person"),
      topic: requiredString(value.preference?.topic, "preference.topic"),
      statement: requiredString(value.preference?.statement, "preference.statement"),
      value: requiredString(value.preference?.value, "preference.value"),
    },
    incident: {
      time: requiredString(value.incident?.time, "incident.time"),
      actor: requiredString(value.incident?.actor, "incident.actor"),
      subject: requiredString(value.incident?.subject, "incident.subject"),
      description: requiredString(value.incident?.description, "incident.description"),
      fact: requiredString(value.incident?.fact, "incident.fact"),
    },
    procedure: {
      time: requiredString(value.procedure?.time, "procedure.time"),
      actor: requiredString(value.procedure?.actor, "procedure.actor"),
      statement: requiredString(value.procedure?.statement, "procedure.statement"),
      policy: requiredString(value.procedure?.policy, "procedure.policy"),
      target: requiredString(value.procedure?.target, "procedure.target"),
      skill: requiredString(value.procedure?.skill, "procedure.skill"),
    },
  };
}

function loadTrace(tracePath) {
  let source;
  try {
    source = readFileSync(tracePath, "utf8");
  } catch (error) {
    throw new Error(`Could not read trace ${tracePath}: ${error.message}`);
  }

  try {
    return normalizeTrace(JSON.parse(source));
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`Could not parse trace ${tracePath}: ${error.message}`);
    }
    throw error;
  }
}

function withPeriod(value) {
  return /[.!?]$/.test(value) ? value : `${value}.`;
}

function withoutTerminalPunctuation(value) {
  return value.replace(/[.!?]+$/, "");
}

function capitalize(value) {
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}

function possessive(name) {
  return name.endsWith("s") ? `${name}'` : `${name}'s`;
}

function createHarness(trace) {
  const { working, preference, incident, procedure } = trace;
  const preferenceStatement = withPeriod(preference.statement);
  const incidentDescription = withoutTerminalPunctuation(incident.description);
  const incidentFact = withoutTerminalPunctuation(incident.fact);
  const procedureSkill = withPeriod(procedure.skill);

  const transcript = [
    `${preference.time} ${preference.person}: ${preferenceStatement}`,
    `${incident.time} ${incident.actor}: ${withPeriod(incident.description)}`,
    `${procedure.time} ${procedure.actor}: ${withPeriod(procedure.statement)}`,
  ];

  const stores = {
    episodic: [
      `${preference.time} event: ${preference.person} said ${preferenceStatement}`,
      `${incident.time} event: ${withPeriod(incident.description)}`,
    ],
    semantic: [
      `${preference.person} preference: ${preference.value}.`,
      `${capitalize(incident.subject)} fact: ${withPeriod(incident.fact)}`,
    ],
    procedural: [`${capitalize(procedure.policy)} skill: ${procedureSkill}`],
  };

  const regimes = {
    working: {
      label: "fresh working state",
      consulted: "reset working state; current context projection",
      records: [`Active goal: ${withPeriod(working.goal)}`, `Context projection: ${withPeriod(working.request)}`],
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
      consulted: `explicit selected ${procedure.policy} skill`,
      records: stores.procedural,
    },
    all: {
      label: "combined",
      consulted: `typed selected records plus an explicit ${procedure.policy} skill`,
      records: [...stores.episodic, ...stores.semantic, ...stores.procedural],
    },
  };

  const questions = [
    {
      prompt: `What did ${preference.person} say about ${preference.topic}?`,
      answer: {
        working: "Unknown. The active working state was reset, so the old session is absent from this context projection.",
        episodic: `At ${preference.time}, ${preference.person} said ${preferenceStatement}`,
        semantic: `${possessive(preference.person)} profile says: ${preference.value}.`,
        procedural: `Unknown. The explicit ${procedure.policy} skill contains no user preference.`,
        all: `${possessive(preference.person)} profile says ${preference.value}; the episode preserves the original statement.`,
      },
    },
    {
      prompt: `What happened in the previous ${incident.subject}?`,
      answer: {
        working: "Unknown. The active working state was reset and the prior trajectory was not persisted.",
        episodic: `At ${incident.time}, ${incidentDescription}.`,
        semantic: `The current fact is that ${incidentFact}; the detailed event is absent.`,
        procedural: `The explicit skill knows the ${procedure.policy} guardrail, not the incident chronology.`,
        all: `The episode reports ${incidentDescription}; the fact and rule preserve the remediation.`,
      },
    },
    {
      prompt: `How should the ${procedure.target} proceed?`,
      answer: {
        working: `No durable ${procedure.policy} policy is available.`,
        episodic: `The trace suggests ${incidentDescription}, but it does not enforce a next step.`,
        semantic: `${capitalize(incidentFact)}, but no executable ${procedure.policy} behavior is attached.`,
        procedural: procedureSkill,
        all: `${withoutTerminalPunctuation(procedureSkill)}, with the incident available for explanation.`,
      },
    },
  ];

  return { transcript, stores, regimes, questions };
}

function printRegime(harness, id) {
  const regime = harness.regimes[id];
  if (!regime) throw new Error(`Unknown regime: ${id}`);

  console.log(`\n=== REGIME: ${id} (${regime.label}) ===`);
  console.log(`consulted: ${regime.consulted}`);
  console.log("retained:");
  for (const record of regime.records) console.log(`  - ${record}`);
  console.log("answers:");
  for (const question of harness.questions) {
    console.log(`  Q: ${question.prompt}`);
    console.log(`  A: ${question.answer[id]}`);
  }
}

function printStores(harness) {
  console.log("=== PRIOR INTERACTION ===");
  for (const event of harness.transcript) console.log(`- ${event}`);
  console.log("\n=== DERIVED STORES ===");
  for (const [name, records] of Object.entries(harness.stores)) {
    console.log(`${name}:`);
    for (const record of records) console.log(`  - ${record}`);
  }
}

function usage() {
  console.log("Usage:");
  console.log("  node memory_harness.mjs [--trace path] --compare");
  console.log("  node memory_harness.mjs [--trace path] --regime working|episodic|semantic|procedural|all");
  console.log("  node memory_harness.mjs [--trace path] --show-stores");
}

function parseArguments(argv) {
  let tracePath = defaultTracePath;
  const command = [];

  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--trace") {
      const suppliedPath = argv[index + 1];
      if (!suppliedPath || suppliedPath.startsWith("--")) {
        throw new Error("--trace requires a path to a JSON trace.");
      }
      tracePath = suppliedPath;
      index += 1;
    } else {
      command.push(argv[index]);
    }
  }

  return { tracePath, command };
}

function main(argv) {
  try {
    const { tracePath, command } = parseArguments(argv);
    const harness = createHarness(loadTrace(tracePath));

    if (command.length === 0 || (command.length === 1 && command[0] === "--compare")) {
      for (const id of Object.keys(harness.regimes)) printRegime(harness, id);
      return;
    }
    if (command.length === 1 && command[0] === "--show-stores") {
      printStores(harness);
      return;
    }
    if (command.length === 2 && command[0] === "--regime") {
      if (!Object.hasOwn(harness.regimes, command[1])) {
        console.error(`Unknown regime: ${command[1]}`);
        usage();
        process.exitCode = 2;
        return;
      }
      printRegime(harness, command[1]);
      return;
    }
  } catch (error) {
    console.error(error.message);
    usage();
    process.exitCode = 2;
    return;
  }

  usage();
  process.exitCode = 2;
}

main(process.argv.slice(2));
