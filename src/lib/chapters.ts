// chapters.ts --- maps a slug to its lazily-loaded MDX module.
// import.meta.glob keeps each chapter in its own JS chunk, so the reader only
// downloads the chapter they open. Adding src/chapters/<slug>.mdx is enough for
// it to appear here; the registry controls whether it is linked and in what order.
import type { ComponentType } from "react";

type MdxImporter = () => Promise<{ default: ComponentType<Record<string, unknown>> }>;

const modules = import.meta.glob("../chapters/*.mdx") as Record<string, MdxImporter>;

const bySlug: Record<string, MdxImporter> = {};
for (const path in modules) {
  const slug = path.split("/").pop()!.replace(/\.mdx$/, "");
  bySlug[slug] = modules[path];
}

export function chapterLoader(slug: string): MdxImporter | undefined {
  return bySlug[slug];
}

export const availableSlugs = Object.keys(bySlug);
