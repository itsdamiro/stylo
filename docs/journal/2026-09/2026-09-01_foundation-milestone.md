---
title: "Foundation milestone — build, source and preview modes"
created: 2026-09-01
type: journal
parent: index
tags:
  - stylo/journal
  - engineering/milestone
---

# Foundation milestone — build, source and preview modes

## Context

The three ADRs and the wiki were in place, but there was no code — no `package.json`, no `src/`, no build. This milestone turns the decisions into a running, tested package skeleton: the toolchain, and the two simplest view modes (`source` and `preview`) over the canonical Markdown string. It stops before `split`, the `in-place` decoration canvas, the toolbar, theming polish, and publishing.

## What was built

**Build.** Vite library mode, single ES entry, `react` / `react-dom` external. Types via `tsc --emitDeclarationOnly` (no dts plugin). Vitest + Testing Library + jsdom. Prettier as the only formatter, enforced in CI (`format:check`). Scripts: `dev`, `typecheck`, `test`, `build`, `format`. `package.json` is `@damiro/stylo` with an `exports` map (`.`, `./styles.css`, `./katex.css`) and `publishConfig.access: public`.

**`<Stylo>` component** — `src/Stylo.tsx`. Controlled: `value` is the Markdown string, `onChange` fires with the full string on every edit. `mode` accepts the full `"in-place" | "source" | "preview" | "split"` union; only `source` and `preview` work today, the others warn once and fall back to `source`. Interim default is `source` (ADR-002 will make it `in-place`). A stable `.stylo` class scopes the `--stylo-*` design tokens.

**Source mode** — `src/editor/`. `useCodeMirror` owns a CodeMirror 6 `EditorView` for the element's lifetime and keeps it in sync with the controlled string: user edits drive `onChange`; external `value` changes are dispatched with an annotation so they do not echo back; `readOnly` / `placeholder` reconfigure in place via a compartment. The view is built only inside an effect, so server rendering is safe. Extensions: history, the default keymap, the Markdown language (CommonMark + GFM), line wrapping, and a theme wired to the tokens.

**Preview mode** — `src/render/`. `Preview.tsx` renders with `react-markdown` plus `remark-gfm`, `remark-math`, `remark-frontmatter`, `rehype-katex`, and a small custom `remark-wikilink` plugin that rewrites `[[target]]` / `[[target|label]]` into inert links carrying the target; a custom `a` renderer calls `onWikiLinkClick` for those and adds `rel="noreferrer"` to the rest. YAML frontmatter is kept out of the rendered body. `Preview` is `React.lazy`-loaded behind a `Suspense` boundary, so `mode="source"` consumers never fetch the render chunk.

**Styling** — `src/styles/`. `tokens.css` defines the seven `--stylo-*` custom properties (shadcn-neutral defaults, reference only). `stylo.module.css` is the container plus source and preview layout, all token-driven. Compiled to a single `dist/styles.css` with no KaTeX font references.

**Playground** — `playground/`. `npm run dev` serves a page with a source / preview toggle and a demo document exercising frontmatter, a GFM table, inline and block math, plain and labelled wikilinks, a code fence, and a blockquote.

## Divergences from the plan

- **`@codemirror/language-data` was dropped** — it bundled ~110 lazy grammar chunks into the package. Fenced blocks now get Markdown-level styling only; per-language highlighting will return as an opt-in `codeLanguages` pass-through prop. Recorded in the [ADR-001](../../decisions/001-editor-architecture.md) amendment and a [dedicated note](./2026-09-01_drop-codemirror-language-data.md).
- **`Preview` is lazy-loaded** — recorded in the ADR-003 "Bundle placement" section, which also captures the deferred option of splitting the render pipeline and language grammars into their own package subpath exports (`@damiro/stylo/preview`, `@damiro/stylo/code-languages`) as a v1 API decision.

## State at end of milestone

`typecheck`, 15 Vitest tests, `build`, and `format:check` all pass. The build emits three chunks: the core entry (~187 kB gzip, CodeMirror only), the preview chunk (~145 kB gzip, on demand), and a tiny shared CSS-module chunk. Work is on a `feat/foundation-scaffold` branch.

## Next

- `split` mode with synchronized scroll.
- The `in-place` decoration canvas (headings and math widgets, cursor reveal) — the non-trivial CodeMirror milestone from ADR-002; this is what makes `mode` default to `in-place`.
- ~~Declarative toolbar + commands + inline SVG icons + keyboard shortcuts.~~ Done 2026-09-02 — [journal note](./2026-09-02_toolbar.md).
- ~~`codeLanguages` pass-through prop.~~ Done 2026-09-02 — [journal note](./2026-09-02_code-languages-prop.md).
- v1 public-API design pass — the subpath-export question, `onFrontmatter` exposure, dark-theme tokens.
- Publish automation.
