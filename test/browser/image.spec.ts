import { expect, test } from "@playwright/test"
import { line, openFixture } from "./_fixture"

test.describe("![alt](src) images", () => {
  test("the canvas draws a lone image through imageSource, as written", async ({ page }) => {
    await openFixture(page, { mode: "in-place", doc: "image", image: "1" })
    // Caret away from every image line so the rendered form shows.
    await line(page, 0).click()

    const pics = page.locator(".cm-content .cm-inplace-image img.fixture-image")
    await expect(pics).toHaveCount(2)
    await expect(pics.first()).toBeVisible()
    await expect(pics.first()).toHaveAttribute("data-src", "a/b.svg")
    await expect(pics.first()).toHaveAttribute("data-alt", "logo|w120")
  })

  test("a size suffix the host reads sets the picture's size", async ({ page }) => {
    await openFixture(page, { mode: "in-place", doc: "image", image: "1" })
    await line(page, 0).click()

    const pics = page.locator(".cm-content .cm-inplace-image img.fixture-image")
    await expect.poll(async () => (await pics.first().boundingBox())?.width).toBe(120)
    await expect.poll(async () => (await pics.nth(1).boundingBox())?.height).toBe(80)
  })

  test("the source shows when the caret is on the line, the picture when it leaves", async ({
    page,
  }) => {
    await openFixture(page, { mode: "in-place", doc: "image", image: "1" })
    await line(page, 0).click()
    await expect(page.locator(".cm-inplace-image")).toHaveCount(2)

    // The slot's own box, not the host content, puts the caret on the line.
    await page
      .locator(".cm-content .cm-inplace-image")
      .first()
      .click({ position: { x: 2, y: 2 } })
    await expect(page.locator(".cm-inplace-image")).toHaveCount(1)
    await expect(
      page.locator(".cm-content .cm-line", { hasText: "![logo|w120](a/b.svg)" }),
    ).toBeVisible()

    await line(page, 0).click()
    await expect(page.locator(".cm-inplace-image")).toHaveCount(2)
  })

  test("an image inside a sentence stays as source", async ({ page }) => {
    await openFixture(page, { mode: "in-place", doc: "image", image: "1" })
    await line(page, 0).click()
    await expect(
      page.locator(".cm-content .cm-line", { hasText: "![inline](c.png)" }),
    ).toBeVisible()
  })

  test("no imageSource: the canvas shows the source, nothing is drawn", async ({ page }) => {
    await openFixture(page, { mode: "in-place", doc: "image" })
    await line(page, 0).click()
    await expect(page.locator(".cm-inplace-image")).toHaveCount(0)
    await expect(
      page.locator(".cm-content .cm-line", { hasText: "![logo|w120](a/b.svg)" }),
    ).toBeVisible()
  })

  test("preview and split draw the same pictures with the same arguments", async ({ page }) => {
    for (const mode of ["preview", "split"]) {
      await openFixture(page, { mode, doc: "image", image: "1" })
      const pics = page.locator(".stylo-image img.fixture-image")
      await expect(pics).toHaveCount(2)
      await expect(pics.first()).toHaveAttribute("data-src", "a/b.svg")
      await expect(pics.first()).toHaveAttribute("data-alt", "logo|w120")
      await expect.poll(async () => (await pics.first().boundingBox())?.width).toBe(120)
    }
  })
})
