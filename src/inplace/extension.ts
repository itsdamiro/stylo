import { Prec, type Extension } from "@codemirror/state"
import { EditorView } from "@codemirror/view"
import { cellSourcePos } from "../toolbar/table-position"
import type { InPlaceConfig } from "../types"
import { offsetFromPoint } from "./table-cell-dom"
import {
  contextMenuEnabled,
  embedRegistryFacet,
  inPlaceConfigFacet,
  linkOpenFacet,
  menuGroupsFacet,
  resolveContextMenu,
  resolveSelectionBarItems,
  resolveToggles,
  revealModeFacet,
  selectionBarItemsFacet,
  selectionUIFacet,
  tableEditingFacet,
} from "./config"
import { inPlaceEditBoundaries } from "./edit-boundaries"
import { inPlaceAutoformat } from "./autoformat"
import { inPlaceDividerEdit } from "./edit-divider"
import { inPlaceInsertAssociation } from "./edit-insert-assoc"
import { inPlaceLinePrefixEdit } from "./edit-line-prefix"
import { frontmatterField } from "./frontmatter"
import { linkClickEditor } from "./link-click"
import { linkHoverTooltip } from "./link-hover"
import { embedField } from "./embed"
import type { EmbedRegistry } from "./embed-registry"
import { blockMathField } from "./math"
import { mathClickEditor, mathHoverTooltip } from "./math-edit"
import { menuOpenField } from "./menu-open"
import { contextMenuLayer } from "./menu-plugin"
import { inPlaceDecorations } from "./plugin"
import { selectionBar } from "./selection-bar"
import { inPlaceTableEnter } from "./table-enter"
import { tableField } from "./tables"
import { inPlaceTheme } from "./theme"

export interface InPlaceOptions {
  /** Fired when a collapsed `[[wikilink]]` is clicked in the canvas. */
  onWikiLinkClick?: (target: string) => void
  /** Fired by the link editor's "Open link" action with the link's href. */
  onLinkClick?: (href: string) => void
  /** Which decoration types render; see ADR-005. Applied once, at construction. */
  inPlace?: InPlaceConfig
  /**
   * The canvas's `EmbedRegistry`, passed only when the host set `embedSource`.
   * Its presence turns the `![[ref]]` pass on; see ADR-009.
   */
  embedRegistry?: EmbedRegistry
}

/**
 * Rendered widgets with no interior text position. A click on one (its body,
 * KaTeX internals, the empty parts of an `<hr>`) can leave the caret unplaced,
 * so nothing reveals — this hands it to the widget's edge instead. Everything
 * else, text and line padding alike, stays with CodeMirror.
 */
const REVEAL_WIDGET =
  ".cm-inplace-math, .cm-inplace-hr, .cm-inplace-table, .cm-inplace-embed, .cm-inplace-embed-inline"

/**
 * The complete in-place canvas layer: decoration plugin, display theme, a
 * reveal-on-click fallback for rendered widgets, and a delegated click handler
 * for wikilinks.
 *
 * The theme is raised with `Prec.high` so its `.cm-content` font rule overrides
 * the base editor theme (which sets the source surface to monospace) for
 * in-place editors only.
 */
export function inPlaceExtension(opts: InPlaceOptions = {}): Extension {
  const menu = resolveContextMenu(opts.inPlace?.contextMenu)
  return [
    inPlaceConfigFacet.of(resolveToggles(opts.inPlace)),
    embedRegistryFacet.of(opts.embedRegistry ?? null),
    tableEditingFacet.of(opts.inPlace?.table ?? "source"),
    revealModeFacet.of(opts.inPlace?.reveal ?? "caret"),
    linkOpenFacet.of(opts.onLinkClick ?? null),
    contextMenuEnabled.of(menu.enabled),
    menuGroupsFacet.of(menu.groups),
    selectionUIFacet.of(opts.inPlace?.selectionUI ?? "menu"),
    selectionBarItemsFacet.of(resolveSelectionBarItems(opts.inPlace?.selectionBarItems)),
    inPlaceDecorations(),
    // Backspace: the line-prefix unwrap gets first refusal, then removing a
    // rendered thematic break, then the step-over-markers handler, then
    // CodeMirror's default.
    inPlaceLinePrefixEdit,
    inPlaceDividerEdit,
    inPlaceEditBoundaries,
    inPlaceTableEnter,
    inPlaceInsertAssociation,
    inPlaceAutoformat,
    blockMathField,
    embedField,
    frontmatterField,
    tableField,
    menuOpenField,
    contextMenuLayer,
    selectionBar,
    linkClickEditor,
    linkHoverTooltip,
    mathClickEditor,
    mathHoverTooltip,
    Prec.high(inPlaceTheme),
    EditorView.domEventHandlers({
      mousedown(event, view) {
        const target = event.target as HTMLElement | null
        // An editable table (`inPlace.table: "cells"`) owns its own clicks —
        // the mousedown places the caret in a contentEditable cell.
        if (target?.closest(".cm-inplace-table-edit")) return false
        // A resolved `![[ref]]` embed owns its own clicks, so interactive host
        // content works. Clicking the slot's own box (or a pending / failed
        // embed's literal text) still falls through to reveal the source.
        if (target?.closest(".stylo-embed-content")) return false
        const widget = target?.closest<HTMLElement>(REVEAL_WIDGET)
        if (!widget) return false // text or padding — CodeMirror places the caret
        let pos = view.posAtDOM(widget)
        if (pos < 0) return false
        // A rendered table: reveal the source at the cell that was clicked, not
        // at the table's first cell (`posAtDOM` gives the widget's start).
        const cell = target?.closest<HTMLElement>("[data-stylo-row]")
        if (cell && widget.contains(cell)) {
          const at = cellSourcePos(
            view.state.doc,
            pos,
            Number(cell.dataset.styloRow),
            Number(cell.dataset.styloCol),
          )
          if (at != null) pos = at + offsetFromPoint(cell, event.clientX, event.clientY)
        }
        view.focus()
        view.dispatch({ selection: { anchor: pos } })
        return true
      },
      click(event) {
        if (!opts.onWikiLinkClick) return false
        const el = (event.target as HTMLElement | null)?.closest("[data-stylo-wikilink]")
        if (!el) return false
        opts.onWikiLinkClick(el.getAttribute("data-stylo-wikilink") ?? "")
        return false
      },
    }),
  ]
}
