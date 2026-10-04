import { expect, test } from "@playwright/test"
import { line, openFixture } from "./_fixture"

const ran = (page: import("@playwright/test").Page) =>
  page.evaluate(() => (window as unknown as { __hostRun?: string }).__hostRun)

test.describe("host items in the right-click menu", () => {
  test("a selection's Comment item is first, has its icon, and runs on that text", async ({
    page,
  }) => {
    await openFixture(page, { mode: "in-place", doc: "basic", hostItem: "1" })
    await line(page, 4).dblclick() // selects a word
    await line(page, 4).click({ button: "right" })
    const first = page.locator(".cm-inplace-menu-item").first()
    await expect(first).toHaveText("Comment")
    await expect(first.locator("svg")).toBeVisible()
    await first.click()
    expect(await ran(page)).toMatch(/^\w+$/)
  })

  test("read-only: the menu opens with the safe item alone", async ({ page }) => {
    await openFixture(page, { mode: "in-place", doc: "basic", hostItem: "1", readOnly: "1" })
    await line(page, 4).click({ button: "right" })
    await expect(page.locator(".cm-inplace-menu-item")).toHaveText(["Comment"])
    await page.locator(".cm-inplace-menu-item").click()
    expect(await ran(page)).toMatch(/^\w+$/)
  })

  test("a table cell's selected text reaches run, and the cell keeps focus", async ({ page }) => {
    await openFixture(page, { mode: "in-place", doc: "table", table: "cells", hostItem: "1" })
    const cell = page.locator(".cm-inplace-table-edit tbody td").first()
    await cell.click()
    await cell.press("Control+a")
    await cell.click({ button: "right" })
    await expect(page.locator(".cm-inplace-menu-item").first()).toHaveText("Insert row above")
    const comment = page.locator('[data-menu-item="comment"]')
    await expect(comment).toBeVisible()
    await comment.click()
    expect(await ran(page)).toBe("source")
    await expect(cell).toBeFocused()
  })

  test("right-clicking a different cell runs on that cell's word, not the old selection", async ({
    page,
  }) => {
    await openFixture(page, { mode: "in-place", doc: "table", table: "cells", hostItem: "1" })
    const cells = page.locator(".cm-inplace-table-edit tbody td")
    await cells.first().click()
    await cells.first().press("Control+a") // "source" selected in the first cell
    await cells.nth(1).click({ button: "right" })
    await page.locator('[data-menu-item="comment"]').click()
    expect(await ran(page)).toBe("no")
  })
})
