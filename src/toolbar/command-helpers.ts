/**
 * Shared machinery for `commands.ts`'s `BUILTIN_COMMANDS` registry: the
 * `ToolbarCommand` shape, the context predicates that drive `disabled`, and
 * the small factory functions that build a command from a mark / heading
 * level / line-prefix spec.
 */

import type { EditorState } from "@codemirror/state"
import type { Command, EditorView } from "@codemirror/view"
import { frontmatterRange } from "../frontmatter"
import type { ToolbarCommandId } from "../types"
import { linePrefixActive, toggleLinePrefix, type LinePrefixSpec } from "./block"
import { fencedCodeActive, mathBlockActive } from "./fence"
import { toggleHeading } from "./heading"
import { toggleWrap, wrapActive } from "./inline"
import { runInlineInCell } from "./cell-inline"
import { wrapString } from "./inline-ops"
import { tableActive } from "./table"

// --- context predicates: where a command can't sensibly apply ---

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

export interface ToolbarCommand {
  id: ToolbarCommandId
  /** Tooltip and accessible label. */
  title: string
  /** Mutate the document against the live view; returns true when handled. */
  run: (view: EditorView) => boolean
  /** Reflected as the button's pressed state. */
  isActive?: (state: EditorState) => boolean
  /**
   * True when the command can't produce valid Markdown at the current selection
   * — the button is rendered `disabled` and the shortcut is a no-op. Driven by
   * the context predicates above (a table cell, a heading line, a frontmatter /
   * fenced-code / `$$` block).
   */
  disabled?: (state: EditorState) => boolean
  /** Default key bindings in CodeMirror `key` syntax. */
  keys?: string[]
}

/** Any list marker — bullet, ordered, or task — with `[1]` capturing the
 *  indent. Ordered accepts both `1.` and `1)`, per CommonMark's actual
 *  grammar — shared with `ORDERED.match` below so the two can't drift again. */
export const LIST_MARKER = /^(\s*)(?:[-*+] \[[ xX]\] +|\d+[.)] +|[-*+] +)/

export const QUOTE: LinePrefixSpec = { match: /^ {0,3}> ?/, insert: "> " }
export const BULLET: LinePrefixSpec = {
  match: /^(\s*)[-*+] +(?!\[[ xX]\])/,
  insert: "- ",
  siblings: LIST_MARKER,
}
export const ORDERED: LinePrefixSpec = {
  match: /^(\s*)\d+[.)] +/,
  insert: (n) => `${n + 1}. `,
  siblings: LIST_MARKER,
}
export const TASK: LinePrefixSpec = {
  match: /^(\s*)[-*+] \[[ xX]\] +/,
  insert: "- [ ] ",
  siblings: LIST_MARKER,
}

export function history(id: "undo" | "redo", title: string, cmd: Command): ToolbarCommand {
  return {
    id,
    title,
    run: (view) => {
      const ok = cmd(view)
      view.focus()
      return ok
    },
  }
}

export function wrap(
  id: ToolbarCommandId,
  title: string,
  mark: string,
  keys?: string[],
): ToolbarCommand {
  return {
    id,
    title,
    run: (view) =>
      runInlineInCell(view, (t, f, u) => wrapString(t, f, u, mark)) || toggleWrap(view, mark),
    isActive: (state) => wrapActive(state, mark),
    disabled: disabledWhen(inLiteral, inOtherInlineLiteral(mark), nothingToWrap),
    keys,
  }
}

export function heading(level: 1 | 2 | 3): ToolbarCommand {
  const marker = new RegExp(`^#{${level}} `)
  return {
    id: `h${level}` as ToolbarCommandId,
    title: `Heading ${level}`,
    run: (view) => toggleHeading(view, level),
    isActive: (state) => marker.test(state.doc.lineAt(state.selection.main.head).text),
    disabled: disabledWhen(tableActive, inLiteral),
    keys: [`Mod-Alt-${level}`],
  }
}

/**
 * Ids whose `run` already degrades to an inline edit inside a table cell (via
 * `runInlineInCell`) — the only commands still usable while the DOM caret is
 * actually focused in one. Shared by the toolbar and the context menu so a
 * table cell's "what works here" answer can't drift between the two.
 */
export const CELL_CAPABLE_IDS: ReadonlySet<ToolbarCommandId> = new Set([
  "bold",
  "italic",
  "strike",
  "underline",
  "code",
  "codeBlock",
  "link",
  "wikilink",
  "math",
  "mathBlock",
])

/**
 * A command's effective `disabled` / `isActive` for the current DOM focus.
 * `state.selection` never moves into an editable table cell's `contentEditable`
 * DOM — a click there is deliberately left undispatched (see `extension.ts`) —
 * so while the caret is actually inside one, checking `cmd.disabled?.(state)` /
 * `cmd.isActive?.(state)` reads a selection that may point anywhere else in
 * the document. There: a cell-capable command stays live, always reported as
 * neither active nor disabled (`run` degrades to an inline edit on the cell
 * regardless of the model selection, and detecting an existing mark inside the
 * cell's own text isn't implemented); every other command is disabled outright
 * rather than acting on that stale selection.
 */
export function resolveForCell(
  state: EditorState,
  cmd: Pick<ToolbarCommand, "id" | "disabled" | "isActive">,
  inCell: boolean,
): { disabled: boolean; active: boolean } {
  if (inCell) {
    return CELL_CAPABLE_IDS.has(cmd.id)
      ? { disabled: false, active: false }
      : { disabled: true, active: false }
  }
  return {
    disabled: Boolean(cmd.disabled?.(state)),
    active: Boolean(cmd.isActive?.(state)),
  }
}

export function prefix(
  id: ToolbarCommandId,
  title: string,
  spec: LinePrefixSpec,
  ...extra: ((s: EditorState) => boolean)[]
): ToolbarCommand {
  return {
    id,
    title,
    run: (view) => toggleLinePrefix(view, spec),
    isActive: (state) => linePrefixActive(state, spec.match),
    disabled: disabledWhen(tableActive, inLiteral, ...extra),
  }
}
