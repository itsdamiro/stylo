import type { EditorState } from "@codemirror/state"
import type { EditorView } from "@codemirror/view"
import { selectedLines } from "./block"

/** An ATX heading's `#` … `###### ` prefix — the single source of truth for
 *  the toolbar and the in-place canvas's Backspace-unwrap alike. */
export const HEADING_PREFIX = /^(#{1,6}) +/

/**
 * Set, swap, or clear an ATX heading prefix on every line the selection touches.
 * A line already at `level` is cleared; any other level (or none) is set to it.
 */
export function toggleHeading(view: EditorView, level: number): boolean {
  const prefix = "#".repeat(level) + " "
  const s = view.state
  const [first, last] = selectedLines(s)
  const changes = []
  for (let n = first; n <= last; n++) {
    const line = s.doc.line(n)
    const m = HEADING_PREFIX.exec(line.text)
    if (m && m[1]!.length === level) {
      changes.push({ from: line.from, to: line.from + m[0].length })
    } else if (m) {
      changes.push({ from: line.from, to: line.from + m[0].length, insert: prefix })
    } else {
      changes.push({ from: line.from, insert: prefix })
    }
  }
  view.dispatch({ changes, scrollIntoView: true })
  view.focus()
  return true
}

/** Strip any ATX heading prefix from every line the selection touches — the
 *  explicit "back to body text" that toggling a heading level does obliquely. */
export function clearHeading(view: EditorView): boolean {
  const s = view.state
  const [first, last] = selectedLines(s)
  const changes = []
  for (let n = first; n <= last; n++) {
    const line = s.doc.line(n)
    const m = HEADING_PREFIX.exec(line.text)
    if (m) changes.push({ from: line.from, to: line.from + m[0].length })
  }
  if (!changes.length) return false
  view.dispatch({ changes, scrollIntoView: true })
  view.focus()
  return true
}
