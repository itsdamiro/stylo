/**
 * Vertical indent guides for nested lists on the in-place canvas — one faint
 * rule per nesting level, drawn from the list's left padding (Obsidian /
 * Notion). Purely decorative: a `.cm-inplace-li` line decoration carrying the
 * nesting depth in `--sl-li-depth`, which the theme turns into that many guide
 * rules via a background gradient.
 *
 * Only a list item's *own* lines are decorated — the range stops before its
 * first nested list — so each line's depth is its innermost item's.
 *
 * The same per-`ListItem` walk also gives every item but the first in its own
 * list a small `paddingTop` gap (`cm-inplace-item-gap`), so consecutive items
 * read with some separation instead of butting straight into the shared
 * 1.75 line-height like two lines of one paragraph — preview's `<li>` already
 * carries a real margin; a flat text canvas had no equivalent at all before
 * this (2026-09-13).
 */

import type { Range, Text } from "@codemirror/state"
import { Decoration } from "@codemirror/view"
import type { SyntaxNodeRef } from "@lezer/common"
import type { ResolvedToggles } from "./config"
import type { Tree } from "./scan"

/** Nesting depth of a `ListItem` node: 1 at the top level, 2 once nested, … */
function depthOf(node: SyntaxNodeRef): number {
  let depth = 1
  for (let p = node.node.parent; p; p = p.parent) {
    if (p.name === "ListItem") depth++
  }
  return depth
}

export function scanListGuides(
  from: number,
  to: number,
  tree: Tree,
  doc: Text,
  toggles: ResolvedToggles,
  out: Range<Decoration>[],
): void {
  if (!toggles.lists) return
  const seen = new Set<number>()

  tree.iterate({
    from,
    to,
    enter: (node) => {
      if (node.name !== "ListItem") return
      const depth = depthOf(node)
      const guides = depth - 1

      const firstLine = doc.lineAt(node.from).number
      const lastLine = doc.lineAt(Math.min(node.to, doc.length)).number
      // A nested sublist's own lines get their own (deeper) guide from its own
      // `ListItem` walk — skip them here so this item's shallower guide doesn't
      // land on them too and starve the nested one. Any continuation content
      // *after* the sublist, still part of this item, is included via `lastLine`.
      const nested = node.node.getChild("BulletList") ?? node.node.getChild("OrderedList")
      const nestedFirst = nested ? doc.lineAt(nested.from).number : -1
      const nestedLast = nested ? doc.lineAt(Math.max(nested.from, nested.to - 1)).number : -1

      // Not the first item of its own (immediate) list — give its first line a
      // gap. Depth > 1 means it's the first item of a *nested* list, which
      // gets the larger nested-gap value instead, approximating preview's
      // `li > :is(ul, ol)` margin on the sublist as a whole.
      const gapClass = node.node.prevSibling
        ? "cm-inplace-item-gap"
        : depth > 1
          ? "cm-inplace-item-gap-nested"
          : null

      for (let n = firstLine; n <= lastLine; n++) {
        if (nested && n >= nestedFirst && n <= nestedLast) continue
        if (guides >= 1 && !seen.has(n)) {
          seen.add(n)
          out.push(
            Decoration.line({
              class: "cm-inplace-li",
              attributes: { style: `--sl-li-depth:${guides}` },
            }).range(doc.line(n).from),
          )
        }
        if (n === firstLine && gapClass) {
          out.push(Decoration.line({ class: gapClass }).range(doc.line(n).from))
        }
      }
    },
  })
}
