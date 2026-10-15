/**
 * The floating-popup mechanics `context-menu.ts`'s panels share with each
 * other: viewport placement, and outside-press / Escape / delayed-scroll
 * dismissal, and a row's label. Nothing here knows about menu rows.
 */

import { iconSvg } from "../toolbar/icon-paths"

/** Append a row's icon (an `iconNode` clone or a named icon) and its text to `el`. */
export function label(doc: Document, el: HTMLElement, text: string, icon?: string, node?: Node) {
  if (node) el.appendChild(node.cloneNode(true))
  else if (icon) el.appendChild(iconSvg(doc, icon))
  const span = doc.createElement("span")
  span.textContent = text
  el.appendChild(span)
}

/** Place a fixed-position panel at (x, y), nudged back on-screen on overflow. */
export function place(panel: HTMLElement, x: number, y: number, win: Window | null | undefined) {
  const vw = win?.innerWidth ?? 0
  const vh = win?.innerHeight ?? 0
  panel.style.left = "0"
  panel.style.top = "0"
  const { width, height } = panel.getBoundingClientRect()
  panel.style.left = `${Math.max(4, Math.min(x, vw - width - 4))}px`
  panel.style.top = `${Math.max(4, Math.min(y, vh - height - 4))}px`
}

/**
 * A flyout sits to the right of its parent row; if it would run off-screen it
 * flips to the left instead of being shoved back over the menu (which would
 * leave a gap the pointer has to cross, closing it mid-approach).
 */
export function placeFlyout(panel: HTMLElement, host: DOMRect, win: Window | null | undefined) {
  const vw = win?.innerWidth ?? 0
  const vh = win?.innerHeight ?? 0
  panel.style.left = "0"
  panel.style.top = "0"
  const { width, height } = panel.getBoundingClientRect()
  const right = host.right - 4
  const left = right + width > vw - 4 ? host.left - width + 4 : right
  panel.style.left = `${Math.max(4, left)}px`
  panel.style.top = `${Math.max(4, Math.min(host.top - 4, vh - height - 4))}px`
}

/**
 * Wires outside-press / Escape / delayed-scroll dismissal for an open menu.
 * Returns the unbind function. The scroll grace period skips the first
 * `graceMs` after opening — a touch long-press routinely emits an incidental
 * scroll (iOS's own long-press handling, a hair of finger drift, a
 * focus-driven viewport shift) in the frames right after the menu appears;
 * without it the menu would be gone before the finger lifts.
 */
export function armDismiss(doc: Document, root: HTMLElement, hide: () => void, graceMs = 350) {
  const armedAt = Date.now()
  const outside = (e: Event) => !root.contains(e.target as Node)
  const onDown = (e: Event) => {
    if (outside(e)) hide()
  }
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") hide()
  }
  // Also skips scrolls from inside the menu — e.g. the URL input scrolling its
  // own text.
  const onScroll = (e: Event) => {
    if (Date.now() - armedAt < graceMs) return
    if (outside(e)) hide()
  }
  // `pointerdown` as well as `mousedown` — a touch tap outside fires only the
  // former, and without it the menu could not be dismissed on a touch device.
  doc.addEventListener("pointerdown", onDown, true)
  doc.addEventListener("mousedown", onDown, true)
  doc.addEventListener("keydown", onKey, true)
  doc.addEventListener("scroll", onScroll, true)
  return () => {
    doc.removeEventListener("pointerdown", onDown, true)
    doc.removeEventListener("mousedown", onDown, true)
    doc.removeEventListener("keydown", onKey, true)
    doc.removeEventListener("scroll", onScroll, true)
  }
}
