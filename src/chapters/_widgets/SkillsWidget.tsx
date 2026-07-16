import { useState } from "react";

// SkillsWidget: the signature widget for "Skills". One focused move: select a part of a
// real SKILL.md and watch its load profile appear. The reader should feel that the parts
// of one small file live at different levels of progressive disclosure and cost the
// context window very differently. The description is always resident and does the
// discovering; the body loads after selection; a referenced doc is read on demand; a
// bundled script can return output without first loading its source. Selecting a part in
// the source highlights every line that belongs to it and shows where and when it loads.
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
    when: "always, at startup",
    cost: "part of the ~100-token metadata budget",
    enters: "yes, always resident",
    role: "The portable identifier. A harness may also expose it as an explicit command. The Agent Skills reference implementation adds lowercase-hyphen naming, a 64-character limit, and a ban on certain vendor names. It is loaded for every installed skill, so it is paid once per skill on every session.",
  },
  description: {
    key: "description",
    label: "description",
    level: "level 1 · metadata",
    hot: true,
    when: "always, at startup",
    cost: "the bulk of the metadata budget (up to 1024 chars)",
    enters: "yes, always resident",
    role: "In a model-invoked harness, this is the part the agent reads to decide whether to open the skill at all. It is the discovery mechanism, so Agent Skills guidance uses third person and states both what the skill does and when to use it, with the trigger words a matching task would contain. Get this wrong and the skill may not fire.",
  },
  body: {
    key: "body",
    label: "SKILL.md body",
    level: "level 2 · instructions",
    hot: false,
    when: "after the harness selects this skill for the task",
    cost: "< 5k tokens (target < 500 lines)",
    enters: "yes after selection; retention depends on the harness",
    role: "The procedure the model follows once the skill is selected. It is absent from the window until the description earns it a read, which is the whole point: a hundred skills can sit installed and only the one that triggers pays for its body.",
  },
  reference: {
    key: "reference",
    label: "references/FORMAT.md",
    level: "level 3+ · resources",
    hot: false,
    when: "on demand, only if the body sends the model to read it",
    cost: "its own length, and only when actually read",
    enters: "only the part read, only when read",
    role: "Detail kept one hop from the body so the body stays lean. \"See references/FORMAT.md\" means read it; the agent pulls it in only when the task reaches that far, and it costs zero tokens until then.",
    pointer: "The \"See references/FORMAT.md\" line is level-2 body prose. Select the bundled file below to inspect the level-3 resource it points to, whose contents stay off-window until read.",
  },
  script: {
    key: "script",
    label: "scripts/validate_entry.py",
    level: "level 3+ · resources",
    hot: false,
    when: "when the agent executes it; its source need not be opened first",
    cost: "≈ zero source tokens; execution output counts",
    enters: "normally output only; source remains available on disk",
    role: "Deterministic work the model should run, not regenerate token by token. \"Run scripts/validate_entry.py\" means execute it. A harness can return only its output to the model, which keeps bundled code out of the context budget unless the agent chooses to inspect it.",
    pointer: "The \"Run scripts/validate_entry.py\" line is level-2 body prose. Select the bundled file below to inspect the level-3 resource it names, whose source normally stays off-window.",
  },
};

const PART_ORDER: PartKey[] = ["name", "description", "body", "reference", "script"];

// The SKILL.md, line by line, each line tagged with the part it belongs to (or null for
// structural lines like the frontmatter fences and blanks). Resource directives are body
// prose. The resource paths themselves appear in the bundle strip below.
interface Line {
  text: string;
  part: PartKey | null;
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
  { text: "2. Write a single imperative line summarizing the change, with no trailing", part: "body" },
  { text: "   period. Compose it as `Type: summary`, for example `Added: --export flag`.", part: "body" },
  { text: "3. Run `scripts/validate_entry.py \"Type: summary\"` to check the format. It exits", part: "body" },
  { text: "   0 when the entry is well formed and prints a specific reason when it is not.", part: "body" },
  { text: "4. If it fails, fix the reported problem and run it again. Do not write the entry", part: "body" },
  { text: "   until the validator passes.", part: "body" },
  { text: "5. Place the summary as a `- ` bullet under the matching `### Type` heading in", part: "body" },
  { text: "   the `## [Unreleased]` section, creating the heading if it is not there yet.", part: "body" },
  { text: "", part: null },
  { text: "## Notes", part: "body" },
  { text: "", part: null },
  { text: "- One change per entry. Split unrelated changes into separate entries.", part: "body" },
  { text: "- Write for a person reading the release notes, not for the commit log.", part: "body" },
  { text: "- For the full format, the order of the headings, and how Unreleased becomes a", part: "body" },
  { text: "  released version, see `references/FORMAT.md`.", part: "body" },
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
      {/* the parts, as an accessible control strip; the source lines below select too */}
      <div
        role="group"
        aria-label="SKILL.md part"
        className="flex flex-wrap gap-1 font-mono text-[0.7rem]"
      >
        {PART_ORDER.map((key) => (
          <button
            key={key}
            onClick={() => setSelected(key)}
            onMouseEnter={() => setSelected(key)}
            onFocus={() => setSelected(key)}
            aria-pressed={selected === key}
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
        {/* the file: click any highlighted line to select its part */}
        <div className="overflow-hidden rounded border border-border bg-surface-2">
          <div className="border-b border-border px-3 py-1.5 font-mono text-[0.7rem] text-comment">
            {"// SKILL.md · changelog-entry/"}
          </div>
          <pre className="overflow-x-auto p-2 font-mono text-[0.72rem] leading-relaxed">
            {SOURCE.map((line, i) => {
              const active = line.part !== null && line.part === selected;
              if (line.part === null) {
                return (
                  <span key={i} className="block whitespace-pre px-1 text-comment">
                    {line.text || " "}
                  </span>
                );
              }
              return (
                <button
                  key={i}
                  onClick={() => setSelected(line.part as PartKey)}
                  onMouseEnter={() => setSelected(line.part as PartKey)}
                  onFocus={() => setSelected(line.part as PartKey)}
                  aria-pressed={active}
                  aria-label={`${PROFILES[line.part].label}: ${line.text}`}
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
            <div className="text-comment">{"// bundled resources/"}</div>
            <div className="mt-1 flex flex-wrap gap-1">
              {BUNDLED_RESOURCES.map(({ key, path }) => {
                const active = selected === key;
                return (
                  <button
                    key={key}
                    onClick={() => setSelected(key)}
                    onMouseEnter={() => setSelected(key)}
                    onFocus={() => setSelected(key)}
                    aria-pressed={active}
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

        {/* the load profile for the selected part */}
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
        {p.hot
          ? "// always in context: this part is paid on every session, for every skill installed."
          : "// off-window until needed: this part costs nothing until the skill actually reaches it."}
      </p>
    </div>
  );
}
