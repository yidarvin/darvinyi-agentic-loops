# Anatomy of a Tool Call: From Token to Execution and Back

Research reference for *Agentic Loops*, Chapter 2. Primary reference is the Anthropic Messages API; OpenAI function calling appears as contrast. Current as of 2026. Verify version-sensitive claims (API fields, beta headers, model-specific tokenization) against current provider docs at build time.

## TL;DR

- A tool call is not a function call the model makes; it is a **structured request the model emits as content**, which the harness parses, executes, and feeds back as another turn. The model never touches the filesystem or network. The entire mechanism is the harness reading a `tool_use` block and returning a `tool_result` block on the next turn.
- Under the hood tool definitions and tool-call blocks are **serialized into the ordinary token stream** using model-specific formatting the provider controls. The model does not have a privileged "function-calling channel"; it has been post-trained to emit a particular structured format that the API layer parses back into typed blocks. What the model literally sees is text (plus special delimiter tokens), not JSON objects.
- Tool definitions live in the **cached prefix**. Every tool you add costs tokens on every request, and changing the tool list invalidates the prompt cache. Tool ergonomics (the agent-computer interface) matter more than most teams expect: Anthropic reported spending more time optimizing its tools than the overall prompt for its SWE-bench work (the paraphrase there is broad tool design, not descriptions alone).

## The lifecycle of a single tool call

Seven stages, Anthropic Messages API framing:

1. **Definition.** You declare tools in the top-level `tools` array. Each entry is `{name, description, input_schema}` where `input_schema` is a JSON Schema object describing the tool's parameters. The description is the single most important field: it is what the model reads to decide whether and how to call the tool.

2. **Serialization into the prompt.** The API renders the tool definitions into the prompt that the model actually sees, in a model-specific format, ahead of the conversation. This consumes input tokens on every request (see the token-level section). System prompt guidance about tools is injected here too.

3. **Decision + emission.** The model runs a forward pass and, if it decides to use a tool, emits a `tool_use` content block: `{type: "tool_use", id, name, input}` where `input` is a JSON object conforming to the tool's schema. The response `stop_reason` is `"tool_use"`. The model may also emit text and/or thinking blocks alongside the tool_use in the same turn.

4. **Parsing.** The harness reads the response content blocks, finds the `tool_use` block(s), extracts `name` and `input`, and validates. The `id` is a correlation handle that must be echoed back.

5. **Execution.** The harness dispatches to the real tool implementation with the parsed `input`, after any permission or safety checks. This is ordinary code: a shell command, an HTTP call, a file read.

6. **Result formatting + return.** The harness wraps the output in a `tool_result` content block: `{type: "tool_result", tool_use_id, content, is_error?}` and sends it back in a **user** message. The `tool_use_id` must match the `id` from stage 3.

7. **Re-entry into context.** The tool_result becomes part of the running message list. On the next model call the model sees the result as part of the conversation history and conditions its next generation on it. The loop repeats until the model emits a turn with no tool_use (`stop_reason == "end_turn"`).

Two API invariants make this work: (a) the assistant turn must be appended to the message list **verbatim**, so the `tool_use` `id`s stay aligned; (b) `tool_result` blocks must appear in a `user` message and must **immediately follow** the corresponding `tool_use` blocks in conversation order.

## The token-level representation

This is the part most treatments skip and the part experts most want.

- **There is no separate function-calling channel.** Function/tool calling is not a distinct API-level transport at the model layer; it is a **formatting convention the model was post-trained to follow**, rendered into the same token stream as everything else. The provider's API layer translates between the clean typed blocks you send/receive and the on-the-wire token format the model consumes/produces.
- **Tool definitions are rendered to tokens.** When you pass the `tools` array, the API serializes those definitions (names, descriptions, JSON Schemas) into the model's context using an internal template. This is why tool definitions count against your input token budget and against the cache prefix. The exact template is provider-controlled and not fully documented; you can estimate the cost with the token-counting endpoint.
- **What the model emits.** The model generates tokens that encode a structured tool call in its trained format (often involving special delimiter tokens or a structured convention the provider defines). The API parses those tokens back into the `tool_use` block with typed `input`. From the model's perspective it is producing a continuation of text; from your perspective you receive a clean JSON object.
- **Anthropic vs OpenAI representational differences.** Both providers expose typed tool-call objects at the API surface, but the underlying formatting conventions differ and are model-specific. Anthropic surfaces tool calls as `tool_use` content blocks inside the assistant message's `content` array; OpenAI surfaces them as a separate `tool_calls` array on the assistant message with `function.name` and `function.arguments` (the arguments arriving as a JSON **string** that you must parse, not a pre-parsed object). This difference (content block with parsed `input` vs a sibling array with stringified `arguments`) is the most visible representational contrast for someone porting code between them.
- **Practical implication.** Because the representation is learned formatting rather than a hard protocol, malformed emissions are possible (truncated JSON, schema violations), which is why error handling and constrained decoding matter.

