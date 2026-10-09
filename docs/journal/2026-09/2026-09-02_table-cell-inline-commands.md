---
title: "Toolbar inline commands inside editable table cells"
created: 2026-09-02
type: journal
parent: index
tags:
  - stylo/journal
  - engineering/milestone
---

# Toolbar inline commands inside editable table cells

## Context

`inPlace.table: "cells"` gives each `<td>` / `<th>` a `contenteditable` surface that shows its raw Markdown while focused. You could _type_ `**bold**` by hand, but the toolbar's **B** / _I_ / ~~S~~ / code / math / link / wikilink buttons — and `Mod-b` / `Mod-i` / `Mod-k` — did nothing there. They act on the CodeMirror document selection, which `atomicRanges` parks outside the table while a cell has focus. Last session's context matrix only covered `"source"`-mode tables (the caret on a real pipe line). ADR-006 listed cell inline formatting as deferred; this closes it.

## What changed

**`src/toolbar/inline-ops.ts`** (new) — the pure string core of the inline transforms, no `EditorView`: `wrapOp` (the mark nest/strip/wrap decision, moved verbatim from `toggleWrap` with `markRun` now taking a plain string), plus `wrapString` / `linkString` / `wikiLinkString` that return `{ text, from, to }` for a single string such as one cell. `inline.ts` keeps only the view glue and now imports the core; its `toggleWrap` builds a multi-range `changeByRange` from `wrapOp`, unchanged in behaviour (132 toolbar tests still green).

**`src/toolbar/cell-inline.ts`** (new) —

- `activeTableCell(view)` — the focused `.cm-inplace-tcell` inside this view, or `null`.
- `runInlineInCell(view, build)` — when a cell is focused, read its selection offsets (`selectionOffsets` in `table-cell-dom.ts`), run `build`, write the text back, restore the selection over the result, and dispatch a synthetic `input` so the widget's existing `input → sync` path reserialises the table into the document. Returns `false` when no cell is focused, so callers fall through to the document command.
- `handleCellShortcut(event, cell)` — maps `Mod-b/i/k` and `Mod-Shift-k` to the same builders. CodeMirror never sees these keydowns (the widget's `ignoreEvent()` makes `eventBelongsToEditor` reject anything from inside it), so `EditableTableWidget.onKey` calls this first and `stopPropagation`s on a hit.

**`src/toolbar/commands.ts`** — `wrap()`, `link`, `wikilink`, and the `codeBlock` / `mathBlock` in-cell degrade path now read `runInlineInCell(view, …) || <document command>`.

**`src/inplace/table-widget.ts`** — the cell caret snapshot (`readCaret` / `writeCaret`) carries an anchor **and** a head; `placeCaret` (`table-cell-dom.ts`) grew an optional `head` argument. Without this the selection collapsed to a caret on every reserialise, so a mark could be applied but never toggled back off (the unwrap branches need the marked span selected).

## Trade-offs

- A toolbar button's `disabled` / `isActive` still read the parked document selection, not the cell. In practice the parked selection is rarely in a literal context, so the buttons stay enabled and work; but they do not light up to reflect the cell's current marks, and a table sitting directly against frontmatter could show a button disabled while a cell is focused. Reflecting cell state needs the predicates to receive the view, not just the state — deferred.
- `inline-ops.ts` duplicates the tiny `[text](url)` / `[[target]]` literal construction with `toggleLink` / `toggleWikiLink` rather than routing the document path through the string core (which would force a whole-doc replace and lose undo granularity). Both are a few stable lines.

## Verification

`typecheck`, 139 Vitest tests (5 new in `test/table-interactive.test.tsx` — a toolbar command wrapping a focused cell's selection in DOM and document, a second toggle stripping it, bold-then-italic nesting to `***…***`, the `Mod-b` widget shortcut path, and `link` producing `[text](url)`), `build`, `format:check`. Confirmed in a real Chrome against the playground: with `table: "cells"`, select text in a cell, click **Bold** → the cell shows `**one**`, the document row re-aligns; toggle off → back to `one`; `⌘B` does the same; blur re-renders the cell with `<strong>`.
