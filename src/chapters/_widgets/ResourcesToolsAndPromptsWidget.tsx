import { useState } from "react";

// ResourcesToolsAndPromptsWidget: the signature widget for "Resources, Tools, and
// Prompts". One focused move: pick a primitive and watch the whole invocation model
// change. The controller (who decides when it fires) is the thing that actually
// differs, so it sits at the top, large, and flips first; below it the two wire
// exchanges, discover then invoke, show the real request and response shapes. The
// reader should feel the thesis: same server, three primitives, one controller each.
// React state only, no persistence. Shapes track MCP revision 2025-11-25.

type Primitive = "tools" | "resources" | "prompts";

interface Exchange {
  label: string;
  request: string;
  response: string;
}

interface Spec {
  primitive: Primitive;
  controller: string;
  controllerLine: string;
  rest: string;
  when: string;
  discover: Exchange;
  invoke: Exchange;
}

const SPECS: Record<Primitive, Spec> = {
  tools: {
    primitive: "tools",
    controller: "the model",
    controllerLine: "the LLM decides, autonomously, from the name and description",
    rest: "~ POST  ·  acts, may have side effects",
    when: "the model should decide and act: side effects, external calls, dynamic retrieval",
    discover: {
      label: "discover",
      request: `{"method":"tools/list"}`,
      response: `{"result":{"tools":[{"name":"run_query","description":"Return rows from orders.","inputSchema":{"type":"object","properties":{"status":{"type":"string"}}},"annotations":{"readOnlyHint":true}}]}}`,
    },
    invoke: {
      label: "invoke",
      request: `{"method":"tools/call","params":{"name":"run_query","arguments":{"status":"paid"}}}`,
      response: `{"result":{"content":[{"type":"text","text":"[{\\"id\\":1,\\"total_cents\\":12000},{\\"id\\":2,\\"total_cents\\":4500}]"}],"isError":false}}`,
    },
  },
  resources: {
    primitive: "resources",
    controller: "the application",
    controllerLine: "the host decides what to pull into context; the model never reads it on its own",
    rest: "~ GET  ·  read-only, addressed by URI",
    when: "the app or user controls read-only context: reference material, schemas, opt-in data",
    discover: {
      label: "discover",
      request: `{"method":"resources/list"}`,
      response: `{"result":{"resources":[{"uri":"db://schema","name":"database-schema","mimeType":"application/json"}]}}`,
    },
    invoke: {
      label: "read",
      request: `{"method":"resources/read","params":{"uri":"db://schema"}}`,
      response: `{"result":{"contents":[{"uri":"db://schema","mimeType":"application/json","text":"{\\"orders\\":{...}}"}]}}`,
    },
  },
  prompts: {
    primitive: "prompts",
    controller: "the user",
    controllerLine: "a human explicitly selects it, typically as a slash command",
    rest: "~ stored template  ·  a macro the user triggers",
    when: "the user triggers a known, repeatable workflow, or you encode best practices",
    discover: {
      label: "discover",
      request: `{"method":"prompts/list"}`,
      response: `{"result":{"prompts":[{"name":"weekly_report","arguments":[{"name":"region","required":true}]}]}}`,
    },
    invoke: {
      label: "get",
      request: `{"method":"prompts/get","params":{"name":"weekly_report","arguments":{"region":"west"}}}`,
      response: `{"result":{"messages":[{"role":"user","content":{"type":"text","text":"Paid revenue is 16500 cents..."}}]}}`,
    },
  },
};

const ORDER: Primitive[] = ["tools", "resources", "prompts"];

function Wire({ ex }: { ex: Exchange }) {
  return (
    <div>
      <div className="font-mono text-[0.7rem] text-comment">{`// ${ex.label}`}</div>
      <pre className="mt-1 overflow-x-auto rounded border border-border bg-surface-2 p-2.5 font-mono text-[0.7rem] leading-relaxed">
        <span className="block">
          <span className="text-comment">{"C -> S  "}</span>
          <span className="text-fg/90">{ex.request}</span>
        </span>
        <span className="mt-1 block">
          <span className="text-comment">{"S -> C  "}</span>
          <span className="text-accent">{ex.response}</span>
        </span>
      </pre>
    </div>
  );
}

export function ResourcesToolsAndPromptsWidget() {
  const [primitive, setPrimitive] = useState<Primitive>("tools");
  const spec = SPECS[primitive];

  return (
    <div className="font-sans">
      {/* the one move: pick a primitive */}
      <div
        role="group"
        aria-label="MCP primitive"
        className="inline-flex rounded border border-border p-0.5 font-mono text-xs"
      >
        {ORDER.map((p) => (
          <button
            key={p}
            onClick={() => setPrimitive(p)}
            aria-pressed={primitive === p}
            className={`rounded px-3 py-1.5 transition-colors motion-reduce:transition-none ${
              primitive === p ? "bg-accent/15 text-accent" : "text-muted hover:text-fg"
            }`}
          >
            {p}
          </button>
        ))}
      </div>

      {/* the differentiator, front and center: who controls it */}
      <div className="mt-4 rounded border border-accent/30 bg-surface p-3">
        <div className="font-mono text-[0.7rem] text-comment">{"// controlled by"}</div>
        <div className="mt-0.5 font-mono text-lg text-accent">{spec.controller}</div>
        <p className="mt-1 font-sans text-sm leading-relaxed text-fg/80">{spec.controllerLine}</p>
        <div className="mt-2 font-mono text-[0.7rem] text-muted">{spec.rest}</div>
      </div>

      {/* the two wire exchanges: discover, then invoke */}
      <div className="mt-4 space-y-3">
        <Wire ex={spec.discover} />
        <Wire ex={spec.invoke} />
      </div>

      {/* when to reach for it */}
      <dl className="mt-4 rounded border border-border bg-surface p-3 font-mono text-[0.7rem]">
        <dt className="text-comment">{"// reach for it when"}</dt>
        <dd className="mt-0.5 text-fg/90">{spec.when}</dd>
      </dl>
    </div>
  );
}
