import type { EditorView } from "@codemirror/view"
import { handleCellShortcut } from "../toolbar/cell-inline"

/** What {@link handleTableKey} needs from `EditableTableWidget`, decoupled the
 *  same way `table-gizmos.ts` is — a small callback interface rather than a
 *  direct dependency on the widget class. */
export interface TableKeysHost {
  /** Row/col of `cell`, from its dataset. */
  coords: (cell: HTMLTableCellElement) => { r: number; c: number }
  rows: () => number
  cols: () => number
  /** The cell at (r, c), or `null` when out of range or not mounted. */
  cellAt: (r: number, c: number) => HTMLTableCellElement | null
  /** Raw source text of the cell at (r, c) — its length lands the caret at
   *  the far edge when arrowing into a cell from the right. */
  cellText: (r: number, c: number) => string
  /** Append a blank row at the bottom and re-render. */
  appendRow: () => void
  /** Serialize the current grid into the document. */
  sync: (view: EditorView) => void
  /** The table's current `[from, to)` in the document. */
  bounds: (view: EditorView) => { from: number; to: number }
  /** The selection within the currently-editing cell, if any. */
  readCaret: () => { offset: number; head: number } | null
  /** Bring `cell` into edit, with the caret at `offset` (from a keyboard move). */
  enterCell: (cell: HTMLTableCellElement, offset: number) => void
}

/**
 * Tab / Enter / Arrow handling for an editable table's cells: Tab and
 * Shift-Tab walk the grid (Tab past the end adds a row); Enter drops to the
 * cell below (adding a row at the bottom past the last one); the vertical
 * arrows walk the column, carrying the caret's text offset along so a press
 * feels continuous, and leave the table at the first/last row; the
 * horizontal arrows cross into the neighbouring cell only from the text edge
 * (mid-text, or with a range selected, the browser moves within the cell),
 * and likewise leave the table at the first/last cell.
 */
export function handleTableKey(event: KeyboardEvent, view: EditorView, host: TableKeysHost): void {
  const cell = (event.target as HTMLElement).closest<HTMLTableCellElement>("td, th")
  if (!cell) return
  // Mod-b / Mod-i / Mod-k never reach CodeMirror's keymap from inside a
  // widget (`ignoreEvent`), so the widget applies them to the cell itself.
  if (handleCellShortcut(event, cell)) {
    event.stopPropagation()
    return
  }
  const { r, c } = host.coords(cell)
  const rows = host.rows()
  const cols = host.cols()
  const lastRow = rows - 1

  if (event.key === "Tab") {
    event.preventDefault()
    event.stopPropagation()
    const flat = r * cols + c + (event.shiftKey ? -1 : 1)
    if (flat < 0) return
    if (flat >= rows * cols) {
      if (event.shiftKey) return
      host.appendRow()
      host.cellAt(lastRow + 1, 0)?.focus()
      host.sync(view)
      return
    }
    host.cellAt(Math.floor(flat / cols), flat % cols)?.focus()
    return
  }
  if (event.key === "Enter") {
    event.preventDefault()
    event.stopPropagation()
    if (r < lastRow) {
      host.cellAt(r + 1, c)?.focus()
      return
    }
    host.appendRow()
    host.cellAt(lastRow + 1, c)?.focus()
    host.sync(view)
    return
  }

  const exitBelow = () => {
    const { to } = host.bounds(view)
    view.focus()
    // With the table as the last content in the document, `to` is already
    // `doc.length` — there is no line after it to land the caret on, and a
    // selection placed exactly at the atomic table range's own edge can
    // resolve to the *other* side of it (landing above the table instead of
    // below). Insert the line that "exit below" needs first, same as a
    // fresh `insertTable` already gets, then move into it.
    if (to >= view.state.doc.length) {
      view.dispatch({ changes: { from: to, insert: "\n" }, selection: { anchor: to + 1 } })
      return
    }
    view.dispatch({ selection: { anchor: to + 1 } })
  }
  const exitAbove = () => {
    const { from } = host.bounds(view)
    view.focus()
    view.dispatch({ selection: { anchor: Math.max(from - 1, 0) } })
  }
  const enterCell = (flat: number, offset: number) => {
    const target = host.cellAt(Math.floor(flat / cols), flat % cols)
    if (!target) return
    host.enterCell(target, offset)
  }

  if (event.key === "ArrowDown") {
    event.preventDefault()
    event.stopPropagation()
    if (r === lastRow) exitBelow()
    else enterCell((r + 1) * cols + c, host.readCaret()?.offset ?? 0)
    return
  }
  if (event.key === "ArrowUp") {
    event.preventDefault()
    event.stopPropagation()
    if (r === 0) exitAbove()
    else enterCell((r - 1) * cols + c, host.readCaret()?.offset ?? 0)
    return
  }
  if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
    const back = event.key === "ArrowLeft"
    const caret = host.readCaret()
    if (!caret || caret.offset !== caret.head) return
    if (back ? caret.offset > 0 : caret.offset < (cell.textContent ?? "").length) return
    event.preventDefault()
    event.stopPropagation()
    const flat = r * cols + c + (back ? -1 : 1)
    if (flat < 0) return exitAbove()
    if (flat >= rows * cols) return exitBelow()
    enterCell(flat, back ? host.cellText(Math.floor(flat / cols), flat % cols).length : 0)
    return
  }
}
