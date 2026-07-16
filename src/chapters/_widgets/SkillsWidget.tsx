import { useState } from "react";

// SkillsWidget: the signature widget for "Skills". One focused move: select an element of a
// real skill package and watch its load profile appear. The reader should feel that SKILL.md
// fields and the package's distinct bundled files live at different levels of progressive
// disclosure and cost the context window very differently. The description is resident only
// when the skill is listed for model invocation. In a regular Claude Code session, a first,
// distinct, or changed rendered body loads while an identical re-invocation adds a short
// already-loaded note. A configured preloaded subagent receives named full skill content at
// startup instead. A referenced doc enters context when read; a bundled script can return
// output without first loading its source. Selecting a bundled file also highlights the
// level-2 body directive that points to it.
// React state only, no persistence. Profiles distinguish portable design from Agent
// Skills-specific limits where those limits are useful examples.

type PartKey = "name" | "description" | "body" | "reference" | "script";

interface Profile {
  key: PartKey;
  label: string;
  level: string;
  hot: boolean; // true = always resident (level 1); tints the badge
  when: string;
  cost: string;
  enters: string;
  role: string;
  // For the two directive lines: the pointer line itself is body (level 2); this
  // profile describes the bundled file it names. Set only for reference and script.
  pointer?: string;
}

const PROFILES: Record<PartKey, Profile> = {
  name: {
    key: "name",
    label: "name",
    level: "level 1 · metadata",
    hot: true,
    when: "at startup, when listed for model invocation",
    cost: "part of the ~100-token budget for a listed skill",
    enters: "yes when listed; no for a Claude Code user-only skill",
    role: "The portable identifier. It must be one to 64 Unicode lowercase alphanumeric characters in single hyphen-separated words, and it must match the skill directory. A harness may also expose it as an explicit command. Anthropic adds reserved-vendor-name restrictions as a surface rule. In a model-invoked listing, this is paid once per session; a Claude Code user-only skill is absent until manual invocation.",
  },
  description: {
    key: "description",
    label: "description",
    level: "level 1 · metadata",
    hot: true,
    when: "at startup, when listed for model invocation",
    cost: "the bulk of a listed skill's metadata budget (up to 1024 chars)",
    enters: "yes when listed; user-only skills omit it until manual invocation",
    role: "In a model-invoked harness, this is the part the agent reads to decide whether to open the skill at all. The portable specification says it should state what the skill does and when to use it, with useful trigger words. Anthropic also recommends third person because this text enters its system prompt. Those are discovery and surface rules, not the portable parser's whole contract.",
  },
  body: {
    key: "body",
    label: "SKILL.md body",
    level: "regular session · level 2",
    hot: false,
    when: "regular session: after this skill's first, distinct, or changed rendering; preloaded subagent: at startup",
    cost: "regular: < 5k tokens recommended for a full rendered body; preloaded: that full named body is paid at startup",
    enters: "regular: full body for first, distinct, or changed rendering; preloaded subagent: full named skill content at startup",
    role: "The procedure the model follows once the skill is activated. In a regular Claude Code session it stays absent until then, which is the whole point: a hundred listed skills can sit available without paying for every body. An identical re-invocation adds a short already-loaded note rather than another body; a changed render, such as new arguments or dynamic context, adds the full body. A subagent configured with named preloaded skills starts with their full content instead. Distinct activated skill bodies may coexist. The 500-line target is authoring guidance, not portable syntax.",
  },
  reference: {
    key: "reference",
    label: "references/FORMAT.md",
    level: "level 3+ · resources",
    hot: false,
    when: "on demand, only if the body sends the model to read it",
    cost: "the text read, and only when actually read",
    enters: "yes, only after the agent reads the reference",
    role: "Detail kept one hop from the body so the body stays lean. \"See references/FORMAT.md\" means read it; its text then enters context. It costs zero tokens until that read, as do other unread resources.",
    pointer: "The \"See references/FORMAT.md\" line is level-2 body prose. Select the bundled file below to inspect the level-3 resource it points to. Its text stays off-window until the agent reads it.",
  },
  script: {
    key: "script",
    label: "scripts/validate_entry.py",
    level: "level 3+ · resources",
    hot: false,
    when: "when the agent executes it; its source need not be opened first",
    cost: "≈ zero source tokens; execution output counts",
    enters: "normally output only; source remains available on disk",
    role: "Deterministic work the model should run, not regenerate token by token. The Claude Code command uses `${CLAUDE_SKILL_DIR}` so the bundled path resolves from any project directory, and it receives literal candidate text through a file rather than shell source. A harness can return only output to the model, which keeps bundled code out of the context budget unless the agent chooses to inspect it.",
    pointer: "The root-aware stdin validator command is level-2 body prose. Select the bundled file below to inspect the level-3 resource it names, whose source normally stays off-window.",
  },
};

