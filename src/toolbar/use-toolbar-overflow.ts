import { useCallback, useLayoutEffect, useState } from "react"
import type { RefObject } from "react"
import { fitEntries } from "./overflow-fit"

const px = (v: string) => parseFloat(v) || 0

/** Border-box width plus horizontal margins (a separator's width is mostly margin). */
function outerWidth(el: HTMLElement): number {
  const cs = getComputedStyle(el)
  return el.getBoundingClientRect().width + px(cs.marginLeft) + px(cs.marginRight)
}

/**
 * Decides which slots fold into the overflow menu. `measureRef` is a hidden
 * row inside the bar holding one copy of every slot (same order as `slots`)
 * followed by the "more" button; their rendered widths give the real fit, so
 * it follows fonts, custom glyphs and the sticky bar's larger buttons. Widths
 * come from layout rects, not offsets, so right-to-left pages measure the same.
 * Re-measured before paint when `slots` change, and whenever the bar or the
 * measuring row resizes (a host widening the panel, a glyph or font changing).
 * Returns one flag per slot.
 */
export function useToolbarOverflow(
  measureRef: RefObject<HTMLElement | null>,
  slots: { key: string; sep: boolean; pinned: boolean }[],
): boolean[] {
  const [folded, setFolded] = useState<boolean[]>([])
  const sig = slots.map((s) => `${s.key}${s.sep ? "|" : ""}${s.pinned ? "!" : ""}`).join("\0")

  const measure = useCallback(() => {
    const row = measureRef.current
    const bar = row?.closest<HTMLElement>("[role=toolbar]")
    if (!bar || !row) return
    const kids = Array.from(row.children) as HTMLElement[]
    const more = kids.pop()
    if (!more || kids.length !== slots.length) return
    const cs = getComputedStyle(bar)
    const available = bar.clientWidth - px(cs.paddingLeft) - px(cs.paddingRight)
    const next = fitEntries(
      slots.map((s, i) => ({ sep: s.sep, pinned: s.pinned, width: outerWidth(kids[i]!) })),
      available,
      outerWidth(more),
      px(getComputedStyle(row).columnGap),
    )
    setFolded((cur) =>
      cur.length === next.length && cur.every((f, i) => f === next[i]) ? cur : next,
    )
    // `sig` stands in for `slots`: a fresh array each render must not re-measure.
  }, [measureRef, sig])

  useLayoutEffect(() => {
    // The bar is found from the row: a child's layout effect runs before the
    // parent's `ref` is attached, so a bar ref would still be null here.
    const row = measureRef.current
    const bar = row?.closest<HTMLElement>("[role=toolbar]")
    if (!bar || !row) return
    measure()
    if (typeof ResizeObserver === "undefined") return
    const ro = new ResizeObserver(measure)
    ro.observe(bar)
    ro.observe(row)
    return () => ro.disconnect()
  }, [measureRef, measure])

  return folded
}
