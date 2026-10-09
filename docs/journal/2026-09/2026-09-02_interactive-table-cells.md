---
title: "Interactive table cells — editing inside the rendered <table>"
created: 2026-09-02
type: journal
parent: index
tags:
  - stylo/journal
  - engineering/milestone
---

# Interactive table cells — editing inside the rendered `<table>`

## Context

The [aligned-source table editor](./2026-09-02_table-editing.md) shipped first:
the caret in a table reveals clean pipe source. [ADR-006](../../decisions/006-interactive-table-editing.md)
records the second tier — keep the rendered `<table>` on screen and edit its
cells in place, Obsidian's _Live Preview_ table. This lands it behind an opt-in
flag; `"source"` stays the default so nothing changes for existing consumers.

## What was built

**`src/types.ts`** — `TableEditing = "source" | "cells"` and
`InPlaceConfig.table?`. Read once at mount, like the rest of `inPlace`.

**`src/inplace/config.ts`** — `tableEditingFacet`, seeded by `inPlaceExtension`
from `opts.inPlace?.table ?? "source"`. A facet, not a module constant, so a
remount with a new value takes effect.

**`src/inplace/table-widget.ts`** — `EditableTableWidget extends WidgetType`.
The widget owns its DOM while mounted:

- `toDOM` builds a `<table class="cm-inplace-table cm-inplace-table-edit">` of
  `<th>` / `<td>` cells carrying a `contenteditable="true"` **attribute** (not
  just the IDL property) and wires `input`, `compositionend`, `keydown`, and
  `paste` listeners on the table element. The attribute matters: it makes the
  cell a real focus target, so `document.activeElement` becomes the cell and
  CodeMirror's `updateSelection` — which only forces the DOM caret while
  `.cm-content` itself is the active element — leaves the caret alone.
- An edit (or row add, or paste) calls `sync(view)`: read every cell's
  `textContent` into a grid, `serializeGrid` it (reusing `table-grid.ts`), and
  `view.dispatch` a `{ from, to, insert }` change annotated with
  `fromTableWidget` and `userEvent: "input"`. The whole table is one replace —
  the Markdown string stays canonical, re-aligned on every keystroke.
- `sync` snapshots the caret as `(cell index, character offset)` before the
  dispatch and re-applies it after — once synchronously, once in a
  `requestAnimationFrame` past CodeMirror's post-update measure. Without this the
  reconciliation of the replaced range drops the caret to the first cell on
  every keystroke (and after a Tab-append the following keystroke lands in the
  wrong column).
- The widget **never stores its document range**. Its own serialize dispatch
  shifts every position after it, so `bounds(view)` re-derives `[from, to]` from
  `view.posAtDOM(this.table)` plus a downward scan of contiguous pipe lines,
  every time `sync` or an arrow-escape needs it.
- `keydown`: Tab / Shift-Tab move DOM focus cell to cell; Tab past the last
  cell appends a row. Enter drops to the cell below, appending at the bottom.
  `↓` from the last body row and `↑` from a header cell call `view.focus()` and
  park the CM caret just past / before the table, handing control back to the
  document.
- `paste` is intercepted — plain text only, newlines flattened to spaces, so a
  multi-line clipboard can't break the row out of its `<td>`.
- `mousedown` is stopped from bubbling to `.cm-content`. CodeMirror's delegated
  handler treats a click in an editable widget as a click on the atomic range,
  snaps the caret to the widget boundary, and calls `focusPreventScroll` on the
  content element — which lands the caret in the first cell instead of where the
  user clicked. Stopping the event (without `preventDefault`, so the browser
  still focuses the clicked cell) fixes click-to-position.
- `eq` compares a trimmed snapshot of the last-synced DOM (`current`) against
  the incoming widget's parsed data, so the rebuild that follows an external
  (non-annotated) edit still matches and CodeMirror keeps the mounted DOM.

**`src/toolbar/table.ts`** — after `insertTable` drops the skeleton, a deferred
`focusInsertedCell` puts the caret in the nearest `.cm-inplace-table-edit`'s
first cell. The selector matches nothing on the source surfaces (or in `"source"`
table mode), so it is a no-op there with no config check.

