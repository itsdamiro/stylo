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

    test("readOnly: a click on a picture's slot keeps the picture, not its source", async ({
      page,
    }) => {
      await openFixture(page, { mode: "in-place", doc: "image", image: "1", readOnly: "1" })
      await line(page, 0).click()
      await expect(page.locator(".cm-inplace-image")).toHaveCount(2)
      await page
        .locator(".cm-content .cm-inplace-image")
        .first()
        .click({ position: { x: 2, y: 2 } })
      await expect(page.locator(".cm-inplace-image")).toHaveCount(2)
      await expect(page.locator(".cm-content .cm-line", { hasText: SOURCE })).toHaveCount(0)
    })

    test("the revealed source scrolls into view", async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 170 })
      await openFixture(page, { mode: "in-place", doc: "image", image: "1" })
      // The page scrolls, not the editor. Precondition: a small font cannot make the document fit.
      expect(await page.evaluate(() => document.documentElement.scrollHeight > innerHeight)).toBe(
        true,
      )
      await line(page, 0).click()
      await page.keyboard.press("ArrowDown")
      await page.keyboard.press("ArrowDown")
      await page.keyboard.press("ArrowDown") // the blank line above the picture
      await page.keyboard.press("ArrowDown")
      expect((await caret(page)).line).toBe(SOURCE)
      const source = page.locator(".cm-content .cm-line", { hasText: SOURCE })
      // Inside the window, whatever the platform's font: unscrolled it sits well below it.
      // CodeMirror leaves the line flush with the edge, so allow a couple of pixels of rounding.
      await expect
        .poll(async () => {
          const box = await source.boundingBox()
          const slack = 2
          return box
            ? box.y >= -slack && box.y + box.height <= (page.viewportSize()?.height ?? 0) + slack
            : null
        })
        .toBe(true)
    })

    test.describe("a picture on the first or the last line of the document", () => {
      const open = async (page: Page, blank: number) => {
        await openFixture(page, { mode: "in-place", doc: "imageedge", image: "1" })
        // The caret starts on the top picture's line, so render both first by moving to "middle".
        await line(page, 2).click()
        await expect(page.locator(".cm-inplace-image")).toHaveCount(2)
        // Rendered, `.cm-line` 0 is the blank below the top picture and 2 the blank above the bottom one.
        await line(page, blank).click()
        await expect(page.locator(".cm-inplace-image")).toHaveCount(2)
      }
      test("ArrowUp reaches the top picture's source and stays there", async ({ page }) => {
        await open(page, 0)
        await page.keyboard.press("ArrowUp")
        await expect(page.locator(".cm-inplace-image")).toHaveCount(1)
        expect((await caret(page)).line).toBe("![top|w120](a/b.svg)")

        await page.keyboard.press("ArrowUp") // nothing above: the source stays open
        await expect(page.locator(".cm-inplace-image")).toHaveCount(1)
        expect((await caret(page)).line).toBe("![top|w120](a/b.svg)")
      })

      test("ArrowDown reaches the bottom picture's source and stays there", async ({ page }) => {
        await open(page, 2)
        await page.keyboard.press("ArrowDown")
        await expect(page.locator(".cm-inplace-image")).toHaveCount(1)
        expect((await caret(page)).line).toBe("![bottom|h80](d.svg)")

        await page.keyboard.press("ArrowDown") // nothing below: the source stays open
        await expect(page.locator(".cm-inplace-image")).toHaveCount(1)
        expect((await caret(page)).line).toBe("![bottom|h80](d.svg)")
      })
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
    await expect(page.locator(".cm-content img.fixture-image")).toHaveCount(3) // two blocks, one in the sentence
    expect(errors).toEqual([])
  })

  test("an image inside a sentence is drawn in the line, and its source shows under the caret", async ({
    page,
  }) => {
    await openFixture(page, { mode: "in-place", doc: "image", image: "1" })
    await line(page, 0).click()
    const sentence = page.locator(".cm-content .cm-line", { hasText: "A sentence with" })
    const inline = sentence.locator(".cm-inplace-image-inline img.fixture-image")
    await expect(inline).toBeVisible()
    await expect(inline).toHaveAttribute("data-src", "c.png")
    await expect(sentence).toContainText("in it.")
    await expect(sentence).not.toContainText("![inline](c.png)")

    // The caret on the line withholds the picture and shows the source for editing.
    await sentence.click({ position: { x: 6, y: 6 } })
    await expect(sentence).toContainText("![inline](c.png)")
    await expect(inline).toHaveCount(0)
  })

  test("images in a sentence, a list, a quote and a heading are drawn; a cell, a link and code stay source on the canvas", async ({
    page,
  }) => {
    await openFixture(page, { mode: "in-place", doc: "imageinline", image: "1" })
    await line(page, 0).click() // the heading's own line is the caret's, so click it away below
    await page
      .locator(".cm-content .cm-line", { hasText: "Code" })
      .click({ position: { x: 4, y: 4 } })
    const text = page.locator(".cm-content")
    // heading is revealed under the caret only while it is on that line: move off it first
    await expect(page.locator(".cm-inplace-image-inline img.fixture-image")).toHaveCount(5)
    await expect(text).toContainText("![linked](l.svg)")
    await expect(text).toContainText("![code](k.svg)")
    // A table cell is the table widget's own: no picture, whatever it makes of the syntax.
    await expect(page.locator(".cm-inplace-table img")).toHaveCount(0)
    await expect(page.locator(".cm-inplace-table")).toContainText("cell")
  })

  test("preview and split draw an image in a cell too, and leave a link and code alone", async ({
    page,
  }) => {
    for (const mode of ["preview", "split"]) {
      await openFixture(page, { mode, doc: "imageinline", image: "1" })
      const drawn = page.locator(".stylo-image-inline img.fixture-image")
      await expect(drawn).toHaveCount(mode === "preview" ? 6 : 6) // five in lines, one in the cell
      await expect(
        page.locator(".stylo-image-inline td img, td .stylo-image-inline img"),
      ).toHaveCount(1)
      await expect(page.locator("a img[src='l.svg']")).toHaveCount(1)
      await expect(page.locator("code", { hasText: "![code](k.svg)" })).toHaveCount(1)
    }
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
