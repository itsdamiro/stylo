---
title: "Split mode — source and preview side by side"
created: 2026-09-01
type: journal
parent: index
tags:
  - stylo/journal
  - engineering/milestone
---

# Split mode — source and preview side by side

## Context

The [foundation milestone](./2026-09-01_foundation-milestone.md) shipped `source` and `preview` as separate views the consumer toggles between. `split` — both at once, side by side — was the first item on that milestone's "Next" list: the smallest of the remaining modes, and a useful one before the `in-place` decoration canvas.

Nothing new is parsed or stored. `split` is a layout over the two surfaces that already exist; both panes remain a pure function of the same Markdown string.

## What was built

**`SplitView`** — `src/SplitView.tsx`. A two-column grid: `SourceView` on the left, the lazy `Preview` on the right behind the same `Suspense` boundary `preview` mode uses. `Stylo` routes `mode="split"` here; `in-place` is now the only mode that warns and falls back to `source`.

**Shared lazy preview** — `src/render/lazyPreview.ts`. The `lazy(() => import("./Preview"))` wrapper moved out of `Stylo.tsx` into its own module so `Stylo` (preview mode) and `SplitView` reference one lazy component. The build still emits three chunks; `split` adds none.

**View handle** — `useCodeMirror` / `SourceView` gained an optional `onViewChange(view | null)` callback, fired when the `EditorView` is created and on teardown. `SplitView` needs it to reach CodeMirror's scroll element (`view.scrollDOM`); the toolbar work will want the same handle later.

**Scroll sync.** Each pane gets a `scroll` listener. On scroll of one pane the other is set to the same fraction of its own scrollable range (`scrollTop / (scrollHeight − clientHeight)`). A one-frame `syncing` guard (cleared in `requestAnimationFrame`) breaks the A→B→A feedback loop; a zero range is ignored.

**Styling.** `.split` (two-column grid, fills the root) and `.splitPane` (independent `overflow: auto`, divider border) in `stylo.module.css`. `split` expects the Stylo root to have a bounded height — without one, both panes grow and the page scrolls instead. The playground gives its editor `70vh` in this mode.

## Design notes

- **Ratio-based, not line-mapped.** Scroll sync aligns top-to-top and bottom-to-bottom, interpolating in between. A tall block on one side with no counterpart on the other (a long code fence, a wide table) makes the alignment drift mid-scroll. Mapping source lines to rendered elements is the accurate approach and is left for later — it needs position information the render pipeline does not currently expose.
- **No draggable divider.** The split is a fixed 1fr / 1fr. A resize handle is additive and can come with the toolbar work.
- **Desktop layout.** No responsive stacking; `split` on a narrow viewport is two cramped columns. Consumers can fall back to `source` / `preview` toggling on small screens.

## Consequences

- `source`, `preview`, and `split` are all implemented; `in-place` is the only `StyloMode` still stubbed.
- `onViewChange` is an internal seam today (not on `StyloProps`); exposing an editor handle on the public API is a v1 API-design question.
- 17 Vitest tests (two added for `split`); `typecheck`, `build`, and `format:check` green.

## Next

Unchanged from the foundation milestone, minus `split`: the `in-place` decoration canvas, the declarative toolbar, the `codeLanguages` pass-through prop, the v1 public-API pass, and publish automation.
