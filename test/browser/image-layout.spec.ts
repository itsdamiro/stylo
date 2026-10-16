import { expect, type Page, test } from "@playwright/test"
import { line, openFixture } from "./_fixture"

/**
 * Where a picture sits and how far it may go (ADR-017). The fixture centres a
 * 400 px column in the editor (`column=400`) and draws pictures 200, 450 and
 * 1500 px wide, so the narrow one is inside the column, the middle one and the
 * huge one are wider than it (the middle one fits beside the column, the huge one does not). Layout, so a real browser.
 */
const COLUMN = "400"

interface Box {
  left: number
  right: number
  width: number
}

async function boxes(page: Page, pics: string, holder: string) {
  return page.evaluate(
    ([picSel, holderSel]) => {
      const rect = (e: Element): Box => {
        const b = e.getBoundingClientRect()
        return { left: b.left, right: b.right, width: b.width }
      }
      const scroller = document.querySelector(".cm-scroller")
      return {
        pics: [...document.querySelectorAll(picSel!)].map(rect),
        holders: [...document.querySelectorAll(holderSel!)].map(rect),
        scroller: scroller ? rect(scroller) : null,
        overflow: scroller ? scroller.scrollWidth - scroller.clientWidth : 0,
      }
    },
    [pics, holder],
  )
}

const canvas = (page: Page) =>
  boxes(page, ".cm-inplace-image img.fixture-image", ".cm-inplace-image")

async function open(page: Page, extra: Record<string, string> = {}) {
  await openFixture(page, {
    mode: "in-place",
    doc: "imagewide",
    image: "1",
    column: COLUMN,
    editorHeight: "480",
    long: "1",
    ...extra,
  })
  await line(page, 0).click()
  await expect(page.locator(".cm-inplace-image img.fixture-image")).toHaveCount(3)
  // The long document scrolls, so there is a classic scrollbar for `cqw` to include.
  expect(
    await page.evaluate(() => {
      const s = document.querySelector<HTMLElement>(".cm-scroller")!
      return s.scrollHeight > s.clientHeight && s.offsetWidth - s.clientWidth
    }),
  ).toBeGreaterThan(0)
}

// Headless Chromium hides scrollbars by default; the 1rem held back for one is only tested with a real bar.
test.use({ launchOptions: { ignoreDefaultArgs: ["--hide-scrollbars"] } })

