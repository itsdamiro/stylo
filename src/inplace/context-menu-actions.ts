/**
 * Maps the shared toolbar command set onto rows for the in-place right-click
 * menu. One shape everywhere (Obsidian style): the link rows, then Format /
 * Paragraph / Insert submenus, then clipboard. Every command already carries
 * its own `run` / `isActive` / `disabled`, so an item that can't apply where
 * the caret sits is greyed, not hidden — the menu shape stays put.
 *
 * The individual field/action rows for each inline construct live beside that
 * construct's own file — `linkRow` / `wikiLinkRow` in `link-row.ts`, `mathRow`
 * in `math-edit.ts`, `dividerRow` in `edit-divider.ts` — this file is the
 * assembly: which rows a given context offers, and in what order.
 */

import type { EditorView } from "@codemirror/view"
import type { MenuGroupId } from "../types"
import { activeTableCell } from "../toolbar/cell-inline"
import { BUILTIN_BY_ID } from "../toolbar/commands"
import { fenceInfoAt, fencedCodeActive } from "../toolbar/fence"
import { ICON_PATHS } from "../toolbar/icon-paths"
import { menuGroupsFacet, selectionUIFacet } from "./config"
import type { MenuField, MenuRow } from "./context-menu"
import {
  actions,
  clipboardRows,
  FORMAT_CODE_IDS,
  FORMAT_MARK_IDS,
  INSERT_BLOCK_IDS,
  INSERT_INLINE_IDS,
  PARA_HEADING_IDS,
  PARA_LIST_IDS,
  pushGroup,
  submenu,
  toAction,
} from "./context-menu-helpers"
import { dividerRow, onHiddenRule } from "./edit-divider"
import { selectCellRange } from "./host-cell"
import { hostRows } from "./host-items"
import { linkRow, wikiLinkRow } from "./link-row"
import { mathRow } from "./math-edit"
import { selectionOffsets } from "./table-cell-dom"

/**
 * A non-empty text selection inside a focused editable table cell. The cell is a
 * `contenteditable` surface, so this selection lives in the DOM, not in
 * `state.selection` — but the inline commands route through `runInlineInCell`,
 * so the Format group still applies.
 */
export function cellHasSelection(view: EditorView): boolean {
  const cell = activeTableCell(view)
  if (!cell) return false
  const { from, to } = selectionOffsets(cell)
  return to > from
}

/**
 * The "Language" row shown when the caret is in a fenced code block: an
 * editable info string (` ```ts `), plus **Remove code block** to unwrap it.
 * The opening fence line is hidden in the seamless canvas, so this is the way
 * to reach the language at all.
 */
export function codeBlockRow(view: EditorView): MenuField {
  const info = fenceInfoAt(view.state)
  return {
    field: true,
    label: "Language",
    icon: ICON_PATHS.codeBlock,
    value: info?.lang ?? "",
    placeholder: "ts, python, …",
    onSubmit: (lang) => {
      if (info) view.dispatch({ changes: { from: info.from, to: info.to, insert: lang.trim() } })
      view.focus()
    },
    actions: [
      {
        label: "Remove code block",
        onSelect: () => {
          BUILTIN_BY_ID.codeBlock?.run(view)
          view.focus()
        },
      },
    ],
  }
}

/**
 * Bold / Italic / Strikethrough, then inline code + inline math. In a table
 * cell math stays a plain wrap toggle (`FORMAT_CODE_IDS`); on the canvas it is
 * the `mathRow` field instead, so an existing `$…$` / `$$…$$` span can be
 * rewritten in place — the parallel of the link rows.
 */
const formatGroup = (view: EditorView, inCell = false): MenuRow[] => [
  ...actions(view, FORMAT_MARK_IDS, false, inCell),
  "separator",
  ...(inCell
    ? actions(view, FORMAT_CODE_IDS, false, true)
    : [toAction(view, "code", false)!, mathRow(view)]),
]

/**
 * Rows for an editable table cell: the host items, then — for a non-empty
 * selection — the Format submenu (forced live, see `toAction`) and clipboard,
 * gated by `menuGroups`. Shared by the canvas menu and the table widget's own
 * structural menu, which appends these under its row / column / align actions.
 */
