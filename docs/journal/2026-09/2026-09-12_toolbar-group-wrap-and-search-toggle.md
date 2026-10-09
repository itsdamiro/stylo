---
title: "Toolbar groups wrap as a unit; the search button shows pressed"
created: 2026-09-12
type: journal
parent: index
tags:
  - stylo/journal
  - engineering/milestone
---

# Toolbar groups wrap as a unit; the search button shows pressed

Two small fixes made alongside [ADR-010](../../decisions/010-canvas-header-panel.md),
in the same area of the toolbar for unrelated reasons — bundled here rather
than as two separate notes.

## Wrap-per-group

`.toolbar` has had `flex-wrap: wrap` since the original toolbar work
(2026-09-02), but every button was a flat flex child — on a narrow host the
bar could wrap mid-group, splitting e.g. `bold, italic` onto one line and
leaving `strike` alone on the next.

The default bar's own `items` array already expresses grouping: runs of ids
delimited by `"|"` (history · headings · inline text · lists · block
structure · code/math). `Toolbar.tsx`'s new `groupItems()` splits `items` on
that same separator and renders each run inside its own `<div
class={styles.toolbarGroup}>`. Flexbox then wraps whole groups, never inside
one — no new config, no separate grouping array a consumer has to author
alongside `items`; the `"|"`s already there do double duty. Separators
between groups render exactly as before (`<span class={styles.toolbarSep}>`),
now as siblings of the group `<div>`s.

`.toolbarGroup` carries the same `gap: 2px` `.toolbar` already had, so the
change is visually inert until a bar actually wraps.

The `overflow: "collapse"` (buttons that don't fit hide behind a `…` menu)
variant from the ADR-002 follow-ups is unrelated code (width measurement, a
popover) and stays deferred.

## `search` shows pressed while open

`search`'s toolbar button had no `isActive`, unlike every other toggle
(`bold`, `frontmatter`, …) — the button never reflected whether the
find/replace panel was actually open. Added
`isActive: (state) => searchPanelOpen(state)` (`@codemirror/search`), so it
now renders `aria-pressed` / `data-active` consistently with the rest of the
bar. `search` was already in `ALL_BUILTIN_IDS` and so already reachable
through `<StyloToolbarSettings>`'s "Available" column — a host letting end
users customise their own bar needs no further wiring to offer find/replace
as a choice; this was the one real gap in that path.

## Verification

`typecheck`, `test` (441 passing, `test/toolbar.test.tsx` /
`test/search.test.tsx` / `test/toolbar-settings.test.tsx` unchanged in
behaviour), `build`, and `format:check` all pass.
