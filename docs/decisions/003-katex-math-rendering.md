---
type: decision
status: accepted
date: 2026-09-01
projects: [stylo]
concepts: [Math rendering]
amends: []
supersedes: []
tags: [type/decision, status/accepted, project/stylo, topic/architecture]
---

# 003 — Math rendering engine and KaTeX asset delivery

> **Summary.** Math is rendered by KaTeX through rehype-katex, a regular dependency, and Stylo's stylesheet carries editor chrome only, so the host adds KaTeX's CSS and fonts in one documented line. The in-place canvas re-typesets on every keystroke, so the engine must be synchronous and not shift layout. The cost is KaTeX's LaTeX subset, enough for note math but not full typesetting, and one setup step for every consumer.

- **Status:** Accepted
- **Date:** 2026-09-01
- **Deciders:** damiro, Grace

## Context

[ADR-001](./001-editor-architecture.md) chose `remark-math` + `rehype-katex` + `katex` for the render pipeline but left one item explicitly open: KaTeX ships its own webfonts and stylesheet, and how those reach the consumer was "documented as a peer/setup step" without a concrete decision.

[ADR-002](./002-editor-ux-and-customization.md) then made the `in-place` live-preview canvas the default view. That raises the stakes on the engine choice: math inside the canvas re-typesets as the author types, so the engine must be **synchronous** and must not shift surrounding layout on each keystroke.

Two questions therefore need settling:

1. Is KaTeX still the right engine given the live-preview loop, or is there a better fit?
2. How are the KaTeX stylesheet and fonts delivered to consumers of a library that is itself meant to stay zero-bloat?

### Engine options considered

| Option                        | What it is                                                                                   | Assessment                                                                                                                                                                                  |
| ----------------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **KaTeX**                     | Synchronous LaTeX → HTML + CSS, self-contained webfonts, supports a subset of LaTeX          | Fast, no layout jitter, proven in the same class of tool (Obsidian, Khan Academy, GitHub). The LaTeX subset is sufficient for note-grade math.                                              |
| **MathJax v3**                | Much fuller LaTeX (AMS packages, custom macros, mhchem), SVG or HTML output                  | Async typesetting causes layout shift on every keystroke in the in-place canvas; ~1 MB+; heavier to drive from CodeMirror. The extra LaTeX coverage is not needed for notes.                |
| **Temml → native MathML**     | LaTeX → MathML converter (KaTeX family); the browser renders it with no runtime fonts or CSS | Would remove the asset-delivery problem entirely. But MathML rendering fidelity still varies by browser and installed math fonts in 2026 — too risky to stake "first-class LaTeX" on today. |
| **Build / server pre-render** | Run a typesetter ahead of time, ship HTML                                                    | Inapplicable — the author is typing math live.                                                                                                                                              |
| **Hand-rolled typesetter**    | Implement the box-and-glue model and font metrics                                            | Multi-year effort; same reasoning as ADR-001's rejection of a from-scratch parser.                                                                                                          |

The realistic contest is KaTeX vs. MathJax, and MathJax loses on bundle size and async reflow for this workload.

## Decision

1. **Engine: KaTeX**, via `rehype-katex`. Synchronous, layout-stable, smallest footprint. Its LaTeX subset is accepted as sufficient for the target use case (note-taking math), not full document typesetting.

2. **`katex` is a regular `dependency` of Stylo**, with its version range locked to what the pinned `rehype-katex` expects. It is **not** a `peerDependency`: the JS is tightly coupled to `rehype-katex`, and consumers should not have to know KaTeX exists at the JS level or pin a compatible version themselves.

3. **Stylo's shipped `dist/styles.css` contains editor chrome only.** It never references KaTeX fonts or bundles KaTeX CSS.

4. **KaTeX styling is a documented one-line setup step for the consumer**, who picks one of:
   - `import "@damiro/stylo/katex.css"` — a file Stylo ships that re-exports `katex/dist/katex.min.css`. Because `katex` is Stylo's dependency it is always resolvable, and this guarantees the CSS version matches the engine Stylo runs. **Recommended default.**
   - `import "katex/dist/katex.min.css"` — for consumers who manage `katex` directly and want dedupe control.
   - A CDN `<link>` — for no-bundler contexts (plain HTML, Astro islands).

