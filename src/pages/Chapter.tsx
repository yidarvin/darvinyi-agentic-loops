import { Suspense, lazy, useMemo } from "react";
import { Link, useParams } from "react-router";
import { chapterLoader } from "../lib/chapters";
import { chapterBySlug, adjacentChapters, registry } from "../lib/registry";
import { useHead } from "../lib/useHead";
import { Layout } from "../components/Layout";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { NotFound } from "./NotFound";

// Chapter --- resolves :slug to its MDX module and renders it inside the reading
// column. The chapter number and title come from the registry; the body is the
// lazily-loaded .mdx. Prev/next walk the published chapters in registry order.
export function Chapter() {
  const { slug = "" } = useParams();
  const meta = chapterBySlug(slug);
  const loader = chapterLoader(slug);

  useHead(
    meta ? `${meta.title} · ${registry.title}` : `Not found · ${registry.title}`,
    meta?.subtitle,
  );

  const Body = useMemo(() => (loader ? lazy(loader) : null), [loader]);

  if (!meta || !Body) return <NotFound />;

  const { prev, next } = adjacentChapters(slug);
  const num = String(meta.num).padStart(2, "0");

  return (
    <Layout>
      <div className="flex items-center gap-3">
        <p className="eyebrow">{`chapter_${num}`}</p>
        {meta.status === "draft" && (
          <span className="rounded border border-border px-1.5 py-0.5 font-mono text-[0.65rem] uppercase tracking-wider text-muted">
            draft
          </span>
        )}
      </div>
      <h1 className="mt-3 font-mono text-3xl font-bold tracking-tight text-fg">{meta.title}</h1>
      {meta.subtitle && <p className="mt-2 text-lg text-muted">{meta.subtitle}</p>}
      {meta.routes && meta.routes.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {meta.routes.map((r) => (
            <span
              key={r}
              className="rounded border border-border px-2 py-0.5 font-mono text-[0.7rem] text-muted"
            >
              {r}
            </span>
          ))}
        </div>
      )}

      <article className="mt-10">
        <ErrorBoundary key={slug}>
          <Suspense fallback={<p className="font-mono text-sm text-comment">{"// loading..."}</p>}>
            <Body />
          </Suspense>
        </ErrorBoundary>
      </article>

      <nav className="mt-16 flex justify-between border-t border-border pt-6 font-mono text-sm">
        {prev ? (
          <Link to={`/${prev.slug}`} className="text-muted hover:text-accent">
            {`<- ${prev.title}`}
          </Link>
        ) : (
          <span />
        )}
        {next ? (
          <Link to={`/${next.slug}`} className="text-muted hover:text-accent">
            {`${next.title} ->`}
          </Link>
        ) : (
          <span />
        )}
      </nav>
    </Layout>
  );
}
