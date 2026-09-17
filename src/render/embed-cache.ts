import type { ReactNode } from "react"
import type { EmbedSource } from "../types"

/**
 * A process-wide resolution cache for `![[ref]]` embeds, shared by `preview` and
 * the in-place canvas (both render through `Embed`). Without it, an embed
 * scrolled out of the canvas viewport and back — or a `preview` re-render that
 * remounts the subtree — re-invokes `embedSource`, which for a network-backed
 * source is a refetch each time.
 *
 * Keyed first by the `embedSource` identity (a `WeakMap`, so two editors with
 * different resolvers never collide and a changed `embedSource` drops its cache
 * for free — the type doc already asks consumers to keep the reference stable),
 * then by the raw `ref` string.
 *
 * In-flight promises are shared, so two embeds of the same `ref` mounting
 * together call `embedSource` once. A rejection is **not** cached — the next
 * mount retries. `null` (the host chose to keep the reference literal) is a
 * valid cached value; `settled` tells it apart from an absent entry.
 *
 * The cache has no TTL and never re-checks a settled entry on its own — see
 * {@link invalidateEmbed} for the host-triggered way to drop one when the
 * content behind a reference actually changes, exposed publicly as
 * `StyloHandle.invalidateEmbed`.
 */

interface Entry {
  promise: Promise<ReactNode>
  node?: ReactNode
  settled: boolean
}

/** Distinct `ref`s kept per resolver. Eviction only costs a re-resolve. */
const MAX_ENTRIES = 64

const caches = new WeakMap<EmbedSource, Map<string, Entry>>()

function bucket(source: EmbedSource): Map<string, Entry> {
  let m = caches.get(source)
  if (!m) {
    m = new Map()
    caches.set(source, m)
  }
  return m
}

/** Mounted `Embed`s waiting to hear that their own `(source, ref)` was
 *  invalidated, so they can re-resolve without waiting for a remount. */
const listeners = new WeakMap<EmbedSource, Map<string, Set<() => void>>>()

function listenerSet(source: EmbedSource, ref: string): Set<() => void> {
  let bySource = listeners.get(source)
  if (!bySource) {
    bySource = new Map()
    listeners.set(source, bySource)
  }
  let set = bySource.get(ref)
  if (!set) {
    set = new Set()
    bySource.set(ref, set)
  }
  return set
}

/** Notified whenever `ref` is invalidated for `source` (see {@link invalidateEmbed}).
 *  Returns an unsubscribe function. */
export function onEmbedInvalidated(source: EmbedSource, ref: string, listener: () => void) {
  const set = listenerSet(source, ref)
  set.add(listener)
  return () => set.delete(listener)
}

/**
 * Drops the cached result for `ref` — or, with no `ref`, every entry for
 * `source` — so the next resolution re-invokes `embedSource` instead of
 * serving the stale answer. This is the escape hatch for the one case the
 * cache can't know about on its own: the content behind a reference changing
 * while the editor is open. Any `Embed` currently mounted for a dropped ref
 * re-resolves immediately via {@link onEmbedInvalidated}, rather than only on
 * its next mount.
 */
export function invalidateEmbed(source: EmbedSource, ref?: string): void {
  const m = caches.get(source)
  if (!m) return
  const refs = ref !== undefined ? [ref] : [...m.keys()]
  const bySource = listeners.get(source)
  for (const r of refs) {
    m.delete(r)
    bySource?.get(r)?.forEach((fn) => fn())
  }
}

/** A settled result for `ref`, or `undefined` while it is unresolved or absent. */
export function peekEmbed(source: EmbedSource, ref: string): { node: ReactNode } | undefined {
  const entry = bucket(source).get(ref)
  return entry?.settled ? { node: entry.node } : undefined
}

/** Resolve `ref` through the cache — reusing an in-flight or settled entry, or
 *  calling `source` on a miss. */
export function resolveEmbed(source: EmbedSource, ref: string): Promise<ReactNode> {
  const m = bucket(source)
  const existing = m.get(ref)
  if (existing) return existing.promise

  const promise = Promise.resolve(source(ref)).then(
    (node) => {
      const entry = m.get(ref)
      if (entry) {
        entry.node = node
        entry.settled = true
      }
      return node
    },
    (err) => {
      m.delete(ref) // never cache a failure
      throw err
    },
  )
  m.set(ref, { promise, settled: false })

  // Insertion-order cap: drop the oldest distinct ref once over the limit.
  if (m.size > MAX_ENTRIES) {
    const oldest = m.keys().next().value
    if (oldest !== undefined && oldest !== ref) m.delete(oldest)
  }
  return promise
}
