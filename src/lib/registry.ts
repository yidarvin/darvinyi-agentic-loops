// registry.ts --- typed access to the "database" at content/registry.json.
// The registry is the ordered table of contents. It is the one place that knows
// which chapters exist, their order, and their build status. The runner (skill)
// updates it; the site reads it.
import data from "../../content/registry.json";

export type ChapterStatus = "pending" | "draft" | "done";

export interface ChapterMeta {
  /** Display number shown in the UI. Not part of the URL. */
  num: number;
  /** URL-safe id. Must match the mdx filename in src/chapters/<slug>.mdx. */
  slug: string;
  title: string;
  subtitle?: string;
  /** Optional grouping, e.g. "Part I --- Foundations". */
  part?: string;
  /** Recurring cross-chapter threads this chapter touches. */
  routes?: string[];
  status: ChapterStatus;
}

export interface Registry {
  title: string;
  subtitle: string;
  /** Build mode. `book` is a linear textbook; `graph` follows citations and may
   *  append newly discovered items to the queue. Absent means `book`. */
  mode?: "book" | "graph";
  /** Optional canonical origin, e.g. "https://example.com". When set, the build
   *  writes dist/sitemap.xml from the published chapters. */
  url?: string;
  chapters: ChapterMeta[];
}

export const registry = data as Registry;

/** Chapters that have a built page (draft or done), in registry order. */
export const publishedChapters = registry.chapters.filter((c) => c.status !== "pending");

export function chapterBySlug(slug: string): ChapterMeta | undefined {
  return registry.chapters.find((c) => c.slug === slug);
}

export function adjacentChapters(slug: string): {
  prev?: ChapterMeta;
  next?: ChapterMeta;
} {
  const list = publishedChapters;
  const i = list.findIndex((c) => c.slug === slug);
  if (i === -1) return {};
  return { prev: list[i - 1], next: list[i + 1] };
}
