import type { ReactNode } from "react"
import type { Language, LanguageDescription } from "@codemirror/language"
import type { Extension } from "@codemirror/state"
import type { EditorView } from "@codemirror/view"
import type { EmbedSource, ResolveErrorInfo, TagSource, WikiLinkSource } from "./sources"
import type { InPlaceConfig } from "./inplace"
import type { ToolbarCommandId, ToolbarConfig } from "./toolbar"

export type StyloMode = "in-place" | "source" | "preview" | "split"

/**
 * How `preview` (and the preview pane of `split`) treats the leading `---` YAML
 * block. `"hidden"` (default) drops it from the render; `"code"` renders it as a
 * styled `<pre class="stylo-frontmatter">` a consumer can restyle with its own
 * CSS. A parsed key/value panel is deferred (ADR-001, needs a YAML parser).
 */
export type FrontmatterDisplay = "hidden" | "code"

/**
 * Grammars for fenced-code sub-highlighting. Stylo ships none by default — a
 * consumer opts in with exactly the set they want (`codeLanguages={languages}`
 * from `@codemirror/language-data`, or a hand-built list). Forwarded verbatim
 * to `@codemirror/lang-markdown` for the CodeMirror surfaces (`source`,
 * `split`, `in-place`); `preview` resolves a fence's language the same way
 * (same fuzzy `LanguageDescription` match, or the function form called with
 * the same name) and colours it with the same `--stylo-syntax-*` tokens, so a
 * block reads identically whether it's being read or edited. See the ADR-001
 * amendment and ADR-002 §3's 2026-09-13 amendment.
 */
export type CodeLanguages =
  readonly LanguageDescription[] | ((info: string) => Language | LanguageDescription | null)

/**
 * Reported by `onTaskToggle` when a `preview` task-list checkbox is clicked.
 * `start`/`end` are raw offsets into `value` bracketing the `[ ]` / `[x]`
 * marker itself (`end - start === 3`); splice in the new marker text to apply
 * the toggle: `value.slice(0, start) + (checked ? "[x]" : "[ ]") +
 * value.slice(end)`. `checked` is the box's new state, not its state before
 * the click.
 */
export interface TaskToggleInfo {
  /** Offset of the marker's opening `[` in `value`. */
  start: number
  /** Offset just past the marker's closing `]` in `value`. */
  end: number
  /** The checkbox's new state. */
  checked: boolean
}

