import type { ReactNode } from "react"
import type { ToolbarCommandId, ToolbarItem } from "../types"
import styles from "./StyloToolbarSettings.module.css"
import { itemKey, resolveDisplay } from "./items"

/** The "Available" column of `StyloToolbarSettings`: items not on the bar, each with an Add button. */
export function PaletteList({
  headId,
  items,
  icons,
  onAdd,
}: {
  headId: string
  items: ToolbarItem[]
  icons?: Partial<Record<ToolbarCommandId, ReactNode>>
  onAdd: (item: ToolbarItem) => void
}) {
  return (
    <section className={styles.col}>
      <h3 className={styles.colHead} id={headId}>
        Available
      </h3>
      <ul className={styles.list} aria-labelledby={headId}>
        {items.length === 0 && <li className={styles.empty}>Every button is on the bar.</li>}
        {items.map((item, i) => {
          const { icon, label } = resolveDisplay(item, icons)
          return (
            <li key={itemKey(item, i)} className={styles.row}>
              <span className={styles.glyph} aria-hidden="true">
                {icon}
              </span>
              <span className={styles.label}>{label}</span>
              <span className={styles.rowActions}>
                <button
                  type="button"
                  className={styles.textButton}
                  aria-label={`Add ${label} to the bar`}
                  onClick={() => onAdd(item)}
                >
                  Add
                </button>
              </span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
