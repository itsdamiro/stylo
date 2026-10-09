---
title: "Two caret/layout bugs after a table and an embed"
created: 2026-09-12
type: journal
parent: index
tags:
  - stylo/journal
  - engineering/bugfix
---

# Two caret/layout bugs after a table and an embed

A user report — "caret positioning is off after a table" in the playground — traced to two separate, previously undocumented bugs in the in-place canvas. Neither is new; both predate this session's other work, surfaced now because the report happened to land right after it.

## 1. `EditableTableWidget.bounds()` disagreed with the real GFM parse

`src/inplace/table-widget.ts`'s `bounds()` re-derived the table's `[from, to]` document range with its own heuristic: starting from `posAtDOM`, it grew the span across contiguous lines that were non-blank **and contained a `|`**. That independently reinvented what `src/inplace/tables.ts`'s `tableField` already gets for free from the syntax tree (`node.from` / `node.to` on the Lezer `Table` node) — and the two disagreed whenever a table was followed, with no blank line, by a plain-prose line containing no `|`.

GFM's own table parser (`@lezer/markdown`'s `TableParser.nextLine`) doesn't check for a pipe on continuation lines — it swallows _any_ non-blank line after the header + delimiter into the same `Table` node, until a blank line or a new block-starting construct interrupts it. That's real GFM behaviour (the same reason every Markdown guide says "always blank-line after a table"), and `tableField`'s decoration — the thing `EditorView.atomicRanges` actually enforces — correctly reflects it. `bounds()`'s pipe-only scan stopped one line short.

Consequence: `exitBelow()` / `exitAbove()` (used by ArrowUp/Down/Tab/Enter out of the last cell) computed a caret position using the short range, landing inside what CodeMirror still considered the atomic table — the caret appeared to not move, or moved somewhere unexpected. `sync()`'s reserialize dispatch used the same short range, so it never touched the swallowed line either.

**Fix:** `bounds()` now reads `tableField` directly — `view.state.field(tableField).between(pos, pos, ...)` — the same source `src/inplace/table-enter.ts`'s `arrowIntoTable` already used correctly for keyboard _entry_. One source of truth for the table's range, not two. `test/table-interactive.test.tsx` gained a regression test: a table immediately followed by a pipe-less line, arrowing out of the true last (swallowed) row now lands at the genuine document end, not one line short of it.

## 2. `.cm-inplace-embed`'s box model

Two issues here.

**The margin-collapse one.** `.cm-inplace-embed .stylo-embed-content` wraps whatever `embedSource` returns, with no vertical padding/border of its own. A host node with its own `margin-top` / `margin-bottom` (a self-styled card) collapsed straight through it, so the border-left accent rail — drawn at `.stylo-embed-content`'s own box edge — ended up not matching where the card actually rendered (visually, the rail sitting apart from / shorter than the card). `preview`'s stylesheet already guards against exactly this (`stylo.module.css`: `.stylo-embed-content > :first-child { margin-top: 0 }` / `:last-child { margin-bottom: 0 }`) — the in-place canvas theme just never got the same rule when embeds landed there. Added the equivalent to `theme-canvas.ts`.

**The margin-vs-padding one — this was the actual reported bug.** Every other block widget's vertical spacing in `theme-canvas.ts` is `padding`, not `margin`, specifically because margin sits outside the border box CodeMirror's height map measures and drifts click-to-position for everything below (the 2026-09-02 click-mapping fix). `.cm-inplace-embed` never got that treatment. A first pass here tried the same `padding` swap, confirmed it fixed nothing reproducible in a short single-viewport test fixture, and reverted it after finding it broke something else (below) — but the user then confirmed directly against their real content (`![[Getting Started]]` and `![[architecture/diagram.png|320]]` in `playground/content/sample.md`): removing the two embeds made the caret bug disappear. That's a real repro this session's fixture didn't reach (likely needs the longer, scrolled document the original 2026-09-02 bug's own description implies), and it settles the "unconfirmed" question — the margin was the cause.

**Why the first attempt at `padding` broke interactive content.** Converting `.cm-inplace-embed` to `padding` also broke `test/browser/embed.spec.ts`'s "interactive host content keeps its own clicks" — a click on e.g. a button inside a resolved embed stopped reaching the button and instead collapsed the embed to raw `![[ref]]` source. Root cause, found by reading `@codemirror/view`'s own dispatch loop (`runHandlers`): a custom `EditorView.domEventHandlers` hook returning `false` (as `extension.ts`'s mousedown handler does for `.closest(".stylo-embed-content")`) only means "not handled by _this_ handler" — it does not stop CodeMirror's own **built-in** mousedown handler (registered in the same list) from _also_ running its default click-to-place-caret logic, which resolves inside the atomic embed range regardless. The margin-vs-padding difference happened to tip that default handling's coordinate resolution across a threshold in the old fixture, but the `.closest()`-and-bail approach was never a sound way to protect interactive content — just one that happened not to visibly fail before.

**Real fix:** `Embed.tsx` now stops mousedown propagation on `.stylo-embed-content` itself (`onMouseDown={(e) => e.stopPropagation()}`), the exact technique `table-widget.ts` already uses for the identical problem — stopping the event before it ever reaches CodeMirror's listener, rather than hoping a handler further down the list declines to act on it. Not `preventDefault`, so native focus/click on the host's own content still works normally. With that in place, `.cm-inplace-embed` takes `padding` like every other block, and both the click-mapping fix and the interactive-click test pass together.

## Verification

`typecheck`, 442 Vitest tests (one new, table-widget), 27 Playwright browser tests (one new, embed click-mapping sanity check — all passing, including "interactive host content keeps its own clicks" with the `padding` change now in place), `build`, and `format:check` all pass.
