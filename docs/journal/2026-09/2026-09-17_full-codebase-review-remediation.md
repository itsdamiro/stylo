---
title: "Codebase review remediation: all five tiers closed"
created: 2026-09-17
type: journal
parent: index
tags:
  - stylo/journal
  - engineering/milestone
---

# Codebase review remediation: all five tiers closed

## Context

Follow-up to the [2026-09-17 full codebase review](./2026-09-17_full-codebase-review-findings.md),
which grouped 30 findings into 24 pieces of work across five tiers. Worked
through all five, tier by tier, verifying (`typecheck`, `build`, `test`,
`format:check`) after each before moving on.

## Tier 1 — independent, single-file fixes

All 11 items: dead code and duplicated logic removed across `Stylo.tsx`,
`table-widget.ts`, `Embed.tsx`, `frontmatter.ts`, `taskCheckbox.ts`,
`wikilinks.ts`, `math.ts`, `decorate.ts`, `toolbar/table.ts`,
`context-menu-helpers.ts`, and `list-guides.ts`.

## Tier 2 — clusters (same root cause, one fix each)

Six clusters, 14 findings:

- **Cluster A** — table-cell caret resolution against the syntax tree now
  checks both sides of a boundary position (`resolveInner(pos, -1)` and
  `(pos, 1)`), closing a case where a caret at an exact table-boundary offset
  resolved to the wrong side of the Lezer node.
- **Cluster B** — line-prefix matching for block commands (headings, quotes,
  lists) unified behind one canonical set of matchers instead of several
  near-duplicates.
- **Cluster C** — toolbar command dispatch and table-cell command dispatch
  centralized onto Cluster B's canonical matchers, closing the largest
  duplication on the list. Scoped narrower than the original finding's prose
  suggested — the exact rationale was discussed with the project owner before
  implementing.
- **Cluster D** — a regex in `inline-md.ts` tightened to stop over-matching.
- **Cluster E** — `Preview.tsx` split from 262 to 118 lines, with the
  extracted `react-markdown` `Components` map moved into a new
  `preview-components.tsx`.
- **Cluster F** — viewport-scoped state-field rescans in the in-place canvas
  trimmed to avoid redundant work.
- `table-widget-caret.ts` deleted outright — folded into the caret-resolution
  fix above.

## Tier 3 — isolated, non-trivial fixes

1. **`wrapOp` word-splitting.** A collapsed caret mid-word (e.g. bolding with
   the caret between "wo" and "rd" in "word") wrapped only the half either
   side of the caret, producing `wo****rd` instead of `**word**`. Fixed with a
   `wordAt()` helper that expands a bare caret to its enclosing word first.
2. **`useCodeMirror` race condition.** A stale `value` prop, superseded by a
   newer local edit before the stale prop's re-render arrived, could
   overwrite the newer edit. Fixed by tracking a bounded history of values the
   hook itself has emitted via `onChange`, and skipping any incoming prop
   that's an echo of one already told to the host. The first version of the
   regression test was a false negative — a naive two-keystroke scenario
   self-corrects on the next render under React's batching — caught by
   deliberately reproducing the bug via `git stash` before trusting the test.
3. **`remark-wikilink.ts` dead link.** A bare `![[ref]]` embed (no
   `embedSource` configured, so `remarkEmbed` never runs) was rewritten into a
   dead link by the wikilink pass that runs after it, leaving a literal `!` in
   front of a link to nowhere. Fixed by skipping any `[[ref]]` immediately
   preceded by `!`.
4. **`link-row.ts` duplication.** `linkRow` and `wikiLinkRow` were
   structurally identical outside of the extractor, labels, and insert syntax.
   Unified behind one `linkFieldRow<P>(view, kind)`, parameterized on exactly
   what differs.
5. **`table-widget.ts` keyboard-nav extraction.** The Tab/Enter/Arrow
   handling (~95 lines) moved into a new `table-widget-keys.ts`, decoupled via
   a `TableKeysHost` callback interface — the same pattern `table-gizmos.ts`
   already established. `table-widget.ts` dropped from 452 to 372 lines.

## Tier 4 — `types.ts` split

`types.ts` (456 lines, bundling toolbar config, wikilink/tag/embed resolver
types, in-place canvas config, and the core `StyloProps`/`StyloHandle` under
one file) split into `types/core.ts`, `types/toolbar.ts`, `types/sources.ts`,
and `types/inplace.ts` — each under the 200-line ceiling. `types.ts` itself is
now a 32-line re-export barrel, so none of the ~30 files importing from
`./types`, the public `src/index.ts` entry point included, needed to change.

## Tier 5 — embed cache invalidation

Needed a design decision first, per the review. Discussed three options
(host-triggered `invalidate`, a TTL, a version-stamped cache key) and picked
the host-triggered call as the simplest fit — recorded as
[ADR-011](../../decisions/011-embed-cache-invalidation.md), including the
alternatives considered and their trade-offs, and the bundle-size cost of
`embed-cache.ts` no longer being purely lazy-loaded.

## Verification

`npm run typecheck`, `npm run build`, `npm run format:check`, and
`npm run test` all passed after every tier. Test count grew from 476 (before
this review) to 492 (9 tests added for the embed-invalidation cache and
listener behavior, plus regression tests for the `wrapOp`, `useCodeMirror`,
and `remark-wikilink` fixes in Tiers 2–3). `npm run check:size` confirmed
every chunk stays within its gzip budget after the Tier 5 bundle-shape change.
