---
title: "Host marks inside table cells"
created: 2026-10-05
type: journal
parent: index
tags:
  - stylo
  - tables
  - engineering
  - standard
---

# Host marks inside table cells

## Context

A host draws on the note with CodeMirror decorations: a highlight on commented
words, a dot in the margin. In the in-place canvas a table in `"cells"` mode is
one atomic replaced range, and CodeMirror drops decorations inside a replaced
range, so nothing a host decorates reaches a cell. The cells are
`contenteditable` DOM built by `paintCell` / `renderInline`, which only Stylo can
map back to the Markdown source. Separately, a host item run from a cell could
not tell where the selected words were: `view.coordsAtPos` inside the widget
lands on its edge.

## Decision

- **`inPlace.cellMarks(state)`** returns `{ from, to, class, attributes?,
cellClass? }` in document positions. It is a facet read through a ref, so the
  host can recompute from its own state and a re-render's closure applies.
- **Mapping.** A mark is cut down to each cell it touches (`cellSourcePos` gives
  the cell's document position) and kept as offsets into the cell's raw string.
  A focused cell shows that string as one text node, so offsets apply directly. A
  rendered cell's text nodes are aligned back to it by matching forward and
  skipping the syntax; `\|` counts as one character and `$…$` is stepped over as
  a whole.
- **Fallback.** A mark that covers no visible character (it sits on a link
  target), and every mark in a cell that cannot be aligned, wrap the whole cell
  content, attributes included, so a click still reaches the host.
- **Repainting.** A view plugin calls each mounted table when the document or
  the returned list changes. A cell keeps the signature of the marks it was
  painted with and repaints only when it differs, so ordinary typing elsewhere
  costs a comparison. The cell being edited is skipped until it blurs. A table
  paints once on mount, in a microtask, because its place in the document is not
  known until it is attached.
- **`placeCaret`** walks a cell's text nodes instead of assuming one, since a
  marked cell has several even while focused.
- **`run(view, { rect })`** for host menu items: the DOM selection's rectangle
  in a cell (the cell's own box with nothing selected), the editor selection's
  coordinates elsewhere. It is read as the menu opens.

## Consequences

- A host with no `cellMarks` pays one empty-list check per update.
- Tracked changes inside a cell are not covered: they need a widget, not a mark.
- A marked word that is clicked also focuses its cell, which swaps the cell to
  its raw text and rebuilds the wrapper under the pointer. The unit tests cover
  the mapping; the click path from a marked word to a host's handler needs a
  pass in a real browser.
- The toolbar's `run` does not get the rectangle.
