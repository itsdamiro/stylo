/** One slot of the flattened bar, as the overflow fit sees it. */
export interface FitEntry {
  sep: boolean
  pinned: boolean
  /** Measured width, margins included, gap excluded. */
  width: number
}

/** Drops separators that would lead, trail, or sit next to another. */
export function trimSeps<T extends { sep: boolean }>(list: T[]): T[] {
  const out: T[] = []
  for (const e of list) {
    if (e.sep && (out.length === 0 || out[out.length - 1]!.sep)) continue
    out.push(e)
  }
  while (out.length && out[out.length - 1]!.sep) out.pop()
  return out
}

/**
 * The slots the overflow menu lists: every folded one, plus each separator
 * with a folded slot on both sides, so the menu keeps the bar's groups.
 */
export function menuSlots<T extends { sep: boolean; folded: boolean }>(list: T[]): T[] {
  const firstAt = list.findIndex((e) => e.folded)
  const lastAt = list.map((e) => e.folded).lastIndexOf(true)
  return trimSeps(list.filter((e, i) => e.folded || (e.sep && i > firstAt && i < lastAt)))
}

/**
 * Which entries fold into the overflow menu so the rest fit in `available`
 * pixels. Folds from the end, unpinned buttons first; pinned ones only once
 * nothing else is left. `moreWidth` (and one `gap` before it) is reserved once
 * anything has folded; `gap` also separates the slots that stay.
 */
export function fitEntries(
  entries: FitEntry[],
  available: number,
  moreWidth: number,
  gap = 0,
): boolean[] {
  const folded = entries.map(() => false)
  const fits = () => {
    const kept = trimSeps(entries.filter((_, i) => !folded[i]))
    const row = kept.reduce((sum, e) => sum + e.width, 0) + gap * Math.max(0, kept.length - 1)
    const more = folded.some(Boolean) ? moreWidth + (kept.length ? gap : 0) : 0
    return row + more <= available
  }
  const lastOpen = (pinned: boolean) => {
    for (let i = entries.length - 1; i >= 0; i--) {
      const e = entries[i]!
      if (!folded[i] && !e.sep && e.pinned === pinned) return i
    }
    return -1
  }
  while (!fits()) {
    const i = lastOpen(false) >= 0 ? lastOpen(false) : lastOpen(true)
    if (i < 0) break
    folded[i] = true
  }
  return folded
}
