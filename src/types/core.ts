import type { ReactNode } from "react"
import type { Extension } from "@codemirror/state"
import type { EditorView } from "@codemirror/view"
import type {
  EmbedSource,
  ImageSource,
  ResolveErrorInfo,
  TagSource,
  WikiLinkSource,
} from "./sources"
import type { InPlaceConfig } from "./inplace"
import type { ToolbarCommandId, ToolbarConfig } from "./toolbar"
import type { CodeLanguages, FrontmatterDisplay, StyloMode, TaskToggleInfo } from "./display"

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
   * Resolves a Markdown image, `![alt](src)`, for `preview`, `split` and the
   * in-place canvas: alone on its line or in a sentence, list item or quote
   * (phrasing content for those); a table cell on `preview` and `split` only.
   * Called with `src` and `alt` as written, before any URL filtering; return a
   * node, or `null` to keep the source. May be async. Off when omitted. Read once,
   * at mount, on the canvas. See {@link ImageSource}.
   */
  imageSource?: ImageSource
  /**
   * `"wide"` lets a picture alone on its line spill past the column toward the side
   * `imageAlign` leaves open, to the editor's edge less 1rem (canvas only; centred
   * column assumed for `"center"` and `"right"`). Default `"column"`. Reactive.
   */
  imageWidth?: "column" | "wide"
  /** Where a picture alone on its line sits when narrower than the column. Reactive. */
  imageAlign?: "left" | "center" | "right"
  /**
   * Called when `embedSource`, `imageSource`, `wikiLinkSource`, or `tagSource` throws or
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
