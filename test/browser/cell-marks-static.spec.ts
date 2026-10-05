import { expect, test, type Page } from "@playwright/test"
import { openFixture } from "./_fixture"

const count = (page: Page, key: "__markClicks" | "__widgetClicks") =>
  page.evaluate((k) => (window as unknown as Record<string, number | undefined>)[k] ?? 0, key)

for (const [name, params] of [
  ["table: source", { table: "source" }],
  ["a read-only document", { table: "cells", readOnly: "1" }],
] as const) {
  test.describe(`host marks and widgets on the rendered table of ${name}`, () => {
    const open = (page: Page) =>
      openFixture(page, {
        mode: "in-place",
        doc: "table",
        cellMark: "1",
        cellWidget: "1",
        ...params,
      })
    const table = (page: Page) => page.locator(".cm-inplace-table")

    test("both are drawn with the caret outside the table", async ({ page }) => {
      await open(page)
      await expect(table(page)).not.toHaveClass(/cm-inplace-table-edit/)
      await expect(table(page).locator("[data-mark-id]")).toHaveText("paint")
      await expect(table(page).locator("[data-widget-id]")).toHaveText("Accept")
    })

    test("a click on the widget reaches the host and the table stays rendered", async ({
      page,
    }) => {
      await open(page)
      await table(page).locator("[data-widget-id]").click()
      expect(await count(page, "__widgetClicks")).toBe(1)
      await expect(table(page).locator("[data-widget-id]")).toBeVisible()
      await expect(page.locator(".cm-line", { hasText: "| Surface" })).toHaveCount(0)
    })

    test("a click on a marked word reaches the host and the table stays rendered", async ({
      page,
    }) => {
      await open(page)
      await table(page).locator("[data-mark-id]").click()
      expect(await count(page, "__markClicks")).toBe(1)
      await expect(table(page).locator("[data-mark-id]")).toBeVisible()
      await expect(page.locator(".cm-line", { hasText: "| Surface" })).toHaveCount(0)
    })
  })
}
