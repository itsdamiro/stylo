---
title: "In-place canvas — right-click menu and selection bar"
created: 2026-09-03
type: journal
parent: index
tags:
  - stylo/journal
  - engineering/milestone
---

# In-place canvas — right-click menu and selection bar

Two context-aware editing affordances for the in-place canvas, in the Notion shape: a formatting bar that follows the selection, and a right-click menu for everything structural. Pulls forward the "context-aware selection tooltip" that [ADR-002](../../decisions/002-editor-ux-and-customization.md) deferred to post-v1; see its dated amendment.

## Context

Before this, the canvas had a right-click menu on rendered tables only (shipped with the [table structural controls](./2026-09-02_table-structural-controls.md)). Everywhere else a right-click hit the browser's own menu, and there was no on-selection affordance — every format command went through the top toolbar or a keyboard shortcut.

## What shipped

### Selection bar

- Appears on its own whenever the main selection is a non-empty range and the editor has focus; positioned just above the selection, or below it when there is no room above the editor.
- **Inline formatting only** — bold, italic, strikethrough, inline code, link, wikilink, inline math. Each button reflects its active state.
- No block switching, no insert. It only ever does things that apply to the selected text.

### Right-click menu

Takes over from the browser's menu when it has something to offer:

| Target under the pointer                                                         | Menu contents                                                                                                                                                  |
| -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A non-empty selection                                                            | Inline actions + Cut / Copy / Paste                                                                                                                            |
| No selection, on a marked run                                                    | `**phrase**` etc. selects the run's text; a `[label](url)` / `[[Page\|label]]` selects the **whole** construct (so Bold wraps the link), then as the row above |
| A structural block — code, quote, list, heading, divider, `$$` math, frontmatter | That block's toggles + **Insert ▸** + clipboard                                                                                                                |
| A table cell, on a word or marked run                                            | Auto-selected (whole run for a marked one), then as the row below                                                                                              |
| A table cell, on whitespace                                                      | The structural menu shipped with the table controls                                                                                                            |
| A table cell with a text selection                                               | The structural menu + a **Format ▸** group (routed through `runInlineInCell`) + clipboard                                                                      |
| A plain paragraph, no selection                                                  | **Insert ▸** + clipboard                                                                                                                                       |
| Outside `.cm-content`                                                            | The browser's own menu (not intercepted)                                                                                                                       |

**Insert ▸** is a hover flyout: table, divider, code block, block math, frontmatter.

### Shared basis

Both surfaces render from `BUILTIN_COMMANDS` in `src/toolbar/commands.ts` — the same `run` / `isActive` / `disabled` / `title` each command already carries, so context-sensitivity (disabled in a heading, in a fence, in frontmatter, …) is inherited, not re-derived.

Glyph data for the toolbar, the selection bar, and the menu was consolidated into one `src/toolbar/icon-paths.ts`; the three had been about to keep separate copies.

### Consumer API

`inPlace.contextMenu` (default `true`) — `false` keeps the browser's menu everywhere. `inPlace.selectionBar` (default `true`) — `false` turns the bar off. Both read once, at mount. Stable class names (`.cm-inplace-menu*`, `.cm-inplace-selbar*`) for restyling.

## Files

- `src/inplace/context-menu.ts` — headless menu shell: item / separator / one level of hover-intent flyout, viewport-clamped placement, dismissal.
- `src/inplace/context-menu-actions.ts` — `BUILTIN_COMMANDS` → rows, context classification, cell-selection detection, clipboard rows.
- `src/inplace/menu-plugin.ts` — one `ContextMenu` per editor, the `contextmenu` listener, and the take-over rule.
- `src/inplace/selection-bar.ts` — the floating bar as a `ViewPlugin`.
- `src/toolbar/icon-paths.ts` — shared 24×24 stroke-path data + a DOM `<svg>` builder.

## Gotchas found

- The menu and bar get their CSS from `inPlaceTheme`, an `EditorView.theme` that scopes every rule under `.cm-editor`. Portaling them to `document.body` left them unstyled and stripped the `--stylo-*` tokens (which cascade from `.stylo`). Both mount inside `view.dom` instead; the popups are `position: fixed`, so placement is still viewport-relative.
- `.cm-inplace-selbar { display: flex }` in the theme overrode the browser's `[hidden] { display: none }`, so `bar.hidden = true` did nothing and the bar sat wherever it was last placed. Gated `display` on `[hidden]`, matching the table menu's existing rule.
- The submenu closed the moment the pointer moved off "Insert" toward the flyout, because every action button (the flyout's own included) cleared it on `pointerenter`. Replaced with hover intent: stay open while the pointer is over the parent row or the panel, close ~300 ms after it leaves both.

## Deferred

- ~~**Selection bar inside an editable table cell.**~~ Landed 2026-09-03 — the bar now measures a cell's DOM selection and routes the marks through `runInlineInCell` ([note](./2026-09-03_menu-groups-cell-bar-callouts.md)).
- ~~**`table-gizmos.ts` onto the shared shell.**~~ Landed 2026-09-03 ([note](./2026-09-03_table-menu-shell-and-list-guides.md)).
- ~~**`contextMenu` / `selectionBar` as an ordered list.**~~ Landed 2026-09-03 — `contextMenu: { groups }` and `selectionBarItems` ([note](./2026-09-03_menu-groups-cell-bar-callouts.md)).
- ~~**Clipboard "Paste" in a plain document** silently no-ops when `navigator.clipboard` read is denied.~~ Addressed 2026-09-03 — the row is now disabled with a keyboard-shortcut hint when the async read is unavailable ([ADR-007 rollout log](../../decisions/007-seamless-in-place.md)).

## Log

- 2026-09-03 — spec agreed (Notion model: selection-driven inline bar, right-click for structural / insert); shell, actions, plugins, theme, config, and tests landed; menu/bar mount-point, `[hidden]`, and submenu hover-intent bugs fixed; icon path data consolidated; editable-table cell selections routed to the inline menu.
