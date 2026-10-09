---
title: "Fenced-code highlighting"
created: 2026-09-02
type: wiki-reference
parent: index
tags:
  - stylo/wiki
  - engineering/standard
---

# Fenced-code highlighting

> **Fenced code rendering in flat, uncoloured monospace?** That is the default —
> Stylo ships no language grammars. Pass the `codeLanguages` prop (below) to opt
> in to the ones you need.

Stylo carries a built-in token palette (the `--stylo-syntax-*` custom
properties — see [props](./props.md#syntax-colours)) and applies it on every
surface — the CodeMirror ones (`source`, `split`, `in-place`) and `preview`
alike. But it can only colour tokens a language grammar has identified, and
**Stylo bundles no grammars**: the
full `@codemirror/language-data` set compiles to ~110 lazy chunks in the package
tarball, which is the zero-bloat mandate inverted for a notes editor (see the
[2026-09-01 note](../../journal/2026-09/2026-09-01_drop-codemirror-language-data.md)
and the [ADR-001](../../decisions/001-editor-architecture.md)
amendment).

So without `codeLanguages` a fenced block gets Markdown-level styling only — a
monospace font and styled fences. The `codeLanguages` prop opts in with exactly
the grammars you want; it is forwarded verbatim to `@codemirror/lang-markdown`,
so the cost lands only on the consumer who asks for it, and matching blocks then
pick up the syntax palette automatically.

## The whole set

```tsx
import { Stylo } from "@damiro/stylo"
import { languages } from "@codemirror/language-data"

;<Stylo value={doc} onChange={setDoc} codeLanguages={languages} />
```

`languages` is a list of `LanguageDescription` entries, each with a lazy
`import()` for its grammar. A block like ` ```python ` triggers the dynamic
import for the Python grammar and re-parses once it resolves; your bundler
code-splits each grammar into its own chunk, fetched on first use.

## A curated subset

Pull in only the languages you expect, and skip the `@codemirror/language-data`
dependency:

```tsx
import { javascript } from "@codemirror/lang-javascript"
import { python } from "@codemirror/lang-python"
import { LanguageDescription } from "@codemirror/language"

const codeLanguages = [
  LanguageDescription.of({ name: "javascript", alias: ["js", "ts"], support: javascript() }),
  LanguageDescription.of({ name: "python", alias: ["py"], support: python() }),
]

;<Stylo value={doc} onChange={setDoc} codeLanguages={codeLanguages} />
```

## Scope

- **Every surface, one prop.** `source`, the source pane of `split`, the
  `in-place` canvas, and `preview` (including `split`'s preview pane) all
  resolve `codeLanguages` the same way — a fence's language name is matched
  fuzzily against the array, or handed to the function form. A match that
  finds a language on one surface finds it on the others too.
- **`preview` colours with its own tokenizer, not CodeMirror's.** The
  CodeMirror surfaces highlight live, inside an `EditorView`; `preview` has no
  editor to attach to, so it parses each fenced block once with the resolved
  grammar and walks the result with `@lezer/highlight`'s `highlightTree`
  (`src/render/highlightCode.ts`) — the exact same grammars and the exact same
  `SYNTAX_TAG_GROUPS` → `--stylo-syntax-*` mapping
  (`src/editor/highlight.ts`) as the live editor, so a block reads
  identically read or edited, by construction rather than by two
  implementations agreeing today. No new dependency: `@lezer/highlight` and
  `@codemirror/language` are peer dependencies already, for the CodeMirror
  surfaces.
- **Read once, at mount — on the CodeMirror surfaces only.** Changing
  `codeLanguages` on a mounted `<Stylo>` has no effect on `source` / `split`'s
  source pane / `in-place` until it remounts (give it a `key` if the set must
  change live). `preview` has no such constraint: it is a pure function of its
  props (ADR-001), so a changed `codeLanguages` takes effect on its very next
  render.

## Type

```ts
type CodeLanguages =
  readonly LanguageDescription[] | ((info: string) => Language | LanguageDescription | null)
```

The function form receives the fence info string (the text after the opening
` ``` `) and returns the grammar to use, or `null` for none.
