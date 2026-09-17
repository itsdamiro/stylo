/**
 * ADR-007 Stage 3 — line-prefix backspace.
 *
 * With `## `, `> `, `- ` and friends hidden and atomic, the caret at the visual
 * start of a heading / quote / list line sits just past the hidden prefix.
 * Backspace there removes one level of prefix instead of joining the line to the
 * one above — the Notion "backspace to unstyle" gesture:
 *
 * - heading  → paragraph (the whole `#{1,6} ` goes)
 * - quote    → one `> ` level out (nested quotes step out one at a time)
 * - list     → outdent one step, or drop the marker when already flush
 * - task     → paragraph (`- [ ] ` goes)
 *
 * Only fires while that prefix is actually hidden (so `reveal: "caret"` with the
 * caret on the line is untouched — the prefix is visible there and a normal
 * backspace edits it).
 */

import { syntaxTree } from "@codemirror/language"
import { Prec, type EditorState, type Extension } from "@codemirror/state"
import { type Command, type EditorView, keymap } from "@codemirror/view"
import type { SyntaxNode } from "@lezer/common"
import { activeTableCell } from "../toolbar/cell-inline"
import { BULLET, LIST_MARKER, ORDERED, QUOTE, TASK } from "../toolbar/command-helpers"
import { HEADING_PREFIX } from "../toolbar/heading"
import { markersHidden } from "./wrap-at"

interface PrefixEdit {
  /** Length of the whole hidden prefix — the caret at visual column 0 sits here. */
  prefixLen: number
  /** `[start, end)` within the line to remove for "one level out". */
  drop: [number, number]
}

// A run of nested blockquote levels, each tolerating CommonMark's 0–3 leading
// spaces — built from `QUOTE.match` itself (minus its own `^` anchor) rather
// than a second hand-written pattern, so the two can't drift apart again.
const QUOTE_RUN = new RegExp(`^(?:${QUOTE.match.source.replace(/^\^/, "")})+`)

/**
 * Width of the nearest *enclosing* list item's own marker (e.g. 2 for `- `,
 * 3 for `1. ` / `1) `, 4 for `10. `) — the number of columns a line nested
 * under it needs to stay nested, so a Backspace outdent steps out exactly one
 * level instead of guessing a fixed width. `null` when `linePos`'s line isn't
 * nested inside another list item.
 */
function enclosingMarkerWidth(state: EditorState, linePos: number): number | null {
  const ownLine = state.doc.lineAt(linePos).number
  for (
    let node: SyntaxNode | null = syntaxTree(state).resolveInner(linePos, 1);
    node;
    node = node.parent
  ) {
    if (node.name !== "ListItem") continue
    // A `ListItem` starting on this same line is the line's own item, not an
    // ancestor — keep climbing past it (this also makes the search immune to
    // which side of a boundary `resolveInner` happened to land on).
    if (state.doc.lineAt(node.from).number === ownLine) continue
    const m = LIST_MARKER.exec(state.doc.lineAt(node.from).text)
    if (m) return m[0].length
  }
  return null
}

function prefixEditAt(state: EditorState, line: { text: string; from: number }): PrefixEdit | null {
  const text = line.text
  const heading = HEADING_PREFIX.exec(text)
  if (heading) return { prefixLen: heading[0].length, drop: [0, heading[0].length] }

  const quoteRun = QUOTE_RUN.exec(text)
  if (quoteRun) {
    const one = QUOTE.match.exec(text)![0].length
    return { prefixLen: quoteRun[0].length, drop: [0, one] }
  }

  const task = TASK.match.exec(text)
  if (task) return { prefixLen: task[0].length, drop: [0, task[0].length] }

  const list = BULLET.match.exec(text) ?? ORDERED.match.exec(text)
  if (list) {
    const indent = list[1] ?? ""
    const markerLen = list[0].length - indent.length
    if (indent) {
      const parentWidth = enclosingMarkerWidth(state, line.from) ?? 2
      const step = indent.startsWith("\t") ? 1 : Math.min(parentWidth, indent.length)
      return { prefixLen: list[0].length, drop: [0, step] }
    }
    return { prefixLen: markerLen, drop: [0, markerLen] }
  }
  return null
}

/** Backspace at visual column 0 of a hidden-prefix line — one level out. */
export const unwrapLinePrefix: Command = (view: EditorView): boolean => {
  if (activeTableCell(view)) return false
  const { state } = view
  const sel = state.selection.main
  if (!sel.empty) return false

  const line = state.doc.lineAt(sel.head)
  if (!markersHidden(state, line.number)) return false

  const edit = prefixEditAt(state, line)
  if (!edit) return false

  // Visual column 0: the caret is within the hidden prefix run — atomic ranges
  // collapse every position from `line.from` to the prefix end to one pixel.
  if (sel.head < line.from || sel.head > line.from + edit.prefixLen) return false

  const [ds, de] = edit.drop
  view.dispatch({
    changes: { from: line.from + ds, to: line.from + de, insert: "" },
    selection: { anchor: line.from + ds },
    userEvent: "delete.backward",
    scrollIntoView: true,
  })
  return true
}

export const inPlaceLinePrefixEdit: Extension = Prec.high(
  keymap.of([{ key: "Backspace", run: unwrapLinePrefix }]),
)
