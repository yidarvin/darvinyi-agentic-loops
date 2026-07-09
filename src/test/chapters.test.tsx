import type { ComponentType } from "react";
import { describe, it, expect } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { MDXProvider } from "@mdx-js/react";
import { mdxComponents } from "../components/mdxComponents";
import { AppRoutes } from "../App";
import { registry } from "../lib/registry";

// Every MDX module on disk, regardless of registry status. The chapter being built
// is still `pending` at verify time, so scoping by status would skip exactly the
// one that matters. The build already compiles all on-disk MDX; this asserts they
// also render, which is the gap `vite build` cannot cover.
const mdxModules = import.meta.glob("../chapters/*.mdx") as Record<
  string,
  () => Promise<{ default: ComponentType<Record<string, unknown>> }>
>;

const published = registry.chapters.filter((c) => c.status !== "pending");

describe("every MDX module renders directly", () => {
  for (const [path, load] of Object.entries(mdxModules)) {
    it(`renders ${path}`, async () => {
      const mod = await load();
      const Body = mod.default;
      // No ErrorBoundary here, so a widget or figure that throws at render fails loud.
      expect(() =>
        render(
          <MemoryRouter>
            <MDXProvider components={mdxComponents}>
              <Body />
            </MDXProvider>
          </MemoryRouter>,
        ),
      ).not.toThrow();
    });
  }
});

describe("every published chapter renders at its route", () => {
  for (const chapter of published) {
    it(`route /${chapter.slug}`, async () => {
      render(
        <MDXProvider components={mdxComponents}>
          <MemoryRouter initialEntries={[`/${chapter.slug}`]}>
            <AppRoutes />
          </MemoryRouter>
        </MDXProvider>,
      );
      // Wait until the lazy body has resolved: the Suspense fallback is gone whether
      // the body rendered or threw into the ErrorBoundary. Asserting before this (the
      // title alone lives in the always-present header) would let a swallowed widget
      // crash slip through.
      await waitFor(() => expect(screen.queryByText("// loading...")).toBeNull());
      // The title renders.
      expect(screen.getAllByText(chapter.title).length).toBeGreaterThan(0);
      // The ErrorBoundary fallback must be absent, or a crash was swallowed.
      expect(screen.queryByText(/chapter failed to render/i)).toBeNull();
    });
  }
});

describe("registry and modules line up", () => {
  it("every published chapter has an mdx module", () => {
    const slugs = new Set(
      Object.keys(mdxModules).map((p) => p.split("/").pop()!.replace(/\.mdx$/, "")),
    );
    for (const chapter of published) {
      expect(slugs.has(chapter.slug)).toBe(true);
    }
  });

  it("home lists every chapter title", async () => {
    render(
      <MDXProvider components={mdxComponents}>
        <MemoryRouter initialEntries={["/"]}>
          <AppRoutes />
        </MemoryRouter>
      </MDXProvider>,
    );
    for (const chapter of registry.chapters) {
      expect(await screen.findAllByText(chapter.title)).not.toHaveLength(0);
    }
  });
});
