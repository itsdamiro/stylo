import { expect, test } from "@playwright/test"
import { openFixture } from "./_fixture"

const bar = "[role=toolbar]"
const rowButtons = `${bar} > [data-command]`

test.describe("toolbar overflow menu", () => {
  test("a narrow bar stays one row and folds the rest into More", async ({ page }) => {
    await openFixture(page, { overflow: "menu", width: "300" })
    const box = (await page.locator(bar).boundingBox())!
    expect(box.height).toBeLessThan(45) // one row, never wrapped
    await expect(page.getByLabel("More")).toBeVisible()
    // Nothing spills past the bar, and the More button is inside it.
    const more = (await page.getByLabel("More").boundingBox())!
    expect(more.x + more.width).toBeLessThanOrEqual(box.x + box.width + 0.5)
    const last = (await page.locator(rowButtons).last().boundingBox())!
    expect(last.x + last.width).toBeLessThanOrEqual(more.x)
  })

  test("a folded button opens in the menu with its label and runs", async ({ page }) => {
    await openFixture(page, { overflow: "menu", width: "300" })
    await page.locator(".cm-content").click()
    const lines = await page.locator(".cm-content .cm-line").count()
    await page.getByLabel("More").click()
    const items = page.locator("[role^=menuitem]")
    expect(await items.count()).toBeGreaterThan(3)
    await expect(items.last()).toContainText(/\w{3,}/) // a word label, not just an icon
    await page.locator('[role^=menuitem][data-command="hr"]').click()
    await expect(page.locator("[role=menu]")).toHaveCount(0)
    await expect.poll(() => page.locator(".cm-content .cm-line").count()).toBeGreaterThan(lines)
  })

  test("widening the host brings buttons back; a wide bar has no More", async ({ page }) => {
    await openFixture(page, { overflow: "menu", width: "300" })
    const narrow = await page.locator(rowButtons).count()
    await page.evaluate(() => {
      document.querySelector<HTMLElement>("#fixture > div")!.style.width = "420px"
    })
    await expect.poll(() => page.locator(rowButtons).count()).toBeGreaterThan(narrow)
    await page.evaluate(() => {
      document.querySelector<HTMLElement>("#fixture > div")!.style.width = "1200px"
    })
    await expect(page.getByLabel("More")).toHaveCount(0)
  })

  test("Escape closes the menu and the default mode still wraps", async ({ page }) => {
    await openFixture(page, { overflow: "menu", width: "300" })
    await page.getByLabel("More").click()
    await page.keyboard.press("Escape")
    await expect(page.locator("[role=menu]")).toHaveCount(0)
    await openFixture(page, { width: "300" })
    await expect(page.getByLabel("More")).toHaveCount(0)
    expect((await page.locator(bar).boundingBox())!.height).toBeGreaterThan(45)
  })
})
