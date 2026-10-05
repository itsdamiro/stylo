import { expect, test } from "@playwright/test"
import { openFixture } from "./_fixture"

const clicks = (page: import("@playwright/test").Page) =>
  page.evaluate(() => (window as unknown as { __markClicks?: number }).__markClicks ?? 0)

test.describe("host marks in table cells", () => {
  test("the marked word is drawn, and a click on it reaches the page", async ({ page }) => {
    await openFixture(page, { mode: "in-place", doc: "table", table: "cells", cellMark: "1" })
    const mark = page.locator(".cm-inplace-table-edit [data-mark-id]")
    await expect(mark).toHaveText("paint")
    await mark.click()
    expect(await clicks(page)).toBe(1)
    // The press still brings the cell into editing, with its marks kept.
    const cell = page.locator(".cm-inplace-table-edit tbody td", {
      has: page.locator("[data-mark-id]"),
    })
    await expect(cell).toBeFocused()
    await expect(cell.locator("[data-mark-id]")).toHaveText("paint")
  })
})
