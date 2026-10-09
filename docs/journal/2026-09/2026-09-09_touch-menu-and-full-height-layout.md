---
title: "Touch context menu, and the layout that pins a toolbar for free"
created: 2026-09-09
type: journal
parent: index
tags:
  - stylo/journal
  - engineering/milestone
---

# Touch context menu, and the layout that pins a toolbar for free

## Context

The [sticky-toolbar rollout](../../decisions/002-editor-ux-and-customization.md)
ended by documenting that a window-pinned toolbar can vanish during an active
scroll gesture on iOS Safari and pointing hosts at `inPlace.selectionUI: "bar"`
instead. It also flagged, without resolving, that `toolbar.sticky` only tracks
scrolling of an ancestor it shares with the content underneath it — so a bounded
`<Stylo>` whose editor pane scrolls internally would not be tracked.

A fresh on-device pass this session picked up there, on two fronts: whether a
bounded-height layout is a viable answer to the scroll-gesture problem, and why
the in-place context menu was close to unusable on a real iPhone.

## What was found

**The bounded-height layout works, and needs nothing new.** Lock the shell to
the viewport (`100dvh`, `overflow: hidden`, and on iOS a `position: fixed` body
because `overflow: hidden` alone does not hold there), give `<Stylo>` a bounded
height, and the editor's own scroll container owns all vertical scrolling. The
toolbar — already a non-scrolling flex sibling of that container — stays pinned
with no `position: fixed`, no `document.body` portal, and no
`requestAnimationFrame` watchdog. Confirmed on-device: "the text area scroll
combined with the sticky top is actually usable." The six rounds of machinery
the rollout built exist only for the layout where the whole document scrolls.

**The context menu dismissed itself on open.** `armDismiss` binds a `scroll`
listener the moment the menu appears, and any scroll outside the menu closes it.
On touch, a long-press is one continuous gesture that routinely emits an
incidental scroll in the frames right after the menu opens — iOS's own
long-press handling, a hair of finger drift, a focus-driven viewport shift — so
the menu was gone before the finger lifted. On a mouse right-click there is no
such scroll, which is why it had never shown up.

**The long-press was hard to trigger at all.** Abort `slop` was 10&nbsp;px,
tighter than a fingertip holds for half a second, and iOS Safari's own
long-press callout was left un-suppressed to race the gesture.

**Touch caret placement is imprecise** — a tap lands at a word boundary, not
mid-word. This is iOS Safari's native `contenteditable` behaviour; a mouse is
exact. Left as-is.

## What was built

- **`context-menu.ts`** — `armDismiss` records `armedAt` and `onScroll` ignores
  scrolls for 350&nbsp;ms after the menu opens. A deliberate scroll-away lands
  well after that and dismisses as before.
- **`long-press.ts`** — `slop` 10&nbsp;px → 20&nbsp;px, `delay` 500&nbsp;ms →
  450&nbsp;ms. An on-device retest still found the gesture unreliable on iOS;
  not chased further — `inPlace.selectionUI: "bar"` is the dependable touch
  trigger and the recommended default for a touch-first deployment.
- **`inplace/theme.ts`** — `-webkit-touch-callout: none` on `.cm-content`; a new
  `@media (pointer: coarse)` block sizing the menu rows and URL input to a ~18&nbsp;px
  vertical gutter (no `min-height` — a full 44&nbsp;px row spread the list out
  more than it earned) and the selection bar to a 44&nbsp;px tap target.
  Automatic, because resizing an existing popup changes no layout — the
  deliberate contrast with `toolbar.sticky`, which the rollout kept opt-in
  precisely so a `pointer: coarse` query could not relocate a toolbar the host
  had not asked to move.
- **[Layout and touch](../../wiki/guides/layout-and-touch.md)** — new guide: the
  three page layouts, the full-height recipe, per-layout toolbar and selection
  UI, and the touch behaviour to expect.
- ADR-002 §2 amendment dated 2026-09-09 recording all of the above.

## Verification

`npm run typecheck`, `npm run test` (346 passing, including new cases:
slop-tolerance and drag-abort in `long-press.test.ts`, and the scroll-grace
window in `context-menu.test.tsx`), `npm run format`, `check:theme`,
`check:size` — all green. The scroll containment was also checked directly in
headless Chrome over CDP at an iPhone-sized viewport: with the full-height
layout active the document cannot scroll and the CodeMirror scroller takes the
overflow.

The touch-gesture fixes themselves rest on a reasoned root cause plus unit
coverage; a real-device confirmation from the user is still the final check, as
with every touch change on this component.

## Follow-ups

- Whether `toolbar.sticky` should detect a bounded/scrolling context and skip
  its window-pinning machinery, rather than the host choosing the layout and
  leaving `sticky` unset.
- The playground gained an A/B `page scroll` / `full-height` layout toggle to
  diagnose this; keep or fold in when the layout question is settled.
