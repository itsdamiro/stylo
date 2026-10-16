import { useMemo } from "react"
import type { ImageSource, ResolveErrorInfo } from "../types"
import { Embed } from "./Embed"
import { imageEntry } from "./image-cache"

interface HostImageProps {
  src: string
  alt: string
  /** The image as written, shown while it resolves, on `null`, and on an error. */
  literal: string
  source: ImageSource
  /** Phrasing content in a `<span>`: an image in a sentence, a list item or a quote. */
  inline?: boolean
  onError?: (error: unknown, info: ResolveErrorInfo) => void
}

/**
 * One `![alt](src)` image resolved through the host's `imageSource` (ADR-014).
 * `Embed` does the work — the shared cache, the literal fallback, the error
 * report, the invalidation listener — so an image behaves as an embed does, on
 * `preview` and on the canvas alike.
 */
export function HostImage({ src, alt, literal, source, inline, onError }: HostImageProps) {
  const entry = useMemo(() => imageEntry(source, src, alt), [source, src, alt])
  const errorInfo = useMemo<ResolveErrorInfo>(() => ({ source: "imageSource", input: src }), [src])
  return (
    <Embed
      reference={entry.key}
      source={entry.source}
      onError={onError}
      inline={inline}
      literal={literal}
      errorInfo={errorInfo}
    />
  )
}
