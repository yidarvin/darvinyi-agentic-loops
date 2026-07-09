# ch07 - one server, three primitives

A single MCP server exposing all three server-side primitives at once, with a driver
that walks each in turn and prints the wire request and response. The runnable
companion to chapter 7: an MCP server exposes exactly **tools**, **resources**, and
**prompts**, and the only axis that separates them is who decides when the primitive
fires.

| primitive | controller  | who invokes it        | REST analogy      |
|-----------|-------------|-----------------------|-------------------|
| tools     | model       | the LLM, autonomously | POST (side effect)|
| resources | application | the host pulls it in  | GET (read-only)   |
| prompts   | user        | a human selects it    | stored template   |

The example is the canonical composition: one `database-server` whose single dataset
is reachable three ways. A schema **resource** the app loads as context, `run_query`
and `insert_order` **tools** the model calls, and a `weekly_report` **prompt** the
user triggers as a slash command. A third read-only `get_schema` **tool** returns the
exact bytes the schema resource does, so you can see the resource-versus-read-only-tool
distinction directly: identical data, different controller.

## Run it

```
cd artifacts/ch07-resources-tools-and-prompts
python3 primitives.py
```

- **Runtime:** Python 3.9+, standard library only.
- **No key, no SDK, no network.** Protocol shapes track MCP revision `2025-11-25`.

## What you will see

`initialize` first: the server declares all three capabilities in one response, its
promise that the matching methods exist. Then three sections, one per primitive, each
a discover-then-invoke pair so the request and response shapes line up:

1. **tools (model-controlled).** `tools/list` returns names, descriptions, input
   schemas, and annotations. `tools/call run_query` returns a `content` array with
   `isError:false`. The read-only tools (`get_schema`, `run_query`) carry
   `readOnlyHint:true` (a client may auto-run them); the writing tool `insert_order`
   carries `destructiveHint:true` (a client should confirm first). `get_schema` returns
   the same bytes as the schema resource below, one primitive apart only in controller.
2. **resources (application-controlled).** `resources/list` returns a direct resource
   addressed by the URI `db://schema`; `resources/templates/list` returns the
   parameterised `db://tables/{table}/schema`. `resources/read` returns a `contents`
   array. The model never reads these on its own; the host decides.
3. **prompts (user-controlled).** `prompts/list` returns the offered prompt and its
   arguments. `prompts/get` returns the filled `messages`: an embedded schema
   resource, a user turn, and a primed assistant turn. There is no `system` role.
   The server computes the exact revenue figure and hands the model one language
   task, the hybrid pattern: precision in code, prose in the model.

The closing line is the point: one dataset, three doors, one controller each.

## Flags

```
python3 primitives.py --tools      # just the tools walkthrough
python3 primitives.py --resources  # just the resources walkthrough
python3 primitives.py --prompts    # just the prompts walkthrough
```

## It is a real server

`DatabaseServer.handle()` maps a JSON-RPC message to a JSON-RPC reply. It is a genuine
MCP server, not a mock: a real client can spawn it and speak newline-delimited JSON.

```
python3 primitives.py --serve-stdio
```

Then write one JSON-RPC message per line to its stdin:

```
echo '{"jsonrpc":"2.0","id":1,"method":"prompts/list"}' | python3 primitives.py --serve-stdio
```

The chapter is about the primitives, not the framing, so the transport here is
deliberately thin. See chapter 6 and its artifact for transports in depth.

## The one file

`primitives.py` is server and driver both. The `DatabaseServer` class answers the
three families of methods; the driver at the bottom calls `handle()` directly and
prints each exchange. Reading the three sections side by side is the whole lesson:
same dataset, three controllers.
