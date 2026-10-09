---
title: "In-place table reaches the wrap's full width — gizmo gutter moved off the table's own box"
created: 2026-09-13
type: journal
parent: index
tags:
  - stylo/journal
  - engineering/milestone
---

# In-place table full width

## Context

Filed as an upstream request after a host stretched `.cm-inplace-table-wrap` to `width: 100%; box-sizing: border-box` (to match `preview`'s unwrapped `<table>`, which already fills its container) and found the visible `<table>` still sitting inset from the wrap's real outer edge by a fixed amount — measured at ~20px, matching `calc(1.15em + 4px)` exactly.

The cause: `.cm-inplace-table-wrap` reserves that space as **in-flow padding** on its right and bottom edges, so the add-row / add-column `+` gizmo strips (`table-gizmos.ts`) have room to render without spilling past the wrapper (`border-collapse` makes the browser ignore padding on the `<table>` element itself, so without a reservation somewhere the wrapper would size to the bare grid and the strips would overflow it). A child's percentage width always resolves against its parent's **content** box, padding excluded, regardless of the parent's own `box-sizing` — so `.cm-inplace-table`'s width, whether left intrinsic or forced to `100%` by a host, could never reach the wrap's true outer edge while that padding stood between them, no matter how the wrap itself was sized.

Checked before touching anything: is the padding load-bearing for the gizmos' own _position_? No — `table-gizmos.ts`'s `layout()` reads the table's live `getBoundingClientRect()` on every layout pass and places the strips relative to that, not to a value baked into the reserved padding. The padding only existed to keep the wrap's rendered box big enough to contain the strips.

## Decision

Split the reservation instead of removing it outright:

- **Right-hand padding dropped to `0`.** Nothing needs it: the column strip's own position is computed live, and — verified in a real Chromium via Playwright, not assumed — the strip is still fully hit-testable at its new position (`document.elementFromPoint` resolves to it, not a covering ancestor) whether or not a host stretches the wrap, because no ancestor in stylo's own markup clips horizontally.
- **Bottom padding kept as-is.** This one _is_ load-bearing, per the existing code comment: it's what makes the wrap's own rendered height (which CodeMirror's line-height map reads) tall enough to hold the row strip without it visually overlapping the next line below the table. Confirmed the existing `ArrowDown out of the last row...` browser test (which depends on that measurement being correct) still passes unchanged.
- **`overflow: visible` stated explicitly** on `.cm-inplace-table-wrap`, matching what was already the CSS default there — documents the intent now that the column strip routinely renders past the wrap's own box (previously it stayed inside the box in the unstretched, default case too, since the padding gave it room; now it doesn't, in every case, not just a stretched one).

## Consequences

- `.cm-inplace-table` now reaches its wrap's full outer width whenever a host makes the wrap itself full width — matching `preview`'s unwrapped table, which already filled its container. No change for a host that never touches `.cm-inplace-table-wrap`'s sizing — the wrap still shrinks to the table's own intrinsic width by default, same as before.
- New coverage in `test/browser/table-widget.spec.ts`: a host stretching the wrap to `100%` now gets a table flush with the wrap's real outer edge, and the add-column strip still renders past the table's edge, is genuinely hit-testable there (not just laid out), and inserting a column through it still works.
- Purely internal CSS — no prop, no public API change. `preview` and `source` are untouched; this only reaches the in-place canvas's editable (`table: "cells"`) table rendering.
