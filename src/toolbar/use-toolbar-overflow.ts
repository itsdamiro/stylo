import { useCallback, useLayoutEffect, useState } from "react"
import type { RefObject } from "react"
import { fitEntries } from "./overflow-fit"

/**
 * Decides which slots fold into the overflow menu. `measureRef` is a hidden
 * row inside the bar holding one copy of every slot (same order as `slots`)
 * followed by the "more" button; its offsets give each slot's real width, so
 * the result follows fonts, custom glyphs and the sticky bar's larger buttons.
 * Re-measured before paint when `slots` change and whenever the bar resizes —
 * widening the host brings buttons back out. Returns one flag per slot.
 */
export function useToolbarOverflow(
  barRef: RefObject<HTMLElement | null>,
  measureRef: RefObject<HTMLElement | null>,
  enabled: boolean,
  slots: { key: string; sep: boolean; pinned: boolean }[],
): boolean[] {
  const [folded, setFolded] = useState<boolean[]>([])
  const sig = slots.map((s) => `${s.key}${s.sep ? "|" : ""}${s.pinned ? "!" : ""}`).join("\0")

  const measure = useCallback(() => {
    const bar = barRef.current
    const row = measureRef.current
    if (!bar || !row) return
    const kids = Array.from(row.children) as HTMLElement[]
    const more = kids.pop()
    if (!more || kids.length !== slots.length) return
    const end = (el: HTMLElement) => el.offsetLeft + el.offsetWidth
    const widths = kids.map((k, i) => (kids[i + 1] ?? more).offsetLeft - k.offsetLeft)
    const prev = kids[kids.length - 1]
    const gap = prev ? more.offsetLeft - end(prev) : 0
    const cs = getComputedStyle(bar)
    const pad = (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0)
    const next = fitEntries(
      slots.map((s, i) => ({ sep: s.sep, pinned: s.pinned, width: widths[i]! })),
      bar.clientWidth - pad,
      more.offsetWidth + gap,
    )
    setFolded((cur) =>
      cur.length === next.length && cur.every((f, i) => f === next[i]) ? cur : next,
    )
    // `sig` stands in for `slots`: a fresh array each render must not re-measure.
  }, [barRef, measureRef, sig])

  useLayoutEffect(() => {
    const bar = barRef.current
    if (!enabled || !bar) return
    measure()
    if (typeof ResizeObserver === "undefined") return
    const ro = new ResizeObserver(measure)
    ro.observe(bar)
    return () => ro.disconnect()
  }, [enabled, barRef, measure])

  return enabled ? folded : []
}
