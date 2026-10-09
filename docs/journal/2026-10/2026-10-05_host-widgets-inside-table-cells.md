---
title: "Host widgets inside table cells"
created: 2026-10-05
type: journal
parent: index
tags:
  - stylo
  - tables
  - engineering
  - standard
---

# Host widgets inside table cells

## Context

`cellMarks` lets a host mark the characters of a table cell, but a host cannot put an element there (a button, a chip, a badge): a table is one atomic replaced range, and CodeMirror drops a widget decoration that falls inside it.

## Decision

- **`inPlace.cellWidgets(state)`** returns `{ pos, toDOM, key, cellClass? }` in document positions, read through a ref like `cellMarks`.
- **`key` rather than an `eq` object.** The repaint compares a signature of each cell's paint, so a string key fits it and passes through the facet as plain data. The host must change the key whenever the drawing changes.
- **Placement.** A widget is cut down to its cell as a raw-string offset, mapped to the rendered text with the same alignment `cellMarks` uses (now in `table-cell-align.ts`), and inserted after the characters that end there, outside any mark wrapper. A position in hidden syntax snaps to the nearest visible boundary (ties to the earlier); an unalignable cell gets it at the end.
- **Out of the text.** The element is `contenteditable="false"` and marked `data-stylo-cell-widget`; the cell's offset, caret and text helpers skip it.
- **Hidden while editing.** A focused cell shows raw source that Stylo reads back, so it carries marks but no widgets, and they return on blur.
- **The click.** A `mousedown` on a widget is `preventDefault`ed, so the cell does not take focus and rebuild before the browser sends `click`; a `focusin` from inside a widget (keyboard) does not enter the cell either.

## Consequences

- A host with no `cellWidgets` pays one empty-list check per update.
- A host that forgets to change `key` leaves a stale element in the cell.
- The unit tests cover placement, snapping, escaped pipes and text counting. A Chrome spec covers the click reaching a button without the cell taking focus, the raw-source view with no widget, the widget returning on blur, and the label staying out of the Markdown.
