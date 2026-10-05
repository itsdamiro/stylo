import { afterEach, expect, test, vi } from "vitest"
import { cleanup, render } from "@testing-library/react"
import { EditorView } from "@codemirror/view"
import { Stylo } from "../src/Stylo"
import { renderInline } from "../src/inplace/inline-md"
import { placeCaret, selectionOffsets } from "../src/inplace/table-cell-dom"
import { applyPaint, cellPaint } from "../src/inplace/table-cell-marks"
import type { CellMark } from "../src/types"

afterEach(cleanup)

const mark = (from: number, to: number, extra: Partial<CellMark> = {}): CellMark => ({
  from,
  to,
  class: "hl",
  attributes: { "data-id": "1" },
  ...extra,
})

/** A cell painted from `raw` (rendered, or as one raw text node) with marks on `from`–`to` of it. */
function paint(raw: string, marks: CellMark[], focused = false) {
  const cell = document.createElement("td")
  cell.append(focused ? document.createTextNode(raw) : renderInline(raw.replace(/\\\|/g, "|")))
  const p = cellPaint(marks, 0, 0, raw.length)
  if (p) applyPaint(cell, raw, p, focused)
  return cell
}

const marked = (cell: HTMLElement) => [...cell.querySelectorAll(".hl")].map((e) => e.textContent)

test("cellPaint cuts marks to the cell and drops the ones outside it", () => {
  const p = cellPaint([mark(0, 3), mark(4, 8), mark(20, 30, { cellClass: "dot" })], 5, 1, 4)
  expect(p?.marks).toEqual([{ from: 1, to: 4, class: "hl", attributes: { "data-id": "1" } }])
  expect(p?.cellClass).toEqual([])
  expect(cellPaint([mark(0, 3)], 5, 0, 4)).toBeNull()
})

test("a mark wraps its characters in a raw cell, keeping the attributes", () => {
  const cell = paint("one two", [mark(4, 7)], true)
  expect(marked(cell)).toEqual(["two"])
  expect(cell.querySelector(".hl")!.getAttribute("data-id")).toBe("1")
  expect(cell.textContent).toBe("one two")
})

test("syntax characters are skipped in a rendered cell", () => {
  // raw `a **bold** c`: "bold" is raw 4–8
  const cell = paint("a **bold** c", [mark(4, 8)])
  expect(marked(cell)).toEqual(["bold"])
  expect(cell.textContent).toBe("a bold c")
})

test("a mark spanning rendered and plain text wraps each run", () => {
  const cell = paint("a **b** c", [mark(0, 7)])
  expect(marked(cell).join("")).toBe("a b")
})

test("an escaped pipe counts as one character", () => {
  // raw `a\|b c`: "b c" is raw 3–6
  const cell = paint("a\\|b c", [mark(3, 6)])
  expect(marked(cell)).toEqual(["b c"])
})

test("a mark on a link target marks the whole cell, not nothing", () => {
  // raw `[x](http://u) y`: the target is raw 4–12
  const cell = paint("[x](http://u) y", [mark(4, 12)])
  expect(marked(cell)).toEqual(["x y"])
})

test("math is stepped over without throwing off later marks", () => {
  const cell = paint("$x$ end", [mark(4, 7)])
  expect(marked(cell)).toEqual(["end"])
})

async function mountTable(
  marks: () => CellMark[],
  run?: (v: EditorView, i: { rect: DOMRect }) => void,
) {
  const T = "| A | B |\n| - | - |\n| one | **two** |"
  const result = render(
    <Stylo
      value={T}
      onChange={() => {}}
      mode="in-place"
      inPlace={{
        table: "cells",
        cellMarks: marks,
        contextMenu: { items: [{ id: "c", title: "C", run: run ?? (() => {}) }] },
      }}
    />,
  )
  const table = await vi.waitFor(() => {
    const el = result.container.querySelector<HTMLTableElement>("table.cm-inplace-table-edit")
    if (!el) throw new Error("no table")
    return el
  })
  const view = EditorView.findFromDOM(result.container.querySelector(".cm-editor") as HTMLElement)!
  return { table, view }
}

