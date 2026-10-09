---
type: decision
status: accepted
date: 2026-09-01
projects: [stylo]
concepts: [In-place canvas, Host integration]
amends: []
supersedes: []
tags: [type/decision, status/accepted, project/stylo, topic/architecture]
---

# 005 — In-place decoration toggles

> **Summary.** A single grouped `inPlace` prop turns individual decoration types off, so a construct stays plain source, read once from a CodeMirror facet when the editor is built. Hosts need a comment box and a CMS body to differ without forking the canvas. It adds twelve boolean keys to document and test, and a change after mount does not apply.

- **Status:** Accepted — first slice of the customization API foreshadowed in [ADR-002](./002-editor-ux-and-customization.md); builds on the canvas from [ADR-004](./004-in-place-decoration-canvas.md)
- **Date:** 2026-09-01
- **Deciders:** damiro, Grace

## Context

The [in-place canvas](../journal/2026-09/2026-09-01_in-place-canvas.md) renders twelve Markdown constructs live — headings, emphasis, links, wikilinks, math, list bullets, task checkboxes, blockquotes, horizontal rules, fenced code, frontmatter, and tables. Which of those a host actually wants is not universal: a CMS body field may want headings and emphasis but not rendered tables; a comment box may want only emphasis and links; a "raw notes" surface may want the reveal-on-caret behaviour turned off for one noisy construct while keeping the rest.

[ADR-002](./002-editor-ux-and-customization.md) committed the project to a developer customization API but deferred its in-place portion. This ADR settles the **first and smallest slice**: turning individual decoration types off, so the construct stays as plain source in the canvas.

Three questions were open:

1. **Scope.** Toggles only, or also cursor-reveal granularity, frontmatter display mode, and a consumer-supplied decorator hook?
2. **Shape.** Flat props on `<Stylo>`, one grouped config object, or a composable config builder?
3. **Extensibility.** Do consumers get an escape hatch (a declarative decorator hook, or raw CodeMirror extensions) in this pass?

## Decision

### 1. Scope: decoration on/off toggles only

This pass ships **only** per-type enable/disable flags. Explicitly **not** in this slice, each deferred to its own later decision:

- `reveal: "line" | "node"` cursor-reveal granularity ([ADR-004](./004-in-place-decoration-canvas.md) deferred it).
- Frontmatter display mode (`source` / `chip` / `properties`) — the `properties` panel needs YAML parsing, a new dependency, and its own ADR.
- Table rendering options — inline formatting inside cells, style hooks.
- Any consumer-supplied decorator hook or CodeMirror extension pass-through.

### 2. Shape: one grouped `inPlace` prop

```tsx
<Stylo
  value={doc}
  onChange={setDoc}
  inPlace={{
    decorations: { tables: false, frontmatter: false },
  }}
/>
```

`inPlace.decorations` is a flat record of twelve optional booleans, **each defaulting to `true`**:

| Key              | Turns off                                                            |
| ---------------- | -------------------------------------------------------------------- |
| `headings`       | ATX heading sizing and `#` hiding                                    |
| `emphasis`       | bold / italic / strikethrough / inline-code styling                  |
| `links`          | `[text](url)` collapse to the link text                              |
| `wikilinks`      | `[[target\|label]]` collapse to the label                            |
| `math`           | `$…$` and `$$…$$` KaTeX widgets                                      |
| `lists`          | `-` / `*` / `+` bullet-glyph substitution                            |
| `tasks`          | interactive `[ ]` / `[x]` checkboxes                                 |
| `blockquote`     | left-border / muted framing, and `>` hiding off-caret                |
| `horizontalRule` | the rendered `<hr>`                                                  |
| `code`           | inline `` `code` `` styling and the fenced / indented code container |
| `frontmatter`    | the "Properties" chip over the leading YAML                          |
| `tables`         | the rendered `<table>`                                               |

Turning a key off leaves that construct exactly as it renders in `mode="source"` — raw text, no reveal behaviour, nothing atomic.

A single object prop (not flat props, not a builder) keeps the top-level `<Stylo>` surface small while leaving room for `inPlace.reveal`, `inPlace.frontmatter`, and future groups to slot in beside `inPlace.decorations` without another prop.

### 3. Mechanism: a CodeMirror facet read by every producer

The canvas has four decoration producers — the `ViewPlugin`, `blockMathField`, `frontmatterField`, and `tableField`. A single **`Facet`** (`inPlaceConfigFacet`) holds the resolved toggle record. `inPlaceExtension` seeds it from the prop (`inPlaceConfigFacet.of(resolve(inPlace))`); each producer reads `state.facet(inPlaceConfigFacet)` and returns nothing for a construct whose key is `false`.

