import { useEffect, useRef } from "react"
import { Annotation, Compartment, EditorState, type Extension, Prec } from "@codemirror/state"
import { EditorView, keymap } from "@codemirror/view"
import type { CodeLanguages, ResolveErrorInfo, TagSource, WikiLinkSource } from "../types"
import { baseExtensions, dynamicConfig } from "./extensions"
import { runSave } from "./save"

/** Marks doc changes that came from the `value` prop, so they don't echo back through `onChange`. */
const External = Annotation.define<boolean>()

export interface UseCodeMirrorOptions {
  value: string
  onChange: (next: string) => void
  readOnly?: boolean
  placeholder?: string
  /** Called with the doc string on `Mod-s`; suppresses the browser dialog when set. */
  onSave?: (value: string) => void
  /** Called with the `EditorView` once it is created, and with `null` on teardown. */
  onViewChange?: (view: EditorView | null) => void
  /**
   * Extra extensions merged in at construction (e.g. the in-place decoration
   * layer). Captured once — pass a stable, module-level array.
   */
  extensions?: Extension[]
  /**
   * Host-supplied extensions, appended after everything else. Unlike
   * `extensions`, reactive: a changed array (compared shallowly) reconfigures
   * the live view without a remount.
   */
  hostExtensions?: readonly Extension[]
  /** Fenced-code grammars, forwarded to the Markdown language. Read once. */
  codeLanguages?: CodeLanguages
  /** `[[wikilink]]` autocomplete source. Read once. */
  wikiLinkSource?: WikiLinkSource
  /** `#tag` autocomplete source. Read once. */
  tagSource?: TagSource
  /**
   * Notified when `wikiLinkSource` or `tagSource` rejects. Reached through a
   * stable wrapper.
   */
  onResolveError?: (error: unknown, info: ResolveErrorInfo) => void
}

/**
 * Owns a CodeMirror `EditorView` for the lifetime of the host element and keeps
 * it in sync with a controlled Markdown string. Returns a ref for the container.
 */
export function useCodeMirror({
  value,
  onChange,
  readOnly = false,
  placeholder,
  onSave,
  onViewChange,
  extensions,
  hostExtensions,
  codeLanguages,
  wikiLinkSource,
  tagSource,
  onResolveError,
}: UseCodeMirrorOptions) {
  const parent = useRef<HTMLDivElement | null>(null)
  const viewRef = useRef<EditorView | null>(null)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange
  // Every doc string this hook has itself emitted via `onChange`, oldest
  // first, capped so it can't grow unbounded. Two keystrokes typed in quick
  // succession can each fire `onChange` (V1, then V2) before the host's
  // matching `value` prop updates have both round-tripped back through a
  // render — the effect below would otherwise see the *live* doc already at
  // V2 while still reconciling the stale V1 prop, and force-overwrite the
  // document back to V1, discarding the second keystroke. A value found here
  // is one we said ourselves, so whatever the live document holds now already
  // accounts for it (or a newer edit) — skip re-applying it.
  const selfEmitted = useRef<string[]>([])
  const onSaveRef = useRef(onSave)
  onSaveRef.current = onSave
  // Stable wrapper: the facet holds this, it reads the latest handler. The
  // compartment only reconfigures when the handler's *presence* flips.
  const saveFn = useRef((value: string) => onSaveRef.current?.(value)).current
  const onResolveErrorRef = useRef(onResolveError)
  onResolveErrorRef.current = onResolveError
  // Stable wrapper captured once by the completion source at construction.
  const resolveErrorFn = useRef((error: unknown, info: ResolveErrorInfo) => {
    onResolveErrorRef.current?.(error, info)
  }).current
  const hasSave = onSave != null
  const onViewChangeRef = useRef(onViewChange)
  onViewChangeRef.current = onViewChange
  const dynamic = useRef(new Compartment())
  const host = useRef(new Compartment())
  // The array last handed to `host`, so a re-render with an equal one is a no-op.
  const appliedHost = useRef(hostExtensions)

  // Create the view once. `value` / `readOnly` / `placeholder` are reconciled by
  // the effects below; constructing here (not during render) keeps this SSR-safe.
  useEffect(() => {
    const el = parent.current
    if (!el) return

    const view = new EditorView({
      parent: el,
      state: EditorState.create({
        doc: value,
        extensions: [
          baseExtensions(codeLanguages, wikiLinkSource, resolveErrorFn, tagSource),
          dynamic.current.of(
            dynamicConfig({ readOnly, placeholder, save: hasSave ? saveFn : undefined }),
          ),
          Prec.high(keymap.of([{ key: "Mod-s", run: runSave }])),
          ...(extensions ?? []),
          host.current.of(hostExtensions ?? []),
          EditorView.updateListener.of((update) => {
            if (!update.docChanged) return
            if (update.transactions.some((t) => Boolean(t.annotation(External)))) return
            const text = update.state.doc.toString()
            selfEmitted.current.push(text)
            if (selfEmitted.current.length > 20) selfEmitted.current.shift()
            onChangeRef.current(text)
          }),
        ],
      }),
    })
    viewRef.current = view
    onViewChangeRef.current?.(view)

    return () => {
      onViewChangeRef.current?.(null)
      view.destroy()
      viewRef.current = null
    }
  }, [])

  // Push external `value` changes into the document without triggering `onChange`.
  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    const current = view.state.doc.toString()
    if (current === value) return
    // A prop update that merely echoes something this hook already emitted
    // (see `selfEmitted` above) carries no new information — the live
    // document already reflects it, or a newer local edit since, either way
    // correctly. Only a value we never said ourselves is a genuine external
    // change (a host loading a different document, say) worth applying.
    if (selfEmitted.current.includes(value)) return
    view.dispatch({
      changes: { from: 0, to: current.length, insert: value },
      annotations: External.of(true),
    })
    selfEmitted.current = []
  }, [value])

  // Reconfigure prop-driven extensions in place.
  useEffect(() => {
    viewRef.current?.dispatch({
      effects: dynamic.current.reconfigure(
        dynamicConfig({ readOnly, placeholder, save: hasSave ? saveFn : undefined }),
      ),
    })
  }, [readOnly, placeholder, hasSave, saveFn])

  // Reconfigure host extensions in place; the view, its selection, history and
  // scroll are untouched.
  useEffect(() => {
    const prev = appliedHost.current
    if (prev === hostExtensions) return
    if (
      prev &&
      hostExtensions &&
      prev.length === hostExtensions.length &&
      prev.every((ext, i) => ext === hostExtensions[i])
    )
      return
    appliedHost.current = hostExtensions
    viewRef.current?.dispatch({ effects: host.current.reconfigure(hostExtensions ?? []) })
  }, [hostExtensions])

  return parent
}
