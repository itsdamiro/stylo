/**
 * The right-click menu's link fields: `linkRow` (`[text](url)`) and
 * `wikiLinkRow` (`[[target|label]]`). Structurally identical — extract parts
 * at the caret, return an Edit/Remove field if found, else fall back to an
 * Add field — so both route through `linkFieldRow`, parameterized on exactly
 * what differs (the extractor, labels, and insert syntax). Keeping this in
 * one place means a fix (like the "swap the whole construct rather than
 * nesting" change both once needed) can't land in only one of the two again.
 */

import type { EditorState } from "@codemirror/state"
import type { EditorView } from "@codemirror/view"
import { ICON_PATHS } from "../toolbar/icon-paths"
import { linkPartsIn, wikiLinkAtIn, wikiLinkPartsIn } from "../toolbar/inline-ops"
import { linkOpenFacet } from "./config"
import type { MenuAction, MenuField } from "./context-menu"

/** The `(...)` destination for a link — angle-bracketed when it has whitespace
 *  or parens, so `[a](b c)` (invalid Markdown) becomes `[a](<b c>)`. */
const linkDest = (url: string): string => {
  const bare = url.trim().replace(/^<([^]*)>$/, "$1")
  return /[\s()]/.test(bare) ? `<${bare.replace(/[<>]/g, "")}>` : bare
}
/** Strip angle brackets for display in the URL input. */
const bareUrl = (url: string): string => url.replace(/^<([^]*)>$/, "$1")

/**
 * The `[text](url)` or `[[target|label]]` that the selection sits in, with its
 * display text and full span. Applying a link or wikilink to such a selection
 * then *replaces* that construct instead of nesting a new one inside it (which
 * produces malformed Markdown). `null` when the selection is in neither.
 */
function inlineLinkHost(
  state: EditorState,
  sel: { from: number; to: number },
): { from: number; to: number; text: string } | null {
  const line = state.doc.lineAt(sel.from)
  if (state.doc.lineAt(sel.to).number !== line.number) return null
  const a = sel.from - line.from
  const b = sel.to - line.from
  const link = linkPartsIn(line.text, a) ?? linkPartsIn(line.text, b)
  if (link) return { from: line.from + link.from, to: line.from + link.to, text: link.label }
  const wiki = wikiLinkAtIn(line.text, a) ?? wikiLinkAtIn(line.text, b)
  if (wiki) return { from: line.from + wiki.from, to: line.from + wiki.to, text: wiki.label }
  return null
}

/**
 * What varies between the two link fields. `P` is whatever the kind's own
 * `partsIn` extracts — its shape differs (a URL span vs. a target span), so
 * `onEdit` / `onAdd` each close over the concrete type they need.
 */
interface LinkFieldKind<P extends { from: number; to: number; label: string }> {
  icon: string
  placeholder: string
  editLabel: string
  addLabel: string
  /** Existing construct at the caret, or `null` to fall back to the Add field. */
  partsIn: (lineText: string, pos: number) => P | null
  /** Value shown (and submitted) in the field while editing an existing construct. */
  editValue: (parts: P) => string
  /** Rows shown above "Remove link" while editing — only external links get "Open link". */
  editActions?: (view: EditorView, parts: P) => MenuAction[]
  /** Apply an edited field value in place. */
  onEdit: (view: EditorView, parts: P, input: string) => void
  /** Insert a brand-new construct wrapping `[from, to)` (or the bare caret). */
  onAdd: (view: EditorView, from: number, to: number, label: string, input: string) => void
}

/**
 * The shared shape: an editable field over whatever's at the caret — an
 * existing construct (Edit + Remove), or a blank one that wraps the selection
 * (or the word the menu just selected) on submit (Add).
 */
