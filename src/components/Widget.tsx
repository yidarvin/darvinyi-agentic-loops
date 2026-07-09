import type { ReactNode } from "react";

interface WidgetProps {
  /** A short label for the interaction, e.g. "queue_board". */
  name: string;
  /** One line telling the reader what to try. */
  hint?: string;
  children: ReactNode;
}

/**
 * The one signature interactive widget per chapter. The widget lets the reader
 * feel the concept, not just read it. Wrap the interactive body in this so every
 * chapter's widget is framed the same way.
 */
export function Widget({ name, hint, children }: WidgetProps) {
  return (
    <section className="my-8 rounded-lg border border-accent/30 bg-surface">
      <header className="flex items-baseline justify-between border-b border-border px-5 py-3">
        <span className="font-mono text-xs text-accent">{`// ${name}`}</span>
        <span className="font-mono text-[0.7rem] uppercase tracking-wider text-comment">
          interactive
        </span>
      </header>
      <div className="p-5">{children}</div>
      {hint && (
        <p className="border-t border-border px-5 py-3 font-mono text-xs text-muted">
          <span className="text-comment">{"/* "}</span>
          {hint}
          <span className="text-comment">{" */"}</span>
        </p>
      )}
    </section>
  );
}
