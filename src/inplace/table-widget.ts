import { EditorView } from "@codemirror/view"
import { attachLongPress, type LongPressHandle } from "./long-press"
import { cellHasSelection, cellSelectionRows } from "./context-menu-actions"
import { createTableGizmos } from "./table-gizmos"
import { handleTableKey } from "./table-widget-keys"
import { fromTableWidget, type ParsedTable } from "./table-widget-core"
import { TableWidgetEditing } from "./table-widget-editing"
import { offsetFromPoint, selectWordAtPoint } from "./table-cell-dom"

export { fromTableWidget, type ParsedTable }

/** The widget that owns each mounted editable `<table>`, for `table-marks-plugin.ts`. */
export const tableWidgets = new WeakMap<HTMLElement, EditableTableWidget>()

/**
 * A GFM table rendered as an editable `<table>` (`inPlace.table === "cells"`).
 * The widget owns its DOM while mounted and keeps `rows` — the raw cell strings —
 * as its source of truth. A cell shows its Markdown **rendered** (`renderInline`)
 * while unfocused and swaps to the **raw source** as a plain text node while it
 * has focus, mirroring the per-line reveal on the main canvas. Every edit
 * re-serializes `rows` into the document with the `fromTableWidget` annotation
 * so `tableField` remaps rather than rebuilds and DOM focus survives.
 *
 * The widget never stores its document range — a serialize dispatch shifts it —
 * so `bounds()` re-derives it every time from `tableField`, the same
 * syntax-tree-backed decoration `table-enter.ts` reads for keyboard entry.
 */
export class EditableTableWidget extends TableWidgetEditing {
  private longPress: LongPressHandle | null = null
  /** When a long-press last opened the structural menu; a `contextmenu` the
   *  browser synthesises from the same gesture and lands within the window is
   *  swallowed rather than re-opening it. */
  private longPressAt = 0

  private onKey(event: KeyboardEvent, view: EditorView) {
    if (!this.table) return
    handleTableKey(event, view, {
      coords: (cell) => this.coords(cell),
      rows: () => this.rows.length,
      cols: () => this.cols(),
      cellAt: (r, c) => this.cellAt(r, c),
      cellText: (r, c) => this.rows[r]?.[c] ?? "",
      appendRow: () => this.appendRow(),
      sync: (v) => this.sync(v),
      bounds: (v) => this.bounds(v),
      readCaret: () => this.readCaret(),
      enterCell: (cell, offset) => {
        this.pendingOffset = offset
        cell.focus()
      },
    })
  }

  /** Open the structural menu for the cell at a screen point, from a right-click
   *  or a long-press. */
  private openCellMenuAt(
    view: EditorView,
    clientX: number,
    clientY: number,
    target: HTMLElement | null,
  ) {
    const cell = target?.closest<HTMLTableCellElement>("td, th")
    if (!cell) return
    if (this.editing === cell && !cellHasSelection(view)) {
      selectWordAtPoint(cell, clientX, clientY)
    }
    const extra = cellSelectionRows(view, cell)
    this.gizmos?.openFor(cell, clientX, clientY, extra)
  }

  toDOM(view: EditorView) {
    const wrap = document.createElement("div")
    wrap.className = "cm-inplace-table-wrap"
    const table = document.createElement("table")
    this.table = table
    this.view = view
    this.editing = null
    tableWidgets.set(table, this)
    table.className = "cm-inplace-table cm-inplace-table-edit"
    this.renderCells()
    // Marks need the table's place in the document, known once it is mounted.
    view.requestMeasure({ read: () => null, write: () => this.repaintMarks(), key: this })

    // Keep the pointer event away from CodeMirror's delegated handler: it would
    // snap the click to the atomic widget boundary and pull focus back to
    // `.cm-content`. Not `preventDefault` — the browser still focuses the cell.
    table.addEventListener("mousedown", (e) => {
      e.stopPropagation()
      // A press on a host's widget must not focus the cell: that would swap it
      // to raw source and remove the widget before the browser sends `click`.
      if ((e.target as HTMLElement).closest("[data-stylo-cell-widget]")) {
        e.preventDefault()
        return
      }
      const cell = (e.target as HTMLElement).closest<HTMLTableCellElement>("td, th")
      this.pendingOffset =
        cell && cell !== this.editing ? offsetFromPoint(cell, e.clientX, e.clientY) : null
      this.pressOnMark = !!(e.target as HTMLElement).closest("[data-stylo-cell-mark]")
    })
    table.addEventListener("focusin", (e) => this.onFocusIn(e))
    table.addEventListener("focusout", (e) => this.onFocusOut(e))
    const onEdit = (cell: HTMLTableCellElement | null) => {
      if (!cell) return
      // `focusin` normally sets `editing` first; adopt the cell if an `input`
      // somehow beat it (or a test dispatches one directly).
      this.editing = cell
      this.finish(cell, true)
      this.sync(view)
    }
    table.addEventListener("input", (e) => {
      if ((e as InputEvent).isComposing) return
      onEdit((e.target as HTMLElement).closest<HTMLTableCellElement>("td, th"))
    })
    table.addEventListener("compositionend", (e) =>
      onEdit((e.target as HTMLElement).closest<HTMLTableCellElement>("td, th")),
    )
    table.addEventListener("keydown", (e) => this.onKey(e, view))
    table.addEventListener("paste", (e) => {
      e.preventDefault()
      const text = (e.clipboardData?.getData("text/plain") ?? "").replace(/\r?\n/g, " ")
      document.execCommand("insertText", false, text)
    })
    // Right-click, or a long-press on touch, opens the structural menu for the
    // cell under the pointer. In the cell being edited, a press with no
    // selection first selects the word under the pointer — the same affordance
    // the canvas menu gives — so the Format group (and clipboard) can be
    // appended below the row / column / align actions and one menu covers both
    // the table and the word.
    table.addEventListener("contextmenu", (e) => {
      const cell = (e.target as HTMLElement).closest<HTMLTableCellElement>("td, th")
      if (!cell) return
      e.preventDefault()
      e.stopPropagation()
      this.longPress?.cancel()
      if (Date.now() - this.longPressAt < 700) return
      this.openCellMenuAt(view, e.clientX, e.clientY, e.target as HTMLElement | null)
    })
    this.longPress = attachLongPress(table, {
      onLongPress: (x, y, t) => {
        this.longPressAt = Date.now()
        this.openCellMenuAt(view, x, y, t as HTMLElement | null)
      },
    })

    this.gizmos = createTableGizmos(document, {
      dims: () => ({
        cols: this.cols(),
        rows: this.rows.length,
        alignAt: (c) => this.data.aligns[c] ?? "",
      }),
      run: (op) => this.runOp(view, op),
    })
    wrap.append(table, this.gizmos.el)
    wrap.addEventListener("mouseenter", () => this.gizmos?.layout(table))
    requestAnimationFrame(() => this.gizmos?.layout(table))
    return wrap
  }

  override destroy() {
    this.longPress?.dispose()
    this.longPress = null
    this.gizmos?.destroy()
    this.gizmos = null
    this.table = null
    this.view = null
    this.editing = null
  }
}
