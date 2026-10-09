---
type: decision
status: accepted
date: 2026-10-04
projects: [stylo]
concepts: [Host integration]
amends: []
supersedes: []
tags: [type/decision, status/accepted, project/stylo, topic/architecture]
---

# 012 — A host `extensions` prop, and gutters a host can show

> **Summary.** A host `extensions` prop passes CodeMirror extensions in through a second compartment, applied on first paint and kept across remounts, and the blanket hiding of gutters is dropped so a host's gutter shows, themed with Stylo's tokens. The only route before was `getView()` plus appended config, which sits outside semver and arrives after mount. Any extension is allowed, including ones that fight Stylo's invariants, and that risk is handled in the docs, not in code.

- **Status:** Accepted — implemented same day.
- **Date:** 2026-10-04
- **Deciders:** damiro, Grace

## Context

A host wanted to draw suggested changes and comment markers inside the open document. Those are CodeMirror decorations, widgets, and a gutter, and the only route was `getView()` plus `StateEffect.appendConfig`: documented as outside semver, applied only after mount (so the first paint has no marks), and lost on every remount. Separately, `theme.ts` set `.cm-gutters { display: none }`. Stylo configures no gutter, so the rule could only hide one a host added.

## Decision

- Add `extensions?: readonly Extension[]` to `StyloProps`. `useCodeMirror` holds a second `Compartment` next to `dynamic`, last in the initial config, and reconfigures it when the array changes (shallow element comparison).
- Thread it through `source`, `in-place`, and `split`'s source pane. `preview` ignores it.
- Drop the unconditional gutter hiding; theme `.cm-gutters` with Stylo's tokens (transparent, muted text, no border).

One generic seam rather than a decoration prop, a gutter prop, and a widget registry, each of which would re-expose a slice of CodeMirror.

## Consequences

- A larger public surface: any extension is allowed, including ones that fight Stylo's invariants. Mitigated in the docs, not in code.
- Hosts must share Stylo's `@codemirror/state` and `@codemirror/view` (already peer dependencies).
- No change for a host that passes nothing.
- Covered by `test/host-extensions.test.tsx`: a mark and a gutter render on each surface, a changed array keeps the selection, an equal array is a no-op.

See [the guide](../wiki/guides/host-extensions.md).
