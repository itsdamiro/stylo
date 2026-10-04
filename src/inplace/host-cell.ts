/**
 * A table cell's selection lives in the DOM, not in `state.selection`, so a
 * host item run from a cell would see an empty selection. This lands the
 * selected text, mapped back to its range in the Markdown source, into the
 * state first — the cell shows its raw source while focused, so the offsets
 * carry straight over.
 */

import type { EditorView } from "@codemirror/view"
import { cellSourcePos } from "../toolbar/table-position"
import { selectionOffsets } from "./table-cell-dom"
import { tableField } from "./tables"

/**
 * Put `cell`'s place in the document into `state.selection`: its selected text
 * when `selected` (the focused cell), else a caret at the start of its content.
 */
export function selectCellRange(view: EditorView, cell: HTMLElement, selected: boolean): void {
  const table = cell.closest("table")
  if (!table) return
  const at = view.posAtDOM(table)
  let from = at
  view.state.field(tableField).between(at, at, (f) => {
    from = f
    return false
  })
  const base = cellSourcePos(view.state.doc, from, Number(cell.dataset.r), Number(cell.dataset.c))
  if (base == null) return
  const { from: a, to: b } = selected ? selectionOffsets(cell) : { from: 0, to: 0 }
  view.dispatch({ selection: { anchor: base + a, head: base + b } })
}
