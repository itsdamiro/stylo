/**
 * A Markdown image, `![alt](src)`, split into the two strings `imageSource`
 * receives. Both are taken from the raw source text exactly as written: the
 * `alt` keeps any `|300` size suffix and any Markdown inside it, the `src` is
 * the destination with its `<angle brackets>` removed and nothing else changed
 * (no percent-decoding, no unescaping). A link title is ignored. Matching the
 * raw text, not a parser's tree, is what lets `preview` and the in-place canvas
 * hand the host the same strings. See ADR-014.
 */
const IMAGE =
  /^!\[([\s\S]*)\]\(\s*(<[^<>\n]*>|(?:[^\s()<]|\([^\s()]*\))*)(?:\s+(?:"[^"]*"|'[^']*'|\([^)]*\)))?\s*\)$/

export interface ParsedImage {
  src: string
  alt: string
}

/**
 * The `src` and `alt` of `raw`, which must be exactly one image and nothing
 * else (trimmed). `null` when it is not, or when it has no destination to
 * resolve (`![alt]()`).
 */
export function parseImage(raw: string): ParsedImage | null {
  const m = IMAGE.exec(raw.trim())
  if (!m) return null
  const dest = m[2] ?? ""
  const src = dest.startsWith("<") ? dest.slice(1, -1) : dest
  return src ? { src, alt: m[1] ?? "" } : null
}
