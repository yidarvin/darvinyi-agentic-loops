import type { ReactNode } from "react";
import { Link } from "react-router";
import { registry } from "../lib/registry";

/** The shell: a quiet mono header, a centered reading column, a thin footer. */
export function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-bg text-fg">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-4">
          <Link to="/" className="font-mono text-sm text-fg no-underline hover:no-underline">
            <span className="text-comment">/* </span>
            {registry.title}
            <span className="text-comment"> */</span>
          </Link>
          <a
            href="https://github.com/yidarvin"
            className="font-mono text-xs text-muted hover:text-accent"
          >
            source
          </a>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-5 py-10">{children}</main>
      <footer className="border-t border-border">
        <div className="mx-auto max-w-3xl px-5 py-6 font-mono text-xs text-comment">
          {"// built with claude code --- one chapter at a time"}
        </div>
      </footer>
    </div>
  );
}
