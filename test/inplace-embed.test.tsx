import { afterEach, expect, test, vi } from "vitest"
import { cleanup, render } from "@testing-library/react"
import { EditorView } from "@codemirror/view"
import { Stylo } from "../src/Stylo"
import { embedField } from "../src/inplace/embed"
import { inPlacePlugin } from "../src/inplace/plugin"
import { isWidgetLine } from "../src/inplace/widget-line-keys"
import type { EmbedSource } from "../src/types"

afterEach(cleanup)

async function mount(value: string, embedSource?: EmbedSource) {
  const result = render(
    <Stylo value={value} onChange={() => {}} mode="in-place" embedSource={embedSource} />,
  )
  await vi.waitFor(() => {
    if (!result.container.querySelector(".cm-editor")) throw new Error("not mounted")
  })
  const view = EditorView.findFromDOM(result.container.querySelector(".cm-editor") as HTMLElement)
  if (!view) throw new Error("no EditorView")
  return { ...result, view }
}

/** The `![[ref]]` embed widgets currently in the field, by reference. */
function embedRefs(view: EditorView): string[] {
  const out: string[] = []
  view.state.field(embedField, false)?.between(0, view.state.doc.length, (_f, _t, deco) => {
    const ref = (deco.spec.widget as { ref?: string } | undefined)?.ref
    if (typeof ref === "string") out.push(ref)
  })
  return out
}

/** The embed widgets as `{ ref, inline, block }` tuples, in document order. */
function embedWidgets(view: EditorView): Array<{ ref: string; inline: boolean; block: boolean }> {
  const out: Array<{ ref: string; inline: boolean; block: boolean }> = []
  view.state.field(embedField, false)?.between(0, view.state.doc.length, (_f, _t, deco) => {
    const w = deco.spec.widget as { ref?: string; inline?: boolean } | undefined
    if (w && typeof w.ref === "string") {
      out.push({ ref: w.ref, inline: Boolean(w.inline), block: Boolean(deco.spec.block) })
    }
  })
  return out
}

/** Is the inner `[[ref]]` of a `![[ref]]` decorated as a wikilink? */
function hasWikilinkDecoration(view: EditorView): boolean {
  let found = false
  view.plugin(inPlacePlugin)?.decorations.between(0, view.state.doc.length, (_f, _t, deco) => {
    const c = deco.spec.class
    if (typeof c === "string" && c.includes("cm-inplace-wikilink")) found = true
  })
  return found
}

const canned: EmbedSource = (ref) => <div data-testid="resolved">resolved: {ref}</div>

test("a lone ![[ref]] line becomes an embed widget when embedSource is set", async () => {
  const { view } = await mount("# Title\n\n![[Weekly note]]\n", canned)
  expect(embedRefs(view)).toEqual(["Weekly note"])
})

test("no embedSource — no embed widget, and the inner [[ref]] still renders as a wikilink", async () => {
  const { view } = await mount("![[Weekly note]]\n")
  expect(embedRefs(view)).toEqual([])
  expect(hasWikilinkDecoration(view)).toBe(true)
})

test("with embedSource, scanWikilinks yields the [[ref]] inside a ![[ref]]", async () => {
  const { view } = await mount("![[Weekly note]]\n", canned)
  expect(hasWikilinkDecoration(view)).toBe(false)
})

test("the embed is withheld while the caret is on its line", async () => {
  const { view } = await mount("para\n\n![[Note]]\n", canned)
  expect(embedRefs(view)).toEqual(["Note"])

  const line = view.state.doc.line(3)
  view.dispatch({ selection: { anchor: line.from } })
  expect(embedRefs(view)).toEqual([])

  view.dispatch({ selection: { anchor: 0 } })
  expect(embedRefs(view)).toEqual(["Note"])
})

test("a lone ![[ref]] is a block widget; one mid-sentence is an inline widget", async () => {
  // Leading line so the default caret at 0 is not on an embed line.
  const { view } = await mount("intro\n\n![[Alone]]\n\nsee ![[One]] and ![[Two]] here\n", canned)
  expect(embedWidgets(view)).toEqual([
    { ref: "Alone", inline: false, block: true },
    { ref: "One", inline: true, block: false },
    { ref: "Two", inline: true, block: false },
  ])
})

test("an inline embed is withheld while the caret is on its line", async () => {
  const { view } = await mount("para\n\nsee ![[Note]] here\n", canned)
  expect(embedWidgets(view).map((w) => w.ref)).toEqual(["Note"])

  view.dispatch({ selection: { anchor: view.state.doc.line(3).from + 2 } })
  expect(embedWidgets(view)).toEqual([])
})

test("![[ref]] inside inline code is left literal", async () => {
  const { view } = await mount("a `![[Note]]` b\n", canned)
  expect(embedRefs(view)).toEqual([])
})

test("![[ref]] inside a table cell is left to the table widget — no embedField widget", async () => {
  const doc = "intro\n\n| a | b |\n| - | - |\n| see ![[Note]] x | ![[Solo]] |\n"
  const { view } = await mount(doc, canned)
  expect(embedRefs(view)).toEqual([])
})

// The slot DOM and the portalled host node are layout-dependent (CodeMirror
// renders no widgets into a zero-height jsdom viewport); that path is covered
// by test/browser/embed.spec.ts.

test("only a block embed makes a widget line, an inline one does not", async () => {
  const embedSource: EmbedSource = (ref) => <span>{ref}</span>
  const { view } = await mount("a\n\n![[lone]]\n\n![[starts]] a line\n", embedSource)
  expect([1, 2, 3, 4, 5].map((n) => isWidgetLine(view.state, n))).toEqual([
    false,
    false,
    true,
    false,
    false,
  ])
})
