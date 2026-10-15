/**
 * The bridge between the in-place canvas (imperative CodeMirror DOM) and host
 * React. `EmbedWidget.toDOM()` builds an inert slot element and registers it
 * here; `InPlaceView` subscribes through `useSyncExternalStore` and portals an
 * `<Embed>` into every live slot. One registry instance per canvas, created in
 * `InPlaceView` and handed to the extension — never module-global, so two
 * editors on a page do not share slots. See ADR-009.
 */
export interface EmbedSlot {
  /** Monotonic per registry; the React portal key. */
  id: number
  /** Raw `![[ref]]` reference, passed straight to `embedSource`. For an image
   *  slot, the image as written (its `HostImage` fallback text). */
  ref: string
  /** Set on a `![alt](src)` image slot: what `imageSource` is called with. */
  image?: { src: string; alt: string }
  /** `true` for a `![[ref]]` mid-sentence — rendered as phrasing content. */
  inline: boolean
  /** The slot element CodeMirror owns; the portal target. */
  el: HTMLElement
}

export class EmbedRegistry {
  private slots = new Map<number, EmbedSlot>()
  private listeners = new Set<() => void>()
  private snapshot: EmbedSlot[] = []
  private nextId = 1
  private flushQueued = false

  /** Allocate an id for a freshly mounted widget. */
  allocate(): number {
    return this.nextId++
  }

  add(slot: EmbedSlot): void {
    this.slots.set(slot.id, slot)
    this.schedule()
  }

  remove(id: number): void {
    if (this.slots.delete(id)) this.schedule()
  }

  /** `useSyncExternalStore` subscribe. */
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  /** `useSyncExternalStore` snapshot — a stable array between mutations. */
  getSnapshot = (): EmbedSlot[] => this.snapshot

  /**
   * Coalesce the many `add` / `remove` calls one CodeMirror update makes into a
   * single React render. A detached (never-flushed) registry stays inert.
   */
  private schedule(): void {
    if (this.flushQueued) return
    this.flushQueued = true
    queueMicrotask(() => {
      this.flushQueued = false
      this.snapshot = [...this.slots.values()]
      for (const listener of this.listeners) listener()
    })
  }
}
