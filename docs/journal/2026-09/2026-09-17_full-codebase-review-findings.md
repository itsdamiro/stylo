---
title: "Full codebase review — findings and remediation order"
created: 2026-09-17
type: journal
parent: index
tags:
  - stylo/journal
  - engineering/milestone
---

# Full codebase review — findings and remediation order

## Context

No open issues from any downstream consumer, Sympose included, for a while
now — a good point to stop waiting for bug reports and go looking instead.
This is a systematic pass over all of `src/` (105 files, ~10,600 lines),
independent of any pending diff, covering four angles: correctness, reuse and
duplication, single-responsibility/file-size discipline against the
project's own 200-line ceiling, and runtime efficiency. 30 findings came out
of it; several turned out to be different symptoms of the same root cause,
so they're grouped below into 24 pieces of work. Three of the highest-impact
ones were independently re-confirmed by reading the exact code paths named
below before writing this up, rather than taken on faith.

## Summary

| Tier | What it covers                                   | Items                    | Total effort                                         |
| ---- | ------------------------------------------------ | ------------------------ | ---------------------------------------------------- |
| 1    | Independent, single-file, low-risk fixes         | 11                       | Low                                                  |
| 2    | Clusters — same root cause, fix once per cluster | 6 clusters (14 findings) | Medium–High                                          |
| 3    | Isolated but non-trivial fixes                   | 5                        | Medium–High                                          |
| 4    | Structural refactor, no correctness impact       | 1                        | Medium (large surface, low risk if done as a barrel) |
| 5    | Needs a design decision before any code changes  | 1                        | Unscoped until decided                               |

Tiers are ordered by how safe they are to pick up without treading on other
work in this list, not by how loud the bug is. The word-splitting bug in
Tier 3, for instance, is worse than most of Tier 1 — it's just self-contained
enough that it doesn't need sequencing with anything else.

## Tier 1 — Independent fixes, low effort

Each of these touches one file, has no overlap with anything else on this
list, and can be picked up in any order.

1. **`src/Stylo.tsx:56`** — `toolbarRender`, `stickyConfig`, and
   `stickyVisibility` each re-run the same `toolbar && typeof toolbar ===
"object"` guard against the same prop to pull out a different field.
   Compute `toolbarConfig` once and destructure from it; otherwise a future
   fourth field is one more place to forget the guard, and the three can
   already drift on which `toolbar` shapes they honor.

2. **`src/inplace/table-widget.ts:57`** — `current`, a cached copy of
   `trimGrid(this.rows)` used only by `eq()`, is updated by hand at two call
   sites (constructor, `sync()`) while `this.rows` is mutated directly at a
   third (`finish()`) that never touches `current`. Any future edit path
   that mutates `rows` and forgets the follow-up leaves `eq()` comparing
   stale data. Drop the cache and recompute `trimGrid(this.rows)` inline
   inside `eq()`.

3. **`src/render/Embed.tsx:45`** — the rejection handler calls `onError`
   unconditionally, without the `live` guard that protects the sibling
   success handler one line below. A stale in-flight resolve for an embed
   that has since been retargeted or unmounted still reports an error for
   content that is no longer displayed. Add the same `if (live)` guard.

4. **`src/frontmatter.ts:10`** — `frontmatterRange()` trims each line before
   comparing to `---`, but `splitFrontmatter()`'s regex (line 17) anchors on
   a literal `^---` with no whitespace tolerance. A frontmatter fence with
   incidental trailing whitespace (easy to introduce while editing) is
   recognized by the editing surface and silently demoted to plain body text
   by the preview surface reading the same document. Align the two on one
   rule.

5. **`src/render/taskCheckbox.ts:22`** — `findCheckboxOffsets` slices only
   the first 40 characters of the line before matching the checkbox prefix.
   A deeply nested task item, or one with a long ordinal marker, can push
   the actual `[ ]`/`[x]` past that window, so the match silently fails and
   the checkbox renders disabled even though `remark-gfm` parsed it
   correctly. Widen the slice or match against the full prefix.

