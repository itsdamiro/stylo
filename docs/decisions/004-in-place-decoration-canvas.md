---
type: decision
status: accepted
date: 2026-09-01
projects: [stylo]
concepts: [In-place canvas]
amends: []
supersedes: []
tags: [type/decision, status/accepted, project/stylo, topic/architecture]
---

# 004 — In-place decoration canvas

> **Summary.** One CodeMirror ViewPlugin walks the syntax tree over the visible ranges and produces line, mark and replace decorations, so the editor stays the single source of truth for selection, undo and input methods. The alternatives rendered blocks through React or painted an overlay and kept two sources of truth. The default mode flips to in-place in stages, and v1 deliberately leaves some constructs as plain source.

- **Status:** Accepted — implements the `in-place` canvas from [ADR-002](./002-editor-ux-and-customization.md) §1 and stages the default-mode flip it called for
- **Date:** 2026-09-01
- **Deciders:** damiro, Grace

## Context

[ADR-002](./002-editor-ux-and-customization.md) §1 committed the first release to an `in-place` canvas — Notion/Obsidian-style live preview where the raw Markdown stays in the document and renders in place, revealing its source under the cursor — and made it the default `mode`. It did not specify how the canvas is built, what it renders in v1, or in what order it lands.

The [foundation milestone](../journal/2026-09/2026-09-01_foundation-milestone.md) shipped `source`, `preview`, and `split`. `in-place` is the remaining mode and the largest: it is a CodeMirror 6 subsystem, not a layout. Six things need settling before code:

1. How decorations are produced and kept in sync with the document.
2. How a node's source is revealed when the cursor enters it.
3. How a replaced block (rendered math) stays reachable and editable.
4. What v1 decorates, and what it deliberately leaves as source.
5. Where the code and its `katex` cost sit in the bundle.
6. When the default `mode` flips from `source` to `in-place`.

### Approaches considered

| Approach                                                         | What it is                                                                                             | Assessment                                                                                                                                                                       |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A — CodeMirror view decorations from the Lezer tree**          | A `ViewPlugin` walks `syntaxTree(state)` and emits `Decoration`s that restyle, hide, or replace ranges | The editor stays the single source of truth; selection, undo, and IME all keep working. This is how Obsidian and the CodeMirror rich-editing examples do it.                     |
| **B — `react-markdown` rendered into a `WidgetType` per block**  | Replace each block's source lines with a widget that renders the block via the preview pipeline        | Pulls the whole `remark`/`rehype` stack into the canvas, re-runs React reconciliation per keystroke, and makes partial-line editing (cursor reveal) awkward. Heavy and indirect. |
| **C — separate rendered DOM layer positioned over the editor**   | Keep a hidden textarea/editor and paint a styled overlay on top, syncing scroll and geometry           | Two sources of truth to keep pixel-aligned; caret, selection, and accessibility all have to be re-implemented on the overlay. Fragile.                                           |
| **D — invisible split** (render pane stacked on the source pane) | The `split` pipeline with the panes overlaid instead of side by side                                   | Same two-source-of-truth and caret problems as C; the rendered pane cannot host the real cursor.                                                                                 |

Approach **A** is the only one that does not fork the source of truth.

## Decision

1. **One `ViewPlugin` owns a `DecorationSet`.** It is built by walking `syntaxTree(state)` over `view.visibleRanges` only — never the whole document — and rebuilt on `docChanged`, viewport change, and `selectionSet`. The plugin is added through a new `Compartment` in `useCodeMirror`, alongside the existing dynamic-config compartment, so `mode` can switch it on and off in place.

2. **Four decoration kinds, mapped to Lezer node types.**
   - `Decoration.line` — heading display sizing, blockquote framing, list-line class.
   - `Decoration.mark` — emphasis styling (bold / italic / strikethrough / inline code).
   - `Decoration.replace` **with a `WidgetType`** — block math `$$…$$`, inline math `$…$`, horizontal rule. The widget renders once and is reused while its source range is unchanged (`eq()` compares the raw text).
   - `Decoration.replace` **without a widget** — collapse syntax that has a visible label: `#` heading markers, emphasis markers, `[text](url)` and `[[target|label]]` down to the label.

