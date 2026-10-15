import { afterEach, expect, test, vi } from "vitest"
import { cleanup, render } from "@testing-library/react"
import { EditorSelection, EditorState, type Extension } from "@codemirror/state"
import { EditorView } from "@codemirror/view"
import { Stylo } from "../src/Stylo"
import { imageRegistryFacet } from "../src/inplace/config"
import { ImageWidget, imageField } from "../src/inplace/image"
import { EmbedRegistry } from "../src/inplace/embed-registry"
import { isWidgetLine, stepOntoWidgetLine } from "../src/inplace/widget-line-keys"
import type { EmbedSource, ImageSource } from "../src/types"

afterEach(cleanup)

const picture: ImageSource = (src, alt) => <img src={src} alt={alt} />

async function mount(
  value: string,
  imageSource?: ImageSource,
  embedSource?: EmbedSource,
  extensions?: readonly Extension[],
  readOnly = false,
) {
  const result = render(
    <Stylo
      value={value}
      onChange={() => {}}
      mode="in-place"
      readOnly={readOnly}
      imageSource={imageSource}
      embedSource={embedSource}
      extensions={extensions}
    />,
  )
  await vi.waitFor(() => {
    if (!result.container.querySelector(".cm-editor")) throw new Error("not mounted")
  })
  const view = EditorView.findFromDOM(result.container.querySelector(".cm-editor") as HTMLElement)
  if (!view) throw new Error("no EditorView")
  return { ...result, view }
}

interface Found {
  src: string
  alt: string
  raw: string
  block: boolean
}

/** The image widgets currently in the field, in document order. */
function images(view: EditorView): Found[] {
  const out: Found[] = []
  view.state.field(imageField, false)?.between(0, view.state.doc.length, (_f, _t, deco) => {
    const w = deco.spec.widget as { src?: string; alt?: string; raw?: string } | undefined
    if (w && typeof w.src === "string") {
      out.push({ src: w.src, alt: w.alt ?? "", raw: w.raw ?? "", block: Boolean(deco.spec.block) })
    }
  })
  return out
}

test("a lone image line becomes a block widget with src and alt as written", async () => {
  const { view } = await mount("# T\n\n![logo|w300](a/b.svg)\n", picture)
  expect(images(view)).toEqual([
    { src: "a/b.svg", alt: "logo|w300", raw: "![logo|w300](a/b.svg)", block: true },
  ])
})

test("a data: source and an angle-bracket destination are passed as written", async () => {
  const { view } = await mount(
    "# T\n\n![a](data:image/png;base64,AAAA)\n\n![b](<my file.png> 'x')\n",
    picture,
  )
  expect(images(view).map((i) => i.src)).toEqual(["data:image/png;base64,AAAA", "my file.png"])
})

test("no imageSource — no image widget, today's behaviour", async () => {
  const { view } = await mount("# T\n\n![logo](a.svg)\n")
  expect(images(view)).toEqual([])
})

test("the image is withheld while the caret is on its line", async () => {
  const { view } = await mount("para\n\n![logo](a.svg)\n", picture)
  expect(images(view)).toHaveLength(1)

  view.dispatch({ selection: { anchor: view.state.doc.line(3).from + 3 } })
  expect(images(view)).toEqual([])

  view.dispatch({ selection: { anchor: 0 } })
  expect(images(view)).toHaveLength(1)
})

test("an image inside a sentence is an inline widget with src and alt as written", async () => {
  const { view } = await mount("# T\n\nsee ![a|w50](b.png) here\n", picture)
  expect(images(view)).toEqual([
    { src: "b.png", alt: "a|w50", raw: "![a|w50](b.png)", block: false },
  ])
  expect(isWidgetLine(view.state, 3)).toBe(false) // inline: not a widget line
})

test("an image in a list item, a quote or a heading is an inline widget", async () => {
  const doc = "para\n\n# T ![h](h.png)\n\n- ![a](b.png)\n\n> ![c](d.png)\n"
  const { view } = await mount(doc, picture)
  expect(images(view).map((i) => [i.src, i.block])).toEqual([
    ["h.png", false],
    ["b.png", false],
    ["d.png", false],
  ])
})

test("an image in code, a link or a table cell is left as source", async () => {
  const doc = [
    "# T",
    "",
    "```",
    "![e](f.png)",
    "```",
    "",
    "`![i](j.png)` and [![l](m.png)](https://x.test)",
    "",
    "| a | b |",
    "| - | - |",
    "| ![g](h.png) | x |",
    "",
  ].join("\n")
  const { view } = await mount(doc, picture)
  expect(images(view)).toEqual([])
})

