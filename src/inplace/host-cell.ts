/**
 * A table cell's selection lives in the DOM, not in `state.selection`, so a
 * host item run from a cell would see an empty selection. This lands the
 * selected text, mapped back to its range in the Markdown source, into the
 * state first — the cell shows its raw source while focused, so the offsets
 * carry straight over.
 */

import type { EditorView } from "@codemirror/view"
import { activeTableCell } from "../toolbar/cell-inline"
import { cellSourcePos } from "../toolbar/table-position"
import { selectionOffsets } from "./table-cell-dom"
import { tableField } from "./tables"

export function selectCellRange(view: EditorView): void {
  const cell = activeTableCell(view)
  const table = cell?.closest("table")
  if (!cell || !table) return
  const at = view.posAtDOM(table)
  let from = at
  view.state.field(tableField).between(at, at, (f) => {
    from = f
    return false
  })
  const base = cellSourcePos(view.state.doc, from, Number(cell.dataset.r), Number(cell.dataset.c))
  if (base == null) return
  const { from: a, to: b } = selectionOffsets(cell)
  view.dispatch({ selection: { anchor: base + a, head: base + b } })
}
