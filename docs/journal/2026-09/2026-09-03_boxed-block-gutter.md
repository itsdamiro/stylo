---
title: "In-place canvas — boxed blocks hold off the editor frame"
created: 2026-09-03
type: journal
parent: index
tags:
  - stylo/journal
  - engineering/milestone
---

# In-place canvas — boxed blocks hold off the editor frame

A layout fix to the [in-place canvas](./2026-09-01_in-place-canvas.md), in the
same file and spirit as the
[click-to-position pass](./2026-09-02_in-place-click-mapping.md). No scope change,
no new prop.

## Symptom

In `in-place` mode every block with its own fill or frame — a fenced code block,
the blockquote bar, a rendered table, a `$$` math block — ran flush to the
editor's 1px border. Plain paragraphs kept their normal inset, so the boxed
blocks looked shoved against the edge while the prose did not. The `$$` math
block hid the same overrun because its background matched the editor surface.

Separately, a fenced code block sat slightly _inside_ the prose column — a
narrow, floating box — rather than spanning it like the `preview` surface's
`pre`.

## Cause

The in-place canvas took its horizontal gutter (`0.75rem`) from the base editor
theme's `.cm-line` rule. A `.cm-line` padding insets the line's **text** and
nothing else:

- A **background or border painted on the line** is drawn across the padding box
  too, out to the `.cm-content` edge — so the fenced-code fill and the
  `.cm-inplace-quote` left border reached the frame.
- A **`block: true` widget** renders as a direct child of `.cm-content`, outside
  any `.cm-line`, so it never sees that padding at all — the rendered table
  (`tableField`) and the `$$` block (`blockMathField`) sat hard against the
  frame.

`.cm-content` itself carried only vertical padding (`0.75rem 0`), so there was
nothing else holding these elements off the edge.

The fenced code block additionally reused the inline-code chip's
`margin: 0 0.25rem`, which pulled its fill in from the column on both sides.

## Change

### The horizontal gutter moves to `.cm-content`

In `inPlaceTheme` only (added at `Prec.high`, so `source` mode is untouched):

- `.cm-content` gets `padding: 0.75rem` — the gutter now lives on the element
  that contains the lines _and_ the block widgets.
- `.cm-line` horizontal padding is zeroed, so the total text inset is unchanged.

Text lands exactly where it did before. Line backgrounds, line borders, and
block widgets now all stop at the same `0.75rem` gutter.

### Fenced code matches the preview surface

`.cm-inplace-mono` drops the `0 0.25rem` side margin and sets `padding: 0 0.9rem`.
The fill runs the full column width with `0.9rem` of inner padding — the same
figure the `preview` surface's `pre` uses (`stylo.module.css`), so a code block
reads identically in both modes.

## Consequences

- Every boxed in-place block clears the editor frame by the same `0.75rem`.
- **House rule** (companion to _no vertical `margin` on a `.cm-line` decoration
  or widget root_, from the click-to-position pass): **the in-place horizontal
  gutter belongs on `.cm-content`, not `.cm-line`** — a line background/border
  and a block widget both ignore `.cm-line` padding. Recorded in a comment above
  the `.cm-content` rule in `theme.ts`.
- `source` mode is unaffected: the gutter override is scoped to `inPlaceTheme`,
  and the base `.cm-line` gutter still applies there.
- Selection highlight now ends at the text edge instead of running `0.75rem` into
  the gutter — a minor, arguably cleaner cosmetic shift.
- No public API change. [ADR-004](../../decisions/004-in-place-decoration-canvas.md)
  gains a dated amendment.

## Log

- 2026-09-03 — gutter moved from `.cm-line` to `.cm-content` in `inPlaceTheme`;
  fenced-code fill widened to the full column with `0.9rem` inner padding;
  verified in the playground that fenced code, the blockquote bar, a rendered
  table, and a `$$` math block all sit at a `0.75rem` gutter from the frame
  (commit `b27ee7f`).
