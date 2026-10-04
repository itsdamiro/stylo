---
title: "Toolbar overflow menu"
created: 2026-10-04
type: journal
parent: index
tags:
  - stylo
  - toolbar
  - engineering
  - standard
---

# Toolbar overflow menu

## Context

On a narrow host the toolbar wrapped onto a second line, which costs the
document height and moves the text when the line appears. Hosts cannot fold
individual buttons from outside: they receive the rendered bar as one node.

## Decision

An opt-in `toolbar.overflow: "menu"` (default `"wrap"`). Buttons that do not
fit fold into a trailing `⋯` menu, unpinned from the end first. The fit is
measured from a hidden copy of the slots (real widths, so fonts, custom glyphs
and the larger sticky buttons are all accounted for) and re-run by a
`ResizeObserver`. The fit itself is a pure function (`overflow-fit.ts`) so it
is unit-testable without layout. The menu is a small dependency-free popover.

## Consequences

- Wrap mode is untouched; menu mode lays slots out flat instead of in groups,
  so it can fold single buttons rather than whole groups.
- Each button is rendered twice in menu mode (visible row and hidden
  measuring row). The measuring copies are `aria-hidden` and not focusable.
- Widths are read from layout rects (so right-to-left pages measure the same)
  on mount, on `items` change, and whenever the bar or the measuring row
  resizes, which also catches a swapped glyph or a late-loading font.
- A folded toggle (bold, lists) keeps its pressed state in the menu.