5. **Fonts load on demand.** The browser fetches only the woff2 glyph families a document actually uses, from KaTeX's own `fonts/` directory next to its CSS. Stylo does not copy, path-rewrite, or inline the font files.

6. **Temml + native MathML is a recorded future revisit**, targeted at the point where MathML Core rendering is uniform across evergreen browsers. Switching to it would not change the shape of decisions 2–5, and would additionally delete the asset-delivery question. Until then, KaTeX stands.

## Consequences

**Positive**

- No layout jitter as math re-typesets in the `in-place` canvas.
- Smallest math footprint of the viable engines; every piece stays modular and MIT.
- One documented setup line for consumers; the recommended path guarantees engine/CSS version alignment.
- SSR-safe — the stylesheet is static, no client-only typesetting step.
- Stylo's own stylesheet stays small and KaTeX-font-free, preserving the "structural CSS only" boundary from the architecture overview.

**Negative / costs**

- Consumers must perform one CSS import. This is documented, not hidden — it executes the open item from ADR-001 rather than papering over it.
- KaTeX supports only a subset of LaTeX (no arbitrary packages or user macros). Acceptable for note math; may surface later as feature requests, at which point the MathJax and Temml trade-offs are revisited under this ADR.
- KaTeX webfonts are an extra network fetch on first math render (mitigated by on-demand, per-family loading and normal HTTP caching).

## Alternatives rejected

- **MathJax v3 as the engine.** Fuller LaTeX coverage, but async typesetting shifts layout on every keystroke in the live-preview canvas, the bundle is ~1 MB+, and CodeMirror integration is heavier. The extra coverage is not needed for note-grade math.
- **Temml → native MathML now.** Eliminates asset delivery, but 2026 MathML rendering is still browser- and font-dependent; too risky for the product's "first-class LaTeX" positioning. Kept as a future revisit (decision 6).
- **Build- or server-side pre-render.** Inapplicable to a live editor.
- **Hand-rolled typesetter.** Disproportionate; reinvents a solved problem.
- **`katex` as a `peerDependency`.** Forces consumers to know KaTeX exists and pin a compatible version; the coupling to `rehype-katex` makes Stylo the right owner of that version.
- **base64-inlining the KaTeX fonts into shipped CSS.** Adds ~1 MB and forces every glyph family to download whether used or not, defeating the browser's on-demand loading.
- **Copying / path-rewriting the woff2 files into `dist/fonts/`.** Extra build machinery for no gain over the `@damiro/stylo/katex.css` re-export.

## Bundle placement (foundation milestone)

The render pipeline (`react-markdown` + `remark-*` + `rehype-katex` + `katex`) adds ~145 kB gzip. To keep `mode="source"` consumers from paying for it, the `Preview` component is loaded with `React.lazy` behind a `Suspense` boundary in `Stylo.tsx`. The build splits it into its own chunk (`Preview-*.js`), fetched only when a rendered mode is used; the entry chunk stays at the CodeMirror-only floor (~187 kB gzip).

`katex`, `rehype-katex`, and `remark-math` remain regular `dependencies`.

**Considered and deferred:** splitting the render pipeline (and, separately, the CodeMirror language grammars) into their own package subpath exports — `@damiro/stylo/preview`, `@damiro/stylo/code-languages` — each carrying its own dependencies, so a source-only consumer's install never pulls them.

- Rejected as premature: it is a public-API decision (it changes what `mode="preview"` means and how `split` composes), and lazy-loading already solves the shipped-bundle problem. The remaining benefit is a smaller `node_modules` for source-only consumers — dev-machine disk, not shipped weight — at the cost of an explicit install step and a subpath import.
- To be revisited when the v1 public API surface is designed. Making `katex` an optional peer dependency does not work in isolation: `remark-math` hard-depends on `katex` transitively, so any real split has to move the whole render stack.
