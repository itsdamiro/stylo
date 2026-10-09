# Stylo

**A plain-text-first Markdown editor for React, with first-class LaTeX support.**

Stylo is a zero-bloat Markdown editor component for React. Plain text stays
canonical — there is no WYSIWYG document model — so notes round-trip losslessly
with Obsidian and any other Markdown tool. CodeMirror 6 handles editing;
`remark` / `rehype` + KaTeX handle rendering; `[[wikilinks]]` and `$…$` math are
built in.

![The Stylo in-place canvas: a formatting toolbar above a document where headings, emphasis, a callout, KaTeX math, a table, task checkboxes, and highlighted code all render inline while the focused heading shows its `#` marker.](./docs/assets/stylo-in-place.png)

> **Status:** working library, pre-1.0. The in-place canvas, `source` / `preview`
> / `split` modes, the formatting toolbar, `[[wikilinks]]`, and KaTeX math all
> ship and are covered by an integration test suite (`npm run test`). The public
> API may still shift before 1.0.

---

## Features

- **In-place canvas** — a live Obsidian-style surface: Markdown markers stay
  hidden until the caret reaches the line, and headings, emphasis, links, and
  math render inline without leaving the text. Plus `source`, `preview`, and
  `split` modes.
- **First-class math** — `$…$` and `$$…$$` rendered with KaTeX, live in the
  canvas and in preview.
- **`[[wikilinks]]`** — recognised, styled, and clickable, with an
  `onWikiLinkClick` callback and opt-in `[[` autocomplete from an index you
  supply (`wikiLinkSource`).
- **`#tags`** — opt-in `#` autocomplete from an index you supply (`tagSource`),
  mirroring `wikiLinkSource`'s trigger-while-typing UX.
- **`![[embed]]` transclusion** — opt-in on every rendered surface (`preview`,
  `split`, and the in-place canvas): pass `embedSource` and Stylo hands you the
  reference, you return the node to render in its place.
- **Interactive tables** — edit a rendered table cell by cell in the in-place
  canvas, with row / column controls; or keep plain source pipes.
- **Callouts** — `> [!note]` blockquotes render as tinted admonition blocks
  (`note` / `tip` / `warning` / `danger` / `example`).
- **Declarative toolbar** — trim, reorder, or extend the command set, supply
  your own buttons, swap the icons, and fold what doesn't fit into a `⋯` menu
  instead of wrapping. [Reference](./docs/wiki/reference/toolbar.md).
- **End-user toolbar customizer** — an optional `<StyloToolbarSettings>`
  component: drag- and keyboard-reorderable.
  [Reference](./docs/wiki/reference/toolbar-settings.md).
- **Find / replace** — `Mod-f` on every editing surface.
- **Frontmatter-aware** — YAML frontmatter round-trips untouched; `onFrontmatter`
  hands you the raw block to parse.
- **Opt-in code highlighting** — fenced code is coloured through a
  `--stylo-syntax-*` token palette once you pass the grammars you want.
  [Reference](./docs/wiki/reference/code-languages.md).
- **Themeable** — structural CSS only; a `--stylo-*` custom-property palette with
  a built-in dark mode.
- **Imperative handle** — `focus()`, `scrollToHeading()`, `insertAtCursor()`, and
  `getView()` for the raw CodeMirror `EditorView`.

---

## Install

```bash
npm install @damiro/stylo
```

To track an unreleased commit, install from git instead
(`npm install github:itsdamiro/stylo`) — the `prepare` script builds the
bundle during install, so there is nothing else to wire up.

CodeMirror, Lezer, and React are **peer dependencies** — Stylo shares the host's
copy rather than bundling its own, so editor state, facets, and the syntax tree
have a single identity (see [ADR-008](./docs/decisions/008-codemirror-peer-dependency.md)).
Add them alongside Stylo if they are not already in your app:

```bash
npm install @codemirror/state @codemirror/view @codemirror/commands \
  @codemirror/language @codemirror/lang-markdown @lezer/common @lezer/highlight
```

