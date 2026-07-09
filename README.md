# darvinyi-refsite-template

A template for **queue-built reference sites**: interactive textbooks and survey
sites where each chapter (or paper) is researched and built one at a time by Claude
Code, from a queue, in a consistent house style, and deployed as a static site on
Vercel.

This is the reusable skeleton. The build *procedure* lives in the companion
`refsite-runner` skill. This repo is the *noun*; the skill is the *verbs*. The repo
owns all the tooling (validators, the prose gate, status mutation, scaffolding), so
one command is the entire definition of mechanical done: `npm run check`.

## Stack

Vite 8, React 19, TypeScript, MDX for chapter prose with embedded React widgets,
react-router 7+ with readable slugs, Tailwind 3.4 bound to CSS-variable design
tokens, self-hosted fonts. Static output, no backend.

## Quick start

```bash
npm install
npm run dev          # http://localhost:5173
npm run check        # the full gate: validate, prose, test, build, lint
```

The dev server renders the example Chapter 0, which documents the system itself.

Node 22.22+ or 24+ is required (see `.nvmrc`). The Python scripts need `python3`,
which is present on macOS and on the Ubuntu CI runner. Vercel only runs
`npm run build`, which stays python-free.

## Commands

| Command             | What it does                                                        |
|---------------------|---------------------------------------------------------------------|
| `npm run dev`       | Vite dev server.                                                    |
| `npm run build`     | Typecheck, production build into `dist/`, then write the sitemap.   |
| `npm run check`     | The gate: validate, prose lint, test, build, lint. Definition of done. |
| `npm run validate`  | Cross-check the queue, the registry, and the chapter files.         |
| `npm run lint:prose`| Scan chapter prose for em dashes and banned AI tells.               |
| `npm run test`      | Vitest: assert every chapter and widget actually renders.           |
| `npm run lint`      | ESLint (advisory in the gate).                                      |
| `npm run preview`   | Serve the production build locally.                                 |

Scaffolding and status changes go through the repo scripts, not by hand:

```bash
python3 scripts/new_chapter.py --slug the-settled-body --num 1 --title "The settled body"
python3 scripts/mark.py the-settled-body done
```

`new_chapter.py` stamps the mdx plus the figure and widget stubs, and writes both the
registry entry and the queue row. `mark.py` sets the status in both files at once and
refuses if the result would not validate, so a chapter with unfinished markers cannot
be marked done.

## Deploy

Push to GitHub, import to Vercel (framework preset **Vite**, output **dist**).
`vercel.json` already contains the SPA rewrite so deep links to `/some-slug` work. Set
a top-level `"url"` in `content/registry.json` to have the build emit `dist/sitemap.xml`.
To keep it in your local-first world, add your Gitea NAS remote as a mirror:

```bash
git remote add origin      git@github.com:yidarvin/<name>.git
git remote set-url --add --push origin git@github.com:yidarvin/<name>.git
git remote set-url --add --push origin ssh://gitea@<nas>:3030/yidarvin/<name>.git
```

## How the pieces fit

- `content/registry.json` is the database: the ordered list of chapters and their
  status, plus the site `title`, `subtitle`, `mode`, and optional `url`. The home page
  renders the whole book from it, including unwritten chapters as dimmed rows.
- `prompts/queue.md` is the run list. The next item is the first PENDING row. It must
  agree with the registry; `npm run validate` checks that.
- `prompts/notes/<slug>.md` holds optional build notes for an item.
- `src/chapters/<slug>.mdx` is a chapter. It uses the shared primitives (`Figure`,
  `Widget`, `ExerciseCard`, `Callout`) and imports its own bespoke figure and
  signature widget from `_figures/` and `_widgets/`.
- `src/styles/tokens.css` is the house style, in one place.
- `scripts/` holds the tooling: `validate.py`, `prose_lint.py`, `new_chapter.py`,
  `mark.py`, `check.sh`, `sitemap.mjs`. `prose-lint.config.json` tunes the prose gate.
- `.github/workflows/check.yml` runs `npm run check` on every push and pull request, so
  the gate travels with every clone.

## Making this the template on GitHub

Push this repo, then in GitHub: Settings -> **Template repository**. New sites start
from "Use this template", so the skeleton and this README travel with every project.

## Scaffolding checklist for a new site

After "Use this template", before the first run:

1. `package.json` -> rename `name`.
2. `content/registry.json` -> set `title`, `subtitle`, `mode` (`book` or `graph`), and
   optionally `url`; replace the seed chapters.
3. `index.html` -> set the `<title>`, `description`, and the `og:` meta tags.
4. `src/components/Layout.tsx` -> update the `source` link.
5. `LICENSE` -> confirm the holder.
6. Seed `prompts/queue.md` with one PENDING row per chapter, matching the registry,
   then say **"run the next one"**.

## Building chapters

With the `refsite-runner` skill installed at `~/.claude/skills/refsite-runner/`,
open Claude Code in this repo and say **"run the next one"**. To batch unattended:

```bash
claude -p "run the next one" \
  --model 'claude-opus-4-8[1m]' \
  --settings '{"ultracode":true}' \
  --dangerously-skip-permissions
```
