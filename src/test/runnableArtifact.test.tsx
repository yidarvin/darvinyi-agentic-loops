import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { RunnableArtifact } from "../components/RunnableArtifact";

// RunnableArtifact is the shared block every chapter uses for its runnable code. No
// chapter is built yet during Phase 0, so this exercises the component directly to
// keep it covered by the gate: it must render its source path, run commands, and
// requirements without throwing.
describe("RunnableArtifact renders", () => {
  it("shows the source path, run command, and requirements", () => {
    render(
      <RunnableArtifact
        name="loop_runner"
        path="artifacts/ch01-the-loop/"
        runtime="python 3.11"
        run={["pip install -r requirements.txt", "python loop.py"]}
        requires="ANTHROPIC_API_KEY"
      >
        A minimal agent loop that logs each phase as it turns.
      </RunnableArtifact>,
    );
    expect(screen.getByText("artifacts/ch01-the-loop/")).toBeTruthy();
    expect(screen.getByText(/python loop\.py/)).toBeTruthy();
    expect(screen.getByText(/requires: ANTHROPIC_API_KEY/)).toBeTruthy();
  });

  it("links the source path when href is set and renders with no optional props", () => {
    const { rerender } = render(
      <RunnableArtifact name="a" path="artifacts/x/" href="https://example.com/x" />,
    );
    const link = screen.getByRole("link", { name: "artifacts/x/" });
    expect(link.getAttribute("href")).toBe("https://example.com/x");
    // A bare artifact with only name + path must still render.
    expect(() => rerender(<RunnableArtifact name="b" path="artifacts/y/" />)).not.toThrow();
  });
});