6. **`src/inplace/wikilinks.ts:20` and `src/inplace/math.ts:81`** —
   `scanWikilinks` and `scanInlineMath` each independently call
   `view.state.doc.sliceString(from, to)` on the identical visible range
   inside `decorate.ts`'s per-range loop, doubling the string-extraction
   cost on every keystroke, selection change, and scroll for no reason.
   Slice once in `buildDecorations` and pass the text into both scans.

7. **`src/toolbar/table.ts:127`** — `tableRealign`'s transaction filter
   matches any transaction tagged `"input"`, which includes IME composition
   updates (`input.type.compose`, `.compose.start`) via `isUserEvent`'s
   prefix match. It then re-serializes the grid and remaps the selection
   mid-composition — rewriting the document and moving the caret out from
   under an in-progress IME composition is a known CodeMirror 6 hazard.
   Exclude compose-tagged transactions from the filter.

8. **`src/inplace/context-menu-helpers.ts:80`** — the context menu's Paste
   action captures `activeTableCell(view)` synchronously, then uses it after
   an unguarded `clipboard.readText()`. If focus moves during the read (a
   clipboard permission prompt, the user clicking elsewhere, or the view
   unmounting), the callback still unconditionally targets the stale `cell`
   or dispatches against a torn-down view. Re-check liveness after the
   await before acting.

9. **`src/inplace/list-guides.ts:55`** — a list item's guide-line range ends
   at the line before its own nested sublist, so any valid CommonMark
   continuation content the item has _after_ that sublist never gets an
   indent-guide decoration, even though it's still part of the same item.
   Extend the range past the nested sublist to the item's actual last line.

10. **`src/inplace/extension.ts:68`** (`caretOffsetInCell`) — resolves a
    click position only when the browser's caret API returns the cell's very
    first child text node; anything else (a click inside `**bold**`, a link,
    or inline math within the cell) falls through to offset 0, snapping the
    caret to the start of the cell instead of where the user clicked. This
    is one symptom of the caret-resolution problem covered as a cluster
    below (Tier 2) — see that entry rather than fixing this file alone.

11. **`src/render/Preview.tsx:157`** (the `components` object is rebuilt
    fresh, with fresh closures, on every render, unlike the memoized
    `remarkPlugins` one line above) — this is one symptom of the
    `Preview.tsx` cluster below (Tier 2); don't fix it in isolation, it
    shares a root cause and a fix with two other findings in the same file.

## Tier 2 — Clustered fixes (shared root cause)

These need to be done as a unit — fixing one finding in a cluster without
the others either leaves the bug half-fixed or immediately re-introduces the
duplication the reuse pass flagged.

### Cluster A — Table-cell caret resolution

- `src/inplace/table-widget-caret.ts:8` (`caretInCell`) and
  `src/inplace/extension.ts:68` (`caretOffsetInCell`, Tier 1 item 10 above)
  both reimplement — narrowly, checking only `cell.firstChild` or a single
  text node — the caret-offset lookup that `src/inplace/table-cell-dom.ts:24-45`
  already does correctly with a `TreeWalker` that handles multiple text
  nodes. `EditableTableWidget` already uses the correct version at
  `table-widget.ts:182` for the focus-in path; the two narrower copies are
  used for `readCaret()` (governing caret restore after every re-serialize,
  and Up/Down row navigation) and for clicks into the read-only table
  widget respectively. Any cell with inline formatting — bold, a link, a
  wikilink, inline math — breaks both narrow copies today: one snaps the
  caret to the end of the cell, the other to its start.
- **Fix once:** point both call sites at the existing `selectionOffsets` /
  `renderedCaretOffset` helpers in `table-cell-dom.ts` instead of
  maintaining two narrower, incorrect copies. No new logic needed — this is
  a reuse fix that happens to close two live bugs.
- **Difficulty:** Medium. Touches three files, but the correct
  implementation already exists and is exercised elsewhere, so this is
  substitution, not new design.

### Cluster B — Line-prefix regex unification

