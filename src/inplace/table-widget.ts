import { Annotation } from "@codemirror/state"
import { EditorView, WidgetType } from "@codemirror/view"
import { type Align, serializeGrid } from "../toolbar/table-grid"
import { markPainter } from "./table-cell-marks"
import { cellHasSelection, cellSelectionRows } from "./context-menu-actions"
import { attachLongPress, type LongPressHandle } from "./long-press"
import { createTableGizmos, type StructOp, type TableGizmos } from "./table-gizmos"
import { handleTableKey } from "./table-widget-keys"
import { isPainted, paintCell, renderTableCells } from "./table-widget-render"
import {
  gridOf,
  offsetFromPoint,
  placeCaret,
  renderedCaretOffset,
  selectionOffsets,
  selectWordAtPoint,
  trimGrid,
} from "./table-cell-dom"
import {
  deleteColumn,
  deleteRow,
  type GridModel,
  insertColumn,
  insertRow,
  setAlign,
} from "./table-structure"
import { tableField } from "./tables"

/** Marks a transaction that came from an editable table widget's own DOM. */
export const fromTableWidget = Annotation.define<boolean>()

/** The widget that owns each mounted editable `<table>`, for `table-marks-plugin.ts`. */
export const tableWidgets = new WeakMap<HTMLElement, EditableTableWidget>()

export interface ParsedTable {
  head: string[]
  body: string[][]
  aligns: Align[]
}

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
export class EditableTableWidget extends WidgetType {
  private table: HTMLTableElement | null = null
  private view: EditorView | null = null
  private rows: string[][]
  private editing: HTMLTableCellElement | null = null
  private syncing = false
  /** Rendered-text offset from the mousedown that is bringing a cell into edit. */
  private pendingOffset: number | null = null
  /** The press that is focusing a cell landed on a host mark; see `onFocusIn`. */
  private pressOnMark = false
  private gizmos: TableGizmos | null = null
  private longPress: LongPressHandle | null = null
  /** When a long-press last opened the structural menu; a `contextmenu` the
   *  browser synthesises from the same gesture and lands within the window is
   *  swallowed rather than re-opening it. */
  private longPressAt = 0

  constructor(
    readonly data: ParsedTable,
    /** `embedSource` is set: render `![[ref]]` literally in a cell (no chip). */
    private readonly embeds = false,
  ) {
    super()
    this.rows = gridOf(data)
  }

  override eq(other: EditableTableWidget) {
    // While this instance owns mounted DOM, force CodeMirror to run the new
    // instance's `toDOM` on a rebuild rather than swapping the instance behind
    // the live DOM (which leaves the new one un-initialised — `table` null).
    // Widget-originated edits use the `fromTableWidget` annotation path, which
    // never calls `eq`, so this only bites on a genuine external reload.
    if (this.table) return false
    return JSON.stringify(trimGrid(this.rows)) === JSON.stringify(trimGrid(other.rows))
  }

  override ignoreEvent() {
    return true
  }

  private cols(): number {
    return this.data.aligns.length
  }

  /**
   * The table's current `[from, to]` in the document, derived from the DOM via
   * `tableField` — the same Lezer-tree-backed decoration CodeMirror treats as
   * atomic. A prior version re-derived this with its own "contiguous pipe
   * lines" scan, which disagreed with the real GFM parse whenever a table was
   * followed with no blank line by a plain-prose line containing no `|`: GFM
   * still swallows that line into the table, but the pipe scan stopped short
   * of it, so `exitBelow()` (below) landed the caret one line short of past
   * the table — still inside the atomic range it was meant to escape.
   */
  private bounds(view: EditorView): { from: number; to: number } {
    const pos = view.posAtDOM(this.table!)
    let range: { from: number; to: number } | null = null
    view.state.field(tableField).between(pos, pos, (from, to) => {
      range = { from, to }
      return false
    })
    return range ?? view.state.doc.lineAt(pos)
  }

  private cellAt(r: number, c: number): HTMLTableCellElement | null {
    if (!this.table) return null
    const row = r === 0 ? this.table.tHead!.rows[0]! : this.table.tBodies[0]!.rows[r - 1]
    return (row?.cells[c] as HTMLTableCellElement) ?? null
  }

