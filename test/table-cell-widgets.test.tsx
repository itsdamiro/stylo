import { expect, test } from "vitest"
import { renderInline } from "../src/inplace/inline-md"
import { cellText, placeCaret, selectionOffsets } from "../src/inplace/table-cell-dom"
import { applyPaint, type CellPaint } from "../src/inplace/table-cell-marks"

const widget = (at: number, label = "Accept", key = "k") => ({
  at,
  key,
  build: () => Object.assign(document.createElement("button"), { textContent: label }),
})

/** A cell painted from `raw` with widgets after raw offsets `ats`. */
function paint(raw: string, ats: number[], focused = false) {
  const cell = document.createElement("td")
  cell.append(focused ? document.createTextNode(raw) : renderInline(raw.replace(/\\\|/g, "|")))
  const p: CellPaint = { marks: [], widgets: ats.map((a) => widget(a)), cellClass: [] }
  applyPaint(cell, raw, p, focused)
  return cell
}

/** The cell as text with each widget shown as `[]`. */
const shape = (cell: HTMLElement) =>
  [...cell.childNodes].map((n) => (n instanceof Text ? n.data : "[]")).join("")

test("a widget follows the characters that end at its position", () => {
  expect(shape(paint("one two", [3]))).toBe("one[] two")
  expect(shape(paint("one two", [7]))).toBe("one two[]")
  expect(shape(paint("one two", [0]))).toBe("[]one two")
})

test("the element is not editable and not part of the cell's text", () => {
  const cell = paint("one two", [3])
  const el = cell.querySelector("button")!
  expect(el.getAttribute("contenteditable")).toBe("false")
  expect(cell.textContent).toBe("oneAccept two")
  expect(cellText(cell)).toBe("one two")
})

test("a position inside hidden syntax snaps to the nearest visible character", () => {
  // raw `a **bold** c`: offset 3 is inside the opening `**`
  const cell = paint("a **bold** c", [3])
  // ties go to the earlier boundary: after "a "
  expect(cell.textContent).toBe("a Acceptbold c")
})

test("an escaped pipe counts as one character", () => {
  // raw `a\|b c`: offset 4 is after `b`
  expect(shape(paint("a\\|b c", [4]))).toBe("a|b[] c")
})

test("a focused cell shows no widgets", () => {
  expect(shape(paint("one two", [3], true))).toBe("one two")
})

test("a cell that cannot be aligned still gets the element, at its end", () => {
  const cell = document.createElement("td")
  cell.append("not in the source")
  applyPaint(cell, "other", { marks: [], widgets: [widget(2)], cellClass: [] }, false)
  expect(shape(cell)).toBe("not in the source[]")
})

test("offsets and the caret ignore a widget's text", () => {
  const cell = paint("one two", [3])
  document.body.append(cell)
  placeCaret(cell, 5)
  expect(selectionOffsets(cell)).toEqual({ from: 5, to: 5 })
  expect(getSelection()!.anchorNode!.textContent).toBe(" two")
  cell.remove()
})
