import { syntaxTree } from "@codemirror/language"
import { type EditorState, type Range, StateField } from "@codemirror/state"
import { Decoration, type DecorationSet, EditorView, WidgetType } from "@codemirror/view"
import katex from "katex"
import { inPlaceConfigFacet } from "./config"
import { revealedLines } from "./reveal"
import { inCodeContext, rangeRevealed, type Tree } from "./scan"

// The `\w` / whitespace guards keep "$100 and $200" from reading as math.
export const INLINE_MATH = /(?<![\w$])\$(?!\s)([^\n$]+?)(?<!\s)\$(?![\w$])/g
const ONE_LINE_BLOCK = /(?<![\w$])\$\$([^\n$]+?)\$\$(?![\w$])/g
const ANY_BLOCK = /(?<![\w$])\$\$([^]+?)\$\$/g

export interface MathAt {
  from: number
  to: number
  src: string
  block: boolean
}

/**
 * The one-line `$$…$$` or `$…$` math span of `text` covering `head`, or `null`.
 * Used by the right-click **Math** field to find what the caret is inside —
 * multi-line `$$` blocks are out of scope, a menu field is one line.
 */
export function mathAtIn(text: string, head: number): MathAt | null {
  for (const m of text.matchAll(ONE_LINE_BLOCK)) {
    const from = m.index ?? 0
    const to = from + (m[0] ?? "").length
    if (head >= from && head <= to) return { from, to, src: (m[1] ?? "").trim(), block: true }
  }
  for (const m of text.matchAll(INLINE_MATH)) {
    const from = m.index ?? 0
    const to = from + (m[0] ?? "").length
    if (head >= from && head <= to) return { from, to, src: (m[1] ?? "").trim(), block: false }
  }
  return null
}

class MathWidget extends WidgetType {
  constructor(
    readonly src: string,
    readonly block: boolean,
  ) {
    super()
  }

  override eq(other: MathWidget) {
    return other.src === this.src && other.block === this.block
  }

  toDOM() {
    const el = document.createElement(this.block ? "div" : "span")
    el.className = this.block ? "cm-inplace-math cm-inplace-math-block" : "cm-inplace-math"
    try {
      katex.render(this.src, el, { displayMode: this.block, throwOnError: false })
    } catch {
      el.textContent = this.block ? `$$${this.src}$$` : `$${this.src}$`
    }
    return el
  }

  override ignoreEvent() {
    return false
  }
}

/**
 * Viewport pass for `$…$` and single-line `$$…$$` — the CodeMirror grammar has
 * no math node. Off-caret matches become KaTeX widgets. Multi-line `$$` blocks
 * are handled by `blockMathField` instead (a plugin may not replace line breaks).
 */
export function scanInlineMath(
  view: EditorView,
  from: number,
  to: number,
  text: string,
  revealed: Set<number>,
  tree: Tree,
  out: Range<Decoration>[],
): void {
  if (!text.includes("$")) return
  const { doc } = view.state
  const claimed: Array<[number, number]> = []

  for (const m of text.matchAll(ONE_LINE_BLOCK)) {
    const src = (m[1] ?? "").trim()
    const start = from + (m.index ?? 0)
    const end = start + (m[0] ?? "").length
    if (!src || inCodeContext(tree, start + 2)) continue
    claimed.push([start, end])
    if (rangeRevealed(revealed, doc, start, end)) continue
    out.push(Decoration.replace({ widget: new MathWidget(src, true) }).range(start, end))
  }

  for (const m of text.matchAll(INLINE_MATH)) {
    const src = (m[1] ?? "").trim()
    const start = from + (m.index ?? 0)
    const end = start + (m[0] ?? "").length
    if (!src || inCodeContext(tree, start + 1)) continue
    if (claimed.some(([s, e]) => start >= s && end <= e)) continue
    if (rangeRevealed(revealed, doc, start, end)) continue
    out.push(Decoration.replace({ widget: new MathWidget(src, false) }).range(start, end))
  }
}

interface BlockMathState {
  decorations: DecorationSet
  /** Every `$$…$$` block's `[from, to)`, whether or not it's currently
   *  revealed — a revealed block has no decoration to check against, so this
   *  is what lets a selection-only transaction tell whether the caret just
   *  entered or left one without re-scanning the whole document to find out. */
  ranges: { from: number; to: number }[]
}

/** Does any line either selection touches fall inside one of `ranges`? */
function selectionNearRange(
  state: EditorState,
  selection: EditorState["selection"],
  ranges: { from: number; to: number }[],
): boolean {
  const lineSpans = ranges.map((r) => ({
    first: state.doc.lineAt(r.from).number,
    last: state.doc.lineAt(r.to).number,
  }))
  for (const range of selection.ranges) {
    const first = state.doc.lineAt(range.from).number
    const last = state.doc.lineAt(range.to).number
    for (let n = first; n <= last; n++) {
      if (lineSpans.some((s) => s.first <= n && n <= s.last)) return true
    }
  }
  return false
}

/**
 * Multi-line `$$…$$` blocks, whose delimiters sit alone on their own lines.
 * A state field (not a plugin) because the replacement spans line breaks. Not
 * viewport-scoped — the whole document is scanned on a doc change, but `$$`
 * blocks are few and a pure caret move reuses the last build's `ranges`
 * instead of rescanning.
 */
export const blockMathField = StateField.define<BlockMathState>({
  create: buildBlockMath,
  update(value, tr) {
    if (tr.docChanged) return buildBlockMath(tr.state)
    if (!tr.selection) return value
    const near =
      selectionNearRange(tr.state, tr.startState.selection, value.ranges) ||
      selectionNearRange(tr.state, tr.state.selection, value.ranges)
    return near ? buildBlockMath(tr.state) : value
  },
  provide: (field) => [
    EditorView.decorations.from(field, (v) => v.decorations),
    EditorView.atomicRanges.of((view) => view.state.field(field).decorations),
  ],
})

function buildBlockMath(state: EditorState): BlockMathState {
  if (!state.facet(inPlaceConfigFacet).math) return { decorations: Decoration.none, ranges: [] }
  const text = state.doc.toString()
  if (!text.includes("$$")) return { decorations: Decoration.none, ranges: [] }

  const out: Range<Decoration>[] = []
  const ranges: { from: number; to: number }[] = []
  const revealed = revealedLines(state)
  const tree = syntaxTree(state)

  for (const m of text.matchAll(ANY_BLOCK)) {
    const raw = m[0] ?? ""
    const src = (m[1] ?? "").trim()
    if (!src || !raw.includes("\n")) continue

    const start = m.index ?? 0
    const end = start + raw.length
    const startLine = state.doc.lineAt(start)
    const endLine = state.doc.lineAt(end)
    const before = state.doc.sliceString(startLine.from, start).trim()
    const after = state.doc.sliceString(end, endLine.to).trim()
    if (before !== "" || after !== "") continue
    if (inCodeContext(tree, start + 2)) continue
    ranges.push({ from: start, to: end })
    if (rangeRevealed(revealed, state.doc, start, end)) continue

    out.push(
      Decoration.replace({ widget: new MathWidget(src, true), block: true }).range(start, end),
    )
  }

  return { decorations: Decoration.set(out, true), ranges }
}
