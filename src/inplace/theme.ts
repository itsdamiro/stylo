import { EditorView } from "@codemirror/view"
import { calloutTheme } from "./theme-callout"
import { canvasTheme } from "./theme-canvas"
import { imageTheme } from "./theme-image"
import { menuTheme } from "./theme-menu"
import { popupsTheme } from "./theme-popups"
import { tableTheme } from "./theme-table"
import { tableGizmosTheme } from "./theme-table-gizmos"

/**
 * Display styling for the in-place canvas. Scoped to editors that include this
 * extension (via `EditorView.theme`), so `source` mode is untouched. Sizes are
 * relative to the editor font so they track the host's type scale; colour stays
 * inherited from the `--stylo-*` tokens.
 *
 * Vertical rhythm mirrors the `preview` surface, which follows Tailwind's
 * `prose` scale (reference only, no plugin). The match is approximate here: a
 * `.cm-line` cannot take a `margin` without drifting click-to-position (see the
 * 2026-09-02 click-mapping note), and a blank source line already supplies most
 * of the inter-block gap, so heading `padding-top` is trimmed accordingly.
 *
 * Split by concern across `theme-*.ts` files — canvas prose, callouts, table,
 * the editable-table `+` gizmos, the right-click menu, and the floating popups
 * (selection bar, touch sizing, hover bubble) — and merged here into the one
 * style-spec object `EditorView.theme` takes.
 */
export const inPlaceTheme = EditorView.theme({
  ...canvasTheme,
  ...imageTheme,
  ...calloutTheme,
  ...tableTheme,
  ...tableGizmosTheme,
  ...menuTheme,
  ...popupsTheme,
})
