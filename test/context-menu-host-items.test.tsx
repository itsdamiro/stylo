import { afterEach, expect, test, vi } from "vitest"
import { cleanup, render } from "@testing-library/react"
import { EditorView } from "@codemirror/view"
import { Stylo } from "../src/Stylo"
import type { ContextMenuItem, InPlaceConfig } from "../src/types"

afterEach(() => {
  cleanup()
  document.querySelectorAll(".cm-inplace-menu, .cm-inplace-selbar").forEach((n) => n.remove())
})

async function mount(value: string, inPlace?: InPlaceConfig, readOnly?: boolean) {
  const result = render(
    <Stylo
      value={value}
      onChange={() => {}}
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
  return { view }
}

const rightClick = (target: Element): MouseEvent => {
  const e = new MouseEvent("contextmenu", {
    bubbles: true,
    cancelable: true,
    clientX: 20,
    clientY: 20,
  })
  target.dispatchEvent(e)
  return e
}

const labels = (view: EditorView): string[] =>
  [...view.dom.querySelectorAll(".cm-inplace-menu-item")].map((b) => b.textContent ?? "")

const item = (over: Partial<ContextMenuItem> = {}): ContextMenuItem => ({
  id: "comment",
  title: "Comment",
  run: () => {},
  ...over,
})

test("host items are the first group, above Add link, with a separator after", async () => {
  const { view } = await mount("Heading here", { contextMenu: { items: [item()] } })
  rightClick(view.contentDOM)
  expect(labels(view).slice(0, 2)).toEqual(["Comment", "Add link"])
  const panel = view.dom.querySelector(".cm-inplace-menu-panel")!
  expect(panel.children[1]!.className).toContain("-sep")
})

test("a host item's run gets the view with the selection from when the menu opened", async () => {
  const run = vi.fn((v: EditorView) =>
    v.state.sliceDoc(v.state.selection.main.from, v.state.selection.main.to),
  )
  const { view } = await mount("Heading here", { contextMenu: { items: [item({ run })] } })
  view.dispatch({ selection: { anchor: 0, head: 7 } })
  rightClick(view.contentDOM) // keeps the existing selection
  view.dom.querySelector<HTMLButtonElement>('[data-menu-item="comment"]')!.click()
  expect(run).toHaveBeenCalledTimes(1)
  expect(run).toHaveReturnedWith("Heading")
})

test("groups places the host group; one without it hides the items", async () => {
  const items = [item()]
  const placed = await mount("Heading here", {
    contextMenu: { items, groups: ["link", "host", "clipboard"] },
  })
  rightClick(placed.view.contentDOM)
  expect(labels(placed.view)).toEqual([
    "Add link",
    "Add external link",
    "Comment",
    "Cut",
    "Copy",
    "Paste",
  ])
  cleanup()
  const hidden = await mount("Heading here", { contextMenu: { items, groups: ["clipboard"] } })
  rightClick(hidden.view.contentDOM)
  expect(labels(hidden.view)).not.toContain("Comment")
})

test("when: selection and no-selection filter on the selection", async () => {
  const items = [
    item({ id: "a", title: "Sel", when: "selection" }),
    item({ id: "b", title: "None", when: "no-selection" }),
    item({ id: "c", title: "Any" }),
  ]
  // A blank line: right-click has no word to select, so the selection stays empty.
  const { view } = await mount("   ", { contextMenu: { items } })
  rightClick(view.contentDOM)
  expect(labels(view)).toEqual(expect.arrayContaining(["None", "Any"]))
  expect(labels(view)).not.toContain("Sel")
})

test("disabled(state) greys the row", async () => {
  const { view } = await mount("Heading here", {
    contextMenu: { items: [item({ disabled: () => true })] },
  })
  rightClick(view.contentDOM)
  expect(view.dom.querySelector<HTMLButtonElement>('[data-menu-item="comment"]')!.disabled).toBe(
    true,
  )
})

test("a ReactNode icon renders as a leading svg; a string is a stroke path", async () => {
  const { view } = await mount("Heading here", {
    contextMenu: {
      items: [
        item({
          id: "n",
          title: "Node",
          icon: (
            <svg data-hugeicon="x">
              <path d="M0 0" />
            </svg>
          ),
        }),
        item({ id: "s", title: "Path", icon: "M2 2l8 8" }),
      ],
    },
  })
  rightClick(view.contentDOM)
  expect(view.dom.querySelector('[data-menu-item="n"] svg[data-hugeicon="x"]')).not.toBeNull()
  expect(view.dom.querySelector('[data-menu-item="s"] svg path')?.getAttribute("d")).toBe(
    "M2 2l8 8",
  )
})

test("a fenced code block and a thematic break still get the host group", async () => {
  const fence = await mount("```ts\nconst a = 1\n```", { contextMenu: { items: [item()] } })
  fence.view.dispatch({ selection: { anchor: 8 } })
  rightClick(fence.view.contentDOM)
  expect(labels(fence.view)[0]).toBe("Comment")
})

test("read-only: only readOnlySafe items show, and nothing else", async () => {
  const items = [
    item({ id: "safe", title: "Safe", readOnlySafe: true }),
    item({ id: "edit", title: "Edit" }),
  ]
  const { view } = await mount("Heading here", { contextMenu: { items } }, true)
  const e = rightClick(view.contentDOM)
  expect(e.defaultPrevented).toBe(true)
  expect(labels(view)).toEqual(["Safe"])
})

test("read-only with no safe item leaves the browser menu alone", async () => {
  const { view } = await mount("Heading here", { contextMenu: { items: [item()] } }, true)
  const e = rightClick(view.contentDOM)
  expect(e.defaultPrevented).toBe(false)
  expect(view.dom.querySelector(".cm-inplace-menu-panel")).toBeNull()
})

test("read-only: a when: selection item has nothing to show off a word, so the browser menu stays", async () => {
  const { view } = await mount(
    "   ",
    { contextMenu: { items: [item({ when: "selection", readOnlySafe: true })] } },
    true,
  )
  const e = rightClick(view.contentDOM)
  expect(e.defaultPrevented).toBe(false)
})

test("a writable menu with groups: [host] and no items falls back to the browser menu", async () => {
  const { view } = await mount("Heading here", { contextMenu: { groups: ["host"] } })
  expect(rightClick(view.contentDOM).defaultPrevented).toBe(false)
})

test("table cell: host item shows in the cell menu and run sees the selected cell text in the doc", async () => {
  const T = "| A | B |\n| - | - |\n| one | two |"
  const seen: string[] = []
  const { view } = await mount(T, {
    table: "cells",
    contextMenu: {
      items: [
        item({
          when: "selection",
          run: (v) =>
            seen.push(v.state.sliceDoc(v.state.selection.main.from, v.state.selection.main.to)),
        }),
      ],
    },
  })
  const table = await vi.waitFor(() => {
    const el = view.contentDOM.querySelector<HTMLTableElement>("table.cm-inplace-table-edit")
    if (!el) throw new Error("editable table not rendered")
    return el
  })
  const cell = table.querySelectorAll<HTMLTableCellElement>("tbody td")[1]! // "two"
  cell.focus()
  cell.dispatchEvent(new FocusEvent("focusin", { bubbles: true }))
  const range = document.createRange()
  range.setStart(cell.firstChild!, 1) // "wo"
  range.setEnd(cell.firstChild!, 3)
  const sel = document.getSelection()!
  sel.removeAllRanges()
  sel.addRange(range)

  cell.dispatchEvent(
    new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: 10, clientY: 10 }),
  )
  expect(labels(view)).toContain("Insert row above") // structural rows still there
  view.dom.querySelector<HTMLButtonElement>('[data-menu-item="comment"]')!.click()
  expect(seen).toEqual(["wo"])
})
