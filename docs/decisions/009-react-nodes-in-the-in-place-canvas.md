---
type: decision
status: accepted
date: 2026-09-11
projects: [stylo]
concepts: [Host integration, In-place canvas]
amends: []
supersedes: []
tags: [type/decision, status/accepted, project/stylo, topic/architecture]
---

# 009 — Rendering host React nodes in the in-place canvas

> **Summary.** Host React nodes render in the in-place canvas through a portal registry: the CodeMirror widget is an inert slot, and one React tree owned by `InPlaceView` portals each embed into it, reusing the component `preview` already uses. The canvas was the last surface that showed `![[embed]]` as a bare chip. It adds Stylo's first standing bridge between React and CodeMirror, with a new failure mode if CodeMirror recycles a slot while a portal still targets it.

- **Status:** Accepted — implemented in 0.9.0. Motivated by extending `![[embed]]` (0.8.0, preview / split) to the in-place canvas.
- **Date:** 2026-09-11
- **Deciders:** damiro, Grace

## Context

`![[ref]]` transclusion shipped in 0.8.0 for the `preview` and `split` surfaces. The contract is [`EmbedSource`](../../src/types.ts):

```ts
type EmbedSource = (ref: string) => ReactNode | Promise<ReactNode>
```

Stylo has no vault, so it detects the `![[…]]` and the host returns a React node to render in its place. `preview` is a `react-markdown` pipeline, so dropping a host node in is trivial — [`src/render/Embed.tsx`](../../src/render/Embed.tsx) awaits the promise and renders the result, with the literal `![[ref]]` text as the pending / rejected / `null` fallback.

The **in-place canvas** is the remaining surface. There, `![[ref]]` currently renders as a bare `!` followed by a collapsed `[[ref]]` wikilink chip — the embed syntax is not recognised, only its inner `[[…]]`.

The obstacle is architectural, not incidental:

- Every construct the canvas renders is built with **imperative DOM**. `MathWidget` calls `katex.render`; `EditableTableWidget` hand-assembles a `<table>` and owns it. There is **no React inside a CodeMirror `WidgetType` anywhere in the codebase**, by design — ADR-001 and ADR-004 put CodeMirror at the surface and compose the rest from primitives.
- But `EmbedSource` returns **host React** — an arbitrary `ReactNode`, possibly with its own state, effects, context, and Suspense. Rendering an embed in the canvas means mounting host React inside a CodeMirror widget. Nothing else does this, so the decision earns an ADR rather than a journal entry.
- CodeMirror **recreates widgets aggressively** as the viewport scrolls. A widget's `toDOM` runs often and its `eq()` must be cheap; anything expensive or stateful built in `toDOM` is rebuilt on every scroll pass that crosses it.

## Decision

Render host React into canvas embeds through a **portal registry**: the widget contributes an inert slot element, and a single React subtree owned by `InPlaceView` portals the embed content into every live slot.

### Accepted for the first release

- **The widget is inert DOM.** `EmbedWidget.toDOM()` returns an empty `<div class="cm-inplace-embed" data-stylo-embed-slot="<id>">` — no React, no resolution, cheap to build. `eq()` compares `ref` (and the monotonic slot `id`), so CodeMirror reuses the slot across scrolls and rebuilds it only when the reference changes.
- **A `StateField` is the registry.** `embedSlotsField` holds `{ id, ref, dom }` for every off-caret `![[ref]]` block the decoration pass currently renders. It updates as decorations are recomputed.
- **`InPlaceView` renders the bridge.** It subscribes to `embedSlotsField` (through `useSyncExternalStore` over a tiny view-plugin-backed store) and, for each slot, portals an `<Embed>` into `slot.dom` with `createPortal`. One React tree: [`Embed.tsx`](../../src/render/Embed.tsx) is reused verbatim, so the async path and the `![[ref]]` fallbacks carry over unchanged, and Suspense / error boundaries / context all work.
- **`embedSource` is mount-time canvas config.** Threaded `Stylo → LazyInPlaceView → InPlaceView` and into the extension as a facet, read once when the canvas is constructed — the same lifecycle as `wikiLinkSource` and `codeLanguages` (see the ADR-005 config-lifecycle amendment).
- **Reveal-on-caret, reusing the existing machinery.** An off-caret lone-line `![[ref]]` gets `Decoration.replace({ widget, block: true })`; when the caret is on the line the decoration is withheld and the raw source shows. This is exactly the block-math path (`revealedLines` / `rangeRevealed`).
- **`scanWikilinks` yields to `!` when embeds are active.** A one-character lookbehind: skip a `[[ref]]` immediately preceded by `!` — but only when `embedSource` is set (the pass reads `embedRegistryFacet != null`), so the embed pass and the wikilink pass never both decorate the same span. A consumer not using the feature sees no change: `![[ref]]` still renders as a literal `!` plus a collapsed `[[ref]]` chip, consistent with the opt-in discipline the 0.8.0 work set for `preview`.
- **Gated by `inPlace.decorations.embeds`** (new toggle, default `true`), consistent with ADR-005.

