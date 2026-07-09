import { useState } from "react";

// QueueBoard --- the one signature widget for this chapter. It lets the reader
// feel the core mechanic: a queue of items, each PENDING until a run turns the
// next one DONE. Pure React state, no persistence (artifacts and this template
// keep widget state in memory on purpose).

interface Item {
  id: string;
  title: string;
  status: "pending" | "done";
}

const SEED: Item[] = [
  { id: "01", title: "the settled body", status: "pending" },
  { id: "02", title: "the quiet mind", status: "pending" },
  { id: "03", title: "tranquility by judgment", status: "pending" },
  { id: "04", title: "the middle way", status: "pending" },
];

export function QueueBoard() {
  const [items, setItems] = useState<Item[]>(SEED);

  const doneCount = items.filter((i) => i.status === "done").length;
  const nextIndex = items.findIndex((i) => i.status === "pending");

  function runNext() {
    if (nextIndex === -1) return;
    setItems((prev) =>
      prev.map((it, i) => (i === nextIndex ? { ...it, status: "done" } : it))
    );
  }

  function reset() {
    setItems(SEED.map((i) => ({ ...i, status: "pending" })));
  }

  return (
    <div className="font-sans">
      <div className="mb-4 flex items-center justify-between">
        <span className="font-mono text-xs text-muted">
          {doneCount}/{items.length} built
        </span>
        <div className="flex gap-2">
          <button
            onClick={runNext}
            disabled={nextIndex === -1}
            className="rounded border border-accent/50 bg-accent/10 px-3 py-1.5 font-mono text-xs text-accent transition-colors hover:bg-accent/20 disabled:cursor-not-allowed disabled:opacity-40"
          >
            run the next one
          </button>
          <button
            onClick={reset}
            className="rounded border border-border px-3 py-1.5 font-mono text-xs text-muted transition-colors hover:text-fg"
          >
            reset
          </button>
        </div>
      </div>

      <ol className="space-y-1.5">
        {items.map((it, i) => {
          const isNext = i === nextIndex;
          const done = it.status === "done";
          return (
            <li
              key={it.id}
              className="flex items-center gap-3 rounded-md border px-3 py-2 transition-all duration-300"
              style={{
                borderColor: done
                  ? "color-mix(in srgb, var(--accent) 40%, transparent)"
                  : isNext
                    ? "var(--border)"
                    : "var(--border)",
                background: done ? "color-mix(in srgb, var(--accent) 8%, transparent)" : "transparent",
                opacity: done ? 1 : isNext ? 1 : 0.6,
              }}
            >
              <span
                className="font-mono text-xs"
                style={{ color: done ? "var(--accent)" : "var(--comment)" }}
              >
                {done ? "[x]" : "[ ]"}
              </span>
              <span className="font-mono text-xs text-comment">ch_{it.id}</span>
              <span className={done ? "flex-1 text-sm text-fg" : "flex-1 text-sm text-muted"}>
                {it.title}
              </span>
              {isNext && (
                <span className="font-mono text-[0.7rem] uppercase tracking-wider text-accent">
                  next
                </span>
              )}
            </li>
          );
        })}
      </ol>

      {nextIndex === -1 && (
        <p className="mt-4 font-mono text-xs text-comment">
          {"// queue empty --- every chapter built"}
        </p>
      )}
    </div>
  );
}
