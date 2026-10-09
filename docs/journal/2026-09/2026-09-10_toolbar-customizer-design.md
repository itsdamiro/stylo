---
title: "Design — the <StyloToolbarSettings /> toolbar customizer"
created: 2026-09-10
type: journal
parent: index
tags:
  - stylo/journal
  - engineering/design
---

# Design — the `<StyloToolbarSettings />` toolbar customizer

A pre-implementation spec for the last deferred item in [ADR-002 §2](../../decisions/002-editor-ux-and-customization.md) — the visual customizer that lets an **end user** (not the integrating developer) rearrange the formatting bar. Nothing here is built yet. The point of writing it down first is the dependency decision: any drag-and-drop worth shipping is either a new dependency or a few hundred lines of accessibility-sensitive code, and the zero-bloat rule wants that argued in the open before a line is written.

This supersedes the original one-line sketch ("drag tools between an _Available_ drawer and _Left_/_Right_ magnetic docks; persist to `localStorage` or hand out via `onSettingsChange`") on two points, both because the shipped v1 toolbar diverged from what that sketch assumed:

- **No left/right docks.** The v1 toolbar is a single ordered `items` list (ADR-002 §2, 2026-09-02 amendment). The customizer edits that one list — a "on the bar" tray and an "available" tray — not two magnetic docks.
- **Controlled, not self-persisting.** `value` / `onChange` over an `items` array, like every other Stylo seam. The host owns persistence. See Q1.

---

## Context

Today the formatting bar is fully configurable **in code**: `toolbar={{ items: [...] }}` takes an ordered list of built-in ids, `"|"` separators, and the developer's own `ToolbarCustomItem` objects. That covers the integrator.

What it does not cover: the _reader_ of a notes app wanting their own toolbar — Obsidian's "Manage toolbar", Notion's `/` menu customization, iA Writer's configurable bar. That is a real product feature for a "power-user vault editor", and it is the one piece of ADR-002 §2 never delivered. It is also, by prior agreement, the feature whose completion gates Stylo's first npm-registry publish.

---

## The shape

A separate, opt-in React component the **host** renders in its own UI (a settings modal, a preferences pane):

```tsx
const [items, setItems] = useState<ToolbarItem[]>(DEFAULT_TOOLBAR_ITEMS)

// in the host's settings screen:
<StyloToolbarSettings value={items} onChange={setItems} />

// wherever the editor lives:
<Stylo toolbar={{ items }} value={doc} onChange={setDoc} />
```

Two trays: **On the bar** (the current `items`, reorderable) and **Available** (everything in the palette not currently on the bar). Drag between and within them; a separator is a draggable chip you can add or remove. `onChange` fires with the new `ToolbarItem[]` on every change. The host persists it and passes it straight back to both components.

---

## Open questions, with a recommendation on each

### Q1. How does it connect to `<Stylo>`?

**Recommendation: a controlled `value` / `onChange` pair over `ToolbarItem[]`. Stylo stores nothing and persists nothing.**

The host holds the `items` array in its own state, writes it wherever its other user preferences go (`localStorage`, a synced settings API, a profile record), and feeds it to `<StyloToolbarSettings>` and `<Stylo>` alike. This is the `value`/`onChange` and `onSave` pattern already established, and it keeps the customizer consistent with ADR-002 §7's state boundaries.

_Rejected: a built-in gear button on the bar that opens a self-contained popover and writes to `localStorage` itself._ It repeats the auto-save mistake (a library running its own persistence), forces a storage-key decision onto every consumer, and cannot cooperate with a host that syncs preferences across devices. The `onSettingsChange` callback from the original sketch is the half-measure version of this — replaced by full `value`/`onChange` control.

### Q2. Drag-and-drop — new dependency, or hand-rolled?

**Recommendation: `@dnd-kit/core` + `@dnd-kit/sortable`, declared as an _optional_ `peerDependency`, used only by the separately-exported customizer.**

`@dnd-kit` is the current standard for React reorder UIs: ~15&nbsp;kB gzipped combined, a `KeyboardSensor` with `sortableKeyboardCoordinates` that gives arrow-key reordering out of the box, a touch/pointer sensor, and drop-animation primitives. The accessible keyboard path — which ADR-002 §2 makes a hard requirement — is the expensive part to build correctly, and dnd-kit ships it.

Declared in `peerDependenciesMeta` as `optional: true`: a consumer importing only `@damiro/stylo` never installs it; a consumer rendering the customizer adds `@dnd-kit/core @dnd-kit/sortable` to their own install, exactly the way `@codemirror/language-data` is opt-in for `codeLanguages` ([ADR-001 amendment](./2026-09-01_drop-codemirror-language-data.md)). The cost is visible and borne only on use.

