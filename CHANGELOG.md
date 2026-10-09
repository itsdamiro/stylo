# Changelog

Notable changes to Stylo. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); the project follows
[Semantic Versioning](https://semver.org/) from 1.0.0 onward.

## [Unreleased]

## [0.22.0] - 2026-10-05

### Changed

- **Host marks and widgets also draw on the rendered table of `table: "source"`
  and of a read-only document.** `inPlace.cellMarks` and `inPlace.cellWidgets`
  were drawn only in `table: "cells"`, so on Stylo's default a table not under the
  caret showed nothing. They now paint the static table's cells too, and repaint
  when the host's list changes without a document change. A press on a marked
  word or a host widget stays in the table instead of revealing its source, so
  the host's `click` handler runs.

## [0.21.0] - 2026-10-05

### Added

- **Host widgets inside table cells.** `inPlace.cellWidgets(state)` returns
  `{ pos, toDOM, key, cellClass? }` in document positions, and Stylo draws each
  element inside an editable table cell (`table: "cells"`) after the characters
  that end at `pos`, where a host's `Decoration.widget` cannot reach. The element
  is `contenteditable="false"` and is left out of the cell's text, so its label
  never reaches the Markdown. A press on it does not focus the cell, so a button
  in it receives its `click`. A position in hidden syntax snaps to the nearest
  visible character. A cell repaints only when its widgets' `pos` or `key`
  change, so `key` must change whenever what `toDOM` draws changes. A cell being
  edited shows its raw source with its marks but no widgets; they return when it
  loses focus. `CellWidget` is exported.

## [0.20.1] - 2026-10-05

### Fixed

- **A click on a host-marked word in a table cell now arrives.** Pressing on the
  word focused its cell, which swapped to raw text and removed the pressed
  element, so the browser never sent `click`. When the press lands on a mark,
  the swap now waits until just after the release.

## [0.20.0] - 2026-10-05

### Added

- **Host marks inside table cells.** `inPlace.cellMarks(state)` returns
  `{ from, to, class, attributes?, cellClass? }` in document positions, and
  Stylo draws them on the characters of an editable table cell (`table:
"cells"`), where a host's `Decoration.mark` cannot reach. `cellClass` is added
  to the `<td>` / `<th>` holding them. Syntax (`**`, link targets, `\|`) is
  skipped when mapping; a mark that covers no visible character marks the whole
  cell. Cells repaint when the marks or the document change; a cell being
  edited is repainted when it loses focus. `CellMark` is exported.
- **A selection rectangle for host menu items.** `run(view, { rect })` gets the
  screen `DOMRect` of the selection the menu opened on: a cell's selected text
  (the cell itself with none), or the editor's selection elsewhere.

### Fixed

- The caret and selection offsets of a table cell are read from a DOM range, so
  a selection point between a cell's child nodes maps to the right character.

## [0.19.1] - 2026-10-05

### Fixed

- **Host right-click items in a table cell you did not focus.** A cell menu
  opened without focus moving to the cell (a long-press, a synthetic event) ran
  an item with whatever the editor selection was elsewhere, and counted another
  cell's selection for `when: "selection"`. The menu now treats only the
  focused cell's text as selected; for any other cell the item runs with a caret
  at the start of that cell, and the Format group is not offered.

## [0.19.0] - 2026-10-05

### Added

- **Host items in the right-click menu.** `inPlace.contextMenu.items` adds the
  host's own entries to the in-place menu, the way `toolbar.items` adds buttons.
  An item has an `id`, a `title`, an optional `icon` (stroke-path string or an
  SVG element), `run(view)`, `disabled(state)`, `when` (`"selection"`,
  `"no-selection"`, `"always"`) and `readOnlySafe`. They are a new `host` group,
  first by default and placeable in `groups`, and appear on the canvas, in
  fenced code, the divider menu and table cells (where `run` sees the cell's
  selected text as the state selection). A read-only note opens the menu only
  for a `readOnlySafe` item; otherwise the browser menu shows as before. Unlike
  the rest of `inPlace`, the item list is read each time the menu opens, so a
  re-render's `run` closures apply.

## [0.18.0] - 2026-10-04

### Added

- **Toolbar overflow menu.** `toolbar={{ overflow: "menu" }}` keeps the bar on
  one row and folds the buttons that do not fit into a trailing `⋯` button that
  opens them as a menu (icon, label, disabled state and action kept). The fit
  is re-measured as the bar resizes. `overflowIcon` replaces the glyph, and
  `pinned: true` on a custom item makes it the last to fold. The default,
  `"wrap"`, is unchanged.

## [0.17.0] - 2026-10-04

### Added

- **`extensions` prop: a supported way to add CodeMirror extensions.** Pass a
  list of `Extension`s and they are appended after Stylo's own on `source`,
  `in-place`, and `split`'s source pane (ignored in `preview`). Reactive: a
  changed array reconfigures the live view without a remount, so the cursor,
  undo history, and scroll position survive. Compared shallowly, so pass a
  stable identity. Use it for decorations, widgets, gutters, lint, and
  keymaps instead of appending to `getView()` after mount. See
  [ADR-012](./docs/decisions/012-host-extensions-prop.md).

### Changed

- **A gutter a host adds is now visible.** `.cm-gutters` was hidden
  unconditionally; Stylo configures no gutter of its own, so the rule could
  only hide a host's. It is now transparent with muted text and no border.
  No change when no gutter is added.

## [0.16.0] - 2026-09-17

### Added

- **`invalidateEmbed(ref?)` on the imperative handle.** The embed cache
  (`embedSource` resolutions, shared by `preview` and the in-place canvas)
  never expired an entry on its own — if the content behind a `![[ref]]`
  changed while the editor stayed open, the stale pre-edit render kept
  showing indefinitely. Call `handle.invalidateEmbed("SomeNote")` when you
  know a reference's content changed, or with no argument to clear every
  cached embed for that `embedSource`; an already-rendered embed for the
  dropped ref re-resolves immediately rather than waiting for a remount.
  Works in every mode, including `preview` — it targets the cache, not the
  editor. A no-op without `embedSource` set. See
  [ADR-011](./docs/decisions/011-embed-cache-invalidation.md).

### Fixed

- **Bolding (or any inline mark) with a bare caret mid-word split the word
  instead of wrapping it whole.** Caret between "wo" and "rd" in "word" and
  pressing `Mod-b` produced `wo****rd`; it now expands the caret to its
  enclosing word first, producing `**word**`.
- **A fast second edit could be silently overwritten by a stale `value`
  prop.** If a parent re-rendered with a `value` that was already superseded
  by a newer local edit — which can happen with a controlled `value` under
  React's batching — `useCodeMirror` reapplied the stale prop over the newer
  edit. It now tracks the values it has itself emitted via `onChange` and
  skips reapplying any incoming prop that echoes one already told to the
  host.
- **A bare `![[ref]]` embed (no `embedSource` configured) rendered as a dead
  link instead of literal text.** With no `embedSource`, the embed pass never
  runs, so the wikilink pass right after it saw the inner `[[ref]]` and
  rewrote it into a link — leaving a literal `!` sitting in front of a link
  to nowhere. A `[[ref]]` immediately preceded by `!` is now left untouched,
  matching `![[ref]]`'s documented no-`embedSource` fallback (unchanged
  literal text).

