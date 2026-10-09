---
title: "![[embed]] reaches the in-place canvas — a portal registry"
created: 2026-09-11
type: journal
parent: index
tags:
  - stylo/journal
  - engineering/milestone
---

# `![[embed]]` on the in-place canvas

## Context

`embedSource` shipped in 0.8.0 for `preview` and `split`. The in-place canvas
was left for a separate increment because it is the hard surface: every
construct it renders is built with imperative DOM (`MathWidget` calls
`katex.render`, `EditableTableWidget` hand-assembles a `<table>`), and there was
**no React inside a CodeMirror widget anywhere in the codebase** — by design,
per ADR-001 and ADR-004. But `embedSource` returns arbitrary host React, so
closing the gap meant mounting host React inside a widget. That earned its own
ADR — [ADR-009](../../decisions/009-react-nodes-in-the-in-place-canvas.md).

## Decision

A **portal registry**. The widget stays inert DOM; one React subtree portals the
embed content into every live slot.

- [`src/inplace/embed-registry.ts`](../../../src/inplace/embed-registry.ts) —
  `EmbedRegistry`, a per-canvas store of `{ id, ref, el }` slots with
  `subscribe` / `getSnapshot` for `useSyncExternalStore`. Changes from one
  CodeMirror update are coalesced through a single `queueMicrotask` into one
  React render.
- [`src/inplace/embed.ts`](../../../src/inplace/embed.ts) — `EmbedWidget`
  (`toDOM` returns an empty `<div class="cm-inplace-embed">` and registers it;
  `destroy` unregisters; `eq` compares `ref`) and `embedField`, a whole-document
  `StateField` beside `blockMathField` that block-replaces each off-caret
  lone-line `![[ref]]`. Withheld while the caret is on the line — the block-math
  reveal path.
- [`src/inplace/InPlaceView.tsx`](../../../src/inplace/InPlaceView.tsx) —
  subscribes to the registry and `createPortal`s an `<Embed>` into each slot.
  [`Embed.tsx`](../../../src/render/Embed.tsx) is reused verbatim, so the async
  resolution, the `![[ref]]` pending / rejected / `null` fallbacks, Suspense,
  and error boundaries all carry over from `preview`.
- `embedSource` is threaded `Stylo → LazyInPlaceView → InPlaceView`; the
  registry is handed to the extension (and `embedRegistryFacet` seeded) only
  when the prop is set. Read once at mount, like `wikiLinkSource`.

### Choices

- **A class, not a `StateField`, for the registry.** A field value cannot hold a
  DOM node that only exists once the widget mounts. The decoration set stays a
  field; the slot⇒DOM map is the class.
- **The prop is the gate.** `embedField` and the `scanWikilinks` `!`-yield both
  read `embedRegistryFacet != null`. A consumer without `embedSource` sees no
  change — a lone `![[ref]]` still renders as `!` + a `[[ref]]` chip. The
  unconditional cleanup (no chip on `![[…]]` ever) is a deferred, separately
  noted change.
- **Interactive host content keeps its clicks.** A click inside a resolved
  `.stylo-embed-content` is left to the host. Revealing the raw `![[ref]]` is by
  caret-on-line, or by clicking the slot's own box / a pending or failed embed's
  literal text.
- **`scanWikilinks` yields to `!`.** A one-character lookbehind skips a `[[ref]]`
  immediately preceded by `!` when embeds are active, so the two passes never
  decorate the same span.

### Dependency

None. `createPortal` is from `react-dom`, already a peer dependency. The
in-place chunk grew ~0.8 kB gzip (20.3 kB / 22 kB budget); `<Embed>` split into
its own ~0.8 kB chunk shared with `preview`.

## Consequences

- In-place `![[ref]]` is first-class, matching `preview` — the last surface gap
  for the feature is closed, and the Sympose audit's Stylo-side list stays empty.
- **First standing React ↔ CodeMirror coupling.** The registry is a permanent
  bridge between `embedField` and the React tree. Mitigations are in the ADR:
  portals keyed by a monotonic slot id, `eq` rebuilding the slot on a `ref`
  change rather than mutating it under React.
- Scroll churn re-invokes `embedSource` for an embed scrolled out and back — the
  memo cache is deferred, as the ADR anticipated.
- Tests: `test/embed-registry.test.ts`, `test/inplace-embed.test.tsx`, and
  `test/browser/embed.spec.ts` (portal into the slot, caret reveal, interactive
  content, the no-prop fallback). The fixture gained `?embed=1` and a `?doc=embed`
  document.

### Follow-ups

- Inline `![[…]]` (mid-paragraph) — still the `<div>`-in-`<p>` constraint, on
  both surfaces.
- `![[…]]` inside editable table cells.
- A `ref`-keyed memo so a re-scrolled embed does not re-resolve.
