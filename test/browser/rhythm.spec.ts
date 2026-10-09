import { expect, test } from "@playwright/test"
import { openFixture } from "./_fixture"

/**
 * The in-place canvas and preview are two independently-authored
 * implementations of the same visual rhythm (headings, list-item spacing,
 * callout geometry) — nothing but a shared source stops them drifting apart
 * again the way h5/h6 sizing and callout padding/radius already had
 * (2026-09-13). These pin the two surfaces against each other in a real
 * browser rather than against a hard-coded number, so a future change to one
 * side without the other fails here.
 */

const DOC = [
  "# H1",
  "## H2",
  "### H3",
  "#### H4",
  "##### H5",
  "###### H6",
  "",
  "> [!note]",
  "> A callout body line.",
].join("\n")

test.use({ permissions: ["clipboard-read", "clipboard-write"] })

async function pasteInto(page: import("@playwright/test").Page, text: string) {
  await page.evaluate((t) => navigator.clipboard.writeText(t), text)
  await page.click(".cm-content")
  await page.keyboard.press("ControlOrMeta+A")
  await page.keyboard.press("ControlOrMeta+V")
}

test("heading sizes match between in-place and preview, h5/h6 included", async ({ page }) => {
  await openFixture(page, { mode: "in-place" })
  await pasteInto(page, DOC)
  const inplaceSizes: string[] = []
  for (const level of [1, 2, 3, 4, 5, 6]) {
    inplaceSizes.push(
      await page
        .locator(`.cm-inplace-h${level}`)
        .first()
        .evaluate((el) => getComputedStyle(el).fontSize),
    )
  }

  await openFixture(page, { mode: "split" })
  await pasteInto(page, DOC)
  const preview = page.locator("[class*='preview']")
  for (const [i, level] of [1, 2, 3, 4, 5, 6].entries()) {
    const size = await preview
      .locator(`h${level}`)
      .first()
      .evaluate((el) => getComputedStyle(el).fontSize)
    expect(size, `h${level} font-size`).toBe(inplaceSizes[i])
  }
})

test("callout padding and corner rounding match between in-place and preview", async ({ page }) => {
  await openFixture(page, { mode: "in-place" })
  await pasteInto(page, DOC)
  const head = page.locator(".cm-inplace-callout-head").first()
  const inplacePaddingTop = await head.evaluate((el) => getComputedStyle(el).paddingTop)
  const inplaceTopLeftRadius = await head.evaluate((el) => getComputedStyle(el).borderTopLeftRadius)
  const inplaceTopRightRadius = await head.evaluate(
    (el) => getComputedStyle(el).borderTopRightRadius,
  )

  await openFixture(page, { mode: "split" })
  await pasteInto(page, DOC)
  const callout = page.locator("[class*='preview']").locator(".stylo-callout").first()
  const style = await callout.evaluate((el) => {
    const s = getComputedStyle(el)
    return { paddingTop: s.paddingTop, tl: s.borderTopLeftRadius, tr: s.borderTopRightRadius }
  })

  expect(style.paddingTop).toBe(inplacePaddingTop)
  // Left corner square (the accent bar's own edge), right corner rounded —
  // on both surfaces, not just in-place.
  expect(style.tl).toBe("0px")
  expect(style.tl).toBe(inplaceTopLeftRadius)
  expect(style.tr).toBe(inplaceTopRightRadius)
  expect(style.tr).not.toBe("0px")
})
