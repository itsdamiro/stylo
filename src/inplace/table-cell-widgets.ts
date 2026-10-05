/**
 * Host widgets inside a table cell. Like `cellMarks`, the host's `CellWidget`s
 * (document positions) are cut down to the cell as offsets into its raw string
 * and drawn by `applyPaint` once the cell's text nodes are aligned with it. The
 * element is not the cell's text: `table-cell-dom` skips it when counting.
 */

import type { EditorView } from "@codemirror/view"
import type { CellWidget } from "../types"
import type { Piece } from "./table-cell-align"

export interface PaintWidget {
  /** Offset into the cell's raw string that the element follows. */
  at: number
  key: string
  cellClass?: string
  build: () => HTMLElement
}

/** The widgets that sit in a cell whose trimmed content starts at `base`, `len` long. */
export function widgetsIn(
  widgets: readonly CellWidget[],
  view: EditorView,
  base: number,
  lead: number,
  len: number,
): PaintWidget[] {
  return widgets
    .filter((w) => w.pos >= base && w.pos <= base + len)
    .map((w) => ({
      at: w.pos - base + lead,
      key: w.key,
      cellClass: w.cellClass,
      build: () => w.toDOM(view),
    }))
}

/** Build a widget's element, marked so it stays out of the cell's text. */
export function widgetEl(w: PaintWidget): HTMLElement {
  const el = w.build()
  el.setAttribute("contenteditable", "false")
  el.dataset.styloCellWidget = ""
  return el
}

/**
 * Where offset `o` falls among the rendered text: after the characters that end
 * there, or at the nearest boundary when `o` is in syntax that isn't shown.
 */
function snap(pieces: Piece[], o: number): { piece: Piece; at: number } | null {
  let best: { piece: Piece; at: number } | null = null
  let dist = Infinity
  for (const piece of pieces) {
    const end = piece.start + piece.node.data.length
    if (o > piece.start && o <= end) return { piece, at: o }
    for (const at of [piece.start, end]) {
      if (Math.abs(o - at) < dist) [best, dist] = [{ piece, at }, Math.abs(o - at)]
    }
  }
  return best
}

/** Each widget's piece, with `at` snapped into it; `loose` ones go at the end of the cell. */
export function placeWidgets(pieces: Piece[] | null, widgets: PaintWidget[]) {
  const placed = new Map<Piece, PaintWidget[]>()
  const loose: PaintWidget[] = []
  for (const w of widgets) {
    const hit = pieces && snap(pieces, w.at)
    if (!hit) loose.push(w)
    else placed.set(hit.piece, [...(placed.get(hit.piece) ?? []), { ...w, at: hit.at }])
  }
  return { placed, loose }
}
