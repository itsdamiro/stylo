/** One slot of the flattened bar, as the overflow fit sees it. */
export interface FitEntry {
  sep: boolean
  pinned: boolean
  /** Measured width, including the gap that follows it. */
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
 * Which entries fold into the overflow menu so the rest fit in `available`
 * pixels. Folds from the end, unpinned buttons first; pinned ones only once
 * nothing else is left. `moreWidth` is reserved once anything has folded.
 */
export function fitEntries(entries: FitEntry[], available: number, moreWidth: number): boolean[] {
  const folded = entries.map(() => false)
  const fits = () => {
    const kept = trimSeps(entries.filter((_, i) => !folded[i]))
    const used = kept.reduce((sum, e) => sum + e.width, 0)
    return used + (folded.some(Boolean) ? moreWidth : 0) <= available
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
