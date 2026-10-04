---
title: "In-place canvas configuration"
created: 2026-09-01
type: wiki-reference
parent: index
tags:
  - stylo/wiki
  - engineering/standard
---

# In-place canvas configuration

The `inPlace` prop turns individual [in-place canvas](../architecture/overview.md)
decoration types off, leaving that construct rendered exactly as it appears in
`mode="source"` — plain text, no cursor-reveal behaviour, nothing atomic.
Specified in [ADR-005](../../journal/2026-09/2026-09-01_adr-005-in-place-decoration-toggles.md).

```tsx
<Stylo
  value={doc}
  onChange={setDoc}
  inPlace={{
    decorations: { tables: false, frontmatter: false },
    table: "cells",
    reveal: "caret",
    contextMenu: true,
    selectionUI: "menu",
  }}
/>
```

## `inPlace.decorations`

Every key is optional and defaults to `true`.

| Key              | Turns off                                                            |
| ---------------- | -------------------------------------------------------------------- |
| `headings`       | ATX heading sizing and `#` hiding                                    |
| `emphasis`       | bold / italic / strikethrough / inline-code styling                  |
| `links`          | `[text](url)` collapse to the link text                              |
| `wikilinks`      | `[[target\|label]]` collapse to the label                            |
| `math`           | `$…$` and `$$…$$` KaTeX widgets                                      |
| `lists`          | `-` / `*` / `+` bullet-glyph substitution                            |
| `tasks`          | interactive `[ ]` / `[x]` checkboxes                                 |
| `blockquote`     | left-border / muted framing, `>` hiding off-caret, and callouts      |
| `horizontalRule` | the rendered `<hr>`                                                  |
| `code`           | inline `` `code` `` styling and the fenced / indented code container |
| `frontmatter`    | the recessed in-place styling of the leading YAML block              |
| `tables`         | the rendered `<table>`                                               |
| `embeds`         | `![[ref]]` transclusion blocks (needs `embedSource`; see ADR-009)    |

With `headings` on, a heading line also carries `role="heading"` and
`aria-level` so screen readers and outline tools see the structure — the `#`
markers themselves are hidden (and, under `reveal: "never"`, never in the DOM),
so the ARIA role stands in for an `<hN>` tag.

## `inPlace.table`

How the caret entering a table behaves. Optional, defaults to `"source"`.

| Value      | Behaviour                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `"source"` | The rendered `<table>` reveals its aligned pipe source under the caret — Tab / Shift-Tab / Enter walk the cells, widths and the delimiter rebuild live. `↓` from the line above (`↑` from the line below) steps onto that source rather than skipping the table. Obsidian's _Source mode_.                                                                                                                                                                                                                                                                                                                        |
| `"cells"`  | The rendered `<table>` stays on screen with `contenteditable` cells. Typing rewrites the matching Markdown, re-aligned on every keystroke. `↓` / `↑` from the surrounding lines move into the first / last cell; inside, arrow keys walk the grid — `↓` `↑` down the column, `←` `→` across at the text edge — and step back out past the first or last row. Tab / Enter also move between cells, past the last cell adds a row. Hovering the table shows an edge `+` to append a column or row; right-click (or long-press on touch) a cell for insert, delete, and column alignment. Obsidian's _Live Preview_. |

Either way a rendered cell shows inline formatting — `**bold**`, `*em*`,
`~~strike~~`, `` `code` ``, `[links]`, `[[wikilinks]]`, `$math$`. In `"source"`
mode the whole table reveals its pipe source when the caret lands on it; in
`"cells"` mode each cell swaps to its raw Markdown **while it has focus** and
re-renders on blur, so you edit the source in place. With a cell focused the
toolbar's inline buttons and their shortcuts (`Mod-b`, `Mod-i`, `Mod-k`,
`Mod-Shift-k`) wrap the cell's selection; `codeBlock` / `mathBlock` degrade to
inline `` `code` `` / `$math$` there. Specified in
[ADR-006](../../journal/2026-09/2026-09-02_adr-006-interactive-table-editing.md).

## `inPlace.contextMenu`

