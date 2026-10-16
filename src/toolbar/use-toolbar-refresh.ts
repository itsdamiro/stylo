import { useEffect, useReducer, useState } from "react"
import type { EditorView } from "@codemirror/view"

/**
 * Keeps the bar in step with the editing surface. `refresh` re-renders it so
 * pressed states are read back from the view; it runs on keys, pointer and
 * input, and on focus changes. `focused` follows the surface's focus.
 */
export function useToolbarRefresh(view: EditorView | null): {
  focused: boolean
  refresh: () => void
} {
  const [, refresh] = useReducer((n: number) => n + 1, 0)
  const [focused, setFocused] = useState(false)

  useEffect(() => {
    if (!view) return
    const el = view.contentDOM
    setFocused(view.hasFocus)
    const onFocus = () => {
      setFocused(true)
      refresh()
    }
    const onBlur = () => {
      setFocused(false)
      refresh()
    }
    const events = ["keyup", "mouseup", "input"] as const
    for (const ev of events) el.addEventListener(ev, refresh)
    el.addEventListener("focus", onFocus)
    el.addEventListener("blur", onBlur)
    return () => {
      for (const ev of events) el.removeEventListener(ev, refresh)
      el.removeEventListener("focus", onFocus)
      el.removeEventListener("blur", onBlur)
    }
  }, [view])

  return { focused, refresh }
}