- `src/inplace/edit-line-prefix.ts:30` reimplements its own heading, quote,
  task, and list detection regexes instead of reusing the `LinePrefixSpec`
  definitions (`QUOTE`, `TASK`, `BULLET`, `ORDERED` in
  `src/toolbar/command-helpers.ts:82-94`, and the heading regex in
  `src/toolbar/heading.ts:14`) that the toolbar uses for the same prefixes.
  The two sets have already drifted: `command-helpers.ts:88`'s `ORDERED`
  only matches `1. ` (period), while `edit-line-prefix.ts:44` matches both
  `1.` and `1)`, per actual CommonMark grammar. Concretely: load a document
  with `1) First` / `2) Second` — correct GFM ordered-list syntax — and the
  toolbar's "Numbered list" button shows inactive on it, and pressing it
  inserts a fresh `1. ` in front instead of toggling, producing the
  corrupted line `1. 1) First`. The quote regex disagrees too:
  `edit-line-prefix.ts`'s `/^(?:> ?)+/` doesn't tolerate CommonMark's 0–3
  leading spaces the way the toolbar's quote handling does.
- `src/inplace/edit-line-prefix.ts:48` also hardcodes the Backspace outdent
  step to a maximum of 2 spaces (or 1 for a tab) regardless of the actual
  parent list marker's width. A child item nested under `1. ` (3 columns
  wide) needs 3 spaces of indent to stay nested per CommonMark; outdenting
  by a fixed 2 leaves 1 space, which reparses as a _detached_ top-level
  list rather than stepping out one level as the one-Backspace-per-level
  design intends.
- **Fix once:** define one canonical set of line-prefix matchers (heading,
  quote, task, bullet, ordered — each aware of its own marker width) shared
  by both the toolbar and the in-place canvas, and use each prefix's known
  marker width to compute the outdent step instead of a hardcoded constant.
- **Difficulty:** Medium–high. Touches `command-helpers.ts`,
  `edit-line-prefix.ts`, `heading.ts`, and `block.ts`; needs a test that
  both surfaces agree on `1)`-style lists before calling it done.

### Cluster C — Toolbar commands vs. an active table cell

- `src/toolbar/commands.ts` and `src/toolbar/command-helpers.ts:135,151` —
  block-structure commands (`h1`/`h2`/`h3`, quote, bullet/ordered list, task,
  hr, frontmatter, table-insert) gate on `tableActive` (`table.ts:65`),
  which tests CodeMirror's _model_ selection against pipe-table syntax.
  That model selection is never updated while the user's actual DOM focus
  and typing are inside an editable table cell — the mousedown handler in
  `src/inplace/extension.ts:138-139` deliberately returns `false` (no
  dispatch) for clicks inside `.cm-inplace-table-edit`, and the widget's own
  Tab/Enter/Arrow handling and `table-enter.ts:50-52`'s `focusEdge` never
  move it either. So `tableActive`, and every `isActive`/`run` body that
  reads `view.state.selection`, is checking a stale caret position that can
  point anywhere else in the document (a heading, a previous paragraph)
  while the user is actively editing a cell. Concretely: click into a table
  cell and press a toolbar button — it can mutate an unrelated line
  elsewhere in the document and then yank DOM focus out of the cell via
  `view.focus()`.
- The inline-wrap commands (bold, italic, strike, code, inline math) already
  handle this correctly, via `runInlineInCell(view, …) || toggleX(view)` —
  but that check is hand-copied into five separate command bodies
  (`command-helpers.ts:121`, and four more in `commands.ts`) instead of
  living in one place in the command runner.
- **Fix once:** give the command dispatcher itself an "is the DOM caret
  actually inside an editable table cell" check, and route through
  `runInlineInCell` (or an equivalent block-level handler) from one place —
  this closes the missing-guard bug on the block commands and removes the
  five-way copy-paste in the same change.
- **Difficulty:** High. This is the largest behavioral fix on the list —
  touches `commands.ts`, `command-helpers.ts`, `heading.ts`, `block.ts`, and
  `cell-inline.ts`, and needs a considered answer for commands that don't
  make sense inside a cell at all (e.g. "insert table" while already inside
  one should stay disabled, not silently redirect somewhere odd).

### Cluster D — `inline-md.ts` inline-math regex drift