function linkFieldRow<P extends { from: number; to: number; label: string }>(
  view: EditorView,
  kind: LinkFieldKind<P>,
): MenuField {
  const { state } = view
  const sel = state.selection.main
  const line = state.doc.lineAt(sel.head)
  const parts = kind.partsIn(line.text, sel.head - line.from)

  if (parts) {
    const from = line.from + parts.from
    const to = line.from + parts.to
    const actions: MenuAction[] = kind.editActions?.(view, parts) ?? []
    actions.push({
      label: "Remove link",
      onSelect: () => {
        view.dispatch({
          changes: { from, to, insert: parts.label },
          selection: { anchor: from, head: from + parts.label.length },
        })
        view.focus()
      },
    })
    return {
      field: true,
      label: kind.editLabel,
      icon: kind.icon,
      value: kind.editValue(parts),
      placeholder: kind.placeholder,
      onSubmit: (input) => kind.onEdit(view, parts, input),
      actions,
    }
  }

  const host = inlineLinkHost(state, sel)
  const from = host ? host.from : sel.from
  const to = host ? host.to : sel.to
  const label = host ? host.text : state.sliceDoc(sel.from, sel.to)
  return {
    field: true,
    label: kind.addLabel,
    icon: kind.icon,
    value: "",
    placeholder: kind.placeholder,
    onSubmit: (input) => kind.onAdd(view, from, to, label, input),
  }
}

type LinkParts = ReturnType<typeof linkPartsIn>
type WikiLinkParts = ReturnType<typeof wikiLinkPartsIn>

const EXTERNAL_LINK: LinkFieldKind<NonNullable<LinkParts>> = {
  icon: ICON_PATHS.link!,
  placeholder: "https://…",
  editLabel: "Edit external link",
  addLabel: "Add external link",
  partsIn: linkPartsIn,
  editValue: (parts) => bareUrl(parts.url),
  editActions: (view, parts) => {
    const openHref = view.state.facet(linkOpenFacet)
    if (!openHref || !parts.url) return []
    return [{ label: "Open link", icon: ICON_PATHS.link, onSelect: () => openHref(parts.url) }]
  },
  onEdit: (view, parts, url) => {
    view.dispatch({
      changes: { from: parts.urlFrom, to: parts.urlTo, insert: linkDest(url) },
    })
    view.focus()
  },
  onAdd: (view, from, to, rawLabel, url) => {
    const label = rawLabel || "link"
    view.dispatch({
      changes: { from, to, insert: `[${label}](${linkDest(url)})` },
      selection: { anchor: from + 1, head: from + 1 + label.length },
    })
    view.focus()
  },
}

const WIKILINK: LinkFieldKind<NonNullable<WikiLinkParts>> = {
  icon: ICON_PATHS.wikilink!,
  placeholder: "note or path",
  editLabel: "Edit link",
  addLabel: "Add link",
  partsIn: wikiLinkPartsIn,
  editValue: (parts) => parts.target,
  onEdit: (view, parts, target) => {
    if (target)
      view.dispatch({ changes: { from: parts.targetFrom, to: parts.targetTo, insert: target } })
    view.focus()
  },
  onAdd: (view, from, to, label, target) => {
    const t = target || label || "target"
    const insert = !target || target === label ? `[[${t}]]` : `[[${target}|${label}]]`
    view.dispatch({
      changes: { from, to, insert },
      selection: { anchor: from + 2, head: from + 2 + (target || t).length },
    })
    view.focus()
  },
}

/** The "Add external link" row — an editable `[text](url)` URL field. Prefilled,
 *  with Open / Remove and the label "Edit external link", when the caret sits in
 *  an existing `[text](url)`; otherwise an empty field that wraps the selection
 *  (or the word the menu just selected) on submit. */
export function linkRow(view: EditorView): MenuField {
  return linkFieldRow(view, EXTERNAL_LINK)
}

/** The "Add link" row — an editable `[[target]]` field for an internal link.
 *  Prefilled, with Remove and the label "Edit link", when the caret sits in an
 *  existing `[[target|label]]`; otherwise an empty field that wraps the
 *  selection (or the word the menu just selected) on submit. */
export function wikiLinkRow(view: EditorView): MenuField {
  return linkFieldRow(view, WIKILINK)
}
