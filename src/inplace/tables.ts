import { syntaxTree } from "@codemirror/language"
import { type EditorState, type Range, StateField, type Text } from "@codemirror/state"
import { Decoration, type DecorationSet, EditorView, WidgetType } from "@codemirror/view"
import type { SyntaxNode } from "@lezer/common"
import { type Align, parseGrid } from "../toolbar/table-grid"
import { embedRegistryFacet, inPlaceConfigFacet, tableEditingFacet } from "./config"
import { frontmatterRange } from "./frontmatter"
import { renderInline } from "./inline-md"
import { revealedLines } from "./reveal"
import { mountStatic } from "./table-static-paint"
import { EditableTableWidget, fromTableWidget, type ParsedTable } from "./table-widget"

/**
 * A GFM pipe table rendered as a real `<table>`. Cell text is run through
 * `renderInline` so `**bold**`, `` `code` ``, `[links]`, `[[wikilinks]]`, and
 * `$math$` display formatted; the caret entering any table line still reveals
 * the full source.
 */
class TableWidget extends WidgetType {
  constructor(
    readonly table: ParsedTable,
    readonly embeds: boolean,
  ) {
    super()
  }

  override eq(other: TableWidget) {
    return JSON.stringify(this.table) === JSON.stringify(other.table)
  }

  toDOM(view: EditorView) {
    const { head, body, aligns } = this.table
    const el = document.createElement("table")
    el.className = "cm-inplace-table"

    // `\|` is a literal pipe inside a GFM cell — unescape before inline parsing.
    const cell = (raw: string) => renderInline(raw.replace(/\\\|/g, "|"), this.embeds)

    const hr = el.createTHead().insertRow()
    head.forEach((text, i) => {
      const th = document.createElement("th")
      th.appendChild(cell(text))
      th.dataset.styloRow = "0"
      th.dataset.styloCol = String(i)
      align(th, aligns[i])
      hr.appendChild(th)
    })

    const tbody = el.createTBody()
    body.forEach((row, r) => {
      const tr = tbody.insertRow()
      for (let i = 0; i < head.length; i++) {
        const td = tr.insertCell()
        td.appendChild(cell(row[i] ?? ""))
        td.dataset.styloRow = String(r + 1)
        td.dataset.styloCol = String(i)
        align(td, aligns[i])
      }
    })
    mountStatic(el, view, [head, ...body], this.embeds, tableField)
    return el
  }

  override ignoreEvent() {
    return false
  }
}

function align(cell: HTMLTableCellElement, value: Align | undefined) {
  if (value) cell.style.textAlign = value
}

/**
 * Parse a `Table` syntax node into `{ head, body, aligns }` by pipe-splitting
 * its raw lines. The Lezer parser omits a `TableCell` node for a whitespace-only
 * cell, so a tree-based read collapses `| | x |` to a single column — pull the
 * cells from the text instead, reusing the toolbar's grid parser.
 */
function parseTable(node: SyntaxNode, doc: Text): ParsedTable | null {
  const first = doc.lineAt(node.from).number
  const last = doc.lineAt(node.to).number
  const lines: string[] = []
  for (let n = first; n <= last; n++) lines.push(doc.line(n).text)

  const grid = parseGrid(lines)
  if (!grid || grid.rows.length === 0) return null
  return { head: grid.rows[0]!, body: grid.rows.slice(1), aligns: grid.aligns }
}

/** Is `pos` inside (or on the edge of) a `Table` node — cheap via the syntax
 *  tree's own incremental point-resolution, unlike a document-wide rescan.
 *  Checked on both sides of `pos`: resolving a boundary position with only
 *  one bias can land just past the table instead of inside it (e.g. a caret
 *  placed at the table's own closing edge). */
function nearTable(state: EditorState, pos: number): boolean {
  const tree = syntaxTree(state)
  for (const side of [-1, 1] as const) {
    for (let node: SyntaxNode | null = tree.resolveInner(pos, side); node; node = node.parent) {
      if (node.name === "Table") return true
    }
  }
  return false
}