### Deferred (post-v1, additive)

- ~~**Inline `![[…]]`** mid-paragraph~~ Landed after 0.9.0: `remark-embed` splits text nodes into a `<span data-stylo-embed-inline>` for `preview` / `split`; `embedField` emits a non-`block` `EmbedWidget` (a `<span>` slot) for a non-lone `![[ref]]` on the canvas. `Embed` gains an `inline` prop. The host should return phrasing content for these.
- ~~**`![[…]]` inside editable table cells.**~~ Resolved after 0.9.0 as a documented non-goal: on the in-place canvas a `![[ref]]` in a table cell (`TableWidget` / `EditableTableWidget`, both via `renderInline`) renders **literally**, not transcluded — the cell surface is for editing tabular text, and wiring the imperative table widgets to the React embed registry was judged not worth the coupling. `preview` / `split` transclude in cells normally. `embed.ts` skips `![[…]]` inside a `Table` node so the two passes never overlap.
- **The unconditional `scanWikilinks` lookbehind** — skipping `![[ref]]` even when `embedSource` is unset, so a bare `![[ref]]` never renders as a link chip anywhere. A small cleanup, but it is a visible change for consumers not using embeds, so it waits for a deliberate minor-version note rather than riding in on this feature.
- ~~**Memoising resolved nodes across scroll.**~~ Landed after 0.9.0: `src/render/embed-cache.ts`, a `WeakMap<EmbedSource, Map<ref, entry>>` shared by `preview` and the canvas, in-flight promises deduped, rejections not cached, capped at 64 refs per resolver. An embed re-scrolled into view is served from cache with no re-`embedSource` call and no loading flash.
- **A recursion guard** for `embedSource` returning a nested `<Stylo mode="in-place">`. The host's responsibility for now, documented.

### Revisit trigger

Re-evaluate if React ships a first-class "render into detached DOM" primitive that removes the registry plumbing, or if scroll-churn profiling on a large document shows the portal bridge is a bottleneck.

## Consequences

### Positive

- In-place `![[ref]]` becomes first-class, matching `preview` — closing the last surface gap for the feature and not re-opening the "why doesn't in-place match the render?" question ADR-007 is working to close.
- **One React tree.** No per-widget React root lifecycle, no `flushSync`, no island contexts. Error boundaries and Suspense apply to every embed at once.
- `Embed.tsx` stays the single implementation for both pipelines; its fallbacks are tested once.
- The `scanWikilinks` lookbehind fixes a pre-existing rendering glitch as a side effect.

### Costs / considerations

- **First standing React ↔ CodeMirror coupling.** The registry is a permanent bridge between the extension's `StateField` and the React tree; until now the canvas was self-contained DOM. New failure mode: a slot `<div>` recycled by CodeMirror while a portal still targets it. Mitigations: portals keyed by a monotonic slot `id`; drop any portal whose `dom` has detached from the document; `eq()` returns `false` on a `ref` change so CodeMirror rebuilds the slot rather than mutating it under React.
- **Scroll churn.** Each scroll that reveals an embed mounts a portal and — until the deferred cache — re-invokes `embedSource`. Cheap for a synchronous source; a network-backed source should debounce or cache host-side, the same advice `wikiLinkSource` already carries.
- **No new dependency.** `createPortal` comes from `react-dom`, already a peer dependency. The in-place chunk grows by the registry (~1–2 kB), within the `check:size` budget headroom.
- **No new SSR constraint.** The canvas is already client-only (lazy chunk); portals add nothing.
- **Testing.** jsdom can drive the registry (a portal into a detached node works), so the resolution and fallback logic stays in Vitest. The visual and scroll-lifecycle behaviour goes in `test/browser/embed.spec.ts` — the first browser spec for embeds, justified here because it is layout plus widget lifecycle, exactly what the harness exists for.

