# Coordination Patterns

Research reference for *Agentic Loops*, Chapter 13 (second chapter of Part III, Multi-Agent Systems; follows "Delegation," precedes "When Multi-Agent Fails"). Current as of 2026. The reader already knows the delegation mechanic (orchestrator-worker, context isolation, spawning subagents as tool calls, parallelism, specialization, result compression); this chapter maps the FULL space of topologies and the mechanisms that implement them. Framework details drift fast; version-pin and re-verify. Note that headline benchmarks are vendor-reported.

## TL;DR
- Coordination reduces to two orthogonal axes plus one governing choice: the **topology** (who is connected to whom — single, supervisor, pipeline, hierarchical, network/swarm, group-chat/debate, blackboard, concurrent), the **mechanism** (how control and information move — handoffs, agents-as-tools, shared state, message passing, routing), and **who drives** (code-driven deterministic vs model-driven emergent orchestration).
- Dominant 2026 finding: more structure buys reliability and debuggability; more emergence buys capability at the cost of token burn and fragility. Anthropic's multi-agent research system beat single-agent Opus 4 by 90.2% on breadth-first research but used ~15× tokens; Cognition argued the opposite for coding, where conflicting writes and dispersed context make multi-agent fragile. Both are right for their task class.
- Choose the least-powerful topology that fits the task's dependency structure: sequential for linear stages, concurrent/map-reduce for independent parallel subtasks, supervisor for dynamic routing with central synthesis, hierarchical for deep decomposition, network/swarm for peer handoff where the path is unknown, group-chat/debate for tasks benefiting from multiple perspectives. Reserve emergent topologies for high-value tasks where the payoff justifies the cost multiplier.

## The space of coordination topologies
Think of each topology as a graph: nodes are agents, edges are control/information flow. Questions: (a) is there a central node, (b) is the edge set fixed or dynamic, (c) does control return to a caller or transfer away.

**Single agent (baseline).** One LLM in a loop with tools. No coordination overhead, one context window, one trace, trivially debuggable. Fails when tool count bloats the prompt, the window can't hold the working set, or the task needs genuine parallel exploration. LangChain's benchmark (Will Fu-Hinthorn, modified τ-bench, `gpt-4o`): the single agent *wins* at low complexity — "When there is only a single distractor domain the single agent performs slightly better... the single agent baseline falls off sharply when there are two or more distractor domains." A concrete measured argument against premature decomposition.

**Supervisor / orchestrator-worker (reference point).** A central agent routes work to specialists. Two sub-variants: *supervisor-as-router* (near-only job is classification/routing — a focused LLM call, maximizing routing accuracy) and *supervisor with tool-calling* (a full agent calling specialists as tools and synthesizing — the "manager pattern"). Most generic topology, easiest to reason about (routing logic in one place). Weakness — the "translation" tax: every request round-trips through the supervisor, adding latency/tokens and a paraphrasing bottleneck. LangChain: the drop "arises due to the 'translation' the supervisor is doing... If you've ever played a game of 'telephone,' you're already familiar with this problem," and "supervisor consistently uses more tokens than swarm." LangChain got a ~50% performance increase simply by fixing the translation problem — removing handoff messages from sub-agent context, adding a `forward_message` tool so the supervisor forwards a specialist's response verbatim, and tuning tool naming.

**Sequential / pipeline / chain.** Agents in fixed order, each output feeding the next (writer → editor → fact-checker; CodeWriter → CodeReviewer → CodeRefactorer). A straight line, no central controller. Strengths: maximally predictable, cheap, trivially traceable, deterministic. Weaknesses: no dynamic routing, no recovery if a stage's assumptions are wrong, latency = sum of stages. Google ADK `SequentialAgent`, CrewAI `Process.sequential`.

**Hierarchical.** Supervisors of supervisors: a top-level orchestrator delegates to mid-level supervisors, each coordinating its own worker team. For complex tasks needing nested decomposition. LangGraph nests compiled subgraphs as nodes in a parent graph (state isolation per tier). Strength: divides an unmanageable coordination problem into tractable layers. Weakness: every layer multiplies latency, token cost, failure surface; routing accuracy compounds across tiers.

