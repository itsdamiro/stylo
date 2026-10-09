---
title: "Structural controls on the editable table"
created: 2026-09-02
type: journal
parent: index
tags:
  - stylo/journal
  - engineering/milestone
---

# Structural controls on the editable table

## Context

`inPlace.table: "cells"` could edit cell text and append a row with Tab / Enter,
but not restructure: no add / remove column, no remove row, no alignment. That
was the last deferred item in
[ADR-006](../../decisions/006-interactive-table-editing.md); this closes it, so
`"cells"` mode is now a complete table editor.

## What was built

**Obsidian-style affordances.** The widget's `toDOM` returns a positioned
`<div class="cm-inplace-table-wrap">` holding the `<table>` and a thin overlay:

- a hit strip along the whole **right edge** (append column) and the whole
  **bottom edge** (append row) — click anywhere along it. The strip is invisible
  until the pointer is on it (not on whole-table hover, matching Obsidian); a
  flex-centred `+` is its only mark, and it tints to the header-row fill on
  hover. The clearance from the grid edge is added once in `layout()` (the
  table's own padding is asymmetric, `1em 0 1.4em`), so both strips sit the same
  distance out;
- a **right-click / long-press context menu** on any cell — _insert row above /
  below_, _insert column left / right_, _delete row_, _delete column_, and
  _align left / center / right_ — contextual to the clicked cell.

The first pass tried a Notion-style `⋯` handle on every column header and every
row. It was dropped: the handles need per-frame geometry math (a source of
placement bugs), and a fixed top / left handle strip scrolls out of reach on a
tall table. The context menu is always at the pointer, needs no layout, and
matches Obsidian's own table UX — Stylo's reference. `contextmenu` covers
right-click on desktop and long-press on mobile Safari / Chrome; only the two
edge strips need positioning, sized to the grid from the first / last `<tr>`.

**`src/inplace/table-structure.ts`** (new) — pure grid mutations on
`{ rows, aligns }`: `insertColumn` / `deleteColumn` / `insertRow` / `deleteRow` /
`setAlign`. Each keeps the model well-formed — always a header, ≥ 1 body row, ≥ 1
column; out-of-range indices clamp.

**`src/inplace/table-gizmos.ts`** (new) — the overlay DOM, the `+` buttons, and
the context menu, driven by a `GizmoHost` (`dims()` for the current shape,
`run(op)` to apply a `StructOp`). All label / enable logic here, all model
mutation in the widget. Stable classes (`cm-inplace-tg-add*`,
`cm-inplace-table-menu`, `cm-inplace-tm-item`, `cm-inplace-tm-sep`) for restyling.

**`src/inplace/table-widget.ts`** — `renderCells()` (extracted from `toDOM`)
rebuilds `<thead>`/`<tbody>` from the model; `runOp` applies a `StructOp` via the
pure functions, and a `contextmenu` listener on the table opens the menu.
`appendRow` (Tab / Enter) routes through the same path.

## Ordering and range, learned the hard way

- The menu's `display: flex` rule outranked the UA `[hidden]` rule, so an empty
  menu box was always painted over the header row and swallowed the first click
  beneath it — the real cause of "add row / column and inline code / math need
  two clicks" and "the menu won't close". Gated on `:not([hidden])` / `[hidden]`.
- `runOp` now dispatches the reserialized table **before** rebuilding the
  widget's own `<thead>`/`<tbody>`, so there is no frame where the document and
  the rendered table disagree ("the new row only appears after clicking
  elsewhere").
- `bounds()` scans contiguous pipe lines in **both** directions from the
  `posAtDOM` anchor — now that the widget root is a wrapper `<div>`, the anchor
  can land on an inner table line, and a one-directional scan would clip the
  replaced range and misplace the text.
- `eq()` returns `false` while the instance owns mounted DOM. `tableField`'s
  `update` used to run `build()` on any `tr.selection` — a selection-only
  transaction (the caret moving elsewhere in the document) would mint a new
  widget instance, and CodeMirror, seeing `eq` say "equal", swapped the instance
  behind the live DOM **without** running its `toDOM` — the new instance's
  `table` stayed `null`, so the next structural edit ran against a dead widget
  and did nothing until a further interaction forced a real rebuild. This was
  the intermittent "appears only after clicking elsewhere". Now: in `"cells"`
  mode `update` only rebuilds on `tr.docChanged`, and `eq` forces a clean
  `toDOM` on the rare genuine reload.

## Trade-offs

- `table-widget.ts` is ~370 lines — over the 200 target. It is one cohesive
  stateful DOM controller; the pure grid ops and the gizmo / menu DOM are already
  separate files. Accepted, as the
  [interactive-cells note](./2026-09-02_interactive-table-cells.md) records.
- No drag-to-reorder rows / columns and no multi-cell selection. Separate, later.

## Verification

`typecheck`, 152 Vitest tests (7 in `test/table-structure.test.ts` for the pure
ops, 7 in `test/table-interactive.test.tsx` — the edge strips appending, the cell
context menu deleting a column and writing `:-:` into the delimiter, the menu
hidden until a right-click then closing on an outside click, _Delete row_ omitted
on the header and the last body row, and a selection-only transaction not
orphaning the widget), `build`, `format:check`. Confirmed in a real Chrome
against the playground: no handle chrome, the edge strip shows only on edge
hover, the strip and the context menu both apply on a single click even after the
caret has moved elsewhere, Escape and outside-click close the menu, alignment and
every delete round-trip through `serializeGrid`.
