---
title: "A font-size token, and the selection bar yielding to the right-click menu"
created: 2026-09-10
type: journal
parent: index
tags:
  - stylo/journal
  - engineering/milestone
---

# A font-size token, and the selection bar yielding to the right-click menu

Two small gaps closed in one pass. Both came from an editor integration that had to reach past the public `--stylo-*` contract into undocumented internal class names to get the behaviour it wanted.

## `.cm-editor` hard-coded its font size

The base CodeMirror theme set `font-size: 0.9375rem` directly on `.cm-editor` (`src/editor/theme.ts`). A host wanting the editor to sit at its own type scale had no token for it and was left overriding `.cm-editor` itself.

A tenth design token, **`--stylo-font-size`** (default `0.9375rem`), now backs that rule: `fontSize: "var(--stylo-font-size, 0.9375rem)"`. The base theme feeds `.cm-editor` on every surface — `source`, the `split` source pane, and the in-place canvas — and every relative size on the in-place canvas is expressed in `em`, so the whole surface scales from this one value.

Like `--stylo-radius`, it is not a colour: one value serves both themes, so it lives only in the light block of `tokens.css` and `check:theme` (which pairs colours across the light and dark blocks) ignores it.

## The selection bar and the right-click menu ignored each other

The in-place canvas has two floating popups — the selection bar that follows a non-empty selection (`selectionUI: "bar"`) and the right-click / long-press context menu. Both sit at `z-index: 20` and each was driven by its own `ViewPlugin` with no reference to the other, so right-clicking while the selection bar was up left the menu stacked on top of it.

Fix: a one-boolean state field, **`menuOpenField`** (`src/inplace/menu-open.ts`), set through a `setMenuOpen` effect.

- `context-menu.ts`'s `createContextMenu` takes an optional `onOpenChange(open)` callback. It fires `true` from `show()` / `showField()` and `false` from `hide()` — the single dismissal choke point, so every path (outside press, Escape, scroll, action click) reports.
- `menu-plugin.ts` passes a callback that dispatches `setMenuOpen`. A `destroyed` guard covers teardown, where `menu.destroy()` calls `hide()` after the view may already be gone. The selection bar's own link/wikilink field menu and the editable-table structural menu are created without the callback, so only the right-click menu drives the signal.
- `selection-bar.ts` re-runs its measure when the field flips and returns "no bar" while it is set. The bar reappears on its own when the menu closes and the field clears — no extra bookkeeping.

## Verification

- `npm run typecheck`, `npm run build`, `npm run check:theme`, `npm run check:size` — clean.
- `npm run test` — 359 passing (one added: a right-click sets `menuOpenField` and hides the bar, Escape clears it). jsdom cannot lay the bar out for a position assertion, so the test covers the state wiring; the measure early-return is a single read of that field.
