---
title: "preview gets a scroll container; readOnly actually blocks the in-place menu and selection bar"
created: 2026-09-13
type: journal
parent: index
tags:
  - stylo/journal
  - engineering/milestone
---

# `preview`'s scroll container, and a `readOnly` that means it

Two unrelated bugs, both surfaced by the same source: Sympose exercising `mode="preview"` and evaluating `readOnly` as an alternative to it.

## `preview` was missing its scroll container

`.source` and `.inplace` (`stylo.module.css`) both carry `flex: 1 1 auto; min-height: 0; overflow: auto` so they scroll within whatever bounded height a host gives `<Stylo>`. `.preview` had none of the three — in a host with a bounded-height layout (any flex/grid ancestor with `min-height: 0`), its content just grew past `.root`'s bounds and got clipped by `.root`'s own `overflow: hidden`, with nothing in between to catch the overflow instead. Straightforward oversight, not a design choice; fixed by adding the same three properties `.preview` was the only surface missing.

## `readOnly` didn't reach the menu or the selection bar

Traced the actual dispatch path, not just the prop's plumbing: `EditorState.readOnly` (set via `dynamicConfig` in `extensions.ts`, already reactive through a `Compartment`) only gates _DOM-originated_ edits — its input observer checks `state.readOnly` before turning a keypress/paste/IME event into a transaction. It does not block a plain, programmatic `view.dispatch(...)` called from anywhere else in the extension stack. The in-place right-click menu (`menu-plugin.ts`) and the floating selection bar (`selection-bar.ts` / `selection-bar-position.ts`) both call the same `BUILTIN_BY_ID` toolbar commands unconditionally — no `readOnly` check anywhere in either file. The toolbar already does this right (`disabled={readOnly}` on every button); the menu and bar never got the same treatment.

**No new facet needed.** `view.state.readOnly` is CodeMirror's own built-in getter, already live and correct on the exact `EditorState` both plugins already read from (`dynamicConfig`'s compartment and `inPlaceExtension`'s own extensions are combined into one state in `useCodeMirror.ts`). Threading a parallel custom facet (as first proposed) would just be a second value to keep in sync with the one CodeMirror already maintains — cheaper and more correct to read the built-in one directly:

- `menu-plugin.ts` — both entry points (`onContextMenu`'s early return and `openMenuAt`, reached separately from a long-press) now also check `view.state.readOnly`. Skips opening entirely, the same way `contextMenu: false` already does — the browser's own context menu shows instead, not a jarring dead click.
- `selection-bar-position.ts` — `measureBarPlacement` gained the check alongside its existing `menuOpenField` early return (same shape, same "return `null` to hide" convention already there). Every button on the bar dispatches a real edit, so there is nothing left to offer once read-only — hide it entirely, don't disable-in-place.
- `selection-bar.ts` — `update()` gained a `readOnlyToggled` trigger alongside its existing `selectionSet` / `docChanged` / `focusChanged` / `menuToggled` checks, so a live `readOnly` flip (no remount) reschedules a measurement even when it changes none of those — otherwise a bar already showing over a selection made just before `readOnly` turned on would have no trigger to hide it.

## Verification

- `npm run format:check`, `npm run check:theme`, `npm run typecheck`, `npm run build`, `npm run check:size`, `npm run check:package` — clean, no bundle-budget changes needed.
- `npm run test` — 459 passing (4 new): `test/readonly-inplace.test.tsx` (right-click and long-press blocked under `readOnly`, and a live `readOnly` flip via re-render with no remount) and `test/selection-bar-position.test.ts` (a direct unit test of `measureBarPlacement` returning `null` under `readOnly`, sidestepping jsdom's lack of real layout since the check is the function's first early return).
- `npm run test:browser` — all 30 Playwright specs pass in real Chromium, context-menu and selection-bar specs included; this class of change affects pointer/menu interaction jsdom can't fully exercise, so it got the real-browser pass too.
