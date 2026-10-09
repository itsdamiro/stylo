---
title: "Tracker — making Stylo dependable for downstream projects"
created: 2026-09-11
type: journal
parent: index
tags:
  - stylo/journal
  - engineering/milestone
---

# Tracker — making Stylo dependable for downstream projects

Goal: close every open thread a project **consuming** Stylo could hit, plus the deferred feature gaps, so Stylo can be a stable dependency across more than one codebase. Not a 1.0 polish pass — a "nothing here bites a consumer or surprises a maintainer" pass.

## Audit result (2026-09-11)

Fresh-install check: `npm pack` → install the tarball into a new Vite + React 18 app → `tsc` (against the published `.d.ts`, `moduleResolution: bundler`) → `vite build`. All clean. Real-Chrome smoke of every surface (`in-place` / `source` / `preview` / `split`, incl. math, editable tables, embeds, dark theme): renders correctly, no console or page errors, edit interactions work.

**No blockers.** Packaging, the type surface, and the runtime are sound. The work below is completion and hardening.

## Dependencies

**No item adds a runtime or peer dependency.** The zero-bloat rule (ADR-gated new deps, `CONTRIBUTING.md`) is not triggered. The only `package.json` change in the whole list is item 5, and it is `devDependencies` only — a second `@types/react` line used by a CI type-check, nothing shipped.

## Worklist — smallest to largest

Each item is its own branch + PR, same cadence as the toolbar-customizer and wikilink-autocomplete increments. Check items off here as they land.

### 1 — Document the ESM-only constraint · size XS · deps: none

**Done** — #27.

`package.json` `exports` has no `require` condition: Stylo is ESM-only and needs a bundler (Vite, Next, …). Say so plainly in the README, and put the minimum React version and the two CSS imports (`styles.css`, `katex.css`) in one place in `docs/wiki/guides/integration.md`.

### 2 — Integration-guide accuracy pass · size S · deps: none

**Done** — #28. Main fix: the "props read at mount" list was two, is three (`wikiLinkSource` too), plus `embedSource` on the canvas.

Re-read `docs/wiki/guides/integration.md` end to end against the current prop set — embeds on all three surfaces, `wikiLinkSource`, the `@damiro/stylo/toolbar-settings` secondary entry — and fix drift. Pairs naturally with item 1.

### 3 — `ref`-keyed embed memo · size S · deps: none

**Done.** `src/render/embed-cache.ts` — a `WeakMap<EmbedSource, Map<ref, entry>>` shared by `preview` and the canvas through `Embed.tsx`. In-flight promises deduped, rejections not cached, capped at 64 refs per resolver. A settled entry renders on first paint (no loading flash). Behaviour note added to the `EmbedSource` doc and CHANGELOG: content is memoised by `ref`. (Closes the ADR-009 deferred item.)

### 4 — `onResolveError` for `embedSource` / `wikiLinkSource` · size S–M · deps: none

**Done.** `onResolveError?: (error, { source, input }) => void` on `StyloProps`, exported type `ResolveErrorInfo`. Fires on a thrown/rejected resolver only — a `null` return is a valid result. Embed path: `Embed.tsx` reject branch. Wikilink path: try/catch in `wikilinkCompletionSource`. Reactive via a stable wrapper in `Stylo` (embed side) and `useCodeMirror` (wikilink side). No behaviour change when omitted.

### 5 — React 18 type-surface guard · size M · deps: none

**Done, folded into item 6.** The existing `react18` CI job already type-checks Stylo's _source_ against `@types/react@18`; the residual gap — a v19-only type in the _published `.d.ts`_ as consumed through the `exports` map — is closed by item 6's consumer, which pins `@types/react@18` and runs `tsc` with `skipLibCheck: false`. No `package.json` change was needed after all.

### 6 — Packaging smoke in CI · size M · deps: none

**Done.** `scripts/smoke-package.mjs` (`npm run check:package`, new `package` CI job): `npm pack` → install the tarball into a throwaway consumer → `tsc` → `vite build`. The committed consumer fixture is `scripts/consumer/` — it imports every export, renders all four modes, uses the imperative handle, and pins `@types/react@18`. Catches a broken `exports` map, a missing `.d.ts`, an accidental hard dependency, or a React-19-only shipped type. Nothing added to Stylo's own dependencies. Documented in `CONTRIBUTING.md`.

