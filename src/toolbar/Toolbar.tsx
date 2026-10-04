import { useEffect, useReducer, useRef, useState } from "react"
import type { ReactNode } from "react"
import type { EditorView } from "@codemirror/view"
import styles from "../styles/stylo.module.css"
import type { ToolbarCommandId } from "../types"
import { activeTableCell } from "./cell-inline"
import { resolveForCell } from "./command-helpers"
import { BUILTIN_BY_ID } from "./commands"
import type { ToolbarItem } from "./config"
import { useFloatingWatchdog } from "./floating-watchdog"
import { useKeyboardInset } from "./keyboard-inset"
import { OverflowBar } from "./OverflowBar"
import { groupItems, toButton } from "./toolbar-model"
import type { Btn, Resolved } from "./toolbar-model"

export interface ToolbarProps {
  /** The surface the commands act on. `null` while a lazy view is mounting. */
  view: EditorView | null
  /** Ordered items to render; `"|"` is a separator. */
  items: ToolbarItem[]
  /** Per-id glyph overrides; any id left out keeps its built-in icon. */
  icons?: Partial<Record<ToolbarCommandId, ReactNode>>
  /** Render every button inert (e.g. a read-only surface). */
  disabled?: boolean
  /** Fix the bar to a window edge (normalised from `ToolbarConfig.sticky`; the
   *  caller resolves `true` to `"bottom"`). */
  sticky?: "top" | "bottom" | false
  /** Fade the bar out while the editing surface is unfocused (`ToolbarConfig.stickyVisibility`). */
  stickyVisibility?: "consistent" | "dynamic"
  /** `"menu"` folds buttons that do not fit into a trailing menu instead of wrapping. */
  overflow?: "wrap" | "menu"
  /** Glyph for the overflow menu's button. */
  overflowIcon?: ReactNode
}

/**
 * Formatting bar above the editing surface. It holds no document state — each
 * button runs a command against the live `EditorView`. Pressed states are read
 * back from the view whenever the selection, keys, or pointer move. Built-in
 * ids and consumer-supplied {@link ToolbarCustomItem}s render through the same
 * button path.
 */
export function Toolbar({
  view,
  items,
  icons,
  disabled,
  sticky,
  stickyVisibility,
  overflow,
  overflowIcon,
}: ToolbarProps) {
  const [, refresh] = useReducer((n: number) => n + 1, 0)
  const [focused, setFocused] = useState(false)
  // Only "bottom" needs keyboard tracking — nothing eats into the top of the
  // screen the way a keyboard eats the bottom.
  const keyboardInset = useKeyboardInset(sticky === "bottom")
  const barRef = useRef<HTMLDivElement>(null)
  useFloatingWatchdog(barRef, sticky === "top")

  useEffect(() => {
    if (!view) return
    const el = view.contentDOM
    setFocused(view.hasFocus)
    const onFocus = () => {
      setFocused(true)
      refresh()
    }
    const onBlur = () => {
      setFocused(false)
      refresh()
    }
    const events = ["keyup", "mouseup", "input"] as const
    for (const ev of events) el.addEventListener(ev, refresh)
    el.addEventListener("focus", onFocus)
    el.addEventListener("blur", onBlur)
    return () => {
      for (const ev of events) el.removeEventListener(ev, refresh)
      el.removeEventListener("focus", onFocus)
      el.removeEventListener("blur", onBlur)
    }
  }, [view])

  // "dynamic" fades the bar out while nothing is focused, so it doesn't sit
  // over the content while the caret is elsewhere (e.g. scrolling to read).
  const dynamicHidden = Boolean(sticky) && stickyVisibility === "dynamic" && !focused

  // `state.selection` never follows the caret into an editable table cell's
  // `contentEditable` DOM (see `extension.ts`'s mousedown handler), so a
  // built-in command's own `disabled` / `isActive` would otherwise read a
  // selection that may point anywhere else in the document while the user is
  // actually typing in a cell. `resolveForCell` below re-derives both from the
  // real DOM focus in that case instead.
  const inCell = view ? Boolean(activeTableCell(view)) : false

  const menuMode = overflow === "menu"

  const className = [
    styles.toolbar,
    sticky && styles.toolbarSticky,
    sticky === "top" && styles.toolbarStickyTop,
    sticky === "bottom" && styles.toolbarStickyBottom,
    dynamicHidden && styles.toolbarStickyHidden,
    menuMode && styles.toolbarOverflow,
  ]
    .filter(Boolean)
    .join(" ")
  // `transform`, not `bottom` — a `position: fixed` element repositioned via
  // `bottom` doesn't reliably repaint in step with the keyboard animation on
  // iOS Safari; `translateY` forces a compositor update on every
  // `visualViewport` event instead. The bar's resting position (keyboard
  // closed) is `bottom: 0` in CSS; this only nudges it up. `"top"` needs no
  // offset at all.
  const stickyStyle =
    sticky === "bottom" ? { transform: `translateY(-${keyboardInset}px)` } : undefined

  /** A slot's button plus its live disabled / pressed state, or `null` to skip it. */
  const resolveItem = (item: Exclude<ToolbarItem, "|">): Resolved | null => {
    const btn = toButton(item, icons)
    if (!btn) return null
    // Only a built-in command is cell-aware — a host's own `ToolbarCustomItem`
    // keeps reading `state` exactly as before; it has no notion of a table
    // cell to degrade into.
    const builtin = typeof item === "string" ? BUILTIN_BY_ID[item] : undefined
    const resolved = view
      ? builtin
        ? resolveForCell(view.state, builtin, inCell)
        : {
            disabled: Boolean(btn.disabled?.(view.state)),
            active: Boolean(btn.isActive?.(view.state)),
          }
      : { disabled: true, active: false }
    const off = Boolean(disabled || !view || resolved.disabled)
    return { btn, off, active: !off && resolved.active }
  }

  const run = (btn: Btn) => {
    if (!view) return
    btn.run(view)
    refresh()
  }

  const renderItem = (item: Exclude<ToolbarItem, "|">) => {
    const r = resolveItem(item)
    if (!r) return null
    const { btn, off, active } = r
    return (
      <button
        key={btn.key}
        type="button"
        className={styles.toolbarButton}
        data-command={btn.key}
        title={btn.title}
        aria-label={btn.title}
        aria-pressed={btn.isActive ? active : undefined}
        data-active={active ? "" : undefined}
        disabled={off}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => run(btn)}
      >
        {btn.icon}
      </button>
    )
  }

  const content = menuMode ? (
    <OverflowBar
      items={items}
      icons={icons}
      overflowIcon={overflowIcon}
      resolve={resolveItem}
      run={run}
      renderItem={renderItem}
    />
  ) : (
    groupItems(items).map((group, i) =>
      group === "|" ? (
        <span key={`sep-${i}`} className={styles.toolbarSep} aria-hidden="true" />
      ) : (
        <div key={`group-${i}`} className={styles.toolbarGroup}>
          {group.map(renderItem)}
        </div>
      ),
    )
  )

  return (
    <div
      ref={barRef}
      className={className}
      role="toolbar"
      aria-label="Formatting"
      aria-hidden={dynamicHidden || undefined}
      style={stickyStyle}
    >
      {content}
    </div>
  )
}
