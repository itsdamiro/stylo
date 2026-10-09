---
title: "Syntax highlighting — a token palette for fenced code"
created: 2026-09-02
type: journal
parent: index
tags:
  - stylo/journal
  - engineering/milestone
---

# Syntax highlighting — a token palette for fenced code

## Context

[`codeLanguages`](./2026-09-02_code-languages-prop.md) made the right grammar parse a fenced block, but nothing ever painted the result: every code block, on every surface, rendered as flat monochrome text. The cause was structural — `baseExtensions()` assembles the editor by hand rather than from CodeMirror's `basicSetup`, and no `HighlightStyle` / `syntaxHighlighting()` was ever added. Markdown emphasis and headings look styled in the in-place canvas only because `decorate.ts` adds `.cm-inplace-*` classes by hand; code had no equivalent.

## What was built

**`src/editor/highlight.ts`** — a `HighlightStyle.define([...])` mapping `@lezer/highlight` tags to `var(--stylo-syntax-*)` custom properties, exported through `syntaxHighlighting()` as `styloHighlighting`. Added to `baseExtensions()` right after `markdown(...)`, so all three CodeMirror surfaces (`source`, the source pane of `split`, `in-place`) pick it up through the one seam.

Both `@codemirror/language` and `@lezer/highlight` are already transitive dependencies of `@codemirror/lang-markdown`, so this adds **no package weight** and needs no ADR under the zero-bloat rule.

**`--stylo-syntax-*` tokens** (`src/styles/tokens.css`) — eleven light-mode defaults in the same neutral / blue family as the rest of the palette (`keyword`, `string`, `escape`, `comment`, `number`, `constant`, `function`, `type`, `property`, `tag`, `invalid`). The host overrides them the same way as `--stylo-link` and friends. Documented in [props › Syntax colours](../wiki/reference/props.md#syntax-colours).

**Deliberately narrow.** Rules exist only for tokens a real programming-language grammar emits. Markdown's own structural tags (heading marks, emphasis markers, link brackets) are left undefined, so `source` mode keeps its plain, un-tinted look and the in-place decoration layer is untouched. Variable names, operators, and punctuation are also left as body text — colouring them turns a code block into a rainbow and hurts readability. The result is close to One Light in temperament: keywords, strings, comments, and names carry the colour; the scaffolding stays quiet.

## Verification

`typecheck`, 140 Vitest tests (1 new in `test/codeLanguages.test.tsx` — a `javascript` fence renders token `<span>`s with a generated highlight class once its grammar resolves), `build`, `format:check` all pass. The build emits no new chunks. Confirmed in a real Chrome against the playground: the `ts` and `python` demo fences show coloured keywords / function names / strings / types in the in-place canvas, and `source` mode Markdown is unchanged.

## Follow-ups

- A language badge in the block's top-right corner (the fence's language name).
- Dark-mode default values — deferred with the rest of the palette's dark story.