_Rejected: `react-dnd`._ Heavier, and its HTML5 backend does not fire from touch without a second backend package.

_Rejected: the native `draggable` attribute._ Zero dependency, but mobile browsers do not synthesise HTML5 drag events from touch at all, and it still needs a separate keyboard implementation. The whole sticky-toolbar rollout was about not shipping toolbar UX that breaks on touch.

_Rejected: hand-rolled Pointer Events + a bespoke keyboard/ARIA layer._ A drag placeholder, autoscroll, drop-index math, focus management, and an `aria-live` running commentary is 300–400&nbsp;LOC of accessibility-sensitive code across several files (the &lt;200 LOC ceiling forces a split), reinventing a solved problem. "Compose from primitives" applies here the way it does to CodeMirror — dnd-kit _is_ the primitive. If step 1 of the build order below turns out to be enough, this whole question is moot and no dependency is added.

### Q3. What is customizable?

Reorder built-in buttons; show/hide them (drag between the two trays); add and remove `"|"` separators; reorder and toggle the developer's own `ToolbarCustomItem`s (already first-class in `items`). **Not** customizable: creating new commands, rebinding shortcuts, swapping icons — those stay the developer's job in code.

The developer defines the _palette_; the end user arranges a subset of it. So the component needs an optional `available` prop:

```tsx
<StyloToolbarSettings
  value={items}
  onChange={setItems}
  available={[...ALL_BUILTIN_IDS, myCustomButton]} // defaults to the built-in ids
/>
```

Default `available` is every built-in id. A developer who ships custom buttons, or who wants to keep some built-ins off the menu entirely, passes an explicit list.

### Q4. Persistence

Entirely the host's, as in Q1. Documented as a wiki guide (a `localStorage` round-trip, and a note on a preferences API) the same way [auto-save](../../wiki/guides/autosave.md) is a guide rather than a prop.

### Q5. Accessibility

A keyboard user must be able to do everything a dragging user can: move focus to an item, pick it up (Space/Enter), move it (arrows), drop it, and move items between trays. An `aria-live="polite"` region announces each move ("Bold moved to position 3 of 8"). This is the single biggest reason to take dnd-kit rather than hand-roll (Q2).

### Q6. Styling

CSS Modules + `--stylo-*` tokens, like the rest of the chrome. New surfaces — the two trays, a drag handle, the drop placeholder, the floating drag clone — are tokened; the drag clone uses `--stylo-surface-floating` so it stays opaque over any host background. No new colour tokens anticipated.

### Q7. Packaging

A separate entry point, `@damiro/stylo/toolbar-settings`, added to `exports` in `package.json`. This keeps `@dnd-kit` off the resolution path of a plain `@damiro/stylo` import and keeps the main bundle's `check:size` honest — the customizer chunk is measured on its own.

### Q8. Scope boundary

v1 of the customizer edits the **main formatting bar's `items` only**. The in-place selection bar has its own `selectionBarItems` prop; making that customizable too is a possible follow-up, not part of this.

---

## Consequences

### Positive

- Closes ADR-002 §2 and clears the gate on the first npm publish.
- `search` and every other command id — built-in or custom — drops into the customizer with no per-command work, because it operates on the `items` list, not on the commands.
- The dependency, if taken, touches only consumers who render the customizer.

### Costs

- The first dependency-with-a-real-choice since the CodeMirror peer split (ADR-008). Even isolated and optional, `@dnd-kit` is a maintenance surface (its major versions, React compatibility).
- The largest single UI component in Stylo — its own CSS module, its own test file, an estimated 3–4 source files under the LOC ceiling.
- Two code paths to keep in sync (keyboard reorder and pointer drag over one shared state model), though dnd-kit narrows that.

---

## Recommended build order

1. **Dependency-free core.** The `items`-array editor with the two-tray show/hide model and **keyboard reordering only** — focus an item, move it with arrows, send it between trays. Ships the whole data model, the `available` palette prop, the `aria-live` announcements, and the CSS. Fully usable on its own.
2. **Layer dnd-kit on top** as the pointer/touch affordance over the same state. Purely additive — step 1 already works without it. This is the step that adds the optional peer dependency; if step 1 proves sufficient in playtesting, it can be skipped and the dependency never enters the tree.
3. **Wiki guide** — persistence recipe and the `available` palette pattern.

Staging it this way means the dependency decision is deferred to the last possible moment and made against a working keyboard-only implementation, not in the abstract.

---

## Status

Design only. Not scheduled. When it starts, the ADR-002 §2 "Deferred" bullet moves to an amendment recording what shipped.
