import { expect, type Page, test } from "@playwright/test"
import { caret, line, openFixture } from "./_fixture"

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

  test.describe("keyboard onto a rendered image's line", () => {
    const SOURCE = "![logo|w120](a/b.svg)"
    // Rendered, `.cm-line` 3 is the blank above the first image and 4 the blank below it.
    const open = async (page: Page, blank: number) => {
      await openFixture(page, { mode: "in-place", doc: "image", image: "1" })
      await line(page, 0).click()
      await line(page, blank).click()
      await expect(page.locator(".cm-inplace-image")).toHaveCount(2)
    }
    test("ArrowDown from the blank line above reveals the source, the next arrow passes it", async ({
      page,
    }) => {
      await open(page, 3)
      await page.keyboard.press("ArrowDown")
      await expect(page.locator(".cm-inplace-image")).toHaveCount(1)
      expect((await caret(page)).line).toBe(SOURCE)

      await page.keyboard.press("ArrowDown")
      await expect(page.locator(".cm-inplace-image")).toHaveCount(2)
      expect((await caret(page)).line).toBe("")
      await expect(line(page, 4)).toBeVisible()
    })

    test("ArrowUp from the blank line below reveals the source, the next arrow passes it", async ({
      page,
    }) => {
      await open(page, 4)
      await page.keyboard.press("ArrowUp")
      await expect(page.locator(".cm-inplace-image")).toHaveCount(1)
      expect((await caret(page)).line).toBe(SOURCE)

      await page.keyboard.press("ArrowUp")
      await expect(page.locator(".cm-inplace-image")).toHaveCount(2)
      expect((await caret(page)).line).toBe("")
    })

    // CodeMirror binds Ctrl-N / Ctrl-P to line motion on macOS only, so the spec can only run there.
    for (const [key, blank] of [
      ["Control+n", 3],
      ["Control+p", 4],
    ] as const) {
      test(`${key} from the blank line ${blank === 3 ? "above" : "below"} reaches the source (macOS)`, async ({
        page,
      }) => {
        test.skip(process.platform !== "darwin", "Ctrl-N and Ctrl-P are line motion on macOS only")
        await open(page, blank)
        await page.keyboard.press(key)
        await expect(page.locator(".cm-inplace-image")).toHaveCount(1)
        expect((await caret(page)).line).toBe(SOURCE)
      })
    }

    test("readOnly: the surface takes no focus, so the arrows do nothing and the picture stays", async ({
      page,
    }) => {
      await openFixture(page, { mode: "in-place", doc: "image", image: "1", readOnly: "1" })
      await line(page, 3).click()
      await page.keyboard.press("ArrowDown")
      await expect(page.locator(".cm-inplace-image")).toHaveCount(2)
      await expect(page.locator(".cm-content")).not.toBeFocused()
    })

    test("the revealed source scrolls into view", async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 170 })
      await openFixture(page, { mode: "in-place", doc: "image", image: "1" })
      await line(page, 0).click()
      await page.keyboard.press("ArrowDown")
      await page.keyboard.press("ArrowDown")
      await page.keyboard.press("ArrowDown") // the blank line above the picture
      await page.keyboard.press("ArrowDown")
      const source = page.locator(".cm-content .cm-line", { hasText: SOURCE })
      await expect(source).toBeVisible()
      await expect(source).toBeInViewport({ ratio: 0.5 }) // fonts differ by platform; unscrolled it is 0
    })

    for (const [blank, key] of [
      [3, "ArrowRight"],
      [4, "ArrowLeft"],
      [3, "Delete"],
      [4, "Backspace"],
    ] as const) {
      test(`${key} from the blank line ${blank === 3 ? "above" : "below"} reaches the source`, async ({
        page,
      }) => {
        await open(page, blank)
        await page.keyboard.press(key)
        await expect(page.locator(".cm-inplace-image")).toHaveCount(1)
        // The picture's source stays whole: an arrow moves, a delete only joins the blank line.
        await expect(page.locator(".cm-content .cm-line", { hasText: SOURCE })).toBeVisible()
        expect((await caret(page)).line).toContain(SOURCE)
      })
    }
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
