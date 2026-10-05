import { ViewPlugin, type ViewUpdate } from "@codemirror/view"
import { cellMarksFacet } from "./config"
import { tableWidgets } from "./table-widget"

/**
 * Repaints the host's marks in table cells when they, or the document that
 * their positions point into, change. A table widget owns its DOM, so
 * CodeMirror never redraws it for us. The repaint waits for the measure phase:
 * during `update` the widgets' DOM still shows the previous document.
 */
export const cellMarksPlugin = ViewPlugin.fromClass(
  class {
    last = "[]"

    update(update: ViewUpdate) {
      const sig = JSON.stringify(update.state.facet(cellMarksFacet)(update.state))
      if (sig === this.last && !update.docChanged) return
      if (sig === "[]" && this.last === "[]") return
      this.last = sig
      update.view.requestMeasure({
        read: () => null,
        write: (_, view) => {
          for (const el of view.dom.querySelectorAll<HTMLElement>(".cm-inplace-table-edit")) {
            tableWidgets.get(el)?.repaintMarks()
          }
        },
        key: this,
      })
    }
  },
)