## [0.15.2] - 2026-09-14

### Fixed

- **`preview`'s table never actually stretched past its own content width,
  even when a host set `width: 100%` on it.** `table { display: block; ... }`
  in `Preview.tsx`'s module CSS disabled the `<table>` element's native
  table-layout algorithm — the rendered grid underneath sized itself to
  content, completely disconnected from the outer block box a host's
  `width` was actually resizing. The table now renders inside a
  `.stylo-table-wrap` div, which carries the block/scroll behaviour instead,
  leaving `<table>` at its native `display: table` so a host's width reaches
  the real layout algorithm — the same shape `0.15.1` already gave the
  in-place canvas's table. Verified in a real Chromium that the rendered
  grid (not just the table's own box) now stretches, and that an over-wide
  table still scrolls on the wrapper rather than blowing out its container.

## [0.15.1] - 2026-09-13

### Fixed

- **An in-place editable table stayed inset from its wrapper's full width,
  even when a host stretched the wrapper itself to fill its container.**
  `.cm-inplace-table-wrap` reserved its right-hand gizmo gutter as in-flow
  padding, so the wrap's own `width: 100%` never reached the `<table>` inside
  it — a child's percentage width always resolves against its parent's
  content box, padding excluded. That padding turned out not to be load-
  bearing for the add-column strip's own position (computed live off the
  table's rendered edge in `table-gizmos.ts`), so it's dropped to `0`; the
  bottom padding stays, since it _is_ load-bearing for CodeMirror's line-
  height measurement of the row strip below the table. Verified in a real
  Chromium that the column strip still renders past the table's edge and is
  genuinely hit-testable there, not clipped.

## [0.15.0] - 2026-09-13

### Added

- **`onTaskToggle` prop.** Opt in and `preview` (and `split`'s preview pane)
  task-list checkboxes render clickable instead of `disabled`. Fired with
  `{ start, end, checked }` — raw offsets into `value` bracketing the clicked
  `[ ]` / `[x]` marker and its new state — so a host can splice the marker
  and pass the result to its own `onChange`, the same division of labour
  `onWikiLinkClick` and `embedSource` already use. The offsets come from
  `remark-gfm`'s own parse position for that list item, not a DOM-order/
  regex-scan correlation, which would desync the moment an item's own text
  could be misread as another marker. Off by default: every checkbox stays
  `disabled`, exactly as before, until a host opts in. `preview`-only — `in-
place` and `source` have no rendered checkbox element to click.

## [0.14.0] - 2026-09-13

### Added

- **`softBreaks` prop.** Opt in and a single line ending in `preview` (and
  `split`'s preview pane) becomes a real `<br>` instead of CommonMark's
  default — a blank line required to start a new paragraph, which otherwise
  joins consecutive lines (a callout title and body written the ordinary
  way, for one) into a single run. Obsidian's Live Preview reads this way,
  via the same `remark-breaks` plugin. Off by default: this is a visible
  change to existing rendered output, not a bug fix, so nothing changes for
  a consumer that doesn't pass it. `preview`-only, like `codeLanguages`'s
  asymmetry — `in-place`/`source` have no paragraph-joining behaviour to
  opt out of. Fenced code and table cells are unaffected either way.

## [0.13.6] - 2026-09-13

### Fixed

- **`preview`'s fenced code blocks scrolled horizontally on a long line; the
  in-place canvas wrapped the same line.** `.preview pre` never set
  `white-space`, so it fell back to `<pre>`'s UA default of `pre`, which
  suppresses wrapping regardless of available break points — confirmed live
  against a real document opened in both modes in the same panel. In-place's
  wrap was never a deliberate per-construct choice either: `EditorView.lineWrapping`
  applies to the whole CodeMirror document, prose and fenced code alike.
  `preview` now sets `white-space: pre-wrap` and `overflow-wrap: break-word`
  to match, with `overflow-x: auto` kept as a safety net for an unbroken run
  with no whitespace at all. A new **`--stylo-preview-code-white-space`**
  token (default `pre-wrap`) restores the old horizontal-scroll behaviour for
  anyone who wants it back — set it to `pre`. `preview`-only: in-place has no
  equivalent whole-document toggle to parameterize the same way.

## [0.13.5] - 2026-09-13

### Fixed

- **`readOnly` didn't reach editable table cells either.** `inPlace={{ table:
"cells" }}` renders cells as a native `contenteditable` DOM region, entirely
  outside CodeMirror's own `editable` / `readOnly` control — the same class of
  gap as the right-click menu and selection bar fixed in `0.13.1`, one layer
  deeper. `readOnly` now falls the canvas back to the plain (non-editable)
  table rendering instead, the same one `source` mode already uses, and
  reacts to a live `readOnly` change with no remount. Not triggered by
  anything shipped so far — `table: "cells"` is opt-in and defaults off — but
  closing it now rather than waiting for it to surface downstream.

## [0.13.4] - 2026-09-13

### Fixed

- **`preview` and the in-place canvas each hard-coded their own copy of the
  same six rhythm values, and three had already drifted apart.** `preview`'s
  heading rule never set a `font-size` for h5/h6 at all — a silent fallback to
  the browser's UA default (~0.83em / ~0.67em) instead of the in-place
  canvas's 0.9em; its callout rounded all four corners where the in-place
  canvas's per-line construction can only round two; and its callout padding
  was `0.6em` against in-place's `0.7em`. Both surfaces now read the same
  internal `--stylo-rhythm-*` custom properties (`tokens.css`) for heading
  sizes/line-heights, list-item spacing, and callout padding, instead of each
  authoring its own copy — a value defined once can't silently re-diverge the
  way these had. Not a change to the public token set: these are internal,
  not documented in the styling-tokens reference; a host restyling rhythm
  still overrides the resulting CSS classes directly.
- **The in-place canvas had no list-item spacing at all.** A list item there
  was just one more line at the shared line-height, with nothing like
  preview's `<li>` margin. Every item but the first in its own list now gets
  a small gap above it (`cm-inplace-item-gap`), sourced from the same shared
  value as preview's `<li>` margin.

## [0.13.3] - 2026-09-13

### Fixed

- **Exiting an editable table (`inPlace={{ table: "cells" }}`) downward via
  the arrow keys could land the caret above the table instead of below it**,
  when the table was the last block in the document. The exit dispatched a
  selection at the atomic table decoration's own boundary with nothing past
  it to distinguish "after" from "before" — CodeMirror could resolve that
  position to either side. Fixed by inserting the line the exit actually
  needs first, rather than trusting a boundary position with nothing beyond
  it.
- **`insertTable` left no room to move past a freshly created table.** It
  closed the skeleton with a single newline, so a table landing at the end of
  a document (or right before existing content, with no blank line to
  separate them) had nothing for the caret to move into, or risked the very
  bug above the moment it was created. A blank line now always follows.

## [0.13.1] - 2026-09-13

### Fixed

- **`preview` had no scroll container.** In a host that gives `<Stylo>` a
  bounded height, a note longer than the visible panel was clipped by
  `.root`'s `overflow: hidden` with nothing in between to catch the overflow
  instead — `.preview` was the one surface in `stylo.module.css` missing the
  `flex: 1 1 auto; min-height: 0; overflow: auto` pattern `source` and
  `in-place` already had.
- **`readOnly` didn't stop the in-place canvas's right-click menu or floating
  selection bar from editing.** `EditorState.readOnly` only gates
  DOM-originated input (keyboard/paste/IME); it doesn't block a plain
  programmatic `view.dispatch(...)`, and the menu and selection bar's buttons
  call one unconditionally. Both now check `view.state.readOnly` — the menu
  no longer opens (the browser's own context menu shows instead, same as
  today's `contextMenu: false`), and the selection bar no longer appears —
  and both react to a live `readOnly` change with no remount needed.

## [0.13.0] - 2026-09-13

### Added

- **`preview` (and `split`'s preview pane) syntax-highlight fenced code.**
  Pass the same `codeLanguages` prop already used for `source` / `split` /
  `in-place`; a fence's language resolves the same way and is coloured with
  the same `--stylo-syntax-*` tokens the in-place canvas already reads, so a
  block looks identical read or edited. Opt-in, like `codeLanguages` always
  was — omit it and fenced code stays plain text, today's behaviour. No new
  dependency.

### Changed

- **`preview`'s base typography now tracks `--stylo-font-size`** instead of a
  hardcoded `0.9375rem`. Its whole reading scale (headings, lists, code,
  spacing) is `em`-based off that one value, so a host that has already set
  `--stylo-font-size` for the in-place canvas gets a matching `preview` size
  instead of a second, independently-sized scale. Visual change for any
  consumer that overrides `--stylo-font-size` away from the default — no
  change for anyone still on the default.

## [0.12.0] - 2026-09-13

### Added

- **`tagSource`** — a prop that turns on `#tag` autocomplete on the CodeMirror
  surfaces (`source`, `split`, `in-place`), mirroring `wikiLinkSource`'s
  contract exactly. It takes `(query: string) => TagCompletion[] | Promise<…>`,
  where `TagCompletion` is `{ tag: string }`; the host owns the index and the
  ordering, Stylo owns the trigger and the insert. The trigger only fires on a
  `#` at the start of a line or after whitespace, and never on a `# Heading`
  marker (the space after `#` breaks the match before any heading text is
  typed) or mid-word (`word#word`, a URL fragment); it also skips a `#`
  immediately followed by a digit (`#1234`, an issue or anchor reference).
  Registered alongside the wikilink source through the same Markdown-language
  completion machinery, so it shares the same tooltip and is inert in fenced
  code. Off unless the prop is passed; read once, at mount.

## [0.11.0] - 2026-09-12

### Added

- **`canvasHeader` prop.** Dock host content — a frontmatter card, say —
  inside the editing surface itself, after the find/replace panel and
  before the document body. `toolbar.render` can't reach this seam: it
  wraps content before the whole canvas, while the search panel is
  CodeMirror's own internal top panel. Built on the same `showPanel`
  mechanism as the search panel, ordered to dock under it. Available on
  `source`, `in-place`, and `split`'s source pane; never `preview`.

### Changed

- **The formatting bar wraps by group, not mid-group.** It already wrapped
  onto multiple lines on a narrow host; now each `"|"`-delimited run of
  buttons wraps as one unit, using the grouping a consumer's `items` array
  already expresses — no new config.
- **`search` shows pressed while the find/replace panel is open**, like
  every other toggle button.

### Fixed

- **The caret could land back inside a table when arrowing or tabbing out
  of its last cell**, if the table was followed with no blank line by
  plain text — GFM swallows that line into the table, and the editable
  table widget's own range calculation disagreed with the real parse.
- **Clicking below a `![[ref]]` embed could misplace the caret.** The
  embed's vertical spacing used `margin`, which sits outside the box
  CodeMirror measures for click-to-position — the same bug class fixed for
  every other block. Interactive content inside a resolved embed (a
  button, say) now reliably keeps its own clicks too, through the
  technique the editable table widget already used for the same problem.
- **A self-styled embed card's accent rail could sit apart from the
  card**, if the card had its own margin — it used to collapse straight
  through stylo's wrapper.

## [0.10.1] - 2026-09-12

### Fixed

- **Find/replace panel's Tab order now matches its layout.** 0.10.0's
  single-line panel was still `@codemirror/search`'s default markup
  reordered from outside with CSS `order`, so Tab followed the library's
  internal field order regardless of the new visual layout. The panel is
  now built directly through the `search()` extension's `createPanel` hook
  in the order it reads — find, next/prev/all, replace, replace/replace
  all, then match case/regexp/by word and close — so Tab order matches the
  screen by construction. Closing (the panel's × button and `Escape`) now
  animates via a plain listener on stylo's own elements instead of
  intercepting the library's click/keydown in the capture phase.

## [0.10.0] - 2026-09-12

### Changed

- **Find/replace panel is one toolbar-height row.** `@codemirror/search`'s
  fixed panel markup (find field, next/previous/all, three checkboxes, then
  the replace row) is reordered with flex `order` onto a single line — find,
  next/previous/all, replace, replace/replace all, then match
  case/regexp/by word — with borderless buttons matching the main toolbar's
  own, so it reads as one more row of the toolbar rather than a separate
  floating panel. Tab order still follows the library's underlying DOM
  order, not the new visual layout.
- **The panel slides open and closed.** The toolbar's "search" command now
  toggles the panel instead of only opening it, and both the panel's own ×
  button and `Escape` animate it shut instead of removing it instantly.

## [0.9.1] - 2026-09-11

No code changes — docs and test coverage only.

### Changed

- **README's "Why" section names the actual alternatives** (TipTap, Milkdown,
  BlockNote, Lexical, Toast UI Editor, EasyMDE/SimpleMDE, raw CodeMirror 6) and
  why round-trip fidelity rules each one out, instead of gesturing at
  "ProseMirror/Lexical" generically.
- **`wikiLinkSource` / `embedSource` mount-time docs** now warn against a `key`
  remount when their backing data changes often (a note index, a file tree) —
  it drops cursor position, undo history, and scroll — and show the
  ref-plus-stable-`useCallback` pattern instead. See
  [props · applied at mount](docs/wiki/reference/props.md#config-applied-at-mount).
- **Auto-save guide sketches conflict detection** (a version stamp checked
  before write) as a possible host-layer approach, without adding any API for
  it — persistence policy stays the app's call. See the
  [Auto-save guide](docs/wiki/guides/autosave.md).

### Added

- A permanent Vitest round-trip fixture (`test/round-trip.test.tsx`) —
  frontmatter, both wikilink forms, an embed reference, inline and block math,
  a table, fenced code, a thematic break, and a callout — asserting the live
  document comes back unchanged on both `source` and `in-place` mode. The only
  prior verification for this property was a scratch-and-delete Playwright
  pass.

## [0.9.0] - 2026-09-11

### Added

- **`![[ref]]` transclusion on the in-place canvas.** `embedSource` now resolves
  embeds on all three surfaces, not just `preview` / `split`. An off-caret
  lone-line `![[ref]]` renders as a block: `EmbedWidget` contributes an inert
  slot element, and `InPlaceView` portals the same `<Embed>` component used by
  `preview` into every live slot through a small `EmbedRegistry` +
  `useSyncExternalStore` bridge — one React tree, so the async path, the
  `![[ref]]` fallbacks, Suspense, and error boundaries all carry over. Put the
  caret on the line to reveal the raw source; interactive host content keeps its
  own clicks. New `inPlace={{ decorations: { embeds: false } }}` toggle. On the
  canvas `embedSource` is read once at mount, like `wikiLinkSource`. See
  [ADR-009](./docs/decisions/009-react-nodes-in-the-in-place-canvas.md).
- New style hook `.cm-inplace-embed` (the canvas slot); `.stylo-embed-content`
  and `--stylo-embed-accent` are shared with the `preview` embed.

- **Inline `![[ref]]` embeds.** A `![[ref]]` mid-sentence now renders as inline
  phrasing content flowing with the text, on `preview`, `split`, and the
  in-place canvas — previously only a `![[ref]]` alone on its line was an embed.
  Return phrasing content (not a block element) for these; `![[…]]` inside code
  stays literal. New style hooks `.stylo-embed-inline` (preview / split) and
  `.cm-inplace-embed-inline` (canvas).

- **`![[ref]]` in an in-place table cell renders literally** rather than as a
  misleading `!` + wikilink chip. That surface is for editing tabular text;
  `preview` / `split` transclude in cells as normal. Also fixes a stray
  overlapping embed decoration on table lines introduced with inline embeds.

- **`onResolveError`** — an optional callback fired when `embedSource` or
  `wikiLinkSource` throws or returns a rejected promise. `(error, info)` where
  `info` is `{ source: "embedSource" | "wikiLinkSource"; input: string }`. Pure
  observation: the resolver still falls back (literal `![[ref]]` text, or no
  completions), and a `null` return is not treated as an error. Reactive. The
  exported type is `ResolveErrorInfo`.

- **`![[ref]]` resolution is cached.** A shared, per-`embedSource` cache keyed by
  `ref` means an embed scrolled out of the in-place canvas and back — or
  re-mounted by a `preview` re-render — is served without re-invoking
  `embedSource`, and with no loading flash. In-flight requests for the same
  `ref` are deduplicated; rejections are not cached; the cache is capped at 64
  references per resolver. Content is now memoised by `ref`: vary the `ref` or
  pass a new `embedSource` if a reference's content can change.

### Changed

- **`inPlace.reveal: "never"` — a fenced code block no longer shows its ` ``` `
  fences when the caret is inside it.** The block's body stays plain editable
  source; the language is set through the right-click **Language** field and
  **Remove code block** unwraps it, so the fences had no editing role left. A
  body-less block (` ``` ` / ` ``` ` with nothing between) still reveals its
  fences on caret entry, as the only way to see or delete it. No effect under
  the default `reveal: "caret"`.

- **`inPlace.reveal: "never"` — a `---` / `***` thematic break no longer shows
  its source when the caret is on it.** The rendered `<hr>` stays put; to remove
  the rule, press Backspace or Delete on the line, or right-click it for
  **Remove divider**. Clicking the rule places the caret on it, so Backspace
  works straight after. No effect under the default `reveal: "caret"`.

- **`inPlace.reveal: "never"` — inline `$…$` / one-line `$$…$$` math no longer
  shows its LaTeX when the caret is on it.** Instead: a right-click **Math**
  field edits the source in place (prefilled, with **Remove math**, when the
  caret sits in an existing span); clicking a rendered widget opens the same
  field at the pointer; hovering one shows the raw LaTeX in a tooltip. A
  multi-line `$$` block is unaffected — it keeps its existing caret-reveal. No
  effect under the default `reveal: "caret"`.

### Fixed

- With `embedSource` set, a lone `![[ref]]` on the in-place canvas no longer
  renders as a stray `!` followed by a `[[ref]]` link chip — the wikilink pass
  yields the inner `[[ref]]` to the embed pass.

## [0.8.0] - 2026-09-10

### Added

- **`embedSource`** — a prop that resolves `![[ref]]` transclusion in `preview`
  and `split`. It takes `(ref: string) => ReactNode | Promise<ReactNode>`; Stylo
  has no vault, so it detects the `![[…]]` and renders whatever node the host
  returns in its place. The reference is passed verbatim, `#heading` /
  `#^blockid` / `|size` suffixes intact (in an embed `|` is a size hint, not a
  label, so `WIKILINK_PATTERN` is not reused). While the resolver is pending, and
  if it rejects or returns `null`, the literal `![[ref]]` text stands in.
  Recognised only when the `![[…]]` is alone on its line — an inline `![[…]]`
  stays literal to avoid nesting a host `<div>` inside a `<p>`. Off unless the
  prop is passed; the in-place canvas is unaffected for now. Renders into
  `<div class="stylo-embed"><div class="stylo-embed-content">`, with a
  `--stylo-embed-accent` variable. No new dependency.

### Fixed

- **`split` now honours `frontmatter`.** `SplitView` accepted the prop but never
  passed it to its preview pane, so `frontmatter="code"` did nothing in `split`
  mode (it worked in `preview`). The pane now renders the
  `<div class="stylo-frontmatter">` block like `preview` does.

## [0.7.0] - 2026-09-10

### Added

- **`wikiLinkSource`** — a prop that turns on `[[wikilink]]` autocomplete on the
  CodeMirror surfaces (`source`, `split`, `in-place`). It takes
  `(query: string) => WikiLinkCompletion[] | Promise<…>`, where
  `WikiLinkCompletion` is `{ target: string; label?: string }`; the host owns the
  index and the ordering, Stylo owns the trigger (an unclosed `[[…`) and the
  insert. Accepting writes `[[target]]`, or `[[target|label]]` when a candidate's
  `label` differs, reusing a `]]` the user already typed. Registered as a
  Markdown-language completion source, so it is inert in fenced code. Off unless
  the prop is passed; read once, at mount. `@codemirror/autocomplete` becomes a
  regular dependency (already transitive via `@codemirror/lang-markdown`,
  externalised from the bundle). `![[embed]]` transclusion is still out of scope.

## [0.6.0] - 2026-09-10

### Added

- **`--stylo-font-family` and `--stylo-font-family-mono`** — the prose and code
  font stacks, previously hard-coded. `--stylo-font-family` backs the in-place
  canvas, the "Frontmatter" labels, and the fixed-position sticky toolbar;
  `--stylo-font-family-mono` backs source mode, the in-place code decorations,
  and preview `code` / `pre`. Defaults are the stacks that were inline, so no
  visual change out of the box. Not colours — one value each, light block only,
  like `--stylo-radius` / `--stylo-font-size`. The `preview` prose surface still
  inherits its font from the host by design.

## [0.5.0] - 2026-09-10

### Added

- **`--stylo-font-size`** — a tenth styling token (default `0.9375rem`) that
  sets the base editor font size. `.cm-editor` previously hard-coded it, so a
  host wanting the editor at its own type scale had to override an internal
  CodeMirror class outside the `--stylo-*` contract. The token backs that rule
  on every surface; the in-place canvas is sized in `em`, so the whole surface
  scales from it. Like `--stylo-radius` it is not a colour — one value serves
  both themes.

### Fixed

- The in-place selection bar (`selectionUI: "bar"`) and the right-click context
  menu are separate floating layers at the same `z-index` and had no awareness
  of each other, so opening the menu left it stacked over the bar. The bar now
  yields while the menu is open and returns when it closes.

### Documentation

- README gains a **Features** list, a **Documentation** map into the wiki, a
  screenshot of the in-place canvas, and an `npm install @damiro/stylo` line in
  place of the pre-publish git instructions.
- New wiki guide, **Integrating Stylo** (`docs/wiki/guides/integration.md`):
  controlled-component contract, live vs. mount-time props, persistence,
  stylesheet and peer-dependency setup, `getView()`, and the theming rules.

## [0.4.0] - 2026-09-10

### Added

- **`<StyloToolbarSettings />`** — an opt-in component, exported from
  `@damiro/stylo/toolbar-settings`, that lets an end user rearrange the
  formatting bar. Controlled: `value` is the same `items` array passed to
  `<Stylo toolbar={{ items }}>`, `onChange` fires on every edit, and the host
  owns persistence. Two lists, "On the bar" and "Available": **drag a row's ⠿
  handle to reorder** (pointer, or focus the handle and use Space + Arrow keys —
  `@dnd-kit`'s keyboard sensor, with screen-reader announcements); the ✕ / Add
  buttons move items between the lists; "Add separator" and "Reset to default"
  below. `@dnd-kit/core`, `@dnd-kit/sortable`, and `@dnd-kit/utilities` are
  **optional** peer dependencies of this entry — a plain `@damiro/stylo` import
  never pulls them, and they are externalised from the bundle. Completes the
  ADR-002 §2 customizer.

## [0.3.0] - 2026-09-10

### Added

- **Find / replace.** `@codemirror/search` is wired into every editing surface
  (`source`, `split`, `in-place`); `preview` has no editor, so it is unaffected.
  `Mod-f` opens the panel whether or not the visible toolbar is mounted;
  `Mod-g` / `Mod-Shift-g` step matches, `Mod-Alt-g` replaces, `Escape` closes.
  The panel docks at the top and is restyled to Stylo's flat, token-driven
  chrome. A new opt-in `search` toolbar command id (like `save` / `underline`,
  not in the default bar) opens the same panel. `@codemirror/search` is a
  regular dependency — auto-installed for the consumer — but externalised from
  the bundle like the other `@codemirror/*` packages, so npm dedupe keeps a
  single CodeMirror instance. ADR-002 §2 amendment.

## [0.2.0] - 2026-09-10

Carries the CodeMirror peer-dependency change, so it is a minor bump under the
pre-1.0 "anything may still change" rule rather than a patch. Cut and tagged;
the first npm-registry publish is deferred to a later version.

### Added

- `--stylo-surface-floating` token — background for the floating in-place popups
  (the context menu, its URL input, the selection bar, the link-hover tooltip).
  A concrete colour with light and dark values, **not** an alias of
  `--stylo-bg`: a host that sets `--stylo-bg: transparent` to drop the editor
  into an existing card now keeps those popups opaque and legible instead of
  seeing them blend into the content behind. Override it for a raised or tinted
  popup surface. ADR-002 §3 amendment.
- Thin, token-tinted scrollbars on the editing surface (`.cm-scroller`), so
  `source`, `in-place`, and the source pane of `split` no longer fall back to a
  heavier native scrollbar than the chrome around them. Driven by
  `--stylo-border` / `--stylo-text-muted`; a host's own `.cm-scroller` rules
  load after and win.
- Toolbar extensibility. `toolbar.items` now accepts `ToolbarCustomItem` objects
  (`{ id, title, icon, run, isActive?, disabled? }`) mixed in with the built-in
  ids — a consumer's own button, run against the live view, refreshed on the
  same events as the built-ins. New `toolbar.render` slot wraps or replaces the
  rendered bar. Every toolbar button now carries a `data-command="<id>"`
  attribute. Custom items have no keyboard-shortcut field yet — bind against
  `getView()`. ADR-002 §2 amendment.
- `underline` toolbar command — wraps the selection in a raw `<u>…</u>` HTML
  pair (Markdown has no underline), bound to `Mod-u`. Not in the default bar;
  add `"underline"` to `toolbar.items` to show the button. Renders underlined
  wherever the host renders inline HTML; Stylo's bundled `preview` does not.
- Touch support for the in-place context menu. A long-press (≈450 ms) opens the
  canvas menu and the editable table's structural menu where a mouse would
  right-click; a tap outside dismisses it. The table's edge `+` add-row /
  add-column strips stay visible on touch devices instead of only on hover.
  Refined after an on-device pass — see **Fixed** and **Changed** below. ADR-007
  rollout log; ADR-002 §2 amendment (2026-09-09).
- The in-place context menu grows for touch under `@media (pointer: coarse)` —
  menu rows and the URL input take a wider vertical gutter (~18&nbsp;px between
  labels), the selection bar a 44&nbsp;px tap target. Automatic, no prop —
  resizing an existing popup changes no layout, unlike `toolbar.sticky`, which
  stays opt-in. Override through the `.cm-inplace-*` classes. ADR-002 §2
  amendment.
- `toolbar={{ sticky: "bottom" | "top" | true }}` — pins the formatting bar to
  an edge instead of wherever `<Stylo>` sits on the page (`true` is an alias
  for `"bottom"`). Both are `position: fixed`. `"bottom"` rides above the
  on-screen keyboard (the Obsidian / iA Writer mobile pattern) — pair it with
  `interactive-widget=resizes-content` on your page's `<meta name="viewport">`
  for the most reliable tracking, and note it can render behind a platform's
  own keyboard accessory bar (native chrome, outside any web z-index). `"top"`
  needs neither: nothing eats into the top of the screen, so it can't collide
  with a keyboard or its accessory bar. It runs a `requestAnimationFrame` loop
  that continuously re-asserts its position rather than setting it once — see
  **Known limitations** below for what that does and doesn't cover on iOS
  Safari. Off by default; combine with your own responsive check if you only
  want it below a breakpoint. New `stickyVisibility` prop (`"consistent"`, the
  default, or `"dynamic"`) fades the bar out while the editing surface is
  unfocused. ADR-002 §2 amendment.

### Documentation

- The `inPlace` and `codeLanguages` props are now specified as **applied at
  mount** — a deliberate contract, with the `key`-to-remount recipe and the
  reasons a live-reconfiguration path was rejected. ADR-005 config-lifecycle
  amendment; props and in-place-config references.
- The README and the fenced-code reference now state up front that fenced code
  renders in flat, uncoloured monospace until `codeLanguages` is passed —
  previously only discoverable by reading the reference in full.
- New guide, [Layout and touch](docs/wiki/guides/layout-and-touch.md): the
  three page layouts (inline, full height, bounded box), the full-height recipe
  that pins a toolbar with no `position: fixed`, and what to expect from the
  context menu, menu sizing, and caret placement on touch.

### Changed

- The in-place context menu's active row now takes its accent from
  `--stylo-accent` (documented role: active / pressed states) instead of
  `--stylo-ring`. `--stylo-ring` is the focus ring only now, so a host can drop
  or restyle the focus outline without also recolouring the menu. ADR-002 §3
  amendment.
- **BREAKING:** `@codemirror/*` and `@lezer/common` / `@lezer/highlight` are now
  `peerDependencies` rather than bundled dependencies, and are externalised from
  the build (ADR-008). The host installs one copy of CodeMirror and Stylo shares
  it, so `EditorState`, facets, and the syntax tree keep a single identity
  across the host and the editor — `getView()`, extra extensions, and host-side
  `syntaxTree` reads all line up. Install the packages alongside Stylo; see the
  README. Drops roughly 190&nbsp;kB gzipped from the bundle, and the `dist/`
  `codemirror` chunk with it.
- Long-press tuning for the in-place menu: abort `slop` 10&nbsp;px → 20&nbsp;px
  (a fingertip cannot hold to 10&nbsp;px for half a second), hold `delay`
  500&nbsp;ms → 450&nbsp;ms. `.cm-content` now sets `-webkit-touch-callout: none`
  so iOS Safari's own long-press callout stops racing — and usually beating —
  the gesture. Text selection and the selection handles are unaffected. Still
  fiddly to land on iOS after these changes; `inPlace.selectionUI: "bar"` is the
  recommended touch trigger. ADR-002 §2 amendment.

### Fixed

- The in-place context menu no longer dismisses itself the instant it opens on
  touch. `armDismiss` now ignores `scroll` for 350&nbsp;ms after the menu
  appears — a long-press is one continuous gesture that routinely emits an
  incidental scroll (iOS's own long-press handling, a hair of finger drift, a
  focus-driven viewport shift) in the frames right after it opens. A deliberate
  scroll-away lands well after the window and still dismisses as before.

### Known limitations

- `toolbar.sticky` (`"top"` and `"bottom"`) can disappear for the duration of
  an active scroll gesture on iOS Safari, reappearing once scrolling settles.
  Investigated at length — a compositing hint, real `position: sticky`, and a
  `requestAnimationFrame` watchdog each closed one trigger and left this one
  standing, including against a bare, unrelated element given the same
  watchdog as a control. iOS Safari is known to drop `position: fixed` layers
  from active compositing during a scroll gesture as a performance
  optimisation, independent of any page CSS or JS — there is no available
  fix from web content, the same class of limitation as `"bottom"`'s
  accessory-bar collision. For a formatting surface that must survive being
  actively scrolled, `inPlace.selectionUI: "bar"` positions relative to the
  selection instead of the window and doesn't have this problem. ADR-002 §2
  amendment.

## [0.1.0] - 2026-09-04

First versioned, installable release. Marks the point the library became
consumable from git.

### Added

- `<Stylo>` with four modes: `in-place` (default live decoration canvas),
  `source`, `preview`, `split`.
- In-place canvas: caret-reveal and always-hidden marker modes, right-click
  context menu, floating selection bar, autoformat-on-type, interactive table
  editing, callouts, and per-construct decoration toggles.
- Formatting toolbar with configurable, orderable built-in commands and
  per-command icon overrides via the `icons` prop.
- `[[wikilink]]` support with an `onWikiLinkClick` callback; `onLinkClick` for
  standard links.
- `onFrontmatter(raw)` callback (fires on mount and on change) and a
  `splitFrontmatter(md)` export. Stylo bundles no YAML parser — the host parses
  the raw block.
- `onSave` prop: `Mod-s` on any editing surface calls it with the full document
  and suppresses the browser's save dialog. An opt-in `save` toolbar id runs the
  same path; it is not in the default bar and stays disabled until `onSave` is
  wired. Auto-save stays a consumer concern — see the wiki guide.
- Imperative handle on a `ref` to `<Stylo>` — `focus()`, `scrollToHeading()`,
  `insertAtCursor()`, and `getView()` for direct `EditorView` access.
- Dark palette in `tokens.css`, triggered by a `.dark` / `[data-theme="dark"]`
  ancestor; `color-scheme` set on both themes.
- KaTeX rendering for `$…$` and `$$…$$`; the stylesheet ships separately as
  `@damiro/stylo/katex.css`.
- Opt-in fenced-code syntax highlighting via `codeLanguages`.
- `--stylo-*` CSS custom properties for theming, light and dark.
- `prepare` script, so the bundle builds itself on `npm install` from git.
- `manualChunks` so the built vendor chunks are named `codemirror`, `markdown`,
  and `katex` rather than after arbitrary internal modules.
- CI guards: `check:theme` (every `--stylo-*` colour has a light and a dark
  value) and `check:size` (per-chunk gzip budgets). CI also runs a React 18 and
  a TypeScript 6 job against the peer/consumer floor.

### Known limitations

- No built-in YAML parsing or rendered "properties" panel; `onFrontmatter` hands
  over the raw block and the host parses it.
- `@codemirror/*` are regular dependencies, not peer dependencies.
- The test suite runs in jsdom only.
- `inPlace` config is read once at mount; changing it needs a remount. (Now
  documented as an intentional contract — see `[Unreleased]`.)

[0.19.1]: https://github.com/itsdamiro/stylo/releases/tag/v0.19.1
[0.19.0]: https://github.com/itsdamiro/stylo/releases/tag/v0.19.0
[0.18.0]: https://github.com/itsdamiro/stylo/releases/tag/v0.18.0
[0.17.0]: https://github.com/itsdamiro/stylo/releases/tag/v0.17.0
[0.16.0]: https://github.com/itsdamiro/stylo/releases/tag/v0.16.0
[0.13.6]: https://github.com/itsdamiro/stylo/releases/tag/v0.13.6
[0.13.5]: https://github.com/itsdamiro/stylo/releases/tag/v0.13.5
[0.13.4]: https://github.com/itsdamiro/stylo/releases/tag/v0.13.4
[0.13.3]: https://github.com/itsdamiro/stylo/releases/tag/v0.13.3
[0.13.1]: https://github.com/itsdamiro/stylo/releases/tag/v0.13.1
[0.13.0]: https://github.com/itsdamiro/stylo/releases/tag/v0.13.0
[0.12.0]: https://github.com/itsdamiro/stylo/releases/tag/v0.12.0
[0.11.0]: https://github.com/itsdamiro/stylo/releases/tag/v0.11.0
[0.10.0]: https://github.com/itsdamiro/stylo/releases/tag/v0.10.0
[0.9.1]: https://github.com/itsdamiro/stylo/releases/tag/v0.9.1
[0.4.0]: https://github.com/itsdamiro/stylo/releases/tag/v0.4.0
[0.3.0]: https://github.com/itsdamiro/stylo/releases/tag/v0.3.0
[0.2.0]: https://github.com/itsdamiro/stylo/releases/tag/v0.2.0
[0.1.0]: https://github.com/itsdamiro/stylo/releases/tag/v0.1.0
