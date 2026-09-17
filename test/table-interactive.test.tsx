import { afterEach, expect, test, vi } from "vitest"
import { cleanup, render } from "@testing-library/react"
import { EditorView } from "@codemirror/view"
import { Stylo } from "../src/Stylo"
import { tableField } from "../src/inplace/tables"
import { BUILTIN_BY_ID } from "../src/toolbar/commands"
import type { InPlaceConfig } from "../src/types"

afterEach(() => {
  vi.useRealTimers()
  cleanup()
})

async function mount(value: string, inPlace?: InPlaceConfig, readOnly?: boolean) {
  let latest = value
  const result = render(
    <Stylo
      value={value}
      onChange={(next) => {
        latest = next
      }}
      mode="in-place"
      inPlace={inPlace}
      readOnly={readOnly}
    />,
  )
  await vi.waitFor(() => {
    if (!result.container.querySelector(".cm-editor")) throw new Error("not mounted")
  })
  const view = EditorView.findFromDOM(result.container.querySelector(".cm-editor") as HTMLElement)
  if (!view) throw new Error("no EditorView")
  return { ...result, view, doc: () => latest }
}

async function editCells(view: EditorView) {
  return vi.waitFor(() => {
    const el = view.contentDOM.querySelector<HTMLTableElement>("table.cm-inplace-table-edit")
    if (!el) throw new Error("editable table not rendered")
    return el
  })
}

const T = "| A | B |\n| - | - |\n| 1 | 2 |"

test('table: "cells" renders contentEditable cells; the default does not', async () => {
  const editable = await mount(T, { table: "cells" })
  const table = await editCells(editable.view)
  const cells = table.querySelectorAll<HTMLTableCellElement>("th, td")
  expect(cells).toHaveLength(4)
  expect([...cells].every((c) => c.getAttribute("contenteditable") === "true")).toBe(true)

  const plain = await mount(T)
  plain.view.dispatch({ selection: { anchor: plain.view.state.doc.length } })
  expect(plain.view.contentDOM.querySelector(".cm-inplace-table-edit")).toBeNull()
  expect(plain.view.contentDOM.querySelector("table [contenteditable]")).toBeNull()
})

test('readOnly falls back to the plain table even with table: "cells" requested', async () => {
  const { view } = await mount(T, { table: "cells" }, true)
  view.dispatch({ selection: { anchor: view.state.doc.length } })
  expect(view.contentDOM.querySelector(".cm-inplace-table-edit")).toBeNull()
  expect(view.contentDOM.querySelector("table [contenteditable]")).toBeNull()
})

test("flipping readOnly live swaps an already-mounted editable table back to plain", async () => {
  const { view, rerender } = await mount(T, { table: "cells" }, false)
  await editCells(view) // confirms the editable widget mounted while writable

  rerender(
    <Stylo
      value={T}
      onChange={() => {}}
      mode="in-place"
      inPlace={{ table: "cells" }}
      readOnly={true}
    />,
  )
  await vi.waitFor(() => {
    if (view.contentDOM.querySelector(".cm-inplace-table-edit"))
      throw new Error("editable widget still mounted")
  })
  expect(view.contentDOM.querySelector("table [contenteditable]")).toBeNull()
})

test("editing a cell reserializes the whole table back into the document", async () => {
  const { view, doc } = await mount(T, { table: "cells" })
  const table = await editCells(view)
  const firstBodyCell = table.querySelector<HTMLTableCellElement>("tbody td")!

  firstBodyCell.textContent = "hello"
  firstBodyCell.dispatchEvent(new Event("input", { bubbles: true }))

  expect(view.state.doc.toString()).toBe("| A     | B   |\n| ----- | --- |\n| hello | 2   |")
  expect(doc()).toBe(view.state.doc.toString())
})