### 7 — Inline `![[…]]` mid-paragraph · size M–L · deps: none

**Done.** `remark-embed` splits text nodes into `<span data-stylo-embed-inline>` for `preview` / `split`; `embedField` emits a non-`block` `EmbedWidget` (`<span>` slot) for a non-lone `![[ref]]` on the canvas; `Embed` gains an `inline` prop that wraps in `<span class="stylo-embed-inline">`. `![[…]]` inside code stays literal; caret-on-line reveals raw source, same as inline math. New hooks `.stylo-embed-inline`, `.cm-inplace-embed-inline`. The host returns phrasing content for these (documented). (Closes the ADR-009 deferred item.)

### 8 — `![[…]]` inside editable table cells · size M–L · deps: none

**Done — resolved as a documented non-goal.** A `![[ref]]` in an in-place table cell renders **literally** (both `TableWidget` and `EditableTableWidget`, via a new `embeds` flag on `renderInline`), not transcluded and not as a `!` + chip. Wiring the imperative table widgets to the React embed registry was judged not worth the coupling; `preview` / `split` transclude in cells normally. `embed.ts` now skips `![[…]]` inside a `Table` node (`inTableContext` in `scan.ts`) — this also fixes a stray overlapping decoration on table lines that item 7 introduced. (Closes the ADR-009 deferred item.)

### 9 — ADR-007 seamless exceptions · size L · deps: none

**Done.** Under `reveal: "never"`, three constructs still showed raw source when the caret was on their line: inline `$…$` math, fenced code, and `---` / `***` rules. Each needed a source-edit affordance that isn't "reveal the markers" — the parallel of the Stage-4 link editor. Touched the decoration core; landed one construct per PR.

**Order (smallest first):**

- **9a — fenced code.** _Done._ The Language field + Remove code block already covered the info string and unwrap, so this was just flipping `nodes.ts` from `caretRevealed` to `revealed`. A body-less block keeps the caret-reveal escape hatch. ADR-007 rollout log, 2026-09-11.
- **9b — `---` / `***` rules.** _Done._ `nodes.ts` flipped to `revealed`; `edit-divider.ts` adds a Backspace/Delete keymap (`removeHiddenRule`) and the menu gains a "Remove divider" row. Both reuse `toggleHorizontalRule`. ADR-007 rollout log, 2026-09-11.
- **9c — inline `$…$` / one-line `$$…$$` math.** _Done._ Full link treatment: a `mathRow` menu field (replacing the old toggle in the canvas Format submenu), click-the-widget-to-edit and a hover tooltip (`math-edit.ts`), both gated by the new `mathAtIn` helper so a multi-line `$$` block (out of scope, unchanged) never matches. `decorate.ts` flipped `scanInlineMath` to `revealed`. ADR-007 rollout log, 2026-09-11.

### 10 — split the files over 200 LOC · size L in aggregate · deps: none

**Done, with one deliberate exception (table-widget.ts).** Not consumer-facing — nobody downstream imports these. Split by responsibility, no behaviour change. Re-surveyed 2026-09-11 after item 9 (`context-menu-actions.ts` in particular grew a lot from the math work) — 11 files over the ceiling, not the original 6. Landed as a full sweep, smallest to largest, 10a on its own branch/PR and 10b–10k together on one (mechanical, low-behaviour-risk reorganisation, reviewed and tested as a batch rather than ten separate review cycles):

