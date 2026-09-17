import { syntaxTree } from "@codemirror/language"
import type { Range } from "@codemirror/state"
import { Decoration, type DecorationSet, type EditorView } from "@codemirror/view"
import { inPlaceConfigFacet, revealModeFacet } from "./config"
import { frontmatterRange } from "./frontmatter"
import { scanListGuides } from "./list-guides"
import { scanInlineMath } from "./math"
import { decorateNode } from "./nodes"
import { revealedLines } from "./reveal"
import { scanWikilinks } from "./wikilinks"

/** Shared empty set for `reveal: "never"` — no line ever counts as revealed. */
const NO_LINES: Set<number> = new Set()

/** Value carried by the coalesced atomic ranges — never rendered, only its span matters. */
const ATOMIC = Decoration.replace({})

export interface InPlaceDecorations {
  decorations: DecorationSet
  /** Every replacing decoration — the caret steps over these rather than into them. */
  atomic: DecorationSet
}

/**
 * Build the in-place decoration set for the visible viewport only — the syntax
 * tree is walked across `view.visibleRanges`, never the whole document, so the
 * cost stays bounded on long notes. Decorations are collected unordered and
 * sorted by `Decoration.set`, which tolerates the overlaps that nested emphasis
 * and marker-inside-styled-span produce. Multi-line `$$` blocks and the
 * frontmatter block are handled by their own state fields (a plugin may not
 * replace line breaks).
 */
export function buildDecorations(view: EditorView): InPlaceDecorations {
  const out: Range<Decoration>[] = []
  const caretRevealed = revealedLines(view.state)
  const revealed = view.state.facet(revealModeFacet) === "never" ? NO_LINES : caretRevealed
  const tree = syntaxTree(view.state)
  const { doc } = view.state
  const toggles = view.state.facet(inPlaceConfigFacet)
  const ctx = {
    doc,
    revealed,
    caretRevealed,
    out,
    toggles,
    fmEnd: frontmatterRange(doc)?.to ?? -1,
    quoteRevealed: new Set<number>(),
  }

  for (const range of view.visibleRanges) {
    tree.iterate({
      from: range.from,
      to: range.to,
      enter: (node) => decorateNode(node, ctx),
    })
    // Sliced once here — `scanWikilinks` and `scanInlineMath` both need the
    // range's raw text, and re-slicing it independently in each doubled the
    // string-extraction cost on every keystroke, selection change, and scroll.
    const text = view.state.doc.sliceString(range.from, range.to)
    if (toggles.wikilinks) scanWikilinks(view, range.from, range.to, text, revealed, tree, out)
    // `revealed`, not `caretRevealed`: under `reveal: "never"` inline / one-line
    // math no longer shows its `$…$` / `$$…$$` on caret entry — the right-click
    // Math field edits it in place instead (the parallel of the Stage 4 link
    // field). Under `reveal: "caret"` the two sets are equal, so that mode is
    // unchanged. Multi-line `$$` blocks are unaffected — `blockMathField` keeps
    // its own caret-reveal, the same standing exception fenced code had before
    // ADR-007 item 9a.
    if (toggles.math) scanInlineMath(view, range.from, range.to, text, revealed, tree, out)
    scanListGuides(range.from, range.to, tree, doc, toggles, out)
  }

  // Every replacing decoration (marker-hiding and widgets) is atomic, so the
  // caret steps over hidden syntax instead of into invisible positions.
  // `EditorView.atomicRanges` only skips a range the caret sits *strictly*
  // inside, so two touching ranges — a `***word***` prefix is `**` then `*` —
  // leave a landable seam between them where arrow keys stop and typing splits
  // the marks. Coalescing touching ranges into one closes that seam.
  const replaces = out
    .filter((r) => r.from < r.to && !r.value.spec.class)
    .sort((a, b) => a.from - b.from || a.to - b.to)
  const atomic: Range<Decoration>[] = []
  for (const r of replaces) {
    // A non-widget replace that covers an entire line (a bare `>` callout line)
    // would leave the caret nowhere to land — clicks bounce and a vertical
    // arrow skips the line. Keep it hidden but not atomic so both edges stay
    // reachable.
    if (!r.value.spec.widget) {
      const line = doc.lineAt(r.from)
      if (r.from === line.from && r.to === line.to) continue
    }
    const last = atomic[atomic.length - 1]
    if (last && r.from <= last.to) {
      if (r.to > last.to) atomic[atomic.length - 1] = ATOMIC.range(last.from, r.to)
    } else {
      atomic.push(ATOMIC.range(r.from, r.to))
    }
  }

  return {
    decorations: Decoration.set(out, true),
    atomic: Decoration.set(atomic, true),
  }
}