The three state fields stay module-level singletons — the facet, not a field factory, carries the config — so their identities are stable and the existing test suite (which reads `view.state.field(blockMathField)` directly) is unaffected; with no prop supplied the facet resolves to all-`true` and behaviour is identical to before.

### 4. Applied at construction

`InPlaceView` builds its extension array once, so the config is read when the canvas mounts. Changing `inPlace` on an already-mounted `<Stylo>` has no effect until the editor is recreated (e.g. via a changed React `key`). This matches how the canvas already treats its other options and avoids a live-reconfiguration path for a prop that is set once in practice. Revisit if a real use case for runtime toggling appears.

> **Amended 2026-09-02:** remounting on toggle change (as the playground demo does) surfaced a pre-existing bug in `frontmatterField` — a fresh `EditorState`'s default caret sits at position 0, inside the frontmatter block, so the chip never rendered on the very first frame of any mount (including before this ADR). Fixed: the field now starts folded unconditionally at creation and only reveals in response to an actual selection change, not the construction-time default.

> **Amended 2026-09-04 (config lifecycle):** §4 was written for `inPlace.decorations` alone. The `inPlace` namespace has since grown — `table` (ADR-006), `reveal` (ADR-007), `contextMenu` / `contextMenu.groups`, `selectionUI`, `selectionBarItems`, and the internal `onLinkClick` facet. Every one is seeded into a `Facet` by `inPlaceExtension` at construction and read, never rewritten. §4 now covers **the whole `inPlace` prop**: it is applied when the in-place canvas mounts, and changing it on a live `<Stylo>` does nothing until the component is recreated.
>
> The Sympose integration review asked whether this should become reactive. A `Compartment` + `reconfigure`-on-prop-change path was evaluated and **rejected**, for the same reason the original "Live reconfiguration" alternative was:
>
> - The four decoration producers (`inPlacePlugin`, `blockMathField`, `frontmatterField`, `tableField`) only re-derive their output on `docChanged` / `selectionSet` / `viewportChanged`. A bare `reconfigure` transaction carries none of those, so nothing would actually rebuild without also adding a `startState.facet(F) !== state.facet(F)` guard to all four update paths — new branches on the hottest code in the canvas, to serve a prop that is set once in every known integration.
> - Swapping `table: "source" ↔ "cells"` while a table widget holds an editing caret would tear a focused `contentEditable` cell out of the DOM mid-keystroke. Making that safe is its own body of work.
>
> **The contract:** to apply an `inPlace` change, give `<Stylo>` a React `key` derived from the config so it remounts. This is the same rule that already governs `codeLanguages` and the toolbar keymap — both compiled into the CodeMirror configuration at construction. `value`, `onChange`, the callback props, `readOnly`, `placeholder`, `toolbar`, and `icons` stay fully reactive; only the two CodeMirror-extension inputs (`inPlace`, `codeLanguages`) are mount-time. Revisit if an integration genuinely needs to toggle one of these at runtime — the guarded-`reconfigure` design above is the starting point.

## Consequences

**Positive**

- Hosts tailor the canvas to the field without forking or re-implementing it.
- No new dependency, no new public concept beyond one object prop.
- The facet is read at build time only; no per-keystroke cost.
- `mode="source"` and the no-prop default are byte-for-byte unchanged.
- `inPlace` is a namespace: later customization groups extend it, they don't add sibling props.

**Negative / costs**

- Twelve boolean keys are twelve things to document, test, and keep working as the canvas grows. Mitigated by every key mapping to one already-isolated producer branch.
- Construction-time application is a mild surprise for anyone expecting live prop reactivity; documented in the prop reference.
- Interacting toggles (`tasks: false` with `lists: true` on a `- [ ]` row) need deliberate handling in the list branch so a disabled task still falls all the way back to source.

## Alternatives rejected

- **Flat props on `<Stylo>`** (`inPlaceHeadings={false}`, …). Twelve-plus new top-level props now, more as reveal mode and frontmatter mode land. A single `inPlace` object namespaces the whole area.
- **A composable config builder** (`createInPlaceConfig({...})`). Extra ceremony and an opaque value to pass, for a config that is a plain record of booleans. Reconsider only if config assembly ever needs to be tree-shaken or composed from fragments.
- **A consumer decorator hook in this pass.** Defining "add your own in-place decoration" is the highest lock-in risk in the customization API; getting the contract wrong is expensive to walk back. It gets its own ADR once concrete use cases exist.
- **Field factories instead of a facet.** Making `blockMathField` &c. functions of the config would break their singleton identity, forcing the test suite and any future direct consumers to thread instances around. The facet gives the same result with stable identities.
- **Live reconfiguration on prop change.** A compartment-swap path for a prop that is set once adds moving parts for no proven need.
