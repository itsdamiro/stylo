import { afterEach, expect, test, vi } from "vitest"
import { cleanup, render } from "@testing-library/react"
import { EditorSelection, EditorState, type Extension } from "@codemirror/state"
import { EditorView } from "@codemirror/view"
import { Stylo } from "../src/Stylo"
import { imageRegistryFacet } from "../src/inplace/config"
import { imageField } from "../src/inplace/image"
import { isWidgetLine, stepOntoWidgetLine } from "../src/inplace/widget-line-keys"
import type { EmbedSource, ImageSource } from "../src/types"

afterEach(cleanup)

const picture: ImageSource = (src, alt) => <img src={src} alt={alt} />

async function mount(
  value: string,
  imageSource?: ImageSource,
  embedSource?: EmbedSource,
  extensions?: readonly Extension[],
) {
  const result = render(
    <Stylo
      value={value}
      onChange={() => {}}
      mode="in-place"
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

test("an image inside a sentence is left as source", async () => {
  const { view } = await mount("# T\n\nsee ![a](b.png) here\n", picture)
  expect(images(view)).toEqual([])
})

test("an image in a list item, a quote, code or a table cell is left as source", async () => {
  const doc = [
    "# T",
    "",
    "- ![a](b.png)",
    "",
    "> ![c](d.png)",
    "",
    "```",
    "![e](f.png)",
    "```",
    "",
    "| a | b |",
    "| - | - |",
    "| ![g](h.png) | x |",
    "",
  ].join("\n")
  const { view } = await mount(doc, picture)
  expect(images(view)).toEqual([])
})

test("an image that continues a paragraph is left as source", async () => {
  const { view } = await mount("# T\n\nsome words\n![a](b.png)\n", picture)
  expect(images(view)).toEqual([])
})

test("an ![[embed]] is not an image, and the two passes switch on independently", async () => {
  const embed: EmbedSource = () => <span>e</span>
  const onlyImages = await mount("# T\n\n![[Note]]\n\n![a](b.png)\n", picture)
  expect(images(onlyImages.view).map((i) => i.src)).toEqual(["b.png"])
  cleanup()

  const onlyEmbeds = await mount("# T\n\n![[Note]]\n\n![a](b.png)\n", undefined, embed)
  expect(images(onlyEmbeds.view)).toEqual([])
})

test("two images on one line are left as source", async () => {
  const { view } = await mount("# T\n\n![a](b.png) ![c](d.png)\n", picture)
  expect(images(view)).toEqual([])
})

test("an image in a second paragraph of a list item is left as source", async () => {
  const { view } = await mount("# T\n\n- item\n\n  ![a](b.png)\n", picture)
  expect(images(view)).toEqual([])
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