- `src/inplace/inline-md.ts:41` — the table-cell inline renderer's own
  inline-math rule reimplements the canvas-wide `INLINE_MATH` regex from
  `src/inplace/math.ts:10`, with a narrower boundary guard (excludes only
  digits touching `$`, where the canvas version excludes any word
  character). `price$5$tag` is correctly rejected as math on the canvas but
  would be misparsed as math inside a table cell.
- **Fix once:** export `INLINE_MATH` from `math.ts` and import it in
  `inline-md.ts` instead of hand-copying the pattern.
- **Difficulty:** Low–medium. A regex swap, but confirm there isn't a
  cell-specific reason for the narrower guard before removing it.

### Cluster E — `Preview.tsx`'s inline-render block

Three separate findings point at the same ~90-line region
(`src/render/Preview.tsx:40-90` and `:157-248`):

- The `a`, `div`, and `span` component overrides each repeat the same
  shape — read one `data-*` attribute off `rest`, branch to a special
  render if present, otherwise pass through. A fix applied to one (as
  already happened once, for the embed-source guard) is easy to forget to
  mirror in the others.
- That `components` map, plus its two task-checkbox helper functions
  (`makeToggleHandler`, `enableLeadingCheckbox`), are inlined in
  `Preview.tsx` rather than living with the per-tag renderer modules that
  already exist for this purpose (`CodeBlock.tsx`, `Embed.tsx`, and a
  27-line `taskCheckbox.ts` already holds the checkbox-offset math) —
  pushing `Preview.tsx` to 262 lines, past the project's 200-line ceiling.
- The `components` object itself is a plain object literal rebuilt with
  fresh closures on every render, unlike the memoized `remarkPlugins` one
  line above — and `Preview` re-renders on every keystroke in
  `preview`/`split` mode. Because react-markdown treats a changed component
  identity at the same tree position as a different component type, every
  fenced code block and every `![[embed]]` in the document remounts on
  every keystroke: `CodeBlock` re-runs its highlight effect and flashes
  back to plain text before re-highlighting, and `Embed` discards its
  `useState` and re-runs its resolve effect, for the whole document, not
  just the edited region.
- **Fix once:** extract a `buildPreviewComponents(...)` factory (with the
  repeated `data-*` branch collapsed into one small helper) into its own
  module, move the checkbox-toggle wiring into `taskCheckbox.ts` where its
  sibling math already lives, and wrap the result in `useMemo` the same way
  `remarkPlugins` already is.
- **Difficulty:** Medium. Mechanical extraction, but the checkbox click
  handlers' closures need to keep working correctly once memoized.

### Cluster F — State-field full-document rescans

- `src/inplace/tables.ts:156`, `src/inplace/embed.ts:112`, and
  `src/inplace/math.ts:115` (`blockMathField`) each rebuild their entire
  decoration set from a full-document scan whenever `tr.selection` changes
  — not only on `tr.docChanged`. Concretely: `tables.ts`'s `build()` does an
  unbounded `tree.iterate` with no `from`/`to` (unlike the viewport-scoped
  walk in `decorate.ts`) and reparses every table in the document;
  `embed.ts`'s `buildEmbeds` loops every line of the document checking for
  `![[`; `math.ts`'s `buildBlockMath` calls `state.doc.toString()` — a full
  string materialization — and regex-sweeps it. All three run this on
  _every arrow-key press or click_, not just edits, regardless of whether
  the moved caret is anywhere near a table, embed, or math block.
- **Fix once, same shape in three places:** only rebuild on `tr.docChanged`,
  and derive "is this block currently revealed under the caret" from a
  cheaper, already-available signal instead of re-parsing or re-scanning
  the whole document on every selection change.
- **Difficulty:** Medium. Same pattern three times, but check first that
  none of the three currently rely on the selection-triggered rebuild for
  some other correctness reason (e.g. un-revealing a block when the caret
  leaves it) before narrowing the condition.

## Tier 3 — Isolated, non-trivial fixes

Self-contained (no overlap with the clusters above), but each needs more
than a mechanical edit.