test("a cell renders Markdown while unfocused and shows raw source while focused", async () => {
  const { view } = await mount("| Rich |\n| - |\n| **b** `c` |\n\ntail", { table: "cells" })
  const table = await editCells(view)
  const cell = table.querySelector<HTMLTableCellElement>("tbody td")!

  // unfocused: rendered
  expect(cell.querySelector("strong")?.textContent).toBe("b")
  expect(cell.querySelector("code")?.textContent).toBe("c")

  // focusin: swaps to the raw source, a single text node
  cell.dispatchEvent(new FocusEvent("focusin", { bubbles: true }))
  expect(cell.querySelector("strong")).toBeNull()
  expect(cell.textContent).toBe("**b** `c`")

  // focusout (leaving the table): re-renders from the (unchanged) source
  cell.dispatchEvent(new FocusEvent("focusout", { bubbles: true, relatedTarget: view.contentDOM }))
  expect(cell.querySelector("strong")?.textContent).toBe("b")
})

test("editing a cell's raw source keeps the change and re-renders it on blur", async () => {
  const { view } = await mount("| H |\n| - |\n| *old* |\n\ntail", { table: "cells" })
  const table = await editCells(view)
  const cell = table.querySelector<HTMLTableCellElement>("tbody td")!

  cell.dispatchEvent(new FocusEvent("focusin", { bubbles: true }))
  expect(cell.textContent).toBe("*old*")
  cell.textContent = "**new**"
  cell.dispatchEvent(new Event("input", { bubbles: true }))
  expect(view.state.doc.toString()).toContain("| **new** |")

  cell.dispatchEvent(new FocusEvent("focusout", { bubbles: true, relatedTarget: view.contentDOM }))
  expect(cell.querySelector("strong")?.textContent).toBe("new")
})

test("a widget edit maps the decoration instead of rebuilding it", async () => {
  const { view } = await mount(T, { table: "cells" })
  const table = await editCells(view)
  const before = view.state.field(tableField)
  expect(before.size).toBe(1)

  const cell = table.querySelector<HTMLTableCellElement>("thead th")!
  cell.textContent = "Alpha"
  cell.dispatchEvent(new Event("input", { bubbles: true }))

  const after = view.state.field(tableField)
  expect(after.size).toBe(1)
  // Same rendered <table> element survives the edit — focus is not lost.
  expect(view.contentDOM.querySelector("table.cm-inplace-table-edit")).toBe(table)
})

test("Tab past the last cell appends a row", async () => {
  const { view } = await mount(T, { table: "cells" })
  const table = await editCells(view)
  const lastCell = [...table.querySelectorAll<HTMLTableCellElement>("tbody td")].at(-1)!

  lastCell.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true }))

  expect(view.state.doc.toString()).toBe(
    "| A   | B   |\n| --- | --- |\n| 1   | 2   |\n|     |     |",
  )
})

/** The cell the DOM caret currently sits in, and its `(row, col)`. */
function caretCell(view: EditorView) {
  const sel = view.dom.ownerDocument.getSelection()
  const node = sel?.anchorNode
  const cell = (
    node instanceof Element ? node : node?.parentElement
  )?.closest<HTMLTableCellElement>("th, td")
  if (!cell) return null
  const row = cell.parentElement as HTMLTableRowElement
  const rows = [...cell.closest("table")!.querySelectorAll("tr")]
  return { cell, row: rows.indexOf(row), col: [...row.cells].indexOf(cell) }
}

const raf = () => new Promise((r) => requestAnimationFrame(() => r(null)))

test("a sync keeps the caret in the edited cell, not the first one", async () => {
  const { view } = await mount("intro", { table: "cells" })
  view.dispatch({ selection: { anchor: view.state.doc.length } })
  BUILTIN_BY_ID.table!.run(view)
  await vi.waitFor(() => {
    if (!caretCell(view)) throw new Error("no caret")
  })

  // Tab through the skeleton, append a row past the end, Tab into its 2nd
  // column — the append fires a sync, which used to drop the caret.
  for (let k = 0; k < 5; k++) {
    caretCell(view)!.cell.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true }))
    await raf()
  }
  expect(caretCell(view)).toMatchObject({ row: 2, col: 1 })

  caretCell(view)!.cell.textContent = "value"
  caretCell(view)!.cell.dispatchEvent(new Event("input", { bubbles: true }))
  await raf()

  expect(caretCell(view)).toMatchObject({ row: 2, col: 1 })
  expect(view.state.doc.toString().trimEnd().split("\n").at(-1)).toBe("|          | value    |")
})

