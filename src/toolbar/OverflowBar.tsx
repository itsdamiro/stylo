import { useRef } from "react"
import type { ReactNode } from "react"
import styles from "../styles/stylo.module.css"
import type { ToolbarCommandId } from "../types"
import type { ToolbarItem } from "./config"
import { OverflowMenu, moreGlyph } from "./OverflowMenu"
import type { OverflowEntry } from "./OverflowMenu"
import { menuSlots, trimSeps } from "./overflow-fit"
import { toButton } from "./toolbar-model"
import type { Btn, Resolved } from "./toolbar-model"
import { useToolbarOverflow } from "./use-toolbar-overflow"

const Sep = () => <span className={styles.toolbarSep} aria-hidden="true" />

/**
 * The bar's contents in `overflow: "menu"` mode. Slots lay out flat (no group
 * wrappers) so single buttons can fold; the ones that do not fit go to a
 * trailing menu. A hidden copy of every slot, rendered alongside, is what the
 * fit measures.
 */
export function OverflowBar({
  items,
  icons,
  overflowIcon,
  resolve,
  run,
  renderItem,
}: {
  items: ToolbarItem[]
  icons?: Partial<Record<ToolbarCommandId, ReactNode>>
  overflowIcon?: ReactNode
  resolve: (item: Exclude<ToolbarItem, "|">) => Resolved | null
  run: (btn: Btn) => void
  renderItem: (item: Exclude<ToolbarItem, "|">) => ReactNode
}) {
  const measureRef = useRef<HTMLDivElement>(null)
  // Unknown ids are dropped up front so the slots match the measured DOM.
  const flat = items.filter((it) => it === "|" || toButton(it, icons) !== null)
  const folded = useToolbarOverflow(
    measureRef,
    flat.map((it, i) => ({
      key: it === "|" ? `sep-${i}` : typeof it === "string" ? it : it.id,
      sep: it === "|",
      pinned: typeof it === "object" && Boolean(it.pinned),
    })),
  )
  const marked = flat.map((it, i) => ({ it, sep: it === "|", folded: Boolean(folded[i]) }))
  const row = trimSeps(marked.filter((s) => !s.folded))
  const menu = menuSlots(marked)

  const entries = menu.map((s): OverflowEntry | "|" => {
    const r = s.it === "|" ? null : resolve(s.it)
    if (!r) return "|"
    const { btn, off, active } = r
    return {
      key: btn.key,
      title: btn.title,
      icon: btn.icon,
      disabled: off,
      active: btn.isActive ? active : undefined,
      run: () => run(btn),
    }
  })

  return (
    <>
      {row.map((s, i) => (s.it === "|" ? <Sep key={`sep-${i}`} /> : renderItem(s.it)))}
      {menu.length > 0 && <OverflowMenu entries={entries} icon={overflowIcon} />}
      <div className={styles.toolbarMeasureClip} aria-hidden="true">
        <div ref={measureRef} className={styles.toolbarMeasure}>
          {flat.map((it, i) =>
            it === "|" ? (
              <Sep key={i} />
            ) : (
              <button key={i} type="button" tabIndex={-1} className={styles.toolbarButton}>
                {toButton(it, icons)!.icon}
              </button>
            ),
          )}
          <button type="button" tabIndex={-1} className={styles.toolbarButton}>
            {moreGlyph(overflowIcon)}
          </button>
        </div>
      </div>
    </>
  )
}
