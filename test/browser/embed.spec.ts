import { expect, type Page, test } from "@playwright/test"
import { caret, line, openFixture } from "./_fixture"

test.describe("![[embed]] on the in-place canvas", () => {
  test("portals the host node into a slot in the canvas", async ({ page }) => {
    await openFixture(page, { mode: "in-place", doc: "embed", embed: "1" })
    // Caret away from the embed line so the rendered form shows.
    await line(page, 0).click()

    const body = page.locator(".cm-content .cm-inplace-embed .fixture-embed")
    await expect(body).toBeVisible()
    await expect(body).toContainText("embed: Weekly note")
  })

  test("reveals the raw source when the caret is on the line", async ({ page }) => {
    await openFixture(page, { mode: "in-place", doc: "embed", embed: "1" })
    await line(page, 0).click()
    await expect(page.locator(".cm-inplace-embed .fixture-embed")).toBeVisible()

    // Click the slot's own box (not the host content) to drop the caret on the line.
    await page.locator(".cm-content .cm-inplace-embed").click({ position: { x: 2, y: 2 } })
    await expect(page.locator(".cm-inplace-embed")).toHaveCount(0)
    await expect(line(page, 4)).toHaveText("![[Weekly note]]")
  })

  // Rendered, `.cm-line` 3 is the blank above the embed and 4 the blank below it.
  for (const [blank, key] of [
    [3, "ArrowDown"],
    [4, "ArrowUp"],
  ] as const) {
    test(`${key} from the blank line ${blank === 3 ? "above" : "below"} reveals the source`, async ({
      page,
    }) => {
      await openFixture(page, { mode: "in-place", doc: "embed", embed: "1" })
      await line(page, 0).click()
      await line(page, blank).click()
      await expect(page.locator(".cm-inplace-embed")).toHaveCount(1)
      await page.keyboard.press(key)
      await expect(page.locator(".cm-inplace-embed")).toHaveCount(0)
      await expect(line(page, 4)).toHaveText("![[Weekly note]]")
    })
  }

  test.describe("an embed touching its neighbours", () => {
    const open = async (page: Page) => {
      await openFixture(page, { mode: "in-place", doc: "embedtight", embed: "1" })
      await expect(page.locator(".cm-inplace-embed")).toHaveCount(1)
    }
    test("ArrowUp keeps the column, clipped to the embed line", async ({ page }) => {
      await open(page)
      await line(page, 3).click() // "Text below the embed line."
      await page.keyboard.press("End")
      await page.keyboard.press("ArrowUp")
      await expect(page.locator(".cm-inplace-embed")).toHaveCount(0)
      expect(await caret(page)).toEqual({ line: "![[Weekly note]]", at: 16 })
    })

    test("ArrowDown moves through a wrapped line first, then onto the embed", async ({ page }) => {
      await open(page)
      await line(page, 2).click({ position: { x: 4, y: 4 } }) // first visual line of the paragraph
      await page.keyboard.press("Home")
      await page.keyboard.press("ArrowDown")
      await expect(page.locator(".cm-inplace-embed")).toHaveCount(1)
      expect((await caret(page)).line).toContain("A long paragraph")

      for (let i = 0; i < 12; i++) {
        if ((await page.locator(".cm-inplace-embed").count()) === 0) break
        await page.keyboard.press("ArrowDown")
      }
      expect((await caret(page)).line).toBe("![[Weekly note]]")
    })
  })

  test("a ![[ref]] mid-sentence renders inline, flowing with the text", async ({ page }) => {
    await openFixture(page, { mode: "in-place", doc: "embed", embed: "1" })
    await line(page, 0).click()

    const inline = page.locator(".cm-content .cm-inplace-embed-inline .fixture-embed")
    await expect(inline).toBeVisible()
    await expect(inline).toContainText("embed: Inline ref")
    // It sits on the same line as its surrounding words, not on its own block.
    const paraLine = page.locator(".cm-content .cm-line", { hasText: "partway through the line" })
    await expect(paraLine.locator(".cm-inplace-embed-inline")).toHaveCount(1)
  })

  test("![[ref]] in an editable table cell stays literal — no embed, no chip", async ({ page }) => {
    await openFixture(page, { mode: "in-place", doc: "embed", embed: "1", table: "cells" })
    await line(page, 0).click()

    const cell = page.locator(".cm-inplace-table-edit td", { hasText: "see" })
    await expect(cell).toContainText("see ![[Cell ref]] here")
    await expect(cell.locator(".fixture-embed")).toHaveCount(0)
    await expect(cell.locator(".cm-inplace-wikilink")).toHaveCount(0)
  })

  test("interactive host content keeps its own clicks", async ({ page }) => {
    await openFixture(page, { mode: "in-place", doc: "embed", embed: "1" })
    await line(page, 0).click()

    const button = page.locator(".cm-inplace-embed .fixture-embed button")
    await button.click()
    // The click did not collapse the embed to raw source.
    await expect(page.locator(".cm-inplace-embed .fixture-embed")).toBeVisible()
  })

  test("clicking a line below the embed lands there", async ({ page }) => {
    // `.cm-inplace-embed` uses `padding`, not `margin`, for its vertical
    // spacing — the same rule every other block widget got in the
    // 2026-09-02 click-mapping pass (margin sits outside the border box
    // CodeMirror's height map measures, which drifts click-to-position for
    // everything below). A real user report confirmed this drift; this is a
    // basic regression guard for the fix.
    await openFixture(page, { mode: "in-place", doc: "embed", embed: "1" })
    await line(page, 0).click()
    await expect(page.locator(".cm-inplace-embed .fixture-embed")).toBeVisible()

    const after = page.locator(".cm-content .cm-line", { hasText: "Text after the embed." })
    await after.click()

    const landedInside = await after.evaluate((el) => {
      const sel = el.ownerDocument.getSelection()
      const node = sel?.anchorNode
      if (!node) return false
      return el.contains(node instanceof Element ? node : node.parentElement)
    })
    expect(landedInside).toBe(true)
  })

  test("without embedSource the reference stays a literal ! plus a wikilink chip", async ({
    page,
  }) => {
    await openFixture(page, { mode: "in-place", doc: "embed" })
    await line(page, 0).click()

    await expect(page.locator(".cm-inplace-embed")).toHaveCount(0)
    await expect(page.locator(".cm-inplace-embed-inline")).toHaveCount(0)
    await expect(page.locator(".cm-content .cm-inplace-wikilink").first()).toHaveText("Weekly note")
  })
})
