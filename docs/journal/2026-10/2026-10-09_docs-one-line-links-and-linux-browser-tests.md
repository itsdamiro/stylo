---
title: "Markdown prose on one line, links checked, browser tests on Linux"
created: 2026-10-09
type: journal
parent: index
tags:
  - stylo
  - docs
  - engineering
  - standard
---

# Markdown prose on one line, links checked, browser tests on Linux

## Context

- The workflow template's rule is one paragraph or list item per line, so a hard wrap never makes an edit rewrap the lines around it. [ADR-013](../../decisions/013-adr-records-live-in-docs-decisions.md) adopted it for the decision records only; the journal, the wiki, `CONTRIBUTING.md` and `README.md` were still wrapped at 80 columns, about 4,700 lines.
- CI ran the npm checks but not the two Markdown checks (`scripts/md_wrap_check.py`, `scripts/adr_check.py`), and nothing checked links. Five relative links were already broken (a `../wiki/` that needed `../../wiki/`, a playground path one level short, and a heading anchor that did not match its heading), and three published documents linked to `docs/requests/`, which is local-only and so a dead link for anyone reading the repository on GitHub.
- The `browser` job had failed on every run of `main` for at least 12 commits. Two tests in `test/browser/rhythm.spec.ts` timed out at 30 seconds waiting for a heading that never appeared, and passed on a Mac.

## Decision

- **Unwrap by script, with the checker's own definition of a continuation line**, so the fix and the gate cannot disagree. Each file was compared before and after with whitespace and quote markers removed: identical. `md-wrap` now covers every tracked Markdown file, and ADR-013 carries a dated amendment saying so.
- **A `docs` job in CI** runs `md_wrap_check.py`, `adr_check.py` and the new link check over what a clone holds. It does not run `scripts/gates` whole: the other jobs already run the npm gates, and the `md-wrap` gate names two local-only files that a clone lacks.
- **`scripts/check_links.py`**, a gate and a CI step, fails on a relative link whose file or `#heading` does not exist. It reads headings the way GitHub makes anchors, skips code fences, code spans and frontmatter, and fetches nothing. It does not check reference-style links, `[[wikilinks]]` or HTML. Run against the tree before the fixes it reports exactly the eight broken links above; run on a clone it also catches a link into a local-only folder, which passes in a working checkout.
- **The five links were fixed, and the three links into `docs/requests/` became plain text.**
- **The cause of the browser failures was a macOS-only shortcut.** The test helper pasted with `Meta+A` and `Meta+V`, which select all and paste only on macOS; on Linux nothing was pasted, so the headings never rendered. It now presses `ControlOrMeta`.
- **The CI actions moved to `actions/checkout@v7` and `actions/setup-node@v7`**, which run on Node 24; GitHub had been forcing the old ones onto it and warning. The project's own `node-version: 20` is unchanged, as `engines` allows Node 18 and up.

## Consequences

- A hard wrap, a broken relative link or a link into a local-only folder now fails the build instead of waiting for a reader to find it.
- The link check follows GitHub's anchor rules by hand; an unusual heading (an emoji, a heading with HTML) may need the check taught about it.
- The journal's older entries were reflowed, so `git blame` on them points at the unwrap commit; `git blame -w` does not see through a joined line.
- The Linux fix was confirmed by the cause and by the tests still passing on macOS; the first CI run after it is the proof on Linux.