**`src/inplace/tables.ts`** — `build()` reads `tableEditingFacet`. In `"cells"`
mode it emits `EditableTableWidget` and **skips the reveal-line check** (the
widget is always mounted; there is no source to reveal). `tableField.update`
gains one branch: a transaction carrying the `fromTableWidget` annotation does
`value.map(tr.changes)` instead of rebuilding — the same widget instance and its
focused cell survive. The block-replace range maps cleanly: `from` side negative
→ change start, `to` side positive → change end, so the mapped span is exactly
the new table.

`parseTable` no longer walks the syntax tree for cells. The Lezer markdown
parser emits **no `TableCell` node for a whitespace-only cell**, so a tree read
collapsed `| | x |` to a single column — the rendered table showed `x` in
column 1 while the source had it in column 2. It now slices the `Table` node's
raw lines and runs them through the toolbar's `parseGrid`, which pipe-splits and
keeps every column. This feeds both the read-only and the editable widget.

Each rendered cell carries `data-stylo-row` / `data-stylo-col`. The reveal-on-
click handler in `extension.ts` reads them and, via a new `cellSourcePos`
(`toolbar/table.ts`, built on `findTable` + `resolve`), lands the caret in the
**clicked** cell's source rather than at `posAtDOM(widget)` — the table's first
cell. It then adds the within-cell character offset from
`caretPositionFromPoint` / `caretRangeFromPoint` (the mousedown's screen point),
so the caret lands mid-word where the pointer was, not at the cell's start. The
offset is `0` where the browser can't resolve a caret (jsdom, or a click on the
cell's padding).

**`src/inplace/theme.ts`** — `.cm-inplace-table-edit` cells get `cursor: text`,
no native outline, a `--stylo-ring` inset box-shadow on `:focus`, and a `3em`
min width so empty cells stay clickable.

**`playground/main.tsx`** — a `table editing` source/cells selector in in-place
mode, folded into the remount `key`.

## Why an editable widget works at all

CodeMirror 6.43's DOM reader (`readMutation`) bails when the nearest tile is a
widget — `if (!tile || tile.isWidget()) return null`. Mutations from typing in
the `contentEditable` cells never reach the document sync path, so the widget is
free to own that DOM. `ignoreEvent()` returning `true` keeps CM from treating
clicks in the table as caret placement, and `atomicRanges` (already provided by
`tableField`) keeps the CM selection out of the replaced span. No `ignoreMutation`
override is needed — and this CM version's `WidgetType` type doesn't declare one.

## Trade-offs

- `this.data` on the widget goes stale for body rows after an in-widget row
  append (no rebuild on the annotated path). It is only read for column
  alignment and count, both stable, and `sync` always reads structure from the
  live DOM — so this is deliberate, not a leak.
- No structural controls yet (add/remove column, remove row, alignment toggle).
  Adding a row is the only structural edit, via Tab/Enter.
- IME is handled minimally: `sync` is deferred to `compositionend` and skipped
  while `isComposing`. Deep IME edge cases are untested.

(Cell content was verbatim text at this point; the follow-up that added a
per-cell reveal is the
[table-cell reveal note](./2026-09-02_table-cell-reveal.md).)

## Verification

`typecheck`, 101 Vitest tests (12 new across
`test/table-interactive.test.tsx`, `test/inplace.test.tsx`, and
`test/table.test.tsx` — editable cells rendered only in `"cells"` mode, a cell
edit reserialising the whole table, the decoration mapped not rebuilt so the
`<table>` element is preserved, Tab and Enter appending a row, the caret staying
in the edited cell across a Tab-append and a following keystroke, `mousedown`
stopped before CodeMirror sees it, the toolbar command placing the caret in the
first cell in cells mode and staying inert on the source surface, a blank
leading cell keeping its column, `cellSourcePos` landing on a clicked cell, and
a `mousedown` on a rendered cell revealing the source there), `build`,
`format:check` — all pass. Verified end-to-end in a real Chromium against the
playground. No new dependency; the widget lands in the lazy `InPlaceView` chunk.

## Follow-ups

- Structural controls on the `"cells"` widget — add/remove column, remove row,
  set alignment — each a `serializeGrid` rewrite.
- IME composition hardening.
