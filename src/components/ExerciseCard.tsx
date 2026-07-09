import type { ReactNode } from "react";

interface ExerciseCardProps {
  /** Two-digit ordinal, e.g. "01". */
  n: string;
  title: string;
  children: ReactNode;
}

/** A practice prompt. Chapters close with a short run of these. */
export function ExerciseCard({ n, title, children }: ExerciseCardProps) {
  return (
    <div className="my-4 rounded-md border border-border bg-surface p-4">
      <div className="mb-2 flex items-center gap-3">
        <span className="font-mono text-xs text-accent">{`exercise_${n}`}</span>
        <span className="font-mono text-sm text-fg">{title}</span>
      </div>
      <div className="text-sm leading-relaxed text-muted">{children}</div>
    </div>
  );
}