Optional, defaults to `true`. A right-click inside the canvas opens Stylo's own
menu instead of the browser's. It has **one shape everywhere** (Obsidian's
layout), so nothing jumps around:

| Row                    | Opens                                                                                                                                                                              |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Add link**           | A `[[target]]` field. Prefilled + **Remove link** and labelled **Edit link** when the caret is in one.                                                                             |
| **Add external link**  | A `[text](url)` field. Prefilled + **Open link** (fires `onLinkClick`) + **Remove link**, labelled **Edit external link**, when the caret is in one.                               |
| **Format** ›           | Bold · Italic · Strikethrough · Inline code · a **Math** field (LaTeX for `$…$` / one-line `$$…$$`; prefilled + **Remove math**, labelled **Edit math**, when the caret is in one) |
| **Paragraph** ›        | Bulleted / Numbered / Task list · Heading 1–3 · **Body** (strip the heading) · Blockquote                                                                                          |
| **Insert** ›           | Table · Divider · Code block · Block math · Frontmatter — **greyed unless the line is empty**                                                                                      |
| **Cut / Copy / Paste** | Clipboard                                                                                                                                                                          |

A right-click with no selection first **selects the word under the pointer**, so
the menu acts on that word. Items that can't produce valid Markdown where the
caret sits are shown greyed. On a **blank line** the whole **Format** group is
disabled and **Insert** is the live one (they swap on a line with text); on a
bare caret with no word, the marks are disabled too. Inside an inline
`` `code` `` / `$math$` span every other mark is disabled. Under
`selectionUI: "bar"` or `"none"` the link rows and **Format** are dropped from
the menu (they live on the floating bar or the toolbar); **Paragraph** and
**Insert** always stay.

