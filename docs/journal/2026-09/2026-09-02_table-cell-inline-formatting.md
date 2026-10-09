---
title: "In-place table cells — inline formatting"
created: 2026-09-02
type: journal
parent: index
tags:
  - stylo/journal
  - engineering/milestone
---

# In-place table cells — inline formatting

## Context

The read-only in-place `<table>` (`inPlace.table: "source"`, the default) drew each cell with `td.textContent = raw`, so `**bold**`, `` `code` ``, `[a](b)`, `[[wiki]]`, and `$x$` showed as literal characters. `preview` mode already formats cells (it runs through `remark-gfm`); the in-place canvas did not. This was the last-listed follow-up on the table work.

## What was built

**`src/inplace/inline-md.ts`** — `renderInline(text: string): DocumentFragment`, a small left-to-right tokenizer for one line of inline Markdown, no new dependency (it reuses `katex`, already in the in-place chunk for `math.ts`):

- Rule order is precedence: `` `code` `` and `$math$` match first and keep their contents literal; then `[[wiki]]`, `[link](url)`, `***both***`, `**bold**`, `~~strike~~`, `*em*`. Each rule's `build` recurses into its content (`inlineFrag`) so `**a `b` c**` styles the bold and the code.
- It emits the same `.cm-inplace-strong` / `-em` / `-strike` / `-code` / `-link` / `-wikilink` / `-math` classes the decoration plugin uses, so a cell matches the rest of the canvas.
- Wikilink spans carry `data-stylo-wikilink`, so the delegated `click` handler in `extension.ts` fires `onWikiLinkClick` from inside a cell with no extra wiring.
- Inline math uses the standard guard (`(?<![\d$])\$(?!\s)…(?<!\s)\$(?![\d$])`) so `costs $5 and $10` is left as text.

**`src/inplace/tables.ts`** — `TableWidget.toDOM` now appends `renderInline(raw.replace(/\\\|/g, "|"))` to each `<th>` / `<td>` (a `\|` is a literal pipe inside a GFM cell, so it is unescaped first). `eq` is unchanged — it still compares the parsed `{ head, body, aligns }` strings.

## Scope

`"source"` mode only. The `"cells"`-mode `EditableTableWidget` keeps plain text in its `contenteditable` cells: rendering `<strong>` there would make `sync()`'s `textContent` read drop the `**`, breaking round-trip. Formatted display in editable cells needs per-cell reveal-on-focus and is left as a follow-up. Sub-cell click-to-position (`caretOffsetInCell`) also degrades to the cell start for a formatted cell, since the rendered text has no `**` to map a character offset back onto.

## Verification

`typecheck`, 123 Vitest tests (11 new: `test/inline-md.test.ts` covers the tokenizer — nesting, code-keeps-literal, `***`, currency-is-not-math, unclosed marks; `test/inplace.test.tsx` covers a rich cell rendering `<strong>` / `<code>` / `<a href>` / `.katex` / a `data-stylo-wikilink` span, and a cell wikilink firing `onWikiLinkClick`). `build`, `format:check`. Confirmed in a real Chromium: a table with bold/italic/code/link/wikilink/math cells renders formatted, and `$5 and $10` stays literal.
