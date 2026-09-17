import { syntaxTree } from "@codemirror/language"
import { type EditorState, type Range, StateField } from "@codemirror/state"
import { Decoration, type DecorationSet, EditorView, WidgetType } from "@codemirror/view"
import { EMBED_PATTERN, isLoneEmbed } from "../embed"
import { embedRegistryFacet, inPlaceConfigFacet } from "./config"
import type { EmbedRegistry } from "./embed-registry"
import { revealedLines } from "./reveal"
import { inCodeContext, inTableContext } from "./scan"

/**
 * Inert slot for one `![[ref]]`. `toDOM` builds an empty element — a `<div>` for
 * a lone-line embed, a `<span>` for one mid-sentence — and registers it with the
 * per-canvas `EmbedRegistry`; `InPlaceView` portals a host `<Embed>` into it. No
 * React, no resolution here — cheap to build and rebuild. `eq` compares `ref`
 * and `inline`, so CodeMirror keeps the slot across scrolls and selection
 * changes and only rebuilds it when one of those changes. See ADR-009.
 */
class EmbedWidget extends WidgetType {
  private id = -1

  constructor(
    readonly ref: string,
    readonly inline: boolean,
    private readonly registry: EmbedRegistry,
  ) {
    super()
  }

  override eq(other: EmbedWidget) {
    return other.ref === this.ref && other.inline === this.inline
  }

  toDOM() {
    const el = document.createElement(this.inline ? "span" : "div")
    el.className = this.inline ? "cm-inplace-embed-inline" : "cm-inplace-embed"
    this.id = this.registry.allocate()
    el.dataset.styloEmbedSlot = String(this.id)
    this.registry.add({ id: this.id, ref: this.ref, inline: this.inline, el })
    return el
  }

  override destroy() {
    if (this.id >= 0) this.registry.remove(this.id)
  }

  override ignoreEvent() {
    return false
  }
}

/**
 * Whole-document scan for `![[ref]]` transclusion — the CodeMirror grammar has
 * no embed node, so a state field (not the view plugin) keeps it beside
 * `blockMathField`. A lone-line `![[ref]]` becomes a block widget; a `![[ref]]`
 * with other text on the line becomes an inline widget in situ. Off unless the
 * host set `embedSource` (the registry facet is then non-null) and the `embeds`
 * toggle is on. A line the caret touches is withheld — block or inline alike —
 * so the raw `![[ref]]` source shows for editing (the block-math reveal path).
 */
function buildEmbeds(state: EditorState): DecorationSet {
  const registry = state.facet(embedRegistryFacet)
  if (!registry || !state.facet(inPlaceConfigFacet).embeds) return Decoration.none
  if (!state.doc.toString().includes("![[")) return Decoration.none

  const revealed = revealedLines(state)
  const tree = syntaxTree(state)
  const out: Range<Decoration>[] = []

  for (let n = 1; n <= state.doc.lines; n++) {
    const line = state.doc.line(n)
    if (!line.text.includes("![[") || revealed.has(n)) continue

    if (isLoneEmbed(line.text)) {
      EMBED_PATTERN.lastIndex = 0
      const ref = (EMBED_PATTERN.exec(line.text.trim())?.[1] ?? "").trim()
      if (!ref || inCodeContext(tree, line.from + line.text.indexOf("!["))) continue
      out.push(
        Decoration.replace({ widget: new EmbedWidget(ref, false, registry), block: true }).range(
          line.from,
          line.to,
        ),
      )
      continue
    }

    EMBED_PATTERN.lastIndex = 0
    for (const m of line.text.matchAll(EMBED_PATTERN)) {
      const ref = (m[1] ?? "").trim()
      if (!ref) continue
      const start = line.from + (m.index ?? 0)
      // A code span keeps it literal; a table cell's content belongs to the
      // table widget, which renders `![[ref]]` literally there (`renderInline`).
      if (inCodeContext(tree, start + 2) || inTableContext(tree, start + 2)) continue
      out.push(
        Decoration.replace({ widget: new EmbedWidget(ref, true, registry) }).range(
          start,
          start + m[0].length,
        ),
      )
    }
  }

  return Decoration.set(out, true)
}

/** An embed is always a single line — its reveal status can only change if a
 *  line the selection now touches (or just stopped touching) has one. */
function selectionNearEmbed(state: EditorState, selection: EditorState["selection"]): boolean {
  for (const range of selection.ranges) {
    const first = state.doc.lineAt(range.from).number
    const last = state.doc.lineAt(range.to).number
    for (let n = first; n <= last; n++) {
      if (state.doc.line(n).text.includes("![[")) return true
    }
  }
  return false
}

/**
 * Decorations for the in-place embed slots, plus the atomic ranges that let the
 * caret step over a rendered embed instead of into it.
 */
export const embedField = StateField.define<DecorationSet>({
  create: buildEmbeds,
  update: (value, tr) => {
    if (tr.docChanged) return buildEmbeds(tr.state)
    if (!tr.selection) return value
    // Same reasoning as `tableField`: most caret moves are nowhere near an
    // embed, so a per-line text check is far cheaper than rescanning the
    // whole document just to see whether anything could have changed.
    const near =
      selectionNearEmbed(tr.state, tr.startState.selection) ||
      selectionNearEmbed(tr.state, tr.state.selection)
    return near ? buildEmbeds(tr.state) : value
  },
  provide: (field) => [
    EditorView.decorations.from(field),
    EditorView.atomicRanges.of((view) => view.state.field(field)),
  ],
})
