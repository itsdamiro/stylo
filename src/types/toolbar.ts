import type { ReactNode } from "react"
import type { EditorState } from "@codemirror/state"
import type { EditorView } from "@codemirror/view"

/**
 * Built-in toolbar command identifiers. In a `ToolbarConfig["items"]` list,
 * `"|"` inserts a visual separator. See ADR-002 §2.
 */
export type ToolbarCommandId =
  | "undo"
  | "redo"
  | "save"
  | "search"
  | "h1"
  | "h2"
  | "h3"
  | "body"
  | "bold"
  | "italic"
  | "strike"
  | "underline"
  | "code"
  | "codeBlock"
  | "link"
  | "wikilink"
  | "quote"
  | "bulletList"
  | "orderedList"
  | "task"
  | "hr"
  | "frontmatter"
  | "table"
  | "math"
  | "mathBlock"

/**
 * A consumer-supplied toolbar button. Mixed into `ToolbarConfig["items"]`
 * alongside the built-in ids. It runs against the same live `EditorView` the
 * built-ins do; `isActive` / `disabled` are read back from the state on every
 * selection, key, and pointer change, exactly like a built-in.
 *
 * No `keys` field: built-in shortcuts are compiled into CodeMirror's keymap at
 * editor construction, so a custom binding would need its own keymap. Bind it
 * yourself against `getView()` for now.
 */
export interface ToolbarCustomItem {
  /**
   * Stable identity, also the React key. Must not collide with a built-in id
   * (`bold`, `h1`, …) or another custom item.
   */
  id: string
  /** Tooltip and accessible label. */
  title: string
  /** Button content — an inline SVG, a glyph, a short label. */
  icon: ReactNode
  /** Run against the live view. The return value is ignored. */
  run: (view: EditorView) => void
  /** Reflected as the button's pressed state (`aria-pressed`, `data-active`). */
  isActive?: (state: EditorState) => boolean
  /** When true, the button is rendered `disabled`. */
  disabled?: (state: EditorState) => boolean
  /**
   * With `toolbar.overflow: "menu"`, a pinned item is the last to fold into the
   * overflow menu — for the buttons a user must always reach (Save). Ignored
   * in the default wrapping mode.
   */
  pinned?: boolean
}

/** One rendered slot: a built-in id, a `"|"` separator, or a custom button. */
export type ToolbarItem = ToolbarCommandId | "|" | ToolbarCustomItem

export interface ToolbarConfig {
  /**
   * Ordered toolbar slots — built-in command ids, `"|"` separators, and
   * {@link ToolbarCustomItem} objects, in any order. Omit for the full default
   * bar.
   */
  items?: ToolbarItem[]
  /**
   * Wrap or replace the rendered bar. `bar` is the built-in
   * `<div role="toolbar">` element; return it wrapped, with extra chrome
   * appended, or ignore it entirely and return your own. `view` is `null` until
   * the surface has mounted.
   */
  render?: (bar: ReactNode, ctx: { view: EditorView | null }) => ReactNode
  /**
   * Fix the bar to an edge of the **window** instead of wherever `<Stylo>`
   * sits on the page. `"bottom"` (or `true`) rides above the on-screen
   * keyboard, tracked via the `visualViewport` API; `"top"` pins to the top
   * edge, which needs no keyboard tracking and can't be covered by it or by a
   * platform's own input accessory bar. Off (`false`, the default) is right
   * for a small embedded field; a host opts in deliberately for a
   * full-screen editor. See the toolbar reference's "On touch" section.
   */
  sticky?: boolean | "top" | "bottom"
  /**
   * When `sticky` is set, whether the bar stays on screen the whole time
   * (`"consistent"`, the default) or only while the editing surface actually
   * has focus (`"dynamic"`) — faded out otherwise, so it doesn't sit over the
   * content while the caret is elsewhere. Ignored when `sticky` is off.
   */
  stickyVisibility?: "consistent" | "dynamic"
  /**
   * What the bar does when its buttons do not fit. `"wrap"` (the default)
   * breaks onto further lines between groups. `"menu"` keeps one row: the
   * buttons that fit stay, the rest fold in order into a trailing "more"
   * button that opens them as a menu. Re-measured whenever the bar's width or
   * its items change.
   */
  overflow?: "wrap" | "menu"
  /** The "more" button's glyph when `overflow` is `"menu"`. Defaults to `⋯`. */
  overflowIcon?: ReactNode
}
