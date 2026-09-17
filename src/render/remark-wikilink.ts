import type { Link, Root, Text } from "mdast"
import { visit } from "unist-util-visit"
import { WIKILINK_PATTERN } from "../wikilink"

/**
 * Rewrites `[[target]]` and `[[target|label]]` inside text into link nodes that
 * carry a `data-wikilink` attribute holding the target. The rendered href is
 * inert (`#`); navigation is the host's job via `onWikiLinkClick`.
 */
export function remarkWikilink() {
  return (tree: Root) => {
    visit(tree, "text", (node: Text, index, parent) => {
      if (parent == null || index == null || !node.value.includes("[[")) return

      const out: Array<Text | Link> = []
      let cursor = 0

      for (const match of node.value.matchAll(WIKILINK_PATTERN)) {
        const [raw = "", rawTarget = "", rawLabel] = match
        const start = match.index ?? 0
        // A `![[ref]]` embed either was already consumed by `remarkEmbed`
        // earlier in the pipeline (when `embedSource` is set), or wasn't —
        // either way its inner `[[ref]]` must stay untouched here rather than
        // becoming a dead link, per `EmbedSource`'s documented fallback (a
        // bare `![[ref]]` renders unchanged with no `embedSource`).
        if (start > 0 && node.value[start - 1] === "!") continue
        if (start > cursor) {
          out.push({ type: "text", value: node.value.slice(cursor, start) })
        }
        out.push({
          type: "link",
          url: "#",
          data: { hProperties: { "data-wikilink": rawTarget.trim() } },
          children: [{ type: "text", value: (rawLabel ?? rawTarget).trim() }],
        })
        cursor = start + raw.length
      }

      if (cursor === 0) return
      if (cursor < node.value.length) {
        out.push({ type: "text", value: node.value.slice(cursor) })
      }

      parent.children.splice(index, 1, ...out)
      return index + out.length
    })
  }
}