  private coords(cell: HTMLTableCellElement): { r: number; c: number } {
    return { r: Number(cell.dataset.r), c: Number(cell.dataset.c) }
  }

  /** The host's marks on a cell; none until the table is in the document. */
  private paintOf = markPainter({
    view: () => this.view,
    mounted: () => !!this.table?.isConnected,
    from: (view) => this.bounds(view).from,
    raw: (r, c) => this.rows[r]?.[c] ?? "",
  })

  private grid() {
    return { rows: this.rows, aligns: this.data.aligns, embeds: this.embeds, paintOf: this.paintOf }
  }

  /** Draw `cell` from `rows[r][c]` — raw text when `raw`, rendered otherwise. */
  private paint(cell: HTMLTableCellElement, raw: boolean) {
    paintCell(cell, this.grid(), raw)
  }

  /** Redraw the cells whose host marks changed; the one being edited keeps its caret. */
  repaintMarks() {
    for (const cell of this.table?.querySelectorAll<HTMLTableCellElement>("td, th") ?? []) {
      const { r, c } = this.coords(cell)
      if (cell !== this.editing && !isPainted(cell, this.paintOf(r, c))) this.paint(cell, false)
    }
  }

  /** Rebuild `<thead>` / `<tbody>` from the current grid model. */
  private renderCells() {
    renderTableCells(this.table!, this.grid())
  }

  private appendRow() {
    insertRow(this.model(), this.rows.length)
    this.renderCells()
    this.gizmos?.layout(this.table!)
  }

  private model(): GridModel {
    return { rows: this.rows, aligns: this.data.aligns }
  }

  /** Apply a structural edit from a gizmo, rebuild, restore focus, reserialize. */
  private runOp(view: EditorView, op: StructOp) {
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

  /** Commit `cell`'s edited text into `rows` and, unless it keeps focus, re-render it. */
  private finish(cell: HTMLTableCellElement, keepRaw: boolean) {
    const { r, c } = this.coords(cell)
    if (this.rows[r]) this.rows[r]![c] = (cell.textContent ?? "").replace(/\r?\n/g, " ")
    if (!keepRaw) this.paint(cell, false)
  }

  private onFocusIn(event: FocusEvent) {
    const cell = (event.target as HTMLElement).closest<HTMLTableCellElement>("td, th")
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
  private enterCell(cell: HTMLTableCellElement) {
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

  private onFocusOut(event: FocusEvent) {
    if (this.syncing || !this.editing) return
    const to = event.relatedTarget as Node | null
    if (to && this.table?.contains(to)) return // moving to another cell — its focusin handles it
    this.finish(this.editing, false)
    this.editing = null
  }

  /** The selection as (row, col, offset, head) within the editing cell. */
  private readCaret(): { r: number; c: number; offset: number; head: number } | null {
    if (!this.editing) return null
    const { r, c } = this.coords(this.editing)
    const { from, to } = selectionOffsets(this.editing)
    return { r, c, offset: from, head: to }
  }

  private writeCaret(caret: { r: number; c: number; offset: number; head: number }) {
    const cell = this.cellAt(caret.r, caret.c)
    if (cell) placeCaret(cell, caret.offset, caret.head)
  }

  /** Serialize `rows` into the document. */
  private sync(view: EditorView) {
    if (!this.table) return
    const caret = this.readCaret()
    const text = serializeGrid({ rows: this.rows, aligns: this.data.aligns })
    const { from, to } = this.bounds(view)
    if (view.state.sliceDoc(from, to) === text) return

    // `syncing` is true only across the synchronous dispatch, so a blur that
    // CodeMirror's reconciliation triggers there is ignored, while a real user
    // focusout right after still re-renders the cell.
    this.syncing = true
    view.dispatch({
      changes: { from, to, insert: text },
      annotations: fromTableWidget.of(true),
      userEvent: "input",
    })
    this.syncing = false
    if (caret) {
      this.writeCaret(caret)
      requestAnimationFrame(() => {
        if (this.table && caret) this.writeCaret(caret)
      })
    }
  }

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
