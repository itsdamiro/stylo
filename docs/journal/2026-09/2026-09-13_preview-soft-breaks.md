---
title: "Opt-in soft line breaks in preview — `softBreaks`"
created: 2026-09-13
type: journal
parent: index
tags:
  - stylo/journal
  - engineering/milestone
---

# `softBreaks`

## Context

Filed as an upstream request after auditing `preview`'s CommonMark rendering against `in-place`: two consecutive lines with no blank line between them (a callout title and body, most visibly) render as one joined paragraph in `preview`, per spec, but read as two separate lines in `in-place` — not because `in-place` does anything smarter with paragraphs, but because CodeMirror decorates each source line independently there. Checked against Obsidian directly: it does not join them either, via `remark-breaks`, which turns a single line ending into a real line break instead of feeding CommonMark's "blank line starts a new paragraph" rule.

A client-side `value` pre-pass (inserting a trailing double-space or a blank line before every bare newline) was considered and ruled out: it is easy to get wrong across fenced code, table cells, and frontmatter — exactly the context a real markdown AST pass already handles correctly.

## Decision

A new `preview`-only prop, **`softBreaks`** (default `false`):

```ts
softBreaks?: boolean
```

Threaded into `Preview`'s `remarkPlugins` memo (`src/render/Preview.tsx`), ahead of `remarkEmbed`/`remarkWikilink`/`remarkCallout` so soft breaks resolve before the wikilink/callout/embed passes run over the paragraph text. Reaches both call sites that mount `LazyPreview`: `mode="preview"` directly off `<Stylo>` and `split`'s preview pane via `<SplitView>`.

### Choices

- **Off by default.** Unlike the `preview` code-wrap fix, this is a visible behaviour change to existing rendered output, not a bug fix — every current consumer keeps CommonMark's paragraph-joining unless it opts in.
- **`preview`-only, same asymmetry as `codeLanguages`.** `in-place` and `source` are CodeMirror surfaces with no paragraph-joining behaviour to turn off — there is nothing for the prop to do there.
- **Fully reactive**, like `frontmatter` — no mount-time config, so no `key` remount needed to pick up a change.
- **Fenced code and table cells stay untouched, verified rather than assumed:** `remark-breaks` only rewrites text inside phrasing/paragraph nodes; a fenced code block's body is an opaque `code` node in `mdast`, and GFM table cells can't contain a source-level newline in the first place, so neither is a paragraph-shaped node this plugin ever visits.

## Consequences

- One new dependency, `remark-breaks` — its own transitive deps (`mdast-util-newline-to-break`, `@types/mdast`, `unified`) are already pulled in by `remark-gfm`/`remark-math`.
- `test/preview.test.tsx` covers the default (still joined), `softBreaks` turning a line ending into a `<br>`, and a fenced code block's internal newlines staying untouched with `softBreaks` on.
- The props reference now lists `softBreaks` alongside `frontmatter` as a `preview`-only, fully reactive prop.
