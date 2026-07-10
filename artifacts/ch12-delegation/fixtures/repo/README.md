# tasktrack

A tiny command-line task tracker. Tasks live in a single JSON file; the CLI adds,
lists, and closes them; a thin HTTP layer exposes the same store to other tools.

## Layout

- `models.py` --- the `Task` record and its state machine.
- `store.py` --- durable storage: load, save, and the atomic write.
- `cli.py` --- argument parsing and the user-facing commands.
- `api.py` --- a read-only HTTP view over the store.

## Design notes

The store is the single source of truth. The CLI and the API both go through it,
so there is exactly one place that knows how a task is serialized. Writes are
atomic (write a temp file, then rename) so a crash mid-save never corrupts the
file. The API is deliberately read-only: mutation has one path, the CLI, which
keeps the write-decision single-threaded.
