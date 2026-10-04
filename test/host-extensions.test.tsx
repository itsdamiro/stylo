import { act } from "react"
import { afterEach, expect, test, vi } from "vitest"
import { cleanup, render, waitFor } from "@testing-library/react"
import { EditorView, Decoration, gutter, GutterMarker } from "@codemirror/view"
import type { Extension } from "@codemirror/state"
import { Stylo } from "../src/Stylo"
import type { StyloMode } from "../src/types"

afterEach(cleanup)

const mark = EditorView.decorations.of(
  Decoration.set([Decoration.mark({ class: "host-mark" }).range(0, 5)]),
)

class Dot extends GutterMarker {
  override toDOM() {
    return document.createTextNode("•")
  }
}
const dots = gutter({ class: "host-gutter", lineMarker: () => new Dot() })

const modes: StyloMode[] = ["source", "in-place", "split"]

for (const mode of modes) {
  test(`${mode}: host mark and gutter render, and a changed array keeps the selection`, async () => {
    const value = "hello world\n\nsecond line"
    const ui = (extensions: readonly Extension[]) => (
      <Stylo value={value} onChange={() => {}} mode={mode} extensions={extensions} />
    )
    const { container, rerender } = render(ui([mark, dots]))
    await waitFor(() => expect(container.querySelector(".cm-editor")).not.toBeNull())
    expect(container.querySelector(".host-mark")?.textContent).toBe("hello")
    expect(container.querySelector(".host-gutter")).not.toBeNull()

    const view = EditorView.findFromDOM(container.querySelector(".cm-editor") as HTMLElement)!
    act(() => view.dispatch({ selection: { anchor: 3, head: 8 } }))

    rerender(ui([dots]))
    expect(container.querySelector(".host-mark")).toBeNull()
    expect(container.querySelector(".host-gutter")).not.toBeNull()
    expect(view.state.selection.main.from).toBe(3)
    expect(view.state.selection.main.to).toBe(8)
  })
}

test("an equal array on re-render does not reconfigure the view", () => {
  const exts = [mark]
  const { container, rerender } = render(
    <Stylo value="hello" onChange={() => {}} mode="source" extensions={exts} />,
  )
  const view = EditorView.findFromDOM(container.querySelector(".cm-editor") as HTMLElement)!
  const dispatch = vi.spyOn(view, "dispatch")
  rerender(<Stylo value="hello" onChange={() => {}} mode="source" extensions={[mark]} />)
  expect(dispatch).not.toHaveBeenCalled()
})