test("mousedown in a cell does not reveal the source — the widget owns the click", async () => {
  const { view } = await mount(T, { table: "cells" })
  const table = await editCells(view)
  const cell = table.querySelector<HTMLTableCellElement>("tbody td")!

  // The widget stops the mousedown from reaching CodeMirror's delegated
  // handler, which would otherwise snap the caret to the widget boundary.
  const reachedCM = vi.fn()
  view.contentDOM.addEventListener("mousedown", reachedCM)
  cell.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }))

  expect(reachedCM).not.toHaveBeenCalled()
  expect(view.state.field(tableField).size).toBe(1)
  expect(view.contentDOM.querySelector("table.cm-inplace-table-edit")).toBe(table)
})

test('the "table" toolbar command puts the caret in the first cell in cells mode', async () => {
  const { view } = await mount("intro", { table: "cells" })
  view.dispatch({ selection: { anchor: view.state.doc.length } })
  BUILTIN_BY_ID.table!.run(view)

  // Assert the DOM selection the helper places — where the caret lands.
  const anchorCell = await vi.waitFor(() => {
    const node = view.dom.ownerDocument.getSelection()?.anchorNode
    const cell = (node instanceof Element ? node : node?.parentElement)?.closest("th, td")
    if (!cell?.closest(".cm-inplace-table-edit")) throw new Error("caret not in a cell")
    return cell as HTMLElement
  })
  expect(anchorCell.tagName).toBe("TH")
  expect(anchorCell.textContent).toBe("Column 1")
})

test('the "table" toolbar command does not throw on the plain source surface', () => {
  const { getByRole } = render(<Stylo value="x" onChange={() => {}} mode="source" />)
  const view = EditorView.findFromDOM(
    (getByRole("textbox") as HTMLElement).closest(".cm-editor") as HTMLElement,
  )!
  expect(() => BUILTIN_BY_ID.table!.run(view)).not.toThrow()
  expect(view.state.doc.toString()).toContain("| Column 1 | Column 2 |")
})

async function focusCell(
  view: EditorView,
  selector: "thead th" | "tbody td",
  nth = 0,
): Promise<HTMLTableCellElement> {
  const table = await editCells(view)
  const cell = table.querySelectorAll<HTMLTableCellElement>(selector)[nth]!
  cell.focus()
  cell.dispatchEvent(new FocusEvent("focusin", { bubbles: true }))
  if (view.dom.ownerDocument.activeElement !== cell) throw new Error("cell did not take focus")
  return cell
}

/** Select `cell`'s lone text node from `from` to `to` (default: the whole cell). */
function selectText(cell: HTMLTableCellElement, from = 0, to = cell.textContent?.length ?? 0) {
  const node = cell.firstChild!
  const range = cell.ownerDocument.createRange()
  range.setStart(node, from)
  range.setEnd(node, to)
  const sel = cell.ownerDocument.getSelection()!
  sel.removeAllRanges()
  sel.addRange(range)
}

test("a toolbar inline command wraps the focused cell's selection, in DOM and document", async () => {
  const { view, doc } = await mount(T, { table: "cells" })
  const cell = await focusCell(view, "tbody td", 0)
  expect(cell.textContent).toBe("1") // raw source revealed on focus

  selectText(cell)
  BUILTIN_BY_ID.bold!.run(view)

  expect(cell.textContent).toBe("**1**")
  expect(view.state.doc.toString()).toContain("**1**")
  expect(doc()).toBe(view.state.doc.toString())
})