test("a host mark is drawn inside the cell, with its class on the cell", async () => {
  const T = "| A | B |\n| - | - |\n| one | **two** |"
  const at = T.indexOf("two")
  const { table } = await mountTable(() => [mark(at, at + 3, { cellClass: "has-comment" })])
  const cell = table.querySelectorAll<HTMLTableCellElement>("tbody td")[1]!
  await vi.waitFor(() => expect(marked(cell)).toEqual(["two"]))
  expect(cell.classList.contains("has-comment")).toBe(true)
  expect(table.querySelectorAll(".hl")).toHaveLength(1)
})

test("a host item run from a cell gets the selection's rect", async () => {
  const run = vi.fn()
  const { table, view } = await mountTable(() => [], run)
  const cell = table.querySelectorAll<HTMLTableCellElement>("tbody td")[0]!
  cell.dispatchEvent(
    new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: 10, clientY: 10 }),
  )
  view.dom.querySelector<HTMLButtonElement>('[data-menu-item="c"]')!.click()
  expect(run).toHaveBeenCalledTimes(1)
  expect(run.mock.calls[0]![1]).toHaveProperty("rect")
})

const TABLE = "| A | B |\n| - | - |\n| one | **two** |"
const TWO = TABLE.indexOf("two")

test("a row appended by Tab, and a document replaced by a shorter one, do not break marks", async () => {
  const errors = vi.spyOn(console, "error").mockImplementation(() => {})
  const thrown: string[] = []
  const onError = (e: ErrorEvent) => thrown.push(e.message)
  window.addEventListener("error", onError)
  const { table, view } = await mountTable(() => [mark(TWO, TWO + 3)])
  const last = [...table.querySelectorAll<HTMLTableCellElement>("tbody td")].at(-1)!
  last.focus()
  last.dispatchEvent(new FocusEvent("focusin", { bubbles: true }))
  last.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true }))
  expect(table.querySelectorAll("tbody tr")).toHaveLength(2)
  view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: "short" } })
  await new Promise((r) => setTimeout(r, 50))
  window.removeEventListener("error", onError)
  expect(thrown).toEqual([])
  expect(errors.mock.calls.flat().join(" ")).not.toMatch(/crashed|Invalid position|TypeError/)
  errors.mockRestore()
})

test("a changed marks list repaints, and the plugin survives a row delete", async () => {
  let marks: CellMark[] = []
  const { table, view } = await mountTable(() => marks)
  const cell = table.querySelectorAll<HTMLTableCellElement>("tbody td")[1]!
  marks = [mark(TWO, TWO + 3)]
  view.dispatch({}) // the host's state changed: any update repaints
  await vi.waitFor(() => expect(marked(cell)).toEqual(["two"]))
  marks = []
  view.dispatch({})
  await vi.waitFor(() => expect(marked(cell)).toEqual([]))
})

test("a cellClass with several classes and a bad attribute name do not break the table", async () => {
  const { table } = await mountTable(() => [
    mark(TWO, TWO + 3, { cellClass: "has-note dot", attributes: { "bad name": "x", ok: "1" } }),
  ])
  const cell = table.querySelectorAll<HTMLTableCellElement>("tbody td")[1]!
  await vi.waitFor(() => expect(cell.classList.contains("dot")).toBe(true))
  expect(cell.classList.contains("has-note")).toBe(true)
  expect(cell.querySelector(".hl")!.getAttribute("ok")).toBe("1")
})

test("a wikilink alias is marked at the alias, not at the same letters in the target", () => {
  const cell = document.createElement("td")
  cell.append(renderInline("[[ab|b]]"))
  applyPaint(cell, "[[ab|b]]", cellPaint([mark(5, 6)], 0, 0, 8)!, false)
  expect(marked(cell)).toEqual(["b"])
  expect(cell.textContent).toBe("b")
})

test("selection offsets and placeCaret work across the nodes marks split a cell into", () => {
  const cell = paint("one two three", [mark(4, 7)], true)
  document.body.append(cell)
  placeCaret(cell, 5, 9)
  expect(selectionOffsets(cell)).toEqual({ from: 5, to: 9 })
  // a point between the nodes: the element position, not a text offset
  const range = document.createRange()
  range.setStart(cell, 1)
  range.collapse(true)
  document.getSelection()!.removeAllRanges()
  document.getSelection()!.addRange(range)
  expect(selectionOffsets(cell)).toEqual({ from: 4, to: 4 })
  cell.remove()
})
