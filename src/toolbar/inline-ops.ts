import { linkAtIn } from "./link-ops"
import { wikiLinkPartsIn } from "./wikilink-ops"

export { linkAtIn, linkPartsIn, linkString } from "./link-ops"
export { underlineAtIn, underlineString } from "./underline-ops"
export { wikiLinkAtIn, wikiLinkPartsIn, wikiLinkString } from "./wikilink-ops"

/** Regex-escape a literal so it can be spliced into a pattern. */
export function esc(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

/** The characters that can stack as inline marks around a span. */
export const MARK_CHARS = "*~`$"

/** The maximal run of {@link MARK_CHARS} touching `pos` on the given side of `s`. */
function markRun(s: string, pos: number, dir: -1 | 1): { text: string; from: number } {
  let from = pos
  let to = pos
  if (dir < 0) while (from > 0 && MARK_CHARS.includes(s[from - 1]!)) from--
  else while (to < s.length && MARK_CHARS.includes(s[to]!)) to++
  return { text: s.slice(from, dir < 0 ? pos : to), from }
}

/** Every run of `ch` inside a mark run, in index order. */
function charGroups(run: string, ch: string): { start: number; len: number }[] {
  const out: { start: number; len: number }[] = []
  for (let i = 0; i < run.length;) {
    if (run[i] !== ch) {
      i++
      continue
    }
    let len = 0
    while (run[i + len] === ch) len++
    out.push({ start: i, len })
    i += len
  }
  return out
}

/**
 * Do `before` / `after` counts of the mark character flanking a range represent
 * an instance of exactly `mark` to strip? A `**`/`~~` needs at least its length;
 * a single `*` needs an *odd* count — so `*x*` and `***x***` unwrap the italic,
 * but `**x**` keeps the bold and the italic nests instead.
 */
function surroundsExactly(before: number, after: number, m: number): boolean {
  if (before < m || after < m) return false
  return m > 1 || (before % 2 === 1 && after % 2 === 1)
}

/** Non-overlapping edits plus the selection (post-edit coordinates) to follow. */
export interface InlineOp {
  changes: { from: number; to: number; insert: string }[]
  from: number
  to: number
}

/** A rewritten string plus the selection that should follow it. */
export interface InlineStr {
  text: string
  from: number
  to: number
}

/** Letters, digits, and underscore — the same notion of "word" used to expand
 *  a bare caret before wrapping it (below), and to select a word for a
 *  right-click in a table cell (`table-cell-dom.ts`'s `selectWordAtPoint`). */
const WORD_CHAR = /[\p{L}\p{N}_]/u

/** The maximal run of {@link WORD_CHAR} touching `pos` in `text`, or `null`
 *  when `pos` sits on whitespace or punctuation. */
function wordAt(text: string, pos: number): { from: number; to: number } | null {
  let from = pos
  let to = pos
  while (from > 0 && WORD_CHAR.test(text[from - 1]!)) from--
  while (to < text.length && WORD_CHAR.test(text[to]!)) to++
  return to > from ? { from, to } : null
}

/**
 * Toggle an inline wrapping mark (`**`, `*`, `~~`, `` ` ``, `$`) around `[from,
 * to)` of `text`: unwrap a span already wrapped (marks inside or just around the
 * selection), else wrap it; an empty range gets an empty pair. Applying `*` to
 * `**bold**` (or `**` to `*em*`) nests rather than eating a marker.
 *
 * A collapsed `[from, to)` (a bare caret, no selection) sitting inside a word
 * expands to that whole word first — otherwise the two inserts below would
 * land at the very same point and split the word in two (`wo****rd` instead
 * of `**word**`). `nothingToWrap` (`command-helpers.ts`) already disables the
 * button/shortcut when there is no word to expand to.
 */
export function wrapOp(text: string, from: number, to: number, mark: string): InlineOp {
  if (from === to) {
    const word = wordAt(text, from)
    if (word) {
      from = word.from
      to = word.to
    }
  }
  const m = mark.length
  const ch = mark[0]!
  const inner = text.slice(from, to)

  // The selection covers the marks: `**bold**` is selected.
  let lead = 0
  while (inner[lead] === ch) lead++
  let tail = 0
  while (inner[inner.length - 1 - tail] === ch) tail++
  if (
    inner.length >= 2 * m &&
    inner.startsWith(mark) &&
    inner.endsWith(mark) &&
    surroundsExactly(lead, tail, m)
  ) {
    return {
      changes: [
        { from, to: from + m, insert: "" },
        { from: to - m, to, insert: "" },
      ],
      from,
      to: to - 2 * m,
    }
  }

  // `mark` is somewhere in the stack of marks flanking the range — possibly with
  // other marks (`~~`, `*`) between it and the text, as in `***~~word~~***` or,
  // when marks were applied in an interleaving order, `**~~*word*~~**`. Line the
  // `ch`-groups up outermost-first on both sides (the left run reads outer→inner
  // already; the right run reads inner→outer, so reverse it) and strip the
  // outermost pair whose widths match `mark`.
  const left = markRun(text, from, -1)
  const right = markRun(text, to, 1)
  const lgs = charGroups(left.text, ch)
  const rgs = charGroups(right.text, ch).reverse()
  for (let k = 0; k < Math.min(lgs.length, rgs.length); k++) {
    const lg = lgs[k]!
    const rg = rgs[k]!
    if (!surroundsExactly(lg.len, rg.len, m)) continue
    const lInner = left.from + lg.start + lg.len // group's edge nearest the text
    const rInner = to + rg.start
    return {
      changes: [
        { from: lInner - m, to: lInner, insert: "" },
        { from: rInner, to: rInner + m, insert: "" },
      ],
      from: from - m,
      to: to - m,
    }
  }

  // Otherwise wrap.
  return {
    changes: [
      { from, to: from, insert: mark },
      { from: to, to: to, insert: mark },
    ],
    from: from + m,
    to: to + m,
  }
}

/** Apply non-overlapping {@link InlineOp} changes to a string (right to left). */
export function applyChanges(
  text: string,
  changes: { from: number; to: number; insert: string }[],
): string {
  let out = text
  for (const c of [...changes].sort((a, b) => b.from - a.from)) {
    out = out.slice(0, c.from) + c.insert + out.slice(c.to)
  }
  return out
}

/** {@link wrapOp} resolved against a plain string — for editing one table cell. */
export function wrapString(text: string, from: number, to: number, mark: string): InlineStr {
  const op = wrapOp(text, from, to, mark)
  return { text: applyChanges(text, op.changes), from: op.from, to: op.to }
}

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
