import { execFile as runFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFile = promisify(runFile);
const artifactDirectory = dirname(fileURLToPath(import.meta.url));
const agentScript = resolve(artifactDirectory, "self_managed_memory.mjs");

async function main() {
  const directory = process.argv[2];
  if (!directory) throw new Error("usage: node verify_demo.mjs <state-directory>");

  const state = await readJson(resolve(directory, "state.json"));
  const sessionOne = await readJson(resolve(directory, "session-1.json"));
  const sessionTwo = await readJson(resolve(directory, "session-2.json"));

  assert(state.schema === "self-managed-memory/v1", "unexpected state schema");
  assert(current(state, "framework")?.value === "Fastify", "Fastify was not promoted as the current framework");
  assert(current(state, "package_manager")?.value === "pnpm", "pnpm was not promoted as the current package manager");
  assert(
    current(state, "release_window")?.value === "Tuesday 14:00 UTC",
    "release window was not promoted as current memory",
  );
  assert(!state.trusted.some((memory) => memory.key === "framework" && memory.value === "Express" && memory.current), "Express remained current");
  assert(state.archive.some((memory) => memory.key === "framework" && memory.value === "Express"), "superseded Express fact was not archived");
  assert(
    state.quarantine.some((candidate) => candidate.source === "tool-output" && candidate.reason.includes("trusted user channel")),
    "tool-derived instruction was not quarantined",
  );
  assert(state.hotBlock?.content.includes("Fastify") && state.hotBlock.content.includes("pnpm"), "hot block was not compacted from trusted facts");
  assert(sessionOne.session === 1 && sessionOne.actions.some((action) => action.operation === "memory.quarantine"), "session 1 did not exercise quarantine");
  assert(sessionTwo.session === 2, "session 2 did not run");
  assert(sessionTwo.recalled.framework === "Fastify", "session 2 did not recall Fastify");
  assert(sessionTwo.recalled.packageManager === "pnpm", "session 2 did not recall pnpm");
  assert(
    sessionTwo.answer.includes("Tuesday at 14:00 UTC"),
    "session 2 answer did not use the persisted release window",
  );

  const changedHotBlockRecall = await reloadAfterChangingOnlyHotBlock(state);
  assert(
    changedHotBlockRecall.recalled.framework === "Express",
    "session 2 did not derive the framework from the changed project.md",
  );
  assert(
    changedHotBlockRecall.recalled.packageManager === "npm",
    "session 2 did not derive the package manager from the changed project.md",
  );
  assert(
    changedHotBlockRecall.recalled.releaseWindow === "Monday 10:00 UTC",
    "session 2 did not derive the release window from the changed project.md",
  );
  assert(
    changedHotBlockRecall.answer.includes("Express with npm") &&
      changedHotBlockRecall.answer.includes("Monday at 10:00 UTC"),
    "session 2 answer did not change after project.md changed",
  );

  process.stdout.write(
    "self-managed memory artifact: replacement, quarantine, compaction, and hot-block-backed fresh-process recall passed\n",
  );
}

async function reloadAfterChangingOnlyHotBlock(state) {
  const alteredState = JSON.parse(JSON.stringify(state));
  alteredState.hotBlock.content = [
    "# project release playbook",
    "- build with Express and npm",
    "- schedule production releases Monday 10:00 UTC",
  ].join("\n");

  const directory = await mkdtemp(join(tmpdir(), "self-managed-memory-hot-block-"));
  const statePath = resolve(directory, "state.json");
  try {
    await writeFile(statePath, JSON.stringify(alteredState, null, 2) + "\n", "utf8");
    const { stdout } = await execFile(process.execPath, [agentScript, "--session", "2", "--state", statePath, "--json"]);
    return JSON.parse(stdout);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

function current(state, key) {
  return state.trusted.find((memory) => memory.key === key && memory.current);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

main().catch((error) => {
  process.stderr.write("artifact verification failed: " + error.message + "\n");
  process.exitCode = 1;
});