test.describe("imageWidth and imageAlign", () => {
  test("by default a picture is capped at its column and nothing scrolls sideways", async ({
    page,
  }) => {
    await open(page, { hostCap: "0" }) // the host puts no cap of its own: Stylo's holds
    const b = await canvas(page)
    expect(b.pics[0]!.width).toBe(200) // narrower than the column: untouched
    for (const i of [1, 2])
      expect(Math.round(b.pics[i]!.width)).toBe(Math.round(b.holders[i]!.width))
    expect(b.pics[2]!.right).toBeLessThanOrEqual(b.holders[2]!.right + 0.5)
    expect(b.overflow).toBe(0)
  })

  test("wide + left: a wider picture spills to the right, up to the editor's edge", async ({
    page,
  }) => {
    await open(page, { imageWidth: "wide" })
    const b = await canvas(page)
    expect(b.pics[0]!.left).toBeCloseTo(b.holders[0]!.left, 0) // starts at the column's edge
    expect(b.pics[1]!.width).toBe(450) // wider than the column, within the room
    expect(b.pics[1]!.left).toBeCloseTo(b.holders[1]!.left, 0)
    expect(b.pics[2]!.right).toBeLessThanOrEqual(b.scroller!.right) // never past the edge
    expect(b.pics[2]!.right).toBeGreaterThan(b.holders[2]!.right + 50) // and it did spill
    expect(b.overflow).toBe(0) // the scrollbar and the 1rem are allowed for
  })

  test("wide + center: a wider picture spills evenly, a narrow one is centred", async ({
    page,
  }) => {
    await open(page, { imageWidth: "wide", imageAlign: "center", hostCap: "0" })
    const b = await canvas(page)
    const mid = (x: Box) => (x.left + x.right) / 2
    for (const i of [0, 1, 2]) expect(mid(b.pics[i]!)).toBeCloseTo(mid(b.holders[i]!), 0)
    expect(b.pics[1]!.width).toBe(450)
    expect(b.pics[2]!.left).toBeGreaterThanOrEqual(b.scroller!.left)
    expect(b.pics[2]!.right).toBeLessThanOrEqual(b.scroller!.right)
    expect(b.pics[2]!.width).toBeGreaterThan(b.holders[2]!.width + 100)
    expect(b.overflow).toBe(0)
  })

  test("wide + right: a wider picture spills to the left, a narrow one sits at the right", async ({
    page,
  }) => {
    await open(page, { imageWidth: "wide", imageAlign: "right" })
    const b = await canvas(page)
    for (const i of [0, 1, 2]) expect(b.pics[i]!.right).toBeCloseTo(b.holders[i]!.right, 0)
    expect(b.pics[2]!.left).toBeGreaterThanOrEqual(b.scroller!.left)
    expect(b.pics[2]!.left).toBeLessThan(b.holders[2]!.left - 50)
    expect(b.overflow).toBe(0)
  })

  test("column + center and right place a narrow picture and still cap a wide one", async ({
    page,
  }) => {
    await open(page, { imageAlign: "center" })
    let b = await canvas(page)
    expect(b.pics[0]!.left + b.pics[0]!.width / 2).toBeCloseTo(
      b.holders[0]!.left + b.holders[0]!.width / 2,
      0,
    )
    expect(Math.round(b.pics[2]!.width)).toBe(Math.round(b.holders[2]!.width))
    await open(page, { imageAlign: "right" })
    b = await canvas(page)
    expect(b.pics[0]!.right).toBeCloseTo(b.holders[0]!.right, 0)
    expect(b.overflow).toBe(0)
  })

  test("a |full picture keeps filling the column in wide mode", async ({ page }) => {
    for (const imageAlign of ["left", "center", "right"]) {
      await openFixture(page, {
        mode: "in-place",
        doc: "imagefull",
        image: "1",
        column: COLUMN,
        imageWidth: "wide",
        imageAlign,
      })
      await line(page, 0).click()
      const b = await canvas(page)
      expect(b.pics).toHaveLength(1)
      expect(Math.round(b.pics[0]!.width)).toBe(Math.round(b.holders[0]!.width))
      expect(Math.round(b.pics[0]!.left)).toBe(Math.round(b.holders[0]!.left))
    }
  })

  test("clicks land on the right line beside wide pictures, also after the editor is resized", async ({
    page,
  }) => {
    await open(page, { imageWidth: "wide", imageAlign: "center" })
    const click = async (text: string) => {
      const target = page.locator(".cm-content .cm-line", { hasText: text })
      await target.scrollIntoViewIfNeeded()
      await target.click({ position: { x: 6, y: 6 } })
      const active = await page.evaluate(() => {
        const n = getSelection()?.anchorNode
        const el = n instanceof Element ? n : n?.parentElement
        return el?.closest(".cm-line")?.textContent
      })
      expect(active).toContain(text)
    }
    await click("Text between.")
    await click("Text after.")
    await page.evaluate(() => {
      document.getElementById("fixture")!.style.width = "520px"
    })
    await expect.poll(async () => (await canvas(page)).scroller!.width).toBeLessThan(540)
    await click("Text beside.")
    await click("Text before.")
    expect((await canvas(page)).overflow).toBe(0)
  })

  test("wide is a canvas mode: preview and split keep a picture at its column", async ({
    page,
  }) => {
    for (const [mode, imageAlign] of [
      ["preview", "center"],
      ["split", "center"],
      ["preview", "right"],
      ["split", "right"],
    ] as const) {
      await openFixture(page, {
        mode,
        doc: "imagewide",
        image: "1",
        imageWidth: "wide",
        imageAlign,
        hostCap: "0",
      })
      await expect(page.locator(".stylo-image img.fixture-image")).toHaveCount(3)
      const b = await boxes(page, ".stylo-image img.fixture-image", ".stylo-image")
      expect(Math.round(b.pics[2]!.width)).toBe(Math.round(b.holders[2]!.width))
      // imageAlign still places the narrow one, on every surface.
      const edge = (x: Box) => (imageAlign === "center" ? (x.left + x.right) / 2 : x.right)
      expect(edge(b.pics[0]!)).toBeCloseTo(edge(b.holders[0]!), 0)
    }
  })

  test("an inline picture is never wide and stays in its line", async ({ page }) => {
    await openFixture(page, {
      mode: "in-place",
      doc: "imageinline",
      image: "1",
      column: COLUMN,
      imageWidth: "wide",
      imageAlign: "center",
    })
    await line(page, 0).click()
    const inline = page.locator(".cm-inplace-image-inline img.fixture-image").first()
    await expect(inline).toBeVisible()
    const [pic, holder] = await Promise.all([
      inline.boundingBox(),
      page.locator(".cm-content .cm-line").nth(2).boundingBox(),
    ])
    expect(pic!.width).toBeLessThanOrEqual(holder!.width)
  })

  test("an inline picture wider than its line is capped at the line, on every surface", async ({
    page,
  }) => {
    for (const mode of ["in-place", "preview"]) {
      await openFixture(page, {
        mode,
        doc: "imageinlinewide",
        image: "1",
        hostCap: "0",
        imageWidth: "wide",
      })
      if (mode === "in-place") await line(page, 0).click()
      const pic = page.locator("img.fixture-image")
      await expect(pic).toHaveCount(1)
      const [p, h] = await Promise.all([
        pic.boundingBox(),
        page
          .locator(mode === "in-place" ? ".cm-content .cm-line" : "p")
          .last()
          .boundingBox(),
      ])
      expect(p!.width).toBeLessThanOrEqual(h!.width + 0.5)
      expect(p!.width).toBeGreaterThan(200)
    }
  })
})
