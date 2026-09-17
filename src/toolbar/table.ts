import { ChangeSet, EditorSelection, EditorState, type Extension } from "@codemirror/state"
import { keymap } from "@codemirror/view"
import type { EditorView } from "@codemirror/view"
import { parseGrid, serializeGrid, type Grid } from "./table-grid"
import { type CellLoc, findTable, locate, resolve } from "./table-position"

const SKELETON = "| Column 1 | Column 2 |\n| -------- | -------- |\n|          |          |"

/**
 * When the in-place canvas renders tables as editable cells
 * (`inPlace.table: "cells"`), drop DOM focus into the first cell of the table
 * just inserted near `pos`. A no-op on every other surface — nothing matches the
 * selector — so no config check is needed.
 */
function focusInsertedCell(view: EditorView, pos: number): void {
  requestAnimationFrame(() => {
    const tables = view.dom.querySelectorAll<HTMLElement>(".cm-inplace-table-edit")
    if (tables.length === 0) return
    let target = tables[0]!
    let best = Number.POSITIVE_INFINITY
    for (const t of tables) {
      let d = Number.POSITIVE_INFINITY
      try {
        d = Math.abs(view.posAtDOM(t) - pos)
      } catch {
        // still mid-render — leave it to the fallback
      }
      if (d < best) {
        best = d
        target = t
      }
    }
    const cell = target.querySelector<HTMLElement>("th, td")
    if (!cell) return
    const range = document.createRange()
    range.selectNodeContents(cell)
    const sel = cell.ownerDocument.getSelection()
    sel?.removeAllRanges()
    sel?.addRange(range)
    cell.focus()
  })
}

/** Insert a starter table at the cursor and select the first header cell. */
export function insertTable(view: EditorView): boolean {
  const { from, to } = view.state.selection.main
  const line = view.state.doc.lineAt(from)
  const lead = line.text.slice(0, from - line.from).trim() ? "\n\n" : ""
  // A blank line always follows too — without one, a table landing as the
  // document's last block has no line for the caret to move into (the same
  // gap that made exiting it downward via the arrow keys land back above it
  // instead — see table-widget.ts's `exitBelow`).
  const cellAt = from + lead.length + 2 // past "| "
  view.dispatch({
    changes: { from, to, insert: lead + SKELETON + "\n\n" },
    selection: EditorSelection.range(cellAt, cellAt + 8), // "Column 1"
    scrollIntoView: true,
  })
  view.focus()
  focusInsertedCell(view, cellAt)
  return true
}

/** True when the primary caret is inside a pipe table. */
export function tableActive(state: EditorState): boolean {
  return findTable(state.doc, state.selection.main.head) !== null
}

/** Rewrite the table to an aligned grid and move the caret to `target` cell. */
function navigate(view: EditorView, target: (grid: Grid, loc: CellLoc) => CellLoc | null): boolean {
  const region = findTable(view.state.doc, view.state.selection.main.head)
  if (!region) return false
  const grid = parseGrid(region.lines)
  const loc = locate(region.lines, region.from, view.state.selection.main.head)
  if (!grid || !loc) return false
  const next = target(grid, loc)
  if (!next) return false
  const aligned = serializeGrid(grid)
  view.dispatch({
    changes: { from: region.from, to: region.to, insert: aligned },
    selection: EditorSelection.cursor(resolve(aligned, region.from, next)),
    scrollIntoView: true,
  })
  view.focus()
  return true
}

function step(grid: Grid, loc: CellLoc, dir: 1 | -1): CellLoc | null {
  const cols = grid.aligns.length
  let { row, col } = loc
  col += dir
  if (col >= cols) {
    row++
    col = 0
  } else if (col < 0) {
    row--
    col = cols - 1
  }
  if (row < 0) return null
  if (row >= grid.rows.length) grid.rows.push(new Array(cols).fill(""))
  return { row, col, offset: 0, onDelimiter: false }
}

function down(grid: Grid, loc: CellLoc): CellLoc | null {
  const row = loc.row + 1
  if (row >= grid.rows.length) grid.rows.push(new Array(grid.aligns.length).fill(""))
  return { row, col: loc.col, offset: 0, onDelimiter: false }
}

/**
 * Table editing keys, live only when the caret is inside a pipe table:
 * Tab / Shift-Tab walk the cells (Tab past the end adds a row), Enter drops to
 * the cell below (adding a row at the bottom). Every move re-aligns the grid.
 * Outside a table the bindings return false, so normal Tab / Enter are intact.
 */
export const tableKeymap: Extension = keymap.of([
  { key: "Tab", run: (v) => navigate(v, (g, l) => step(g, l, 1)) },
  { key: "Shift-Tab", run: (v) => navigate(v, (g, l) => step(g, l, -1)) },
  { key: "Enter", run: (v) => navigate(v, down) },
])

/**
 * Live pipe alignment. On every typing / deletion transaction whose caret ends
 * up inside a table, the grid is re-serialized and the change composed into the
 * same transaction (one undo step). Idempotent, so it does not re-trigger.
 */
export const tableRealign: Extension = EditorState.transactionFilter.of((tr) => {
  if (!tr.docChanged) return tr
  // An IME composition update is tagged "input.type.compose" (or
  // ".compose.start"); rewriting the document and remapping the selection
  // mid-composition is a known CodeMirror 6 hazard, so leave those alone.
  if (tr.isUserEvent("input.type.compose")) return tr
  if (!tr.isUserEvent("input") && !tr.isUserEvent("delete")) return tr
  const head = tr.newSelection.main.head
  const region = findTable(tr.newDoc, head)
  if (!region) return tr
  const grid = parseGrid(region.lines)
  if (!grid) return tr
  const aligned = serializeGrid(grid)
  if (aligned === region.lines.join("\n")) return tr
  const loc = locate(region.lines, region.from, head)
  const align = ChangeSet.of(
    [{ from: region.from, to: region.to, insert: aligned }],
    tr.newDoc.length,
  )
  return {
    changes: tr.changes.compose(align),
    selection: loc ? EditorSelection.cursor(resolve(aligned, region.from, loc)) : tr.newSelection,
    effects: tr.effects,
    scrollIntoView: tr.scrollIntoView,
  }
})