1. **`src/toolbar/inline-ops.ts` (`wrapOp`) and `src/toolbar/inline.ts:14`
   (`toggleWrap`)** — confirmed directly against source. When the selection
   is a collapsed caret sitting inside a word, `wrapOp` falls through to its
   final branch (`inline-ops.ts:124-133`), which inserts the mark at `from`
   and at `to` — the same position — splitting the word instead of wrapping
   it. Pressing Cmd-B with the caret in the middle of "word" (no selection)
   produces `wo****rd`, not `**word**`. This reaches every command built on
   the `wrap()` factory — bold, italic, strikethrough, inline code, inline
   math — both on the canvas and via `runInlineInCell` in table cells.
   `command-helpers.ts:51`'s `nothingToWrap` disabled-check already implies
   the button should act on the word under a bare caret; `toggleLink`,
   `toggleWikiLink`, and `toggleUnderline` in the same file already handle a
   collapsed caret correctly (by inserting placeholder text) — `wrapOp`
   needs the equivalent: expand the collapsed range to the enclosing word
   (via `state.wordAt()`) before wrapping. This is the most severe
   correctness bug on this list and should be treated as higher priority
   than its Tier placement suggests; it's listed here rather than in Tier 1
   only because the fix needs the word-boundary expansion designed
   carefully against the existing unwrap logic in the same function, not
   because it's low-impact.

2. **`src/editor/useCodeMirror.ts:111`** — the effect that pushes the
   controlled `value` prop into the CodeMirror document compares only
   against the view's current live text, with no version or origin guard.
   Two keystrokes typed in quick succession, where the parent's re-render
   for the first hasn't landed yet when the second lands in the live
   document, can cause the (now one-keystroke-stale) incoming `value` prop
   to force-overwrite the document — silently discarding the second
   keystroke. More likely to surface under load from surrounding work on
   the main thread, e.g. a heavy preview or KaTeX re-render triggered by
   the same edit. Needs a small version/origin token on outgoing changes so
   the effect can recognize and skip a prop that's behind the view's own
   state, rather than a purely mechanical fix.

3. **`src/render/remark-wikilink.ts:18`** — confirmed directly against
   source. `WIKILINK_PATTERN` (`src/wikilink.ts:10`) has no exclusion for a
   preceding `!`. `Preview.tsx:141-143` documents, in its own comment, that
   "a bare `![[x]]` renders unchanged otherwise" when `embedSource` isn't
   supplied — but with `remarkEmbed` excluded from the pipeline in that
   case, `remarkWikilink` still runs unconditionally and matches the
   `[[my-note]]` inside `![[my-note]]`, turning it into a literal `!`
   followed by a dead, clickable link. This directly contradicts the
   documented fallback behavior. Needs the exclusion added carefully, since
   `WIKILINK_PATTERN` is also used outside `Preview.tsx` — check every call
   site before changing the shared regex versus scoping the fix to
   `remark-wikilink.ts` alone.

