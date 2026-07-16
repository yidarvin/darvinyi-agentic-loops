# Release-notes conventions

The rules `scripts/format_notes.py` encodes, written down once so the skill body
stays short. This is a level-three reference: the model reads it only when it needs
to explain or change a rule, not on every run.

## Category mapping

Each commit subject is parsed as a Conventional Commit, `type(scope)!: subject`.
The type maps to a Keep a Changelog category:

| Conventional type | Category  |
|-------------------|-----------|
| `feat`            | Added     |
| `fix`             | Fixed     |
| `perf`            | Changed   |
| everything else   | dropped   |

Dropped types are the ones that do not change what a user sees: `chore`, `docs`,
`test`, `refactor`, `ci`, `build`, `style`. They belong in the git log, not the
release notes.

## Two overrides

- **Breaking changes.** A `!` after the type or scope, or the token `BREAKING` in
  the subject, marks the change breaking. It is routed to Changed and its line is
  prefixed with `**Breaking:**` so a reader scanning the notes cannot miss it.
- **Security.** A `feat` whose scope or subject mentions security is routed to the
  Security category rather than Added, because a reader triaging a release reads
  Security first.

## Section order

Sections are emitted in Keep a Changelog order, and only the non-empty ones appear:

    Added, Changed, Deprecated, Removed, Fixed, Security

## Voice

Each line is the commit subject, first letter capitalized, trailing period removed.
Conventional Commit subjects are already imperative ("add the export flag"), which
is the voice release notes want, so the script does not rewrite them.

## Empty input

If there are no user-facing commits, the section is a single line,
`_No user-facing changes._` A skill with the procedure but no data produces exactly
this: correct, and empty, because the access was never supplied.
