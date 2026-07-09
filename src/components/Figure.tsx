import type { ReactNode } from "react";

interface FigureProps {
  /** Short id shown in the caption, e.g. "0.1". Renders as a fig N.N comment label. */
  id?: string;
  caption?: ReactNode;
  children: ReactNode;
}

/**
 * A figure explains the model. Prose teaches, the figure shows the shape of the
 * idea. Keep figures as inline SVG components (themeable via the CSS variables)
 * rather than raster images.
 */
export function Figure({ id, caption, children }: FigureProps) {
  return (
    <figure className="my-8 rounded-lg border border-border bg-surface p-5">
      <div className="overflow-x-auto">{children}</div>
      {caption && (
        <figcaption className="mt-4 font-mono text-xs leading-relaxed text-muted">
          {id && <span className="text-comment">{`/* fig ${id} */ `}</span>}
          {caption}
        </figcaption>
      )}
    </figure>
  );
}
