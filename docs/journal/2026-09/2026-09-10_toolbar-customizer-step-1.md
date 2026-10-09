---
title: "Toolbar customizer — step 1, the keyboard-only core"
created: 2026-09-10
type: journal
parent: index
tags:
  - stylo/journal
  - engineering/milestone
---

# Toolbar customizer — step 1, the keyboard-only core

The first of the two build stages from [the customizer design note](./2026-09-10_toolbar-customizer-design.md): `<StyloToolbarSettings />` as a fully usable, **dependency-free**, keyboard-first component. Step 2 (pointer / touch drag over the same state, via `@dnd-kit`) is untouched.

## The component

`@damiro/stylo/toolbar-settings` — a separate entry point, exported apart from the main barrel so step 2's dependency never reaches a plain `@damiro/stylo` import.

```tsx
import { StyloToolbarSettings } from "@damiro/stylo/toolbar-settings"

const [items, setItems] = useState(DEFAULT_TOOLBAR_ITEMS)

<StyloToolbarSettings value={items} onChange={setItems} />
<Stylo toolbar={{ items }} value={doc} onChange={setDoc} />
```

Controlled, exactly as the design note settled: `value` is the same `ToolbarItem[]` the editor takes, `onChange` fires on every edit, the host owns persistence. The component holds no state beyond the live-region string.

Two lists:

- **On the bar** — the current `items`. Each row reorders with its ↑ / ↓ buttons or, when focused, the Arrow keys; a ✕ sends it to Available. Below: **Add separator** and **Reset to default**.
- **Available** — every palette item (default: all built-in ids) not already on the bar, each with an **Add** button that appends it.

An `aria-live="polite"` region announces every change ("Bold moved to position 3 of 9", "Link removed from the bar"). Focus follows a moved or added row across the re-render via a `focusAfter` ref checked in an effect. This is the whole accessibility story — a keyboard user can do everything. Step 2 only adds a pointer affordance on top.

An optional `available` prop scopes the palette — pass a list to add `ToolbarCustomItem`s or to hold some built-ins back. `icons` mirrors `<Stylo icons>` for glyph overrides.

## `src/toolbar/labels.ts`

The customizer needs a button's _name_, not its behaviour. `commands.ts` owns behaviour and imports CodeMirror to do it, so importing `BUILTIN_BY_ID` there would drag the editor into the customizer chunk (and imply a phantom CodeMirror dependency for a component that has nothing to do with editing). New pure-data module: `BUILTIN_LABELS` (id → title) and `ALL_BUILTIN_IDS`.

Drift risk — a title renamed in `commands.ts` without a matching change here — is covered by `test/toolbar-settings.test.tsx`, which asserts the id sets match and that every `BUILTIN_LABELS[id]` equals the command's own `title`.

## Build changes

Adding a second library entry made Rollup re-partition the first-party chunks:

- `vite.config.ts` — `lib.entry` is now an object (`stylo`, `toolbar-settings`); output names come from the keys, so `package.json` `exports["."]` → `./dist/stylo.js` is unchanged and `exports["./toolbar-settings"]` is added.
- The old single `icon-paths-*` chunk (toolbar glyphs + the CodeMirror editor glue, bundled together) split into `config-*` (~1.6&nbsp;kB gzip — glyphs, labels, item config, shared by the bar and the customizer) and `useCodeMirror-*` (~9.4&nbsp;kB gzip — the editor glue). `stylo.js` got _smaller_ (3.4 → 2.9&nbsp;kB gzip) as shared code moved out. Total bytes for a main-entry consumer are within a few hundred of before — a re-partition, not growth.
- `scripts/check-bundle-size.mjs` — `icon-paths` budget replaced with `useCodeMirror` + `config`; `toolbar-settings` (~2.1&nbsp;kB gzip) added.

## Files

- `src/toolbar-settings/StyloToolbarSettings.tsx` — the component.
- `src/toolbar-settings/items.ts` — pure array + display helpers (kept out of the component so it stays near the LOC ceiling and the logic is unit-testable).
- `src/toolbar-settings/StyloToolbarSettings.module.css` — tokened styling.
- `src/toolbar-settings/index.ts` — the entry barrel.
- `src/toolbar/labels.ts` — `BUILTIN_LABELS`, `ALL_BUILTIN_IDS`.
- `vite.config.ts`, `package.json`, `scripts/check-bundle-size.mjs` — the second-entry wiring.
- `test/toolbar-settings.test.tsx` — tray split, reorder (buttons and keys), add / remove, separator, reset, the live-region message, the labels drift guard.
- `docs/wiki/reference/toolbar-settings.md` — usage.

## Log

- 2026-09-10 — step 1 landed. `typecheck`, `test` (358 / 358), `build`, `check:size` (10 / 10), `check:theme` green. No `package.json` version bump — this is half of one feature; the version is cut when step 2 lands or when step 1 is called the finish line. Not yet eyeballed in real Chrome.
