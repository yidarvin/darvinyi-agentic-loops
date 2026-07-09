# Run Queue

Run order, top to bottom. The **next** item is the first `PENDING` row. Statuses:
`PENDING`, `DONE`, `SKIPPED`. Update the status cell after each run. Reorder by
moving rows. Adding a chapter means adding a `PENDING` row here and a matching
entry in `content/registry.json`. See `CLAUDE.md` for the trigger phrases and the
`refsite-runner` skill for the per-item procedure.

| #  | slug                     | item                          | status  |
|----|--------------------------|-------------------------------|---------|
| 00 | how-this-book-is-built   | How this book is built        | DONE    |
| 01 | the-first-real-chapter   | Your first real chapter       | PENDING |

<!--
To seed a real book: replace the title/subtitle in content/registry.json, then add
one PENDING row per chapter here (and a matching registry entry) in reading order.
Then say "run the next one". In graph mode (a survey that follows citations), a run
appends newly discovered items to the bottom of this table with a source note.

Build notes for an item are optional. A run looks for prompts/notes/<slug>.md first,
then an optional trailing "notes" column on the row, then derives scope from the
title and the surrounding chapters. Extra columns are fine as long as every row has
them (validate.py checks the column count is consistent).
-->
