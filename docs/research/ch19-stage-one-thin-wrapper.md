# Stage One: The Thin Wrapper

Research reference for *Agentic Loops*, Chapter 19 (opens Part V, Build Your Own Coding Agent; the first hands-on build). Part V is a three-stage progression: Stage One (this chapter — the minimal thin CLI wrapper), Stage Two ("The Real Loop" — robustness, error handling, streaming, tool design, context management), Stage Three ("Production-Grade" — MCP, subagents, memory, hardening), then "Evaluating Agents." The reader deeply understands the agent loop, tool calls, context economics, MCP, skills, multi-agent, and memory from earlier Parts — this chapter APPLIES those concepts in a concrete build rather than re-explaining them. Fast-moving specifics (SDK details, model names); version-pin and re-verify.

## TL;DR
- A working coding agent is a ~200–400-line `while` loop that sends the conversation plus tool definitions to a tool-use-capable model, dispatches only complete `tool_use` responses, appends the result, and repeats while action blocks remain. In this provider example, a no-tool response completes normally only at `end_turn`; truncation fails loudly before dispatch. The intelligence lives in the model, not the harness. Thorsten Ball's "How to Build an Agent" builds one in under 400 lines of Go; the Princeton/Stanford `mini-swe-agent` does it in ~100 lines of Python and scores >74% on SWE-bench Verified.
- The minimal-but-useful tool set is four tools — `read_file`, `list_files`, `edit_file` (string-replacement), and `run_bash` — with `run_bash` the single most powerful because it hands the model the entire Unix toolchain (grep, tests, git, build). Targeted string-replacement edits beat full-file rewrites on tokens and reliability.
- The thin wrapper genuinely works and proves the thesis, but it is a demo, not a product: no error recovery, no streaming, naive context management (it grows until it overflows and crashes), no permission system, no memory, no MCP, no eval. That gap — quantified by one reverse-engineering study as ~98.4% of Claude Code being "harness," not model — is exactly what Stages Two and Three build.

