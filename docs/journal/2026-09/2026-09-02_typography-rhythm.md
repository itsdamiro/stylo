---
title: "Typography rhythm — Tailwind prose as the reference"
created: 2026-09-02
type: journal
parent: index
tags:
  - stylo/journal
  - engineering/milestone
---

# Typography rhythm — Tailwind `prose` as the reference

## Context

The `preview` and `in-place` surfaces had ad-hoc vertical spacing: paragraphs with a bottom-only `0.9em` margin, a flat `1.4em` heading margin regardless of level, `line-height: 1.6`, a `1.5em` rule. It read as cramped and unscaled. `@tailwindcss/typography` (the `prose` plugin) exists precisely for rich-text / Markdown output and has a tuned `em`-based scale. ADR-002 §3 already treats shadcn/ui's conventions as a **visual reference, not a dependency**; `prose` joins it on the same terms — its numbers, hand-ported, no plugin.

## The model

`prose` has exactly two mechanisms and no "line spacing" knob (that is a word-processor idea):

- **`line-height`** — leading _within_ a block. Body is `1.75`.
- **`em`-based `margin`** — space _between_ blocks, scaled to each element's own size.

Paragraph spacing therefore only appears between _real paragraphs_. In Markdown a paragraph break is a **blank line** (two returns); a single return is a soft line break — same paragraph, wraps at `line-height`. This matches Obsidian and every plain-Markdown tool, and it is load-bearing for Stylo's plain-text invariant: the document _is_ the string. We do not emulate the word-processor "one return = one paragraph" model.

## The scale (base 16px), applied to `.preview`

| element      | margin                | notes                          |
| ------------ | --------------------- | ------------------------------ |
| body         | —                     | `line-height: 1.75`            |
| `p`          | `1.25em` top & bottom |                                |
| `h1`         | `0` / `0.89em`        | `2.25em`, line-height `1.11`   |
| `h2`         | `2em` / `1em`         | `1.5em`, line-height `1.33`    |
| `h3`         | `1.6em` / `0.6em`     | `1.25em`, line-height `1.6`    |
| `h4`–`h6`    | `1.5em` / `0.5em`     | line-height `1.5`              |
| `ul` / `ol`  | `1.25em`              | `padding-left: 1.625em`        |
| `li`         | `0.5em`               | loose `<p>` / nested: `0.75em` |
| `blockquote` | `1.6em`               | `0.25rem` border, `1em` pad    |
| `pre`        | `1.71em`              |                                |
| `table`      | `2em`                 |                                |

## Where we diverge from `prose`

- **`hr`** — `prose` sets `3em 0`, which reads as a page break. GitHub and VS Code render the rule tight; `.preview hr` uses `1em 0`. In-place it took three tries: the `---` line's own `line-height: 1.75` text-row strut was stacking under the `<hr>` widget's box (~3.5em total), and the browser's default `<hr> { margin: 0.5em 0 }` was leaking on top (also invisible to the height map). The fix: a `cm-inplace-hr-line` line decoration with `font-size: 0; line-height: 0` (the fenced-code fence-row recipe) collapses the strut, and `HrWidget` is `height: 1.6rem; margin: 0; border: none` — one row, the raw `---`'s own footprint, no shift when the caret enters (Obsidian's behaviour). `rem` because the line's font-size is zeroed.
- **`max-width: 65ch`** — not adopted; the host owns width.
- **Inline `code`** — no `::before` / `::after` backticks.
- **Links** — colour only, no underline (`--stylo-link`); `prose` underlines.
- **`blockquote`** — not italic.

## The in-place surface

`inPlaceTheme` mirrors the scale as closely as CodeMirror allows. Every vertical value is **`padding`, never `margin`**, and there are no collapsing widgets — the constraint from the [click-to-position note](./2026-09-02_in-place-click-mapping.md), since CM's height map only measures border boxes. Heading `padding-top` is trimmed (`0.35`–`0.7em`) because a blank source line already supplies most of the gap before a heading. Inter-paragraph spacing is whatever the blank `.cm-line` gives at `line-height: 1.75` — an approximation of `prose`'s `1.25em`, not a match.

## The setext-`---` gotcha

`---` immediately below a **paragraph** line is a **setext H2 underline**, not a thematic break — CommonMark resolves the ambiguity in favour of the heading. (`# heading` + `---` is fine: an ATX heading is not a paragraph, so the `---` is a rule.) A blank line above disambiguates; nothing is needed below. The toolbar's `hr` command inserts `\n\n---\n` for this reason.

Setext headings are **not configurable off**. Neither `remark` (preview) nor `@codemirror/lang-markdown`'s Lezer grammar (in-place) exposes a toggle, and disabling a core CommonMark construct that GitHub and Obsidian both render would break round-tripping — against the plain-text invariant. The blank-line convention (and the `hr` command doing it automatically) is the answer.

## Verification

`typecheck`, 78 Vitest tests, `build`, `format:check` — all pass. The rhythm change is CSS only; no behaviour, no new dependency. Visual tuning of the `preview` scale (heading sizes especially) is expected once it is seen in a real page.
