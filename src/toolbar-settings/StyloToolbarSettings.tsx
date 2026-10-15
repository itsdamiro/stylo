import { useId, useState } from "react"
import type { ReactNode } from "react"
import {
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core"
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import type { ToolbarCommandId, ToolbarItem } from "../types"
import { DEFAULT_TOOLBAR_ITEMS } from "../toolbar/config"
import { ALL_BUILTIN_IDS } from "../toolbar/labels"
import styles from "./StyloToolbarSettings.module.css"
import { PaletteList } from "./PaletteList"
import { SortableRow } from "./SortableRow"
import {
  append,
  availableNotOnBar,
  itemKey,
  move,
  removeAt,
  resolveDisplay,
  SEPARATOR,
} from "./items"

export interface StyloToolbarSettingsProps {
  /** The toolbar items — the same array passed to `<Stylo toolbar={{ items }}>`. */
  value: ToolbarItem[]
  /** Called with the next items array on every change. */
  onChange: (next: ToolbarItem[]) => void
  /**
   * Every item the user may pick from. Defaults to all built-in command ids;
   * pass a list to add `ToolbarCustomItem`s or to hold some built-ins back.
   */
  available?: ToolbarItem[]
  /** Per-id glyph overrides, matching `<Stylo icons>`. */
  icons?: Partial<Record<ToolbarCommandId, ReactNode>>
  /** Extra class on the root element. */
  className?: string
}

/**
 * A keyboard-accessible editor for the formatting bar's `items`. Controlled:
 * the host owns `value`, persists it, and feeds it to both this component and
 * `<Stylo>`.
 *
 * Reorder a row by dragging its ⠿ handle, or focus the handle and use
 * Space + Arrow keys (`@dnd-kit`'s keyboard sensor). The ✕ / Add buttons move
 * items between the two lists. `@dnd-kit/core`, `/sortable`, and `/utilities`
 * are optional peer dependencies of this entry point.
 */
export function StyloToolbarSettings({
  value,
  onChange,
  available,
  icons,
  className,
}: StyloToolbarSettingsProps) {
  const barHeadId = useId()
  const availHeadId = useId()
  const [message, setMessage] = useState("")

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const paletteItems = availableNotOnBar(available ?? ALL_BUILTIN_IDS, value)
  const barIds = value.map((_, i) => String(i))

  function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return
    const from = Number(active.id)
    const to = Number(over.id)
    const label = resolveDisplay(value[from]!, icons).label
    onChange(move(value, from, to))
    setMessage(`${label} moved to position ${to + 1} of ${value.length}`)
  }

  function removeSlot(index: number) {
    const label = resolveDisplay(value[index]!, icons).label
    onChange(removeAt(value, index))
    setMessage(`${label} removed from the bar`)
  }

  function add(item: ToolbarItem) {
    onChange(append(value, item))
    setMessage(`${resolveDisplay(item, icons).label} added to the bar`)
  }

  function reset() {
    onChange([...DEFAULT_TOOLBAR_ITEMS])
    setMessage("Toolbar reset to the default set")
  }

  const dragAnnounce = (id: string | number, verb: string) =>
    `${resolveDisplay(value[Number(id)]!, icons).label} ${verb}`

  return (
    <div className={[styles.root, className].filter(Boolean).join(" ")}>
      <section className={styles.col}>
        <h3 className={styles.colHead} id={barHeadId}>
          On the bar
        </h3>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={onDragEnd}
          accessibility={{
            announcements: {
              onDragStart: ({ active }) => dragAnnounce(active.id, "picked up"),
              onDragOver: ({ active, over }) =>
                over ? `${dragAnnounce(active.id, "is over position")} ${Number(over.id) + 1}` : "",
              onDragEnd: ({ active, over }) =>
                over
                  ? `${dragAnnounce(active.id, "dropped at position")} ${Number(over.id) + 1}`
                  : dragAnnounce(active.id, "dropped"),
              onDragCancel: ({ active }) => dragAnnounce(active.id, "drag cancelled"),
            },
          }}
        >
          <SortableContext items={barIds} strategy={verticalListSortingStrategy}>
            <ul className={styles.list} aria-labelledby={barHeadId}>
              {value.map((item, i) => {
                const { icon, label } = resolveDisplay(item, icons)
                return (
                  <SortableRow
                    key={itemKey(item, i)}
                    id={String(i)}
                    label={label}
                    icon={icon}
                    position={i + 1}
                    count={value.length}
                    actions={
                      <button
                        type="button"
                        className={styles.iconButton}
                        title="Remove"
                        aria-label={`Remove ${label} from the bar`}
                        onClick={() => removeSlot(i)}
                      >
                        ✕
                      </button>
                    }
                  />
                )
              })}
            </ul>
          </SortableContext>
        </DndContext>
        <div className={styles.footer}>
          <button type="button" className={styles.textButton} onClick={() => add(SEPARATOR)}>
            Add separator
          </button>
          <button type="button" className={styles.textButton} onClick={reset}>
            Reset to default
          </button>
        </div>
      </section>

      <PaletteList headId={availHeadId} items={paletteItems} icons={icons} onAdd={add} />

      <div aria-live="polite" className={styles.srOnly}>
        {message}
      </div>
    </div>
  )
}