React 18 or 19 is also a peer dependency (`react` + `react-dom`). Stylo ships
**ES modules only** — there is no CommonJS build — so it needs a bundler (Vite,
Next.js, …) or a native-ESM runtime. Stylesheet imports are in [Usage](#usage);
the full setup checklist is in the
[integration guide](./docs/wiki/guides/integration.md#requirements).

The optional `@damiro/stylo/toolbar-settings` component (an end-user toolbar
customizer) additionally needs `@dnd-kit/core @dnd-kit/sortable
@dnd-kit/utilities` — optional peers, install them only if you render it. See
[its reference](./docs/wiki/reference/toolbar-settings.md).

---

## Why

Round-trip fidelity — plain Markdown in, the same plain Markdown out — rules out
most of the field before features even enter it:

- **TipTap, Milkdown, BlockNote** (all ProseMirror) and **Lexical** keep their
  own document tree as the source of truth and serialize to Markdown on save —
  exactly where frontmatter, `[[wikilinks]]` (not standard Markdown; needs a
  custom node type), and math risk silently mangling on a round-trip.
  **Toast UI Editor** is the same shape under different branding, and
  considerably less themeable.
- **EasyMDE / SimpleMDE** get the one axis that matters most right — genuinely
  canonical Markdown in and out — but on CodeMirror 5, with no in-place live
  rendering (raw source or a separate preview pane, not an Obsidian-style
  live-preview feel), no wikilinks, no embeds, no frontmatter handling.
  Adopting one means rebuilding most of what Stylo already does.
- **Raw CodeMirror 6, no wrapper** is what's left after ruling those out — and
  building the decoration canvas, the wikilink/embed/frontmatter layer, and a
  theming contract from scratch is the reinvention Stylo exists to avoid.

Stylo takes the Obsidian stance instead: **the Markdown string is the source of
truth.** The editor is a thin, composable surface over it.

## Design stance

- **Plain text is canonical.** The component's value is a Markdown string. No
  intermediate document model.
- **Compose, don't adopt a framework.** CodeMirror 6 for the editing surface;
  the unified/`remark` ecosystem + KaTeX for rendering.
- **Zero-bloat.** Every dependency is modular, tree-shakeable, and MIT. Nothing
  is pulled in "just in case."
- **Interoperable.** YAML frontmatter, `[[wikilinks]]`, and `$…$` / `$$…$$` math
  survive a full edit round-trip.

## Stack

| Concern          | Library                                                                                      |
| ---------------- | -------------------------------------------------------------------------------------------- |
| Editing surface  | CodeMirror 6 (`@codemirror/lang-markdown`)                                                   |
| Find / replace   | `@codemirror/search` — `Mod-f` on every editing surface                                      |
| Render / preview | `react-markdown` + `remark-gfm` + `remark-math` + `rehype-katex` + `katex`                   |
| `[[wikilinks]]`  | small custom `remark` plugin                                                                 |
| `![[embeds]]`    | `remark` plugin (preview) + `EmbedWidget` portal registry (in-place), one host `embedSource` |
| Frontmatter      | `remark-frontmatter` — fences recognised; key/value parsing deferred                         |
| Styling          | CSS Modules + `--stylo-*` CSS custom properties — no Tailwind, no CSS-in-JS                  |
| Icons            | inline SVG, swappable via the `icons` prop — no icon-package dependency                      |

Styling and icon decisions are recorded in
[ADR-002](./docs/decisions/002-editor-ux-and-customization.md);
the math engine and KaTeX asset delivery in
[ADR-003](./docs/decisions/003-katex-math-rendering.md).

## Usage

```tsx
import { Stylo, type StyloHandle } from "@damiro/stylo"
import "@damiro/stylo/styles.css"
import "@damiro/stylo/katex.css" // KaTeX stylesheet + fonts (or import "katex/dist/katex.min.css")

function Editor() {
  const [doc, setDoc] = useState("# Hello\n\nInline math: $e^{i\\pi} + 1 = 0$")
  const editor = useRef<StyloHandle>(null)

  return (
    <Stylo
      ref={editor}
      value={doc}
      onChange={setDoc}
      mode="in-place" // default — also "source" | "preview" | "split"
      onSave={(md) => persist(md)} // fires on Mod-s
      onFrontmatter={(raw) => setMeta(raw)} // raw `---` block; parse it yourself
      onWikiLinkClick={(target) => navigate(target)}
    />
  )
}
```

`ref` gives an imperative handle: `focus()`, `scrollToHeading(text)`,
`insertAtCursor(md)`, and `getView()` for the raw CodeMirror `EditorView`.

`toolbar` trims, reorders, or extends the formatting bar — built-in command ids,
your own `ToolbarCustomItem` buttons, and a `render` slot to wrap it.
`overflow: "menu"` keeps the bar on one row, folding the buttons that don't fit
into a trailing menu. See the
[toolbar reference](./docs/wiki/reference/toolbar.md).

`canvasHeader` docks your own content — a frontmatter card, say — inside the
editing surface itself, below the find/replace panel and above the document
body, a seam `toolbar.render` can't reach since it wraps content before the
whole canvas. See [Canvas header](./docs/wiki/reference/props.md#canvas-header).

`inPlace`, `codeLanguages`, `wikiLinkSource`, and `tagSource` are read once,
when the editing surface mounts — give `<Stylo>` a `key` derived from the
config to apply a change. (`codeLanguages` is the exception in `preview`,
which is a pure function of its props and picks up a change immediately, no
`key` needed.) Every other prop is fully reactive. See
[props · applied at mount](./docs/wiki/reference/props.md#config-applied-at-mount).

Pass `wikiLinkSource` — `(query) => { target, label? }[]`, sync or async — to
turn on `[[wikilink]]` autocomplete backed by your own index. See
[Wikilink autocomplete](./docs/wiki/reference/props.md#wikilink-autocomplete).

Pass `tagSource` — `(query) => { tag }[]`, sync or async — to turn on `#tag`
autocomplete backed by your own index, the same trigger-while-typing UX as
`wikiLinkSource`. See
[Tag autocomplete](./docs/wiki/reference/props.md#tag-autocomplete).

Pass `embedSource` — `(ref) => ReactNode`, sync or async — to resolve
`![[embed]]` transclusion on every rendered surface, the in-place canvas
included. Stylo detects the `![[…]]` (when it is alone on its line) and renders
whatever you return; on the canvas the caret reveals the raw source. See
[Embeds](./docs/wiki/reference/props.md#embeds).

Fenced code blocks render in plain monospace — no token colours — until you pass
`codeLanguages` with the grammars you want. Stylo bundles none by design (the
full grammar set is ~110 lazy chunks). See
[Fenced-code highlighting](./docs/wiki/reference/code-languages.md).

### Theming

Every colour is a `--stylo-*` custom property; override any of them on `.stylo`
or an ancestor. A dark palette ships built in and activates under a `.dark` or
`[data-theme="dark"]` ancestor — the `next-themes` / shadcn convention.
`--stylo-font-size` (default `0.9375rem`) sets the base size for the in-place
canvas, `source`, and `preview` alike — everything inside each scales from it;
`--stylo-font-family` and `--stylo-font-family-mono` set the prose and code
fonts.

---

## Documentation

Full documentation lives in the [wiki](./docs/wiki/index.md).

**Architecture**

- [System overview](./docs/wiki/architecture/overview.md) — the plain-text-first
  model, the composed stack, and the render pipeline.

**Guides**

- [Integrating Stylo](./docs/wiki/guides/integration.md) — live vs. mount-time
  props, persistence, stylesheet and peer-dependency setup, the theming
  contract.
- [Auto-save](./docs/wiki/guides/autosave.md) — why it is not a prop, and a
  `useAutosave` hook to copy.
- [Layout and touch](./docs/wiki/guides/layout-and-touch.md) — the page layouts,
  the full-height recipe that pins a toolbar for free, and touch behaviour.

**Reference**

- [`<Stylo>` props](./docs/wiki/reference/props.md) — the prop surface, styling
  tokens, and math setup.
- [Formatting toolbar](./docs/wiki/reference/toolbar.md) — the `toolbar` prop,
  command ids, keyboard shortcuts, and the `icons` override.
- [`<StyloToolbarSettings />`](./docs/wiki/reference/toolbar-settings.md) — the
  opt-in end-user customizer for the formatting bar.
- [In-place canvas configuration](./docs/wiki/reference/in-place-config.md) — the
  `inPlace` prop and its decoration toggles.
- [Fenced-code highlighting](./docs/wiki/reference/code-languages.md) — the
  `codeLanguages` prop and how to opt into language grammars.

Engineering journal: [`docs/PROJECT_JOURNAL.md`](./docs/PROJECT_JOURNAL.md).
Architectural Decision Records: [`docs/decisions/`](./docs/decisions/README.md).

## Development

```bash
npm install
npm run dev            # playground
npm run typecheck
npm run test           # unit suite (Vitest + jsdom)
npm run test:browser   # in-place canvas in real Chromium (Playwright)
npm run build          # library bundle
```

`npm run test:browser` needs the browser once: `npx playwright install chromium`.

## License

MIT © damiro
