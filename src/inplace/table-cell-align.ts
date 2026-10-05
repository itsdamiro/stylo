/** Aligning a rendered table cell's text nodes with the raw string it was drawn from. */

export interface Piece {
  node: Text
  /** Raw-string offset of the node's first character. */
  start: number
}

/** The rendered cell's text nodes with their offsets in `source` (the raw string, unescaped), or `null` when they don't line up. */
export function align(cell: HTMLElement, source: string): Piece[] | null {
  const pieces: Piece[] = []
  let at = 0
  const visit = (parent: Node): boolean => {
    for (const n of parent.childNodes) {
      if (n instanceof Text) {
        const found = source.indexOf(n.data, at)
        if (found < 0) return false
        pieces.push({ node: n, start: found })
        at = found + n.data.length
      } else if ((n as Element).hasAttribute?.("data-stylo-wikilink")) {
        // `[[target|alias]]` shows only the alias (or the target): its text is the tail of the body.
        const open = source.indexOf("[[", at)
        const close = open < 0 ? -1 : source.indexOf("]]", open)
        const text = n.firstChild
        if (close < 0 || !(text instanceof Text)) return false
        pieces.push({ node: text, start: close - text.data.length })
        at = close + 2
      } else if ((n as Element).classList?.contains("cm-inplace-math")) {
        // KaTeX's own text isn't the source's: step over `$…$` as a whole.
        const open = source.indexOf("$", at)
        const close = open < 0 ? -1 : source.indexOf("$", open + 1)
        if (close < 0) return false
        at = close + 1
      } else if (!visit(n)) return false
    }
    return true
  }
  return visit(cell) ? pieces : null
}
