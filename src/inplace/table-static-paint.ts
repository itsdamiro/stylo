/**
 * Host marks and widgets on a rendered, non-editable table (`table: "source"`,
 * or any `readOnly` document). The same per-cell painting as the editable
 * table, over the static widget's cells: there is no focused cell here, so every
 * cell is always drawn rendered.
 */

import type { StateField } from "@codemirror/state"
import type { DecorationSet, EditorView } from "@codemirror/view"
import { markPainter } from "./table-cell-marks"
import { isPainted, paintCell } from "./table-widget-render"

/** Each mounted static `<table>`'s repaint, called by `cellMarksPlugin`. */
export const staticTables = new WeakMap<HTMLElement, () => void>()

const HOST = "[data-stylo-cell-widget], [data-stylo-cell-mark]"

/** Paint the host's marks and widgets on `table` once it is mounted, and keep a way to repaint it. */
export function mountStatic(
  table: HTMLTableElement,
  view: EditorView,
  rows: string[][],
  embeds: boolean,
  field: StateField<DecorationSet>,
) {
  const paintOf = markPainter({
    view: () => view,
    mounted: () => table.isConnected,
    from: (v) => {
      const pos = v.posAtDOM(table)
      let from = pos
      v.state.field(field).between(pos, pos, (f) => {
        from = f
        return false
      })
      return from
    },
    raw: (r, c) => rows[r]?.[c] ?? "",
  })
  const grid = { rows, aligns: [], embeds, paintOf }
  const repaint = () => {
    for (const cell of table.querySelectorAll<HTMLTableCellElement>("td, th")) {
      const [r, c] = [Number(cell.dataset.styloRow), Number(cell.dataset.styloCol)]
      if (!isPainted(cell, paintOf(r, c))) paintCell(cell, grid, false)
    }
  }
  staticTables.set(table, repaint)
  view.requestMeasure({ read: () => null, write: repaint, key: table })

  // A press that reaches CodeMirror, or just focuses the editor, moves the caret
  // into the table and reveals its source, removing the host's element before
  // the browser sends `click`. What a host drew must stay, so its press ends here.
  table.addEventListener("mousedown", (e) => {
    if (!(e.target as HTMLElement).closest(HOST)) return
    e.preventDefault()
    e.stopPropagation()
  })
}