3. **Cursor reveal.** A node's decoration is suppressed when the main selection range intersects that node's line span. Suppression is recomputed on every rebuild from `state.selection`, so moving the caret onto a heading shows its `#`, and moving away re-collapses it. Line-span (not exact-range) intersection keeps the behaviour predictable while editing.

   > **Amended 2026-09-03 (ADR-007):** cursor reveal becomes one of two modes. [ADR-007](./007-seamless-in-place.md) adds `inPlace.reveal: "caret" | "never"`; `"never"` keeps every inline marker hidden on every line, with boundary-editing rules and autoformat-on-type taking the place of editing the raw markers. `"caret"` — this rule as written — stays the default until ADR-007's stages land, then the default flips.

4. **Replaced blocks are atomic.** The plugin also provides `EditorView.atomicRanges` for its widget replacements, so arrow keys step over a rendered math block instead of into hidden characters. A click on a widget places the caret at its edge, which reveals the source via rule 3.

   > **Amended 2026-09-02 (ADR-005 implementation):** "a click on a widget places the caret at its edge" did not hold reliably — a click on KaTeX internals or the empty parts of an `<hr>` / the chip could leave the caret unplaced, so nothing revealed. A narrow `mousedown` handler in `inPlaceExtension` now catches clicks whose target is inside a rendered widget (`.cm-inplace-math`, `-hr`, `-frontmatter`, `-table`) and drops the caret at the widget's document position; text and line padding stay with CodeMirror. `HrWidget` and `FrontmatterWidget` also had their `ignoreEvent` flipped to `false` so the handler sees their events. The hidden zero-width `>` and the collapsed fence rows have no click target of their own — as with a hidden `#`, you click the construct's visible text.
   >
   > **Amended 2026-09-02 (click-to-position fixes):** the "Properties" chip over the frontmatter block is gone. It was a `block: true` widget that folded the YAML to one line, and the fold desynced click-to-position for every row below it — CodeMirror's height map measures a widget by its border box, and a folded block widget misreports the vertical space it occupies. The block now stays at full height with line decorations only (muted, monospace, a CSS "Properties" label), the `---` fences hidden off-caret. `FrontmatterWidget` and the `.cm-inplace-frontmatter` entry in the selector above are removed. Relatedly, every vertical `margin` in the in-place theme (the math block, the `<hr>`, the table, the fenced-code container rows) became `padding`: `margin` sits outside the border box the height map measures, so it drifted the caret cumulatively further off the further down the document the click was. See the [click-to-position journal note](../journal/2026-09/2026-09-02_in-place-click-mapping.md).
   >
   > **Amended 2026-09-03 (boxed-block gutter):** the in-place horizontal gutter moved from `.cm-line` to `.cm-content`. A `.cm-line` padding insets the line's text but not a background or border painted on that line, nor a `block: true` widget (which renders outside `.cm-line`) — so fenced code, the blockquote bar, rendered tables, and `$$` math blocks were all bleeding to the editor frame. `padding` on `.cm-content` (in `inPlaceTheme` only, with `.cm-line` horizontal padding zeroed) holds every block off the edge by the same `0.75rem`; `source` mode keeps the base `.cm-line` gutter. Companion to the no-vertical-`margin` rule above. See the [boxed-block gutter journal note](../journal/2026-09/2026-09-03_boxed-block-gutter.md).

5. **Math is typeset directly with `katex`.** Widgets call `katex.renderToString(src, { throwOnError: false, displayMode })` — not the `react-markdown` pipeline. `katex` is already a Stylo dependency ([ADR-003](./003-katex-math-rendering.md)); no new one is added.

6. **The in-place module is lazy-loaded**, the way `Preview` is ([ADR-003](./003-katex-math-rendering.md) "Bundle placement"). It loads only when `mode` resolves to `in-place`, and carries `katex` in its chunk (deduplicated with the `Preview` chunk by the bundler where possible). `mode="source"` stays at the CodeMirror-only floor.

### Accepted for the first release

v1 of the canvas decorates:

| Node                            | Treatment                                                             |
| ------------------------------- | --------------------------------------------------------------------- |
| Headings                        | Display size; `#` markers hidden off the cursor line                  |
| Bold / italic / strike / `code` | Styled; markers hidden off-cursor                                     |
| Links and `[[wikilinks]]`       | Collapsed to the label; activating a wikilink fires `onWikiLinkClick` |
| Block math `$$…$$`              | Replaced with a KaTeX display widget; arrow or click to edit          |
| Inline math `$…$`               | Replaced with an inline KaTeX widget                                  |
| Horizontal rule                 | Rendered line                                                         |
| Blockquote                      | Left border and muted colour; `>` hidden off the cursor line          |
| List markers                    | Bullet-glyph styling                                                  |

