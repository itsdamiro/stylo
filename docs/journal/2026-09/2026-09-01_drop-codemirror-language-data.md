---
title: "Drop @codemirror/language-data for a pass-through codeLanguages prop"
created: 2026-09-01
type: journal
parent: index
tags:
  - stylo/journal
  - engineering/milestone
---

# Drop `@codemirror/language-data` for a pass-through `codeLanguages` prop

## Context

[ADR-001](../../decisions/001-editor-architecture.md) named `@codemirror/lang-markdown` **with `@codemirror/language-data`** as the editing surface, "for fenced-code sub-highlighting" — passing the full `languages` array to `markdown({ codeLanguages })` so a fenced block like ` ```python ` is tokenised with the Python grammar.

Building the foundation milestone surfaced the packaging cost the ADR had not reckoned with. `languages` is a single array literal of ~140 `LanguageDescription` entries, each with an inline `import()` for its grammar. A bundler sees every one of those call sites, so `vite build` emitted **~110 lazy grammar chunks** into `dist/` (python, sql, rust, stylus, …). They are genuinely code-split — a consumer's bundler only fetches `python-*.js` when a Python block renders — but they still ship in the package tarball, and filtering `languages` at runtime does **not** remove them (the `import()` sites are already in the bundle).

For a plain-text notes editor, where code blocks are usually short and incidental, shipping every grammar is the zero-bloat mandate inverted.

## Options considered

| Approach                                                         | Grammar chunks | Deps                         | Code blocks                  |
| ---------------------------------------------------------------- | -------------- | ---------------------------- | ---------------------------- |
| A — `codeLanguages: languages` (as ADR-001 wrote it)             | ~110 lazy      | `@codemirror/language-data`  | any language, highlighted    |
| B — drop `codeLanguages`                                         | 0              | none (removes language-data) | Markdown-level styling only  |
| C — curated subset via hand-built `LanguageDescription` list     | ~N lazy        | N × `@codemirror/lang-*`     | highlighted for the chosen N |
| D — `codeLanguages` pass-through prop on `<Stylo>`, default none | 0 in core      | none in core                 | consumer's choice            |

## Decision

**B now, D as the standing answer.** Remove `@codemirror/language-data`; call `markdown({ base: markdownLanguage })` with no `codeLanguages`. Fenced blocks keep Markdown-level styling (monospace, styled fences) but no per-language tokens.

When the configuration surface is built, add an optional `codeLanguages` prop forwarded straight to `markdown()`, so a consumer opts into exactly the grammars they want — `codeLanguages={[python()]}` or the full `languages` import — and the cost lands only on consumers who ask for it. A `@damiro/stylo/code-languages` helper preset can follow.

This keeps faith with ADR-001's "compose from primitives": Stylo does not decide the consumer's language set.

## Consequences

- One fewer runtime dependency; no grammar chunks in the package.
- Fenced code blocks in the source surface are not syntax-highlighted per language until a consumer passes `codeLanguages` (prop lands with the config work).
- ADR-001's editing-surface decision carries an inline amendment note pointing here.

## A further trim, considered and declined

`@codemirror/lang-markdown` statically imports `@codemirror/lang-html` (which pulls `@codemirror/lang-css` and `@codemirror/lang-javascript` and their Lezer grammars) to highlight raw HTML embedded in Markdown. There is no config flag to disable it — it is a top-level `import` in the package. That is ~44 kB gzip of the current 187 kB-gzip source bundle.

The alternative is to bypass `@codemirror/lang-markdown` and build the language from `@lezer/markdown` directly. That was declined:

- The saving is ~23% of the bundle. The CodeMirror 6 core (`@codemirror/view` alone is ~479 kB unminified) is the real weight and is irreducible — roughly 140 kB gzip is the floor for any CM6 editor.
- Bypassing loses `markdownKeymap` (Enter continues a list, smart markup backspace) and requires maintaining the language wiring by hand — exactly the "re-roll a solved primitive" that ADR-001 rejects.

So `@codemirror/lang-markdown` stays as ADR-001 chose it, `base: markdownLanguage`, and the source bundle sits at ~187 kB gzip.
