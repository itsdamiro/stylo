import { Annotation } from "@codemirror/state"
import { EditorView, WidgetType } from "@codemirror/view"
import { type Align, serializeGrid } from "../toolbar/table-grid"
import { markPainter } from "./table-cell-marks"
import { isPainted, paintCell, renderTableCells } from "./table-widget-render"
import { gridOf, placeCaret, selectionOffsets, trimGrid } from "./table-cell-dom"
import { tableField } from "./tables"

/** Marks a transaction that came from an editable table widget's own DOM. */
export const fromTableWidget = Annotation.define<boolean>()

export interface ParsedTable {
  head: string[]
  body: string[][]
  aligns: Align[]
}

/**
 * The state and document side of `EditableTableWidget`: the raw cell grid, its
 * place in the document, painting a cell, structural edits, and serializing the
 * grid back as a transaction. The subclass adds focus handling, events and the
 * DOM.
 */
export abstract class TableWidgetCore extends WidgetType {
  protected table: HTMLTableElement | null = null
  protected view: EditorView | null = null
  protected rows: string[][]
  protected editing: HTMLTableCellElement | null = null
  protected syncing = false

  constructor(
    readonly data: ParsedTable,
    /** `embedSource` is set: render `![[ref]]` literally in a cell (no chip). */
    protected readonly embeds = false,
  ) {
    super()
    this.rows = gridOf(data)
  }

  override eq(other: TableWidgetCore) {
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

  protected cols(): number {
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
  protected bounds(view: EditorView): { from: number; to: number } {
    const pos = view.posAtDOM(this.table!)
    let range: { from: number; to: number } | null = null
    view.state.field(tableField).between(pos, pos, (from, to) => {
      range = { from, to }
      return false
    })
    return range ?? view.state.doc.lineAt(pos)
  }

  protected cellAt(r: number, c: number): HTMLTableCellElement | null {
    if (!this.table) return null
    const row = r === 0 ? this.table.tHead!.rows[0]! : this.table.tBodies[0]!.rows[r - 1]
    return (row?.cells[c] as HTMLTableCellElement) ?? null
  }

  protected coords(cell: HTMLTableCellElement): { r: number; c: number } {
    return { r: Number(cell.dataset.r), c: Number(cell.dataset.c) }
  }

  /** The host's marks on a cell; none until the table is in the document. */
  protected paintOf = markPainter({
    view: () => this.view,
    mounted: () => !!this.table?.isConnected,
    from: (view) => this.bounds(view).from,
    raw: (r, c) => this.rows[r]?.[c] ?? "",
  })

  protected grid() {
    return { rows: this.rows, aligns: this.data.aligns, embeds: this.embeds, paintOf: this.paintOf }
  }

  /** Draw `cell` from `rows[r][c]` — raw text when `raw`, rendered otherwise. */
  protected paint(cell: HTMLTableCellElement, raw: boolean) {
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
  protected renderCells() {
    renderTableCells(this.table!, this.grid())
  }

  /** Commit `cell`'s edited text into `rows` and, unless it keeps focus, re-render it. */
  protected finish(cell: HTMLTableCellElement, keepRaw: boolean) {
    const { r, c } = this.coords(cell)
    if (this.rows[r]) this.rows[r]![c] = (cell.textContent ?? "").replace(/\r?\n/g, " ")
    if (!keepRaw) this.paint(cell, false)
  }

  /** The selection as (row, col, offset, head) within the editing cell. */
  protected readCaret(): { r: number; c: number; offset: number; head: number } | null {
    if (!this.editing) return null
    const { r, c } = this.coords(this.editing)
    const { from, to } = selectionOffsets(this.editing)
    return { r, c, offset: from, head: to }
  }

  protected writeCaret(caret: { r: number; c: number; offset: number; head: number }) {
    const cell = this.cellAt(caret.r, caret.c)
    if (cell) placeCaret(cell, caret.offset, caret.head)
  }

  /** Serialize `rows` into the document. */
  protected sync(view: EditorView) {
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
}
