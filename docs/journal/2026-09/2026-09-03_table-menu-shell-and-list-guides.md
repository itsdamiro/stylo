---
title: "In-place canvas — shared table menu, table style hooks, list indent guides"
created: 2026-09-03
type: journal
parent: index
tags:
  - stylo/journal
  - engineering/milestone
---

# In-place canvas — shared table menu, table style hooks, list indent guides

Three follow-ups from the ["After in-place" list](./2026-09-01_in-place-canvas.md), none changing a public prop.

## Editable table menu → the shared shell

The editable table's structural menu (`table-gizmos.ts`) kept its own hand-rolled popup — a `<div class="cm-inplace-table-menu">`, its own item buttons, its own outside-press / Escape listeners. It now builds on the canvas's `createContextMenu` shell (`context-menu.ts`), the same one the right-click menu and selection bar use:

- `createTableGizmos` still owns the hover **+** edge strips and their `layout()` against the live `<table>`. Only the menu moved.
- `entries(r, c)` became a `MenuRow[]` builder — `MenuAction` rows plus a `"separator"`, with `active` on the current alignment.
- Placement, viewport clamping, and dismissal come from the shell. The menu mounts inside the gizmo overlay (still within `.cm-content`), so it stays distinguishable from the canvas menus, which mount on `.cm-editor`.
- `theme.ts` lost the `.cm-inplace-table-menu` / `.cm-inplace-tm-*` block; the shared `.cm-inplace-menu*` rules cover it. Net ~40 fewer lines.

`MenuAction` gained an optional `title` (added in the same batch for the disabled-Paste hint).

## Table style hooks

Rendered tables — in-place **and** preview — now read their border, header fill, and row-stripe colours from dedicated tokens, so a host can reskin them without overriding rules:

| Token                     | Default                         | Effect                                              |
| ------------------------- | ------------------------------- | --------------------------------------------------- |
| `--stylo-table-border`    | `var(--stylo-border)`           | cell borders, both surfaces                         |
| `--stylo-table-header-bg` | `color-mix(--stylo-border 30%)` | header row fill                                     |
| `--stylo-table-stripe-bg` | `transparent`                   | `tbody tr:nth-child(even)` — zebra striping, opt-in |

Defaults reproduce today's look (the preview header gains the same subtle fill the canvas already had — the two now match). Striping is a no-op until the host sets the stripe token.

## Nested-list indent guides

`list-guides.ts` — a viewport scan (alongside the wikilink / math passes) that walks `ListItem` nodes, and for a nested item's own lines (the range stops before its first child list) emits a `.cm-inplace-li` line decoration carrying the nesting depth in `--sl-li-depth`. The theme turns that into that many faint 1px rules via a clipped `repeating-linear-gradient`, coloured by a new `--stylo-guide` token. Alignment with the bullets is approximate — a decorative depth cue, not a pixel-exact rail. Top-level items get nothing.

## Files

- `src/inplace/table-gizmos.ts` — menu now delegates to `createContextMenu`.
- `src/inplace/list-guides.ts` — new; the indent-guide decoration pass.
- `src/inplace/decorate.ts` — calls `scanListGuides` in the viewport loop.
- `src/inplace/theme.ts` — table tokens, `.cm-inplace-li` guides, dropped the bespoke table-menu CSS.
- `src/styles/tokens.css` — `--stylo-table-*`, `--stylo-guide`.
- `src/styles/stylo.module.css` — preview tables read the table tokens.

## Log

- 2026-09-03 — table menu ported to the shared shell (tests repointed from `.cm-inplace-tm-item` to `.cm-inplace-menu-item`); `--stylo-table-*` and `--stylo-guide` tokens added and threaded through both table surfaces; `list-guides.ts` indent-guide pass landed with a decoration-level test. The guide visuals still want a real-Chrome look.
