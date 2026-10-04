/**
 * A pointer-positioned menu shell for the in-place canvas. It owns the popup
 * element, its placement, one level of flyout submenu, and dismissal (outside
 * press, Escape, scroll). It knows nothing about editor commands; the caller
 * passes plain rows with `onSelect` callbacks.
 */

import { iconSvg } from "../toolbar/icon-paths"
import { armDismiss, place, placeFlyout } from "./context-menu-shell"
import { isField, isSubmenu } from "./context-menu-types"
import type { ContextMenu, MenuAction, MenuField, MenuRow } from "./context-menu-types"

export type { MenuAction, MenuSubmenu, MenuField, MenuRow, ContextMenu } from "./context-menu-types"

export function createContextMenu(
  doc: Document,
  className = "cm-inplace-menu",
  onOpenChange?: (open: boolean) => void,
): ContextMenu {
  const win = doc.defaultView
  // A non-interactive full-viewport layer; the panels inside it take pointers.
  const root = doc.createElement("div")
  root.className = className
  root.setAttribute("contenteditable", "false")
  root.hidden = true

  let flyout: HTMLElement | null = null
  let unbind: (() => void) | null = null

  // A flyout is sticky: once open it stays until a different flyout row opens,
  // a plain row is hovered, or the whole menu is dismissed. No hover-out timer
  // — that made the panel close mid-approach on a real mouse path.
  const clearFlyout = () => {
    flyout?.remove()
    flyout = null
  }

  const hide = () => {
    if (root.hidden) return
    clearFlyout()
    root.hidden = true
    root.replaceChildren()
    unbind?.()
    unbind = null
    onOpenChange?.(false)
  }

  // A mousedown inside the menu must not blur the editor before the click fires.
  const holdFocus = (el: HTMLElement) =>
    el.addEventListener("mousedown", (e) => {
      e.preventDefault()
      e.stopPropagation()
    })

  const label = (el: HTMLElement, text: string, icon?: string, node?: Node) => {
    if (node) el.appendChild(node.cloneNode(true))
    else if (icon) el.appendChild(iconSvg(doc, icon))
    const span = doc.createElement("span")
    span.textContent = text
    el.appendChild(span)
  }

  const actionButton = (a: MenuAction): HTMLElement => {
    const b = doc.createElement("button")
    b.type = "button"
    b.className = `${className}-item`
    label(b, a.label, a.icon, a.iconNode)
    if (a.id) b.dataset.menuItem = a.id
    if (a.title) b.title = a.title
    if (a.active) b.dataset.active = ""
    if (a.disabled) {
      b.disabled = true
    } else {
      holdFocus(b)
      // Hovering a plain row dismisses any open flyout (but not one it belongs
      // to — a flyout's own rows call this too and must be ignored).
      b.addEventListener("pointerenter", () => {
        if (!b.closest(`.${className}-panel[data-for]`)) clearFlyout()
      })
      b.addEventListener("click", (e) => {
        e.stopPropagation()
        hide()
        a.onSelect()
      })
    }
    return b
  }

  // A row that opens a flyout panel — used by both submenus and field rows. The
  // flyout is sticky (opens on hover or click, no auto-close timer).
  const flyoutRow = (
    text: string,
    icon: string | undefined,
    build: () => HTMLElement,
    disabled = false,
  ) => {
    const b = doc.createElement("button")
    b.type = "button"
    b.className = `${className}-item ${className}-parent`
    label(b, text, icon)
    if (disabled) {
      b.disabled = true
      return b
    }
    holdFocus(b)
    const open = () => {
      if (flyout?.dataset.for === text) return
      clearFlyout()
      const panel = build()
      panel.dataset.for = text
      root.appendChild(panel)
      placeFlyout(panel, b.getBoundingClientRect(), win)
      flyout = panel
      // `preventScroll` — a focus-induced scroll would trip the menu's own
      // dismiss-on-scroll handler and close it the instant the field opens.
      ;(panel.querySelector("input") as HTMLInputElement | null)?.focus({ preventScroll: true })
    }
    b.addEventListener("pointerenter", open)
    b.addEventListener("click", (e) => {
      e.stopPropagation()
      open()
    })
    return b
  }

  const fieldPanel = (f: MenuField): HTMLElement => {
    const panel = doc.createElement("div")
    panel.className = `${className}-panel`
    const input = doc.createElement("input")
    input.type = "text"
    input.className = `${className}-input`
    input.value = f.value
    if (f.placeholder) input.placeholder = f.placeholder
    input.addEventListener("keydown", (e) => {
      if (e.key !== "Enter") return
      e.preventDefault()
      const v = input.value.trim()
      hide()
      f.onSubmit(v)
    })
    panel.appendChild(input)
    for (const a of f.actions ?? []) panel.appendChild(actionButton(a))
    return panel
  }

  const buildPanel = (rows: MenuRow[]): HTMLElement => {
    const panel = doc.createElement("div")
    panel.className = `${className}-panel`
    for (const r of rows) {
      if (r === "separator") {
        const sep = doc.createElement("div")
        sep.className = `${className}-sep`
        panel.appendChild(sep)
      } else if (isSubmenu(r)) {
        panel.appendChild(flyoutRow(r.label, r.icon, () => buildPanel(r.rows), r.disabled))
      } else if (isField(r)) {
        panel.appendChild(flyoutRow(r.label, r.icon, () => fieldPanel(r)))
      } else {
        panel.appendChild(actionButton(r))
      }
    }
    return panel
  }

  const show = (rows: MenuRow[], x: number, y: number) => {
    hide()
    const main = buildPanel(rows)
    root.appendChild(main)
    root.hidden = false
    place(main, x, y, win)
    unbind = armDismiss(doc, root, hide)
    onOpenChange?.(true)
  }

  // Show one field panel directly (no wrapping menu) — the selection bar's link
  // button opens the URL editor this way.
  const showField = (f: MenuField, x: number, y: number) => {
    hide()
    const panel = fieldPanel(f)
    root.appendChild(panel)
    root.hidden = false
    place(panel, x, y, win)
    ;(panel.querySelector("input") as HTMLInputElement | null)?.focus({ preventScroll: true })
    unbind = armDismiss(doc, root, hide)
    onOpenChange?.(true)
  }

  return {
    el: root,
    get isOpen() {
      return !root.hidden
    },
    show,
    showField,
    hide,
    destroy: () => {
      hide()
      root.remove()
    },
  }
}