> **Amended 2026-09-02 (ADR-005 implementation):** blockquote `>` markers are now hidden off-caret and revealed on-caret, like heading and emphasis markers, instead of always kept. Found while verifying the `blockquote` decoration toggle in the playground — leaving `>` permanently visible made the toggle look like it did nothing to the marker itself, only the framing. Per-line, via a `QuoteMark` case in `nodes.ts`.

### Deferred (post-v1, additive)

Left as source-styled text in v1, each addable later without reworking the plugin: syntax-highlighted code fences (waits on the `codeLanguages` pass-through prop), inline image previews, embeds / transclusions.

> **Amended 2026-09-01 (in-place milestone):** interactive task checkboxes were pulled forward into the milestone, ahead of the default flip — a raw `- [ ]` under the default mode reads as unfinished. A `TaskMarker` node becomes an `<input type="checkbox">` widget that toggles `[ ]` ⇄ `[x]` in the source.
>
> **Amended 2026-09-01 (increment 8):** rendered GFM tables landed, just after the default flip. A `Table` node is replaced with a `block: true` `<table>` widget built from the Lezer `TableCell` / `TableDelimiter` children (header, body, per-column alignment); the caret entering any table line reveals the source, as with every other node. It rides its own state field (`tableField`), not the view plugin, because the replacement spans line breaks. Cell text is rendered verbatim — inline formatting inside cells, and consumer-facing table styling options, are follow-ups for the customization API pass.

### Default-mode flip is staged, not immediate

ADR-002 §1 makes `in-place` the default `mode`. That flip is the **last step** of this subsystem's rollout, taken only once every v1 node type above is implemented and verified in the playground. Until then the default stays `source` and `in-place` is opt-in. This sequences ADR-002's decision; it does not change the committed end state.

> **Completed 2026-09-01:** every v1 node type (plus task checkboxes) is implemented and playground-verified; `Stylo`'s default `mode` is now `in-place`. `mode="source"` remains the plain surface that loads no render chunk.

The increment-by-increment plan and its running status live in the [in-place canvas build tracker](../journal/2026-09/2026-09-01_in-place-canvas.md).

## Consequences

**Positive**

- The CodeMirror document stays the single source of truth. Selection, undo/redo, IME, and accessibility keep working with no re-implementation.
- No new dependency. The render cost of the canvas is `katex` plus the plugin itself; the `remark`/`rehype` stack is not pulled in.
- Viewport-scoped rebuilds keep large notes responsive.
- `mode="source"` bundle size is unaffected — the canvas is a lazy chunk.
- The deferred node types slot into the same plugin; none of them force an architecture change.

**Negative / costs**

- Decoration and cursor-reveal logic needs careful test coverage — caret movement around atomic widgets is the classic source of CodeMirror rich-editing bugs (ADR-002 flagged this).
- Widget typesetting runs on the main thread; a document with hundreds of distinct math expressions in view could show build latency. Mitigated by viewport scoping and per-range widget reuse; revisited if it surfaces.
- Line-span cursor reveal is coarser than exact-range: placing the caret on a heading line reveals the whole line's markers, not just the marker nearest the caret. Accepted as the predictable choice.
- Two math paths now exist — `rehype-katex` in `preview`/`split`, direct `katex.renderToString` in `in-place`. Both pin the same `katex`, so output matches; the duplication is small and deliberate.

## Alternatives rejected

- **Approach B — `react-markdown` inside per-block widgets.** Pulls the entire render pipeline into the editing surface, re-runs React reconciliation per keystroke, and makes cursor reveal (partial-line editing) awkward. Heavy and indirect for what is fundamentally a restyling job.
- **Approach C — rendered overlay layer.** Forks the source of truth; caret, selection, and a11y must be rebuilt on the overlay and kept pixel-aligned with the hidden editor. Fragile.
- **Approach D — invisible split.** Same problems as C; a rendered pane cannot host the real cursor.
- **Decorating the whole document instead of the viewport.** Simpler to write, but O(document) work on every keystroke; unacceptable for long notes.
- **Rendered tables and highlighted code fences in v1.** Deferred to keep the first pass focused; tables landed straight after the flip as increment 8 (see the amendment above), code highlighting stays coupled to the unresolved `codeLanguages` question.
- **Flipping the default to `in-place` immediately.** Ships an unproven, interaction-heavy surface as the default for every consumer before its edge cases are covered. Staged behind the rollout instead.