export function cellSelectionRows(view: EditorView): MenuRow[] {
  const groups = view.state.facet(menuGroupsFacet)
  const selected = cellHasSelection(view)
  const rows: MenuRow[] = []
  pushGroup(rows, hostRows(view, { selected, prepare: () => selectCellRange(view) }))
  if (!selected) return rows
  if (groups.includes("format")) {
    pushGroup(rows, [submenu("Format", ICON_PATHS.format, formatGroup(view, true))])
  }
  if (groups.includes("clipboard")) pushGroup(rows, clipboardRows(view))
  return rows
}

/** List types, then heading levels + Body, then quote. Obsidian's "Paragraph". */
const paragraphGroup = (view: EditorView): MenuRow[] => [
  ...actions(view, PARA_LIST_IDS),
  "separator",
  ...actions(view, [...PARA_HEADING_IDS, "body"]),
  "separator",
  ...actions(view, ["quote"]),
]

/** New-block actions. Each still carries its own enabled state. */
const insertGroup = (view: EditorView): MenuRow[] => [
  ...actions(view, INSERT_INLINE_IDS),
  "separator",
  ...actions(view, INSERT_BLOCK_IDS),
]

/**
 * The right-click menu. `menuGroupsFacet` picks and orders the top-level groups
 * (`link` / `format` / `paragraph` / `insert` / `clipboard`); `selectionUI`
 * independently decides whether `link` and `format` live here or on the floating
 * bar. A table-cell selection and a fenced-code caret are focused contexts that
 * ignore the ordering and offer only what applies.
 */
export function menuRows(view: EditorView): MenuRow[] {
  const { state } = view
  const groups = state.facet(menuGroupsFacet)
  const has = (g: MenuGroupId) => groups.includes(g)

  // A table cell only supports inline formatting — no block or insert there.
  // (The editable-table widget shows these under its own structural rows; this
  // path stands in for a cell selection reaching the canvas menu directly.)
  if (cellHasSelection(view)) return cellSelectionRows(view)
  const host = hostRows(view, { selected: !state.selection.main.empty })

  // A fenced code block is a literal context — offer only its language and an
  // unwrap, plus clipboard.
  if (fencedCodeActive(state)) {
    const rows: MenuRow[] = []
    pushGroup(rows, host)
    pushGroup(rows, [codeBlockRow(view)])
    if (has("clipboard")) pushGroup(rows, clipboardRows(view))
    return rows
  }

  // A rendered thematic break — nothing to format or insert on it, so offer a
  // plain removal plus clipboard.
  if (onHiddenRule(state)) {
    const rows: MenuRow[] = []
    pushGroup(rows, host)
    pushGroup(rows, [dividerRow(view)])
    if (has("clipboard")) pushGroup(rows, clipboardRows(view))
    return rows
  }

  const sel = state.selection.main
  const line = state.doc.lineAt(sel.head)
  // Insert drops a brand-new block — the whole submenu is disabled off an empty
  // line (a table mid-paragraph would split it) rather than every item greyed.
  const insertOk = line.text.trim() === ""
  // Nothing to format at a bare caret with no word — wrapping there just drops
  // an empty `****`, which shows as literal marks. The right-click menu selects
  // the word first, so this only bites on a blank line or in whitespace.
  const formatOk = !sel.empty || Boolean(state.wordAt(sel.head))
  // `link` / `format` are on the floating bar / toolbar unless the menu owns them.
  const marksHere = state.facet(selectionUIFacet) === "menu"

  const rows: MenuRow[] = []
  for (const g of groups) {
    if (g === "host") pushGroup(rows, host)
    else if (g === "link" && marksHere) pushGroup(rows, [wikiLinkRow(view), linkRow(view)])
    else if (g === "format" && marksHere)
      pushGroup(rows, [submenu("Format", ICON_PATHS.format, formatGroup(view), !formatOk)])
    else if (g === "paragraph")
      pushGroup(rows, [submenu("Paragraph", ICON_PATHS.paragraph, paragraphGroup(view))])
    else if (g === "insert")
      pushGroup(rows, [submenu("Insert", ICON_PATHS.insert, insertGroup(view), !insertOk)])
    else if (g === "clipboard") pushGroup(rows, clipboardRows(view))
  }
  return rows
}
