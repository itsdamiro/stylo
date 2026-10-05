/**
 * The screen rectangle of a selection, for a host popover to open beside it.
 * `view.coordsAtPos` inside a table lands on the widget's edge, so a cell's
 * rectangle comes from the DOM selection instead.
 */

import type { EditorView } from "@codemirror/view"

const rectOf = (left: number, top: number, right: number, bottom: number): DOMRect => {
  const box = {
    x: left,
    y: top,
    left,
    top,
    right,
    bottom,
    width: right - left,
    height: bottom - top,
  }
  return { ...box, toJSON: () => box } as DOMRect
}

/** The editor's main selection (its caret when empty), or the editor's own box. */
export function selectionRect(view: EditorView): DOMRect {
  const { from, to } = view.state.selection.main
  const a = view.coordsAtPos(from)
  const b = from === to ? a : view.coordsAtPos(to, -1)
  if (!a || !b) return view.dom.getBoundingClientRect()
  return rectOf(
    Math.min(a.left, b.left),
    Math.min(a.top, b.top),
    Math.max(a.right, b.right),
    Math.max(a.bottom, b.bottom),
  )
}

/** The selected text in `cell` when `selected`, else the cell itself. */
export function cellRect(cell: HTMLElement | null | undefined, selected: boolean): DOMRect {
  const sel = cell?.ownerDocument.getSelection()
  if (cell && selected && sel && sel.rangeCount > 0) {
    const box = sel.getRangeAt(0).getBoundingClientRect?.()
    if (box && (box.width > 0 || box.height > 0)) return box
  }
  return cell?.getBoundingClientRect() ?? rectOf(0, 0, 0, 0)
}