export interface StyloProps {
  /** The canonical Markdown document. Stylo never holds a parsed model of it. */
  value: string
  /** Called with the complete Markdown string on every edit. */
  onChange: (next: string) => void
  /**
   * Interaction layout. Defaults to `"in-place"` — the live decoration canvas.
   * `"source"` is the plain surface and avoids loading the render chunk.
   */
  mode?: StyloMode
  /**
   * Called with the full Markdown string when `Mod-s` is pressed on any editing
   * surface; the browser's own save dialog is then suppressed. Omit it and
   * `Mod-s` keeps its default browser behaviour. Stylo holds no dirty state —
   * `value` is yours, so compare it against your last-saved copy.
   */
  onSave?: (value: string) => void
  /**
   * Called on mount and whenever the leading `---` YAML block changes, with its
   * inner text (no fences), or `null` when there is no block. Stylo does not
   * parse it — pass `raw` to your own YAML parser for a structured panel. The
   * same split is available synchronously as the exported `splitFrontmatter`.
   */
  onFrontmatter?: (raw: string | null) => void
  /** Invoked when a `[[wikilink]]` is activated in the preview or in-place canvas. */
  onWikiLinkClick?: (target: string) => void
  /**
   * Invoked by the in-place link editor's "Open link" action with the link's
   * `href`. Stylo does not navigate on its own.
   */
  onLinkClick?: (href: string) => void
  /** Configures the in-place canvas (ADR-005). Applied when it mounts. */
  inPlace?: InPlaceConfig
  /**
   * How `preview` (and `split`'s preview pane) shows the leading `---` YAML
   * block. `"hidden"` (default) drops it; `"code"` renders it as a styled
   * `<pre class="stylo-frontmatter">`.
   */
  frontmatter?: FrontmatterDisplay
  /**
   * Turn a single line ending into a real `<br>` in `preview` (and `split`'s
   * preview pane), instead of CommonMark's default — a blank line required to
   * start a new paragraph, so consecutive lines join into one run. Obsidian's
   * Live Preview reads this way. Off by default: a real, visible change to
   * every existing render, so a host opts in deliberately rather than
   * inheriting it. No effect on `in-place` / `source` — CodeMirror already
   * decorates each source line independently there.
   */
  softBreaks?: boolean
  /**
   * Makes `preview` (and `split`'s preview pane) task-list checkboxes
   * clickable instead of `disabled`. Fired with a {@link TaskToggleInfo} — raw
   * offsets into `value` bracketing the clicked `[ ]` / `[x]` marker, and its
   * new state. Stylo never mutates `value` itself; splice the marker and pass
   * the result to `onChange`, same division of labour as `onWikiLinkClick`.
   * Off by default: every checkbox stays `disabled`, exactly like today,
   * until a host opts in.
   */
  onTaskToggle?: (info: TaskToggleInfo) => void
  /**
   * Grammars for fenced-code sub-highlighting on the CodeMirror surfaces
   * (`source`, `split`, `in-place`). None by default. Read once, at mount.
   */
  codeLanguages?: CodeLanguages
  /**
   * Enables `[[wikilink]]` autocomplete on the CodeMirror surfaces. Called with
   * the target typed so far; return your index's matches, ordered. Off when
   * omitted. Read once, at mount. See `WikiLinkSource`.
   */
  wikiLinkSource?: WikiLinkSource
  /**
   * Enables `#tag` autocomplete on the CodeMirror surfaces. Called with the tag
   * typed so far; return your index's matches, ordered. Off when omitted. Read
   * once, at mount. See `TagSource`.
   */
  tagSource?: TagSource
  /**
   * Resolves `![[ref]]` embeds (transclusion) for `preview` and `split`. Called
   * with the raw reference; return a node to render in its place, or `null` to
   * leave it as literal text. May be async. Off when omitted. See
   * {@link EmbedSource}.
   */
  embedSource?: EmbedSource
  /**
   * Called when `embedSource`, `wikiLinkSource`, or `tagSource` throws or
   * returns a rejected promise. Purely for observation — logging, a toast — the
   * resolver still falls back (literal `![[ref]]` text, or no completions)
   * either way. A `null` return is a valid result, not an error, and does not
   * fire this. Reactive; see {@link ResolveErrorInfo}.
   */
  onResolveError?: (error: unknown, info: ResolveErrorInfo) => void
  /**
   * Formatting toolbar above the editing surface (`source`, `in-place`,
   * `split`; never `preview`). Omit or `true` for the default bar, `false` to
   * hide it, or an object to choose and order the buttons. See ADR-002 §2.
   */
  toolbar?: boolean | ToolbarConfig
  /**
   * Replace individual toolbar glyphs, keyed by command id. Any id left out
   * keeps its built-in inline-SVG icon — Stylo ships no icon dependency.
   */
  icons?: Partial<Record<ToolbarCommandId, ReactNode>>
  /** Render the source surface read-only. */
  readOnly?: boolean
  /** Placeholder text shown when the document is empty (source surface). */
  placeholder?: string
  /** Extra class on the root element, alongside the internal classes. */
  className?: string
  /**
   * CodeMirror extensions appended after Stylo's own, on every editing surface
   * (`source`, `in-place`, and `split`'s source pane). Reactive: a changed array
   * reconfigures the live view with no remount, so the cursor, undo history and
   * scroll position survive. Compared shallowly — pass a stable identity
   * (`useMemo`) when nothing changed. Ignored in `preview`, which has no editor.
   */
  extensions?: readonly Extension[]
  /**
   * Host content docked inside the editing surface (`source`, `in-place`,
   * `split`'s source pane; never `preview`) — after the find/replace panel,
   * before the document body. Unlike `toolbar.render`, which wraps content
   * *before* the whole canvas, this reaches the seam between CodeMirror's own
   * top panels and its scroller, so host chrome (e.g. a frontmatter card) can
   * sit under find/replace instead of always above it. `view` is `null` until
   * the surface has mounted. Read once, at mount.
   */
  canvasHeader?: (ctx: { view: EditorView | null }) => ReactNode
}

/**
 * Imperative handle exposed on a `ref` to `<Stylo>`. Every method but
 * `invalidateEmbed` is a no-op — returning `null` / `false` where it has a
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
}
