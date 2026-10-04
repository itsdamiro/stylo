import { useEffect, useRef, useState } from "react"
import type { ReactNode } from "react"
import styles from "../styles/stylo.module.css"

export interface OverflowEntry {
  key: string
  title: string
  icon: ReactNode
  disabled: boolean
  /** Pressed state of a toggle command; `undefined` when it is not a toggle. */
  active?: boolean
  run: () => void
}

const MORE_ICON = (
  <svg viewBox="0 0 24 24" fill="currentColor" stroke="none">
    <circle cx="5" cy="12" r="1.8" />
    <circle cx="12" cy="12" r="1.8" />
    <circle cx="19" cy="12" r="1.8" />
  </svg>
)

/** The glyph used for the "more" button when the host passes no `overflowIcon`. */
export const moreGlyph = (icon: ReactNode) => icon ?? MORE_ICON

/**
 * The trailing "more" button and the menu it opens. A button keeps the icon,
 * label, disabled state and action it had in the row. Mouse presses keep the
 * editor focused, like the row's buttons; from the keyboard (Enter / Space on
 * the button) focus moves into the menu: arrows step, Escape closes.
 */
export function OverflowMenu({
  entries,
  icon,
}: {
  /** Menu entries in order; `"|"` is a divider between groups. */
  entries: (OverflowEntry | "|")[]
  icon?: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const moreRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    // Document-level: after a mouse open, focus is still in the editor.
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return
      const inside = rootRef.current?.contains(document.activeElement)
      setOpen(false)
      if (inside) moreRef.current?.focus()
    }
    document.addEventListener("mousedown", onDown)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onDown)
      document.removeEventListener("keydown", onKey)
    }
  }, [open])

  const items = () =>
    Array.from(
      rootRef.current?.querySelectorAll<HTMLButtonElement>("[role^=menuitem]:enabled") ?? [],
    )

  const onKeyDown = (e: React.KeyboardEvent) => {
    if ((e.key === "ArrowDown" || e.key === "ArrowUp") && open) {
      e.preventDefault()
      const list = items()
      const at = list.indexOf(document.activeElement as HTMLButtonElement)
      const down = e.key === "ArrowDown"
      // Nothing focused yet: Down starts at the first entry, Up at the last.
      const next =
        at < 0 ? (down ? 0 : list.length - 1) : (at + (down ? 1 : -1) + list.length) % list.length
      list[next]?.focus()
    }
  }

  return (
    <div
      ref={rootRef}
      className={styles.toolbarMore}
      data-stylo-overflow=""
      onKeyDown={onKeyDown}
      onBlur={(e) => {
        // Tabbing out of the open menu closes it.
        if (open && !rootRef.current?.contains(e.relatedTarget as Node | null)) setOpen(false)
      }}
    >
      <button
        ref={moreRef}
        type="button"
        className={styles.toolbarButton}
        title="More"
        aria-label="More"
        aria-haspopup="menu"
        aria-expanded={open}
        onMouseDown={(e) => e.preventDefault()}
        onClick={(e) => {
          const next = !open
          setOpen(next)
          // detail 0 = keyboard activation: move into the menu once it renders.
          if (next && e.detail === 0) requestAnimationFrame(() => items()[0]?.focus())
        }}
      >
        {moreGlyph(icon)}
      </button>
      {open && (
        <div className={styles.toolbarMenu} role="menu" data-stylo-overflow-menu="">
          {entries.map((entry, i) =>
            entry === "|" ? (
              <div key={`d-${i}`} className={styles.toolbarMenuDivider} role="separator" />
            ) : (
              <button
                key={entry.key}
                type="button"
                role={entry.active === undefined ? "menuitem" : "menuitemcheckbox"}
                aria-checked={entry.active}
                data-active={entry.active ? "" : undefined}
                className={styles.toolbarMenuItem}
                data-command={entry.key}
                disabled={entry.disabled}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  // Keyboard users keep their place: the focused entry is about to unmount.
                  if (rootRef.current?.contains(document.activeElement)) moreRef.current?.focus()
                  setOpen(false)
                  entry.run()
                }}
              >
                {entry.icon}
                <span>{entry.title}</span>
              </button>
            ),
          )}
        </div>
      )}
    </div>
  )
}
