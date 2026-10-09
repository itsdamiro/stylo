---
title: "Save hook, imperative ref handle, and a dark palette"
created: 2026-09-04
type: journal
parent: index
tags:
  - stylo/journal
  - engineering/milestone
---

# Save hook, imperative ref handle, and a dark palette

## Context

An external integration review flagged three consumer-facing gaps: no way to hook a save action or `Cmd/Ctrl+S`, no escape hatch to the editor (the internal `onViewChange` was never exposed), and a light-only token set that renders broken on a dark host. All three sit inside ADR-002's "Customization API and Design System" scope, so they are recorded there as amendments (§3, §5, and a new §6).

## What was built

### `onSave` + `Cmd/Ctrl+S`

**`onSave?: (value: string) => void`** on `<Stylo>`. The keymap is added once in `useCodeMirror` at `Prec.high`, so it covers `source`, `in-place`, and `split` without per-surface wiring. `Mod-s` calls `onSave` with the current document and returns `true` (which suppresses the browser's save dialog) **only** when a handler is present; with no `onSave`, the key is left to the browser. The prop is threaded `Stylo → SourceView / InPlaceView / SplitView → useCodeMirror`, each reading it through a ref so a changed handler never rebuilds the view.

Stylo tracks **no dirty state**. `value` is the consumer's, so `dirty = value !== lastSaved` is theirs to compute. A debounced `autoSave` hook stays deferred (ADR-002).

A small `saveHandler` **facet** (`src/editor/save.ts`) carries the wrapped handler into editor state, so the keymap and the toolbar's new **`save` command** (glyph + `BUILTIN_COMMANDS` entry) run one `runSave(view)` path. `save` is **opt-in** — not in `DEFAULT_TOOLBAR_ITEMS` — and its `disabled` predicate reads the facet, so the button greys out until `onSave` is wired. The compartment in `useCodeMirror` only reconfigures when the handler's _presence_ flips, not its identity.

The debounced-autosave pattern is written up in the [auto-save guide](../../wiki/guides/autosave.md) — a `useAutosave` hook over `onChange` that flushes on `visibilitychange` / `pagehide` — rather than added as a prop.

### Imperative handle

`<Stylo>` is now `forwardRef<StyloHandle, StyloProps>`. It already held the live `EditorView` in state (via the internal `onViewChange`), so the handle is a thin `useImperativeHandle` over it:

- `focus()`
- `scrollToHeading(text)` — scans `doc` lines for `/^ {0,3}#{1,6}[ \t]+(.*?)…/`, matches trimmed/case-insensitive, dispatches a selection + `scrollIntoView`, returns `boolean`.
- `insertAtCursor(md)` — `view.state.replaceSelection(md)`.
- `getView()` — the raw `EditorView`; documented as an escape hatch, **not** semver-covered.

Every method is inert in `preview` mode. `StyloHandle` is exported from the barrel.

### Dark palette

`src/styles/tokens.css` keeps the light block on `.stylo` and adds a dark block:

```css
:where(.dark, [data-theme="dark"]) .stylo,
.stylo:where(.dark, [data-theme="dark"]) {
  color-scheme: dark;
  --stylo-bg: #09090b;
  /* …every colour token redefined; One Dark syntax palette… */
}
```

`:where(...)` holds the selector at `.stylo`'s specificity so host overrides still win. Triggered by a `.dark` / `[data-theme="dark"]` ancestor (the `next-themes` / shadcn convention), not `prefers-color-scheme`. `color-scheme` is set on both themes.

The playground grew a light / dark toggle that sets `data-theme` on `<html>`, and its own chrome moved onto `--pg-*` variables so the whole page themes.

## Verification

`typecheck`, **292 Vitest tests** (5 new in `test/imperative.test.tsx` — `Mod-s` fires `onSave` and prevents default, `Mod-s` is inert with no handler, the handle exposes view / insert / heading nav, the handle is inert in `preview`, the `save` button runs `onSave` and disables without a handler), `build`, and `format:check` all pass. No new runtime dependency; `stylo.js` grew ~0.9 kB (the handle), `styles.css` ~0.7 kB (the dark block).

## Follow-ups

- CI guard that fails when a `--stylo-*` colour token has no value in the dark block.
- `autoSave` (debounced, Stylo-owned) — still deferred, now with a [guide](../../wiki/guides/autosave.md).
- `saveStatus` pill and a general custom-toolbar-items API — still deferred.
- `@codemirror/*` as peer dependencies — separate packaging change, still open.
