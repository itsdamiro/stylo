import type { ReactNode } from "react"
import type { EditorState } from "@codemirror/state"
import type { EditorView } from "@codemirror/view"
import type { ToolbarCommandId } from "../types"
import { BUILTIN_BY_ID } from "./commands"
import type { ToolbarItem } from "./config"
import { DEFAULT_ICONS } from "./icons"

/** A button to render, normalised from a built-in id or a custom item. */
export interface Btn {
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
export function groupItems(items: ToolbarItem[]): (Exclude<ToolbarItem, "|">[] | "|")[] {
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
export function toButton(
  item: Exclude<ToolbarItem, "|">,
  icons: Partial<Record<ToolbarCommandId, ReactNode>> | undefined,
): Btn | null {
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

/** A slot's button plus its live disabled / pressed state. */
export interface Resolved {
  btn: Btn
  off: boolean
  active: boolean
}
