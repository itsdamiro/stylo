---
title: "Editable table cells — per-cell Markdown reveal"
created: 2026-09-02
type: journal
parent: index
tags:
  - stylo/journal
  - engineering/milestone
---

# Editable table cells — per-cell Markdown reveal

## Context

`inPlace.table: "cells"` mode kept its `contenteditable` cells as plain text — you saw `**bold**`, not **bold**. The read-only `"source"`-mode table already renders inline formatting (`renderInline`), and the main canvas reveals raw source per line under the caret. This brings the same idea to editable cells: a cell shows **rendered** Markdown while unfocused and swaps to its **raw source** while it has focus.

## What changed

**`EditableTableWidget` rewritten around a grid model.** `rows: string[][]` (`[head, ...body]` raw strings) is now the source of truth; `sync` serialises `rows` directly rather than reading the DOM, which removes the "read cells, guess structure" fragility. Each `<td>` / `<th>` carries `data-r` / `data-c`.

- **`paint(cell, raw)`** — `cell.replaceChildren(raw ? textNode : renderInline(unescapePipe(rows[r][c])))`.
- **`focusin`** (delegated) — the target cell becomes `editing`; any previous `editing` cell is committed and re-rendered; the target is painted raw and the caret placed. The offset comes from the `mousedown` (`offsetFromPoint` via `caretPositionFromPoint`), stashed because the DOM selection isn't set yet when `focusin` fires from a click.
- **`focusout`** — if focus leaves the table (`relatedTarget` outside it), commit and re-render the `editing` cell; a move to another cell is left to that cell's `focusin`.
- **`input`** — commit the edited text into `rows[r][c]` and `sync`.
- `syncing` is set true only across the synchronous `view.dispatch`, so a blur CodeMirror's reconciliation triggers there is ignored while a real user focusout right after still re-renders.

**`src/inplace/table-cell-dom.ts`** (new) — the pure DOM/string helpers pulled out of the widget to keep it near the file-size target: `gridOf`, `trimGrid`, `unescapePipe`, `renderedCaretOffset`, `offsetFromPoint`, `placeCaret`.

## Trade-offs

- Click-to-caret inside a formatted cell uses the **rendered** offset (marker characters aren't counted), so the caret lands a few characters early of the true source position — close enough to the clicked word, refined later if needed.
- `table-widget.ts` is ~290 lines, over the 200 target. The class is one cohesive stateful DOM controller; the helpers are already extracted, and splitting the event/nav logic further would fragment it.

## Verification

`typecheck`, 134 Vitest tests (2 new in `test/table-interactive.test.tsx` — a cell rendering Markdown while unfocused and raw source on `focusin`, and an edit to the raw source persisting and re-rendering on blur), `build`, `format:check`. Confirmed in a real Chromium: a `cells`-mode table with bold / code / math / link cells renders formatted; clicking a cell swaps it to raw text; typing and clicking away (even immediately) re-renders it with the edit; the document stays aligned.
