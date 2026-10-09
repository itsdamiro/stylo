---
type: decision
status: accepted
date: 2026-10-09
projects: [stylo]
concepts: [Vault conventions]
amends: []
supersedes: []
tags: [type/decision, status/accepted, project/stylo, topic/vault]
---

# 013 — Decision records live in docs/decisions, in the template shape

> **Summary.** ADR-001 to ADR-012 move from `docs/journal/` to `docs/decisions/NNN-slug.md` with the template's frontmatter and a summary line, keeping their numbers and their text. One index and one shape let the shape check and the owner's vault read them like every other project's records. The cost is changed file paths in a published repository, and 12 summaries and 7 concept names that the owner has yet to review.

## Context

- Stylo's 12 ADRs sat in `docs/journal/YYYY-MM/` as `YYYY-MM-DD_adr-NNN-slug.md`, with Obsidian frontmatter (`title`, `created`, `type: adr`, `parent`, `tags`), indexed in `docs/PROJECT_JOURNAL.md` next to about 60 milestone entries.
- The workflow template expects `docs/decisions/NNN-slug.md` with `type: decision` frontmatter, a `> **Summary.**` line and an index row, checked by `scripts/adr_check.py` and read by the vault sync. Stylo's adoption (2026-10-09) left the shape check with nothing to check.
- The journal and the wiki are hard-wrapped at 80 columns; the template's rule is one paragraph or list item per line.
- 29 other files link to the old ADR paths: the README, `CONTRIBUTING.md`, `CHANGELOG.md`, the wiki, and journal milestones.
- The owner chose, from four options, to migrate the ADRs only and leave the milestones as the history log.

## Decision

1. Move each ADR with `git mv` to `docs/decisions/NNN-slug.md`, so history follows. The number and the slug are the old ones; the date prefix goes.
2. Replace the frontmatter with the template's: `status: accepted` for all twelve, `date` from the old `created`, `amends` where the old Status line says so (002 amends 001, 007 amends 004), `concepts` and `topic/` tags as listed below.
3. Make the heading `# NNN — Title`, add a `> **Summary.**` line, join hard-wrapped lines, and rewrite relative links. Nothing else in a record changes: the words are the same, checked by comparing each record's text before and after with whitespace and link targets set aside. Amending an implemented record stays forbidden; this is a move.
4. Rewrite every link to a moved record, in the 29 files, to its new path.
5. Replace the ADR table in `docs/PROJECT_JOURNAL.md` with a pointer to `docs/decisions/README.md`. The milestone table stays.
6. A new decision is written with `docs/decisions/TEMPLATE.md`, in `docs/decisions/`. `CONTRIBUTING.md` and `CLAUDE.md` say so, and `CONTRIBUTING.md` takes the template's rule for changes (a dated amendment section in the same record; a new record that supersedes for a reversal) in place of "immutable once implemented", which the records' own amendments already departed from.
7. Concepts proposed for the owner to create as notes in the vault's `Concepts/` folder: `Plain text canon`, `In-place canvas`, `Host integration`, `Math rendering`, `Table editing`, `Peer dependency`. This record uses the existing `Vault conventions`. Topics are all from the vault's listed set: `architecture` on every record, `data-safety` on 001, `vault` on this one.

## Consequences

- One home and one shape for decisions; the shape check now has 13 records to check, and a vault sync can make cards for them.
- Old file paths stop working. Links inside the repository are rewritten, but the published README on the package registry, and any outside link, point at paths that no longer exist on `main`. The record's number is the stable handle.
- The 12 summaries were drafted from the records and have not been reviewed by the owner. The seven concept names are proposals; until the notes exist the vault lint reports them.
- The older milestones and wiki pages stay hard-wrapped, so `md-wrap` still covers only the newer files, plus `docs/decisions/` now.
- Obsidian's `title` and `parent` fields on the ADRs are gone, so the wiki's own navigation no longer lists them as children; the decisions index replaces that.

## Alternatives rejected

- **Leave the ADRs in the journal and number new ones from 013 in `docs/decisions/`.** Two homes and two shapes, and the vault would never see the first 12. Right only if a published path had to stay stable.
- **Write a journal extractor in the workflow repository.** Adds code to the shared repository for a format no other project uses, and the old records would still lack summaries. Right if several projects had a journal like this.
- **Migrate the milestones too and retire the journal.** Milestones are history, not decisions, and 60 files of churn in a public repository for no gain in what the tools can read. Right if the journal stops being kept.
- **Leave redirect stubs at the old paths.** Keeps outside links alive, at the price of 12 near-empty files and a second index. Right if outside links turn out to matter.

## Amendment (2026-10-09): the rest of the documentation is one line per paragraph too

The Context and Consequences above say the journal and the wiki stay hard-wrapped at 80 columns and that `md-wrap` covers only the newer files. That held for a day. The owner chose to finish the job: the journal, the wiki, `CONTRIBUTING.md`, `README.md` and `docs/PROJECT_JOURNAL.md` were joined to one paragraph or list item per line, with the text unchanged once whitespace is set aside, and `md-wrap` now covers every tracked Markdown file. The decision above is unaffected; only those two statements are out of date.
