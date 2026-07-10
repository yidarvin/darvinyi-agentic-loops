import { useState } from "react";

// SkillsWidget: the signature widget for "Skills". One focused move: select a part of a
// real SKILL.md and watch its load profile appear. The reader should feel that the parts
// of one small file live at different levels of progressive disclosure and cost the
// context window very differently. The description is always resident and does the
// discovering; the body loads only on a trigger; a referenced doc is read on demand; a
// bundled script's source never loads at all, only its output. Selecting a part in the
// source highlights every line that belongs to it and shows where and when it loads.
// React state only, no persistence. Facts track the Agent Skills format as of 2026.

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
    role: "The skill's identifier and its slash-command name. Lowercase, hyphens, at most 64 characters, and it may not contain \"claude\" or \"anthropic\". It is loaded for every installed skill, so it is paid once per skill on every session.",
  },
  description: {
    key: "description",
    label: "description",
    level: "level 1 · metadata",
    hot: true,
    when: "always, at startup",
    cost: "the bulk of the metadata budget (up to 1024 chars)",
    enters: "yes, always resident",
    role: "The one part the model reads to decide whether to open the skill at all. It is the discovery mechanism, so it must be third person and state both what the skill does and when to use it, with the trigger words a matching task would contain. Get this wrong and the skill never fires.",
  },
  body: {
    key: "body",
    label: "SKILL.md body",
    level: "level 2 · instructions",
    hot: false,
    when: "only when the description matches the task",
    cost: "< 5k tokens (target < 500 lines)",
    enters: "yes, but only on a trigger, then stays for the session",
    role: "The procedure the model follows once the skill fires. It is absent from the window until the description earns it a read, which is the whole point: a hundred skills can sit installed and only the one that triggers pays for its body.",
  },
  reference: {
    key: "reference",
    label: "references/FORMAT.md",
    level: "level 3+ · resources",
    hot: false,
    when: "on demand, only if the body sends the model to read it",
    cost: "its own length, and only when actually read",
    enters: "only the part read, only when read",
    role: "Detail kept one hop from the body so the body stays lean. \"See references/FORMAT.md\" means read it; the model pulls it in only when the task reaches that far, and it costs zero tokens until then.",
    pointer: "The \"See references/FORMAT.md\" line is body prose: it loads with the body at level 2 and enters the window on a trigger. This profile describes the file it points to, whose contents stay off-window until read.",
  },
  script: {
    key: "script",
    label: "scripts/validate_entry.py",
    level: "level 3+ · resources",
    hot: false,
    when: "never as source; executed via bash when the body says \"Run\"",
    cost: "≈ zero source tokens; only the output counts",
    enters: "output only, never the source",
    role: "Deterministic work the model should run, not regenerate token by token. \"Run scripts/validate_entry.py\" means execute it. The script's code never enters the window; only what it prints does, which is what makes bundled code effectively free.",
    pointer: "The \"Run scripts/validate_entry.py\" line is body prose: it loads with the body at level 2 and enters the window on a trigger. This profile describes the bundled file it names, whose source stays off-window.",
  },
};

const PART_ORDER: PartKey[] = ["name", "description", "body", "reference", "script"];

// The SKILL.md, line by line, each line tagged with the part it belongs to (or null for
// structural lines like the frontmatter fences and blanks).
interface Line {
  text: string;
  part: PartKey | null;
}

const SOURCE: Line[] = [
  { text: "---", part: null },
  { text: "name: changelog-entry", part: "name" },
  { text: "description: Formats and validates a Keep a Changelog entry. Use", part: "description" },
  { text: "  when adding a changelog entry, recording a change, or editing", part: "description" },
  { text: "  CHANGELOG.md.", part: "description" },
  { text: "---", part: null },
  { text: "", part: null },
  { text: "# Changelog entry", part: "body" },
  { text: "", part: null },
  { text: "Add a single line under the Unreleased section:", part: "body" },
  { text: "", part: null },
  { text: "1. Pick a type: Added, Changed, Fixed, Removed, Security.", part: "body" },
  { text: "2. Write one imperative line describing the change.", part: "body" },
  { text: "3. Run scripts/validate_entry.py to check it before writing.", part: "script" },
  { text: "4. Fix and re-run until it passes.", part: "body" },
  { text: "", part: null },
  { text: "For the full format, see references/FORMAT.md.", part: "reference" },
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
