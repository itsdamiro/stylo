import { ViewPlugin, type ViewUpdate } from "@codemirror/view"
import { cellMarksFacet, cellWidgetsFacet } from "./config"
import { staticTables } from "./table-static-paint"
import { tableWidgets } from "./table-widget"

const EMPTY = "[[],[]]"

/**
 * Repaints the host's marks and widgets in table cells when they, or the document that
 * their positions point into, change. A table widget owns its DOM, so
 * CodeMirror never redraws it for us. The repaint waits for the measure phase:
 * during `update` the widgets' DOM still shows the previous document.
 */
export const cellMarksPlugin = ViewPlugin.fromClass(
  class {
    last = EMPTY

    update(update: ViewUpdate) {
      const { state } = update
      // A widget's `toDOM` is a function: its `pos` and `key` stand for it.
      const sig = JSON.stringify([
        state.facet(cellMarksFacet)(state),
        state
          .facet(cellWidgetsFacet)(state)
          .map((w) => [w.pos, w.key, w.cellClass]),
      ])
      if (sig === this.last && !update.docChanged) return
      if (sig === EMPTY && this.last === EMPTY) return
      this.last = sig
      update.view.requestMeasure({
        read: () => null,
        write: (_, view) => {
          for (const el of view.dom.querySelectorAll<HTMLElement>(".cm-inplace-table")) {
            tableWidgets.get(el)?.repaintMarks()
            staticTables.get(el)?.()
          }
        },
        key: this,
      })
    }
  },
)
