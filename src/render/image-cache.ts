import type { EmbedSource, ImageSource } from "../types"
import { invalidateEmbedWhere } from "./embed-cache"

/**
 * The resolution cache for `![alt](src)` images (ADR-014). It is the embed
 * cache with one adapter in front: each `imageSource` gets a one-argument
 * `EmbedSource` that reads a key back into `src` and `alt`, so the caching, the
 * shared in-flight promises, the 64-entry cap and the invalidation listeners
 * are `embed-cache.ts`'s own. The same file with two alt texts (two sizes, say)
 * is two entries.
 */

const adapters = new WeakMap<ImageSource, EmbedSource>()

/** The `[src, alt]` a key was made from. */
function unkey(key: string): [string, string] {
  return JSON.parse(key) as [string, string]
}

function adapterFor(source: ImageSource): EmbedSource {
  let adapter = adapters.get(source)
  if (!adapter) {
    adapter = (key) => source(...unkey(key))
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
  return { source: adapterFor(source), key: JSON.stringify([src, alt]) }
}

/**
 * Drops the cached result for every image with this `src` (any `alt`) — or, with
 * no `src`, for every image of `source` — and re-resolves the ones on screen.
 */
export function invalidateImage(source: ImageSource, src?: string): void {
  const adapter = adapters.get(source)
  if (!adapter) return
  invalidateEmbedWhere(adapter, src === undefined ? () => true : (key) => unkey(key)[0] === src)
}
