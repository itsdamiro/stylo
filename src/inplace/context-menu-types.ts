/** Row and shell shapes for the in-place canvas's right-click menu (`context-menu.ts`). */

export interface MenuAction {
  label: string
  /** Exposed as `data-menu-item`, a hook for consumer styling. */
  id?: string
  /** Stroke-path data for a leading glyph (see `toolbar/icon-paths`). */
  icon?: string
  /** A ready-made glyph, copied into the row. Wins over `icon`. */
  iconNode?: Node
  /** Rendered with emphasis when true. */
  active?: boolean
  /** Shown greyed and not selectable. */
  disabled?: boolean
  /** Native `title` tooltip — e.g. why a disabled row is disabled. */
  title?: string
  onSelect: () => void
}

export interface MenuSubmenu {
  label: string
  icon?: string
  rows: MenuRow[]
  /** Greyed, and its flyout never opens. */
  disabled?: boolean
}

/** A row whose flyout is a single text input plus optional action buttons. */
export interface MenuField {
  field: true
  label: string
  icon?: string
  value: string
  placeholder?: string
  onSubmit: (value: string) => void
  actions?: MenuAction[]
}

export type MenuRow = MenuAction | MenuSubmenu | MenuField | "separator"

export interface ContextMenu {
  /** Append once to a stable container (typically `document.body`). */
  readonly el: HTMLElement
  readonly isOpen: boolean
  /** Render `rows` and show the menu at a viewport point, clamped on-screen. */
  show: (rows: MenuRow[], x: number, y: number) => void
  /** Show a single field panel directly, with no wrapping menu row. */
  showField: (field: MenuField, x: number, y: number) => void
  hide: () => void
  /** Remove the element and drop document listeners. */
  destroy: () => void
}

export const isSubmenu = (r: MenuRow): r is MenuSubmenu => typeof r !== "string" && "rows" in r
export const isField = (r: MenuRow): r is MenuField => typeof r !== "string" && "field" in r