A right-click in an **editable table cell** opens the table's own structural
menu (insert / delete row and column, align); on a word — or over an existing
selection — it also carries a **Format** group and clipboard, so one menu covers
the table and the text. Like the canvas, a right-click on a word with nothing
selected selects that word first. A right-click **inside a fenced code block**
replaces the menu with a **Language** field (edits the ` ```lang ` info string)
and **Remove code block**, plus clipboard. A right-click on a **rendered
thematic break** (`---` / `***` shown as an `<hr>` under `reveal: "never"`)
offers **Remove divider** and clipboard — there is nothing to edit in a rule,
so removal is the only action; Backspace or Delete on the rule does the same. A
right-click outside the text area gets the browser's own menu. Set
`contextMenu: false` to keep the browser menu everywhere.

A right-click with no selection first checks whether the pointer is inside a
marked run. For an inline mark — `**bold**`, `*italic*`, `~~strike~~`,
`` `code` `` — it selects the run's text, so a toggle covers the whole phrase.
For a `[label](url)` link or `[[Page|label]]` wikilink it selects the **entire
construct**, so **Bold** / **Italic** / **Strike** wrap the link
(`**[label](url)**`) rather than dropping marks inside the label, and **Edit
link** still targets it. The same applies inside an editable table cell.

### Picking and ordering the groups

`contextMenu` also takes an object to choose which top-level groups appear and
in what order:

```tsx
inPlace={{ contextMenu: { groups: ["paragraph", "insert", "clipboard"] } }}
```

`groups` is any subset of `"host" | "link" | "format" | "paragraph" | "insert" |
"clipboard"`, in the order you want them (separated in the rendered menu). Omit
it for all six in the default order (`host` first). `link` and `format` still yield to
`selectionUI` — listing them has no effect when the marks live on the bar or the
toolbar. The table-cell and fenced-code contexts honour `format` / `clipboard`
from the list but are otherwise fixed.

### Host items

`contextMenu.items` adds the host's own entries, the way `toolbar.items` adds
buttons. They are drawn as the `host` group, which is **first** unless `groups`
places it elsewhere; a `groups` list without `"host"` hides them.

```tsx
inPlace={{
  contextMenu: {
    items: [
      {
        id: "comment",
        title: "Comment",
        icon: <CommentIcon />, // or a stroke-path string, like the built-in rows
        when: "selection",
        readOnlySafe: true,
        run: (view) => openCommentBox(view.state.selection.main),
      },
    ],
  },
}}
```

| Field          | Meaning                                                                                                                                      |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`           | Stable identity; the row carries `data-menu-item="<id>"` for styling.                                                                        |
| `title`        | The label.                                                                                                                                   |
| `icon`         | A stroke-path string, or any element that renders to an SVG. An element is rendered once and copied as static markup: no state, no handlers. |
| `run(view)`    | Called with the live view, the selection as it was when the menu opened (a right-click on a word selects it first).                          |
| `disabled`     | `(state) => boolean`, read each time the menu opens; the row is greyed.                                                                      |
| `when`         | `"selection"` (non-empty selection only), `"no-selection"`, or `"always"` (default).                                                         |
| `readOnlySafe` | Offer the item in a read-only note. Without it the item is hidden there, like every built-in row. Use it only for an item that never edits.  |

The group appears in every context the menu has: the canvas, a fenced code
block, the divider menu and an editable table cell (above **Format**, under the
structural rows). A `when: "selection"` item simply hides where nothing is
selected, such as on the divider. In a table cell the selection lives in the
DOM, so just before `run` the selected text is mapped to its range in the
document and set as the state selection; the cell keeps focus.

A **read-only** note shows no built-in row (they all edit), so its menu opens
only when a listed `readOnlySafe` item applies to the selection; otherwise the
browser's own menu is left alone.

### On touch

A right-click has no touch equivalent, so a **long-press** (roughly half a
second, holding still) opens the same menu — both the canvas menu and the
editable table's structural menu. A tap outside closes it. On a coarse-pointer
device the table's edge `+` "add row" / "add column" strips, hover-only on a
mouse, stay faintly visible so they can be tapped.

The long-press path is unit-tested; the gesture has not yet been through a
hands-on pass on real iOS / Android hardware. On iOS in particular the system's
own text-selection callout may still appear alongside Stylo's menu — Stylo does
not suppress it (that would also remove the native paste bubble).

## `inPlace.selectionUI`

Optional, defaults to `"menu"`. Picks the affordance a non-empty text selection
gets. Only one applies at a time, so the same buttons never appear twice.

| Value    | A selection gets                                                                                                                           |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `"menu"` | The inline-mark group inside the right-click menu (bold / italic / strike / code, Link and Wikilink fields, inline math). No floating bar. |
| `"bar"`  | A floating bar above the selection with those same inline-mark buttons; the right-click menu drops its inline group.                       |
| `"none"` | Neither — the main toolbar is the only formatting surface.                                                                                 |

The main editor toolbar is independent of this setting: it is always present
unless hidden through the `toolbar` prop, and it always acts on the current
selection.

The floating bar's link and wikilink buttons open the same URL / target field
the right-click menu uses, rather than dropping a `[text](url)` / `[[target]]`
placeholder.

The bar also follows a text selection **inside an editable table cell**
(`table: "cells"`), where the mark buttons apply to the cell; the link and
wikilink buttons there fall back to the plain toggle, since the field editor
works on the document selection.

### `inPlace.selectionBarItems`

Optional. An ordered subset of `bold` / `italic` / `strike` / `code` / `link` /
`wikilink` / `math` — the bar shows exactly these, in this order. Omit for all
seven. Unknown ids are ignored; an empty or all-invalid list falls back to the
default.

```tsx
inPlace={{ selectionUI: "bar", selectionBarItems: ["bold", "italic", "link"] }}
```

Both surfaces are styled through stable class names — `.cm-inplace-menu`,
`.cm-inplace-menu-item`, `.cm-inplace-selbar`, `.cm-inplace-selbar-btn` — and
inherit the `--stylo-*` tokens. Specified in the
[right-click menu and selection bar note](../../journal/2026-09/2026-09-03_context-menu-and-selection-bar.md)
and the [ADR-002 §Deferred amendment](../../journal/2026-09/2026-09-01_adr-002-editor-ux-and-customization.md).

## Callouts

A blockquote whose first line is `> [!type]` (optionally `> [!type] Title`, or a
`-` / `+` fold marker that Stylo parses but ignores) renders as a tinted box on
both the in-place canvas and the preview surface. The many Obsidian type names
collapse to five colour buckets — `note`, `tip`, `warn`, `danger`, `example` —
and the raw type is kept on a `data-callout` attribute that a `::before` label
reads. Off-caret the `[!type]` token is hidden and the rest of the line is the
title. Gated by `decorations.blockquote`.

Style hooks: `.cm-inplace-callout` / `.cm-inplace-callout-<bucket>` /
`.cm-inplace-callout-head` on the canvas, `.stylo-callout` /
`.stylo-callout-<bucket>` in preview. Each bucket sets `--stylo-callout-accent`
from `--stylo-callout-<bucket>` (`#3b82f6` / `#22c55e` / `#f59e0b` / `#ef4444` /
`#a855f7` by default) — override either level to reskin.

## Link & wikilink hover

Hovering a link or `[[wikilink]]` in the canvas shows a small bubble with its
destination — the raw `(url)` or the `[[target]]`. Under `reveal: "never"` that
destination is otherwise never on screen, so this is the way to read it without
turning the link into an edit. Gated by `decorations.links` /
`decorations.wikilinks`; styled through `.cm-inplace-href-tip`.

A rendered `$…$` / one-line `$$…$$` math widget gets the same treatment —
hovering it shows its raw LaTeX, and clicking it opens the same **Math** field
the right-click menu uses, at the pointer. Gated by `decorations.math`. A
multi-line `$$` block is unaffected — it keeps its existing caret-reveal, the
way a fenced code block did before it got the same treatment (ADR-007
rollout log).

## Autoformat on type

On the canvas, a few Markdown shorthands expand as you finish typing them, so
the seamless surface never leaves you looking at a raw marker. Each expansion is
folded into the triggering keystroke's own transaction, so a single undo returns
the literal text. Specified in
[ADR-007](../../journal/2026-09/2026-09-03_adr-007-seamless-in-place.md) (Stage 5).

| You type                                | You get                                                                                                                                                                                                                         |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `[] ` / `[ ] ` at the start of a line   | `- [ ] ` — a task item                                                                                                                                                                                                          |
| ` ``` ` or `$$` alone on a line         | the block scaffolded with its closing fence, caret on the empty line between                                                                                                                                                    |
| `---` / `***` / `___` completing a line | a thematic break; a blank line is inserted above a `---` that sits directly under text so it is a rule, not a Setext `<h2>` underline, and a trailing newline is added when the rule is the last line so the caret steps off it |

`# `, `- `, `> ` and the other line prefixes need no expansion — their markers
already hide as they are typed. Numbered-list markers keep their visible number,
and inline `**…**` / `` `…` `` / `[…](…)` collapse on their own once the closing
pair is typed. Pasted Markdown is **not** autoformatted — the rules fire only on
single-character typing.

## Applied at mount

The **entire `inPlace` object** — `decorations`, `table`, `reveal`,
`contextMenu`, `selectionUI`, `selectionBarItems` — is read once, when the
in-place canvas is constructed. Changing it on an already-mounted `<Stylo>` has
no effect. This is a deliberate contract, not a gap: it is applied through the
CodeMirror extension configuration, the same way `codeLanguages` and the
toolbar shortcuts are, and a live-reconfiguration path was evaluated and
rejected in the
[ADR-005 config-lifecycle amendment](../../journal/2026-09/2026-09-01_adr-005-in-place-decoration-toggles.md).

To apply a change, remount the component with a `key` derived from the config:

```tsx
<Stylo
  key={inPlace.table} // or a hash of the whole config
  value={doc}
  onChange={setDoc}
  inPlace={inPlace}
/>
```

`value`, `onChange`, the callback props, `readOnly`, `placeholder`, `toolbar`,
and `icons` are all fully reactive — only `inPlace` and `codeLanguages` need
the remount.

## Not in this pass

Deferred, each its own later decision:

- `inPlace.frontmatter` — a `source` / `inline` / `properties` display mode; the
  `properties` panel needs YAML parsing and its own dependency.
- Drag-to-reorder rows / columns and multi-cell selection on the `"cells"` widget.
- A consumer-supplied decorator hook for custom in-place node types.

See the [in-place canvas tracker](../../journal/2026-09/2026-09-01_in-place-canvas.md)
for what each of the twelve constructs above does when it is on.
