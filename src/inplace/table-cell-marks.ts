/**
 * Host marks inside a table cell. A cell is `contenteditable` DOM outside
 * CodeMirror's decoration system, so a host's `Decoration.mark` never reaches
 * it; instead the host's `CellMark`s (document positions) are cut down to the
 * cell, as offsets into its raw string (`rows[r][c]`, `\|` escapes and all).
 * `table-cell-paint.ts` draws them as wrapper elements around the characters
 * they cover.
 */

import type { EditorState } from "@codemirror/state"
import type { EditorView } from "@codemirror/view"
import { cellSourcePos } from "../toolbar/table-position"
import type { CellMark, CellWidget } from "../types"
import { cellMarksFacet, cellWidgetsFacet } from "./config"
import { widgetsIn, type PaintWidget } from "./table-cell-widgets"

export interface CellPaint {
  /** `from`/`to` are offsets into the cell's raw string. */
  marks: { from: number; to: number; class: string; attributes?: Record<string, string> }[]
  widgets: PaintWidget[]
  cellClass: string[]
}

/**
 * The marks that touch a cell whose trimmed content starts at document
 * position `base`, as offsets into its raw string (`lead` leading blanks, then
 * `len` characters of content). `null` when none do.
 */
export function cellPaint(
  marks: readonly CellMark[],
  base: number,
  lead: number,
  len: number,
): CellPaint | null {
  const out: CellPaint = { marks: [], widgets: [], cellClass: [] }
  for (const m of marks) {
    if (m.to <= base || m.from >= base + len || m.to <= m.from) continue
    out.marks.push({
      from: Math.max(m.from - base, 0) + lead,
      to: Math.min(m.to - base, len) + lead,
      class: m.class,
      attributes: m.attributes,
    })
    addClasses(out, m.cellClass)
  }
  return out.marks.length || out.cellClass.length ? out : null
}

/** Add `classes` (space-separated) to `paint`'s cell classes. */
const addClasses = (paint: CellPaint, classes?: string) => {
  for (const c of classes?.split(/\s+/) ?? []) {
    if (c && !paint.cellClass.includes(c)) paint.cellClass.push(c)
  }
}

/** What the painter needs from its table widget. */
export interface PainterHost {
  view: () => EditorView | null
  /** Whether the table is in the document yet; its place is unknown until then. */
  mounted: () => boolean
  /** The table's start in the document. */
  from: (view: EditorView) => number
  raw: (r: number, c: number) => string
}

/**
 * `paintCell`'s `paintOf` for one table. The host's marks and the table's
 * position are read once per editor state, not once per cell.
 */
export function markPainter(host: PainterHost): (r: number, c: number) => CellPaint | null {
  let at: {
    state: EditorState
    marks: readonly CellMark[]
    widgets: readonly CellWidget[]
    from: number
  } | null = null
  return (r, c) => {
    const view = host.view()
    if (!view || !host.mounted()) return null
    if (at?.state !== view.state) {
      const marks = view.state.facet(cellMarksFacet)(view.state)
      const widgets = view.state.facet(cellWidgetsFacet)(view.state)
      at = {
        state: view.state,
        marks,
        widgets,
        from: marks.length || widgets.length ? host.from(view) : 0,
      }
    }
    if (!at.marks.length && !at.widgets.length) return null
    const base = cellSourcePos(view.state.doc, at.from, r, c)
    const raw = host.raw(r, c)
    if (base == null) return null
    const lead = raw.length - raw.trimStart().length
    const len = raw.trim().length
    const paint = cellPaint(at.marks, base, lead, len)
    const widgets = widgetsIn(at.widgets, view, base, lead, len)
    if (!widgets.length) return paint
    const out = paint ?? { marks: [], widgets: [], cellClass: [] }
    out.widgets = widgets
    for (const w of widgets) addClasses(out, w.cellClass)
    return out
  }
}