## Alternatives rejected

- **`createRoot()` per `EmbedWidget`.** `toDOM` creates a React root, `destroy` unmounts it. Simplest to write. Rejected: CodeMirror recreates widgets on every viewport change, so this churns React roots on scroll; each root is an island with no shared context or error boundary; and `createRoot` driven from `toDOM` fights React 18's concurrent scheduler — you either `flushSync` on mount or accept a paint flash. The registry pays one coordination cost instead of a per-widget one.
- **A DOM-only sibling contract for the canvas** — let `embedSource` also return an `HTMLElement` and have the canvas take that path. Rejected: two contracts for one feature, and it degrades the common case (a host returning JSX) on the surface where a rendered view matters most.
- **A placeholder chip only** (`📄 ref`), never the content, click to open it in `preview`. Much less work, no React in the canvas. Rejected: the canvas exists to edit against a rendered view (ADR-004, ADR-007). A chip is a second-class embed and widens the exact gap the seamless-in-place work is narrowing.
- **Serialise the host node to an HTML string and `innerHTML` it.** Rejected: a `ReactNode` is not serialisable without `renderToStaticMarkup`, which pulls `react-dom/server` into the client bundle, strips interactivity and effects, and cannot represent a stateful host component. A non-starter for "return whatever React you want."
- **Defer in-place embeds indefinitely** — leave `![[ref]]` as raw source in the canvas. Rejected as the end state: it is the gap being closed. But noted as the documented fallback — if the portal registry proves too costly in practice, raw-source-in-canvas is the honest degradation, not a broken half-render.

## Rollout log

**0.9.0 — implemented as specified**, with these settlements made during the build:

- **The registry is a small class, not a `StateField`.** `EmbedRegistry` ([`src/inplace/embed-registry.ts`](../../src/inplace/embed-registry.ts)) holds `{ id, ref, el }` per slot with `subscribe` / `getSnapshot` for `useSyncExternalStore`; `EmbedWidget.toDOM` / `destroy` write to it. The decoration set stays a field (`embedField`) beside `blockMathField`, but the slot⇒DOM mapping lives in the class — a `StateField` value cannot hold a DOM node that only exists once the widget mounts. Registry notifications are coalesced through one `queueMicrotask`, so a CodeMirror update that touches several slots is one React render.
- **`embedSource` presence is the gate.** `InPlaceView` passes the registry into the extension only when `embedSource` is set; `embedField` and the `scanWikilinks` `!`-yield both read `embedRegistryFacet != null`. A consumer without the prop sees no change.
- **Interactive host content wins over reveal-on-click.** A click inside a resolved `.stylo-embed-content` is left to the host node. Revealing the raw `![[ref]]` is by caret-on-line, or by clicking the slot's own box / a pending or failed embed's literal text. `.cm-inplace-embed` is in `REVEAL_WIDGET` for that second path.
- **Scroll memoisation** was deferred at 0.9.0 and landed just after — see the struck-through entry under _Deferred_ above (`src/render/embed-cache.ts`).
- Coverage: `test/embed-registry.test.ts` (the class), `test/inplace-embed.test.tsx` (the field — widget off-caret, withheld on-caret, gated by the prop, `!`-yield), `test/browser/embed.spec.ts` (the portal into the slot, caret reveal, interactive content, the no-prop fallback).

**2026-09-12 amendment — "interactive host content wins" hardened.** The original mechanism for that bullet was `extension.ts`'s mousedown handler returning `false` when the click target matched `.closest(".stylo-embed-content")`. That turned out to be fragile: a custom `EditorView.domEventHandlers` hook returning `false` only skips its own logic, not CodeMirror's _built-in_ mousedown handling (registered in the same dispatch list), which still runs its own click-to-place-caret logic on an atomic range regardless. It happened to not visibly fail until `.cm-inplace-embed`'s box model changed (see the 2026-09-12 caret/layout journal entry), at which point it did. Fixed at the source: `Embed.tsx` now calls `stopPropagation()` on `.stylo-embed-content`'s own `mousedown`, the same technique `table-widget.ts` already used for the identical problem — the event never reaches CodeMirror's listener at all, independent of any box-model detail. `extension.ts`'s `.closest()` check is harmless dead weight now (unreachable, since such an event can no longer get there) but left in place rather than expanding this fix's footprint further.
