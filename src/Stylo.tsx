import { forwardRef, Suspense, useEffect, useImperativeHandle, useRef, useState } from "react"
import { EditorView } from "@codemirror/view"
import { SourceView } from "./editor/SourceView"
import { LazyInPlaceView } from "./inplace/lazyInPlace"
import { LazyPreview } from "./render/lazyPreview"
import { SplitView } from "./SplitView"
import styles from "./styles/stylo.module.css"
import { Toolbar } from "./toolbar/Toolbar"
import { resolveToolbarItems } from "./toolbar/config"
import { splitFrontmatter } from "./frontmatter"
import { invalidateEmbed } from "./render/embed-cache"
import "./styles/tokens.css"
import type { ResolveErrorInfo, StyloHandle, StyloProps } from "./types"

/**
 * Plain-text-first Markdown editor. `value` is the canonical Markdown string;
 * every view is a pure function of it.
 *
 * The default `mode` is `in-place`, the live decoration canvas (ADR-002 §1,
 * ADR-004). Pass `mode="source"` for the plain surface with no lazy render
 * chunk. `preview` and `split` are also available.
 *
 * A formatting `toolbar` sits above every editing surface (all modes but
 * `preview`); pass `toolbar={false}` to drop it or a `ToolbarConfig` to trim it.
 */
export const Stylo = forwardRef<StyloHandle, StyloProps>(function Stylo(
  {
    value,
    onChange,
    mode = "in-place",
    onSave,
    onFrontmatter,
    onWikiLinkClick,
    onLinkClick,
    readOnly,
    placeholder,
    className,
    inPlace,
    codeLanguages,
    wikiLinkSource,
    tagSource,
    embedSource,
    onResolveError,
    toolbar,
    icons,
    frontmatter,
    softBreaks,
    onTaskToggle,
    canvasHeader,
  },
  ref,
) {
  const resolved = mode === "preview" || mode === "split" || mode === "in-place" ? mode : "source"

  const [view, setView] = useState<EditorView | null>(null)
  const toolbarItems = resolved === "preview" ? null : resolveToolbarItems(toolbar)
  const toolbarConfig = toolbar && typeof toolbar === "object" ? toolbar : undefined
  const toolbarRender = toolbarConfig?.render
  const stickyToolbar: "top" | "bottom" | false =
    toolbarConfig?.sticky === "top" ? "top" : toolbarConfig?.sticky ? "bottom" : false
  const stickyVisibility = toolbarConfig?.stickyVisibility

  // Report the raw frontmatter block on mount and whenever it changes. Stylo
  // does not parse it — the host passes `raw` to its own YAML parser.
  const onFrontmatterRef = useRef(onFrontmatter)
  onFrontmatterRef.current = onFrontmatter

  // Stable wrapper so a changed `onResolveError` needs no editor rebuild and
  // does not thrash the embed effect. Passed to every surface.
  const onResolveErrorRef = useRef(onResolveError)
  onResolveErrorRef.current = onResolveError
  const resolveError = useRef((error: unknown, info: ResolveErrorInfo) => {
    onResolveErrorRef.current?.(error, info)
  }).current

  // Read by `invalidateEmbed` below — kept current without needing the
  // imperative handle itself to be rebuilt when `embedSource` changes.
  const embedSourceRef = useRef(embedSource)
  embedSourceRef.current = embedSource
  const lastFrontmatter = useRef<string | null | undefined>(undefined)
  useEffect(() => {
    const raw = splitFrontmatter(value)?.frontmatter ?? null
    if (raw === lastFrontmatter.current) return
    lastFrontmatter.current = raw
    onFrontmatterRef.current?.(raw)
  }, [value])

  useImperativeHandle(
    ref,
    () => ({
      focus: () => view?.focus(),
      getView: () => view,
      insertAtCursor: (md) => {
        if (!view) return
        view.dispatch(view.state.replaceSelection(md))
        view.focus()
      },
      scrollToHeading: (text) => {
        if (!view) return false
        const target = text.trim().toLowerCase()
        const { doc } = view.state
        for (let n = 1; n <= doc.lines; n++) {
          const line = doc.line(n)
          const m = /^ {0,3}#{1,6}[ \t]+(.*?)(?:[ \t]+#+)?[ \t]*$/.exec(line.text)
          if (!m || m[1] === undefined) continue
          if (m[1].trim().toLowerCase() !== target) continue
          view.dispatch({
            selection: { anchor: line.from },
            effects: EditorView.scrollIntoView(line.from, { y: "start" }),
          })
          view.focus()
          return true
        }
        return false
      },
      invalidateEmbed: (ref) => {
        const source = embedSourceRef.current
        if (source) invalidateEmbed(source, ref)
      },
    }),
    [view],
  )

  const rootClass = [
    styles.root,
    stickyToolbar === "bottom" && styles.stickyToolbarRootBottom,
    stickyToolbar === "top" && styles.stickyToolbarRootTop,
    "stylo",
    className,
  ]
    .filter(Boolean)
    .join(" ")

  return (
    <div className={rootClass} data-stylo-mode={resolved}>
      {toolbarItems &&
        (() => {
          const bar = (
            <Toolbar
              view={view}
              items={toolbarItems}
              icons={icons}
              disabled={readOnly}
              sticky={stickyToolbar}
              stickyVisibility={stickyVisibility}
            />
          )
          return toolbarRender ? toolbarRender(bar, { view }) : bar
        })()}

      {resolved === "source" && (
        <SourceView
          value={value}
          onChange={onChange}
          readOnly={readOnly}
          placeholder={placeholder}
          codeLanguages={codeLanguages}
          wikiLinkSource={wikiLinkSource}
          tagSource={tagSource}
          onResolveError={resolveError}
          onSave={onSave}
          onViewChange={setView}
          canvasHeader={canvasHeader}
        />
      )}

      {resolved === "preview" && (
        <Suspense fallback={<div className={styles.preview} aria-busy="true" />}>
          <LazyPreview
            value={value}
            onWikiLinkClick={onWikiLinkClick}
            embedSource={embedSource}
            onResolveError={resolveError}
            frontmatter={frontmatter}
            codeLanguages={codeLanguages}
            softBreaks={softBreaks}
            onTaskToggle={onTaskToggle}
          />
        </Suspense>
      )}

      {resolved === "split" && (
        <SplitView
          value={value}
          onChange={onChange}
          onWikiLinkClick={onWikiLinkClick}
          readOnly={readOnly}
          placeholder={placeholder}
          codeLanguages={codeLanguages}
          wikiLinkSource={wikiLinkSource}
          tagSource={tagSource}
          embedSource={embedSource}
          onResolveError={resolveError}
          frontmatter={frontmatter}
          softBreaks={softBreaks}
          onTaskToggle={onTaskToggle}
          onSave={onSave}
          onViewChange={setView}
          canvasHeader={canvasHeader}
        />
      )}

      {resolved === "in-place" && (
        <Suspense fallback={<div className={styles.inplace} aria-busy="true" />}>
          <LazyInPlaceView
            value={value}
            onChange={onChange}
            readOnly={readOnly}
            placeholder={placeholder}
            onWikiLinkClick={onWikiLinkClick}
            onLinkClick={onLinkClick}
            inPlace={inPlace}
            codeLanguages={codeLanguages}
            wikiLinkSource={wikiLinkSource}
            tagSource={tagSource}
            embedSource={embedSource}
            onResolveError={resolveError}
            onSave={onSave}
            onViewChange={setView}
            canvasHeader={canvasHeader}
          />
        </Suspense>
      )}
    </div>
  )
})

Stylo.displayName = "Stylo"
