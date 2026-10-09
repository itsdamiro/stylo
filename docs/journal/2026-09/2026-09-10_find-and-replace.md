---
title: "Find / replace — @codemirror/search wired in"
created: 2026-09-10
type: journal
parent: index
tags:
  - stylo/journal
  - engineering/milestone
---

# Find / replace — `@codemirror/search` wired in

The integration audit listed in-note search as "a baseline editor expectation
Stylo simply omits — no `search` toolbar id, no `Mod-f` keymap." Unlike the
vault-aware gaps on that list (`[[` autocomplete, `![[embed]]`), this one needs
no knowledge of anything outside the document: `@codemirror/search` is an
official CodeMirror package that composes straight onto the existing editor.

## What was wired

`baseExtensions()` ([`src/editor/extensions.ts`](../../../src/editor/extensions.ts))
gained three things:

- `search({ top: true })` — the panel and its state field. Top-docked, the
  common editor placement.
- `keymap.of(searchKeymap)` — in-panel navigation: `Mod-g` / `Mod-Shift-g`
  next / previous, `Mod-Alt-g` replace, `Mod-Shift-l` select all matches,
  `Escape` close.

Opening on `Mod-f` comes from a new **`search` toolbar command** rather than
`searchKeymap`'s own binding, so the same path that binds `Mod-b` / `Mod-k` on
every surface (`markdownKeymap`, built from each command's `keys`) also binds
`Mod-f` — the panel opens whether or not the visible toolbar is mounted. The
command's `run` is just `openSearchPanel(view)`; focus lands in the panel field,
so unlike `save` / `undo` it does not call `view.focus()` afterward.

Because it all lives in `baseExtensions`, `source`, the `split` source pane, and
the `in-place` canvas get find / replace from one place. `preview` renders
through `react-markdown` with no CodeMirror surface, so it is untouched — no
guard needed.

## The `search` command id

Added to `BUILTIN_COMMANDS` next to `save`, with the same **opt-in** treatment:
not in `DEFAULT_TOOLBAR_ITEMS`, so a consumer adds `"search"` to `toolbar.items`
to get a button. No `isActive` (a panel being open is not a document state) and
no `disabled` (search is always valid). A magnifier glyph joins `ICON_PATHS` /
`DEFAULT_ICONS`.

## Styling

CodeMirror's default search panel ships gradient `.cm-button`s and a bare
textfield. `styloTheme` ([`src/editor/theme.ts`](../../../src/editor/theme.ts))
overrides `.cm-panels`, the panel itself, its fields / buttons, and the
`.cm-searchMatch` / `.cm-searchMatch-selected` highlights — all from
`--stylo-*` tokens, so the panel tracks the host palette in light and dark
like the rest of the chrome. The panel background uses
`--stylo-surface-floating` (the token added the same week), so it stays opaque
if the host sets `--stylo-bg: transparent`. See "One-line layout, then owning
the panel" below for how the panel itself (not just its colors) changed.

## One-line layout, then owning the panel

Sympose asked for the panel to fold into the toolbar as one row instead of
sitting underneath it as a separate floating card. The first cut restyled
`@codemirror/search`'s own fixed markup from the outside: flex `order` on
each field/button to repaint the two-row default as one line, borderless
buttons to match `.toolbarButton`, and a capture-phase `keydown`/`click`
interceptor on `view.dom` to play a slide-shut animation before the library
removed its panel synchronously (it offers no lifecycle hook to animate
first). That shipped as an internal commit tagged `v0.10.0` — real, but never
published — and came with a known ceiling: `order` only reorders paint, so
Tab still followed the library's own field order (find, next, prev, all,
the checkboxes, then replace) regardless of the new visual layout.

`@codemirror/search`'s `search()` config takes a `createPanel(view): Panel`
option — a first-class way to supply your own panel instead of restyling the
built-in one, confirmed against the installed package's own type
declarations and default implementation rather than assumed from memory.
The panel was rebuilt on that hook instead:
[`search-panel-dom.ts`](../../../src/editor/search-panel-dom.ts) builds the
row directly in reading order (find, next/prev/all, replace, replace/replace
all, the three checkboxes, close), and
[`search-panel.ts`](../../../src/editor/search-panel.ts) wires it to
`getSearchQuery` / `setSearchQuery` and the package's exported commands
(`findNext`, `replaceAll`, …), with `runScopeHandlers(view, event,
"search-panel")` carrying in-panel shortcuts (`F3`, `Mod-g`, `Mod-d`) the
same way the library's own panel does — those fields sit outside
`contentDOM`, so the editor's normal keymap handling never sees keydowns
that land there. Owning the DOM removes the Tab-order ceiling outright
(construction order _is_ reading order now), and the close animation is a
plain listener on stylo's own close button / `Escape` handler instead of an
interception of the library's.

`v0.10.0`'s tag and changelog entry were left describing the CSS-`order`
version, since nothing had published or consumed it before this replaced it;
the finished panel shipped as `v0.10.1` instead.

## Dependency

`@codemirror/search` is a regular `dependency`, not a tenth peer — see the
[ADR-002 §2 amendment](../../decisions/002-editor-ux-and-customization.md) for
the reasoning (ADR-008's peer rule is about the CodeMirror core's weight and
shared `EditorState` identity; neither applies here). The build's
`/^@codemirror\//` external rule still catches it, so the bundle is unchanged
(`check:size` green) and npm dedupe resolves it against the host's single
CodeMirror copy.

## Files

- `src/editor/extensions.ts` — `search` (with `createPanel`) + `searchKeymap`
  in `baseExtensions`.
- `src/editor/search-panel.ts` — the custom `createPanel` factory, query-state
  wiring, and the toolbar's `toggleSearchPanel`.
- `src/editor/search-panel-dom.ts` — builds the panel's DOM in reading order.
- `src/toolbar/commands.ts` — the `search` command (`toggleSearchPanel`, `Mod-f`).
- `src/toolbar/icon-paths.ts`, `src/toolbar/icons.tsx` — magnifier glyph.
- `src/types.ts` — `"search"` in `ToolbarCommandId`.
- `src/editor/theme.ts` — search-panel and match-highlight styling.
- `test/search.test.tsx` — panel opens on `Mod-f` (source and in-place),
  `findNext` walks matches, `replaceAll` rewrites, `preview` is inert, and the
  panel's fields sit in reading order (Tab-order regression guard).
- `package.json` — `@codemirror/search` dependency.

## Log

- 2026-09-10 — find / replace landed across `source` / `split` / `in-place`;
  opt-in `search` toolbar id; panel restyled to the token set. `typecheck`,
  `test` (351 / 351), `build`, `check:size` (8 / 8), `check:theme` all green.
  Panel visuals still want a real-Chrome look against the token overrides.
- 2026-09-12 — folded the panel into the toolbar as one borderless row via
  CSS `order`, plus a capture-phase close animation. Shipped internally as
  `v0.10.0`; never published.
- 2026-09-12 — rebuilt the panel on `search()`'s `createPanel` hook so it
  owns its DOM in reading order, fixing the Tab-order gap the CSS version
  couldn't close; closing now runs off a plain listener instead of a
  capture-phase interception. `typecheck`, `build`, `test` (434 / 434) green;
  checked against a live Chromium session on the dev playground (layout,
  match highlighting, next/prev/replace/replace-all, Tab order, and the
  close animation). Shipped as `v0.10.1`.