## Anthropic Messages API tool-use mechanics, in detail

- **`tools`**: array of `{name, description, input_schema}`. `input_schema` is JSON Schema (`type: "object"` with `properties` and `required`).
- **`tool_use` block** (in the assistant response): `{type: "tool_use", id: "toolu_...", name, input}`. `input` is already a parsed object conforming to the schema.
- **`tool_result` block** (in your next user message): `{type: "tool_result", tool_use_id, content, is_error?}`. `content` can be a string or a list of content blocks (including images in current versions). `is_error: true` signals a failed execution so the model can recover.
- **`stop_reason`**: `"tool_use"` means the model wants one or more tools run; `"end_turn"` means it is done; `"max_tokens"` means output was truncated (which may leave an incomplete tool_use requiring a retry with a higher budget); `"pause_turn"` can occur on long-running server-tool turns.
- **Verbatim append + ordering**: append the full assistant `content` array unchanged; return `tool_result`s in a user message immediately after, one per `tool_use_id`.
- **Parallel tool use**: a single response can contain multiple `tool_use` blocks. Execute all of them, then return **all** their `tool_result` blocks together in one user message. Order the results to correspond to the calls.
- **`tool_choice`**: controls whether the model may/must call tools. `auto` (model decides, the default when tools are present), `any` (must call some tool), `tool` (must call one specific named tool), `none` (may not call tools). Forcing tool use is how you guarantee structured output via a tool schema. Note that setting `tool_choice` changes the rendered prompt and therefore interacts with caching.

## OpenAI function calling as contrast

- Tools are declared in a `tools` parameter (each a `type: "function"` with a `function` object carrying `name`, `description`, `parameters` as JSON Schema).
- The response places calls in `message.tool_calls`, each with `id`, `function.name`, and `function.arguments` as a **JSON string** you must parse.
- You return results as messages with `role: "tool"` and a matching `tool_call_id`, rather than as a content block inside a user message.
- OpenAI has two relevant surfaces: the older **Chat Completions** API and the newer **Responses** API. The Responses API reframes the interaction around items and is oriented toward agentic/multi-tool use; Chat Completions remains widely used. The role-and-array pattern (assistant emits `tool_calls`, you reply with `role: "tool"` messages) is the core contrast with Anthropic's content-block pattern.
- Net contrast for practitioners: Anthropic = tool calls and results as typed content blocks within messages, `input` pre-parsed; OpenAI = tool calls as a sibling array, arguments stringified, results as a dedicated message role.

## Tool design as an engineering discipline (the ACI)

The agent-computer interface is to agents what UI is to humans, and it is a first-class determinant of reliability.

- **Descriptions are load-bearing.** The model chooses and fills tools based on the description and schema alone. Write them the way you would write a docstring for a junior engineer: what it does, when to use it, what each parameter means, gotchas. Anthropic's SWE-bench finding is the canonical datapoint: the team "spent more time optimizing our tools than the overall prompt" ("Building Effective Agents"), and improving tool ergonomics (including a non-description change: requiring absolute filepaths) measurably improved task performance.
- **Poka-yoke (mistake-proofing).** Design tools so misuse is hard. Anthropic's concrete example: requiring **absolute** filepaths eliminated a class of errors where the model used relative paths that broke after the working directory changed. Prefer arguments the model cannot easily get subtly wrong.
- **High-signal results and errors.** Return outputs that help the next decision, not raw dumps. On failure, return an informative message with `is_error: true` so the model can correct rather than silently proceeding on a bad assumption.
- **Fewer, better tools.** Each tool adds description tokens and decision surface. Consolidate overlapping tools; large tool lists both cost context and increase mis-selection.