const SKILL_MD_PART_ORDER: Array<"name" | "description" | "body"> = ["name", "description", "body"];

// Relevant SKILL.md excerpts. Each line is tagged with its SKILL.md content (or null for
// structural lines like the frontmatter fences and blanks). Resource directives are level-2
// body prose; pointsTo maps each directive to its distinct level-3 bundled file.
interface Line {
  text: string;
  part: PartKey | null;
  pointsTo?: "reference" | "script";
}

const SOURCE: Line[] = [
  { text: "---", part: null },
  { text: "name: changelog-entry", part: "name" },
  { text: "description: Formats and validates a Keep a Changelog entry. Use when adding a", part: "description" },
  { text: "  changelog entry, recording a change, or editing CHANGELOG.md.", part: "description" },
  { text: "---", part: null },
  { text: "", part: null },
  { text: "# Changelog entry", part: "body" },
  { text: "", part: null },
  { text: "Add one entry to the Unreleased section of `CHANGELOG.md`, in the Keep a", part: "body" },
  { text: "Changelog format, and verify it before writing.", part: "body" },
  { text: "", part: null },
  { text: "## Steps", part: "body" },
  { text: "", part: null },
  { text: "1. Decide the change type. Use exactly one of: Added, Changed, Deprecated,", part: "body" },
  { text: "   Removed, Fixed, Security.", part: "body" },
  { text: "2. Write a single imperative line summarizing the change. Compose it as `Type:", part: "body" },
  { text: "   summary`, for example `Added: --export flag`.", part: "body" },
  { text: "3. Write the literal candidate to a scratch file with a structured file-writing tool.", part: "body" },
  { text: '4. In Claude Code, run `python3 "${CLAUDE_SKILL_DIR}/scripts/validate_entry.py" < /path/to/candidate.txt`', part: "body", pointsTo: "script" },
  { text: "   to check the format. Candidate text stays out of shell source; another harness", part: "body", pointsTo: "script" },
  { text: "   needs an equivalent skill root. It exits 0 when the entry is well formed.", part: "body", pointsTo: "script" },
  { text: "5. If it fails, fix the reported problem and run it again. Do not write the entry", part: "body" },
  { text: "   until the validator passes.", part: "body" },
  { text: "6. Place the summary as a `- ` bullet under the matching `### Type` heading in", part: "body" },
  { text: "   the `## [Unreleased]` section, creating the heading if it is not there yet.", part: "body" },
  { text: "", part: null },
  { text: "## Notes", part: "body" },
  { text: "", part: null },
  { text: "- One change per entry. Split unrelated changes into separate entries.", part: "body" },
  { text: "- Write for a person reading the release notes, not for the commit log.", part: "body" },
  { text: "- For the full format, the order of the headings, and how Unreleased becomes a", part: "body", pointsTo: "reference" },
  { text: "  released version, see `references/FORMAT.md`.", part: "body", pointsTo: "reference" },
];

const BUNDLED_RESOURCES: Array<{ key: "reference" | "script"; path: string }> = [
  { key: "reference", path: "references/FORMAT.md" },
  { key: "script", path: "scripts/validate_entry.py" },
];

