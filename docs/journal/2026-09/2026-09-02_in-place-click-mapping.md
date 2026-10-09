---
title: "In-place canvas — click-to-position accuracy"
created: 2026-09-02
type: journal
parent: index
tags:
  - stylo/journal
  - engineering/milestone
---

# In-place canvas — click-to-position accuracy

Two fixes to the [in-place canvas](./2026-09-01_in-place-canvas.md), both about
the caret landing where the pointer actually was. Follows the customization API
pass ([ADR-005](../../decisions/005-in-place-decoration-toggles.md)); no scope
change and no new prop.

## Symptom

Clicking inside a fenced code block put the caret well below the pointer — you
had to aim a line or two above the character you wanted. The error was slight
near the top of a document and grew further down. Clicking in the frontmatter
block, at the very top, was accurate.

## Cause

CodeMirror maps a click's y-coordinate to a document position through an
internal **height map**, which it builds by measuring each line and each block
widget by its **border box**. `padding` is inside that box and is measured;
`margin` is outside it and is not. Any vertical `margin` on something the height
map measures is therefore screen space CodeMirror cannot see, so every position
below it renders lower than CodeMirror believes — and the error accumulates down
the document. That is why the frontmatter (zero accumulated error) was fine and
the code block (sitting below a `$$` math block and an `---` rule, each leaking
~1em of margin) was visibly off.

The offenders, all vertical `margin` on measured elements:

- `.cm-inplace-math-block` — the root of a `block: true` widget
- `.cm-inplace-hr` — the `<hr>` widget
- `.cm-inplace-table` — the root of a `block: true` widget
- `.cm-inplace-code-top` / `.cm-inplace-code-bottom` — `.cm-line` decorations on
  the fenced-code fence rows

## Change

### Vertical spacing is padding, never margin

Every vertical `margin` above became `padding` on the same element. The
horizontal rule, which needs its line centred within that padding, is now
painted as a centred 1px background gradient instead of a `border-top`.
Horizontal `margin` (`.cm-inplace-mono`) is left alone — it never enters the
vertical height map.

With the drift removed at the source, the fenced-code fence rows collapse to
zero height again off-caret (`.cm-inplace-code-pad`), so the container reads as
a compact box the size of its padding plus the code — matching the `preview`
mode `pre`. An intermediate "keep the fence rows at full height" workaround,
tried while the cause was still unknown, is gone.

### Frontmatter: recessed lines, not a chip

The leading YAML block is no longer folded behind a one-line "Properties" chip.
It stays at full height with line decorations only — muted, monospace, a CSS
"Properties" label on the first line — and the `---` fences are hidden off-caret
and shown when the caret enters the block. The chip had been a `block: true`
widget that folded the whole block to a single line, and that fold desynced
click-to-position for everything below it: the same border-box / height-map
problem as the margins. Line decorations keep every row at its true height, so
the mapping stays exact. `FrontmatterWidget`, the field's `atomicRanges`
provider, and the `.cm-inplace-frontmatter` entry in the widget-reveal
`mousedown` selector are all removed — there is no widget to click any more, and
the caret enters the block like ordinary text.

## Consequences

- Click-to-position is accurate throughout an in-place document, however many
  rendered blocks sit above the click.
- House rule for in-place styling: **no vertical `margin` on a `.cm-line`
  decoration or on a widget root — use `padding`.** Recorded in a comment above
  the code-container rules in `theme.ts`.
- The frontmatter block is now visible and legible in place rather than hidden.
  A future `inPlace.frontmatter` display mode (`source` / `inline` /
  `properties`) is still open; the default is this recessed inline style.
- No public API change. ADR-004 gains a dated amendment; the in-place tracker
  and the `in-place-config` reference are updated.

## Log

- 2026-09-02 — frontmatter chip replaced with recessed line decorations; the
  fenced-code fence rows kept full height as a stop-gap against a then-unexplained
  click desync (commit `e4dd1f5`).
- 2026-09-02 — root cause found (margin sits outside CodeMirror's height map);
  every vertical in-place `margin` converted to `padding`; fence rows collapse
  again; click-to-position verified accurate below the math block, rule, table,
  and code block in the playground (commit `dd4dfc5`).