- **10a — `toolbar/block.ts`** (was 201). Split into `block.ts` (kept: `selectedLines`, `LinePrefixSpec`/`toggleLinePrefix`/`linePrefixActive` — the generic line-prefix machinery list/quote/task share), `heading.ts` (`toggleHeading`/`clearHeading`), `rule.ts` (`toggleHorizontalRule`/`horizontalRuleActive`), `frontmatter-toggle.ts` (`toggleFrontmatter`/`frontmatterActive`) — one file per block-level construct's toggle command, the pattern `fence.ts` already set for code / math blocks. All four land under 80 LOC.
- **10b — `inplace/selection-bar.ts`** (was 214 → 139). The pure geometry (`selectionBox`, `measureBarPlacement`) split to `selection-bar-position.ts`; the `ViewPlugin` class keeps the wiring.
- **10c — `toolbar/table.ts`** (was 239 → 144). The parsing/position math (`findTable`, `locate`, `resolve`, `cellSourcePos`) split to `table-position.ts`; `table.ts` keeps the editing commands and keymap.
- **10d — `inplace/edit-boundaries.ts`** (was 267 → 163). The construct detection (`wrapAt`, `markersHidden`, the `Wrap` type) split to `wrap-at.ts` — used by `edit-insert-assoc.ts`, `edit-line-prefix.ts`, `edit-divider.ts`, and `menu-plugin.ts` too, not just the Backspace/Delete/arrow keymap that stays here.
- **10e — `inplace/nodes.ts`** (was 291 → 112). The `decorateNode` dispatch and heading/setext handling stay; the inline-mark/link branches moved to `nodes-inline.ts`, the block-level branches (rule, blockquote, list, task, fenced code) to `nodes-blocks.ts`. Each branch's body copied verbatim — only the file it lives in changed.
- **10f — `toolbar/commands.ts`** (was 297 → 173). The context predicates, `ToolbarCommand` type, and the `history`/`wrap`/`heading`/`prefix` factories split to `command-helpers.ts`; `commands.ts` keeps just the `BUILTIN_COMMANDS` registry.
- **10g — `inplace/context-menu.ts`** (was 304 → 199). Row/shell types (`MenuAction`, `MenuField`, …) split to `context-menu-types.ts` (re-exported, so no importer changed); viewport placement and dismiss-wiring split to `context-menu-shell.ts`. `createContextMenu`'s DOM-building closure — tightly coupled to its own mutable `flyout` state — stayed put.
- **10h — `toolbar/inline-ops.ts`** (was 330 → 179). Link / wikilink / underline ops split to `link-ops.ts` / `wikilink-ops.ts` / `underline-ops.ts`, all re-exported from `inline-ops.ts` so the many mixed-import call sites needed no changes. The generic wrap-mark machinery (`wrapOp`, `markedContentAt`, …) stayed.
- **10i — `inplace/theme.ts`** (was 459 → 33). The one `EditorView.theme(...)` call now spreads together `theme-canvas.ts`, `theme-callout.ts`, `theme-table.ts`, `theme-table-gizmos.ts`, `theme-menu.ts`, and `theme-popups.ts` (font tokens shared via `theme-fonts.ts`) — verified no selector key collides across files (spreading two objects with the same top-level key would silently drop one), then confirmed visually in real Chrome (headings, a callout, marks, a rule, a table) alongside the full browser suite.
- **10j — `inplace/table-widget.ts`** (was 467 → 439, still over). **Deliberate exception.** The pure grid-to-DOM rendering (`paintCell`, `renderTableCells`) split to `table-widget-render.ts` and the pure DOM-selection read (`caretInCell`) to `table-widget-caret.ts` — genuine, low-risk wins. The rest of `EditableTableWidget` is one cohesive `WidgetType` subclass whose methods share deeply mutable state (`table`, `rows`, `editing`, `syncing`, `pendingOffset`, `gizmos`) — keyboard navigation, focus/blur sequencing, IME composition, long-press, structural edits. Splitting further would mean turning nearly every private method into a free function taking an explicit "host" object exposing that same mutable state — LOC-shuffling, not a cohesion improvement, and real regression risk in the most interaction-heavy surface in the codebase. `CONTRIBUTING.md` calls 200 lines a hard ceiling, and this knowingly stays over it — flagged here rather than quietly left, so it's a decision on record, not a miss. Revisit if the class actually gets harder to work in, or if a natural seam appears (e.g. the keyboard-navigation state machine outgrows inline handling), not just to satisfy the count.
- **10k — `inplace/context-menu-actions.ts`** (was 522 → 186, the worst offender — tripled from item 9's math-menu work). `linkRow` / `wikiLinkRow` moved to `link-row.ts`; `mathRow` moved into `math-edit.ts` (beside the math click/hover handlers it's already paired with); `dividerRow` moved into `edit-divider.ts` (beside `onHiddenRule`). The generic `toAction`/`actions`/`clipboardRows`/`submenu`/`pushGroup` helpers moved to `context-menu-helpers.ts`. `context-menu-actions.ts` is now pure assembly: `menuRows` and the group builders.
