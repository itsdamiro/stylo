import type { ReactNode } from "react"

/** One `[[wikilink]]` autocomplete candidate returned by `wikiLinkSource`. */
export interface WikiLinkCompletion {
  /** Written verbatim between `[[` and `]]`. */
  target: string
  /**
   * Shown in the dropdown in place of `target`. When it differs from `target`,
   * the accepted link is written `[[target|label]]`.
   */
  label?: string
}

/**
 * Supplies `[[wikilink]]` autocomplete candidates. Called with the text typed
 * after `[[` (before any `|`) while the caret sits inside an unclosed `[[…`;
 * return the matches your index finds, already ordered — Stylo does not re-rank
 * or filter. May be async (e.g. a vault search endpoint). Pass it to enable the
 * feature; omit it and there is no wikilink completion. Read once, at mount.
 * Affects the CodeMirror surfaces only (`source`, `split`, `in-place`).
 */
export type WikiLinkSource = (
  query: string,
) => readonly WikiLinkCompletion[] | Promise<readonly WikiLinkCompletion[]>

/** One `#tag` autocomplete candidate returned by `tagSource`. */
export interface TagCompletion {
  /** Written verbatim after `#`. No alias — tags have no `#tag|label` syntax. */
  tag: string
}

/**
 * Supplies `#tag` autocomplete candidates. Called with the text typed after `#`
 * while the caret sits inside an unclosed `#…` word; return the matches your
 * index finds, already ordered — Stylo does not re-rank or filter. May be async
 * (e.g. a tag-index lookup). Pass it to enable the feature; omit it and there is
 * no tag completion. Read once, at mount. Never fires on a `# Heading` marker
 * (the space breaks the match) or mid-word (`word#word`, a URL fragment).
 */
export type TagSource = (
  query: string,
) => readonly TagCompletion[] | Promise<readonly TagCompletion[]>

/**
 * Resolves an `![[ref]]` embed (transclusion) to something to render. Called
 * with the raw reference — everything between `![[` and `]]`, trimmed, with any
 * `#heading` / `#^blockid` / `|size` suffix left intact for the host to parse.
 * Stylo has no vault, so it cannot resolve the reference itself; it detects the
 * `![[…]]` and renders whatever node you return in its place. May be async (a
 * vault lookup, a fetch). Return `null` to leave the reference as literal text.
 *
 * Pass it to enable embeds; omit it and `![[…]]` stays literal. Works on
 * `preview`, `split`, and the in-place canvas (ADR-009). A `![[…]]` alone on its
 * line renders as a **block**; one mid-sentence renders **inline** — return
 * phrasing content (not a block element) for the inline case. `![[…]]` inside
 * code stays literal, and inside an **in-place table cell** it stays literal too
 * (a table cell there is for editing tabular text; `preview` / `split` do
 * transclude in cells). Give it a stable reference — the render pipeline
 * rebuilds when its identity changes, and the in-place canvas reads it once at
 * mount.
 *
 * Results are memoised by `ref` per function identity (so a scroll or a
 * re-render does not re-resolve). If your source's output for a given `ref` can
 * change over time, vary the `ref` or pass a new `embedSource` to invalidate.
 * Rejections are not cached.
 */
export type EmbedSource = (ref: string) => ReactNode | Promise<ReactNode>

/** Which host resolver rejected, and the argument it was called with. */
export interface ResolveErrorInfo {
  /** The prop whose function threw or returned a rejected promise. */
  source: "embedSource" | "wikiLinkSource" | "tagSource"
  /** What it was asked to resolve — an `![[ref]]` reference, or the `[[` query. */
  input: string
}
