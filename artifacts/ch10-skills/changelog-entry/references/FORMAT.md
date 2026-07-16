# The Keep a Changelog format

Read this when an entry needs more than the five steps in `SKILL.md`: the heading
order, how the Unreleased section is cut into a release, or which type a change
belongs to. Paraphrased from [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/).

## The file

A `CHANGELOG.md` is a reverse-chronological list of notable changes, written for
humans, one section per version. This bundled convention keeps an `## [Unreleased]`
section at the top, where new entries accumulate until a release is cut.

```
## [Unreleased]
### Added
- --export flag to the CLI

## [1.2.0] - 2026-01-31
### Fixed
- Crash when the config file was missing
```

## The six change types

This bundled skill groups entries under these `###` headings, in this order:

- **Added** for new features.
- **Changed** for changes in existing behavior.
- **Deprecated** for features that will be removed soon.
- **Removed** for features removed now.
- **Fixed** for bug fixes.
- **Security** for vulnerability fixes.

Only include the headings that have entries. An empty type heading is noise.

## Cutting a release

For this bundled convention, when a version ships, rename `## [Unreleased]` to
`## [x.y.z] - YYYY-MM-DD` and open a fresh empty `## [Unreleased]` above it. Keep
the existing type headings and their entries as written.

## Style

- One change per entry, phrased as a concise summary for a release-note reader.
- Write what changed for a reader of the release notes, not the diff.
- Link versions to their compare view at the bottom of the file if the project
  keeps those links.

Keep a Changelog does not impose a character limit or require a particular terminal
punctuation. The bundled validator deliberately leaves both choices to the project.
