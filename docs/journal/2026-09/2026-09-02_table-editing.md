---
title: "Table editing — insert, cell navigation, live pipe alignment"
created: 2026-09-02
type: journal
parent: index
tags:
  - stylo/journal
  - engineering/milestone
---

# Table editing — insert, cell navigation, live pipe alignment

## Context

GFM tables rendered on both surfaces (preview via `remark-gfm`, in-place via the read-only `tableField` widget) but were unauthorable — you hand-edited raw pipes, the worst part of writing Markdown by hand. The toolbar had no table command. This lands the "aligned source" tier: you still see pipes while editing, but they stay a clean grid. The **interactive rendered table** (editing cells inside the live `<table>`) is deferred to [ADR-006](../../decisions/006-interactive-table-editing.md).

## What was built

**`src/toolbar/table-grid.ts`** — pure grid parse/serialize. `parseGrid(lines)` splits rows on unescaped `|` (delimiter row expected at index 1), normalises every row to the column count, reads per-column alignment from the delimiter. `serializeGrid(grid)` emits an aligned table: each column padded to its widest cell (min 3), the delimiter rebuilt with `:` markers. It is **idempotent** — `serialize(parse(serialize(x))) === serialize(x)` — which is what stops the live-align filter from looping. `cellBounds(line)` returns the `|`-delimited cell spans (raw and trimmed) and is the shared workhorse for caret mapping.

**`src/toolbar/table.ts`**:

- `findTable(doc, pos)` — the contiguous run of non-blank pipe lines around the caret, if it `parseGrid`s. A line scan, not the syntax tree, so it works inside a `transactionFilter` where the tree may lag.
- `insertTable` — the `table` toolbar command. Drops a 2-column skeleton (header + delimiter + one empty row), a blank line first if the caret's line has text, and selects `Column 1` so you type over it. `tableActive` lights the button whenever the caret is in a table.
- `tableKeymap` (`Prec.high`, folded into `baseExtensions`) — **Tab** / **Shift- Tab** walk the cells, wrapping rows; Tab past the last cell appends a row. **Enter** drops to the cell below, appending a row at the bottom. Each move re-serializes the grid and maps the caret to the target cell. Every binding returns `false` outside a table, so normal Tab (focus escape) and Enter (newline) are untouched everywhere else.
- `tableRealign` — an `EditorState.transactionFilter` gated to `isUserEvent("input" | "delete")`. When such a transaction leaves the caret in a table, the aligned grid is composed into the **same** transaction (one undo step) with the caret remapped by `(row, col, offset)`. The user-event gate keeps it clear of `useCodeMirror`'s prop-driven `value` swaps and the keymap's own dispatches.

Caret mapping (`locate` / `resolve`) records the pre-edit position as `{ row, col, offset }` against the raw lines and re-derives an absolute position against the serialized lines, both via `cellBounds`.

## Trade-offs

- The realign filter drops transaction annotations other than `effects` / `scrollIntoView` (there is no public getter for all annotations). Gating to user input events makes this safe in practice — programmatic transactions are not touched.
- `findTable`'s line scan can over-capture a stray pipe line adjacent to a real table with no blank line between; one keystroke then pulls it into the grid. Rare, and recoverable.

## Verification

`typecheck`, 89 Vitest tests (11 new in `test/table.test.tsx` — grid serialize/idempotence, skeleton insert, Tab/Shift-Tab/Enter nav + row append, live realign, and the non-table pipe line left alone), `build`, `format:check` — all pass. The table code lands in the core `useCodeMirror` chunk (~4 kB); no new dependency.

## Follow-ups

- Add/remove column, set column alignment — no binding yet; part of the structural-controls tier.
- Interactive rendered-table editing — [ADR-006](../../decisions/006-interactive-table-editing.md).
- Inline formatting inside rendered in-place cells — still the tracker's standing follow-up.
