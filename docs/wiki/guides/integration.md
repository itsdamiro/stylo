---
title: "Integrating Stylo"
created: 2026-09-10
type: wiki-guides
parent: index
tags:
  - stylo/wiki
  - engineering/standard
---

# Integrating Stylo

Practical notes for dropping `<Stylo>` into an app: the module format and setup
it expects, which props are live, how persistence is meant to work, the
stylesheet and peer-dependency setup, and the theming contract. Each section
links to the reference page that covers it in full.

## Requirements

- **A bundler, or a native-ESM runtime.** Stylo ships **ES modules only** —
  there is no CommonJS (`require`) build and no `main` entry. Any current bundler
  (Vite, Next.js, Rspack, webpack 5, Parcel) handles it; a project that still
  `require()`s its dependencies does not.
- **React 18 or 19**, as peer dependencies — `react` and `react-dom`. Stylo
  shares the host's copy (see
  [Peer dependencies](#peer-dependencies--one-copy-each)).
- **CodeMirror 6 and Lezer**, as peer dependencies — the package list is in that
  same section.
- **Node 18+** for the build tooling; nothing Stylo needs at runtime in the
  browser.

Two stylesheet imports, once, anywhere in your app entry:

```tsx
import "@damiro/stylo/styles.css" // required — structural CSS
import "@damiro/stylo/katex.css" // only if you render math
```

Each of these is expanded on below.

## `<Stylo>` is fully controlled

`value` is the document; `onChange(next)` fires on every edit. Stylo keeps **no
internal copy and no dirty state** — render it from your own state and feed
`value` straight back:

```tsx
const [doc, setDoc] = useState(initialMarkdown)
return <Stylo value={doc} onChange={setDoc} />
```

An "unsaved changes" indicator, undo history beyond the editor session, conflict
resolution — all of that is app state you layer on top, because only the app
knows the persistence policy.

## Most props are reactive; three are read at mount

`value`, `onChange`, `onSave`, `mode`, `toolbar`, `frontmatter`, `icons`,
`readOnly`, `placeholder`, `className`, the click callbacks, and the styling
tokens all update live.

**`inPlace`, `codeLanguages`, and `wikiLinkSource` are read once, when the
editing surface mounts.** They feed the CodeMirror extension configuration, which
is built at construction. Changing one after mount has no effect until the
surface is recreated — give `<Stylo>` a `key` derived from the config:

```tsx
<Stylo
  key={`${theme}:${JSON.stringify(inPlaceConfig)}`}
  value={doc}
  onChange={setDoc}
  inPlace={inPlaceConfig}
  codeLanguages={languages}
  wikiLinkSource={wikiLinkSource}
/>
```

`embedSource` is reactive on `preview` / `split` but **also read once at mount on
the in-place canvas** — keep its identity stable there and remount to change it.

See [props · applied at mount](../reference/props.md#config-applied-at-mount) for
the rationale and the full list.

## Persistence: `onChange` to debounce, `onSave` for `Mod-s`

There is no `autoSave` prop — persistence is a policy that belongs to the app.
Wire a manual save (`onSave`, fired by `Cmd/Ctrl+S` and the opt-in `save`
toolbar item) and your debounced auto-save to **one** "save now" path.

The [Auto-save guide](autosave.md) has a `useAutosave` hook that debounces
`onChange`, skips a no-op save, flushes before the tab closes, and reports
status — copy it rather than re-deriving the edge cases.

## Frontmatter is handed back raw

`onFrontmatter(raw)` gives you the YAML block between the leading `---` fences as
a string, on mount and on every change. Stylo bundles **no YAML parser** — parse
it with whatever your app already uses. The same split is available synchronously
from the exported `splitFrontmatter(md)`, which returns
`{ frontmatter, body } | null`. The `frontmatter` prop (`"hidden"` | `"code"`)
controls only how the block appears on the `preview` / `split` surfaces. See
[props · frontmatter](../reference/props.md#frontmatter-in-preview).

## Resolver failures are quiet — `onResolveError` to hear them

`embedSource` and `wikiLinkSource` swallow their own failures: a rejected embed
falls back to literal `![[ref]]`, a rejected wikilink search shows no
completions. When either is network-backed, wire **`onResolveError(error, info)`**
so a backend outage is a log line or a toast, not a silent blank. It is
observation only — the fallback is unchanged — and a resolver returning `null`
is a valid result, not an error. See
[props · resolver errors](../reference/props.md#resolver-errors).

## Stylesheets — import once

```tsx
import "@damiro/stylo/styles.css" // required — structural CSS
import "@damiro/stylo/katex.css" // only if you use math; or import "katex/dist/katex.min.css"
```

`@damiro/stylo/katex.css` is a re-export of KaTeX's own stylesheet plus its
fonts. Import it **or** `katex/dist/katex.min.css`, not both. If your app
already loads KaTeX CSS, skip it here entirely.

## Peer dependencies — one copy each

CodeMirror, Lezer, and React are peer dependencies. Stylo shares the host's
copy so editor state, facets, and the syntax tree have a **single identity** — a
second copy of `@codemirror/state` in the tree breaks `getView()`, custom
extensions, and command dispatch in ways that are hard to trace. Install the
same versions your app uses (or let it resolve to one), and add any
`@codemirror/*` / `@lezer/*` packages that are not already there. See
[ADR-008](../../decisions/008-codemirror-peer-dependency.md).

`@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` are **optional** peers
— needed only if you render
[`<StyloToolbarSettings />`](../reference/toolbar-settings.md). A plain
`@damiro/stylo` import never pulls them.

## Extending the editor through `getView()`

The `ref` handle exposes `focus()`, `scrollToHeading(text)`,
`insertAtCursor(md)`, and `getView()` — the raw CodeMirror `EditorView`. Use
`getView()` to dispatch commands, rather than importing a separate `EditorView`
elsewhere and expecting shared state (see the peer-dependency note above). To
add your own CodeMirror extensions, use the supported
[`extensions` prop](host-extensions.md) instead of a post-mount
`StateEffect.appendConfig`. Full
list at [props · ref](../reference/props.md#ref--imperative-handle).

## Theming: override tokens, cover both modes

The palette is CSS custom properties on `.stylo` or any ancestor. Two rules:

- **When you override a colour token, set its dark value too.** The built-in
  dark palette activates under a `.dark` or `[data-theme="dark"]` ancestor (the
  `next-themes` / shadcn convention) — Stylo does **not** switch on
  `prefers-color-scheme`, so your theme layer toggles the class. Override a
  token and you own both states.
- `--stylo-radius`, `--stylo-font-size`, `--stylo-font-family`, and
  `--stylo-font-family-mono` are not colours — one setting serves both themes.

The full token tables (palette, table/guide, syntax colours) are in
[props · styling tokens](../reference/props.md#styling-tokens).

## Fenced-code highlighting is opt-in

Stylo bundles no language grammars — the full set is ~110 lazy chunks. Fenced
code renders in flat monospace until you pass `codeLanguages`: either
`@codemirror/language-data`'s `languages` array, a curated subset of it, or a
resolver function `(info) => Language | LanguageDescription | null`. It is a
mount-time prop (see above). Details in
[Fenced-code highlighting](../reference/code-languages.md).