4. **`src/inplace/link-row.ts:49` and `:121`** — `linkRow` and
   `wikiLinkRow` are structurally identical (extract parts at the caret,
   return an Edit/Remove field if found, else fall back to an Add field),
   differing only in the parts-extractor, labels, and insert syntax. They
   already had to be kept in lockstep by hand once (the "swap the whole
   construct rather than nesting" change), and a fix landed in only one is
   one PR away from making `[text](url)` and `[[wikilink]]` editing behave
   inconsistently. Parameterize both into one `linkFieldRow(view, kind)`
   taking a small config object.

5. **`src/inplace/table-widget.ts:237-332`** — the ~95-line keyboard
   navigation block (Tab/Enter/Arrow handling) is still inlined in
   `EditableTableWidget`, pushing the file to 452 lines, even though the
   widget already delegates rendering, caret math, DOM primitives, and grid
   structure to five companion modules following an established pattern
   (`table-widget-render.ts`, `table-widget-caret.ts`,
   `table-cell-dom.ts`, `table-structure.ts`, `table-gizmos.ts`). Extract to
   `table-widget-keys.ts` the same way `table-gizmos.ts` is already
   decoupled via a small callback interface. Do this _after_ Cluster A's
   caret fix lands, so the extraction isn't also carrying the caret bug
   into a new file.

## Tier 4 — Structural refactor, plan separately

- **`src/types.ts`** — 456 lines bundling four unrelated type domains
  (toolbar config, wikilink/tag/embed resolver types, in-place canvas
  config, and the core `StyloProps`/`StyloHandle`) under one file because
  they're all "types." Each domain changes independently today, which is
  exactly the coupling the project's own single-responsibility rule exists
  to prevent. The lowest-risk path is a genuine split into
  `types/toolbar.ts`, `types/sources.ts`, and `types/inplace.ts`, with
  `types.ts` kept as a re-export barrel so nothing importing from it today
  has to change. A hard split without the barrel would touch every file
  that imports from `types.ts` — worth avoiding given there's no
  correctness benefit to doing it that way.
- **Difficulty:** Large in scope, low risk if done as a barrel; no
  correctness impact, so it isn't blocking anything above and can be
  scheduled whenever convenient.

## Tier 5 — Needs a decision before any code changes

- **`src/render/embed-cache.ts:53`** — `resolveEmbed()` caches a
  settled promise per `(source, ref)` pair forever, with no invalidation
  path, no TTL, and no way to bust a single entry (only the 64-entry cap
  eventually evicts it). If the content behind a reference changes while
  the app is open — the exact case this cache exists to make cheap, an
  embed remounting on scroll or a preview/split remount — the stale
  pre-edit content shows indefinitely. This isn't a one-line fix: it needs
  a decision on invalidation strategy first — a host-triggered
  `invalidate(ref)` call, a TTL, or a cache key that includes a
  host-supplied version/timestamp. Flagging as a design question rather
  than prescribing an approach.

## Suggested order

1. Tier 1 items 1–9 (independent, no sequencing constraints — pick up in
   any order, in parallel if convenient).
2. Tier 3 item 1 (`wrapOp` word-splitting) — highest-severity bug on the
   list and fully self-contained; no reason to wait on anything else.
3. Cluster A (table-cell caret resolution) — closes Tier 1 item 10; do it
   before Tier 3 item 5 (`table-widget.ts` keyboard-nav extraction), since
   that extraction touches the same file's caret-handling code.
4. Cluster E (`Preview.tsx`) — closes Tier 1 item 11 in the same pass.
5. Cluster D (`inline-md.ts` regex) — small, no dependencies on the above.
6. Cluster F (state-field rescans) — independent of everything else;
   schedule whenever convenient given it's a performance fix, not a
   correctness one.
7. Cluster B (line-prefix unification) — do before Cluster C, since Cluster
   C's command-dispatch centralization will want to call into whatever the
   canonical line-prefix matchers end up being for block commands.
8. Cluster C (toolbar vs. table cell) — the largest fix on the list;
   sequence last among the clusters so it can build on Cluster B's
   canonical matchers.
9. Tier 3 items 2–4 (`useCodeMirror` race, `remark-wikilink` dead link,
   `link-row` duplication) — independent of everything above, pick up
   whenever.
10. Tier 4 (`types.ts` split) — no urgency, no correctness impact; good
    filler work between other items.
11. Tier 5 (`embed-cache` invalidation) — needs a decision first; raise it
    separately rather than blocking on it here.

## Not flagged

Checked and found solid, so not re-litigated above: wikilink, embed, and
pipe-table-grid parsing are properly centralized and reused across the
in-place canvas, preview, and toolbar; the viewport-scoped decoration walk
in `decorate.ts`/`scan.ts` correctly limits itself to `view.visibleRanges`;
`EditableTableWidget.eq` already skips its expensive comparison when the
widget owns live DOM; `embed-cache.ts` already shares in-flight promises
correctly (the staleness question above is about invalidation, not
duplicate fetching); dependencies in `package.json` are all genuinely used,
with no overlapping libraries; and the multi-touch/long-press handling in
`long-press.ts` and the dual menu listeners in `menu-plugin.ts` /
`table-widget.ts` were traced by hand and don't race.
