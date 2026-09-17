import { useEffect, useReducer, useRef, useState } from "react"
import type { ReactNode } from "react"
import type { EditorState } from "@codemirror/state"
import type { EditorView } from "@codemirror/view"
import styles from "../styles/stylo.module.css"
import type { ToolbarCommandId } from "../types"
import { activeTableCell } from "./cell-inline"
import { resolveForCell } from "./command-helpers"
import { BUILTIN_BY_ID } from "./commands"
import type { ToolbarItem } from "./config"
import { useFloatingWatchdog } from "./floating-watchdog"
import { DEFAULT_ICONS } from "./icons"
import { useKeyboardInset } from "./keyboard-inset"

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
}

/** A button to render, normalised from a built-in id or a custom item. */
interface Btn {
  key: string
  icon: ReactNode
  title: string
  run: (view: EditorView) => unknown
  isActive?: (state: EditorState) => boolean
  disabled?: (state: EditorState) => boolean
}

/**
 * Splits `items` into the runs a `"|"` already delimits, keeping each
 * separator as its own entry. A run renders as one flex child so wrapping
 * (on narrow hosts) breaks between groups, never in the middle of one — the
 * default bar's `undo, redo | h1, h2, h3 | ...` shape becomes the wrap unit
 * for free, no separate grouping config needed.
 */
function groupItems(items: ToolbarItem[]): (Exclude<ToolbarItem, "|">[] | "|")[] {
  const groups: (Exclude<ToolbarItem, "|">[] | "|")[] = []
  let run: Exclude<ToolbarItem, "|">[] = []
  for (const item of items) {
    if (item !== "|") {
      run.push(item)
      continue
    }
    if (run.length) groups.push(run)
    run = []
    groups.push("|")
  }
  if (run.length) groups.push(run)
  return groups
}

/** Resolve one non-separator item to a renderable button, or `null` to skip it. */
function toButton(item: Exclude<ToolbarItem, "|">, icons: ToolbarProps["icons"]): Btn | null {
  if (typeof item !== "string") {
    const { id, icon, title, run, isActive, disabled } = item
    return { key: id, icon, title, run, isActive, disabled }
  }
  const cmd = BUILTIN_BY_ID[item]
  if (!cmd) return null
  return {
    key: item,
    icon: icons?.[item] ?? DEFAULT_ICONS[item],
    title: cmd.title,
    run: cmd.run,
    isActive: cmd.isActive,
    disabled: cmd.disabled,
  }
}

/**
 * Formatting bar above the editing surface. It holds no document state — each
 * button runs a command against the live `EditorView`. Pressed states are read
 * back from the view whenever the selection, keys, or pointer move. Built-in
 * ids and consumer-supplied {@link ToolbarCustomItem}s render through the same
 * button path.
 */
export function Toolbar({ view, items, icons, disabled, sticky, stickyVisibility }: ToolbarProps) {
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

  const className = [
    styles.toolbar,
    sticky && styles.toolbarSticky,
    sticky === "top" && styles.toolbarStickyTop,
    sticky === "bottom" && styles.toolbarStickyBottom,
    dynamicHidden && styles.toolbarStickyHidden,
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

  return (
    <div
      ref={barRef}
      className={className}
      role="toolbar"
      aria-label="Formatting"
      aria-hidden={dynamicHidden || undefined}
      style={stickyStyle}
    >
      {groupItems(items).map((group, i) => {
        if (group === "|") {
          return <span key={`sep-${i}`} className={styles.toolbarSep} aria-hidden="true" />
        }
        return (
          <div key={`group-${i}`} className={styles.toolbarGroup}>
            {group.map((item) => {
              const btn = toButton(item, icons)
              if (!btn) return null
              // Only a built-in command is cell-aware — a host's own
              // `ToolbarCustomItem` keeps reading `state` exactly as before;
              // it has no notion of a table cell to degrade into.
              const builtin = typeof item === "string" ? BUILTIN_BY_ID[item] : undefined
              const resolved = view
                ? builtin
                  ? resolveForCell(view.state, builtin, inCell)
                  : {
                      disabled: Boolean(btn.disabled?.(view.state)),
                      active: Boolean(btn.isActive?.(view.state)),
                    }
                : { disabled: true, active: false }
              const off = disabled || !view || resolved.disabled
              const active = !off && resolved.active
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
                  onClick={() => {
                    if (!view) return
                    btn.run(view)
                    refresh()
                  }}
                >
                  {btn.icon}
                </button>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}
