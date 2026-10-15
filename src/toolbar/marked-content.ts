import { esc } from "./inline-ops"
import { linkAtIn } from "./link-ops"
import { wikiLinkPartsIn } from "./wikilink-ops"

/**
 * The span a right-click in a table cell should select so a Format toggle lands
 * cleanly: the text between the delimiters for an inline mark run
 * (`**bold phrase**`, `*em*`, `~~strike~~`, `` `code` ``), but the *whole*
 * construct for a `[label](url)` link or `[[target|label]]` wikilink — its label
 * is not a Markdown context, so Bold must wrap the link, not sit inside it.
 * Returns `null` when `pos` is not in any run. Mirrors `wrapAt` on the canvas.
 */
export function markedContentAt(text: string, pos: number): { from: number; to: number } | null {
  const link = linkAtIn(text, pos)
  if (link) return { from: link.from, to: link.to }
  const wiki = wikiLinkPartsIn(text, pos)
  if (wiki) return { from: wiki.from, to: wiki.to }
  let best: { from: number; to: number } | null = null
  for (const mark of ["**", "~~", "*", "`"]) {
    const re = new RegExp(esc(mark) + "(?!\\s)(?:[^]*?\\S)??" + esc(mark), "g")
    for (let m: RegExpExecArray | null; (m = re.exec(text));) {
      if (m[0].length <= 2 * mark.length) continue
      const from = m.index + mark.length
      const to = m.index + m[0].length - mark.length
      if (pos >= from && pos <= to && (!best || to - from < best.to - best.from)) {
        best = { from, to }
      }
    }
  }
  return best
}
