import { EditorView } from "@codemirror/view"
import { type StructOp, type TableGizmos } from "./table-gizmos"
import { placeCaret, renderedCaretOffset } from "./table-cell-dom"
import { TableWidgetCore } from "./table-widget-core"
import {
  deleteColumn,
  deleteRow,
  type GridModel,
  insertColumn,
  insertRow,
  setAlign,
} from "./table-structure"

/**
 * The editing side of `EditableTableWidget`: which cell has focus and how focus
 * moves in and out of the table, plus structural edits (rows, columns, align)
 * run from the gizmos. The subclass adds the DOM, events and menus.
 */
export abstract class TableWidgetEditing extends TableWidgetCore {
  protected gizmos: TableGizmos | null = null
  /** Rendered-text offset from the mousedown that is bringing a cell into edit. */
  protected pendingOffset: number | null = null
  /** The press that is focusing a cell landed on a host mark; see `onFocusIn`. */
  protected pressOnMark = false

  protected onFocusIn(event: FocusEvent) {
    const target = event.target as HTMLElement
    if (target.closest("[data-stylo-cell-widget]")) return // a host's control keeps the focus it took
    const cell = target.closest<HTMLTableCellElement>("td, th")
    if (!cell || cell === this.editing) return
    if (this.pressOnMark) {
      // Swapping the cell to raw text now would remove the marked element under
      // the pointer, and the browser sends `click` only when the pressed element
      // is still there on release. Wait until just after the click.
      this.pressOnMark = false
      document.addEventListener("mouseup", () => setTimeout(() => this.enterCell(cell)), {
        once: true,
      })
      return
    }
    this.enterCell(cell)
  }

  /** Bring `cell` into editing: swap it to its raw source and park the caret. */
  protected enterCell(cell: HTMLTableCellElement) {
    if (!this.table?.contains(cell) || cell === this.editing) return
    // Prefer the offset from the mousedown that started this focus; the DOM
    // selection isn't placed yet when `focusin` fires from a click.
    const offset = this.pendingOffset ?? renderedCaretOffset(cell)
    this.pendingOffset = null
    if (this.editing) this.finish(this.editing, false)
    this.editing = cell
    this.paint(cell, true)
    placeCaret(cell, offset)
  }

  protected onFocusOut(event: FocusEvent) {
    if (this.syncing || !this.editing) return
    const to = event.relatedTarget as Node | null
    if (to && this.table?.contains(to)) return // moving to another cell — its focusin handles it
    this.finish(this.editing, false)
    this.editing = null
  }

  /**
   * Focus the first (top-left) or last (bottom-right) cell — keyboard entry into
   * the table from the line above or below. Returns `false` when the DOM isn't
   * mounted, so the caller can fall back to stock cursor motion.
   */
  focusEdge(edge: "first" | "last"): boolean {
    if (!this.table) return false
    const r = edge === "first" ? 0 : this.rows.length - 1
    const c = edge === "first" ? 0 : this.cols() - 1
    const cell = this.cellAt(r, c)
    if (!cell) return false
    this.pendingOffset = edge === "first" ? 0 : (this.rows[r]?.[c] ?? "").length
    cell.focus()
    return true
  }

  protected appendRow() {
    insertRow(this.model(), this.rows.length)
    this.renderCells()
    this.gizmos?.layout(this.table!)
  }

  protected model(): GridModel {
    return { rows: this.rows, aligns: this.data.aligns }
  }

  /** Apply a structural edit from a gizmo, rebuild, restore focus, reserialize. */
  protected runOp(view: EditorView, op: StructOp) {
    if (!this.table) return // a destroyed instance whose menu is still on screen
    const g = this.model()
    if (op.kind === "insertColumn") insertColumn(g, op.at)
    else if (op.kind === "deleteColumn") deleteColumn(g, op.at)
    else if (op.kind === "insertRow") insertRow(g, op.at)
    else if (op.kind === "deleteRow") deleteRow(g, op.at)
    else setAlign(g, op.at, g.aligns[op.at] === op.value ? "" : op.value)

    // Reserialise first so the document is canonical, then rebuild our own DOM
    // from the settled model — no window where the two disagree.
    this.editing = null
    this.sync(view)
    this.renderCells()
    this.gizmos?.layout(this.table!)
    if (op.kind !== "align") {
      const r = Math.max(0, Math.min(op.focus[0], this.rows.length - 1))
      const c = Math.max(0, Math.min(op.focus[1], this.cols() - 1))
      this.cellAt(r, c)?.focus()
    }
  }
}
