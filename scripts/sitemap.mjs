// Generate dist/sitemap.xml from the registry after a build. Published chapters
// only. If the registry has no top-level "url" there is nothing to anchor the links
// to, so this exits quietly. Plain Node, no dependencies, so the Vercel build stays
// python-free. Runs as npm's postbuild step.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const registry = JSON.parse(readFileSync(resolve(root, "content/registry.json"), "utf8"));
const distDir = resolve(root, "dist");

const base = typeof registry.url === "string" ? registry.url.replace(/\/+$/, "") : "";
if (!base) {
  console.log("sitemap: no 'url' in registry.json, skipping.");
  process.exit(0);
}
if (!existsSync(distDir)) {
  console.log("sitemap: no dist/ directory, skipping.");
  process.exit(0);
}

const published = (registry.chapters ?? []).filter((c) => c.status !== "pending");
const locs = [`${base}/`, ...published.map((c) => `${base}/${c.slug}`)];
const body = locs.map((loc) => `  <url><loc>${loc}</loc></url>`).join("\n");
const xml =
  '<?xml version="1.0" encoding="UTF-8"?>\n' +
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
  `${body}\n` +
  "</urlset>\n";

writeFileSync(resolve(distDir, "sitemap.xml"), xml);
console.log(`sitemap: wrote ${locs.length} url(s) to dist/sitemap.xml`);
