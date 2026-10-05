import { expect, test } from "@playwright/test"
import { openFixture } from "./_fixture"

test("arrowing onto and off a source-mode table with a host widget", async ({ page }) => {
  const errors: string[] = []
  page.on("pageerror", (e) => errors.push(e.message))
  await openFixture(page, { mode: "in-place", doc: "table", table: "source", cellWidget: "1" })
  const widget = page.locator(".cm-inplace-table [data-widget-id]")
  await expect(widget).toHaveText("Accept")
  // From the heading above, ArrowDown twice enters the table: its source shows.
  await page.locator(".cm-line", { hasText: "# Table" }).click()
  await page.keyboard.press("ArrowDown")
  await page.keyboard.press("ArrowDown")
  await expect(page.locator(".cm-line", { hasText: "| Surface" })).toHaveCount(1)
  await expect(page.locator(".cm-inplace-table")).toHaveCount(0)
  // And back up out of it: the table renders again, with its widget.
  await page.keyboard.press("ArrowUp")
  await page.keyboard.press("ArrowUp")
  await page.keyboard.press("ArrowUp")
  await expect(widget).toHaveText("Accept")
  await expect(page.locator(".cm-line", { hasText: "| Surface" })).toHaveCount(0)
  expect(errors).toEqual([])
})
