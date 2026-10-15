/**
 * Painting a cell's marks and widgets onto its DOM: the half of the cell-mark
 * pipeline that touches elements. `table-cell-marks.ts` works out what to paint.
 */

import { align, type Piece } from "./table-cell-align"
import { placeWidgets, widgetEl, type PaintWidget } from "./table-cell-widgets"
import type { CellPaint } from "./table-cell-marks"

type Mark = CellPaint["marks"][number]
function wrapper(m: Mark, child: Node): HTMLElement {
  const el = document.createElement("span")
  el.className = m.class
  el.dataset.styloCellMark = ""
  for (const [k, v] of Object.entries(m.attributes ?? {})) {
    try {
      el.setAttribute(k, v)
    } catch {
      // A host's invalid attribute name costs that attribute, not the table.
    }
  }
  el.append(child)
  return el
}

/** Replace `piece`'s text node by its characters, each run wrapped by the marks covering it. */
function wrapPiece(piece: Piece, marks: Mark[], widgets: PaintWidget[]): boolean {
  const text = piece.node.data
  const end = piece.start + text.length
  const hit = marks.filter((m) => m.from < end && m.to > piece.start)
  if (!hit.length && !widgets.length) return false
  const cuts = new Set([piece.start, end])
  for (const w of widgets) cuts.add(w.at)
  for (const m of hit) {
    cuts.add(Math.max(m.from, piece.start))
    cuts.add(Math.min(m.to, end))
  }
  const sorted = [...cuts].sort((a, b) => a - b)
  const frag = document.createDocumentFragment()
  const put = (at: number) => {
    for (const w of widgets) if (w.at === at) frag.append(widgetEl(w))
  }
  put(piece.start)
  for (let i = 0; i < sorted.length - 1; i++) {
    const [a, b] = [sorted[i]!, sorted[i + 1]!]
    let node: Node = document.createTextNode(text.slice(a - piece.start, b - piece.start))
    for (const m of hit) if (m.from <= a && m.to >= b) node = wrapper(m, node)
    frag.append(node)
    put(b)
  }
  piece.node.replaceWith(frag)
  return true
}

/** Wrap everything in `cell` in one element per mark. */
function wrapAll(cell: HTMLElement, marks: Mark[]) {
  for (const m of marks) {
    const el = wrapper(m, cell.ownerDocument.createDocumentFragment())
    el.append(...cell.childNodes)
    cell.append(el)
  }
}

/**
 * Draw `paint` on `cell`, just painted from `raw`. A mark that covers no
 * rendered character (it sits on a link target, say) marks the whole cell
 * rather than nothing; so does a cell whose text can't be aligned.
 */
export function applyPaint(cell: HTMLElement, raw: string, paint: CellPaint, focused: boolean) {
  let marks = paint.marks
  // A focused cell shows raw source, which a widget would corrupt: none there.
  let widgets: PaintWidget[] = []
  const whole: Mark[] = []
  let pieces: Piece[] | null
  if (focused) {
    pieces = cell.firstChild instanceof Text ? [{ node: cell.firstChild, start: 0 }] : null
  } else {
    // Rendered text has each `\|` as one character; bring the marks along.
    const escapes = [...raw.matchAll(/\\\|/g)].map((m) => m.index!)
    const toSource = (o: number) => o - escapes.filter((p) => p < o).length
    pieces = align(cell, raw.replace(/\\\|/g, "|"))
    marks = marks.map((m) => ({ ...m, from: toSource(m.from), to: toSource(m.to) }))
    widgets = paint.widgets.map((w) => ({ ...w, at: toSource(w.at) }))
  }
  const { placed, loose } = placeWidgets(pieces, widgets)
  const atEnd = () => cell.append(...loose.map(widgetEl))
  if (!pieces) {
    wrapAll(cell, marks)
    return atEnd()
  }
  const reached = new Set<Mark>()
  for (const p of pieces) {
    for (const m of marks) {
      if (m.from < p.start + p.node.data.length && m.to > p.start) reached.add(m)
    }
  }
  for (const m of marks) if (!reached.has(m)) whole.push(m)
  for (const p of pieces) wrapPiece(p, marks, placed.get(p) ?? [])
  wrapAll(cell, whole)
  atEnd()
}
