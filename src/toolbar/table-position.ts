/**
 * Pipe-table parsing and cell-position arithmetic, shared by `table.ts`'s
 * editing commands and the in-place canvas (which needs a document position to
 * land the caret in when a rendered table reveals its source).
 */

import type { Text } from "@codemirror/state"
import { cellBounds, parseGrid } from "./table-grid"

export interface Region {
  from: number
  to: number
  lines: string[]
}

/** The contiguous pipe-table block containing `pos`, if it parses as a table. */
export function findTable(doc: Text, pos: number): Region | null {
  const at = doc.lineAt(pos)
  if (!at.text.includes("|")) return null
  let first = at.number
  while (first > 1) {
    const t = doc.line(first - 1).text
    if (!t.includes("|") || !t.trim()) break
    first--
  }
  let last = at.number
  while (last < doc.lines) {
    const t = doc.line(last + 1).text
    if (!t.includes("|") || !t.trim()) break
    last++
  }
  if (last - first < 1) return null
  const lines: string[] = []
  for (let n = first; n <= last; n++) lines.push(doc.line(n).text)
  if (!parseGrid(lines)) return null
  return { from: doc.line(first).from, to: doc.line(last).to, lines }
}

export interface CellLoc {
  row: number // index into grid.rows (header = 0)
  col: number
  offset: number // char offset within the cell's trimmed content
  onDelimiter: boolean
}

/** The cell (and offset within it) that document position `caret` falls in,
 *  for a table whose lines start at `from`. */
export function locate(lines: string[], from: number, caret: number): CellLoc | null {
  let lineStart = from
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!
    if (caret <= lineStart + line.length) {
      const x = caret - lineStart
      if (i === 1) {
        let pipes = 0
        for (let k = 0; k < x && k < line.length; k++) if (line[k] === "|") pipes++
        return { row: 0, col: Math.max(0, pipes - 1), offset: 0, onDelimiter: true }
      }
      const bounds = cellBounds(line)
      let col = 0
      for (let c = 0; c < bounds.length; c++) {
        col = c
        if (x <= bounds[c]!.end) break
      }
      const b = bounds[col]
      const offset = b ? Math.max(0, Math.min(x, b.contentEnd) - b.contentStart) : 0
      return { row: i === 0 ? 0 : i - 1, col, offset, onDelimiter: false }
    }
    lineStart += line.length + 1
  }
  return null
}

/** The document position `loc` resolves to, for a table's `text` starting at `from`. */
export function resolve(text: string, from: number, loc: CellLoc): number {
  const lines = text.split("\n")
  const idx = loc.onDelimiter ? 1 : loc.row === 0 ? 0 : loc.row + 1
  let pos = from
  for (let i = 0; i < idx; i++) pos += lines[i]!.length + 1
  const bounds = cellBounds(lines[idx]!)
  const b = bounds[Math.min(loc.col, bounds.length - 1)]
  if (!b) return pos
  return pos + b.contentStart + Math.min(loc.offset, b.contentEnd - b.contentStart)
}

/**
 * Document position of the start of a table cell's content, for the pipe table
 * that contains `tableFrom`. `row` is the content-row index (header = 0, first
 * body row = 1, …); the delimiter row is not counted. Used to land the caret in
 * the clicked cell when a rendered in-place table reveals its source.
 */
export function cellSourcePos(
  doc: Text,
  tableFrom: number,
  row: number,
  col: number,
): number | null {
  const region = findTable(doc, tableFrom)
  if (!region || row > region.lines.length - 2) return null // no such row (yet)
  return resolve(region.lines.join("\n"), region.from, { row, col, offset: 0, onDelimiter: false })
}
