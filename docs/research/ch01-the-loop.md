# The Loop: An LLM Agent's Fundamental Structure

Research reference for *Agentic Loops*, Chapter 1. Current as of 2026. Verify version-sensitive claims (model names, SWE-bench numbers, reverse-engineered Claude Code internals) against current sources at build time.

## TL;DR
- An "agent" is fundamentally **the loop, not the model**: the smallest correct definition, which the field has converged on, is Anthropic's — agents "are typically just LLMs using tools based on environmental feedback in a loop" — and reverse-engineering of Claude Code shows only ~1.6% of its codebase is AI decision logic while ~98.4% is the operational harness around a `while`-loop.
- The minimal viable agent is roughly fifteen lines — call the model, if it emits a tool-use request execute it and append the result, repeat until it stops — and this minimalism is surprisingly capable: mini-swe-agent scores >74% on SWE-bench Verified (Gemini 3 Pro, 74.2%) in ~100 lines of Python using only bash.
- The loop is best formalized as a control loop over a stochastic policy (a POMDP): the frozen LLM is an open-loop policy conditioned only on the context the harness chooses to expose; what is genuinely new is that behavior is shaped entirely by context construction rather than by weight updates or hand-coded planners.

## Key findings
1. **The loop is the primitive.** The perceive-decide-act-observe cycle maps cleanly onto an LLM agent: perceive = assemble context (system prompt + message history + latest observation), decide = model forward pass emitting text and/or tool-use blocks, act = harness executes the requested tool, observe = tool result appended to the message list. The model is a pure stateless function; the loop supplies all statefulness.
2. **Termination is a harness responsibility, not a model one.** Real stop conditions are: (a) the model returns no tool-use request, (b) an explicit completion signal, (c) a hard iteration/step limit, (d) a cost/token/wall-time budget, and (e) error states. LLMs are unreliable at knowing when to stop, so the harness must own these.
3. **Minimal harnesses are startlingly strong**, which shifts credit from scaffold to model. The SWE-bench team's conclusion: "the interface is the model."
4. **Agent vs workflow is the load-bearing distinction.** Workflows orchestrate LLMs through predefined code paths (you own the control flow); agents let the model direct its own process and tool use (the model owns the control flow). Use the simplest thing that passes eval.
5. **The message list IS the agent's working memory.** State accumulates linearly; the system prompt, tool definitions, conversation, and tool results all live in one context window.
6. **Modern coding agents keep the core loop single-threaded and reactive**, investing engineering in the harness (permissions, compaction, steering, persistence) rather than in decision scaffolding.
7. **Long-horizon failure is structural**: context accumulation, error cascades, and loss of coherence compound because per-step error rates multiply and attention degrades over long contexts.

## Details

### 1. The core agentic loop as a primitive
The ancestor is **sense-plan-act (SPA)**, the deliberative robotics architecture from the Shakey robot (Stanford Research Institute, late 1960s): perceive → build/update world model → plan → act, then repeat. The LLM agent loop is a direct descendant, but the "world model" is the accumulated text in the context window and the "planner" is a frozen neural policy.

**Formalization.** Model an LLM agent as a discrete-time closed-loop system over a POMDP ⟨S, O, M, T, π⟩. At each step t: the true state s_t is not observable; the agent receives a partial observation o_t (a tool result, file contents, a shell exit code); it conditions on the interaction history h_t (in practice, the message list); the model acts as a stochastic policy a_t ~ π(· | c(s_t)) where c is the context-construction function implemented by the harness. The LLM is open-loop: it never sees s_t, only c(s_t), the projection of state the harness chooses to expose. Because the policy is frozen, the only lever is c and the controller C. The "agent" is the (c, C) pair wrapped around a policy.

**The four phases with an LLM brain:** perceive = assemble the prompt (system prompt, tool schemas, message list, newest observation); decide = one forward pass emitting text and/or tool-use requests (the ReAct pattern, Yao et al. 2022, arXiv:2210.03629, interleaving reasoning and actions); act = harness parses tool-use requests, checks permissions, dispatches to real implementations; observe = tool results appended to the message list.

