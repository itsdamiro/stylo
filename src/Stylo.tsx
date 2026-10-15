import { forwardRef, Suspense, useEffect, useRef, useState } from "react"
import { EditorView } from "@codemirror/view"
import { SourceView } from "./editor/SourceView"
import { LazyInPlaceView } from "./inplace/lazyInPlace"
import { LazyPreview } from "./render/lazyPreview"
import { SplitView } from "./SplitView"
import styles from "./styles/stylo.module.css"
import { StyloToolbar, stickyEdge } from "./toolbar/StyloToolbar"
import { splitFrontmatter } from "./frontmatter"
import { useStyloHandle } from "./useStyloHandle"
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
    imageSource,
    imageWidth = "column",
    imageAlign = "left",
    onResolveError,
    toolbar,
    icons,
    frontmatter,
    softBreaks,
    onTaskToggle,
    canvasHeader,
    extensions,
  },
  ref,
) {
  const resolved = mode === "preview" || mode === "split" || mode === "in-place" ? mode : "source"

  const [view, setView] = useState<EditorView | null>(null)
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

  const lastFrontmatter = useRef<string | null | undefined>(undefined)
  useEffect(() => {
    const raw = splitFrontmatter(value)?.frontmatter ?? null
    if (raw === lastFrontmatter.current) return
    lastFrontmatter.current = raw
    onFrontmatterRef.current?.(raw)
  }, [value])

  useStyloHandle(ref, view, { embedSource, imageSource })

  const sticky = stickyEdge(toolbar)
  const rootClass = [
    styles.root,
    sticky === "bottom" && styles.stickyToolbarRootBottom,
    sticky === "top" && styles.stickyToolbarRootTop,
    "stylo",
    className,
  ]
    .filter(Boolean)
    .join(" ")

  return (
    <div
      className={rootClass}
      data-stylo-mode={resolved}
      data-stylo-image-width={imageWidth}
      data-stylo-image-align={imageAlign}
    >
      <StyloToolbar
        view={view}
        toolbar={toolbar}
        icons={icons}
        readOnly={readOnly}
        hidden={resolved === "preview"}
      />

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
          hostExtensions={extensions}
        />
      )}

      {resolved === "preview" && (
        <Suspense fallback={<div className={styles.preview} aria-busy="true" />}>
          <LazyPreview
            value={value}
            onWikiLinkClick={onWikiLinkClick}
            embedSource={embedSource}
            imageSource={imageSource}
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
          imageSource={imageSource}
          onResolveError={resolveError}
          frontmatter={frontmatter}
          softBreaks={softBreaks}
          onTaskToggle={onTaskToggle}
          onSave={onSave}
          onViewChange={setView}
          canvasHeader={canvasHeader}
          hostExtensions={extensions}
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
            imageSource={imageSource}
            onResolveError={resolveError}
            onSave={onSave}
            onViewChange={setView}
            canvasHeader={canvasHeader}
            hostExtensions={extensions}
          />
        </Suspense>
      )}
    </div>
  )
})

Stylo.displayName = "Stylo"
