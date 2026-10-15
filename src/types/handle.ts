import type { EditorView } from "@codemirror/view"

/**
 * Imperative handle exposed on a `ref` to `<Stylo>`. Every method but
 * `invalidateEmbed` and `invalidateImage` is a no-op — returning `null` / `false` where it has a
 * return value — in `preview` mode or before the editing surface has mounted,
 * since there is no editor then.
 */
export interface StyloHandle {
  /** Move keyboard focus into the editing surface. */
  focus(): void
  /**
   * Put the caret at the start of the first ATX heading (`#` … `######`) whose
   * text matches `text` (trimmed, case-insensitive) and scroll it to the top of
   * the viewport. Returns `true` when a heading matched.
   */
  scrollToHeading(text: string): boolean
  /**
   * Replace the current selection — or insert at the caret when the selection is
   * empty — with `md`. No effect on a `readOnly` surface.
   */
  insertAtCursor(md: string): void
  /**
   * The underlying CodeMirror `EditorView`, or `null` in `preview` mode or
   * before mount. An escape hatch: not covered by semver.
   */
  getView(): EditorView | null
  /**
   * Drops the cached result for an `![[ref]]` embed — or, with no `ref`, every
   * cached embed — so the next render re-invokes `embedSource` instead of
   * showing what it returned before. Call this when you know the content
   * behind a reference changed while the editor is open; Stylo has no way to
   * detect that on its own (see `EmbedSource`). Works in every mode, including
   * `preview`, since it targets the embed cache rather than the editor. A
   * no-op when `embedSource` isn't set.
   */
  invalidateEmbed(ref?: string): void
  /**
   * Drops the cached result for images with this `src` (every `alt`) — or, with
   * no `src`, every cached image — so the next render re-invokes `imageSource`.
   * The counterpart of `invalidateEmbed`; works in every mode, and is a no-op
   * when `imageSource` isn't set.
   */
  invalidateImage(src?: string): void
}
