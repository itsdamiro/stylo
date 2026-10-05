import { markedContentAt } from "../toolbar/inline-ops"
import type { ParsedTable } from "./table-widget"

/** `[head, ...body]` as raw cell strings — the editable widget's source of truth. */
export const gridOf = (t: ParsedTable): string[][] => [t.head, ...t.body].map((r) => [...r])

export const trimGrid = (rows: string[][]): string[][] => rows.map((r) => r.map((s) => s.trim()))

/** A GFM cell escapes a literal pipe as `\|`; unescape before inline parsing. */
export const unescapePipe = (s: string): string => s.replace(/\\\|/g, "|")

/** Total length of the text nodes inside `cell` that precede `target`. */
function textBefore(cell: HTMLElement, target: Node): number {
  const walker = cell.ownerDocument.createTreeWalker(cell, NodeFilter.SHOW_TEXT)
  let offset = 0
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (n === target) return offset
    offset += n.textContent?.length ?? 0
  }
  return offset
}

/** Char offset of a DOM point within `cell`'s text, whatever node it is in. */
function offsetAt(cell: HTMLElement, node: Node | null | undefined, off: number): number {
  if (!node || !cell.contains(node)) return (cell.textContent ?? "").length
  const range = cell.ownerDocument.createRange()
  range.setStart(cell, 0)
  range.setEnd(node, off)
  return range.toString().length
}

/** Char offset of the DOM selection within `cell`'s rendered text. */
export function renderedCaretOffset(cell: HTMLElement): number {
  const sel = cell.ownerDocument.getSelection()
  return sel?.anchorNode && cell.contains(sel.anchorNode)
    ? offsetAt(cell, sel.anchorNode, sel.anchorOffset)
    : 0
}

/** `[from, to]` char offsets of the DOM selection within `cell`'s text. */
export function selectionOffsets(cell: HTMLElement): { from: number; to: number } {
  const sel = cell.ownerDocument.getSelection()
  if (!sel || sel.rangeCount === 0) {
    const end = (cell.textContent ?? "").length
    return { from: end, to: end }
  }
  const a = offsetAt(cell, sel.anchorNode, sel.anchorOffset)
  const b = offsetAt(cell, sel.focusNode, sel.focusOffset)
  return { from: Math.min(a, b), to: Math.max(a, b) }
}

type PointDoc = Document & {
  caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null
}

/** Char offset within `cell`'s rendered text at a screen point, `0` if unresolved. */
export function offsetFromPoint(cell: HTMLElement, x: number, y: number): number {
  const doc = cell.ownerDocument as PointDoc
  let node: Node | null = null
  let nodeOffset = 0
  if (doc.caretPositionFromPoint) {
    const p = doc.caretPositionFromPoint(x, y)
    if (p) [node, nodeOffset] = [p.offsetNode, p.offset]
  } else if (doc.caretRangeFromPoint) {
    const r = doc.caretRangeFromPoint(x, y)
    if (r) [node, nodeOffset] = [r.startContainer, r.startOffset]
  }
  if (!node || !cell.contains(node)) return 0
  return textBefore(cell, node) + (node.nodeType === Node.TEXT_NODE ? nodeOffset : 0)
}

const WORD_CHAR = /[\p{L}\p{N}_]/u

/**
 * Select the word at a screen point in `cell`'s raw text — the cell equivalent
 * of the canvas's "right-click selects the word under the pointer". A point
 * inside a marked run (`**bold phrase**`, `[a link](url)`, …) selects the whole
 * run's text instead, so a Format toggle covers all of it. Returns `false`
 * (leaving any caret / selection untouched) when the point is on whitespace or
 * punctuation, so a menu opened there still has a target.
 */
export function selectWordAtPoint(cell: HTMLElement, x: number, y: number): boolean {
  const text = cell.textContent ?? ""
  const at = offsetFromPoint(cell, x, y)
  const run = markedContentAt(text, at)
  if (run) {
    placeCaret(cell, run.from, run.to)
    return true
  }
  let from = at
  let to = at
  while (from > 0 && WORD_CHAR.test(text[from - 1]!)) from--
  while (to < text.length && WORD_CHAR.test(text[to]!)) to++
  if (to <= from) return false
  placeCaret(cell, from, to)
  return true
}

/** The text node and offset of char `offset` within `cell`'s text (clamped to its end). */
function pointAt(cell: HTMLElement, offset: number): [Node, number] {
  const walker = cell.ownerDocument.createTreeWalker(cell, NodeFilter.SHOW_TEXT)
  let left = offset
  let last: Text | null = null
  for (let n = walker.nextNode() as Text | null; n; n = walker.nextNode() as Text | null) {
    if (left <= n.data.length) return [n, left]
    left -= n.data.length
    last = n
  }
  return last ? [last, last.data.length] : [cell, 0]
}

/**
 * Select `cell`'s text from char `offset` to char `head` (both clamped; the
 * text may be split over several nodes by host marks). With `head` omitted or
 * equal, the caret is simply parked at `offset`.
 */
export function placeCaret(cell: HTMLElement, offset: number, head = offset) {
  cell.focus()
  const doc = cell.ownerDocument
  const range = doc.createRange()
  const [from, to] = [Math.min(offset, head), Math.max(offset, head)]
  const [a, b] = [pointAt(cell, from), pointAt(cell, to)]
  if (a[0] === cell) range.selectNodeContents(cell)
  else {
    range.setStart(a[0], a[1])
    range.setEnd(b[0], b[1])
  }
  if (offset === head) range.collapse(true)
  const sel = doc.getSelection()
  sel?.removeAllRanges()
  sel?.addRange(range)
}