**Network / mesh / peer-to-peer (swarm).** Many-to-many handoffs, no central controller. Each agent holds explicit handoff tools for the peers it can transfer to; the system remembers the last-active agent so the conversation continues. Strengths: no supervisor bottleneck (one fewer LLM call per turn — LangChain found "the swarm architecture slightly outperforms supervisor architecture across the board"), emergent problem-solving. Weaknesses: every agent must know the others (doesn't compose with third-party agents), harder to trace (chains >3 hops signal a routing problem), no single place for global logic. `langgraph-swarm` (handoff tools returning `Command(goto=..., graph=Command.PARENT)`), OpenAI Agents SDK handoffs, AutoGen `Swarm`.

**Group chat / debate / collaborative.** Multiple agents share one conversation, take turns; a manager (round-robin, LLM selector, or handoff) picks the next speaker. AutoGen `RoundRobinGroupChat`, `SelectorGroupChat`, reflection (primary + critic). The debate sub-pattern (agents independently answer, then critique over rounds) has research backing: Du et al. (2023) improved math/strategic reasoning and reduced hallucination; Liang et al. and Khan et al. extended to divergent-thinking and judge-supervised variants. Most token-hungry topology. Documented failure modes: debates can collapse toward majority opinion when agents share training distributions, and models tend to escalate confidence across rounds rather than calibrate. Use where multiple perspectives genuinely add value (investment decisions, risk review, adversarial verification) and you can afford the round multiplier.

**Blackboard / shared-memory.** Agents coordinate via a shared workspace, not direct messaging. A central blackboard holds messages, intermediate inferences, and history; agents read/write it, incrementally building on each other; a control unit selects who acts next based on blackboard state. Two variants: *shared-memory* (coordinator assigns tasks) vs *true blackboard* (requests broadcast, each agent autonomously decides whether to contribute). Research systems (Han & Zhang, arXiv:2507.01701) report strong accuracy plus token savings vs static workflows, because the blackboard keeps compact high-salience state and avoids unnecessary agent executions. The architectural generalization of "agents coordinating through shared state" — maps directly onto LangGraph's shared state object.

**Concurrent / parallel.** Agents work simultaneously; results aggregated or voted. Two flavors: (a) *fan-out/fan-in* (independent subtasks run in parallel, a reducer merges results — Google ADK `ParallelAgent`, LangGraph Send API map-reduce, Anthropic's parallel subagents); (b) *ensemble/self-consistency* (multiple agents attempt the same task, outputs voted). Strength: latency collapses to the slowest branch, not the sum; parallel context windows multiply effective reasoning capacity. Weakness: rate limits and resource spikes, atomic superstep failure semantics, the need for a conflict-resolving merge strategy.

## Mechanisms of coordination
**Handoffs.** One agent transfers control to another. In the OpenAI Agents SDK a handoff is a tool named `transfer_to_<agent_name>`; when the model calls it, execution moves to the target, which sees the entire prior conversation and *takes over* the user-facing response. Supports `input_filter`s (e.g., `handoff_filters.remove_all_tools`) and `on_handoff` callbacks. Defining property: control does *not* return to the caller. Mechanism behind swarm and triage.
```python
from agents import Agent, handoff
from agents.extensions import handoff_filters
billing_agent = Agent(name="Billing agent")
refund_agent = Agent(name="Refund agent")
triage_agent = Agent(
    name="Triage agent",
    handoffs=[billing_agent, handoff(refund_agent, input_filter=handoff_filters.remove_all_tools)],
)
```
**Agents-as-tools (manager pattern).** An agent exposed as a callable tool. The manager stays in control, calls the specialist for a bounded subtask, gets a result, shapes the final answer. Control *returns*. `agent.as_tool(tool_name=..., tool_description=...)`. Mechanism behind supervisor-with-tool-calling and Anthropic's orchestrator-worker. Easier to debug — the manager's decision process is in one place.
```python
customer_facing_agent = Agent(
    name="Customer-facing agent",
    instructions="Handle all direct user communication. Call tools when specialized expertise is needed.",
    tools=[
        booking_agent.as_tool(tool_name="booking_expert", tool_description="Handles booking questions."),
        refund_agent.as_tool(tool_name="refund_expert", tool_description="Handles refunds."),
    ],
)
```
The distinction is crisp: manager pattern → *edges are tool calls*; decentralized → *edges are handoffs that transfer execution*.

**Shared state / scratchpad.** Agents read/write a common state object — LangGraph's core abstraction and the blackboard mechanism. Highest-bandwidth channel (no paraphrasing loss) but requires disciplined schema design and conflict resolution.

**Message passing / actor model.** Agents send async messages; a runtime routes them. AutoGen v0.4+ rebuilt on the actor model: `AutoGen Core` is an event-driven runtime where agents are actors computing in response to messages, decoupling delivery from handling (enables multi-process/cross-language agents, static and dynamic workflows). Tradeoff: conversation-style message passing consumes tokens fast — every message occupies context.

**Routing.** A dispatcher decides which agent handles what: a dedicated classifier (supervisor-as-router), an LLM selecting the next speaker (`SelectorGroupChat`), a rules/state function (LangGraph conditional edges), or emergent (each agent's handoff decision in a swarm).

**Orchestration control flow.** The meta-mechanism: who decides next — the code-driven vs model-driven spectrum (below).

## State management
LangGraph is the reference for shared-state coordination.

**State object.** A graph is defined over a shared state schema (`TypedDict`, dataclass, Pydantic). Every node has signature `State -> Partial<State>`: read the whole state, return only the keys to update. The graph (nodes + edges) *is* the coordination substrate; agents never talk directly, they read and write state.

**Reducers / channels.** Each key can be annotated with a reducer `(current, update) -> merged`. Default is overwrite. `operator.add` concatenates lists; `add_messages` appends and deduplicates by ID (updating in place on ID collision — critical for tool-calling loops where the model regenerates responses). Reducers make *concurrent* writes safe: when parallel nodes each return `{"sources": [url]}`, the reducer folds them into one list. LangGraph requires reducers to be deterministic and batching-invariant (`reducer(reducer(s, xs), ys) == reducer(s, xs + ys)`) so checkpointed writes can be replayed in batches.

**Supersteps and parallelism.** Pregel-style supersteps: nodes fanning out from a common node run concurrently in one superstep and must all complete before the next. If one parallel node fails, the whole superstep fails atomically (prevents inconsistent state; on resume only the failing branch retries). `max_concurrency` bounds simultaneous nodes (rate limits). The **Send API** enables runtime-determined fan-out (map-reduce): a node returns a list of `Send(node, state)` objects — count decided at runtime — each running in parallel with its own worker state, merged back via a reducer.
```python
from langgraph.constants import Send
def continue_to_workers(state):
    return [Send("worker", {"item": item}) for item in state["items"]]
builder.add_conditional_edges("fan_out", continue_to_workers)  # dynamic parallel dispatch
builder.add_edge("worker", "aggregate")                        # fan-in
```
**Checkpointing and durability.** A checkpointer persists state after every superstep, scoped to a `thread_id`. Gives durable execution (resume after crash mid-workflow), replay, and human-in-the-loop pause/resume. `MemorySaver` is dev-only; production uses `PostgresSaver` (or Redis/MongoDB). A checkpoint is a recovery point, not a log entry. Recent versions add beta *delta channels* storing incremental updates for large append-heavy state. Keep state lean — store large objects externally, keep references in state.

**The context-sharing tension** (connects to delegation's isolation theme). Two opposing pressures: *isolate* for cleanliness/parallelism (Anthropic's subagents each get their own window; the Claude Agent SDK spawns each subagent fresh, only the final message returns) vs *share* for coordination (without shared context, agents make conflicting implicit decisions — Cognition's Flappy Bird: "Subagent 1... started building a background that looks like Super Mario Bros. Subagent 2 built you a bird, but it doesn't look like a game asset," motivating Principle 1: "Share context, and share full agent traces, not just individual messages"). Reconciliation the field converged on: **reads parallelize, writes don't.** Anthropic distributes *read/search* across isolated subagents but funnels *synthesis* through the single lead; uses an external filesystem as shared memory (subagents write findings to files, return lightweight references); and persists the lead's plan to memory because context >200,000 tokens gets truncated.

## Orchestration frameworks (2026)
**LangGraph.** Graph-based, explicit nodes/edges, shared reducer-based state, checkpointing. Leans code-driven/explicit. Supports every topology: supervisor (`langgraph-supervisor`, control returns after each specialist), swarm (`langgraph-swarm`, handoff tools + `Command(goto=..., graph=Command.PARENT)`), hierarchical (nested subgraphs), arbitrary custom graphs. Most controllable/observable but steepest learning curve (StateGraph, reducers, checkpointers). 30,000+ GitHub stars; 1.0 production release stabilizing durable execution, structured memory, human-in-the-loop.

**OpenAI Agents SDK.** Lightweight, four primitives (Agents, Tools, Handoffs, Guardrails), built on the Responses API by default. Two patterns: **manager (agents-as-tools)** and **decentralized (handoffs)**. Leans model-driven. OpenAI-native but works with any OpenAI-compatible endpoint. Formerly the experimental "Swarm" (now a reference design; the Agents SDK is the supported path). Built-in tracing.

**Microsoft AutoGen → Microsoft Agent Framework.** AutoGen v0.4 (Jan 2025) rebuilt on the actor model: event-driven `Core`, `AgentChat` high-level API (`RoundRobinGroupChat`, `SelectorGroupChat`, `Swarm`, `MagenticOneGroupChat`, `SocietyOfMindAgent`), `Extensions`. Oct 2025: **Microsoft Agent Framework (MAF)** merged AutoGen's orchestration with Semantic Kernel's enterprise foundations; **v1.0 shipped April 3 2026** (stable APIs, LTS). MAF changes the control-flow model: where AutoGen "pairs an event-driven core with a high-level Team," MAF "centers on a typed, graph-based Workflow that routes data along edges and activates executors when inputs are ready" — a shift toward LangGraph-style typed edges. AutoGen and Semantic Kernel now in maintenance mode. MAF supports both Agent Orchestration (LLM-driven) and Workflow Orchestration (deterministic), with native MCP and A2A.
```python
# AutoGen v0.4 group chat with reflection (primary + critic)
from autogen_agentchat.agents import AssistantAgent
from autogen_agentchat.teams import RoundRobinGroupChat
from autogen_agentchat.conditions import TextMentionTermination
primary = AssistantAgent("primary", model_client=client, system_message="You are a writer.")
critic  = AssistantAgent("critic",  model_client=client, system_message="Provide feedback. Respond APPROVE when satisfied.")
team = RoundRobinGroupChat([primary, critic], termination_condition=TextMentionTermination("APPROVE"))
```
**CrewAI.** Role-based "crews." `Process.sequential` (tasks in order, each output feeds the next) and `Process.hierarchical` (a manager agent — `manager_llm` or custom `manager_agent`, kept *outside* the worker pool — dynamically assigns tasks, reviews outputs). Low-code, fast to prototype. Caveat: a documented critique (*Towards Data Science*) found CrewAI's hierarchical process can misfire — executing tasks sequentially rather than truly delegating — unless you supply a custom manager with explicit step-wise instructions; verify hierarchical delegation with traces.
```python
from crewai import Crew, Process
crew = Crew(agents=my_agents, tasks=my_tasks, process=Process.hierarchical, manager_llm="gpt-4o")
```
**Claude Agent SDK.** Anthropic's renamed (from Claude Code SDK, Sept 2025) production runtime exposing the Claude Code harness. Subagents via the `agents` parameter or `.claude/agents/*.md`; the `Agent`/`Task` tool must be in `allowedTools` or delegation is blocked; subagents can't spawn their own subagents. Each subagent runs in fresh isolated context — the only channel in is the prompt string, out is the final message. For dozens-to-hundreds of agents, the **Workflow tool** (TS SDK v0.3.149+) moves orchestration into a script the runtime executes outside conversation context. Automatic context compaction handles long orchestrator sessions.

**Google ADK.** Distinguishes LLM agents (reasoning) from **workflow agents** (deterministic): `SequentialAgent`, `ParallelAgent`, `LoopAgent` — a code-defined blueprint with *no* LLM deciding control flow ("the same way every time"). Parallel sub-agents write to distinct state keys (`output_key`); a later agent reads them (fan-in). Plus agents-as-tools and router agents. Native A2A; four language SDKs (Python, TypeScript, Java, Go), with Java and Go reaching 1.0/GA in early 2026 — lets a Python agent talk to a Java agent via A2A without either knowing the other's language.

**A2A protocol.** Agent2Agent, Google, April 9 2025, 50+ founding partners, donated to the Linux Foundation (June 2025), IBM's ACP merged in. Where MCP connects agents to *tools*, A2A connects agents to *agents* across frameworks/vendors. HTTP + JSON-RPC 2.0 + SSE, OAuth 2.0/JWT. Three concepts: **Agent Cards** (machine-readable capability descriptors for discovery), **Tasks** (units of work with a lifecycle: submitted → working → input-required → completed/canceled/failed), structured bidirectional messages. Cross-framework coordination at the protocol level. Adopted natively by MAF and Google ADK.

## Choosing a coordination pattern
| Task structure | Topology | Why |
|---|---|---|
| Clear linear stages, each depends on the last | **Sequential/pipeline** | Predictable, cheap, traceable; no routing |
| Independent subtasks, results aggregated | **Concurrent/parallel (map-reduce)** | Latency = slowest branch; parallel windows |
| Dynamic routing, central synthesis needed | **Supervisor** | One place for routing logic; easy to debug |
| Deep, nested decomposition | **Hierarchical** | Divides unmanageable coordination into layers |
| Path unknown upfront, peers take over | **Network/swarm (handoffs)** | No supervisor bottleneck; emergent routing |
| Multiple perspectives / iterative critique | **Group chat / debate** | Improves factuality/reasoning; catches errors |
| Autonomous contributors, shared workspace | **Blackboard** | High-bandwidth shared state; token-efficient |
| Anything, until proven insufficient | **Single agent** | No coordination overhead; often enough |

Governing tradeoffs: **control vs flexibility** (structured = predictable/compliant; emergent = handles unforeseen cases but resists control); **structure vs emergence** (the central thesis: more constrained = more reliable/debuggable, more flexible = more capable/harder to control — a dial to set per task); **token cost** (agents ~4× chat, multi-agent ~15×; debate multiplies by rounds; supervisor > swarm due to translation); **latency** (sequential = sum, parallel = slowest branch, supervisor adds a hop/turn, hierarchical multiplies hops by depth); **reliability/debuggability** (degrades with hop count; chains >3 hops signal trouble; routing accuracy drops after ~8–12 sub-agent round trips).

**Is multi-agent worth it at all?** The June 2025 Cognition-vs-Anthropic debate. Cognition ("Don't Build Multi-Agents," June 12): for coding — where agents *write* and conflicting writes produce incompatible outputs — dispersed context makes multi-agent fragile; a single-threaded agent with full context is more reliable. Anthropic (June 13): multi-agent beat single-agent by 90.2% for *research* (breadth-first, read-heavy, decomposable, exceeding one window), and "token usage by itself explains 80% of the variance" on BrowseComp. Synthesis (echoed by LangChain): **reads parallelize, writes don't; multi-agent earns its ~15× multiplier only when the task decomposes into independent, high-value, breadth-first strands.** Coding, tightly-coupled reasoning, and anything needing shared write-state are poor fits — Anthropic concedes "most coding tasks involve fewer truly parallelizable tasks than research."

## Orchestration control: who drives
**Code-driven (deterministic).** Developer specifies the graph/sequence; control flow fixed. LangGraph explicit edges, Google ADK workflow agents, CrewAI sequential, MAF Workflow Orchestration. Choose for reliability, predictability, reproducibility, compliance, debuggability. OpenAI's docs concede: "orchestrating via code makes tasks more deterministic and predictable, in terms of speed, cost and performance."

**Model-driven (emergent).** The LLM decides next — which agent to hand off to, which tool to call, when to stop. OpenAI Agents SDK handoffs and agents-as-tools, CrewAI hierarchical manager, AutoGen `SelectorGroupChat`, Anthropic's lead agent. Choose for flexibility and unforeseen cases. Anthropic: "You can't hardcode a fixed path for exploring complex topics… a linear, one-shot pipeline cannot handle these tasks."

Most frameworks sit on a spectrum and mix: LangGraph leans code-driven but a node can be a fully autonomous agent; the Agents SDK leans model-driven but you can wrap it in deterministic Python; MAF exposes both as first-class modes. Practical rule: **push as much control flow into code as the task's predictability allows, let the model drive only the genuinely dynamic decision points.**

## Practical considerations
- **Clear interfaces between agents** (highest-leverage practice). Anthropic's lead must give each subagent an objective, output format, tool guidance, boundaries; vague instructions ("research the semiconductor shortage") caused duplication — one subagent explored the 2021 automotive chip crisis while two others redundantly investigated 2025 supply chains. Treat inter-agent contracts like API contracts — schema-validated where possible (a planning step emitting validated JSON, not prose the caller must parse).
- **Avoid coordination overhead.** Each agent/handoff is an LLM call. Azure guidance warns flow-control overhead often exceeds the benefit of splitting; <4 roles → default to a flat supervisor or a single well-prompted agent. Anthropic's early system spawned 50 subagents for simple queries — fixed with explicit effort-scaling rules in the prompt (simple fact-finding: 1 agent, 3–10 calls; comparisons: 2–4 subagents, 10–15 calls each; complex: 10+ subagents).
- **Observability and tracing.** Debugging a 10-agent workflow requires trace trees, not logs. LangSmith renders the full execution tree (every LLM call, tool invocation, handoff), framework-agnostic via OpenTelemetry; the OTel GenAI semantic conventions are the emerging standard. Capture *intent*, not just execution — log the reasoning/node-transition alongside tool calls, to distinguish "chose wrong" from "got bad inputs." Correlating spans across parallel runs is the hard part; a consistent `thread_id`/session ID is essential.
- **State consistency.** Concurrent writes need reducers; atomic superstep semantics mean a partial failure rolls back the superstep. Checkpoint to durable storage so a crash mid-workflow resumes rather than restarts.
- **Error handling and recovery.** When one agent in a pipeline fails: node-level typed error objects written to state, graph-level conditional edges to an error handler with bounded retries and fallbacks (lighter model, cached response, human escalation), app-level circuit breakers and per-run token budget caps. The 15× multiplier compounds catastrophically without circuit breakers — a runaway subagent that recursively spawns more can multiply cost 10× again.
- **Setup for the next chapter.** MAST (Cemri et al., UC Berkeley, arXiv:2503.13657 — 1,642 annotated traces across 7 frameworks, Cohen's κ=0.88): failures cluster into specification/system-design (41.77%), inter-agent misalignment (36.94%), task verification (21.30%). Critically, "improvements in base model capabilities will be insufficient to address the full taxonomy" — many failures are *organizational design*, not model quality. Downstream work reports uncoordinated systems amplify errors up to 17×, while centralized architectures with validation bottlenecks contain amplification to ~4.4×. The bridge to "When Multi-Agent Fails."

## Recommendations (staged)
1. **Start single-agent; earn every split.** Add a specialist only when a branch needs genuinely different tools/policy/prompt, or the working set exceeds one window. Single agents win at low complexity and only degrade once several distractor domains are added.
2. **Match topology to dependency structure, not aesthetics** (use the table). Linear → sequential; independent parallel → map-reduce; dynamic routing with synthesis → supervisor; deep nesting → hierarchical; unknown path → swarm; multiple perspectives → debate.
3. **Default to code-driven orchestration; reserve model-driven for genuinely dynamic decision points.** Push control flow into explicit graphs/sequences wherever the task is predictable.
4. **Pick the framework by control-flow need.** LangGraph for maximum control/observability and stateful production; OpenAI Agents SDK for lightweight OpenAI-native handoff/manager; MAF for enterprise .NET/Python with both modes; CrewAI for fast role-based prototyping (verify hierarchical delegation with traces); Claude Agent SDK for Claude-native context-isolated subagents; Google ADK for deterministic workflow agents and multi-language A2A interop.
5. **Parallelize reads, serialize writes.** Distribute search/exploration across isolated subagents; funnel synthesis through one agent. Use external shared memory (files, blackboard, LangGraph state) for high-bandwidth handoff instead of lossy chat returns.
6. **Instrument before you scale.** Wire OpenTelemetry/LangSmith trace trees, log intent alongside execution, add per-run token budget caps and circuit breakers before running anything past ~3 agents.

**Benchmarks that would change these recommendations:** single-agent trace shows context-window saturation or serial-search bottlenecks → escalate to multi-agent. Multi-agent trace shows handoff chains >3 hops, routing-accuracy collapse past ~8–12 round trips, or write-conflicts → collapse back toward single-agent or a stricter supervisor.

## Caveats
- The multi-agent value question is genuinely contested — the Cognition-vs-Anthropic split is real and unresolved; both positions are correct for their task class (writes vs reads). Don't treat "multi-agent = better" as settled.
- Framework capabilities move fast: version-specific facts (MAF 1.0 April 2026, ADK Java/Go 1.0, LangGraph 1.0, Claude Agent SDK metering changes June 2026, AutoGen/Semantic Kernel maintenance mode) were current as of mid-2026 but churn quickly; verify against docs.
- Vendor benchmarks are self-reported: Anthropic's 90.2% improvement, the ~15× multiplier, and "80% of variance" are from Anthropic's internal eval; LangChain's supervisor/swarm findings are from LangChain's own modified τ-bench (and the head-to-head per-architecture accuracy percentages exist only as chart images in that post, not as text). Treat cross-vendor comparisons cautiously.
- CrewAI hierarchical and debate patterns carry documented failure modes (sequential-execution misfire; debate confidence-escalation and majority-opinion collapse) — validate empirically rather than trusting the abstraction.
- The structure-vs-emergence dial has no universal setting — it's task-dependent; the "right" answer for research is wrong for coding.