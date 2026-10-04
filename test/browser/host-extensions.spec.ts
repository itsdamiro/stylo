import { expect, test } from "@playwright/test"
import { openFixture } from "./_fixture"

test.describe("host extensions", () => {
  for (const mode of ["source", "in-place", "split"]) {
    test(`${mode}: a host gutter is visible and aligned with the lines, and the mark renders`, async ({
      page,
    }) => {
      await openFixture(page, { mode, hostExt: "1" })
      await expect(page.locator(".host-mark").first()).toBeVisible()
      const gutter = page.locator(".cm-gutters").first()
      await expect(gutter).toBeVisible()
      const el = page.locator(".cm-gutterElement", { hasText: "•" }).first()
      await expect(el).toBeVisible()
      const gutterBox = (await el.boundingBox())!
      const lineBox = (await page.locator(".cm-content .cm-line").first().boundingBox())!
      expect(Math.abs(gutterBox.y - lineBox.y)).toBeLessThan(lineBox.height)
      expect(await gutter.evaluate((e) => getComputedStyle(e).backgroundColor)).toBe(
        "rgba(0, 0, 0, 0)",
      )
    })
  }

  test("without host extensions there is no gutter", async ({ page }) => {
    await openFixture(page, { mode: "in-place" })
    await expect(page.locator(".cm-gutters")).toHaveCount(0)
  })
})
