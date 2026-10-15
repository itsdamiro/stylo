import { syntaxTree } from "@codemirror/language"
import { type EditorState, type Range, StateField } from "@codemirror/state"
import { Decoration, type DecorationSet, EditorView, WidgetType } from "@codemirror/view"
import type { SyntaxNode } from "@lezer/common"
import { parseImage } from "../image"
import { imageRegistryFacet } from "./config"
import type { EmbedRegistry } from "./embed-registry"
import { revealedLines } from "./reveal"

/**
 * Inert slot for one `![alt](src)` image: a block `<div>` for one alone on its
 * line, a `<span>` for one in a sentence, a list item, a quote or a heading. The
 * same shape as `EmbedWidget`: `toDOM` builds an empty element and registers it
 * with the per-canvas registry, and `InPlaceView` portals a `HostImage` into it.
 * It uses its own classes, not `cm-inplace-embed`, so a picture does not get the
 * embed's left rail. `eq` compares the source text and the shape, which fix what
 * the host is called with, so CodeMirror keeps the slot across scrolls and
 * selection changes. See ADR-014 and ADR-017.
 */
export class ImageWidget extends WidgetType {
  private id = -1

  constructor(
    readonly raw: string,
    readonly src: string,
    readonly alt: string,
    private readonly registry: EmbedRegistry,
    readonly inline = false,
  ) {
    super()
  }

  override eq(other: ImageWidget) {
    return other.raw === this.raw && other.inline === this.inline // `src` and `alt` come from `raw`
  }

  toDOM() {
    const el = document.createElement(this.inline ? "span" : "div")
    el.className = this.inline ? "cm-inplace-image-inline" : "cm-inplace-image"
    this.id = this.registry.allocate()
    el.dataset.styloEmbedSlot = String(this.id)
    this.registry.add({
      id: this.id,
      ref: this.raw,
      inline: this.inline,
      el,
      image: { src: this.src, alt: this.alt },
    })
    return el
  }

  override destroy() {
    if (this.id >= 0) this.registry.remove(this.id)
  }

  override ignoreEvent() {
    return false
  }
}

/** Subtrees whose images are left as source: a table cell (the table widget owns
 *  it) and a link (a second click target). Code never holds an `Image` node.
 *  ADR-017 points 4 and 5. */
const SKIP = new Set(["Table", "Link"])

/** An image that is a top-level paragraph by itself (trailing spaces aside): the
 *  block slot of ADR-014. */
function isBlockImage(state: EditorState, image: SyntaxNode): boolean {
  const para = image.parent
  return (
    para?.name === "Paragraph" &&
    para.parent?.name === "Document" &&
    para.from === image.from &&
    state.doc.sliceString(image.to, para.to).trim() === ""
  )
}

/**
 * Whole-document scan for Markdown images, one pass over each line that holds
 * `![`. An image that is a top-level paragraph by itself is a block slot, which
 * is what `remarkImage` matches in `preview`; any other (in a sentence, a list
 * item, a quote or a heading) is an inline slot. A table cell, a link and code
 * stay source, and so does an image that spans lines. Off unless the host set
 * `imageSource` (the registry facet is then non-null). A line the caret touches
 * is withheld, so the raw source shows for editing. See ADR-014 and ADR-017.
 */
function buildImages(state: EditorState): DecorationSet {
  const registry = state.facet(imageRegistryFacet)
  if (!registry) return Decoration.none

  // Read-only has nothing to edit, so a click beside a picture must not swap it for its source.
  const revealed = state.readOnly ? new Set<number>() : revealedLines(state)
  const tree = syntaxTree(state)
  const out: Range<Decoration>[] = []

  for (let n = 1; n <= state.doc.lines; n++) {
    const line = state.doc.line(n)
    if (revealed.has(n) || !line.text.includes("![")) continue

    tree.iterate({
      from: line.from,
      to: line.to,
      enter(ref) {
        if (SKIP.has(ref.name)) return false
        if (ref.name !== "Image" || ref.from < line.from || ref.to > line.to) return
        const raw = state.doc.sliceString(ref.from, ref.to)
        const parsed = parseImage(raw)
        if (!parsed) return
        const block = isBlockImage(state, ref.node)
        const widget = new ImageWidget(raw, parsed.src, parsed.alt, registry, !block)
        out.push(
          block
            ? Decoration.replace({ widget, block: true }).range(line.from, line.to)
            : Decoration.replace({ widget }).range(ref.from, ref.to),
        )
      },
    })
  }

  return Decoration.set(out, true)
}

/** An image is a single line: its reveal status can only change if a line the
 *  selection now touches, or just stopped touching, could hold one. */
function selectionNearImage(state: EditorState, selection: EditorState["selection"]): boolean {
  for (const range of selection.ranges) {
    const first = state.doc.lineAt(range.from).number
    const last = state.doc.lineAt(range.to).number
    for (let n = first; n <= last; n++) {
      if (state.doc.line(n).text.includes("![")) return true
    }
  }
  return false
}

/** Decorations for the in-place image slots, plus the atomic ranges that let
 *  the caret step over a rendered image instead of into it. */
export const imageField = StateField.define<DecorationSet>({
  create: buildImages,
  update: (value, tr) => {
    if (tr.docChanged || tr.startState.readOnly !== tr.state.readOnly) return buildImages(tr.state)
    if (!tr.selection) return value
    const near =
      selectionNearImage(tr.state, tr.startState.selection) ||
      selectionNearImage(tr.state, tr.state.selection)
    return near ? buildImages(tr.state) : value
  },
  provide: (field) => [
    EditorView.decorations.from(field),
    EditorView.atomicRanges.of((view) => view.state.field(field)),
  ],
})