test("the toolbar disables block commands, but not inline ones, while a table cell has DOM focus", async () => {
  const { container, view } = await mount(T, { table: "cells" })
  await focusCell(view, "tbody td", 0)
  // Force the toolbar to re-render off the fresh DOM focus, the same way a
  // real click or keystroke does (it listens for these on `contentDOM`).
  view.contentDOM.dispatchEvent(new Event("mouseup", { bubbles: true }))

  const disabledOf = (id: string) =>
    container.querySelector<HTMLButtonElement>(`button[data-command="${id}"]`)?.disabled

  // The inline commands degrade to an edit on the cell itself and stay live —
  // wait for the toolbar's re-render off the dispatched event to actually land.
  await vi.waitFor(() => {
    expect(disabledOf("bold")).toBe(false)
  })
  // `state.selection` is still wherever it was before the click into the
  // cell — without cell-awareness these would read that stale position
  // instead of noticing the caret is actually in a cell with no valid block
  // Markdown, and could mutate an unrelated line.
  expect(disabledOf("h1")).toBe(true)
  expect(disabledOf("table")).toBe(true)
  expect(disabledOf("quote")).toBe(true)
})

test("a second inline toggle removes the mark from the cell", async () => {
  const { view } = await mount(T, { table: "cells" })
  const cell = await focusCell(view, "tbody td", 0)

  selectText(cell)
  BUILTIN_BY_ID.bold!.run(view)
  expect(cell.textContent).toBe("**1**")

  BUILTIN_BY_ID.bold!.run(view) // selection was restored across the sync
  expect(cell.textContent).toBe("1")
  expect(view.state.doc.toString()).toContain("| 1   |")
})

test("inline marks nest inside a cell (bold then italic)", async () => {
  const { view } = await mount(T, { table: "cells" })
  const cell = await focusCell(view, "tbody td", 0)

  selectText(cell)
  BUILTIN_BY_ID.bold!.run(view)
  BUILTIN_BY_ID.italic!.run(view)

  expect(cell.textContent).toBe("***1***")
  expect(view.state.doc.toString()).toContain("***1***")
})

test("Mod-b typed inside a cell bolds the selection (widget shortcut path)", async () => {
  const { view } = await mount(T, { table: "cells" })
  const cell = await focusCell(view, "tbody td", 0)

  selectText(cell)
  cell.dispatchEvent(new KeyboardEvent("keydown", { key: "b", metaKey: true, bubbles: true }))

  expect(cell.textContent).toBe("**1**")
  expect(view.state.doc.toString()).toContain("**1**")
})

test("the link command wraps a cell selection as [text](url)", async () => {
  const { view } = await mount(T, { table: "cells" })
  const cell = await focusCell(view, "tbody td", 0)

  selectText(cell)
  BUILTIN_BY_ID.link!.run(view)

  expect(cell.textContent).toBe("[1](url)")
  expect(view.state.doc.toString()).toContain("[1](url)")
})

test("the selection bar follows a text selection inside a table cell", async () => {
  const { view } = await mount(T, { table: "cells", selectionUI: "bar" })
  const cell = await focusCell(view, "tbody td", 0)
  const bar = view.dom.querySelector<HTMLElement>(".cm-inplace-selbar")!
  expect(bar.hidden).toBe(true)

  selectText(cell)
  document.dispatchEvent(new Event("selectionchange"))
  await vi.waitFor(() => {
    if (bar.hidden) throw new Error("bar still hidden for the cell selection")
  })

  // the bold button routes through the cell, not the (collapsed) editor selection
  const bold = bar.querySelector<HTMLButtonElement>(".cm-inplace-selbar-btn")!
  bold.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }))
  bold.dispatchEvent(new MouseEvent("click", { bubbles: true }))
  expect(cell.textContent).toBe("**1**")
})

test("selectionBarItems trims and orders the bar's buttons", async () => {
  const { view } = await mount("some words here", {
    reveal: "never",
    selectionUI: "bar",
    selectionBarItems: ["math", "bold"],
  })
  const btns = view.dom.querySelectorAll(".cm-inplace-selbar-btn")
  expect(btns).toHaveLength(2)
  expect(btns[0]!.getAttribute("aria-label")).toBe("Inline math")
  expect(btns[1]!.getAttribute("aria-label")).toBe("Bold")
})

function menuItem(view: EditorView, label: string): HTMLButtonElement {
  const it = [...view.contentDOM.querySelectorAll<HTMLButtonElement>(".cm-inplace-menu-item")].find(
    (b) => b.textContent === label,
  )
  if (!it) throw new Error(`no menu item "${label}"`)
  return it
}