## The thesis: how little it takes
The animating claim (established in the book's opening): a capable coding agent can be a few hundred lines because the model does the reasoning and the harness merely plumbs tool calls. The evidence is overwhelming and independent:
- **Thorsten Ball, "How to Build an Agent" (ampcode.com, April 15 2025).** Subtitled "The Emperor Has No Clothes," it walks from zero to a working Go code-editing agent in "less than 400 lines of code, most of which is boilerplate," using the Anthropic Go SDK and Claude 3.7 Sonnet. Ball's definition — an agent is "an LLM with *access to tools*, giving it the ability to modify something outside the context window" — is the operational definition this chapter applies. His conclusion in one line: "300 lines of code and three tools and now you're able to talk to an alien intelligence that edits your code." Ported to Python, JavaScript (Kevin Yank adds a human-in-the-loop `getToolConsent`), and Ruby (~100 lines with RubyLLM).
- **`mini-swe-agent` (Princeton/Stanford SWE-bench team).** ~100 lines of Python for the agent class, "no fancy dependencies." Per the GitHub repo it scores ">74% on the SWE-bench verified benchmark; starts much faster than Claude Code" (initial July 24 2025 release scored 65%; "Gemini 3 Pro reaches 74% on SWE-bench verified with mini-swe-agent"). Radically austere: bash as the *only* action, `subprocess.run` for every (stateless) action, and a "completely linear history." Adopted by Meta, NVIDIA, Essential AI, IBM, Nebius, Anyscale.
- **`smol-developer` (smol-ai).** A "junior developer" that scaffolds a codebase from a prompt in "<200 lines of Python and Prompts," emphasizing "engineering with prompts, rather than prompt engineering."
- **`smolagents` (Hugging Face).** Agent logic "fits in ~1,000 lines of code," notable for its `CodeAgent` pattern (the model writes Python as its action rather than emitting JSON tool calls).
- **Anthropic, "Building Effective Agents."** Draws the workflows-vs-agents distinction (agents "dynamically direct their own processes and tool usage") and the anti-over-engineering rule this chapter honors: "find the simplest solution possible, and only increasing complexity when needed."

**Why so little is needed.** Current frontier models are post-trained specifically for agentic tool use. `mini-swe-agent`'s authors: "Back then, LMs were optimized to be great at chatting, but not much else… But in 2025, LMs are actively optimized for agentic coding." The sharpest quantification: Liu, Zhao, Shang & Shen, "Dive into Claude Code: The Design Space of Today's and Future AI Agent Systems" (arXiv:2604.14228, VILA-Lab / MBZUAI, April 2026) reverse-engineered the TypeScript source Anthropic accidentally bundled as a 59.8-MB sourcemap with an npm release on March 31 2026 (Claude Code v2.1.88, "1,884 files and approximately 512,000 lines of code"). By line count, "roughly 1.6 percent constitutes AI decision logic; the remaining 98.4 percent is what the field now calls the 'harness'." The thin wrapper is that ~1.6% core, laid bare.

## The minimal architecture
Five components, no more:
**(a) API client + model call.** Start the REPL process without an API-key environment variable, then read the key through a hidden prompt after startup and pass that local value explicitly to the SDK client. Reject a pre-exported `ANTHROPIC_API_KEY`, and keep excluding that name from shell-child environments as defense in depth. This keeps the typed key out of the direct child, REPL-parent, and launcher-ancestor environment paths before shell tools are exposed. Call `client.messages.create(model=..., max_tokens=..., system=..., tools=..., messages=...)`. The request carries the full conversation and tool schemas every turn because the server is stateless.
**(b) Conversation state.** A plain list of message dicts. User turns `{"role": "user", "content": "..."}`. Assistant turns appended *verbatim* as `{"role": "assistant", "content": response.content}` — preserving `tool_use` blocks so their `id`s stay aligned. Tool outputs go back as one `{"role": "user", "content": [tool_result blocks]}` message. Hard API rule: each `tool_use` must be answered by a matching `tool_result` in the immediately following message, and all parallel calls' results go in one user message — split them and the API rejects the next request with a 400.
**(c) Tool definitions.** Each tool is `{name, description, input_schema}` (input_schema is a JSON Schema object). Anthropic wraps these into a system prompt server-side. In the SDK, definitions can be hand-written dicts or generated from typed functions (`@beta_tool` infers schema from type hints + docstring).
**(d) The loop.** The canonical shape (per Anthropic's tutorial and docs):
```python
while True:
    response = client.messages.create(model=MODEL, max_tokens=4096,
                                       system=SYSTEM, tools=TOOLS, messages=messages)
    stop_reason = response.stop_reason
    tool_uses = [b for b in response.content if b.type == "tool_use"]
    if stop_reason in {"max_tokens", "model_context_window_exceeded"}:
        raise RuntimeError(f"response was truncated: {stop_reason}")
    if stop_reason == "tool_use" and tool_uses:
        messages.append({"role": "assistant", "content": response.content})
        results = []
        for tu in tool_uses:
            output, is_error = dispatch(tu.name, tu.input)
            results.append({"type": "tool_result", "tool_use_id": tu.id,
                            "content": output, "is_error": is_error})
        messages.append({"role": "user", "content": results})
        continue
    if stop_reason == "end_turn" and not tool_uses:
        messages.append({"role": "assistant", "content": response.content})
        break
    raise RuntimeError(f"response has an invalid stop reason or tool-block shape: {stop_reason}")
```
Subtlety to teach: `stop_reason` is the safety gate, while tool blocks identify the requested actions. Dispatch only when `stop_reason == "tool_use"` and client tool blocks are present. `max_tokens` and `model_context_window_exceeded` mean the response is truncated, even if a partial tool block appears; Stage One must fail before local dispatch rather than add recovery. With no client tool block, accept only `end_turn` as the normal final response. [Anthropic's stop-reason guidance](https://platform.claude.com/docs/en/build-with-claude/handling-stop-reasons) documents the distinction.
**(e) Tool dispatch.** A `dispatch(name, input)` that maps the tool name to a Python function, runs it, captures output, and — critically — catches exceptions and returns them as tool results with `is_error=True` rather than crashing. Anthropic's guidance: on failure, send a clear message inside `tool_result` content and set `"is_error": true` so the model can "understand why the tool failed and potentially try again"; return "Error: Location 'Atlantis' not found" rather than a generic "Failed" or a raw stack trace.

## The core tools in detail
**`read_file` / view.** Reads a file into context. Production versions (Claude's built-in `str_replace_based_edit_tool`, `mini-swe-agent`, Roo/Kilo/Sweep) prepend `cat -n`-style line numbers (so later edits have positional anchors), accept `offset`/`limit` or `view_range` for large files, and truncate defensively (one scheme keeps the first and last 10,000 chars of files over 30,000, plus per-line truncation of lines over ~2,000 chars to defang minified files). Caution: truncation that silently alters content the *model* sees (not just the UI) can make the model wrongly conclude a file is "corrupted." The minimal version is `open().read()`; the rest is Stage Two.
**`write_file` / create.** Creates or overwrites, making parent dirs. Trivial; the risk is clobbering, which motivates the edit tool.
**`edit_file` / `str_replace`.** The workhorse. The model supplies `old_str` and `new_str`; you find the (unique) match and replace it. Ball's description: "Replaces 'old_str' with 'new_str'… 'old_str' and 'new_str' MUST be different." Same pattern as Anthropic's `str_replace_based_edit_tool` (`text_editor_20250728`, commands `view`/`create`/`str_replace`/`insert`/`undo_edit`) and Aider's "diff" edit format (search/replace blocks in git-merge-conflict syntax). Why targeted edits win: (1) token efficiency — emit only the changed span; (2) reliability — Paul Gauthier's "Unified diffs make GPT-4 Turbo 3X less lazy" reports that on an 89-task Python refactoring benchmark, "GPT-4 Turbo only scored 20% as a baseline using aider's existing 'SEARCH/REPLACE block' edit format… Aider's new unified diff edit format raised the score to 61%" (gpt-4-1106-preview). Failure mode to teach: the non-unique or non-exact match — Aider returns a detailed `SearchReplaceNoExactMatch` message telling the model which lines almost matched and to resend only the failed block. Aider's derived principles — FAMILIAR, SIMPLE, HIGH LEVEL, FLEXIBLE — are the tool-design chapter applied.
**`list_files` / glob / ls.** Directory exploration. Ball's returns a JSON array with trailing slashes marking directories, stressing there's "no fixed format… anything goes as long as Claude can make sense of it" — tool output formatting is an empirical choice traded off against tokens.
**`run_bash` / execute_command.** The most powerful tool — the whole Unix toolchain: tests, builds, `git`, `grep`, `sed`, installs. `mini-swe-agent` makes it the *only* tool and skips the structured tool interface: "the focus is fully on the LM utilizing the shell to its full potential. Want it to do something specific like opening a PR? Just tell the LM to figure it out." Two robustness details from `mini-swe-agent`: run each command with `subprocess.run` as an independent (stateless) call (trivial to swap for `docker exec` later), and set env vars that defang interactive tools that would hang the agent — `PAGER=cat`, `MANPAGER=cat`, `LESS=-R`, `PIP_PROGRESS_BAR=off`, `TQDM_DISABLE=1`. Security (arbitrary code execution) is covered below; minimal mitigations are a timeout, capturing/truncating output, and scoping the working directory.

Design principle across all four: clear descriptions, precise schemas, actionable error strings, consolidation over proliferation. Why this set works: read to understand, list to navigate, edit to change, bash to verify — the full inner loop of how a human works in a repo.

## The agentic loop in practice
Trace "fix the failing test in this repo." Given the four tools, the model autonomously:
1. Calls `run_bash("pytest -x")` → sees the failing test and traceback in the `tool_result`.
2. Calls `read_file` on the test and the implicated source file (with line numbers) to understand the code.
3. Reasons (in a text block) about the fix.
4. Calls `edit_file` with a precise `old_str`/`new_str`.
5. Calls `run_bash("pytest -x")` again → sees green, or a new error and *loops back to step 2 on its own*.
6. Emits a final text summary with no tool call and `end_turn` → the loop exits.

Nothing in the harness sequenced those steps. Ball's demo makes it visceral: told only "help me solve the riddle in secret-file.txt," the model decides on its own to call `read_file` — "we didn't say *anything* about 'if a user asks you about a file, read the file.'" The self-correction in step 5 is the crux: because each tool result (including errors) is fed back, the model observes failure and adapts — the "wriggling itself out of errors" behavior that looks like magic but is just the loop plus a capable model. Concrete proof: the intelligence is in the model, not the scaffold.

## A complete minimal implementation
A complete, runnable thin-wrapper coding agent in Python (~200 lines) using the Anthropic SDK, structured so Stages Two/Three can extend it (tools in a registry; dispatch isolated; loop separable):

```python
# agent.py — a minimal thin-wrapper coding agent
import getpass, os, json, subprocess, pathlib
import anthropic

MODEL = "claude-sonnet-4-5"          # any tool-use-capable Claude model; names change fast
def read_api_key():
    if "ANTHROPIC_API_KEY" in os.environ:
        raise RuntimeError("start from a fresh terminal; enter the key at the prompt")
    return getpass.getpass("Anthropic API key: ").strip()

def make_client(api_key):
    return anthropic.Anthropic(api_key=api_key)

client = make_client(read_api_key())

SYSTEM = (
    "You are a coding agent operating in the user's working directory. "
    "Use the tools to read, list, edit files and run shell commands. "
    "Verify your work by running tests or commands. Stop when the task is done."
)

TOOLS = [
    {"name": "read_file",
     "description": "Read a file's contents (with line numbers). Use before editing.",
     "input_schema": {"type": "object",
        "properties": {"path": {"type": "string"}}, "required": ["path"]}},
    {"name": "list_files",
     "description": "List files and directories under a path (default: current dir).",
     "input_schema": {"type": "object",
        "properties": {"path": {"type": "string"}}}},
    {"name": "edit_file",
     "description": ("Replace old_str with new_str in a file (unique exact match). "
                     "If the file does not exist and old_str is empty, create it."),
     "input_schema": {"type": "object",
        "properties": {"path": {"type": "string"},
                       "old_str": {"type": "string"},
                       "new_str": {"type": "string"}},
        "required": ["path", "old_str", "new_str"]}},
    {"name": "run_bash",
     "description": "Run a shell command in the working directory and return its output.",
     "input_schema": {"type": "object",
        "properties": {"command": {"type": "string"}}, "required": ["command"]}},
]

def read_file(path):
    lines = pathlib.Path(path).read_text().splitlines()
    return "\n".join(f"{i+1:>6}\t{l}" for i, l in enumerate(lines))

def list_files(path="."):
    out = []
    for p in sorted(pathlib.Path(path).rglob("*")):
        if ".git" in p.parts: continue
        out.append(str(p) + ("/" if p.is_dir() else ""))
    return "\n".join(out) or "(empty)"

def edit_file(path, old_str, new_str):
    p = pathlib.Path(path)
    if not p.exists() and old_str == "":
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(new_str); return f"Created {path}"
    content = p.read_text()
    first_match = content.find(old_str)
    if first_match == -1: raise ValueError("old_str not found in file")
    if content.find(old_str, first_match + 1) != -1:
        raise ValueError("old_str matched more than once; make it unique")
    p.write_text(content.replace(old_str, new_str, 1)); return "OK"

BASH_ENV = {key: value for key, value in os.environ.items()
            if key != "ANTHROPIC_API_KEY"}
BASH_ENV.update({"PAGER": "cat", "GIT_PAGER": "cat",
                 "PIP_PROGRESS_BAR": "off", "TQDM_DISABLE": "1"})
def run_bash(command):
    r = subprocess.run(command, shell=True, capture_output=True, text=True,
                       timeout=120, env=BASH_ENV)
    out = (r.stdout + r.stderr)[:10000]      # cap output to protect context
    return f"(exit {r.returncode})\n{out}"

DISPATCH = {"read_file": read_file, "list_files": list_files,
            "edit_file": edit_file, "run_bash": run_bash}

def dispatch(name, args):
    try:
        print(f"tool: {name}({json.dumps(args)})")
        return str(DISPATCH[name](**args)), False
    except Exception as e:
        return f"Error: {e}", True                 # feed errors back, don't crash

def run_agent(messages, max_steps=50):
    for _ in range(max_steps):                      # guard against infinite loops
        resp = client.messages.create(model=MODEL, max_tokens=4096,
                                      system=SYSTEM, tools=TOOLS, messages=messages)
        stop_reason = resp.stop_reason
        tool_uses = [b for b in resp.content if b.type == "tool_use"]
        if stop_reason in {"max_tokens", "model_context_window_exceeded"}:
            raise RuntimeError(f"response was truncated: {stop_reason}")
        if stop_reason == "tool_use" and tool_uses:
            messages.append({"role": "assistant", "content": resp.content})
            results = []
            for tu in tool_uses:
                content, is_error = dispatch(tu.name, tu.input)
                results.append({"type": "tool_result", "tool_use_id": tu.id,
                                "content": content, "is_error": is_error})
            messages.append({"role": "user", "content": results})
            continue
        if stop_reason == "end_turn" and not tool_uses:
            messages.append({"role": "assistant", "content": resp.content})
            return
        raise RuntimeError(f"response has an invalid stop reason or tool-block shape: {stop_reason}")

def main():
    messages = []
    print("Coding agent ready (Ctrl-C to quit).")
    while True:
        user = input("you: ")
        if not user.strip(): continue
        messages.append({"role": "user", "content": user})
        run_agent(messages)

if __name__ == "__main__":
    main()
```

**Running it.** `pip install anthropic`; in a fresh terminal that has never exported `ANTHROPIC_API_KEY`, set the model identifier and launch `python agent.py`, then enter the key at its hidden post-start prompt. The prompt completes before shell tools become available, so the typed key never enters the agent process's initial environment or its launcher ancestor. This prevents that `ps eww` environment lookup for the typed key, not process-memory inspection or arbitrary shell access. Dependencies are just the SDK. That is the entire artifact.

## What it gets right — and its limitations
**What it gets right.** Genuinely works for real tasks (create files, fix tests, refactor, answer questions about the codebase); comprehensible in one sitting; demonstrates the exact loop production agents run; the model's capability shines through unobstructed; a real, extensible foundation, not a toy mock.

**Its limitations — each a signpost to Stage Two or Three:**
- *No robust error handling / retries.* A transient API error, a rate limit, or a malformed tool call can still abort a session; no backoff or recovery. **→ Stage Two.**
- *No streaming.* You wait for the full response each turn; no token-by-token output, no interrupt. **→ Stage Two.**
- *Naive context management.* The conversation only grows; every file read and command output accumulates until it overflows the window. `mini-swe-agent` is explicitly documented in the "Inside the Scaffold" taxonomy (arXiv:2604.03515) as having "None (crash on overflow)" — "unbounded growth; agent crashes on ContextWindowExceededError." Production harnesses add compaction (Claude Code compacts when estimated context usage exceeds ~90% of the window; others offload large tool outputs to disk with ~2KB previews). **→ Stage Two.**
- *Crude tool design.* No schema validation beyond the API's, no confirmation for destructive ops, error messages could be richer, no output-size discipline beyond a naive cap. **→ Stage Two.**
- *No permission system — the security problem.* The agent will run *any* bash command, including `rm -rf`, `curl | sh`, or exfiltration. The sharpest limitation. Real harnesses gate this two ways: a *permission gate* (per-command approve/deny, allow/deny lists) and an OS-level *sandbox* (macOS Seatbelt, Linux bubblewrap/Landlock+seccomp) that contains the blast radius. Both face "approval fatigue" — the VILA-Lab analysis found users approve 93% of prompts, "so automation replaces warnings" — which is why sandboxing plus policy is the maturity path (Cursor's engineering blog: "sandboxed agents stop 40% less often than unsandboxed ones," ~one-third of requests run sandboxed). The NVIDIA AI red team's mandatory controls are network-egress blocking and blocking file writes outside the workspace. **→ Stage Three.**
- *No memory across sessions, single-agent only, no MCP, no evaluation.* **→ Stage Three (memory, subagents, MCP) and the final chapter.**

**The key insight.** The thin wrapper proves the concept and is the correct starting point, but the distance between "works in a demo" and "robust production tool" *is* harness engineering. The Claude Code study puts a number on it: ~1.6% AI decision logic, ~98.4% operational harness. Stage One is that 1.6%. The rest of Part V is the other 98.4%.

## Practical guidance and design decisions
- **Choose the model for tool-use reliability first.** Raw coding-benchmark scores matter less than how reliably the model calls tools, reads schemas, and recovers from tool errors over long chains. Use a current tool-use-trained frontier model. Provider-agnostic layers like LiteLLM let you swap (it's what `mini-swe-agent` uses to be model-agnostic). SDK details and model names change fast — pin a dated snapshot in real code.
- **Keep dependencies minimal.** The model SDK, standard library for file/subprocess ops. Resist frameworks at Stage One; Anthropic's own advice is to reach for frameworks only once you understand the primitives.
- **Structure for extensibility.** Registry-based tools, an isolated `dispatch`, and a loop function separable from the CLI — so Stage Two can wrap the model call with streaming/retries and Stage Three can wrap `dispatch` with permissions/sandboxing without a rewrite. Consider a provider-agnostic internal block type (text / tool_use / tool_result) so switching providers doesn't ripple through the loop.
- **Common pitfalls to warn readers about:**
  - *Tool-result pairing.* Every `tool_use` needs a matching `tool_result` in the very next message; parallel calls all go in one user message. Mismatches produce hard 400 errors.
  - *Appending the assistant turn verbatim* (with its `tool_use` blocks) so `tool_use_id`s stay aligned.
  - *Termination.* Dispatch requires both `stop_reason == "tool_use"` and tool blocks. With no tool block, verify `stop_reason == "end_turn"` before treating a turn as complete. `max_tokens` and `model_context_window_exceeded` are truncation, not completion, even when a partial tool block appears; recover later or fail loudly at Stage One. Always add a `max_steps` guard; unbounded loops burn money (community write-ups document runaways of hundreds of steps and multi-thousand-dollar bills). Watch for repetition loops (same tool, identical args); a simple dedup/step cap suffices at Stage One.
  - *Schema mistakes* (wrong `input_schema` shape, missing `required`) cause malformed calls.
  - *Interactive commands hanging bash* — set the non-interactive env vars.
- **Debugging tips.** Log the full conversation (it *is* the trace — `mini-swe-agent`'s linear history is prized precisely because "the message history exactly matches what the LM sees"); print each tool call and its arguments; inspect `tool_result` contents; save the trajectory to JSON for replay.
- **Philosophy: start minimal.** The book's recurring anti-over-engineering theme. Build the smallest thing that works, watch where it breaks on real tasks, add exactly the harness those failures demand — the motivated, evidence-driven path into Stages Two and Three.

## Recommendations (staged)
1. **Build the ~200-line artifact first and run it on a real repo you know.** Give it a genuine task (fix a failing test). Watch the loop self-correct. This is the "it works" moment that anchors the chapter and earns the reader the right to critique it.
2. **Then deliberately break it** to motivate later stages: a task big enough to overflow context (watch it crash — Stage Two); a destructive command (feel the absence of a permission gate — Stage Three); kill your network mid-run (no retry — Stage Two). Each failure is a chapter hook.
3. **Instrument before optimizing.** Add conversation logging and per-tool-call printing from day one; you cannot debug or evaluate what you cannot see.
4. **Benchmarks that should change decisions:** frequent malformed tool calls or non-unique `edit_file` matches → the fix is usually a better tool description or schema (Stage Two tool design), not a bigger model. Sessions reliably dying at long horizons → context economics (Stage Two). Afraid to let it run unattended → sandboxing (Stage Three); the threshold for "leave it running" is an OS-level sandbox plus deny-list, not per-command prompts.
5. **Don't ship the thin wrapper.** A learning artifact and a foundation. Treat the transition to Stage Two as mandatory before any real use beyond your own supervised machine.

## Caveats
- Fast-moving specifics: model IDs (current Claude/OpenAI/Gemini snapshots), SDK surface (the manual loop vs the newer SDK "tool runner" that hides it), and built-in tools (Anthropic's `str_replace_based_edit_tool`, `bash` tool, context-management betas) change frequently. Treat version-specific names in the code as placeholders to pin at build time; the *concepts* (loop, tool lifecycle, four tools) are stable.
- The "1.6% / 98.4%" figure is an estimate, not a precise measurement. In "Dive into Claude Code" the ratio is attributed to community line-count analysis of the leak-derived source and applies to a partly-generated/minified bundle — carrying, in one outlet's phrase, a "methodological asterisk." Use it as a vivid directional illustration of harness-dominates-model, not a hard metric.
- SWE-bench numbers are model-dependent and shift: `mini-swe-agent`'s >74% reflects a specific frontier model on SWE-bench Verified; the same 100 lines with a weaker model scores far lower (its own July 2025 launch scored 65%). The harness is minimal, but the *result* depends heavily on the model — which reinforces the chapter's thesis.
- Bash-only vs structured tools is a real design fork: `mini-swe-agent` proves bash-only works and maximizes model portability; explicit tools give more control and better UX. This chapter presents the four-tool version as pedagogically clearest; note the bash-only alternative as equally valid.
- Security warning is not optional: the minimal `run_bash` executes arbitrary commands with your user's privileges. Safe only on a throwaway machine/container or under close supervision. Do not present the Stage One agent as safe to run unattended.
