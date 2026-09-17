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
 * submenu; `insert` the new-block submenu; `clipboard` cut / copy / paste.
 */
export type MenuGroupId = "link" | "format" | "paragraph" | "insert" | "clipboard"

export interface ContextMenuConfig {
  /**
   * Which top-level groups the menu shows, in order. Omit for all five in their
   * default order. `link` and `format` still yield to `selectionUI` when it is
   * not `"menu"` (they move to the floating bar / toolbar).
   */
  groups?: MenuGroupId[]
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
}
