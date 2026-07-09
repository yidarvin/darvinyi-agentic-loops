import type { ReactNode } from "react";

interface RunnableArtifactProps {
  /** Mono id for the artifact, e.g. "loop_runner". */
  name: string;
  /** Repo-relative location of the code, e.g. "artifacts/ch01-the-loop/". */
  path: string;
  /** Runtime label shown as a tag, e.g. "python 3.11" or "node 20". */
  runtime?: string;
  /** Command(s) that run the artifact. A string or an ordered list of lines. */
  run?: string | string[];
  /** Environment or services the artifact needs, e.g. "ANTHROPIC_API_KEY". */
  requires?: string | string[];
  /** Optional link to the source (for example the file on GitHub). */
  href?: string;
  /** A short description of what the artifact does. */
  children?: ReactNode;
}

const asList = (v: string | string[] | undefined): string[] =>
  v === undefined ? [] : Array.isArray(v) ? v : [v];

/**
 * The runnable artifact block. Every chapter ships real, executable code the
 * reader can run beyond inline snippets; this frames where it lives, how to run
 * it, and what it needs. Structure only, no execution: it points at code in the
 * repo rather than pretending to run in the browser.
 */
export function RunnableArtifact({
  name,
  path,
  runtime,
  run,
  requires,
  href,
  children,
}: RunnableArtifactProps) {
  const commands = asList(run);
  const needs = asList(requires);

  return (
    <section
      className="my-8 overflow-hidden rounded-lg border border-accent/30 bg-surface"
      aria-label={`Runnable artifact: ${name}`}
    >
      <header className="flex items-baseline justify-between border-b border-border px-5 py-3">
        <span className="font-mono text-xs text-accent">{`// ${name}`}</span>
        <span className="font-mono text-[0.7rem] uppercase tracking-wider text-comment">
          runnable
        </span>
      </header>

      <div className="space-y-4 p-5">
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 font-mono text-xs">
          <span className="text-comment">{"// source"}</span>
          {href ? (
            <a href={href} className="text-accent hover:underline">
              {path}
            </a>
          ) : (
            <span className="text-fg/90">{path}</span>
          )}
          {runtime && (
            <span className="rounded border border-border px-1.5 py-0.5 text-muted">
              {runtime}
            </span>
          )}
        </div>

        {children && <div className="font-sans text-sm leading-relaxed text-fg/90">{children}</div>}

        {commands.length > 0 && (
          <pre className="overflow-x-auto rounded-md border border-border bg-surface-2 p-4 font-mono text-sm leading-relaxed text-fg/90">
            {commands.map((cmd, i) => (
              <span key={i} className="block">
                <span className="select-none text-comment">{"$ "}</span>
                {cmd}
              </span>
            ))}
          </pre>
        )}

        {needs.length > 0 && (
          <p className="font-mono text-xs text-comment">
            {`// requires: ${needs.join(", ")}`}
          </p>
        )}
      </div>
    </section>
  );
}
