import { useState } from "react";

type Capability = "mcp" | "subagents" | "sandbox";

interface CapabilityState {
  mcp: boolean;
  subagents: boolean;
  sandbox: boolean;
}

interface CapabilityToggleProps {
  capability: Capability;
  description: string;
  enabled: boolean;
  onToggle: () => void;
}

const labels: Record<Capability, string> = {
  mcp: "MCP tools",
  subagents: "Read-only subagents",
  sandbox: "Kernel sandbox",
};

function CapabilityToggle({ capability, description, enabled, onToggle }: CapabilityToggleProps) {
  return (
    <button
      type="button"
      aria-pressed={enabled}
      onClick={onToggle}
      className="w-full rounded-md border border-border bg-surface-2 px-3 py-3 text-left transition-colors hover:border-accent/50 focus:outline-none focus:ring-2 focus:ring-accent"
    >
      <span className="flex items-center justify-between gap-3 font-mono text-xs">
        <span className="text-fg">{labels[capability]}</span>
        <span className={enabled ? "text-accent" : "text-comment"}>{enabled ? "enabled" : "disabled"}</span>
      </span>
      <span className="mt-1 block font-sans text-xs leading-5 text-muted">{description}</span>
    </button>
  );
}

export function StageThreeProductionGradeWidget() {
  const [capabilities, setCapabilities] = useState<CapabilityState>({
    mcp: true,
    subagents: true,
    sandbox: true,
  });

  const toggle = (capability: Capability) => {
    setCapabilities((current) => ({ ...current, [capability]: !current[capability] }));
  };

  const trace = [
    "startup: load project context and bounded memory",
    capabilities.mcp
      ? "discover: namespace external tools; mark descriptions and results untrusted"
      : "discover: use native tools only",
    capabilities.subagents
      ? "inspect: depth-one read-only worker returns a compressed finding"
      : "inspect: coordinator consumes the inspection output directly",
    "verify: permission policy evaluates deny, ask, allow",
    capabilities.sandbox
      ? "execute: workspace-scoped process with constrained egress"
      : "execute: approved process inherits host privileges",
  ];

  const safetyTitle = capabilities.sandbox ? "contained execution" : "host blast radius";
  const safetyDetail = capabilities.sandbox
    ? "An approved command remains limited by the filesystem and network rules. Policy still decides whether it starts."
    : "Permission prompts may still appear, but an approved command has no kernel-enforced containment.";
  const highRisk = capabilities.mcp && !capabilities.sandbox;
  const liveSummary = `${labels.mcp} ${capabilities.mcp ? "on" : "off"}; ${labels.subagents} ${capabilities.subagents ? "on" : "off"}; ${labels.sandbox} ${capabilities.sandbox ? "on" : "off"}. ${safetyTitle}.`;

  return (
    <div className="space-y-5 font-sans">
      <div>
        <p className="font-mono text-xs text-comment">{"// scenario: review an unfamiliar dependency update"}</p>
        <p className="mt-2 text-sm leading-6 text-fg/90">
          Configure the live path. Memory stays loaded before the task and survives after it.
        </p>
      </div>

      <div className="grid gap-2 md:grid-cols-3">
        <CapabilityToggle
          capability="mcp"
          description="Adds namespaced external tools and untrusted server text."
          enabled={capabilities.mcp}
          onToggle={() => toggle("mcp")}
        />
        <CapabilityToggle
          capability="subagents"
          description="Moves noisy inspection into a fresh, bounded context."
          enabled={capabilities.subagents}
          onToggle={() => toggle("subagents")}
        />
        <CapabilityToggle
          capability="sandbox"
          description="Constrains a process after policy permits it to start."
          enabled={capabilities.sandbox}
          onToggle={() => toggle("sandbox")}
        />
      </div>

      <div className="rounded-md border border-border bg-surface-2 p-4">
        <p className="font-mono text-xs text-accent">{"// dispatch_trace"}</p>
        <ol className="mt-3 space-y-2 font-mono text-xs leading-5 text-fg/90">
          {trace.map((line, index) => (
            <li key={line} className="flex gap-3">
              <span className="text-comment">{String(index + 1).padStart(2, "0")}</span>
              <span>{line}</span>
            </li>
          ))}
        </ol>
      </div>

      <div
        className="rounded-md border bg-surface p-4"
        style={{ borderColor: capabilities.sandbox ? "var(--accent-dim)" : "var(--danger)" }}
      >
        <p className="font-mono text-xs" style={{ color: capabilities.sandbox ? "var(--accent)" : "var(--danger)" }}>
          {`// ${safetyTitle}`}
        </p>
        <p className="mt-2 text-sm leading-6 text-fg/90">{safetyDetail}</p>
        {capabilities.subagents && (
          <p className="mt-2 font-mono text-xs leading-5 text-comment">
            {"subagent rule: MAX_DEPTH = 1, read-only tools, final summary only"}
          </p>
        )}
        {highRisk && (
          <p className="mt-3 font-mono text-xs leading-5" style={{ color: "var(--danger)" }}>
            {"MCP output can influence an approved host-privileged process. Restore containment before using external tools."}
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-mono text-xs text-comment" aria-live="polite">
          {liveSummary}
        </p>
        <button
          type="button"
          onClick={() => setCapabilities({ mcp: true, subagents: true, sandbox: true })}
          className="rounded border border-accent/50 bg-accent/10 px-3 py-2 font-mono text-xs text-accent transition-colors hover:bg-accent/20 focus:outline-none focus:ring-2 focus:ring-accent"
        >
          restore production profile
        </button>
      </div>
    </div>
  );
}
