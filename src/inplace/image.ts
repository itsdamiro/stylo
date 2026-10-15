import { syntaxTree } from "@codemirror/language"
import { type EditorState, type Range, StateField } from "@codemirror/state"
import { Decoration, type DecorationSet, EditorView, WidgetType } from "@codemirror/view"
import { parseImage } from "../image"
import { imageRegistryFacet } from "./config"
import type { EmbedRegistry } from "./embed-registry"
import { revealedLines } from "./reveal"

/**
 * Inert slot for one `![alt](src)` image alone on its line. The same shape as
 * `EmbedWidget`: `toDOM` builds an empty block and registers it with the
 * per-canvas registry, and `InPlaceView` portals a `HostImage` into it. It uses
 * its own class, not `cm-inplace-embed`, so a picture does not get the embed's
 * left rail. `eq` compares the source text, which fixes what the host is called with, so
 * CodeMirror keeps the slot across scrolls and selection changes. See ADR-014.
 */
class ImageWidget extends WidgetType {
  private id = -1

  constructor(
    readonly raw: string,
    readonly src: string,
    readonly alt: string,
    private readonly registry: EmbedRegistry,
  ) {
    super()
  }

  override eq(other: ImageWidget) {
    return other.raw === this.raw // `src` and `alt` are read from `raw`
  }

  toDOM() {
    const el = document.createElement("div")
    el.className = "cm-inplace-image"
    this.id = this.registry.allocate()
    el.dataset.styloEmbedSlot = String(this.id)
    this.registry.add({
      id: this.id,
      ref: this.raw,
      inline: false,
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

/**
 * Whole-document scan for a Markdown image that is the only thing on its line
 * and a top-level paragraph by itself, which is what `remarkImage` matches in
 * `preview`. An image in a sentence, a list item, a quote, a table cell or code
 * is left as source. Off unless the host set `imageSource` (the registry facet
 * is then non-null). A line the caret touches is withheld, so the raw source
 * shows for editing.
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

    const trimmed = line.text.trim()
    if (!trimmed.startsWith("![") || !trimmed.endsWith(")")) continue
    const from = line.from + line.text.indexOf("![")
    const to = from + trimmed.length

    const first = tree.resolveInner(from, 1)
    const image = first.name === "Image" ? first : first.parent
    if (image?.name !== "Image" || image.from !== from || image.to !== to) continue
    const para = image.parent
    if (para?.name !== "Paragraph" || para.parent?.name !== "Document") continue
    if (para.from !== from || para.to !== to) continue

    const raw = state.doc.sliceString(from, to)
    const parsed = parseImage(raw)
    if (!parsed) continue
    out.push(
      Decoration.replace({
        widget: new ImageWidget(raw, parsed.src, parsed.alt, registry),
        block: true,
      }).range(line.from, line.to),
    )
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
