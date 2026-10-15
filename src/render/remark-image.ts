import type { Root } from "mdast"
import { SKIP, visit } from "unist-util-visit"
import { parseImage } from "../image"

/** The carrier's data attributes: the image's `src`, `alt` and its source text. */
const attributes = (src: string, alt: string, raw: string) => ({
  "data-stylo-image": src,
  "data-stylo-image-alt": alt,
  "data-stylo-image-raw": raw,
})

/**
 * Turns a Markdown image into an empty carrier the `HostImage` component (wired
 * in `Preview`) fills from the host's `imageSource`. ADR-014 and ADR-017.
 *
 * - An image alone in a top-level paragraph becomes a block
 *   `<div class="stylo-image">`.
 * - An image anywhere else (in a sentence, a list item, a quote, a heading or a
 *   table cell) becomes an inline `<span class="stylo-image-inline">`, and the
 *   text around it is kept. The host node should be phrasing content.
 * - An image inside a link, `[![alt](src)](url)`, is left to `react-markdown`.
 *
 * The carrier holds the image's own source text, sliced from the file, in data
 * attributes — `data-stylo-image` (the `src`), `data-stylo-image-alt` and
 * `data-stylo-image-raw` (what shows until it resolves). Data attributes are
 * not URL attributes, so `react-markdown`'s URL filter never sees them and a
 * `data:` source reaches the host whole.
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
        ...attributes(parsed.src, parsed.alt, raw),
      }
    }

    visit(tree, (node, index, parent) => {
      if (node.type === "link" || node.type === "linkReference") return SKIP
      const start = node.position?.start.offset
      const end = node.position?.end.offset
      if (node.type !== "image" || index == null || !parent || start == null || end == null) return

      const raw = source.slice(start, end)
      const parsed = parseImage(raw)
      if (!parsed) return
      parent.children.splice(index, 1, {
        type: "text",
        value: "",
        data: {
          hName: "span",
          hProperties: {
            className: ["stylo-image-inline"],
            ...attributes(parsed.src, parsed.alt, raw),
          },
          hChildren: [],
        },
      })
    })
  }
}
