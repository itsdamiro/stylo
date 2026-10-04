---
title: "Extending Stylo with CodeMirror extensions"
created: 2026-10-04
type: wiki-guides
parent: index
tags:
  - stylo
  - guides
  - extensibility
  - standard
---

# Extending Stylo with CodeMirror extensions

Anything you want to draw in the document or its margin is a CodeMirror 6
extension: a tracked-change overlay, comment highlights with a margin marker,
lint squiggles, remote cursors, a word-count widget, a keymap. Stylo is already
CodeMirror 6, so the `extensions` prop hands those straight to the editor.

```tsx
const extensions = useMemo(() => [reviewMarks, commentGutter], [])

<Stylo value={doc} onChange={setDoc} extensions={extensions} />
```

## What you get

- **Every editing surface.** `source`, `in-place`, and the source pane of
  `split`. `preview` has no editor, so the prop does nothing there.
- **Appended last**, after Stylo's own extensions, from the first paint.
- **Reactive.** Change the array and the live view is reconfigured through a
  compartment: no remount, and the cursor, undo history, and scroll position
  stay put. Add and remove marks at runtime this way.
- **Gutters show.** Stylo configures no gutter of its own, so a `gutter()` you
  add is visible, transparent, and coloured with `--stylo-text-muted`. With no
  host gutter the editor looks exactly as it did.

## Identity

The array is compared element by element, not deeply. Build it with `useMemo`
(or at module level) so an unchanged set does not reconfigure the view on every
render. A new extension instance, even an identical one, is a change.

## Share Stylo's CodeMirror

`@codemirror/state` and `@codemirror/view` are peer dependencies of Stylo. Your
extensions must import them from the same copies, or you get confusing failures
(`instanceof` checks and facets silently disagree). Keep a single version in
your tree.

## On the in-place canvas

The in-place view hides Markdown markers with replacing decorations and
`atomicRanges`. Your decorations share that document, so:

- Prefer **mark** and **line** decorations over replace decorations.
- Put widgets at the **end of a visible range**, not against a hidden marker.
- Stylo's behaviour with an extension that fights its own (replacing the keymap,
  removing an atomic range) is undefined. Extensions are appended, not
  sandboxed.

## Versus `getView()`

`getView()` stays as an escape hatch, but it is not covered by semver, an
extension added through it appears only after mount, and it is lost on a
remount. Prefer the prop.
