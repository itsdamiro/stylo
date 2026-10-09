---
title: "readOnly reaches editable table cells too — the same gap, one layer deeper"
created: 2026-09-13
type: journal
parent: index
tags:
  - stylo/journal
  - engineering/milestone
---

# `readOnly` reaches editable table cells too

Follow-up to the [scroll-container / readOnly guards](./2026-09-13_preview-scroll-and-readonly-guards.md) fix, found while thinking ahead about what a switch from `mode="preview"` to `mode="in-place"` `readOnly` would actually expose. That fix closed the right-click menu and the selection bar; `inPlace={{ table: "cells" }}` turned out to have the same problem one layer deeper.

## Why this one is different

The menu and selection bar dispatch through CodeMirror — `view.dispatch(...)` — so checking `view.state.readOnly` at the call site was enough. `table-widget-render.ts` renders each cell as a real DOM element with `contenteditable="true"` set directly (`mkCell`, so the cell itself becomes a focus target for CodeMirror's atomic-range handling). That's a native browser editing region, entirely outside CodeMirror's `EditorState.readOnly` / `EditorView.editable` — no `dispatch()` involved at all for a typed character to land in the document. `readOnly` genuinely couldn't have reached it through the same mechanism as the other two.

## The fix

`tables.ts`'s `build(state)` already branches on `tableEditingFacet` to decide between `EditableTableWidget` (real `contenteditable` cells) and the plain `TableWidget` (static rendered `<table>`, no independent interactivity — the same one `source` mode already uses). Read-only just needed to force that branch:

```ts
const editable = state.facet(tableEditingFacet) === "cells" && !state.readOnly
```

One line. No new gating in `table-widget-render.ts` at all — falling back to the already-correct, already-tested plain widget was simpler and safer than threading `readOnly` down into `mkCell`'s own `contenteditable` attribute.

`tableField`'s `update` also gained a `readOnlyToggled` rebuild trigger, mirroring the one `selection-bar.ts` picked up in the previous fix: a live `readOnly` flip changes which widget `build` picks even with no doc change, so it needed its own trigger alongside the existing `docChanged` / `tr.selection` checks — otherwise an already-mounted editable widget would stay mounted, stale, until some unrelated edit forced a rebuild.

## Not live for anyone yet

`tableEditingFacet` defaults to `"source"`; `table: "cells"` is opt-in, and nothing shipped so far uses it in combination with `readOnly`. Fixed now anyway, while the context and the fix pattern were already loaded, rather than waiting for whoever hits it next to re-discover and re-diagnose the same class of gap a third time.

## Verification

- `npm run format:check`, `npm run check:theme`, `npm run typecheck`, `npm run build`, `npm run check:package` — clean.
- `npm run check:size` — clean, `InPlaceView`'s chunk now at 21,942 / 22,000 B gzip. Worth watching; the next in-place change of any size will likely need the budget bumped.
- `npm run test` — 461 passing (2 new, both in `test/table-interactive.test.tsx` alongside the existing `table: "cells"` coverage): `readOnly` forces the plain table even when `table: "cells"` is requested, and flipping `readOnly` live on an already-mounted editable table swaps it back to plain with no remount.
- `npm run test:browser` — all 30 Playwright specs pass in real Chromium.
