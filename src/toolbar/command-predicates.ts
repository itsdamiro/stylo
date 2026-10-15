/**
 * The context predicates that drive a toolbar command's `disabled`: where a
 * command can't sensibly apply. `command-helpers.ts` builds commands from them.
 */

import type { EditorState } from "@codemirror/state"
import { frontmatterRange } from "../frontmatter"
import { fencedCodeActive, mathBlockActive } from "./fence"
import { wrapActive } from "./inline"

/** Caret's line is an ATX heading (`#` … `######`). */
export const inHeading = (s: EditorState): boolean =>
  /^\s{0,3}#{1,6}(?:\s|$)/.test(s.doc.lineAt(s.selection.main.head).text)

/** Caret is inside the leading `---` YAML block. */
export const inFrontmatter = (s: EditorState): boolean => {
  const r = frontmatterRange(s.doc)
  return r !== null && s.selection.main.head <= r.to
}

/** Contexts where inline markup is literal or would break the syntax. */
export const inLiteral = (s: EditorState): boolean =>
  inFrontmatter(s) || fencedCodeActive(s) || mathBlockActive(s)

/**
 * Inside an inline `` `code` `` or `$math$` span, no *other* mark can be added —
 * `` `**x**` `` / `$`x`$` are not valid. The span's own mark stays live so it
 * can be toggled off.
 */
export const inOtherInlineLiteral =
  (mark: string) =>
  (s: EditorState): boolean =>
    (mark !== "`" && wrapActive(s, "`")) || (mark !== "$" && wrapActive(s, "$"))

/**
 * Nothing to wrap — a collapsed caret with no word at it (a blank line, a run
 * of spaces, punctuation). Wrapping there just drops an empty `****` / `` `` ``
 * pair, which shows as literal marks in the seamless canvas.
 */
export const nothingToWrap = (s: EditorState): boolean =>
  s.selection.main.empty && !s.wordAt(s.selection.main.head)

/** A `disabled` predicate that fires when any of `checks` matches. */
export const disabledWhen =
  (...checks: ((s: EditorState) => boolean)[]) =>
  (s: EditorState): boolean =>
    checks.some((c) => c(s))
