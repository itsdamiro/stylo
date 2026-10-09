---
title: "Host marks and widgets on the rendered table of source mode"
created: 2026-10-05
type: journal
parent: index
tags:
  - stylo
  - tables
  - engineering
  - standard
---

# Host marks and widgets on the rendered table of source mode

## Context

`cellMarks` (0.20.0) and `cellWidgets` (0.21.0) painted only the editable table of `table: "cells"`. With `table: "source"`, Stylo's default, and in any read-only document, a table not under the caret is the static `TableWidget`, a replaced range that drops a host's decorations and that nothing repainted. A host annotation therefore showed only once the caret entered the table.

## Decision

- **Shared painting.** The static widget's cells go through the same `paintCell` / `markPainter` as the editable one (`table-static-paint.ts`); the cell's row and column are read from `data-stylo-row` / `data-stylo-col` when `data-r` / `data-c` are absent. There is no focused cell, so every cell is drawn rendered.
- **Repaint.** The widget's `eq` still compares only the parsed table. Each mounted static table registers a repaint closure, and `cellMarksPlugin` calls it for every `.cm-inplace-table` when the host's list or the document changes; a cell repaints only when its signature differs, as before.
- **The press.** A `mousedown` on a host widget or a marked word is `preventDefault`ed and stopped before CodeMirror. Reaching it, or merely focusing the editor, moves the caret into the table, which swaps the table for its raw rows and removes the element before `click`. The marked word does not reveal the source either, so a host popup anchored on it keeps its anchor.

## Consequences

- A host that passes neither option pays nothing new.
- A click on a marked word no longer reveals a `source`-mode table's source; the user reaches it by clicking elsewhere in the table or with the arrow keys.
- The arrow-key path onto a table with a host widget present is untested.
