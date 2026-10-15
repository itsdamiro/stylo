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

  test("a |full suffix the host reads fills the column on every surface", async ({ page }) => {
    for (const mode of ["in-place", "preview", "split"]) {
      await openFixture(page, { mode, doc: "imagefull", image: "1" })
      if (mode === "in-place") await line(page, 0).click()
      const pic = page.locator("img.fixture-image")
      await expect(pic).toHaveCount(1)
      // The slot is the column; the picture matches it, scaled in proportion (240x120).
      const holder = page.locator(mode === "in-place" ? ".cm-inplace-image" : ".stylo-image")
      await expect
        .poll(async () => {
          const [p, h] = [await pic.boundingBox(), await holder.boundingBox()]
          return p && h
            ? [Math.round(p.width) - Math.round(h.width), Math.round(p.height * 2 - p.width)]
            : null
        })
        .toEqual([0, 0])
    }
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

  test("a slow hook resolving after the caret moved onto the line leaves the source alone", async ({
    page,
  }) => {
    const errors: string[] = []
    page.on("pageerror", (e) => errors.push(e.message))
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()))

    await openFixture(page, { mode: "in-place", doc: "image", image: "slow" })
    await line(page, 0).click()
    // Both hooks are still pending: step the caret onto the first image's line.
    await page
      .locator(".cm-content .cm-inplace-image")
      .first()
      .click({ position: { x: 2, y: 2 } })
    const source = page.locator(".cm-content .cm-line", { hasText: "![logo|w120](a/b.svg)" })
    await expect(source).toBeVisible()

    // Wait out the 600 ms hook: the revealed line must keep its source and show no picture.
    await page.waitForTimeout(900)
    await expect(source).toBeVisible()
    await expect(page.locator(".cm-content .cm-inplace-image")).toHaveCount(1)

    // Leaving the line draws it from the resolved result.
    await line(page, 0).click()
    await expect(page.locator(".cm-content .cm-inplace-image")).toHaveCount(2)
    await expect(page.locator(".cm-content img.fixture-image")).toHaveCount(2)
    expect(errors).toEqual([])
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
