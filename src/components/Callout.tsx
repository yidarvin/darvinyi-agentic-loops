import type { ReactNode } from "react";

interface CalloutProps {
  kind?: "note" | "danger";
  children: ReactNode;
}

/** An aside. `danger` is reserved for genuinely important safety content. */
export function Callout({ kind = "note", children }: CalloutProps) {
  const isDanger = kind === "danger";
  return (
    <aside
      className="my-6 rounded-md border-l-2 bg-surface px-4 py-3 text-sm leading-relaxed"
      style={{
        borderColor: isDanger ? "var(--danger)" : "var(--accent)",
      }}
    >
      <span
        className="mb-1 block font-mono text-[0.7rem] uppercase tracking-wider"
        style={{ color: isDanger ? "var(--danger)" : "var(--comment)" }}
      >
        {isDanger ? "// important" : "// note"}
      </span>
      {children}
    </aside>
  );
}