/** Right-click the nth cell matching `selector` and return the menu labels. */
function rightClick(view: EditorView, selector: "thead th" | "tbody td", nth = 0): string[] {
  const cell = view.contentDOM.querySelectorAll<HTMLTableCellElement>(
    `.cm-inplace-table-edit ${selector}`,
  )[nth]!
  cell.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, clientX: 10, clientY: 10 }))
  return [...view.contentDOM.querySelectorAll(".cm-inplace-menu-item")].map(
    (b) => b.textContent ?? "",
  )
}

test("right-click on a cell selection shows structural rows AND an enabled Format group", async () => {
  const { view } = await mount(T, { table: "cells" })
  const cell = await focusCell(view, "tbody td", 0)
  selectText(cell) // whole cell "1"
  cell.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, clientX: 10, clientY: 10 }))

  const labels = [...view.contentDOM.querySelectorAll(".cm-inplace-menu-item")].map(
    (b) => b.textContent ?? "",
  )
  expect(labels).toContain("Insert row above") // structural set still there
  expect(labels).toContain("Align left")
  expect(labels).toContain("Format") // …plus the inline group

  const format = [
    ...view.contentDOM.querySelectorAll<HTMLButtonElement>(".cm-inplace-menu-item"),
  ].find((b) => b.textContent === "Format")!
  format.dispatchEvent(new Event("pointerenter", { bubbles: true }))
  const bold = [...document.querySelectorAll<HTMLButtonElement>(".cm-inplace-menu-item")].find(
    (b) => b.textContent === "Bold",
  )!
  expect(bold.disabled).toBe(false) // not greyed by the collapsed state.selection
})

test("right-click on a word in a cell with no selection auto-selects it and adds Format", async () => {
  const { view } = await mount(T, { table: "cells" })
  const cell = await focusCell(view, "tbody td", 0) // raw source "1"
  expect(cell.ownerDocument.getSelection()?.toString()).not.toBe("1") // nothing selected yet
  cell.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, clientX: 10, clientY: 10 }))
  expect(cell.ownerDocument.getSelection()?.toString()).toBe("1") // the word got selected
  const labels = [...view.contentDOM.querySelectorAll(".cm-inplace-menu-item")].map(
    (b) => b.textContent ?? "",
  )
  expect(labels).toContain("Insert row above")
  expect(labels).toContain("Format")
})

test("right-click on a marked word in a cell selects the whole run, not one word", async () => {
  const { view } = await mount(T, { table: "cells" })
  const cell = await focusCell(view, "tbody td", 0)
  // Give the cell some marked source, then blur/refocus so it holds raw text.
  cell.textContent = "**bold phrase**"
  cell.dispatchEvent(new Event("input", { bubbles: true }))
  const text = cell.firstChild as Text
  // jsdom has no caretPositionFromPoint — stub it to land inside "phrase".
  const doc = cell.ownerDocument as Document & { caretPositionFromPoint?: unknown }
  doc.caretPositionFromPoint = () => ({
    offsetNode: text,
    offset: 9,
    getClientRect: () => new DOMRect(),
  })

  cell.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, clientX: 10, clientY: 10 }))
  expect(cell.ownerDocument.getSelection()?.toString()).toBe("bold phrase") // not "bold"
})

test("the add-column gizmo appends a column", async () => {
  const { view } = await mount(T, { table: "cells" })
  await editCells(view)
  view.contentDOM.querySelector<HTMLButtonElement>(".cm-inplace-tg-addcol")!.click()
  expect(view.state.doc.toString()).toBe(
    "| A   | B   |     |\n| --- | --- | --- |\n| 1   | 2   |     |",
  )
})

test("the add-row gizmo appends a row", async () => {
  const { view } = await mount(T, { table: "cells" })
  await editCells(view)
  view.contentDOM.querySelector<HTMLButtonElement>(".cm-inplace-tg-addrow")!.click()
  expect(view.state.doc.toString()).toBe(
    "| A   | B   |\n| --- | --- |\n| 1   | 2   |\n|     |     |",
  )
})

