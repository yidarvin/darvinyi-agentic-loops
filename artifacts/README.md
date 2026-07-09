# Runnable artifacts

Every chapter ships a runnable artifact: real, executable code the reader can run,
beyond the inline snippets in the prose. This is the distinguishing feature of this
site. The chapter's `<RunnableArtifact>` block points here.

## Layout

One self-contained directory per chapter, named for the chapter's number and slug:

```
artifacts/
  ch01-the-loop/
    README.md          run instructions, prerequisites
    ...                the code (python, node, or whatever the chapter needs)
  ch08-building-a-real-mcp-server/
    ...
```

Keep each artifact self-contained where possible. A chapter's `<RunnableArtifact>`
sets `path` to its directory here, so the two stay in sync.

## Conventions

- **Actually runs.** Each artifact runs end to end with the documented command. If it
  needs an API key or an external service, document the requirement and fail gracefully
  without it (a clear message, not a stack trace).
- **Self-documenting.** Each artifact directory carries a short `README.md` with the
  exact run command, the runtime version, and any environment variables.
- **Secrets via environment.** Never commit keys. Read them from the environment
  (for example `ANTHROPIC_API_KEY`) and say so in the artifact README and the
  chapter's `<RunnableArtifact requires=...>`.
- **Not bundled.** This directory lives outside `src/`, so Vite never bundles it. The
  reader clones the repo and runs the code locally.

These directories are created as their chapters are built. This file documents the
convention so the first artifact and the twenty-second look the same.
