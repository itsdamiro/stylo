/**
 * ArrowUp / ArrowDown onto a line a block widget has replaced — a lone
 * `![alt](src)` image (ADR-014) or `![[ref]]` embed (ADR-009).
 *
 * The widget is a block replacement with an atomic range, and CodeMirror's
 * vertical motion measures from the rendered picture, so a caret on the blank
 * line above lands on the blank line below and the source is never reached by
 * keyboard. This stops the caret on the widget's line instead, which reveals
 * the source for editing; the next arrow carries on past it. The column is kept
 * where the line is long enough. ArrowLeft, ArrowRight, Backspace and Delete
 * already step onto the line, so they are left to CodeMirror. Ctrl-N and Ctrl-P
 * (macOS line motion) take the same stop as the arrows.
 */

import { type EditorState, EditorSelection, type Extension, Prec } from "@codemirror/state"
import { type Command, type EditorView, keymap } from "@codemirror/view"
import { embedField } from "./embed"
import { imageField } from "./image"

/** Whether a block widget currently replaces the whole of line `n`. */
export function isWidgetLine(state: EditorState, n: number): boolean {
  if (n < 1 || n > state.doc.lines) return false
  const line = state.doc.line(n)
  let hit = false
  for (const field of [imageField, embedField]) {
    state.field(field, false)?.between(line.from, line.to, (_from, _to, deco) => {
      if (deco.spec.block) hit = true // an inline `![[ref]]` mid-sentence is not a widget line
    })
  }
  return hit
}

export function stepOntoWidgetLine(forward: boolean): Command {
  return (view: EditorView): boolean => {
    const { state } = view
    if (state.selection.ranges.length !== 1) return false // more than one cursor: left to CodeMirror
    const range = state.selection.main
    const line = state.doc.lineAt(range.head)
    const target = line.number + (forward ? 1 : -1)
    if (!isWidgetLine(state, target)) return false
    // A wrapped line moves within itself first; only the last visual line steps off it.
    const moved = view.moveVertically(range, forward)
    if (state.doc.lineAt(moved.head).number === line.number) return false

    const dest = state.doc.line(target)
    const col = Math.min(range.head - line.from, dest.length)
    view.dispatch({
      selection: EditorSelection.cursor(dest.from + col),
      scrollIntoView: true,
      userEvent: "select",
    })
    return true
  }
}

export const inPlaceWidgetLineKeys: Extension = Prec.high(
  keymap.of([
    { key: "ArrowDown", run: stepOntoWidgetLine(true) },
    { key: "ArrowUp", run: stepOntoWidgetLine(false) },
    { mac: "Ctrl-n", run: stepOntoWidgetLine(true) },
    { mac: "Ctrl-p", run: stepOntoWidgetLine(false) },
  ]),
)
