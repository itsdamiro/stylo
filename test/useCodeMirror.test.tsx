import { afterEach, expect, test, vi } from "vitest"
import { cleanup, render } from "@testing-library/react"
import { EditorView } from "@codemirror/view"
import { useCodeMirror, type UseCodeMirrorOptions } from "../src/editor/useCodeMirror"

afterEach(cleanup)

function Harness(props: UseCodeMirrorOptions) {
  const ref = useCodeMirror(props)
  return <div data-testid="host" ref={ref} />
}

function viewIn(container: HTMLElement): EditorView {
  const dom = container.querySelector<HTMLElement>(".cm-editor")
  const view = dom && EditorView.findFromDOM(dom)
  if (!view) throw new Error("EditorView not mounted")
  return view
}

test("a local edit calls onChange with the full document", () => {
  const onChange = vi.fn()
  const { container } = render(<Harness value="hello" onChange={onChange} />)
  const view = viewIn(container)

  view.dispatch({ changes: { from: view.state.doc.length, insert: " world" } })

  expect(onChange).toHaveBeenCalledWith("hello world")
})

test("an external value change updates the doc without calling onChange", () => {
  const onChange = vi.fn()
  const { container, rerender } = render(<Harness value="one" onChange={onChange} />)

  rerender(<Harness value="two" onChange={onChange} />)

  expect(viewIn(container).state.doc.toString()).toBe("two")
  expect(onChange).not.toHaveBeenCalled()
})

test("a stale value prop, superseded by a newer local edit before it arrives, is not re-applied", () => {
  const onChange = vi.fn()
  const { container, rerender } = render(<Harness value="a" onChange={onChange} />)
  const view = viewIn(container)

  // Keystroke 1: "a" -> "ab", firing onChange("ab") — as if the host's
  // setValue("ab") is in flight but hasn't reached us as a new `value` prop
  // yet (a heavy synchronous task elsewhere, e.g. a preview re-render off the
  // same edit, is enough of a real-world delay to open this window).
  view.dispatch({ changes: { from: 1, insert: "b" } })
  // Keystroke 2 lands before that prop update arrives: "ab" -> "abc". Two
  // edits have now happened locally, but only the first has been told to the
  // host so far.
  view.dispatch({ changes: { from: 2, insert: "c" } })

  // The host's re-render for the *first* onChange call now finally lands,
  // handing back "ab" — one keystroke behind what the live document holds.
  rerender(<Harness value="ab" onChange={onChange} />)

  expect(view.state.doc.toString()).toBe("abc")
})

test("readOnly makes the surface non-editable", () => {
  const onChange = vi.fn()
  const { container } = render(<Harness value="x" onChange={onChange} readOnly />)
  const view = viewIn(container)

  expect(view.state.readOnly).toBe(true)
  expect(view.contentDOM.getAttribute("contenteditable")).toBe("false")
})
