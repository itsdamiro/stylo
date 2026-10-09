---
type: decision
status: accepted
date: 2026-09-02
projects: [stylo]
concepts: [Table editing, In-place canvas]
amends: []
supersedes: []
tags: [type/decision, status/accepted, project/stylo, topic/architecture]
---

# 006 — Interactive rendered-table editing

> **Summary.** Rendered tables become editable in place, cell by cell, as a stateful widget whose cell edits dispatch CodeMirror transactions so the Markdown string stays canonical; the earlier aligned-source editing remains available behind a flag. It was first deferred as its own milestone, and later implemented as `inPlace.table: "cells"`. Cell focus against the editor caret, paste and input-method composition are the hardest DOM work in the codebase.

- **Status:** Accepted — fully implemented 2026-09-02 as `inPlace.table: "cells"` (default `"source"`). See the [implementation note](../journal/2026-09/2026-09-02_interactive-table-cells.md); the per-cell Markdown reveal is a [follow-up](../journal/2026-09/2026-09-02_table-cell-reveal.md), the toolbar's inline commands [format a cell's selection](../journal/2026-09/2026-09-02_table-cell-inline-commands.md), and [structural controls](../journal/2026-09/2026-09-02_table-structural-controls.md) (add/remove column, insert/remove row, column alignment) land as hover affordances on the widget.
- **Date:** 2026-09-02
- **Deciders:** damiro, Grace

## Context

Tables render on both surfaces. Authoring them has two tiers:

1. **Aligned-source editing** (shipped 2026-09-02). The caret in a table shows the raw pipes, kept in a clean grid live: Tab/Shift-Tab/Enter walk the cells, the delimiter and column widths rebuild on every edit. This is Obsidian's _Source mode_ table experience. It fits Stylo's architecture with a keymap plus a `transactionFilter` — no new concepts.

2. **Interactive rendered editing** (this ADR). The caret in a table keeps the rendered `<table>` on screen with its cells editable; typing in a `<td>` rewrites the matching slice of the Markdown string; Tab/Enter move between cells visually; row/column controls appear on the widget. This is Obsidian's _Live Preview_ table experience, and the thing most authors picture when they think "table editor".

The read-only `tableField` widget already renders the `<table>` off-caret; the gap is making that widget stay mounted and become a two-way editing surface while the caret is in the table.

## Decision

**Build tier 2 as its own post-v1 milestone, not now.** When built, it is a stateful, bidirectional CodeMirror widget:

- The `TableWidget` stays mounted while the selection is inside the table (instead of the current reveal-to-source behaviour, gated by a config flag so aligned-source stays available).
- Each `<th>` / `<td>` is `contenteditable` (or hosts a lightweight input). A cell edit is translated to a `view.dispatch` transaction that replaces that cell's span in the Markdown string; the widget re-derives its DOM from the new document, so the string stays canonical.
- Tab / Shift-Tab / Enter move DOM focus between cells; the CodeMirror caret is parked and the widget owns interaction while focused.
- Structural controls (add/remove row, add/remove column, set alignment) are buttons or handles on the widget, each dispatching a string rewrite — reusing `serializeGrid` from `table-grid.ts`.
- Undo, paste, and IME are routed through CodeMirror transactions so history and collaboration stay coherent.

The Markdown string remains the single source of truth throughout — this does **not** introduce a document model, and it does not adopt ProseMirror / Lexical (ADR-001). It is hand-rolled `contenteditable` coordination, scoped to one widget.

## Consequences

### Positive

- The table experience most authors expect, with no loss of plain-text fidelity — the file still round-trips through Obsidian and GitHub.
- Reuses the shipped grid parse/serialize; the incremental work is the widget's focus, selection, and transaction plumbing.

### Costs / considerations

- `contenteditable` coordination is the hardest DOM work in the codebase: cell focus vs. CM caret, selection restoration after a re-render, paste sanitisation, IME composition, and undo granularity each have a long tail.
- The widget must stay in sync with external `value` changes (a prop update while a cell is focused) without stealing or dropping the edit.
- It is a milestone-sized effort; shipping it half-done is worse than the aligned-source editor, so it stays fully deferred until it can be done properly.

## Alternatives rejected

- **Adopt ProseMirror (or a table-specific rich-text lib) for tables only.** Brings the document-model dependency ADR-001 exists to avoid, for one construct; the interop and bundle costs are disproportionate.
- **Ship only aligned-source editing and stop there.** It is a real improvement and the right _first_ step, but pipe-source editing is not the end state a Notion/Obsidian-class editor is judged against.
- **A separate modal "table editor" dialog.** Breaks the in-place, plain-text flow and duplicates state; rejected on the same grounds as a WYSIWYG document model.