test("a selection-only transaction does not orphan the editable widget", async () => {
  const { view } = await mount(`intro\n\n${T}\n\ntail`, { table: "cells" })
  const table = await editCells(view)

  // Caret moves elsewhere in the document — a selection-only transaction that
  // must not swap the widget instance behind its mounted DOM.
  view.dispatch({ selection: { anchor: 0 } })
  expect(view.contentDOM.querySelector("table.cm-inplace-table-edit")).toBe(table)

  // A structural edit still lands (it would silently no-op on an orphaned widget).
  view.contentDOM.querySelector<HTMLButtonElement>(".cm-inplace-tg-addcol")!.click()
  expect(view.state.doc.toString()).toContain("| A   | B   |     |")
})

test("the cell context menu deletes a column", async () => {
  const { view } = await mount(T, { table: "cells" })
  await editCells(view)
  rightClick(view, "tbody td", 1) // second column
  menuItem(view, "Delete column").click()
  expect(view.state.doc.toString()).toBe("| A   |\n| --- |\n| 1   |")
})

test("the cell context menu writes alignment into the delimiter", async () => {
  const { view } = await mount(T, { table: "cells" })
  await editCells(view)
  rightClick(view, "thead th", 0)
  menuItem(view, "Align center").click()
  expect(view.state.doc.toString().split("\n")[1]).toBe("| :-: | --- |")
})

test("the context menu is hidden until a right-click and closes on an outside click", async () => {
  const { view } = await mount(T, { table: "cells" })
  await editCells(view)
  const menu = view.contentDOM.querySelector<HTMLElement>(".cm-inplace-menu")!
  expect(menu.hidden).toBe(true)

  rightClick(view, "tbody td", 0)
  expect(menu.hidden).toBe(false)

  document.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }))
  expect(menu.hidden).toBe(true)
})

test("the context menu omits Delete row on the header and the last body row", async () => {
  const { view } = await mount("| A | B |\n| - | - |\n| 1 | 2 |\n| 3 | 4 |", { table: "cells" })
  await editCells(view)

  expect(rightClick(view, "thead th", 0)).not.toContain("Delete row")

  expect(rightClick(view, "tbody td", 0)).toContain("Delete row") // 2 body rows — allowed
  menuItem(view, "Delete row").click()
  expect(view.state.doc.toString()).toBe("| A   | B   |\n| --- | --- |\n| 3   | 4   |")

  expect(rightClick(view, "tbody td", 0)).not.toContain("Delete row") // 1 body row left
})

test("Enter in the last row appends a row", async () => {
  const { view } = await mount(T, { table: "cells" })
  const table = await editCells(view)
  const bodyCell = table.querySelector<HTMLTableCellElement>("tbody td")!

  bodyCell.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }))

  expect(view.state.doc.toString()).toBe(
    "| A   | B   |\n| --- | --- |\n| 1   | 2   |\n|     |     |",
  )
})

const arrow = (key: string) =>
  new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true })

test("ArrowDown from the line above a table focuses its first cell", async () => {
  const { view } = await mount(`intro\n\n${T}`, { table: "cells" })
  await editCells(view)
  view.dispatch({ selection: { anchor: view.state.doc.line(2).from } }) // blank line above
  view.contentDOM.dispatchEvent(arrow("ArrowDown"))

  const active = view.dom.ownerDocument.activeElement as HTMLElement
  expect(active.matches("th[data-r='0'][data-c='0']")).toBe(true)
})

test("ArrowUp from the line below a table focuses its last cell", async () => {
  const { view } = await mount(`${T}\n\nafter`, { table: "cells" })
  await editCells(view)
  view.dispatch({ selection: { anchor: view.state.doc.line(4).from } }) // blank line below
  view.contentDOM.dispatchEvent(arrow("ArrowUp"))

  const active = view.dom.ownerDocument.activeElement as HTMLElement
  expect(active.matches("td[data-r='1'][data-c='1']")).toBe(true)
})

