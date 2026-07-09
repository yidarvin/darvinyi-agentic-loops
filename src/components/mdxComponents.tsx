import type { MDXComponents } from "mdx/types";
import type { ComponentPropsWithoutRef } from "react";
import { Figure } from "./Figure";
import { Widget } from "./Widget";
import { ExerciseCard } from "./ExerciseCard";
import { Callout } from "./Callout";

// mdxComponents --- how markdown renders, in one place.
// Every chapter's prose flows through these via the <MDXProvider> in App.tsx.
// The four shared primitives (Figure, Widget, ExerciseCard, Callout) are exposed
// here too, so a chapter can use <Figure> without importing it. Chapter-specific
// components (a bespoke figure or the signature widget) are imported in the .mdx.
export const mdxComponents: MDXComponents = {
  h1: (props: ComponentPropsWithoutRef<"h1">) => (
    <h1 className="mb-2 mt-0 font-mono text-2xl font-bold tracking-tight text-fg" {...props} />
  ),
  h2: (props: ComponentPropsWithoutRef<"h2">) => (
    <h2 className="mb-3 mt-12 border-b border-border pb-2 font-mono text-lg font-bold text-fg" {...props} />
  ),
  h3: (props: ComponentPropsWithoutRef<"h3">) => (
    <h3 className="mb-2 mt-8 font-mono text-base font-medium text-accent" {...props} />
  ),
  p: (props: ComponentPropsWithoutRef<"p">) => (
    <p className="my-4 leading-7 text-fg/90" {...props} />
  ),
  ul: (props: ComponentPropsWithoutRef<"ul">) => (
    <ul className="my-4 list-disc space-y-1 pl-6 text-fg/90 marker:text-comment" {...props} />
  ),
  ol: (props: ComponentPropsWithoutRef<"ol">) => (
    <ol className="my-4 list-decimal space-y-1 pl-6 text-fg/90 marker:text-comment" {...props} />
  ),
  li: (props: ComponentPropsWithoutRef<"li">) => <li className="leading-7" {...props} />,
  a: (props: ComponentPropsWithoutRef<"a">) => <a {...props} />,
  blockquote: (props: ComponentPropsWithoutRef<"blockquote">) => (
    <blockquote
      className="my-6 border-l-2 border-comment pl-4 italic text-muted"
      {...props}
    />
  ),
  hr: () => <hr className="my-10 border-border" />,
  strong: (props: ComponentPropsWithoutRef<"strong">) => (
    <strong className="font-semibold text-fg" {...props} />
  ),
  em: (props: ComponentPropsWithoutRef<"em">) => <em className="italic" {...props} />,
  code: (props: ComponentPropsWithoutRef<"code">) => (
    <code
      className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[0.85em] text-accent"
      {...props}
    />
  ),
  pre: (props: ComponentPropsWithoutRef<"pre">) => (
    <pre
      className="my-6 overflow-x-auto rounded-lg border border-border bg-surface p-4 font-mono text-sm leading-relaxed [&_code]:bg-transparent [&_code]:p-0 [&_code]:text-fg/90"
      {...props}
    />
  ),
  Figure,
  Widget,
  ExerciseCard,
  Callout,
};
