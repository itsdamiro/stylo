import { useRef, useState, useSyncExternalStore } from "react"
import type { ReactNode } from "react"
import { createPortal } from "react-dom"
import { showPanel } from "@codemirror/view"
import type { Extension } from "@codemirror/state"
import type { EditorView } from "@codemirror/view"
import styles from "../styles/stylo.module.css"
import type { CodeLanguages, ResolveErrorInfo, TagSource, WikiLinkSource } from "../types"
import { CanvasHeaderHost } from "./canvas-header-panel"
import { useCodeMirror } from "./useCodeMirror"

const noopSubscribe = () => () => {}
const noopSnapshot = () => null

export interface SourceViewProps {
  value: string
  onChange: (next: string) => void
  readOnly?: boolean
  placeholder?: string
  /** Fenced-code grammars, forwarded to the Markdown language. Read once. */
  codeLanguages?: CodeLanguages
  /** `[[wikilink]]` autocomplete source. Read once. */
  wikiLinkSource?: WikiLinkSource
  /** `#tag` autocomplete source. Read once. */
  tagSource?: TagSource
  /** Notified when `wikiLinkSource` or `tagSource` rejects. */
  onResolveError?: (error: unknown, info: ResolveErrorInfo) => void
  /** Called with the doc string on `Mod-s`. */
  onSave?: (value: string) => void
  /** Called with the `EditorView` once created, and with `null` on teardown. */
  onViewChange?: (view: EditorView | null) => void
  /** Host CodeMirror extensions, reconfigured in place when the array changes. */
  hostExtensions?: readonly Extension[]
  /** Host content docked after the search panel, before the document. Read once. */
  canvasHeader?: (ctx: { view: EditorView | null }) => ReactNode
}

/** Raw CodeMirror 6 Markdown surface bound to the canonical string. */
export function SourceView({
  value,
  onChange,
  readOnly,
  placeholder,
  codeLanguages,
  wikiLinkSource,
  tagSource,
  onResolveError,
  onSave,
  onViewChange,
  canvasHeader,
  hostExtensions,
}: SourceViewProps) {
  const [editorView, setEditorView] = useState<EditorView | null>(null)
  const onViewChangeRef = useRef(onViewChange)
  onViewChangeRef.current = onViewChange
  const handleViewChange = useRef((view: EditorView | null) => {
    setEditorView(view)
    onViewChangeRef.current?.(view)
  }).current

  // `canvasHeader` itself is read through a ref (a changed render prop needs
  // no editor rebuild); whether it was passed at all is read once, at mount,
  // to decide whether the panel extension exists at all.
  const canvasHeaderRef = useRef(canvasHeader)
  canvasHeaderRef.current = canvasHeader
  const [headerHost] = useState(() => (canvasHeader ? new CanvasHeaderHost() : null))
  const headerDom = useSyncExternalStore(
    headerHost?.subscribe ?? noopSubscribe,
    headerHost?.getSnapshot ?? noopSnapshot,
  )
  const [extensions] = useState(() => (headerHost ? [showPanel.of(headerHost.panel)] : []))

  const ref = useCodeMirror({
    value,
    onChange,
    readOnly,
    placeholder,
    codeLanguages,
    wikiLinkSource,
    tagSource,
    onResolveError,
    onSave,
    onViewChange: handleViewChange,
    hostExtensions,
    extensions,
  })
  return (
    <div className={styles.source} ref={ref}>
      {headerDom &&
        canvasHeaderRef.current &&
        createPortal(canvasHeaderRef.current({ view: editorView }), headerDom)}
    </div>
  )
}
