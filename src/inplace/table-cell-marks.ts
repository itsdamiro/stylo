/**
 * Host marks inside a table cell. A cell is `contenteditable` DOM outside
 * CodeMirror's decoration system, so a host's `Decoration.mark` never reaches
 * it; instead the host's `CellMark`s (document positions) are cut down to the
 * cell and drawn here as wrapper elements around the characters they cover.
 *
 * Offsets are into the cell's raw string (`rows[r][c]`, `\|` escapes and all).
 * A raw (focused) cell shows that string as one text node, so they apply
 * directly; a rendered cell shows `renderInline`'s output, whose text nodes are
 * aligned back to the raw string by matching forward, skipping the syntax.
 */

import type { EditorState } from "@codemirror/state"
import type { EditorView } from "@codemirror/view"
import { cellSourcePos } from "../toolbar/table-position"
import type { CellMark, CellWidget } from "../types"
import { cellMarksFacet, cellWidgetsFacet } from "./config"
import { align, type Piece } from "./table-cell-align"
import { placeWidgets, widgetEl, widgetsIn, type PaintWidget } from "./table-cell-widgets"

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

type Mark = CellPaint["marks"][number]
function wrapper(m: Mark, child: Node): HTMLElement {
  const el = document.createElement("span")
  el.className = m.class
  el.dataset.styloCellMark = ""
  for (const [k, v] of Object.entries(m.attributes ?? {})) {
    try {
      el.setAttribute(k, v)
    } catch {
      // A host's invalid attribute name costs that attribute, not the table.
    }
  }
  el.append(child)
  return el
}

/** Replace `piece`'s text node by its characters, each run wrapped by the marks covering it. */
function wrapPiece(piece: Piece, marks: Mark[], widgets: PaintWidget[]): boolean {
  const text = piece.node.data
  const end = piece.start + text.length
  const hit = marks.filter((m) => m.from < end && m.to > piece.start)
  if (!hit.length && !widgets.length) return false
  const cuts = new Set([piece.start, end])
  for (const w of widgets) cuts.add(w.at)
  for (const m of hit) {
    cuts.add(Math.max(m.from, piece.start))
    cuts.add(Math.min(m.to, end))
  }
  const sorted = [...cuts].sort((a, b) => a - b)
  const frag = document.createDocumentFragment()
  const put = (at: number) => {
    for (const w of widgets) if (w.at === at) frag.append(widgetEl(w))
  }
  put(piece.start)
  for (let i = 0; i < sorted.length - 1; i++) {
    const [a, b] = [sorted[i]!, sorted[i + 1]!]
    let node: Node = document.createTextNode(text.slice(a - piece.start, b - piece.start))
    for (const m of hit) if (m.from <= a && m.to >= b) node = wrapper(m, node)
    frag.append(node)
    put(b)
  }
  piece.node.replaceWith(frag)
  return true
}

/** Wrap everything in `cell` in one element per mark. */
function wrapAll(cell: HTMLElement, marks: Mark[]) {
  for (const m of marks) {
    const el = wrapper(m, cell.ownerDocument.createDocumentFragment())
    el.append(...cell.childNodes)
    cell.append(el)
  }
}

/**
 * Draw `paint` on `cell`, just painted from `raw`. A mark that covers no
 * rendered character (it sits on a link target, say) marks the whole cell
 * rather than nothing; so does a cell whose text can't be aligned.
 */
export function applyPaint(cell: HTMLElement, raw: string, paint: CellPaint, focused: boolean) {
  let marks = paint.marks
  // A focused cell shows raw source, which a widget would corrupt: none there.
  let widgets: PaintWidget[] = []
  const whole: Mark[] = []
  let pieces: Piece[] | null
  if (focused) {
    pieces = cell.firstChild instanceof Text ? [{ node: cell.firstChild, start: 0 }] : null
  } else {
    // Rendered text has each `\|` as one character; bring the marks along.
    const escapes = [...raw.matchAll(/\\\|/g)].map((m) => m.index!)
    const toSource = (o: number) => o - escapes.filter((p) => p < o).length
    pieces = align(cell, raw.replace(/\\\|/g, "|"))
    marks = marks.map((m) => ({ ...m, from: toSource(m.from), to: toSource(m.to) }))
    widgets = paint.widgets.map((w) => ({ ...w, at: toSource(w.at) }))
  }
  const { placed, loose } = placeWidgets(pieces, widgets)
  const atEnd = () => cell.append(...loose.map(widgetEl))
  if (!pieces) {
    wrapAll(cell, marks)
    return atEnd()
  }
  const reached = new Set<Mark>()
  for (const p of pieces) {
    for (const m of marks) {
      if (m.from < p.start + p.node.data.length && m.to > p.start) reached.add(m)
    }
  }
  for (const m of marks) if (!reached.has(m)) whole.push(m)
  for (const p of pieces) wrapPiece(p, marks, placed.get(p) ?? [])
  wrapAll(cell, whole)
  atEnd()
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
