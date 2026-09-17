import type { Range } from "@codemirror/state"
import { Decoration, type EditorView } from "@codemirror/view"
import { WIKILINK_PATTERN } from "../wikilink"
import { embedRegistryFacet } from "./config"
import { inCodeContext, type Tree } from "./scan"

/**
 * Regex pass for `[[wikilinks]]` — the CodeMirror grammar has no node for them.
 * Collapses each match to its label and tags it with `data-stylo-wikilink`
 * (the delegated click handler in `inPlaceExtension` reads that attribute).
 */
export function scanWikilinks(
  view: EditorView,
  from: number,
  to: number,
  text: string,
  revealed: Set<number>,
  tree: Tree,
  out: Range<Decoration>[],
): void {
  if (!text.includes("[[")) return

  // With `embedSource` set, a `![[ref]]` belongs to the embed pass — leave its
  // inner `[[ref]]` alone so the two never decorate the same span (ADR-009).
  const embedsActive = view.state.facet(embedRegistryFacet) != null

  for (const match of text.matchAll(WIKILINK_PATTERN)) {
    const [raw = "", rawTarget = "", rawLabel] = match
    const target = rawTarget.trim()
    const start = from + (match.index ?? 0)
    if (!target || inCodeContext(tree, start + 1)) continue
    if (embedsActive && start > 0 && view.state.doc.sliceString(start - 1, start) === "!") continue

    const end = start + raw.length
    const labelStart = rawLabel != null ? start + 2 + rawTarget.length + 1 : start + 2
    const labelEnd = end - 2

    out.push(
      Decoration.mark({
        class: "cm-inplace-link cm-inplace-wikilink",
        attributes: { "data-stylo-wikilink": target },
      }).range(labelStart, labelEnd),
    )
    if (!revealed.has(view.state.doc.lineAt(start).number)) {
      out.push(Decoration.replace({}).range(start, labelStart))
      out.push(Decoration.replace({}).range(labelEnd, end))
    }
  }
}
