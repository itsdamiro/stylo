---
title: "Auto-save"
created: 2026-09-04
type: wiki-guides
parent: index
tags:
  - stylo/wiki
  - engineering/standard
---

# Auto-save

Stylo has **no `autoSave` prop**, by design. Persistence is a policy — how often to write, on a timer or on blur, how to reconcile conflicts, what to do offline — and that belongs to the application, not a text-editing component. CodeMirror, Monaco, TipTap, and Lexical all take the same line: they expose the change stream and stop there. Auto-save in VS Code, Notion, and Google Docs lives in the app layer.

Stylo gives you two hooks to build on:

- **`onChange(value)`** — every edit, synchronously. This is the stream you debounce.
- **`onSave(value)`** — `Cmd/Ctrl+S`, and the opt-in [`save` toolbar item](../reference/toolbar.md). Wire it to the same "save now" path so a manual save and an auto-save share one code path.

## A `useAutosave` hook

Debounced, skips a save when nothing changed since the last one, flushes on tab hide / navigation / unmount (the case that otherwise loses the last second of typing), and reports status.

```tsx
import { useEffect, useRef, useState } from "react"

type Status = "idle" | "saving" | "saved" | "error"

export function useAutosave(
  value: string,
  save: (value: string) => void | Promise<void>,
  { delay = 800 }: { delay?: number } = {},
) {
  const [status, setStatus] = useState<Status>("idle")
  const savedValue = useRef(value) // last value persisted
  const latest = useRef(value) // most recent value seen
  latest.current = value
  const saveRef = useRef(save)
  saveRef.current = save

  // One stable flush function for the timer, the event listeners, and `saveNow`.
  const flush = useRef(async () => {
    if (latest.current === savedValue.current) return
    const pending = latest.current
    setStatus("saving")
    try {
      await saveRef.current(pending)
      savedValue.current = pending
      setStatus("saved")
    } catch {
      setStatus("error")
    }
  }).current

  // Debounce: restart the timer on every change; save `delay` ms after the
  // last one. No save on mount — `value` still equals `savedValue`.
  useEffect(() => {
    if (value === savedValue.current) return
    const id = setTimeout(flush, delay)
    return () => clearTimeout(id)
  }, [value, delay, flush])

  // Data-loss guard: flush when the tab is hidden, on navigation, and on unmount.
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden") void flush()
    }
    document.addEventListener("visibilitychange", onHide)
    window.addEventListener("pagehide", flush)
    return () => {
      document.removeEventListener("visibilitychange", onHide)
      window.removeEventListener("pagehide", flush)
      void flush()
    }
  }, [flush])

  return { status, saveNow: flush }
}
```

### Wiring it

```tsx
function Editor() {
  const [doc, setDoc] = useState(initial)
  const { status, saveNow } = useAutosave(doc, (md) => api.put("/note", md))

  return (
    <>
      <Stylo value={doc} onChange={setDoc} onSave={() => saveNow()} />
      <span>{status === "saving" ? "Saving…" : status === "saved" ? "Saved" : ""}</span>
    </>
  )
}
```

`onSave={() => saveNow()}` makes `Cmd/Ctrl+S` (and the `save` toolbar button) flush immediately instead of waiting out the debounce.

## Variations

- **Save on blur only.** Drop the timer; call `flush` from the `visibilitychange` / `pagehide` listeners plus the editor's blur. Fewer writes, and nothing is lost as long as the tab closes cleanly.
- **Fixed interval.** `setInterval(flush, 30_000)` — the Google Docs model. Simple, predictable, less responsive.
- **Debounce + interval ceiling.** Debounce for responsiveness, but force a flush at least every N seconds so a user who never pauses still gets saved.

## Conflict detection is not built in

`useAutosave` above is last-write-wins: nothing here notices if the same document was written from somewhere else — another tab, another device, a backend process — between the load and this save. Stylo has no version or timestamp attached to `value`, so it cannot know either.

If that risk is real for a given host, the shape that fits without any change to Stylo's API is a version stamp kept alongside the persisted content — whatever the store already offers: an `updatedAt`, an ETag, a monotonic revision. Capture it when `value` is loaded, and check it again in the `save` function passed to `useAutosave` (or right before an `onSave` write) against the store's current stamp. A mismatch means the note moved underneath this session; how to resolve it — warn and overwrite anyway, block the save and prompt to reload, attempt a merge — is a product decision, same as every other policy in this guide. `value` / `onChange` / `onSave` already give a host everything it needs to intercept a save and act on that before it happens.

## Gotchas

- **Don't feed the debounced value back into `value`.** `value` stays driven by `onChange`; the hook only reads it.
- **Handle the async rejection.** A failed save should surface (`status: "error"`) and ideally retry — never swallow it silently.
- **React StrictMode** mounts effects twice in development; the hook is idempotent (the mount flush is a no-op because nothing changed), so this is safe, but expect the paired console noise.
