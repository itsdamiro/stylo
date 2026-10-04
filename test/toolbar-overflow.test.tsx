import { afterEach, beforeEach, expect, test, vi } from "vitest"
import { cleanup, fireEvent, render } from "@testing-library/react"
import { Stylo } from "../src/Stylo"
import { fitEntries, trimSeps } from "../src/toolbar/overflow-fit"
import type { ToolbarCustomItem } from "../src/types"

afterEach(cleanup)

const btn = (pinned = false) => ({ sep: false, pinned, width: 30 })
const sep = { sep: true, pinned: false, width: 7 }

test("trimSeps drops leading, trailing, and doubled separators", () => {
  const s = (sepFlag: boolean) => ({ sep: sepFlag })
  expect(trimSeps([s(true), s(false), s(true), s(true), s(false), s(true)])).toEqual([
    s(false),
    s(true),
    s(false),
  ])
})

test("fitEntries folds from the end and keeps everything when it fits", () => {
  const entries = [btn(), btn(), sep, btn(), btn()]
  expect(fitEntries(entries, 500, 30)).toEqual([false, false, false, false, false])
  expect(fitEntries(entries, 100, 30)).toEqual([false, false, false, true, true])
  // The separator that would trail the row is trimmed, so it costs nothing.
  expect(fitEntries(entries, 60, 30)).toEqual([false, true, false, true, true])
})

test("fitEntries folds a pinned button only after every other one", () => {
  const entries = [btn(), btn(true), btn(), btn()]
  expect(fitEntries(entries, 90, 30)).toEqual([false, false, true, true])
  expect(fitEntries(entries, 50, 30)).toEqual([true, true, true, true])
})

// jsdom has no layout: give every child of a flex row a 30px box, 32px apart,
// and the bar a width.
let barWidth = 200
beforeEach(() => {
  const nth = (el: HTMLElement) => Array.prototype.indexOf.call(el.parentElement!.children, el)
  vi.spyOn(HTMLElement.prototype, "offsetLeft", "get").mockImplementation(function (
    this: HTMLElement,
  ) {
    return nth(this) * 32
  })
  vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(30)
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockImplementation(function (
    this: HTMLElement,
  ) {
    return this.getAttribute("role") === "toolbar" ? barWidth : 0
  })
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  )
})
afterEach(() => vi.restoreAllMocks())

const save: ToolbarCustomItem = { id: "save", title: "Save", icon: "S", run: vi.fn(), pinned: true }

function bar(overflow?: "menu") {
  return render(
    <Stylo
      value=""
      onChange={() => {}}
      toolbar={{ items: ["bold", "italic", "|", "h1", "h2", save], overflow }}
    />,
  )
}

test("menu mode folds what does not fit into a More button, pinned last", () => {
  barWidth = 150 // room for ~4 slots plus More
  const { container, getByLabelText } = bar("menu")
  const row = (c: string) => container.querySelector(`[role=toolbar] > [data-command="${c}"]`)
  expect(row("bold")).not.toBeNull()
  expect(row("save")).not.toBeNull()
  expect(row("h2")).toBeNull()
  fireEvent.click(getByLabelText("More"))
  const items = [...container.querySelectorAll("[role=menuitem]")].map((e) =>
    e.getAttribute("data-command"),
  )
  expect(items).toEqual(["italic", "h1", "h2"])
})

test("wrap mode (default) renders no More button", () => {
  barWidth = 40
  const { queryByLabelText } = bar()
  expect(queryByLabelText("More")).toBeNull()
})

test("choosing a menu entry runs it and closes the menu", () => {
  barWidth = 150
  const { container, getByLabelText } = bar("menu")
  fireEvent.click(getByLabelText("More"))
  expect(container.querySelector("[role=menu]")).not.toBeNull()
  fireEvent.keyDown(getByLabelText("More"), { key: "Escape" })
  expect(container.querySelector("[role=menu]")).toBeNull()
})