**Termination (stop conditions).** In the Anthropic Messages API the natural exit is `stop_reason`. `tool_use` means the model wants a tool; `end_turn` means done; `max_tokens` means truncated (may leave an incomplete tool_use requiring retry with a higher budget); `pause_turn` occurs on long server-tool turns. Practical stop conditions: no tool use in the response; explicit completion signal (a submit/done tool, or mini-swe-agent's `echo COMPLETE_TASK_AND_SUBMIT_FINAL_OUTPUT`); max iterations; budget exceeded; error states. LLMs "are notoriously bad at knowing when to stop," so the harness owns termination.

### 2. The minimal viable agent loop
Canonical minimal loop against the Anthropic Messages API:

```python
from anthropic import Anthropic
client = Anthropic()

tools = [{
    "name": "get_weather",
    "description": "Current weather for a city.",
    "input_schema": {"type": "object",
        "properties": {"city": {"type": "string"}}, "required": ["city"]},
}]

def run_tool(name, args):
    if name == "get_weather":
        return f"{args['city']}: 31C, clear."
    return "unknown tool"

messages = [{"role": "user", "content": "What's the weather in Mumbai?"}]
while True:
    resp = client.messages.create(
        model="claude-sonnet-4-6", max_tokens=1024,
        tools=tools, messages=messages,
    )
    messages.append({"role": "assistant", "content": resp.content})  # verbatim
    if resp.stop_reason != "tool_use":
        print(next(b.text for b in resp.content if b.type == "text"))
        break
    tool_results = [
        {"type": "tool_result", "tool_use_id": b.id, "content": run_tool(b.name, b.input)}
        for b in resp.content if b.type == "tool_use"
    ]
    messages.append({"role": "user", "content": tool_results})
```

Two API invariants: append the assistant turn verbatim so tool_use IDs stay aligned; tool_result blocks must be in a user message immediately following their tool_use blocks. Barry Zhang's (Anthropic) compression: `env = Environment(); while True: action = llm.run(system_prompt + env.state); env.state = tools.run(action)`.

**Reference minimal implementations:**
- **mini-swe-agent** (Princeton & Stanford SWE-bench/SWE-agent team): ~100 lines of core Python, scores **>74% on SWE-bench Verified** (per Live-SWE-agent, arXiv:2511.13646: 74.2% Gemini 3 Pro at $0.46/issue, 70.6% Claude 4.5 Sonnet at $0.56, 65.0% GPT-5 at $0.28). Uses **only bash** (no tool-calling API), so it runs with any model. Completely linear history (trajectory == messages), each action via independent `subprocess.run` (no persistent shell). Control flow uses a two-tier exception hierarchy: NonTerminatingException (FormatError, timeout — caught, appended, loop continues) and TerminatingException (Submitted, LimitsExceeded — loop returns). Benchmark caps: max 250 steps, $3/issue. (v2 moved action parsing to the Model, added `wall_time_limit_seconds`, `max_consecutive_format_errors=3`, termination via `role == "exit"`.)
- **Anthropic "Building Effective Agents"** (Dec 2024): agents "are typically just LLMs using tools based on environmental feedback in a loop"; "find the simplest solution possible, and only increasing complexity when needed."
- **Barry Zhang's talk:** three components define an agent — environment, tools/interface, system prompt — then "the model gets called in a loop, and that's agents."

**Why minimal loops are capable, and what it implies.** SWE-bench evaluates *models* by fixing the harness to minimal bash-only mini-swe-agent precisely because a thin harness isolates model capability. Lesson: "Optimize for the prompt + tools, not the framework… The framework's job is to be invisible." But it's contested (see Caveats): a 100-line windowed file viewer plus a targeted edit tool has been shown to roughly double SWE-bench score versus raw bash. Honest synthesis: as base models strengthen, the *marginal* value of scaffolding shrinks, but harness engineering still determines reliability, cost, and safety.

### 3. Agent vs workflow
Anthropic's distinction: **workflows** orchestrate LLMs and tools through predefined code paths (you own control flow); **agents** dynamically direct their own processes and tool usage (the model owns control flow). The **augmented LLM** (model + retrieval + tools + memory) is the building block. Five canonical workflow patterns: prompt chaining, routing, parallelization, orchestrator-workers, evaluator-optimizer.

**When to use which** (Barry Zhang's rules): don't build agents for everything; if you can map the decision tree, build a workflow. Reserve agents for tasks that are (a) ambiguous enough you can't pre-map the path, (b) valuable enough to justify token spend (rule of thumb: $0.10/task ≈ 30K–50K tokens), (c) where error cost is tolerable or detectable. Coding is the exemplary agent use case: ambiguous, output verifiable by tests, models strong at it. Anthropic collapses agent design to three decisions: environment, tools, system prompt.

### 4. Anatomy of the loop's state
The **running message list is the agent's working memory**. Structure: system prompt (re-sent every call, cumulative overhead); tool definitions (name + description + JSON input_schema, in the `tools` field every request, consuming budget — the agent-computer interface / ACI); conversation accumulation (grows linearly); content blocks (text, tool_use, tool_result, thinking, image). Per the **12-Factor Agents** guide (Dex Horthy / HumanLayer): own your context window, unify execution and business state, make your agent a stateless reducer. Horthy's rule from 100K+ sessions: past ~40% of context capacity "the model starts drifting, hallucinating, and forgetting its own instructions."

### 5. Control flow details
**Single-threaded, reactive core** is dominant, validated by Claude Code reverse-engineering: one `queryLoop()` (community codename **nO**) regardless of interface. The "Dive into Claude Code" analysis (MBZUAI VILA Lab): "The core of the system is a simple while-loop that calls the model, runs tools, and repeats. Most of the code, however, lives in the systems around this loop." Community estimates: ~1.6% AI decision logic vs ~98.4% operational infrastructure. **Steering** (mid-task input): a dual-buffer async message queue (codename **h2A**) lets a user inject instructions while the model works, folded into the next call without restart. Anthropic's docs confirm the capability ("You can interrupt at any point to steer Claude… Claude works autonomously but stays responsive to your input") and frame the loop as gather context → take action → verify results, repeated. **12-Factor:** agent = prompt + switch statement + accumulated context + for-loop; certain tool calls should break the loop (request_clarification, deploy_backend) implementing human-in-the-loop as ordinary control flow.

### 6. Why loops fail at long horizons
Structural, sets up later chapters: **error cascades** (a single root-cause error propagates; per-step error probability multiplies across dependent steps); **context accumulation** (every turn adds tokens; tool outputs balloon context fast — agents "fall apart after a few tool calls"); **loss of coherence / context rot** (attention degrades on mid-context info, the lost-in-the-middle effect, even when the window is half full). These motivate compaction, external memory, sub-agent isolation, and verification separated from generation.

### 7. Theoretical framing
**Agents as a control loop over a stochastic policy.** The POMDP formalism clarifies why the same model produces different agents: capability is a property of (π, c, C) jointly, not π alone — which is why you cannot compare LLM agents without disclosing the harness. **Connection to classic architectures:** the perception-action cycle / sense-plan-act minus the symbolic world model; a REPL analogy (read = perceive, eval = decide + execute, print = observe, loop); an RL control loop where the policy is a language model conditioned on text. **What is genuinely new when the policy is a frozen LLM:** (1) behavior is shaped only by context, not weights — context engineering replaces online learning; (2) the policy is general-purpose and language-native — same policy drives coding, research, support by swapping prompt and tools; (3) reasoning is inline and legible — ReAct thinking traces are part of the observable trajectory, both an interpretability affordance and a context cost.

## Recommendations
1. **Start with the simplest thing** (default to workflow or single call). Can you map the decision tree? Is the task valuable enough? Is error cost tolerable? If any answer is unfavorable, don't build an agent.
2. **Build the minimal loop first.** Implement the ~15-line Messages-API loop directly against the SDK (not a framework). Define environment, tools (with carefully engineered ACI — absolute paths, poka-yoke'd arguments, high-signal outputs), system prompt. Instrument from day one.
3. **Add harness engineering, not scaffolding.** Priority: hard stop conditions (step/cost/wall-time limits, format-error cap — 250-step/$3 is a reasonable reference); informative errors (`is_error: true`); context management (compaction on threshold, keep under ~40%); human-in-the-loop for high-stakes actions; permissioning/sandboxing.
4. **Only then consider multi-agent.** Keep the core loop single-threaded as long as it scales. Add sub-agents only for parallelizable, context-isolatable sub-tasks, expecting a large token multiplier. Anthropic's data: lead+subagent design "outperformed single-agent Claude Opus 4 by 90.2%" but "multi-agent systems use about 15× more tokens than chats."

## Caveats
- **How much scaffolding helps is an active debate.** Strong thesis (model is everything, harness invisible) supported by mini-swe-agent's bash-only >74% and Claude Code's ~1.6% ratio; counter-evidence shows a good ACI can double SWE-bench over raw bash. Resolution depends on model strength.
- **Single vs multi-agent is unresolved.** Cognition ("Don't Build Multi-Agents," June 2025) vs Anthropic ("How we built our multi-agent research system," next day). Reconciliation: multi-agent for read-mode/parallelizable/isolatable work; single-agent for sequential/shared-context work like coding.
- **Reverse-engineering caveats.** Claude Code internals (nO, h2A, the 1.6%/98.4% split) come from community analysis of obfuscated JS plus academic study, not official Anthropic architecture docs. Treat specific numbers as indicative.
- **SWE-bench numbers move.** Reported scores are model- and version-specific snapshots; leaderboards update continuously.