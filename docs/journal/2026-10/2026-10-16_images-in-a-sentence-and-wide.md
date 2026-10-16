---
title: "Images in a sentence, and a width the host chooses"
created: 2026-10-16
type: journal
parent: index
tags:
  - stylo
  - images
  - engineering
  - standard
---

# Images in a sentence, and a width the host chooses

## Context

[ADR-014](../../decisions/014-image-source-for-markdown-images.md) drew an image only when it was alone on its line, and nothing capped a drawn picture at its column. [ADR-017](../../decisions/017-images-beyond-a-line-of-their-own.md) took the follow-ups: an image in a sentence, a list item or a quote, and a width the host chooses. Its spike ran in real Chrome before any code, and found that the wide layout works on the canvas and cannot be made clean in `preview`; the amendment records it.

## What changed

- **An inline slot.** `buildImages` (`src/inplace/image.ts`) makes one pass over each line that holds `![` and classifies every `Image` node: a top-level paragraph by itself is the block slot, any other is an inline widget, and links and tables are skipped. `ImageWidget` takes an `inline` flag. `remarkImage` turns the same images into `<span class="stylo-image-inline">` in `preview` and `split`, skipping links; a table cell is drawn there. `HostImage` and `Embed` already had the inline path.
- **A cap on every picture.** `max-width: 100%` on the host node inside an image slot, so `![[embed]]` content is untouched.
- **`imageAlign` and `imageWidth`** reach the CSS as `data-stylo-image-align` and `data-stylo-image-width` on the root. Centre and right turn the wrapper into a flex row; `wide` makes `.cm-scroller` a size container and sizes the wrapper between the column and a cap in `cqw`, less 1rem for the scrollbar that `cqw` includes. The fixture takes `imageWidth`, `imageAlign` and `column`.
- **Tests.** Vitest pins each place on both surfaces, the table-cell, link and code gaps, the caret reveal and read-only; a browser spec measures the layout in Chromium for every width and alignment, `|full`, a resize, clicks beside wide pictures, and `preview` and `split` staying at the column.

## Worth knowing

- The first wide structure left the wrapper column-wide and let the picture overflow it, which a host `<img>` with its own `max-width: 100%` (a Tailwind-style reset) defeats. The wrapper now grows to its picture, between the column (`min-width: 100%`) and the cap, so such a host works and `|full` still fills the column.
- CodeMirror's base theme sets `margin: 0` on `.cm-content` at a higher specificity than a plain `.cm-content` rule, so a host centring its column needs a stronger selector; the fixture and the docs say so.
- The first cut had two passes in two new files; the review merged them into one, which also removed the work of reading each image twice.
- Tests for the old scope (an image in a sentence left as source) were rewritten, not deleted: they now pin the new behaviour.
