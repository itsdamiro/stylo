/**
 * The host's own right-click entries (`contextMenu.items`) as menu rows. The
 * group is built the same way wherever it shows — the canvas, a fenced block,
 * the divider menu, a table cell — differing only in what "selected" means and
 * what must happen just before `run` (a table cell's selection lives in the
 * DOM, so the caller maps it into `state.selection` first).
 */

import type { EditorView } from "@codemirror/view"
import { flushSync } from "react-dom"
import { createRoot } from "react-dom/client"
import type { ContextMenuItem } from "../types"
import type { MenuAction, MenuRow } from "./context-menu"
import { hostItemsFacet, menuGroupsFacet } from "./config"

export interface HostRowsContext {
  /** Whether there is a selection to act on; decides `when`. */
  selected: boolean
  /** Runs right before an item's `run` — e.g. to land a cell selection in the state. */
  prepare?: () => void
}

/** A `ReactNode` icon, rendered once to a detached element. Cloned per row. */
const iconCache = new WeakMap<object, Node | null>()

function renderIcon(icon: ContextMenuItem["icon"], key: ContextMenuItem): Node | null {
  if (icon == null || typeof icon === "string") return null
  if (iconCache.has(key)) return iconCache.get(key) ?? null
  const host = document.createElement("span")
  const root = createRoot(host)
  let node: Node | null = null
  try {
    flushSync(() => root.render(icon))
    node = host.firstElementChild
  } catch {
    // A host icon that throws costs the row its glyph, not the whole menu.
  }
  root.unmount()
  iconCache.set(key, node)
  return node
}

/** The host group is on the menu at all (it is listed in `groups`). */
const listed = (view: EditorView) => view.state.facet(menuGroupsFacet).includes("host")

/** Whether a read-only note has anything to offer: a listed, `readOnlySafe` item. */
export const hasReadOnlyItems = (view: EditorView): boolean =>
  listed(view) &&
  view.state
    .facet(hostItemsFacet)()
    .some((i) => i.readOnlySafe)

export function hostRows(view: EditorView, ctx: HostRowsContext): MenuRow[] {
  if (!listed(view)) return []
  const readOnly = view.state.readOnly
  const rows: MenuAction[] = []
  for (const item of view.state.facet(hostItemsFacet)()) {
    if (readOnly && !item.readOnlySafe) continue
    const when = item.when ?? "always"
    if (when === "selection" && !ctx.selected) continue
    if (when === "no-selection" && ctx.selected) continue
    const node = renderIcon(item.icon, item)
    rows.push({
      id: item.id,
      label: item.title,
      icon: typeof item.icon === "string" ? item.icon : undefined,
      iconNode: node ?? undefined,
      disabled: item.disabled?.(view.state) ?? false,
      onSelect: () => {
        ctx.prepare?.()
        item.run(view)
      },
    })
  }
  return rows
}