function selectionNearTable(state: EditorState, selection: EditorState["selection"]): boolean {
  return selection.ranges.some((r) => nearTable(state, r.from) || nearTable(state, r.to))
}

function build(state: EditorState): DecorationSet {
  if (!state.facet(inPlaceConfigFacet).tables) return Decoration.none
  // `EditableTableWidget`'s cells are a native `contenteditable` DOM region
  // (table-widget-render.ts), entirely outside CodeMirror's own `editable`/
  // `readOnly` control — falling back to the plain `TableWidget` is what
  // actually keeps a read-only document read-only.
  const editable = state.facet(tableEditingFacet) === "cells" && !state.readOnly
  const embeds = state.facet(embedRegistryFacet) != null && state.facet(inPlaceConfigFacet).embeds
  const tree = syntaxTree(state)
  const fm = frontmatterRange(state.doc)
  const revealed = editable ? null : revealedLines(state)
  const out: Range<Decoration>[] = []

  tree.iterate({
    enter: (node) => {
      if (node.name !== "Table") return undefined
      if (fm && node.from < fm.to) return false

      // In "cells" mode the editable widget stays mounted; the caret lives in
      // its contentEditable cells, so there is no source to reveal.
      if (revealed) {
        const first = state.doc.lineAt(node.from).number
        const last = state.doc.lineAt(node.to).number
        for (let n = first; n <= last; n++) {
          if (revealed.has(n)) return false
        }
      }

      const parsed = parseTable(node.node, state.doc)
      if (parsed) {
        const widget = editable
          ? new EditableTableWidget(parsed, embeds)
          : new TableWidget(parsed, embeds)
        out.push(Decoration.replace({ widget, block: true }).range(node.from, node.to))
      }
      return false
    },
  })

  return Decoration.set(out, true)
}

/**
 * Renders GFM tables in place. A state field, not the view plugin, because the
 * replacement spans line breaks. The whole document is scanned — tables are few.
 */
export const tableField = StateField.define<DecorationSet>({
  create: build,
  update: (value, tr) => {
    // An edit from the editable widget's own DOM: keep the widget instance
    // (and its focused cell) by mapping the existing decoration through the
    // change instead of rebuilding. The block-replace range maps cleanly —
    // its `from` side is negative (→ change start), its `to` side positive
    // (→ change end) — so the mapped span is exactly the new table.
    if (tr.annotation(fromTableWidget)) return value.map(tr.changes)
    // A live `readOnly` flip changes which widget `build` picks (editable vs.
    // plain) even with no doc change, so it needs its own rebuild trigger —
    // same reason `selection-bar.ts` added one for the same prop.
    const readOnlyToggled = tr.startState.readOnly !== tr.state.readOnly
    // In "cells" mode the editable widget is always mounted and owns live DOM
    // (contentEditable cells, an open context menu). A selection-only
    // transaction must not rebuild it — that swaps the widget instance behind
    // the mounted DOM and orphans an in-flight structural edit. Only a real
    // external document change (or `readOnly` turning the whole mode off)
    // reloads it.
    if (tr.state.facet(tableEditingFacet) === "cells") {
      return tr.docChanged || readOnlyToggled ? build(tr.state) : value.map(tr.changes)
    }
    if (tr.docChanged || readOnlyToggled) return build(tr.state)
    if (!tr.selection) return value
    // A pure caret move only ever needs a rebuild if it entered or left a
    // table's line range (to reveal or re-hide its source) — most keystrokes
    // are nowhere near one, so check the (already incrementally maintained)
    // syntax tree before re-parsing every table in the document.
    const near =
      selectionNearTable(tr.state, tr.startState.selection) ||
      selectionNearTable(tr.state, tr.state.selection)
    return near ? build(tr.state) : value
  },
  provide: (field) => [
    EditorView.decorations.from(field),
    EditorView.atomicRanges.of((view) => view.state.field(field)),
  ],
})