test("an image that continues a paragraph is an inline widget", async () => {
  const { view } = await mount("# T\n\nsome words\n![a](b.png)\n", picture)
  expect(images(view).map((i) => [i.src, i.block])).toEqual([["b.png", false]])
})

test("two images on one line are two inline widgets", async () => {
  const { view } = await mount("# T\n\n![a](b.png) ![c](d.png)\n", picture)
  expect(images(view).map((i) => [i.src, i.block])).toEqual([
    ["b.png", false],
    ["d.png", false],
  ])
})

test("an image in a second paragraph of a list item is an inline widget", async () => {
  const { view } = await mount("# T\n\n- item\n\n  ![a](b.png)\n", picture)
  expect(images(view).map((i) => [i.src, i.block])).toEqual([["b.png", false]])
})

test("an inline image is withheld while the caret is on its line, and read-only keeps it", async () => {
  const doc = "para\n\nsee ![a](b.png) here\n"
  const { view } = await mount(doc, picture)
  expect(images(view)).toHaveLength(1)
  view.dispatch({ selection: { anchor: view.state.doc.line(3).from + 2 } })
  expect(images(view)).toEqual([])
  view.dispatch({ selection: { anchor: 0 } })
  expect(images(view)).toHaveLength(1)
  cleanup()

  const readOnly = await mount(doc, picture, undefined, undefined, true)
  readOnly.view.dispatch({ selection: { anchor: readOnly.view.state.doc.line(3).from + 2 } })
  expect(images(readOnly.view)).toHaveLength(1)
})

test("an inline image portals the host node into a span slot, a block one into a div", async () => {
  const { container, view } = await mount("# T\n\nsee ![a](b.png) here\n\n![c](d.png)\n", picture)
  await vi.waitFor(() => {
    if (!container.querySelector("span.cm-inplace-image-inline img")) throw new Error("no slot")
    if (!container.querySelector("div.cm-inplace-image img")) throw new Error("no block slot")
  })
  // The wrapper `Embed` draws follows the slot's shape: phrasing content in a line.
  expect(
    container.querySelector("span.cm-inplace-image-inline > span.stylo-embed-inline"),
  ).not.toBeNull()
  expect(container.querySelector("div.cm-inplace-image > div.stylo-embed-content")).not.toBeNull()
  expect(view.state.doc.line(3).text).toBe("see ![a](b.png) here")
})

test("a block picture replaces its whole line, spaces around it included, as preview draws it", async () => {
  const { view } = await mount("para\n\n  ![a](b.png)  \n", picture)
  const line = view.state.doc.line(3)
  const ranges: [number, number][] = []
  view.state.field(imageField).between(0, view.state.doc.length, (from, to) => {
    ranges.push([from, to])
  })
  expect(ranges).toEqual([[line.from, line.to]])
})

test("an image that spans two lines is left as source", async () => {
  const { view } = await mount("# T\n\nsee ![a\nb](c.png) here\n", picture)
  expect(images(view)).toEqual([])
})

test("an image that starts on an earlier line is not drawn from the line it ends on", async () => {
  const { view } = await mount("# T\n\nsee ![a\nb](c.png) and ![d](e.png)\n", picture)
  expect(images(view).map((i) => i.src)).toEqual(["e.png"])
})

test("a block widget and an inline one with the same text are not equal", () => {
  const registry = new EmbedRegistry()
  const block = new ImageWidget("![a](b.png)", "b.png", "a", registry, false)
  expect(block.eq(new ImageWidget("![a](b.png)", "b.png", "a", registry, false))).toBe(true)
  expect(block.eq(new ImageWidget("![a](b.png)", "b.png", "a", registry, true))).toBe(false)
})

test("an ![[embed]] is not an image, and the two passes switch on independently", async () => {
  const embed: EmbedSource = () => <span>e</span>
  const onlyImages = await mount("# T\n\n![[Note]]\n\n![a](b.png)\n", picture)
  expect(images(onlyImages.view).map((i) => i.src)).toEqual(["b.png"])
  cleanup()

  const onlyEmbeds = await mount("# T\n\n![[Note]]\n\n![a](b.png)\n", undefined, embed)
  expect(images(onlyEmbeds.view)).toEqual([])
})

test("an edit that adds an image line draws it without a selection change", async () => {
  const { view } = await mount("para\n", picture)
  expect(images(view)).toEqual([])
  view.dispatch({ changes: { from: view.state.doc.length, insert: "\n![a](b.png)\n" } })
  expect(images(view).map((i) => i.src)).toEqual(["b.png"])
})

test("the caret can step over a rendered image", async () => {
  const { view } = await mount("para\n\n![logo](a.svg)\n", picture)
  const covered = view.state.facet(EditorView.atomicRanges).some((get) => {
    let found = false
    get(view).between(0, view.state.doc.length, () => {
      found = true
    })
    return found
  })
  expect(covered).toBe(true)
})

