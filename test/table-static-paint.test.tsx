import { afterEach, expect, test, vi } from "vitest"
import { cleanup, render } from "@testing-library/react"
import { EditorView } from "@codemirror/view"
import { Stylo } from "../src/Stylo"
import type { CellMark, CellWidget } from "../src/types"

afterEach(cleanup)

// A paragraph first: with the caret at 0 a table-only document reveals its source.
const T = "intro\n\n| A | B |\n| - | - |\n| one | **two** |"
const TWO = T.indexOf("two")

async function mount(
  marks: () => CellMark[],
  widgets: () => CellWidget[],
  extra: { readOnly?: boolean } = {},
) {
  const result = render(
    <Stylo
      value={T}
      onChange={() => {}}
      mode="in-place"
      readOnly={extra.readOnly}
      inPlace={{ table: "source", cellMarks: marks, cellWidgets: widgets }}
    />,
  )
  const table = await vi.waitFor(() => {
    const el = result.container.querySelector<HTMLTableElement>("table.cm-inplace-table")
    if (!el) throw new Error("no table")
    return el
  })
  const view = EditorView.findFromDOM(result.container.querySelector(".cm-editor") as HTMLElement)!
  return { table, view }
}

const button = (label = "Accept"): CellWidget => ({
  pos: TWO + 3,
  key: label,
  toDOM: () => Object.assign(document.createElement("button"), { textContent: label }),
  cellClass: "has-change",
})
const mark = (): CellMark => ({ from: TWO, to: TWO + 3, class: "hl" })

test("a mark and a widget are drawn on the rendered table of table: source", async () => {
  const { table } = await mount(
    () => [mark()],
    () => [button()],
  )
  expect(table.classList.contains("cm-inplace-table-edit")).toBe(false)
  const cell = table.querySelectorAll<HTMLTableCellElement>("tbody td")[1]!
  await vi.waitFor(() => expect(cell.querySelector(".hl")?.textContent).toBe("two"))
  expect(cell.querySelector("[data-stylo-cell-widget]")?.textContent).toBe("Accept")
  expect(cell.classList.contains("has-change")).toBe(true)
  // The element is not part of the cell's content, and the other cell is untouched.
  expect(table.querySelectorAll("[data-stylo-cell-widget]")).toHaveLength(1)
})

test("a read-only document is painted the same way", async () => {
  const { table } = await mount(
    () => [mark()],
    () => [button()],
    { readOnly: true },
  )
  await vi.waitFor(() => expect(table.querySelector(".hl")?.textContent).toBe("two"))
  expect(table.querySelector("[data-stylo-cell-widget]")).not.toBeNull()
})

test("a changed list repaints the static table without a document change", async () => {
  let widgets: CellWidget[] = []
  const { table, view } = await mount(
    () => [],
    () => widgets,
  )
  expect(table.querySelector("[data-stylo-cell-widget]")).toBeNull()
  widgets = [button("Accept")]
  view.dispatch({})
  await vi.waitFor(() => expect(table.querySelector("button")?.textContent).toBe("Accept"))
  widgets = [button("Review")]
  view.dispatch({})
  await vi.waitFor(() => expect(table.querySelector("button")?.textContent).toBe("Review"))
  widgets = []
  view.dispatch({})
  await vi.waitFor(() => expect(table.querySelector("[data-stylo-cell-widget]")).toBeNull())
})

test("a press on a host widget does not reach CodeMirror", async () => {
  const { table } = await mount(
    () => [],
    () => [button()],
  )
  await vi.waitFor(() => expect(table.querySelector("button")).not.toBeNull())
  const reached = vi.fn()
  table.parentElement!.addEventListener("mousedown", reached)
  const press = new MouseEvent("mousedown", { bubbles: true, cancelable: true })
  table.querySelector("button")!.dispatchEvent(press)
  expect(reached).not.toHaveBeenCalled()
  expect(press.defaultPrevented).toBe(true)
})