test("ArrowDown walks the column, then leaves the table past the last row", async () => {
  const { view } = await mount(T, { table: "cells" })
  const cell = await focusCell(view, "thead th", 1) // "B", column 1

  cell.dispatchEvent(arrow("ArrowDown"))
  expect(caretCell(view)).toMatchObject({ row: 1, col: 1 }) // body row, same column

  caretCell(view)!.cell.dispatchEvent(arrow("ArrowDown"))
  expect(caretCell(view)).toBeNull() // caret is back in the document
})

test("ArrowDown out of the last row lands past the table even with no blank line after it", async () => {
  // GFM swallows a non-blank, pipe-less line right after a table into the same
  // `Table` node when there's no blank line separating them — so "after"
  // becomes (a malformed but real) extra row of the table itself, not a
  // separate paragraph. That's a real GFM quirk, not a Stylo bug; what's under
  // test is that `bounds()` agrees with it instead of stopping one line short.
  const doc = `${T}\nafter`
  const { view } = await mount(doc, { table: "cells" })
  const table = await editCells(view)
  const lastCell = [...table.querySelectorAll<HTMLTableCellElement>("tbody td")].at(-1)!
  lastCell.focus()
  lastCell.dispatchEvent(new FocusEvent("focusin", { bubbles: true }))

  lastCell.dispatchEvent(arrow("ArrowDown"))

  expect(caretCell(view)).toBeNull() // left the table
  // Lands at the true end of the swallowed range, not one line short of it
  // (which `bounds()`'s old pipe-only line scan produced — a position still
  // inside the real, tree-backed atomic table decoration).
  expect(view.state.selection.main.head).toBe(view.state.doc.length)
})

test("ArrowRight crosses to the next cell only from the end of the text", async () => {
  const { view } = await mount("| hello | b |\n| - | - |\n| 1 | 2 |", { table: "cells" })
  const cell = await focusCell(view, "thead th", 0) // "hello"

  selectText(cell, 0, 0) // caret at the start — mid-text, stays put
  cell.dispatchEvent(arrow("ArrowRight"))
  expect(caretCell(view)).toMatchObject({ row: 0, col: 0 })

  selectText(cell, 5, 5) // caret at the end — crosses
  cell.dispatchEvent(arrow("ArrowRight"))
  expect(caretCell(view)).toMatchObject({ row: 0, col: 1 })
})

test("ArrowLeft from the start of the first cell leaves the table above", async () => {
  const { view } = await mount(`intro\n\n${T}`, { table: "cells" })
  const cell = await focusCell(view, "thead th", 0)

  selectText(cell, 0, 0)
  cell.dispatchEvent(arrow("ArrowLeft"))
  expect(caretCell(view)).toBeNull()
})

test("a long-press on a cell opens the structural menu (touch)", async () => {
  const { view } = await mount(T, { table: "cells" })
  const table = await editCells(view)
  const cell = table.querySelector<HTMLTableCellElement>("tbody td")!

  vi.useFakeTimers()
  cell.dispatchEvent(
    new PointerEvent("pointerdown", {
      bubbles: true,
      clientX: 5,
      clientY: 5,
      pointerType: "touch",
    }),
  )
  vi.advanceTimersByTime(500)
  vi.useRealTimers()

  const panel = view.contentDOM.querySelector(".cm-inplace-menu-panel")
  expect(panel, "the widget's structural menu opened").not.toBeNull()
  expect(panel?.textContent).toContain("Insert row above")
})

test("a long-press that drifts past the slop does not open the menu", async () => {
  const { view } = await mount(T, { table: "cells" })
  const table = await editCells(view)
  const cell = table.querySelector<HTMLTableCellElement>("tbody td")!

  vi.useFakeTimers()
  cell.dispatchEvent(
    new PointerEvent("pointerdown", {
      bubbles: true,
      clientX: 5,
      clientY: 5,
      pointerType: "touch",
    }),
  )
  cell.dispatchEvent(
    new PointerEvent("pointermove", {
      bubbles: true,
      clientX: 5,
      clientY: 40,
      pointerType: "touch",
    }),
  )
  vi.advanceTimersByTime(500)
  vi.useRealTimers()

  expect(view.contentDOM.querySelector(".cm-inplace-menu-panel")).toBeNull()
})
