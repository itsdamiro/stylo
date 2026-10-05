import type { EditorState } from "@codemirror/state"
import type { EditorView } from "@codemirror/view"
import type { ReactNode } from "react"
import type { ToolbarCommandId } from "./toolbar"

/**
 * Per-construct on/off switches for the in-place canvas. Each key defaults to
 * `true`; setting one `false` leaves that construct as plain source — no
 * decoration, no cursor-reveal behaviour. See ADR-005.
 */
export interface InPlaceDecorationToggles {
  headings?: boolean
  emphasis?: boolean
  links?: boolean
  wikilinks?: boolean
  math?: boolean
  lists?: boolean
  tasks?: boolean
  blockquote?: boolean
  horizontalRule?: boolean
  code?: boolean
  frontmatter?: boolean
  tables?: boolean
  /** `![[ref]]` transclusion blocks. Needs `embedSource` set; see ADR-009. */
  embeds?: boolean
}

/**
 * How the in-place canvas handles editing a table.
 * `"source"` (default) reveals the aligned pipe source under the caret;
 * `"cells"` keeps the rendered `<table>` and edits its cells in place.
 */
export type TableEditing = "source" | "cells"

/**
 * Whether the in-place canvas shows a construct's Markdown markers when the
 * caret is on its line. `"caret"` (default) reveals them for editing and
 * re-hides them on the way out — Obsidian's Live Preview. `"never"` keeps every
 * inline marker hidden at all times; formatting is changed through the toolbar,
 * the right-click menu, shortcuts, and autoformat-on-type instead. See ADR-007;
 * `"never"` is being rolled out in stages.
 */
export type RevealMode = "caret" | "never"

/**
 * What appears when text is selected in the in-place canvas. `"menu"` (default)
 * puts the inline-formatting group in the right-click menu and shows no floating
 * bar; `"bar"` shows a floating bar above the selection and drops that group
 * from the menu so nothing is doubled; `"none"` shows neither and leaves the
 * main toolbar as the only formatting surface. The toolbar is independent of
 * this setting — it is always available (unless hidden via `toolbar`) and always
 * acts on the selection.
 */
export type SelectionUI = "menu" | "bar" | "none"

/**
 * The right-click menu's top-level groups. `link` is the internal / external
 * link field rows; `format` the inline-mark submenu; `paragraph` the block-type
 * submenu; `insert` the new-block submenu; `clipboard` cut / copy / paste;
 * `host` the entries the host passes as `contextMenu.items`.
 */
export type MenuGroupId = "host" | "link" | "format" | "paragraph" | "insert" | "clipboard"

/**
 * A host-supplied right-click entry (`contextMenu.items`), the menu's parallel
 * of a custom toolbar button. `run` gets the live view with the selection as it
 * was when the menu opened — inside a table cell too, where the selected text
 * is mapped back to its range in the document first. `info.rect` is the screen
 * rectangle of that selection (a cell's selected text, or the cell itself with
 * none), to anchor a popover beside it.
 */
export interface ContextMenuItem {
  /** Stable identity; exposed on the row as `data-menu-item`. */
  id: string
  /** The row's label. */
  title: string
  /**
   * A leading glyph: stroke-path data like the built-in rows (`|` separates
   * paths), or any element that renders to an SVG. An element is rendered once
   * and copied as static markup, so it cannot hold state or handlers.
   */
  icon?: string | ReactNode
  run: (view: EditorView, info: { rect: DOMRect }) => void
  /** Greyed and not selectable while true. Read each time the menu opens. */
  disabled?: (state: EditorState) => boolean
  /**
   * `"selection"` shows the item only with a non-empty selection, `"no-selection"`
   * only without one. Defaults to `"always"`.
   */
  when?: "selection" | "no-selection" | "always"
  /**
   * Offer the item in a read-only note. Without it the item is hidden there,
   * like every built-in row. Use it only for an item that does not edit the
   * document (a comment kept apart from the text).
   */
  readOnlySafe?: boolean
}

export interface ContextMenuConfig {
  /**
   * Which top-level groups the menu shows, in order. Omit for all six in their
   * default order (`host` first). `link` and `format` still yield to
   * `selectionUI` when it is not `"menu"` (they move to the floating bar /
   * toolbar). A list without `"host"` hides the host items.
   */
  groups?: MenuGroupId[]
  /**
   * The host's own entries, drawn as the `host` group. Unlike the rest of
   * `inPlace`, read each time the menu opens, so a re-render's `run` closures
   * apply.
   */
  items?: ContextMenuItem[]
}

/**
 * A host mark in document positions, drawn on the characters of a table cell
 * that fall inside `from`–`to`: they are wrapped in an element carrying `class`
 * and `attributes`, and `cellClass` is added to the `<td>` / `<th>` holding them.
 */
export interface CellMark {
  from: number
  to: number
  class: string
  attributes?: Record<string, string>
  cellClass?: string
}

/**
 * A host element placed inside a table cell, after the characters that end at
 * document position `pos`. Stylo keeps it out of the cell's text and Markdown.
 * It is shown while the cell is not being edited.
 */
export interface CellWidget {
  pos: number
  /** Builds the element. Called again whenever the cell is repainted. */
  toDOM: (view: EditorView) => HTMLElement
  /**
   * Identity of what `toDOM` draws. A cell is repainted only when its widgets'
   * `pos` or `key` change, so the key must change whenever the drawing does,
   * or a stale element stays in the cell.
   */
  key: string
  /** Added to the `<td>` / `<th>` holding the widget. */
  cellClass?: string
}

export interface InPlaceConfig {
  /** Which decoration types the in-place canvas renders. Read once, at mount. */
  decorations?: InPlaceDecorationToggles
  /** Table editing mode (see `TableEditing`). Read once, at mount. */
  table?: TableEditing
  /**
   * Marker reveal behaviour (see `RevealMode`). Optional, defaults to
   * `"caret"`. Read once, at mount.
   */
  reveal?: RevealMode
  /**
   * Right-click a block for a context menu (inline actions on a selection,
   * block + insert actions otherwise). `false` keeps the browser's own menu; an
   * object picks and orders the menu's groups. Defaults to `true`. Read once,
   * at mount.
   */
  contextMenu?: boolean | ContextMenuConfig
  /**
   * What a non-empty selection offers (see `SelectionUI`). Defaults to
   * `"menu"`. Read once, at mount.
   */
  selectionUI?: SelectionUI
  /**
   * Which buttons the floating selection bar shows (`selectionUI: "bar"`), in
   * order. Any of `bold` / `italic` / `strike` / `code` / `link` / `wikilink` /
   * `math`. Omit for all seven. Read once, at mount.
   */
  selectionBarItems?: ToolbarCommandId[]
  /**
   * Marks to draw inside table cells (`table: "cells"`), where a host's
   * `Decoration.mark` cannot reach. Called with the state whenever the document
   * or the host's state changes; the affected cells are repainted. Read through
   * a ref, so a re-render's closure applies; a change outside the editor state
   * shows on the next editor update (dispatch an empty transaction).
   */
  cellMarks?: (state: EditorState) => readonly CellMark[]
  /**
   * Elements to draw inside table cells (`table: "cells"`), where a host's
   * `Decoration.widget` cannot reach. Read like `cellMarks`. A cell being edited
   * shows its raw source and no widgets; they return when it loses focus.
   */
  cellWidgets?: (state: EditorState) => readonly CellWidget[]
}
