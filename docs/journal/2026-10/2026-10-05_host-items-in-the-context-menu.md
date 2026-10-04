---
title: "Host items in the right-click menu"
created: 2026-10-05
type: journal
parent: index
tags:
  - stylo
  - context-menu
  - engineering
  - standard
---

# Host items in the right-click menu

## Context

The in-place right-click menu is Stylo's own element, so a host cannot add an
entry from outside: a second `contextmenu` handler would either replace Stylo's
menu or stack a second one on top. A host with a selection-driven action (a
comment on the selected words, a lookup, a "define") could only offer it as a
toolbar button, far from the selection and the first thing to fold into the
overflow menu in a narrow panel.

## Decision

`inPlace.contextMenu` takes `items: ContextMenuItem[]`, the menu's parallel of a
custom toolbar button: `id`, `title`, optional `icon`, `run(view)`, optional
`disabled(state)`, `when` (`"selection"`, `"no-selection"`, `"always"`) and
`readOnlySafe`.

- **One new group, `host`,** listed in `groups` like the others. It is **first**
  in the default order: the host's action is the one a right-click on a
  selection is usually for, and an empty group draws nothing, so a menu with no
  items is unchanged. A `groups` list without `"host"` hides the items.
- **It appears in every context the menu has:** the canvas, a fenced code
  block, the divider menu, and a table cell (above the Format group in the
  cell's structural menu).
- **`run` sees the selection as it was when the menu opened.** In a table cell
  the selection lives in the DOM, not in `state.selection`, so just before
  `run` the selected text is mapped back to its range in the document
  (`cellSourcePos` plus the cell's DOM offsets; the cell shows raw source while
  focused, so the offsets carry over) and dispatched as the state selection.
  The cell keeps DOM focus. A cell menu opened on a cell that is not the focused
  one has no selection of its own: the item runs with a caret at the start of
  that cell, and `when: "selection"` does not count the focused cell's text.
- **Read-only:** every built-in row edits the document, so none shows. The menu
  opens in a read-only note only when a listed `readOnlySafe` item applies to
  the current selection; otherwise the browser's own menu stays. This changes
  the earlier rule, under which a read-only canvas never opened the menu.
- **Icons** are a stroke-path string (as the built-in rows) or any element that
  renders to an SVG. An element is rendered once through `react-dom/client`,
  copied as static markup into each row and unmounted, so it needs no
  lifecycle and a glyph set made of several shapes works without conversion.
- The row carries `data-menu-item="<id>"` as a styling hook; it is otherwise a
  normal `cm-inplace-menu-item` button.

- **The list is live.** The rest of `inPlace` is read once at mount, but a host
  `run` usually closes over React state, so the canvas passes the extension a
  ref-backed getter (as it already does for `onLinkClick`) and the items are
  read on each menu open.
- **A throwing icon** loses its glyph, not the menu: the render is wrapped, and
  React still reports the error to the page.

## Consequences

- `react-dom/client` is now imported by the in-place chunk. It had to be added
  to the build's externals: with only `react-dom` listed, the subpath was
  bundled and the `markdown` chunk grew from 59 KB to 238 KB gzipped (and a
  consumer would have shipped two copies of react-dom). The bundle-size check
  caught it; the `InPlaceView` budget rose from 23,000 to 24,000 B for the
  feature itself (about 630 B).
- A `when: "selection"` item hides itself where there is nothing selected (the
  divider menu, a blank line) with no special case.
- A host icon cannot hold state or handlers; it is a picture, not a component.
- A writable menu whose only group is `host` with no items now falls back to the
  browser menu instead of opening empty.
