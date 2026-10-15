---
title: "The nine files over the ceiling, split"
created: 2026-10-15
type: journal
parent: index
tags:
  - stylo
  - engineering
  - standard
---

# The nine files over the ceiling, split

## Context

[ADR-016](../../decisions/016-line-count-gate.md) added a gate for the 200-line ceiling and held nine files on a shrink-only allowlist. This slice works the list off: every file is split, and the allowlist is empty.

## What changed

Each split moves a cohesive part into its own file; behaviour is unchanged, and the old import paths stay valid where a consumer or the barrel used them.

- **`table-cell-marks.ts` (201):** the DOM painting (`applyPaint` and the wrapping helpers) moved to `table-cell-paint.ts`; the file keeps working out what to paint.
- **`context-menu.ts` (201):** the row-label helper moved to `context-menu-shell.ts` beside the other shared popup mechanics.
- **`context-menu-actions.ts` (202):** `codeBlockRow` moved to `code-block-row.ts`, beside `link-row.ts` and `edit-divider.ts`.
- **`command-helpers.ts` (202):** the context predicates that drive `disabled` moved to `command-predicates.ts`.
- **`inline-ops.ts` (207):** `markedContentAt` moved to `marked-content.ts`.
- **`StyloToolbarSettings.tsx` (204):** the "Available" column became `PaletteList.tsx`.
- **`theme-canvas.ts` (225):** the block-level half (math, embeds, rules, quotes, lists, frontmatter) became `theme-canvas-blocks.ts`, spread into `canvasTheme` so `theme.ts` is untouched.
- **`types/core.ts` (234):** `StyloHandle` moved to `types/handle.ts`; `types.ts` re-exports it, so no import changes.
- **`table-widget.ts` (425):** `EditableTableWidget` is now a three-class chain. `TableWidgetCore` (`table-widget-core.ts`) holds the grid, its place in the document, painting and serializing; `TableWidgetEditing` (`table-widget-editing.ts`) holds focus handling and the structural edits; `EditableTableWidget` keeps events, menus and the DOM. `table-widget.ts` still exports `fromTableWidget`, `ParsedTable`, `tableWidgets` and the widget, so no importer changed.

Four tests changed an import path for a moved symbol (`codeBlockRow`, `applyPaint`, `markedContentAt`). The allowlist in `scripts/check-line-count.mjs` is now empty.

## Proof

`scripts/gates` passes 12 of 12, including the browser gate, with the allowlist empty.

## Left open

The six files at 191 to 199 lines, which the gate does not warn about; and whether the rule covers CSS (`styles/stylo.module.css` is 709 lines).
