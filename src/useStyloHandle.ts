import { useImperativeHandle, useRef } from "react"
import type { Ref } from "react"
import { EditorView } from "@codemirror/view"
import { invalidateEmbed } from "./render/embed-cache"
import { invalidateImage } from "./render/image-cache"
import type { EmbedSource, ImageSource, StyloHandle } from "./types"

/** Select the first ATX heading whose text matches, and scroll it to the top. */
function scrollToHeading(view: EditorView, text: string): boolean {
  const target = text.trim().toLowerCase()
  const { doc } = view.state
  for (let n = 1; n <= doc.lines; n++) {
    const line = doc.line(n)
    const m = /^ {0,3}#{1,6}[ \t]+(.*?)(?:[ \t]+#+)?[ \t]*$/.exec(line.text)
    if (!m || m[1] === undefined) continue
    if (m[1].trim().toLowerCase() !== target) continue
    view.dispatch({
      selection: { anchor: line.from },
      effects: EditorView.scrollIntoView(line.from, { y: "start" }),
    })
    view.focus()
    return true
  }
  return false
}

/**
 * The imperative handle `Stylo` exposes through its ref. The two sources are
 * read through refs, so a changed `embedSource` or `imageSource` does not
 * rebuild the handle; it is rebuilt only when the surface's `view` changes.
 */
export function useStyloHandle(
  ref: Ref<StyloHandle>,
  view: EditorView | null,
  sources: { embedSource?: EmbedSource; imageSource?: ImageSource },
): void {
  const embedSourceRef = useRef(sources.embedSource)
  embedSourceRef.current = sources.embedSource
  const imageSourceRef = useRef(sources.imageSource)
  imageSourceRef.current = sources.imageSource

  useImperativeHandle(
    ref,
    () => ({
      focus: () => view?.focus(),
      getView: () => view,
      insertAtCursor: (md) => {
        if (!view) return
        view.dispatch(view.state.replaceSelection(md))
        view.focus()
      },
      scrollToHeading: (text) => (view ? scrollToHeading(view, text) : false),
      invalidateEmbed: (ref) => {
        const source = embedSourceRef.current
        if (source) invalidateEmbed(source, ref)
      },
      invalidateImage: (src) => {
        const source = imageSourceRef.current
        if (source) invalidateImage(source, src)
      },
    }),
    [view],
  )
}
