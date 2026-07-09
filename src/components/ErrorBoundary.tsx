import { Component, type ErrorInfo, type ReactNode } from "react";
import { Link } from "react-router";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Catches a render-time crash in one chapter's body so a single broken widget or
 * figure costs one chapter, not the whole site. Wrapped around the chapter article
 * and keyed by slug, so navigating to another chapter resets it.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("chapter render error:", error, info.componentStack);
  }

  render(): ReactNode {
    if (this.state.error) {
      return (
        <div
          className="my-8 rounded-lg border-l-2 bg-surface p-5 font-mono text-sm"
          style={{ borderColor: "var(--danger)" }}
        >
          <p style={{ color: "var(--danger)" }}>{"// chapter failed to render"}</p>
          <p className="mt-2 text-muted">{this.state.error.message}</p>
          <p className="mt-4 text-comment">
            <Link to="/" className="text-accent">
              back to the index
            </Link>
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}
