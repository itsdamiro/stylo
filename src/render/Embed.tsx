import { type ReactNode, useEffect, useState } from "react"
import type { EmbedSource, ResolveErrorInfo } from "../types"
import { onEmbedInvalidated, peekEmbed, resolveEmbed } from "./embed-cache"

interface EmbedProps {
  /** The raw `![[ref]]` reference, trimmed. */
  reference: string
  source: EmbedSource
  /** Notified if `source` rejects; the literal fallback still renders. */
  onError?: (error: unknown, info: ResolveErrorInfo) => void
  /**
   * Render as phrasing content in a `<span>` (a `![[…]]` mid-sentence) rather
   * than the default block `<div>`. The host node should be inline in this mode.
   */
  inline?: boolean
}

type State = { status: "loading" | "error" } | { status: "ready"; node: ReactNode }

/**
 * Renders one `![[ref]]` embed. Resolves the reference through `embedSource` —
 * via a shared cache (`embed-cache.ts`), so an embed re-mounted by a scroll or a
 * `preview` re-render is not re-fetched — and drops the result into
 * `<div class="stylo-embed-content">`, or a `<span>` when `inline`. While it
 * resolves — and if it rejects, or resolves to `null` — the literal `![[ref]]`
 * text stands in, so a reference is never silently lost.
 */
export function Embed({ reference, source, onError, inline }: EmbedProps) {
  const [state, setState] = useState<State>(() => {
    const hit = peekEmbed(source, reference)
    return hit ? { status: "ready", node: hit.node } : { status: "loading" }
  })

  useEffect(() => {
    let live = true
    function load() {
      const hit = peekEmbed(source, reference)
      if (hit) {
        setState({ status: "ready", node: hit.node })
        return
      }
      setState({ status: "loading" })
      resolveEmbed(source, reference).then(
        (node) => live && setState({ status: "ready", node }),
        (error) => {
          if (!live) return
          onError?.(error, { source: "embedSource", input: reference })
          setState({ status: "error" })
        },
      )
    }
    load()
    // Reruns this same load when a host calls `StyloHandle.invalidateEmbed`
    // for this ref, so a mounted embed updates immediately rather than only
    // on its next mount.
    const unsubscribe = onEmbedInvalidated(source, reference, load)
    return () => {
      live = false
      unsubscribe()
    }
  }, [reference, source, onError])

  const literal = `![[${reference}]]`
  if (state.status === "loading") return <span aria-busy="true">{literal}</span>
  if (state.status === "ready" && state.node != null) {
    // Keep the mousedown away from the in-place canvas's own delegated
    // handler — same reason and technique as the editable table widget
    // (`table-widget.ts`): CodeMirror's built-in click-to-place-caret runs
    // for *any* mousedown that reaches `contentDOM`'s listener regardless of
    // what a custom `domEventHandlers` hook decided, so returning `false`
    // from one is not enough to keep an atomic widget's interactive content
    // clickable — the event has to be stopped before it gets there. Not
    // `preventDefault` — the button (or whatever the host renders) still
    // gets the click natively. Inert outside the canvas (`preview` / `split`
    // have no such listener to stop).
    const stop = (e: { stopPropagation: () => void }) => e.stopPropagation()
    return inline ? (
      <span className="stylo-embed-content stylo-embed-inline" onMouseDown={stop}>
        {state.node}
      </span>
    ) : (
      <div className="stylo-embed-content" onMouseDown={stop}>
        {state.node}
      </div>
    )
  }
  return <span>{literal}</span>
}
