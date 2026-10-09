---
title: "In-place canvas — menu groups, selection bar in cells, callouts"
created: 2026-09-03
type: journal
parent: index
tags:
  - stylo/journal
  - engineering/milestone
---

# In-place canvas — menu groups, selection bar in cells, callouts

Three more items off the ["After in-place" list](./2026-09-01_in-place-canvas.md). No breaking changes — `contextMenu`'s boolean form and the seven-button bar are unchanged defaults.

## `contextMenu` groups + `selectionBarItems`

`inPlace.contextMenu` now also takes `{ groups: MenuGroupId[] }` — an ordered subset of `link` / `format` / `paragraph` / `insert` / `clipboard` — to pick and reorder the right-click menu's top-level sections. `link` and `format` still yield to `selectionUI` (listing them is a no-op when the marks live on the bar or toolbar). The table-cell and fenced-code contexts honour `format` / `clipboard` from the list; their shape is otherwise fixed.

`inPlace.selectionBarItems` — an ordered subset of the seven inline ids the floating bar shows. Unknown ids are dropped; an empty result falls back to the default.

`resolveContextMenu` / `resolveSelectionBarItems` in `config.ts` normalise the prop shapes; `menuGroupsFacet` / `selectionBarItemsFacet` carry them. `context-menu-actions.ts` builds the menu by walking the group list (each group its own separator-delimited block) instead of a fixed sequence.

## Selection bar inside an editable table cell

The bar now follows a text selection inside a `table: "cells"` widget. A cell's selection is a DOM selection (the widget is atomic, so it never reaches `state.selection`), so `selection-bar.ts` gained:

- a `selectionchange` document listener (guarded on `activeTableCell`), since no `ViewUpdate` fires for a DOM selection;
- a `selectionBox()` that measures the DOM range when the editor selection is empty but a cell has one;
- mark buttons that route through `runInlineInCell` (they already did — the `BUILTIN_COMMANDS` inline commands try the cell first) and skip `view.focus()` so the cell keeps its caret;
- link / wikilink buttons that fall back to the plain toggle in a cell — the field editor works on `state.selection`, which is collapsed there.

In a cell the buttons are always enabled (the command `disabled` / `isActive` predicates read the collapsed `state.selection`, so they are skipped).

## Callouts (`> [!note]`)

A blockquote whose first line is `> [!type]` renders as a tinted box on **both** the in-place canvas and the preview surface. `src/callout.ts` is the shared source of truth: the `[!type]` token regexes and a `calloutBucket()` that collapses the ~25 Obsidian type names to five colour buckets (`note` / `tip` / `warn` / `danger` / `example`). The raw type rides on a `data-callout` attribute that a `::before` label reads.

- **In-place** (`nodes.ts`): the `Blockquote` branch swaps `cm-inplace-quote` for `cm-inplace-callout cm-inplace-callout-<bucket>`, marks the head line `cm-inplace-callout-head`, and hides the `[!type]` token off-caret (atomic, adjacent to the already-hidden `>` so they coalesce).
- **Preview** (`remark-callout.ts`): a small remark plugin, alongside `remark-wikilink`, that strips the token and sets the class + `data-callout` on the `<blockquote>`.
- Each bucket sets `--stylo-callout-accent` from `--stylo-callout-<bucket>` (`#3b82f6` / `#22c55e` / `#f59e0b` / `#ef4444` / `#a855f7`), overridable at either level.

The `-` / `+` fold marker is parsed and ignored — the box always renders open.

## Files

- `src/callout.ts` — new; shared token regexes + bucket map.
- `src/render/remark-callout.ts` — new; the preview remark plugin.
- `src/inplace/config.ts` — `resolveContextMenu` / `resolveSelectionBarItems`, `menuGroupsFacet` / `selectionBarItemsFacet`.
- `src/inplace/context-menu-actions.ts` — `menuRows` walks the group list.
- `src/inplace/selection-bar.ts` — DOM-selection / cell path.
- `src/inplace/nodes.ts` — callout detection in the `Blockquote` branch.
- `src/inplace/theme.ts`, `src/styles/stylo.module.css`, `src/styles/tokens.css` — callout styling and tokens.
- `src/types.ts` — `MenuGroupId`, `ContextMenuConfig`, `contextMenu` / `selectionBarItems` on `InPlaceConfig`.

## Log

- 2026-09-03 — menu-group / bar-item config, the cell selection-bar path, and callouts (both surfaces) landed together; 13 tests added (`callout.test.ts`, menu-group + `resolve*` cases, the cell-bar test, the in-place + preview callout tests). The callout visuals want a real-Chrome look.
