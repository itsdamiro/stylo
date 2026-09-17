import { useMemo, useRef } from "react"
import Markdown from "react-markdown"
import rehypeKatex from "rehype-katex"
import remarkBreaks from "remark-breaks"
import remarkFrontmatter from "remark-frontmatter"
import remarkGfm from "remark-gfm"
import remarkMath from "remark-math"
import { splitFrontmatter } from "../frontmatter"
import styles from "../styles/stylo.module.css"
import type {
  CodeLanguages,
  EmbedSource,
  FrontmatterDisplay,
  ResolveErrorInfo,
  TaskToggleInfo,
} from "../types"
import { buildPreviewComponents } from "./preview-components"
import { remarkCallout } from "./remark-callout"
import { remarkEmbed } from "./remark-embed"
import { remarkWikilink } from "./remark-wikilink"

const REHYPE_PLUGINS = [rehypeKatex]

export interface PreviewProps {
  value: string
  onWikiLinkClick?: (target: string) => void
  /** Resolves `![[ref]]` embeds. Omit and `![[…]]` stays literal. */
  embedSource?: EmbedSource
  /** Notified when `embedSource` rejects; the literal fallback still renders. */
  onResolveError?: (error: unknown, info: ResolveErrorInfo) => void
  /** `"code"` renders the `---` block as a styled `<pre>`; `"hidden"` (default) drops it. */
  frontmatter?: FrontmatterDisplay
  /**
   * Grammars for fenced-code syntax highlighting, matching the CodeMirror
   * surfaces' `codeLanguages` prop exactly (same resolution rules, same
   * `--stylo-syntax-*` colours). Omit and fenced code renders as plain,
   * un-highlighted text — today's behaviour.
   */
  codeLanguages?: CodeLanguages
  /**
   * Turn a single line ending into a real line break (`<br>`) instead of
   * CommonMark's default — a blank line required to start a new paragraph,
   * otherwise consecutive lines join into one run. Obsidian's Live Preview
   * reads this way. Off by default: every existing `preview` render keeps
   * today's paragraph-joining behaviour unless a host opts in. Has no effect
   * on `in-place` / `source` — CodeMirror already decorates each source line
   * independently there.
   */
  softBreaks?: boolean
  /**
   * Makes task-list checkboxes clickable instead of `disabled`. Fired with
   * raw `value` offsets bracketing the clicked marker and its new state; the
   * host owns splicing `value` and calling its own `onChange`. Off by
   * default — every checkbox stays `disabled`, today's behaviour, until a
   * host opts in.
   */
  onTaskToggle?: (info: TaskToggleInfo) => void
}

/** Rendered Markdown + KaTeX view. A pure function of the string. */
export function Preview({
  value,
  onWikiLinkClick,
  embedSource,
  onResolveError,
  frontmatter = "hidden",
  codeLanguages,
  softBreaks,
  onTaskToggle,
}: PreviewProps) {
  const fm = frontmatter === "code" ? splitFrontmatter(value) : null

  // `remarkEmbed` must precede `remarkWikilink` (it consumes the `![[…]]` before
  // the inner `[[…]]` is rewritten) and is only in the pipeline when the host
  // opts in, so a bare `![[x]]` renders unchanged otherwise.
  const remarkPlugins = useMemo(
    () => [
      remarkFrontmatter,
      remarkGfm,
      remarkMath,
      ...(softBreaks ? [remarkBreaks] : []),
      ...(embedSource ? [remarkEmbed] : []),
      remarkWikilink,
      remarkCallout,
    ],
    [embedSource, softBreaks],
  )

  // `value` changes on every keystroke, so it's read through a ref rather than
  // closed over directly — otherwise memoizing `components` on it would be
  // pointless, defeating the point of memoizing at all (a changed component
  // identity at the same tree position makes react-markdown remount it, which
  // is exactly what stable identities here are meant to avoid for `CodeBlock`
  // and `Embed`).
  const valueRef = useRef(value)
  valueRef.current = value

  const components = useMemo(
    () =>
      buildPreviewComponents({
        valueRef,
        onWikiLinkClick,
        embedSource,
        onResolveError,
        codeLanguages,
        onTaskToggle,
      }),
    [onWikiLinkClick, embedSource, onResolveError, codeLanguages, onTaskToggle],
  )

  return (
    <div className={styles.preview}>
      {fm && <div className="stylo-frontmatter">{fm.frontmatter}</div>}
      <Markdown
        remarkPlugins={remarkPlugins}
        rehypePlugins={REHYPE_PLUGINS}
        components={components}
      >
        {value}
      </Markdown>
    </div>
  )
}
