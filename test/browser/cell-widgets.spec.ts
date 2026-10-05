import { expect, test } from "@playwright/test"
import { openFixture } from "./_fixture"

const clicks = (page: import("@playwright/test").Page) =>
  page.evaluate(() => (window as unknown as { __widgetClicks?: number }).__widgetClicks ?? 0)

test.describe("host widgets in table cells", () => {
  const open = (page: import("@playwright/test").Page) =>
    openFixture(page, { mode: "in-place", doc: "table", table: "cells", cellWidget: "1" })
  const cell = (page: import("@playwright/test").Page) =>
    page.locator(".cm-inplace-table-edit tbody td", { has: page.locator("[data-widget-id]") })

  test("the element is drawn after its word, and a click on it arrives", async ({ page }) => {
    await open(page)
    const button = page.locator(".cm-inplace-table-edit [data-widget-id]")
    await expect(button).toHaveText("Accept")
    await expect(cell(page)).toHaveClass(/host-cell-widget/)
    await expect(cell(page)).toHaveText("pa" + "intAccept")
    await button.click()
    expect(await clicks(page)).toBe(1)
    // The press did not move focus into the cell, so the widget is still there.
    await expect(cell(page)).not.toBeFocused()
    await expect(button).toBeVisible()
  })

  test("a focused cell shows its raw text without the widget; it returns on blur", async ({
    page,
  }) => {
    await open(page)
    const td = page.locator(".cm-inplace-table-edit tbody td").nth(5)
    await td.click({ position: { x: 5, y: 5 } })
    await expect(td).toBeFocused()
    await expect(td).toHaveText("paint")
    await expect(td.locator("[data-widget-id]")).toHaveCount(0)
    await page.keyboard.press("End")
    await page.keyboard.type("!")
    await page.locator(".cm-inplace-table-edit thead th").first().click()
    await expect(td.locator("[data-widget-id]")).toHaveCount(1)
    await expect(td).toHaveText("paintAccept!")
    // The label never reached the Markdown.
    const value = await page.evaluate(() => (window as unknown as { __value?: string }).__value)
    expect(value).toContain("| paint!")
    expect(value).not.toContain("Accept")
  })
})
