---
title: "Toolbar — inline marks nest, a wikilink button, table-aware block commands"
created: 2026-09-02
type: journal
parent: index
tags:
  - stylo/journal
  - engineering/milestone
---

# Toolbar — inline marks nest, a wikilink button, table-aware block commands

Three toolbar changes shipped alongside the table work.

## Inline marks were eating each other

`toggleWrap` (bold `**`, italic `*`, strike `~~`, code `` ` ``, inline math `$`) decides between _wrap_ and _unwrap_ by looking at the characters flanking the selection. Its "the marks sit just outside" check matched a bare `sliceDoc(from - m, from) === mark`, so applying **italic** to an already-bold `**word**` saw a `*` on each side — the inner asterisk of `**` — and _stripped_ it, leaving `*word*`. Bold-then-italic silently deleted the bold. Italic-then- bold happened to work only because there was no second `*` to satisfy the `=== "**"` test.

### Fix

`surroundsExactly(before, after, m)` gates both unwrap branches (marks inside the selection, and marks just outside): a run of the mark character on each side counts as a strippable instance only when it is long enough — `>= m` for the two-char marks, and an **odd** length for `*`, since `*x*` and `***x***` carry a lone italic asterisk but `**x**` does not. So:

- `italic` on `**word**` → `***word***` (nests; run of 2 is even, so wrap)
- `italic` on `***word***` → `**word**` (run of 3 is odd, so strip one)
- `bold` on `***word***` → `*word*` (run of 3 ≥ 2, strip two)
- every mark toggles back off cleanly from any nesting order

## Wikilink button

There was a `link` command for `[text](url)` but nothing for `[[target]]`, despite wikilinks being a first-class Stylo construct (`onWikiLinkClick`, the in-place collapse, `remark-wikilink`). Added `wikilink`:

- Registered in `commands.ts` next to `link`, shortcut `Mod-Shift-k`, default icon a `[[` double-bracket glyph in `icons.tsx` (matching Wikimedia's `Wikilink.svg`), and a slot after `link` in `DEFAULT_TOOLBAR_ITEMS`.
- `toggleWikiLink` / `wikiLinkActive` in `inline.ts` wrap the selection as `[[selection]]` (or `[[target]]` when empty) with the target text selected; with the caret inside a `[[target|label]]` they unwrap to the display text — the label if present, else the target — mirroring how `link` unlinks.
- `wikiLinkAt` scans the caret's line with the shared `WIKILINK_PATTERN` from `src/wikilink.ts`, so it never drifts from the render and in-place scanners.

## Context-aware buttons

`ToolbarCommand` gains an optional `disabled?(state)`. A button renders `disabled` and its shortcut is a no-op (the `keymap.ts` wrapper checks it first) when the command can't produce valid Markdown at the caret. Four small context predicates in `commands.ts` drive it: `tableActive` (the `insertTable` line scan), `inFrontmatter` (`frontmatterRange`), `fencedCodeActive` / `mathBlockActive` (existing syntax-tree checks), and `inHeading` (an ATX-line regex). `inLiteral` combines the middle three — contexts where markup is literal or means something else.

The map, by caret line:

- **table cell** — block commands off (`h1`–`h3`, `quote`, lists, `hr`, `frontmatter`, `table`); inline commands stay; `codeBlock` / `mathBlock` **degrade** — their `run`/`isActive` call `toggleWrap`/`wrapActive` with `` ` `` / `$` when `tableActive`, wrapping the cell selection inline instead of fencing.
- **heading line** — `bulletList`, `orderedList`, `task`, `codeBlock`, `mathBlock`, `frontmatter`, `table` off. `h1`–`h3` (the toggle), `quote` (`> # x` is valid), `hr`, and inline stay.
- **frontmatter block** — everything off except `frontmatter` (so it can toggle the block off).
- **fenced code** — everything off except `codeBlock` (the unwrap toggle).
- **`$$` math** — everything off except `mathBlock`.

`link` and `wikilink` count as inline (`[text](url)` / `[[target]]` carry no `|`, so they are cell-safe) and are only disabled in the literal contexts.

## Verification

`typecheck`, 132 Vitest tests (18 new in `test/toolbar.test.tsx` — bold/italic nesting in both orders, bold+italic+strike on then off, toggling one mark off mid-stack, the three wikilink cases, a `disabledAt(doc, pos)` matrix asserting the exact disabled set for a plain paragraph, a table cell, a heading line, a frontmatter block, a fenced code block and a `$$` block, `codeBlock`/`mathBlock` degrading to inline in a cell but still fencing outside, and the `h2` button toggling its `disabled` attribute as the caret enters and leaves a table row), `build`, `format:check`. Confirmed in a real Chromium: `Bold` then `Italic` yields `***word***`, the wikilink button wraps and unwraps, and the disabled set changes correctly as the caret moves between a paragraph, a heading, a `---` block, a fence and a `$$` block.
