import { Link } from "react-router";
import { registry } from "../lib/registry";
import { useHead } from "../lib/useHead";
import { Layout } from "../components/Layout";

// Home --- the table of contents, generated from content/registry.json.
// Chapters group under their optional `part`. Pending chapters are shown as
// dimmed, unlinked rows so the shape of the whole book is visible from day one.
export function Home() {
  useHead(registry.title, registry.subtitle);
  const parts = groupByPart(registry.chapters);

  return (
    <Layout>
      <p className="eyebrow mb-3">index</p>
      <h1 className="font-mono text-3xl font-bold tracking-tight text-fg">{registry.title}</h1>
      <p className="mt-2 text-muted">{registry.subtitle}</p>

      <div className="mt-12 space-y-10">
        {parts.map(({ part, chapters }) => (
          <section key={part ?? "_"}>
            {part && (
              <h2 className="mb-4 font-mono text-xs uppercase tracking-wider text-comment">
                {part}
              </h2>
            )}
            <ol className="space-y-1">
              {chapters.map((c) => {
                const num = String(c.num).padStart(2, "0");
                const published = c.status !== "pending";
                const row = (
                  <div className="flex items-baseline gap-4 rounded-md px-3 py-2 transition-colors">
                    <span className="w-8 shrink-0 font-mono text-xs text-comment">{num}</span>
                    <span className="flex-1">
                      <span className={published ? "text-fg" : "text-muted"}>{c.title}</span>
                      {c.subtitle && (
                        <span className="ml-2 text-sm text-muted">{c.subtitle}</span>
                      )}
                    </span>
                    <StatusTag status={c.status} />
                  </div>
                );
                return (
                  <li key={c.slug}>
                    {published ? (
                      <Link to={`/${c.slug}`} className="block no-underline hover:bg-surface">
                        {row}
                      </Link>
                    ) : (
                      <div className="cursor-default opacity-70">{row}</div>
                    )}
                  </li>
                );
              })}
            </ol>
          </section>
        ))}
      </div>
    </Layout>
  );
}

function StatusTag({ status }: { status: string }) {
  const color =
    status === "done" ? "var(--accent)" : status === "draft" ? "var(--fg-muted)" : "var(--comment)";
  return (
    <span className="shrink-0 font-mono text-[0.7rem] uppercase tracking-wider" style={{ color }}>
      {status}
    </span>
  );
}

function groupByPart<T extends { part?: string }>(items: T[]): { part?: string; chapters: T[] }[] {
  const out: { part?: string; chapters: T[] }[] = [];
  for (const item of items) {
    const last = out[out.length - 1];
    if (last && last.part === item.part) last.chapters.push(item);
    else out.push({ part: item.part, chapters: [item] });
  }
  return out;
}
