---
title: "Toolbar customizer — step 2, drag-and-drop (feature complete)"
created: 2026-09-10
type: journal
parent: index
tags:
  - stylo/journal
  - engineering/milestone
---

# Toolbar customizer — step 2, drag-and-drop

The second and final build stage from [the design note](./2026-09-10_toolbar-customizer-design.md). `@dnd-kit` layers pointer and touch reordering onto the keyboard-only core from [step 1](./2026-09-10_toolbar-customizer-step-1.md), over the same `value` / `onChange` state. Cut as **0.4.0**; this closes ADR-002 §2.

## What changed

Each "On the bar" row is now a `<SortableRow>` — a `useSortable` component that must live inside `<SortableContext>`, so it is its own file. It renders a ⠿ drag handle carrying the `@dnd-kit` `attributes` + `listeners`; the row's ✕ button stays outside the handle, so it is independently focusable and clickable.

`StyloToolbarSettings` wraps the bar list in `<DndContext>` + `<SortableContext strategy={verticalListSortingStrategy}>`:

- **`PointerSensor`** with `activationConstraint: { distance: 4 }` — a 4px drag threshold, so a plain click on the ✕ button never starts a drag.
- **`KeyboardSensor`** with `sortableKeyboardCoordinates` — focus the handle, Space to pick up, Arrow keys to move, Space to drop. dnd-kit renders its own `aria-live` announcements; custom strings name the item and target position.
- `onDragEnd` resolves the two index ids and calls the local **`move()`** helper (from step 1's `items.ts`) — the same pure function the step-1 tests already cover, so the drop outcome needs no drag simulation to verify.

The step-1 ↑ / ↓ buttons are gone: the handle plus the keyboard sensor cover reordering, and three action buttons per row plus a handle was too much. ✕ (remove) and Add (from the palette) stay.

## Dependency

`@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` are declared in `peerDependencies` **and** `peerDependenciesMeta` as `optional: true`:

- `npm install @damiro/stylo` alone never warns about them.
- A consumer rendering `<StyloToolbarSettings>` adds the three to their own install (documented in the reference and README) — the same opt-in shape as `@codemirror/language-data` for `codeLanguages`.
- `vite.config.ts` externalises `/^@dnd-kit\//`, so nothing is bundled; `toolbar-settings.js` went 2.1 → 2.6&nbsp;kB gzip (the wiring, not the lib). `check:size` still 10 / 10.

## Styling

`.handle` — a grab-cursor button, `touch-action: none` so a touch-drag does not scroll the page. `.row[data-dragging]` gives the floating sortable clone an opaque `--stylo-surface-floating` background and a shadow so it reads above the list. Everything else stays on the existing `--stylo-*` tokens.

## Verification

`typecheck`, `test` (358 / 358 — the step-1 suite plus a drag-handle presence check and a `move()` unit test), `build`, `check:size` (10 / 10), `check:theme` all green. Rendered in headless Chrome via the playground's new `?tb=custom` deep-link: both lists, a ⠿ handle on every bar row, and dnd-kit's `aria-roledescription="sortable"` live in the DOM. The drag gesture itself (pointer and touch) still wants a real hands-on pass — a static render cannot show it.

## Files

- `src/toolbar-settings/SortableRow.tsx` — new; the sortable row.
- `src/toolbar-settings/StyloToolbarSettings.tsx` — `DndContext` / `SortableContext` wrapper, sensors, `onDragEnd`, announcements; ↑ / ↓ removed.
- `src/toolbar-settings/StyloToolbarSettings.module.css` — `.handle`, `.row[data-dragging]`.
- `package.json` — the three optional `@dnd-kit` peers; version 0.4.0.
- `vite.config.ts` — `/^@dnd-kit\//` externalised.
- `test/toolbar-settings.test.tsx` — handle-presence and `move()` tests replace the step-1 button-reorder tests.
- `playground/main.tsx` — `?tb=` deep-link for testing a toolbar preset.
- CHANGELOG, reference doc, README — the peer-install note.

## Log

- 2026-09-10 — step 2 landed, customizer feature complete, cut 0.4.0. The first npm-registry publish is now unblocked (needs `npm login` and the `@damiro` scope). Drag gesture not yet confirmed on a real pointer / touch device.