test("deleting an image line takes its slot out of the registry", async () => {
  const { view } = await mount("para\n\n![logo](a.svg)\n", picture)
  const registry = view.state.facet(imageRegistryFacet)
  if (!registry) throw new Error("no registry")
  const slots = () => registry.getSnapshot().filter((s) => s.image)
  await vi.waitFor(() => expect(slots()).toHaveLength(1))

  view.dispatch({ changes: { from: 4, to: view.state.doc.length, insert: "" } })
  await vi.waitFor(() => expect(slots()).toHaveLength(0))
})

// The slot DOM and the portalled host node are layout-dependent (CodeMirror
// renders no widgets into a zero-height jsdom viewport); that path is covered
// by test/browser/image.spec.ts.

test("a line replaced by an image widget is a widget line, the caret's own line is not", async () => {
  const { view } = await mount("para\n\n![logo](a.svg)\n\nafter\n", picture)
  expect([1, 2, 3, 4, 5].map((n) => isWidgetLine(view.state, n))).toEqual([
    false,
    false,
    true,
    false,
    false,
  ])
  expect(isWidgetLine(view.state, 0)).toBe(false)
  expect(isWidgetLine(view.state, view.state.doc.lines + 1)).toBe(false) // where ArrowDown on the last line looks

  view.dispatch({ selection: { anchor: view.state.doc.line(3).from + 3 } })
  expect(isWidgetLine(view.state, 3)).toBe(false)
})

test("a widget on the first or the last line of the document is a widget line", async () => {
  const { view } = await mount("![top](a.svg)\n\npara\n\n![bottom](b.svg)", picture)
  const last = view.state.doc.lines
  view.dispatch({ selection: { anchor: view.state.doc.line(3).from } })
  expect([1, last].map((n) => isWidgetLine(view.state, n))).toEqual([true, true])
  expect(isWidgetLine(view.state, 0)).toBe(false)
  expect(isWidgetLine(view.state, last + 1)).toBe(false)
})

test("a lone embed is a widget line, an inline embed, block math and plain text are not", async () => {
  const embed: EmbedSource = () => <span>e</span>
  const { view } = await mount(
    "para\n\n![[Note]]\n\nsee ![[Inline]] here\n\n$$\nx^2\n$$\n\nend\n",
    undefined,
    embed,
  )
  const lines = view.state.doc.lines
  const flags = Array.from({ length: lines }, (_, i) => isWidgetLine(view.state, i + 1))
  expect(flags.map((on, i) => (on ? i + 1 : 0)).filter(Boolean)).toEqual([3]) // the lone embed only
})

test("read-only keeps a picture drawn with the caret on its line", async () => {
  const { view } = await mount("para\n\n![logo](a.svg)\n", picture, undefined, undefined, true)
  expect(images(view)).toHaveLength(1)
  view.dispatch({ selection: { anchor: view.state.doc.line(3).from + 3 } })
  expect(images(view)).toHaveLength(1)
  expect(isWidgetLine(view.state, 3)).toBe(true)
})

test("a picture under the caret is drawn again when the note turns read-only", async () => {
  const doc = "para\n\n![logo](a.svg)\n"
  const element = (readOnly: boolean) => (
    <Stylo
      value={doc}
      onChange={() => {}}
      mode="in-place"
      imageSource={picture}
      readOnly={readOnly}
    />
  )
  const result = render(element(false))
  await vi.waitFor(() => {
    if (!result.container.querySelector(".cm-editor")) throw new Error("not mounted")
  })
  const view = EditorView.findFromDOM(result.container.querySelector(".cm-editor") as HTMLElement)
  if (!view) throw new Error("no EditorView")

  view.dispatch({ selection: { anchor: view.state.doc.line(3).from + 3 } })
  expect(images(view)).toEqual([]) // editable: the caret reveals the source

  result.rerender(element(true))
  await vi.waitFor(() => expect(images(view)).toHaveLength(1))

  result.rerender(element(false))
  await vi.waitFor(() => expect(images(view)).toEqual([]))
})

test("the arrow steps are left to CodeMirror with more than one cursor", async () => {
  const { view } = await mount("para\n\n![logo](a.svg)\n", picture, undefined, [
    EditorState.allowMultipleSelections.of(true),
  ])
  const blankAbove = view.state.doc.line(2).from
  view.dispatch({
    selection: EditorSelection.create([
      EditorSelection.cursor(blankAbove),
      EditorSelection.cursor(0),
    ]),
  })
  expect(view.state.selection.ranges).toHaveLength(2)

  expect(stepOntoWidgetLine(true)(view)).toBe(false)
  expect(view.state.selection.ranges).toHaveLength(2)
})
