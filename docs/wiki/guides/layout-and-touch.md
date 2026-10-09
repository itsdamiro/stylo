---
title: "Layout and touch"
created: 2026-09-09
type: wiki-guides
parent: index
tags:
  - stylo/wiki
  - engineering/standard
---

# Layout and touch

Stylo does not impose a page layout. It renders a bordered box that fills the width it is given and, by default, grows to fit its content. Everything about where that box sits, whether it scrolls, and how its chrome behaves follows from the height **you** give it and the surrounding page. This guide covers the three layouts that matter and which toolbar and selection UI fit each, plus the touch-specific behaviour to expect.

## The three layouts

| Layout               | How you set it up                                                              | What scrolls                            | Pinned toolbar                                                  |
| -------------------- | ------------------------------------------------------------------------------ | --------------------------------------- | --------------------------------------------------------------- |
| **Inline** (default) | Drop `<Stylo>` in normal document flow, no height                              | The whole page                          | Needs `toolbar.sticky` (`position: fixed`); see its limitations |
| **Full height**      | A shell at `100dvh` / `overflow: hidden`; give `<Stylo>` a bounded height      | Only the editor pane, internally        | Free — the toolbar is a non-scrolling sibling and never moves   |
| **Bounded box**      | Give `<Stylo>` a fixed `height` (e.g. `480px`) inside an otherwise normal page | The pane internally; the page around it | Pins within the box; the box still travels with the page        |

**Inline** is the least effort and the worst case for pinned chrome — a window-pinned toolbar there is fighting the browser (see [[reference/toolbar|the toolbar reference]] for the iOS Safari caveats).

**Full height** is the layout for a dedicated editor screen or a mobile editor. It is how iA Writer, Bear, and Obsidian mobile are built, and it is where a pinned toolbar is simply correct with no special machinery.

**Bounded box** is the CMS-field or comment-box case — a compromise that gets internal scrolling without taking over the screen.

## The full-height recipe

Stylo already scrolls internally when it has a bounded height: `.stylo` is a flex column whose editor pane is `flex: 1; overflow: auto`. You supply the height and lock the shell.

```css
/* The shell that holds the editor and nothing else that should scroll. */
.editor-shell {
  height: 100dvh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* On iOS Safari `overflow: hidden` on the body is not enough — it keeps
   rubber-banding and collapsing the URL bar. Take the body out of flow. */
@media (pointer: coarse) {
  html,
  body {
    position: fixed;
    inset: 0;
    overflow: hidden;
    overscroll-behavior: none;
  }
}

.editor-shell .stylo {
  flex: 1 1 auto;
  min-height: 0; /* so the flex child can shrink below its content height */
}
```

```tsx
<div className="editor-shell">
  <AppHeader />
  <Stylo value={md} onChange={setMd} />
</div>
```

The editor's own scroll container now owns all vertical scrolling. The formatting toolbar, which sits beside that container rather than inside it, stays put through any scroll without `toolbar.sticky` set at all.

### Applying it only on small screens

There is no breakpoint prop, and there should not be — the breakpoint is a property of your page, not the editor. Gate the shell CSS behind your own media query, or conditionally render the bounded height. Stylo stays layout-agnostic either way.

## Choosing the toolbar per layout

| Layout      | Toolbar                                                                                                   |
| ----------- | --------------------------------------------------------------------------------------------------------- |
| Inline      | Default in-flow bar. Add `toolbar.sticky` only if you accept its scroll-gesture caveat on iOS.            |
| Full height | Default bar — it is already pinned by the layout. `toolbar.sticky: "top"` is redundant here and no worse. |
| Bounded box | Default bar. `toolbar.sticky: "bottom"` if the box is tall enough that reach matters.                     |

For anything that must stay visible **during** an active scroll gesture on iOS Safari, prefer `inPlace.selectionUI: "bar"` over a window-pinned toolbar: it positions against the selection rather than the window and is designed to hide on scroll and return on the next selection.

## Touch behaviour

- **Opening the context menu.** There is no `contextmenu` event on touch, so a **long-press** (about 450 ms, holding roughly still) opens the same menu a right-click would. A tap outside, Escape, or a deliberate scroll dismisses it; an incidental scroll in the moment it opens does not. The long-press can still be fiddly to land on iOS Safari — for a touch-first deployment, `inPlace.selectionUI: "bar"` is the more dependable trigger: it needs no gesture, just a selection.
- **Menu sizing is automatic.** Under `@media (pointer: coarse)` the menu rows and URL input take a wider vertical gutter (~18 px between labels) and the selection bar grows to a 44 px tap target. No prop. Override through the `.cm-inplace-*` classes if you need different sizing.
- **Caret placement is the platform's.** A single tap in the text lands at the nearest word boundary, not mid-word — this is iOS Safari's native behaviour for `contenteditable`. For precise placement, tap and hold to bring up the magnifier. A mouse is unaffected and places the caret exactly.
- **`toolbar.sticky` and active scrolling.** Both `"top"` and `"bottom"` are reliable while the page is at rest and can vanish for the duration of an active scroll gesture on iOS Safari — a browser compositing behaviour, not a Stylo bug. The full-height layout above avoids it entirely by not scrolling the document.

## Quick reference

| You are building…                     | Layout      | Toolbar                      | Selection UI     |
| ------------------------------------- | ----------- | ---------------------------- | ---------------- |
| A blog comment box                    | Bounded box | Default                      | `menu` (default) |
| A CMS body field on a long admin form | Bounded box | Default                      | `menu`           |
| A desktop note-taking app             | Full height | Default                      | `menu` or `bar`  |
| A mobile-first writing app            | Full height | Default (pinned by layout)   | `bar`            |
| A Markdown snippet in a docs page     | Inline      | Default, or `toolbar: false` | `menu`           |
