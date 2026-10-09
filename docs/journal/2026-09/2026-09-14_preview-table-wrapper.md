---
title: "preview's table gets a real wrapper — display: block was disabling its own layout algorithm"
created: 2026-09-14
type: journal
parent: index
tags:
  - stylo/journal
  - engineering/milestone
---

# `preview` table wrapper

## Context

Follow-on from `0.15.1` (`2026-09-13_inplace-table-gizmo-padding-shrinks-table.md`): once the in-place table genuinely reached full width, the same "table isn't full width" report kept recurring for `preview` — even though every earlier live measurement of `preview`'s `<table>` element showed it exactly matching its container's width. That measurement was true and also the wrong thing to check: `Preview.tsx`'s module CSS set `table { display: block; margin: 2em 0; border-collapse: collapse; overflow-x: auto }` directly on the `<table>` element itself.

`display: block` on a `<table>` disables its native table-layout algorithm entirely. The browser still renders the `<tr>`/`<td>` descendants as an internal table-formatting box (their own default `display: table-row` / `table-cell` survives), but that inner box now sizes itself to its own content, completely independent of the outer block box's width. A `<table>` element's `getBoundingClientRect()` still reports the _outer_ block box — which genuinely does stretch to `width: 100%` — while the actual rendered grid underneath doesn't move at all. Confirmed against a real measurement from Sympose: the `<table>` element's own box matched its container exactly, while its first `<tr>` measured 221px narrower — `getComputedStyle(table ).display` reported `"block"`, confirming the mechanism directly.

## Decision

Wrap the rendered `<table>` in `<div class="stylo-table-wrap">` (a new `components.table` override in `Preview.tsx`) and move the block/scroll behaviour onto that wrapper, leaving `<table>` at its native `display: table`:

```css
.preview :global(.stylo-table-wrap) {
  display: block;
  margin: 2em 0;
  overflow-x: auto;
}
.preview table {
  border-collapse: collapse;
}
```

The same shape `0.15.1` already applied on the in-place side (`.cm-inplace-table-wrap` carries the block/overflow behaviour; `.cm-inplace-table` stays a real table) — `preview` was the _inverse_ of that architecture until now: the block/overflow behaviour sat on the table element itself, with no wrapper at all.

- **`.stylo-table-wrap` is a stable override point**, named to match `.cm-inplace-table-wrap` and stylo's existing plain-class convention (`.stylo-embed`, `.stylo-frontmatter`).
- Verified in a real Chromium (a standalone Playwright script against the dev server — jsdom does no CSS layout at all, so this specific bug is invisible to the unit suite by construction): with `table { width: 100% !important }` applied the way Sympose's own override does, the table's computed `display` is now `"table"` and its rendered first row's width matches the table's own box within a border-collapse rounding pixel — previously a 221px-class gap. Also checked the default (no host override) case stays visually identical — the wrap fills its container the way any block box does, the table still sizes to its content inside it, same as before — and that an over-wide table still scrolls on the wrap rather than blowing out the container.

## Consequences

- Real visual fix for every `preview` consumer with a table narrower than its reading column — the table now actually stretches when a host sets `width: 100%` on it, or when the wrap itself is stretched.
- `test/preview.test.tsx` gained a structural check (table renders inside `.stylo-table-wrap`); `test/browser/preview-table.spec.ts` is new, covering the real-layout behaviour jsdom can't: a host's `width: 100%` reaching the actual grid, and an over-wide table still scrolling on the wrapper.
- Purely internal CSS plus one new stable class — no prop, no public API change. `in-place` and `source` are untouched.
