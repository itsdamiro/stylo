---
type: decision
status: accepted
date: 2026-09-12
projects: [stylo]
concepts: [Host integration, In-place canvas]
amends: []
supersedes: []
tags: [type/decision, status/accepted, project/stylo, topic/architecture]
---

# 010 — A canvas header panel, docked under find/replace

> **Summary.** A second top panel, `canvasHeader`, is built with the same `showPanel` mechanism as the search panel and ordered to dock under it, so host content no longer pushes search below a frontmatter card. A host-only fix was ruled out after tracing the DOM. It touches three files for plumbing and leaves the lazy in-place chunk about 108 bytes under its size budget.

- **Status:** Accepted — implemented same day.
- **Date:** 2026-09-12
- **Deciders:** damiro, Grace

## Context

A consumer (Sympose) renders its own content — a frontmatter card — through `toolbar.render`, the existing slot for host chrome. `toolbar.render` wraps content _before_ the whole editing surface, so the card always sits above whatever CodeMirror renders inside `.cm-editor`.

That became a problem once find/replace (0.10.0) landed. The search panel is CodeMirror's own internally managed top panel — nested _inside_ `.cm-editor`, never a sibling of anything `toolbar.render` returns. Opening search always pushes the panel in below the frontmatter card, regardless of scroll position, because the card is host content competing for the same "before the canvas" position search needs. On a note with no frontmatter this already looks right — nothing sits between the toolbar and the canvas, so the search panel (docked at the canvas's own top) lands directly under it.

The request traced the DOM and ruled out a host-only fix: floating the search panel's DOM out of its normal slot (`position: absolute`, height synced via `ResizeObserver`) puts it outside the in-place view's own `overflow: auto` wrapper, which then crops it rather than just hiding scroll. Fixing that means overriding the wrapper's `overflow` too — a second undocumented-internals reach (`.cm-inplace-*` geometry) stacked on the first, for a cosmetic reorder. That is exactly the kind of debt the 0.9.0 upgrade audit flagged as a real cost of reaching into those internals; this would add to it, not pay it down.

There was no seam that lands _inside_ the canvas, after CodeMirror's own top panels and before its scroller — that boundary is internal to CodeMirror's panel system, invisible from `toolbar.render`.

## Decision

A second top panel, `canvasHeader`, built through the same `showPanel` mechanism the search panel already uses (`search-panel.ts`), ordered so it docks _under_ search rather than above it.

- **`CanvasHeaderHost`** (`src/editor/canvas-header-panel.ts`) is a small class, one instance per surface, created where the extension is built (`SourceView`, `InPlaceView`) — never module-global, so two editors on a page don't share a slot. `host.panel` is the panel constructor handed to `showPanel.of(...)`; it builds an empty `<div class="stylo-canvas-header">`, stores it, and notifies. `subscribe` / `getSnapshot` back a `useSyncExternalStore` in the surface component, which portals `canvasHeader({ view })`'s output into the node.
- **Ordering needs no explicit `Prec`.** CM6's `showPanel` facet preserves the order extensions are flattened in (unless a provider wraps itself in `Prec`, which neither the search panel nor this one does). `baseExtensions()` — which installs `search({ createPanel: createStyloSearchPanel })` — is always first in `useCodeMirror`'s extension list; the canvas-header panel is added through the per-surface `extensions` parameter, which is always flattened after it. Search therefore always renders above the canvas header panel, with no coordination between the two files beyond that ordering.
- **One slot, not a registry.** ADR-009's `EmbedRegistry` solves a _many_-slots problem (every `![[ref]]` in view). There is exactly one canvas-header slot per surface, so `CanvasHeaderHost` skips the `Map`, monotonic ids, and `queueMicrotask` coalescing embeds need — it tracks one `dom` reference and notifies on create/destroy.
- **Threaded like other mount-time config.** `canvasHeader` reaches `Stylo → SourceView` / `Stylo → LazyInPlaceView → InPlaceView` / `Stylo → SplitView → SourceView`, read once at mount — the same lifecycle as `inPlace`, `wikiLinkSource`, and `embedSource`. The render function itself is read through a ref, so a new closure each render doesn't rebuild the editor.
- **No default styling.** Unlike the search panel (stylo's own UI, fully styled), the canvas-header panel is a bare container — the host's content is the host's to style. `.stylo-canvas-header` is a stable class for a consumer who needs to target the wrapper itself.
- **`preview` is untouched.** There is no CodeMirror surface there to dock into; `canvasHeader` is simply never called.

### Alternatives rejected

- **Reorder `toolbar.render`'s existing slot.** Already ruled out by the request itself (see Context) — it either can't reach inside `.cm-editor` at all, or it can only by reaching into undocumented `.cm-inplace-*` geometry.
- **Grab `.cm-panels-top` from outside React and insert a sibling node.** Rejected: `PanelGroup.syncDOM` (CM6 internal) removes any child of that container it doesn't recognise as one of its own panels on the next update — a foreign node inserted this way would be torn out the next time any panel state changes.
- **A second `EmbedRegistry`-shaped multi-slot store.** Rejected as more machinery than the problem needs — see "One slot, not a registry" above.

## Consequences

### Positive

- Unblocks the Sympose request without touching `.cm-inplace-*` internals — the debt the 0.9.0 audit flagged stays flat instead of growing.
- Reuses two patterns already proven in this codebase (`createPanel` ordering from 0.10.0, portal-into-CM6-node from ADR-009) instead of inventing a third.
- Uniform across all three CodeMirror surfaces (`source`, `in-place`, `split`'s source pane) — not special-cased to the in-place canvas the way embeds initially were.

### Costs / considerations

- **Three files touched purely for plumbing** (`Stylo.tsx`, `SplitView.tsx`, plus the two surface components) to thread one optional prop through to wherever a surface's `EditorView` is actually constructed.
- **No new dependency** — `showPanel` and `createPortal` are already in use for the search panel and embeds respectively.
- **Bundle cost, measured** (`npm run check:size`, gzip): `stylo.js` +353 B (3.08 kB → 3.43 kB / 4 kB budget), the shared `useCodeMirror` chunk +194 B (11.24 kB → 11.44 kB / 13 kB budget), the lazy `InPlaceView` chunk +169 B (21.72 kB → 21.89 kB / 22 kB budget). The last one leaves only ~108 B of headroom under its current budget — already thin before this change (277 B) from prior in-place work. Flagged for whoever next touches that surface: the budget in `scripts/check-bundle-size.mjs` needs a deliberate bump before it can absorb another feature.

## Rollout log

**Implemented directly, no deferral.** `test/canvas-header.test.tsx` covers: the panel renders on `source`; it receives the live `EditorView`; it docks below the search panel when both are open (asserted via `.cm-panels-top` child order, not just presence); it's available on `in-place` and `split`'s source pane; `preview` never calls it; omitting the prop adds no extra DOM at all (the panel extension is conditional on `canvasHeader` being passed, read once at mount — no wasted node for a consumer not using the feature).
