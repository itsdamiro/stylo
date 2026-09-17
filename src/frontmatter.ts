import type { Text } from "@codemirror/state"

/**
 * The leading `---` … `---` YAML block, if present. The CodeMirror Markdown
 * grammar has no frontmatter node — it parses the fences as two thematic breaks
 * — so the region is located by hand. Shared by the in-place decoration layer
 * and the toolbar's frontmatter command.
 */
export function frontmatterRange(doc: Text): { from: number; to: number } | null {
  if (doc.lines < 2 || doc.line(1).text.trim() !== "---") return null
  for (let n = 2; n <= doc.lines; n++) {
    if (doc.line(n).text.trim() === "---") return { from: 0, to: doc.line(n).to }
  }
  return null
}

const FRONTMATTER_BLOCK = /^[ \t]*---[ \t]*\r?\n(?:([\s\S]*?)\r?\n)?[ \t]*---[ \t]*(?:\r?\n|$)/

/**
 * Split a leading `---` … `---` block off a Markdown string. `frontmatter` is
 * the inner text (`""` for an empty block); `body` is everything after the
 * closing fence. Used by `preview` to render the block instead of dropping it.
 */
export function splitFrontmatter(md: string): { frontmatter: string; body: string } | null {
  const m = FRONTMATTER_BLOCK.exec(md)
  return m ? { frontmatter: m[1] ?? "", body: md.slice(m[0].length) } : null
}
