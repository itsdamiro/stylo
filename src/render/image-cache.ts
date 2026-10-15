import type { EmbedSource, ImageSource } from "../types"
import { invalidateEmbed } from "./embed-cache"

/**
 * The resolution cache for `![alt](src)` images (ADR-014). It is the embed
 * cache with one adapter in front: each `imageSource` gets a one-argument
 * `EmbedSource` that splits a `src`/`alt` key back into the two arguments, so
 * the caching, the shared in-flight promises, the 64-entry cap and the
 * invalidation listeners are `embed-cache.ts`'s own. The same file with two alt
 * texts (two sizes, say) is two entries.
 *
 * The one thing the embed cache cannot do is "every entry for this `src`", so
 * the adapter also notes which keys each `src` has been asked for.
 */

interface Adapter {
  source: EmbedSource
  /** `src` to the keys it has been resolved under. */
  keys: Map<string, Set<string>>
}

const SEP = "\u0000"

/** Distinct `src`s remembered per resolver; the embed cache's own cap bounds the results. */
const MAX_SRCS = 256

const adapters = new WeakMap<ImageSource, Adapter>()

function adapterFor(source: ImageSource): Adapter {
  let adapter = adapters.get(source)
  if (!adapter) {
    adapter = {
      source: (key) => {
        const at = key.indexOf(SEP)
        return source(key.slice(0, at), key.slice(at + 1))
      },
      keys: new Map(),
    }
    adapters.set(source, adapter)
  }
  return adapter
}

/** The cache source and key `Embed` resolves for one image. */
export function imageEntry(
  source: ImageSource,
  src: string,
  alt: string,
): { source: EmbedSource; key: string } {
  const adapter = adapterFor(source)
  const key = `${src}${SEP}${alt}`
  let set = adapter.keys.get(src)
  if (!set) {
    set = new Set()
    adapter.keys.set(src, set)
    if (adapter.keys.size > MAX_SRCS) {
      const oldest = adapter.keys.keys().next().value
      if (oldest !== undefined) adapter.keys.delete(oldest)
    }
  }
  set.add(key)
  return { source: adapter.source, key }
}

/**
 * Drops the cached result for every image with this `src` (any `alt`) — or, with
 * no `src`, for every image of `source` — and re-resolves the ones on screen.
 */
export function invalidateImage(source: ImageSource, src?: string): void {
  const adapter = adapters.get(source)
  if (!adapter) return
  if (src === undefined) {
    invalidateEmbed(adapter.source)
    return
  }
  for (const key of adapter.keys.get(src) ?? []) invalidateEmbed(adapter.source, key)
}
