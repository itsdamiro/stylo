---
title: "codeLanguages prop — fenced-code sub-highlighting, opt-in"
created: 2026-09-02
type: journal
parent: index
tags:
  - stylo/journal
  - engineering/milestone
---

# `codeLanguages` prop — fenced-code sub-highlighting, opt-in

## Context

The foundation milestone [dropped `@codemirror/language-data`](./2026-09-01_drop-codemirror-language-data.md): passing its full `languages` array to `markdown({ codeLanguages })` emitted ~110 lazy grammar chunks into the package tarball, which is the zero-bloat rule inverted for a notes editor. The standing answer recorded there was **option D** — a `codeLanguages` pass-through prop on `<Stylo>`, default none, so the cost lands only on the consumer who asks for it. This entry lands that prop.

## What was built

**`CodeLanguages` type** (`src/types.ts`) — mirrors what `@codemirror/lang-markdown` accepts verbatim:

```ts
type CodeLanguages =
  readonly LanguageDescription[] | ((info: string) => Language | LanguageDescription | null)
```

`LanguageDescription` and `Language` come from `@codemirror/language`, already a direct dependency — the type costs nothing new. Exported from the package entry alongside `StyloProps`.

**Threading.** All three CodeMirror surfaces build their editor through `useCodeMirror` → `baseExtensions()`, so one seam covers them:

- `baseExtensions(codeLanguages?)` passes it to `markdown({ base, codeLanguages })`.
- `useCodeMirror` gained a `codeLanguages` option, captured once in the construct-the-view effect (same lifetime rule as `extensions` and the in-place `inPlace` config — read at mount, a changed value needs a remount).
- `SourceView`, `SplitView`, and `InPlaceView` forward the prop; `Stylo` accepts it and hands it to `source`, `split`, and `in-place`.

**Scope.** `preview` is deliberately untouched — it renders through `react-markdown` / rehype, a separate pipeline. Code highlighting there is its own rehype plugin and its own dependency decision, not part of this.

**Playground.** `@codemirror/language-data` added as a **devDependency** only; the playground passes `codeLanguages={languages}` and the demo doc gained a `python` fence next to the existing `ts` one. Nothing ships to consumers — `dist/` is unchanged, no grammar chunks (verified in the build output: the `useCodeMirror` chunk stays ~187 kB gzip).

**Tests.** `test/codeLanguages.test.tsx` — without the prop, a fenced body resolves to a plain `CodeText` node; with `codeLanguages={languages}`, the Markdown parser loads the matching grammar (via its lazy `import()`) and re-parses, so the body gains real grammar nodes (`VariableDefinition`). The load is async, so the positive case waits with `vi.waitFor`.

## Verification

`typecheck`, 52 Vitest tests (2 new), `build`, and `format:check` all pass. The build emits no new chunks.

## Follow-ups

- A `@damiro/stylo/code-languages` helper preset (a curated `LanguageDescription` list for the common languages) — a subpath export, deferred to the v1 public-API design pass.
- Preview-mode code highlighting — separate pipeline, separate dependency, its own decision if it is wanted at all.