export function SkillsWidget() {
  const [selected, setSelected] = useState<PartKey>("description");
  const p = PROFILES[selected];

  return (
    <div className="font-sans">
      {/* SKILL.md content, as an accessible control strip; source lines select it too */}
      <div
        role="group"
        aria-label="SKILL.md contents"
        className="flex flex-wrap gap-1 font-mono text-[0.7rem]"
      >
        {SKILL_MD_PART_ORDER.map((key) => (
          <button
            key={key}
            onClick={() => setSelected(key)}
            onMouseEnter={() => setSelected(key)}
            onFocus={() => setSelected(key)}
            aria-pressed={selected === key}
            aria-label={`SKILL.md content: ${PROFILES[key].label}`}
            className={`rounded border px-2 py-1 transition-colors motion-reduce:transition-none ${
              selected === key
                ? "border-accent/50 bg-accent/15 text-accent"
                : "border-border text-muted hover:text-fg"
            }`}
          >
            {PROFILES[key].label}
          </button>
        ))}
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        {/* SKILL.md itself: resource directives select the bundled file they name */}
        <div className="overflow-hidden rounded border border-border bg-surface-2">
          <div className="border-b border-border px-3 py-1.5 font-mono text-[0.7rem] text-comment">
            {"// SKILL.md excerpts · changelog-entry/"}
          </div>
          <pre className="overflow-x-auto p-2 font-mono text-[0.72rem] leading-relaxed">
            {SOURCE.map((line, i) => {
              const active = line.part !== null && (line.part === selected || line.pointsTo === selected);
              if (line.part === null) {
                return (
                  <span key={i} className="block whitespace-pre px-1 text-comment">
                    {line.text || " "}
                  </span>
                );
              }
              const selection = (line.pointsTo ?? line.part) as PartKey;
              return (
                <button
                  key={i}
                  onClick={() => setSelected(selection)}
                  onMouseEnter={() => setSelected(selection)}
                  onFocus={() => setSelected(selection)}
                  aria-pressed={active}
                  aria-label={line.pointsTo
                    ? `SKILL.md directive for bundled ${PROFILES[line.pointsTo].label}: ${line.text}`
                    : `${PROFILES[line.part].label}: ${line.text}`}
                  className={`block w-full cursor-pointer whitespace-pre rounded-sm px-1 text-left transition-colors motion-reduce:transition-none ${
                    active
                      ? "bg-accent/15 text-fg"
                      : "text-fg/80 hover:bg-surface md:hover:bg-surface"
                  }`}
                >
                  {line.text}
                </button>
              );
            })}
          </pre>
          <div className="border-t border-border px-3 py-2 font-mono text-[0.68rem]">
            <div className="text-comment">{"// bundled package files · select one to trace its SKILL.md directive"}</div>
            <div role="group" aria-label="Bundled package files" className="mt-1 flex flex-wrap gap-1">
              {BUNDLED_RESOURCES.map(({ key, path }) => {
                const active = selected === key;
                return (
                  <button
                    key={key}
                    onClick={() => setSelected(key)}
                    onMouseEnter={() => setSelected(key)}
                    onFocus={() => setSelected(key)}
                    aria-pressed={active}
                    aria-label={`Bundled resource: ${path}`}
                    className={`rounded border px-1.5 py-0.5 transition-colors motion-reduce:transition-none ${
                      active
                        ? "border-accent/50 bg-accent/15 text-accent"
                        : "border-border text-muted hover:text-fg"
                    }`}
                  >
                    {path}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* the load profile for the selected package element */}
        <div className="rounded border border-accent/30 bg-surface p-3">
          <div className="flex items-baseline justify-between gap-2">
            <span className="font-mono text-sm text-accent">{p.label}</span>
            <span
              className={`rounded px-1.5 py-0.5 font-mono text-[0.62rem] ${
                p.hot ? "bg-accent/15 text-accent" : "border border-border text-muted"
              }`}
            >
              {p.level}
            </span>
          </div>

          <dl className="mt-3 space-y-2 font-mono text-[0.7rem]">
            <div>
              <dt className="text-comment">{"// loaded when"}</dt>
              <dd className="mt-0.5 text-fg/90">{p.when}</dd>
            </div>
            <div>
              <dt className="text-comment">{"// token cost"}</dt>
              <dd className="mt-0.5 text-fg/90">{p.cost}</dd>
            </div>
            <div>
              <dt className="text-comment">{"// enters the window"}</dt>
              <dd className="mt-0.5 text-fg/90">{p.enters}</dd>
            </div>
          </dl>

          <p className="mt-3 font-sans text-sm leading-relaxed text-fg/80">{p.role}</p>

          {p.pointer && (
            <p className="mt-2 rounded border border-border bg-surface-2 px-2 py-1.5 font-mono text-[0.66rem] leading-relaxed text-comment">
              {p.pointer}
            </p>
          )}
        </div>
      </div>

      <p className="mt-3 font-mono text-[0.7rem] text-comment">
        {selected === "body"
          ? "// Claude Code exception: a subagent configured with this named skill preloaded starts with its full content."
          : p.hot
          ? "// startup context: listed model-invocable skills only; user-only skills enter after manual invocation."
          : "// off-window until needed: this package element costs nothing until the skill actually reaches it."}
      </p>
    </div>
  );
}
