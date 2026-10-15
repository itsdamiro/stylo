import type { Root } from "mdast"
import { parseImage } from "../image"

/**
 * Turns a Markdown image alone in a top-level paragraph into an empty carrier
 * `<div class="stylo-image">` the `HostImage` component (wired in `Preview`)
 * fills from the host's `imageSource`. ADR-014.
 *
 * The carrier holds the image's own source text, sliced from the file, in data
 * attributes — `data-stylo-image` (the `src`), `data-stylo-image-alt` and
 * `data-stylo-image-raw` (what shows until it resolves). Data attributes are
 * not URL attributes, so `react-markdown`'s URL filter never sees them and a
 * `data:` source reaches the host whole. An image inside a sentence, a list
 * item or a quote is left to `react-markdown` as it always was.
 *
 * Only in the pipeline when the consumer passes `imageSource`.
 */
export function remarkImage() {
  return (tree: Root, file: { toString(): string }) => {
    const source = String(file)
    for (const node of tree.children) {
      if (node.type !== "paragraph" || node.children.length !== 1) continue
      const only = node.children[0]
      const start = only?.position?.start.offset
      const end = only?.position?.end.offset
      if (only?.type !== "image" || start == null || end == null) continue

      const raw = source.slice(start, end)
      const parsed = parseImage(raw)
      if (!parsed) continue

      node.children = []
      node.data ??= {}
      node.data.hName = "div"
      node.data.hProperties = {
        className: ["stylo-image"],
        "data-stylo-image": parsed.src,
        "data-stylo-image-alt": parsed.alt,
        "data-stylo-image-raw": raw,
      }
    }
  }
}