## Structured outputs and schema enforcement

- **JSON Schema constrains inputs.** The `input_schema` (Anthropic) / `parameters` (OpenAI) both describes the tool to the model and defines the shape the input should take.
- **Constrained / grammar-based decoding.** Providers can enforce that generated tokens conform to a schema or grammar during sampling, so the emitted structure is guaranteed valid rather than merely encouraged. This is the mechanism behind "guaranteed valid JSON" style features and, functionally, behind reliable tool-argument generation. Details and availability are provider- and model-specific.
- **Tool schema as a structured-output device.** Forcing a specific tool via `tool_choice` and reading its `input` is a common way to get schema-constrained structured output out of a model even when you do not actually execute anything.

## Error handling in tool calls

- **Malformed inputs / schema violations.** Validate `input` before executing; if invalid, return a `tool_result` with `is_error: true` describing what was wrong so the model can retry with corrected arguments.
- **Execution failures.** Catch exceptions and return them as error results rather than crashing the loop. Informative error text ("file not found: /x; did you mean /y") outperforms opaque failures.
- **Truncation.** A `max_tokens` stop can leave an incomplete `tool_use`. Detect it and retry with a larger budget.
- **Timeouts and retries.** Wrap tool execution with timeouts; on transient failures retry with backoff. Distinguish retryable (network) from non-retryable (bad argument) errors.
- **Non-terminating vs terminating errors.** A useful pattern (from minimal agents like mini-swe-agent) is a two-tier exception model: non-terminating errors (format error, timeout) are caught, appended as an observation, and the loop continues; terminating errors (limits exceeded, explicit submit) end the loop.

## Advanced mechanics

- **Prompt caching interaction.** Tool definitions are part of the cached prefix, rendered before the conversation. Adding, removing, or reordering tools, or changing `tool_choice`, invalidates the cached prefix and forces recomputation, which raises cost and latency. Keep the tool list stable across a session to preserve cache hits.
- **Token-efficient tool use.** Providers offer mechanisms to reduce the token overhead of tool calling; the general principle is that tool definitions and tool-call/tool-result formatting all cost tokens, so trimming descriptions and consolidating tools has direct cost impact.
- **Large tool outputs blow up context.** Tool results accumulate in the message list for the rest of the session. A single verbose command output can consume a large slice of the window and degrade later performance (context rot). Mitigations: cap/truncate tool output, summarize before returning, return references (paths, IDs) instead of full payloads, and use context-editing/compaction to clear old tool results once they are no longer needed.

## Recommendations

1. **Build directly against the raw API first.** Implement the seven-stage lifecycle by hand once, so the `tool_use` / `tool_result` mechanics, verbatim append, and ordering rules are concrete before reaching for any framework.
2. **Instrument tokens from day one.** Log input/output token counts per call and watch tool-definition overhead and tool-result size. Use the token-counting endpoint to measure what your tool list costs.
3. **Treat tool descriptions as prompt engineering.** Iterate on descriptions and schemas against a task set the way you would iterate on a system prompt. Apply poka-yoke (absolute paths, constrained enums) and return high-signal errors with `is_error`.
4. **Preserve the cache.** Keep the tool list and ordering stable within a session; avoid toggling `tool_choice` mid-session unless necessary.
5. **Bound tool output.** Truncate or summarize large results before they enter context; prefer returning references over payloads.

## Caveats

- **Token-level formatting is provider-controlled and partly undocumented.** The exact templates used to render tool definitions and to encode tool-call emissions are model-specific and can change between model versions. Treat any specific rendering detail as indicative, not contractual.
- **Constrained-decoding availability varies.** Whether and how schema/grammar enforcement is applied differs by provider, model, and API surface.
- **API surfaces evolve.** OpenAI's Responses vs Chat Completions split, Anthropic beta headers for token-efficient tool use and context management, and the acceptable `tool_result` content types are all versioned; confirm against current docs.
- **Parallel tool use is model-dependent.** Whether a model emits multiple tool_use blocks, and how well it does so, varies; some configurations disable it.