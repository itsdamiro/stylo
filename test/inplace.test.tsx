import { afterEach, expect, test, vi } from "vitest"
import { cleanup, render } from "@testing-library/react"
import { EditorView, type WidgetType } from "@codemirror/view"
import { Stylo } from "../src/Stylo"
import { frontmatterField } from "../src/inplace/frontmatter"
import { blockMathField } from "../src/inplace/math"
import { removeHiddenRule } from "../src/inplace/edit-divider"
import { inPlacePlugin } from "../src/inplace/plugin"
import { tableField } from "../src/inplace/tables"
import { BulletWidget, CheckboxWidget, HrWidget } from "../src/inplace/widgets"
import type { InPlaceConfig } from "../src/types"

afterEach(cleanup)

async function mount(value: string, inPlace?: InPlaceConfig) {
  const result = render(
    <Stylo value={value} onChange={() => {}} mode="in-place" inPlace={inPlace} />,
  )
  // The in-place surface is a lazy chunk — wait for the editor to attach.
  await vi.waitFor(() => {
    if (!result.container.querySelector(".cm-editor")) throw new Error("not mounted")
  })
  const view = EditorView.findFromDOM(result.container.querySelector(".cm-editor") as HTMLElement)
  if (!view) throw new Error("no EditorView")
  return { ...result, view }
}

/** Does the live decoration set hide a marker range (a bare replace decoration)? */
function hidesAMarker(view: EditorView): boolean {
  const set = view.plugin(inPlacePlugin)?.decorations
  if (!set) return false
  let found = false
  set.between(0, view.state.doc.length, (from, to, deco) => {
    if (from < to && !deco.spec.class && !deco.spec.widget) found = true
  })
  return found
}

/** The math widgets currently rendered — from the plugin and the block field. */
function mathWidgets(view: EditorView): { src: string; block: boolean }[] {
  const found: { src: string; block: boolean }[] = []
  const collect = (set: import("@codemirror/view").DecorationSet | undefined) => {
    set?.between(0, view.state.doc.length, (_from, _to, deco) => {
      const w = deco.spec.widget as { src?: string; block?: boolean } | undefined
      if (w && typeof w.src === "string") found.push({ src: w.src, block: Boolean(w.block) })
    })
  }
  collect(view.plugin(inPlacePlugin)?.decorations)
  collect(view.state.field(blockMathField, false)?.decorations)
  return found
}

/** Count the widget decorations of a given type in the plugin's set. */
function countWidgets(view: EditorView, Ctor: abstract new (...args: never[]) => unknown): number {
  let n = 0
  view.plugin(inPlacePlugin)?.decorations.between(0, view.state.doc.length, (_f, _t, deco) => {
    if (deco.spec.widget instanceof Ctor) n += 1
  })
  return n
}

/** Is there a decoration carrying `className` anywhere in the document? */
function hasClass(view: EditorView, className: string): boolean {
  const set = view.plugin(inPlacePlugin)?.decorations
  if (!set) return false
  let found = false
  set.between(0, view.state.doc.length, (_from, _to, deco) => {
    const c = deco.spec.class
    if (typeof c === "string" && c.includes(className)) found = true
  })
  return found
}

/** Every line-decoration class applied to a given 1-based line, merged into one string. */
function lineClasses(view: EditorView, lineNumber: number): string {
  const set = view.plugin(inPlacePlugin)?.decorations
  if (!set) return ""
  const { from } = view.state.doc.line(lineNumber)
  const classes: string[] = []
  set.between(from, from, (_f, _t, deco) => {
    const c = deco.spec.class
    if (typeof c === "string") classes.push(c)
  })
  return classes.join(" ")
}

test("in-place mounts a CodeMirror surface, no warnings", async () => {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
  const { container } = await mount("# Title\n\nbody")

  expect(container.querySelector(".cm-editor")).not.toBeNull()
  expect(container.querySelector('[data-stylo-mode="in-place"]')).not.toBeNull()
  expect(warn).not.toHaveBeenCalled()

  warn.mockRestore()
})

test("a heading carries a display-size line decoration", async () => {
  const { view } = await mount("# Title\n\nbody")
  expect(hasClass(view, "cm-inplace-h1")).toBe(true)
})

test("a heading line exposes ARIA heading semantics", async () => {
  const { view } = await mount("# One\n\n### Three\n\nbody")
  view.dispatch({ selection: { anchor: view.state.doc.length } })

  const h1 = view.contentDOM.querySelector<HTMLElement>(".cm-inplace-h1")
  expect(h1?.getAttribute("role")).toBe("heading")
  expect(h1?.getAttribute("aria-level")).toBe("1")

  const h3 = view.contentDOM.querySelector<HTMLElement>(".cm-inplace-h3")
  expect(h3?.getAttribute("aria-level")).toBe("3")

  const lines = [...view.contentDOM.querySelectorAll<HTMLElement>(".cm-line")]
  const body = lines.find((l) => l.textContent === "body")
  expect(body?.hasAttribute("role")).toBe(false)
})

test("a Setext heading line exposes ARIA heading semantics too", async () => {
  const { view } = await mount("My Title\n===\n\nbody")
  view.dispatch({ selection: { anchor: view.state.doc.length } })

  const h1 = view.contentDOM.querySelector<HTMLElement>(".cm-inplace-h1")
  expect(h1?.textContent).toBe("My Title")
  expect(h1?.getAttribute("role")).toBe("heading")
  expect(h1?.getAttribute("aria-level")).toBe("1")
})

test("the # marker is hidden off the heading line and revealed on it", async () => {
  const { view } = await mount("# Title\n\nbody")

  view.dispatch({ selection: { anchor: view.state.doc.length } })
  expect(hidesAMarker(view)).toBe(true)

  view.dispatch({ selection: { anchor: 1 } })
  expect(hidesAMarker(view)).toBe(false)
})

test("bold text is styled and its ** markers hide off-line, reveal on-line", async () => {
  const { view } = await mount("normal **bold** normal\n\nsecond line")

  view.dispatch({ selection: { anchor: view.state.doc.length } })
  expect(hasClass(view, "cm-inplace-strong")).toBe(true)
  expect(hidesAMarker(view)).toBe(true)

  view.dispatch({ selection: { anchor: 10 } }) // inside "bold"
  expect(hidesAMarker(view)).toBe(false)
})

test("reveal: 'never' keeps the ** markers hidden even with the caret on the line", async () => {
  const { view } = await mount("normal **bold** normal\n\nsecond line", { reveal: "never" })

  view.dispatch({ selection: { anchor: 10 } }) // inside "bold"
  expect(hasClass(view, "cm-inplace-strong")).toBe(true)
  expect(hidesAMarker(view)).toBe(true)

  view.dispatch({ selection: { anchor: 1 } }) // start of the line
  expect(hidesAMarker(view)).toBe(true)
})

test("reveal: 'never' keeps inline $…$ math a widget with the caret on it", async () => {
  const { view } = await mount("before $x^2$ after\n\ntail", { reveal: "never" })

  view.dispatch({ selection: { anchor: view.state.doc.length } })
  expect(mathWidgets(view).some((w) => !w.block)).toBe(true)

  view.dispatch({ selection: { anchor: 9 } }) // inside the math
  expect(mathWidgets(view).some((w) => !w.block)).toBe(true) // still a widget, no raw source
  expect(hidesAMarker(view)).toBe(false) // the whole span is a widget, not a hidden marker
})

test("reveal: 'caret' still reveals inline $…$ math source on-caret", async () => {
  const { view } = await mount("before $x^2$ after\n\ntail", { reveal: "caret" })

  view.dispatch({ selection: { anchor: 9 } }) // inside the math
  expect(mathWidgets(view).some((w) => !w.block)).toBe(false) // raw source shown
})

test("italic, strikethrough, and inline code each get a decoration", async () => {
  const { view } = await mount("an *emphasis*, a ~~strike~~, and `code` here\n\nx")

  expect(hasClass(view, "cm-inplace-em")).toBe(true)
  expect(hasClass(view, "cm-inplace-strike")).toBe(true)
  expect(hasClass(view, "cm-inplace-code")).toBe(true)
})

test("nested list lines get an indent-guide decoration; a flat list gets none", async () => {
  const flat = await mount("- a\n- b\n- c")
  expect(hasClass(flat.view, "cm-inplace-li")).toBe(false)

  const nested = await mount("- a\n  - b\n    - c")
  expect(hasClass(nested.view, "cm-inplace-li")).toBe(true)
})

test("every list item but the first in its own list gets a gap above it", async () => {
  const { view } = await mount("- a\n- b\n  - b1\n  - b2\n- c")
  // "- a" (line 1): first item of the top-level list — no gap.
  expect(lineClasses(view, 1)).not.toMatch(/cm-inplace-item-gap/)
  // "- b" (line 2): second top-level item — the plain gap.
  expect(lineClasses(view, 2)).toContain("cm-inplace-item-gap")
  expect(lineClasses(view, 2)).not.toContain("cm-inplace-item-gap-nested")
  // "  - b1" (line 3): first item of a nested list — the larger nested gap.
  expect(lineClasses(view, 3)).toContain("cm-inplace-item-gap-nested")
  // "  - b2" (line 4): second item of that nested list — the plain gap again.
  expect(lineClasses(view, 4)).toContain("cm-inplace-item-gap")
  expect(lineClasses(view, 4)).not.toContain("cm-inplace-item-gap-nested")
  // "- c" (line 5): back at the top level, not first — the plain gap.
  expect(lineClasses(view, 5)).toContain("cm-inplace-item-gap")
})

test("emphasis inside a heading is still decorated", async () => {
  const { view } = await mount("## has **bold** inside\n\nsecond line")

  expect(hasClass(view, "cm-inplace-h2")).toBe(true)
  expect(hasClass(view, "cm-inplace-strong")).toBe(true)
})

test("a `> [!type]` blockquote becomes a callout; a plain one stays a quote", async () => {
  const callout = await mount("> [!tip] Handy\n> body\n\nx")
  expect(hasClass(callout.view, "cm-inplace-callout-tip")).toBe(true)
  expect(hasClass(callout.view, "cm-inplace-callout-head")).toBe(true)

  const warn = await mount("> [!warning] Careful\n\nx")
  expect(hasClass(warn.view, "cm-inplace-callout-warn")).toBe(true)

  const plain = await mount("> just a quote\n\nx")
  expect(hasClass(plain.view, "cm-inplace-quote")).toBe(true)
  expect(hasClass(plain.view, "cm-inplace-callout")).toBe(false)
})

test("a standard link is styled and its syntax hides off-line, reveals on-line", async () => {
  const { view } = await mount("see [the docs](https://x.dev) now\n\nsecond line")

  view.dispatch({ selection: { anchor: view.state.doc.length } })
  expect(hasClass(view, "cm-inplace-link")).toBe(true)
  expect(hidesAMarker(view)).toBe(true)

  view.dispatch({ selection: { anchor: 7 } }) // inside the link text
  expect(hidesAMarker(view)).toBe(false)
})

/** How many bare marker-hiding replace ranges the live set has. */
function hiddenMarkerCount(view: EditorView): number {
  const set = view.plugin(inPlacePlugin)?.decorations
  if (!set) return 0
  let n = 0
  set.between(0, view.state.doc.length, (from, to, deco) => {
    if (from < to && !deco.spec.class && !deco.spec.widget) n += 1
  })
  return n
}

test("a bold link (**[text](url)**) hides every marker and styles the text", async () => {
  const { view } = await mount("see **[the docs](https://x.dev)** now\n\ntail", { reveal: "never" })
  expect(hasClass(view, "cm-inplace-strong")).toBe(true)
  expect(hasClass(view, "cm-inplace-link")).toBe(true)
  // ** open, ** close, [ , ](https://x.dev)  — all four hidden, no literal marks.
  expect(hiddenMarkerCount(view)).toBe(4)
})

test("emphasis inside a link label (`[**text**](url)`) also gets its marks hidden", async () => {
  const { view } = await mount("see [**the docs**](https://x.dev) now\n\ntail", { reveal: "never" })
  expect(hasClass(view, "cm-inplace-strong")).toBe(true)
  expect(hiddenMarkerCount(view)).toBe(4) // [ , ](url), ** , **
})

test("a wikilink collapses to its label and carries the target", async () => {
  const { view } = await mount("go to [[Notes/Home|home]] please\n\nsecond line")
  view.dispatch({ selection: { anchor: view.state.doc.length } })

  let target: string | undefined
  view.plugin(inPlacePlugin)!.decorations.between(0, view.state.doc.length, (_f, _t, deco) => {
    const attrs = deco.spec.attributes as Record<string, string> | undefined
    if (attrs && attrs["data-stylo-wikilink"]) target = attrs["data-stylo-wikilink"]
  })
  expect(target).toBe("Notes/Home")
  expect(hidesAMarker(view)).toBe(true)
})

test("a wikilink inside inline code is left as literal text", async () => {
  const { view } = await mount("literal `[[Note]]` here\n\nsecond line")
  expect(hasClass(view, "cm-inplace-wikilink")).toBe(false)
})

test("inline and block math become widgets off-line, source on-line", async () => {
  const { view } = await mount("text $a+b$ more\n\n$$\nx^2\n$$\n\ntail")

  view.dispatch({ selection: { anchor: view.state.doc.length } })
  const widgets = mathWidgets(view)
  expect(widgets.some((w) => !w.block && w.src === "a+b")).toBe(true)
  expect(widgets.some((w) => w.block && w.src.includes("x^2"))).toBe(true)

  view.dispatch({ selection: { anchor: 6 } }) // onto the inline-math line
  expect(mathWidgets(view).some((w) => w.src === "a+b")).toBe(false)
})

test("$100 and $200 is not treated as math", async () => {
  const { view } = await mount("it costs $100 and $200 total\n\ntail")
  view.dispatch({ selection: { anchor: view.state.doc.length } })
  expect(mathWidgets(view)).toHaveLength(0)
})

test("math inside inline code is left literal", async () => {
  const { view } = await mount("literal `$x$` here\n\ntail")
  view.dispatch({ selection: { anchor: view.state.doc.length } })
  expect(mathWidgets(view)).toHaveLength(0)
})

test("frontmatter lines are recessed in place, fences hidden off-caret, no widget", async () => {
  const { view } = await mount("---\ntitle: x\ntags: [a]\n---\n\n# Body")
  view.dispatch({ selection: { anchor: view.state.doc.length } })

  const set = view.state.field(frontmatterField)
  let classes = ""
  let hiddenFences = 0
  set.between(0, view.state.doc.length, (from, to, deco) => {
    expect(deco.spec.widget).toBeUndefined() // never a block widget — it would fold the rows
    if (typeof deco.spec.class === "string") classes += ` ${deco.spec.class}`
    else if (from < to) hiddenFences += 1
  })
  expect(classes).toContain("cm-inplace-fm")
  expect(classes).toContain("cm-inplace-fm-first")
  expect(hiddenFences).toBe(2) // the opening and closing ---

  view.dispatch({ selection: { anchor: view.state.doc.line(2).from } }) // caret into the block
  let stillHidden = 0
  view.state.field(frontmatterField).between(0, view.state.doc.length, (from, to, deco) => {
    if (typeof deco.spec.class !== "string" && from < to) stillHidden += 1
  })
  expect(stillHidden).toBe(0) // --- fences shown while editing
})

test("a horizontal rule becomes a widget off-line, source on-line", async () => {
  const { view } = await mount("above\n\n---\n\nbelow")

  view.dispatch({ selection: { anchor: view.state.doc.length } })
  expect(countWidgets(view, HrWidget)).toBe(1)

  view.dispatch({ selection: { anchor: view.state.doc.line(3).from } })
  expect(countWidgets(view, HrWidget)).toBe(0)
})

test("reveal: 'never' keeps the rule a widget with the caret on it, and Backspace removes it", async () => {
  const { view } = await mount("above\n\n---\n\nbelow", { reveal: "never" })

  view.dispatch({ selection: { anchor: view.state.doc.length } })
  expect(countWidgets(view, HrWidget)).toBe(1) // widget off-caret

  view.dispatch({ selection: { anchor: view.state.doc.line(3).from } }) // onto the `---`
  expect(countWidgets(view, HrWidget)).toBe(1) // still a widget — no raw source
  expect(hidesAMarker(view)).toBe(false) // the whole line is a widget, not a hidden marker

  expect(removeHiddenRule(view)).toBe(true) // Backspace / Delete on the rule
  expect(view.state.doc.toString()).toBe("above\n\n\nbelow")
  expect(countWidgets(view, HrWidget)).toBe(0)
})

test("reveal: 'caret' still reveals the rule's source on the line — removeHiddenRule no-ops", async () => {
  const { view } = await mount("above\n\n---\n\nbelow", { reveal: "caret" })

  view.dispatch({ selection: { anchor: view.state.doc.line(3).from } }) // onto the `---`
  expect(countWidgets(view, HrWidget)).toBe(0) // raw `---` shown for editing
  expect(removeHiddenRule(view)).toBe(false) // the keymap yields to a normal edit
})

test("a Setext heading (text then `---`) styles the text and hides the underline", async () => {
  const { view } = await mount("My Title\n---\n\nbody", { reveal: "never" })
  view.dispatch({ selection: { anchor: view.state.doc.length } })

  expect(hasClass(view, "cm-inplace-h2")).toBe(true) // "My Title" styled as H2
  expect(hasClass(view, "cm-inplace-setext-rule")).toBe(true) // underline row collapsed
  expect(hidesAMarker(view)).toBe(true) // the `---` is hidden, not literal

  view.dispatch({ selection: { anchor: view.state.doc.line(2).from } }) // onto the `---`
  expect(hidesAMarker(view)).toBe(false) // underline shown again for editing
  expect(hasClass(view, "cm-inplace-h2")).toBe(true) // heading size kept
})

test("a Setext H1 (`===`) is styled too", async () => {
  const { view } = await mount("Big Title\n===\n\nbody", { reveal: "never" })
  view.dispatch({ selection: { anchor: view.state.doc.length } })
  expect(hasClass(view, "cm-inplace-h1")).toBe(true)
})

test("blockquote lines get the quote class and > hides off-caret, reveals on-caret", async () => {
  const { view } = await mount("> quoted\n\ntail")
  view.dispatch({ selection: { anchor: view.state.doc.length } })

  expect(hasClass(view, "cm-inplace-quote")).toBe(true)
  expect(hidesAMarker(view)).toBe(true)

  view.dispatch({ selection: { anchor: 0 } }) // onto the quoted line
  expect(hidesAMarker(view)).toBe(false)
})

test("fenced code: mono container, fences emptied off-block and shown on-caret", async () => {
  const { view } = await mount("text\n\n```ts\nconst a = 1\n```\n\ntail")

  const emptiedFenceLines = () => {
    let n = 0
    view.plugin(inPlacePlugin)!.decorations.between(0, view.state.doc.length, (from, to, deco) => {
      if (from < to && !deco.spec.class && !deco.spec.widget) n += 1
    })
    return n
  }

  expect(hasClass(view, "cm-inplace-mono")).toBe(true)
  expect(hasClass(view, "cm-inplace-code-top")).toBe(true)
  expect(hasClass(view, "cm-inplace-code-pad")).toBe(true) // fence rows collapsed off-block
  expect(emptiedFenceLines()).toBe(2) // ``` text hidden

  view.dispatch({ selection: { anchor: view.state.doc.line(4).from } })
  expect(emptiedFenceLines()).toBe(0)
  expect(hasClass(view, "cm-inplace-fence")).toBe(true) // fences shown, muted, on-caret
})

test("reveal: 'never' keeps a fenced block's ``` hidden even with the caret in it", async () => {
  const { view } = await mount("text\n\n```ts\nconst a = 1\n```\n\ntail", { reveal: "never" })

  const emptiedFenceLines = () => {
    let n = 0
    view.plugin(inPlacePlugin)!.decorations.between(0, view.state.doc.length, (from, to, deco) => {
      if (from < to && !deco.spec.class && !deco.spec.widget) n += 1
    })
    return n
  }

  view.dispatch({ selection: { anchor: view.state.doc.length } }) // caret on "tail"
  expect(emptiedFenceLines()).toBe(2) // ``` hidden while the caret is away

  view.dispatch({ selection: { anchor: view.state.doc.line(4).from } }) // caret in the block
  expect(emptiedFenceLines()).toBe(2) // still hidden — edited through the menu now
  expect(hasClass(view, "cm-inplace-fence")).toBe(false)

  view.dispatch({ selection: { anchor: view.state.doc.line(3).from } }) // caret on the ``` line
  expect(emptiedFenceLines()).toBe(2)
})

test("reveal: 'never' still reveals a body-less fenced block on caret entry", async () => {
  const { view } = await mount("text\n\n```\n```\n\ntail", { reveal: "never" })

  const emptiedFenceLines = () => {
    let n = 0
    view.plugin(inPlacePlugin)!.decorations.between(0, view.state.doc.length, (from, to, deco) => {
      if (from < to && !deco.spec.class && !deco.spec.widget) n += 1
    })
    return n
  }

  view.dispatch({ selection: { anchor: view.state.doc.length } }) // caret away
  expect(emptiedFenceLines()).toBe(2) // both fences collapsed off-caret

  view.dispatch({ selection: { anchor: view.state.doc.line(3).from } }) // caret on the block
  expect(emptiedFenceLines()).toBe(0) // fences shown — nothing else to land on
  expect(hasClass(view, "cm-inplace-fence")).toBe(true)
})

test("a dash bullet is swapped for a glyph; a task item gets a checkbox instead", async () => {
  const { view } = await mount("- plain item\n- [ ] a task\n\ntail")
  view.dispatch({ selection: { anchor: view.state.doc.length } })

  expect(countWidgets(view, BulletWidget)).toBe(1)
  expect(countWidgets(view, CheckboxWidget)).toBe(1)
})

test("a checkbox reflects [ ] and toggling it rewrites the source", async () => {
  const { view } = await mount("- [ ] todo\n\ntail")
  view.dispatch({ selection: { anchor: view.state.doc.length } })

  const input = await vi.waitFor(() => {
    const el = view.contentDOM.querySelector<HTMLInputElement>("input.cm-inplace-checkbox")
    if (!el) throw new Error("checkbox not rendered")
    return el
  })
  expect(input.checked).toBe(false)

  input.checked = true
  input.dispatchEvent(new Event("change"))
  expect(view.state.doc.line(1).text).toBe("- [x] todo")
})

test("a math widget renders KaTeX markup", async () => {
  const { view } = await mount("a $x^2$ b\n\ntail")
  view.dispatch({ selection: { anchor: view.state.doc.length } })

  let dom: HTMLElement | undefined
  view.plugin(inPlacePlugin)!.decorations.between(0, view.state.doc.length, (_f, _t, deco) => {
    const w = deco.spec.widget as WidgetType | undefined
    if (w) dom = w.toDOM(view) as HTMLElement
  })
  expect(dom?.querySelector(".katex")).not.toBeNull()
})

async function elementIn(view: EditorView, selector: string): Promise<HTMLElement> {
  return vi.waitFor(() => {
    const el = view.contentDOM.querySelector<HTMLElement>(selector)
    if (!el) throw new Error(`no ${selector}`)
    return el
  })
}

test("mousedown on a rendered inline-math widget reveals its source", async () => {
  const { view } = await mount("text $a+b$ more\n\ntail")
  view.dispatch({ selection: { anchor: view.state.doc.length } }) // off the math line
  expect(mathWidgets(view).some((w) => w.src === "a+b")).toBe(true)

  const mathEl = await elementIn(view, ".cm-inplace-math")
  mathEl.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }))
  expect(mathWidgets(view).some((w) => w.src === "a+b")).toBe(false)
})

test("mousedown on a rendered <hr> widget reveals its source", async () => {
  const { view } = await mount("above\n\n---\n\nbelow")
  view.dispatch({ selection: { anchor: view.state.doc.length } })
  expect(countWidgets(view, HrWidget)).toBe(1)

  const hrEl = await elementIn(view, ".cm-inplace-hr")
  hrEl.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }))
  expect(countWidgets(view, HrWidget)).toBe(0)
})

test("mousedown on a rendered table cell reveals the source at that cell", async () => {
  const { view } = await mount("intro\n\n| A | B |\n| - | - |\n|  | hi |\n\ntail")
  view.dispatch({ selection: { anchor: view.state.doc.length } })

  const cell = await elementIn(view, 'td[data-stylo-row="1"][data-stylo-col="1"]') // the "hi" cell
  cell.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }))

  const { head } = view.state.selection.main
  expect(view.state.doc.lineAt(head).text).toBe("|  | hi |")
  expect(view.state.sliceDoc(head, head + 2)).toBe("hi") // caret at the cell, not column 0
})

function atomicCount(view: EditorView): number {
  let n = 0
  view.plugin(inPlacePlugin)!.atomic.between(0, view.state.doc.length, (from, to) => {
    if (from < to) n += 1
  })
  return n
}

test("hidden markers are registered as atomic ranges", async () => {
  const { view } = await mount("line one\n\nsome **bold** here")
  view.dispatch({ selection: { anchor: 0 } }) // caret off the bold line

  expect(hidesAMarker(view)).toBe(true)
  expect(atomicCount(view)).toBe(2) // the two hidden ** markers

  view.dispatch({ selection: { anchor: view.state.doc.length } }) // onto the bold line
  expect(atomicCount(view)).toBe(0)
})

test("an unclosed ** does not crash and is not collapsed", async () => {
  const { view } = await mount("line one\n\n**not closed here")
  view.dispatch({ selection: { anchor: 0 } })

  expect(hidesAMarker(view)).toBe(false)
  expect(atomicCount(view)).toBe(0)
})

test("a document-wide selection reveals every marker", async () => {
  const { view } = await mount("# Heading\n\n**bold** and `code` and [[Link]]")
  view.dispatch({ selection: { anchor: 0, head: view.state.doc.length } })

  expect(hidesAMarker(view)).toBe(false)
  expect(atomicCount(view)).toBe(0)
})

function tableDOM(view: EditorView): HTMLTableElement | null {
  let dom: HTMLTableElement | null = null
  view.state.field(tableField).between(0, view.state.doc.length, (_f, _t, deco) => {
    const w = deco.spec.widget as WidgetType | undefined
    if (w) dom = w.toDOM(view) as HTMLTableElement
  })
  return dom
}

test("a GFM table renders as a <table> off-caret", async () => {
  const { view } = await mount(
    "intro\n\n| Feature | Status |\n| ------- | ------ |\n| Source | done |\n| Preview | soon |\n\ntail",
  )
  view.dispatch({ selection: { anchor: view.state.doc.length } })

  const table = tableDOM(view)
  expect(table?.tagName).toBe("TABLE")
  expect(table?.querySelectorAll("thead th")).toHaveLength(2)
  expect(table?.querySelectorAll("tbody tr")).toHaveLength(2)
  expect(table?.querySelector("thead th")?.textContent).toBe("Feature")
  expect(table?.querySelector("tbody td")?.textContent).toBe("Source")
})

test("a table shows its source when the caret is on a table line", async () => {
  const { view } = await mount("intro\n\n| A | B |\n| - | - |\n| 1 | 2 |\n\ntail")

  view.dispatch({ selection: { anchor: view.state.doc.length } })
  expect(view.state.field(tableField).size).toBe(1)

  view.dispatch({ selection: { anchor: view.state.doc.line(3).from } })
  expect(view.state.field(tableField).size).toBe(0)
})

test("column alignment from the delimiter row reaches the rendered cells", async () => {
  const { view } = await mount("intro\n\n| L | C |\n| :- | :-: |\n| a | b |\n\ntail")
  view.dispatch({ selection: { anchor: view.state.doc.length } })

  const cells = tableDOM(view)?.querySelectorAll<HTMLTableCellElement>("tbody td")
  expect(cells?.[0]?.style.textAlign).toBe("left")
  expect(cells?.[1]?.style.textAlign).toBe("center")
})

test("empty cells keep their column — a leading blank cell is not collapsed", async () => {
  // The Lezer parser emits no TableCell node for a whitespace-only cell, so a
  // tree read would render "x" in column 1. The grid parser keeps the blank.
  const { view } = await mount("intro\n\n| A | B |\n| - | - |\n|  | x |\n| y |  |\n\ntail")
  view.dispatch({ selection: { anchor: view.state.doc.length } })

  const rows = tableDOM(view)?.querySelectorAll<HTMLTableRowElement>("tbody tr")
  expect([...(rows?.[0]?.cells ?? [])].map((c) => c.textContent)).toEqual(["", "x"])
  expect([...(rows?.[1]?.cells ?? [])].map((c) => c.textContent)).toEqual(["y", ""])
})

test("inline Markdown inside a cell renders — bold, code, link, wikilink, math", async () => {
  const { view } = await mount(
    "intro\n\n| Plain | Rich |\n| - | - |\n" +
      "| **b** `c` | [t](u) [[Page\\|lbl]] $x^2$ |\n\ntail",
  )
  view.dispatch({ selection: { anchor: view.state.doc.length } })
  const table = tableDOM(view)!

  const c0 = table.querySelector("tbody td")!
  expect(c0.querySelector("strong")?.textContent).toBe("b")
  expect(c0.querySelector("code.cm-inplace-code")?.textContent).toBe("c")

  const c1 = table.querySelectorAll("tbody td")[1]!
  expect(c1.querySelector("a.cm-inplace-link")?.getAttribute("href")).toBe("u")
  const wiki = c1.querySelector<HTMLElement>(".cm-inplace-wikilink")
  expect(wiki?.dataset.styloWikilink).toBe("Page")
  expect(wiki?.textContent).toBe("lbl")
  expect(c1.querySelector(".katex")).not.toBeNull()
})

test("a wikilink inside a rendered cell is clickable through the delegated handler", async () => {
  const targets: string[] = []
  const { container } = render(
    <Stylo
      value={"x\n\n| H |\n| - |\n| [[Notes/Home]] |\n\ntail"}
      onChange={() => {}}
      mode="in-place"
      onWikiLinkClick={(t) => targets.push(t)}
    />,
  )
  await vi.waitFor(() => {
    if (!container.querySelector(".cm-inplace-wikilink")) throw new Error("no wikilink")
  })
  container
    .querySelector<HTMLElement>(".cm-inplace-wikilink")!
    .dispatchEvent(new MouseEvent("click", { bubbles: true }))
  expect(targets).toEqual(["Notes/Home"])
})

test("inPlace.decorations.headings=false leaves a heading as plain source", async () => {
  const { view } = await mount("# Title\n\nbody", { decorations: { headings: false } })
  view.dispatch({ selection: { anchor: view.state.doc.length } })

  expect(hasClass(view, "cm-inplace-h1")).toBe(false)
  expect(hidesAMarker(view)).toBe(false)
})

test("inPlace.decorations.math=false leaves $…$ as literal text", async () => {
  const { view } = await mount("a $x^2$ b\n\ntail", { decorations: { math: false } })
  view.dispatch({ selection: { anchor: view.state.doc.length } })

  expect(mathWidgets(view)).toHaveLength(0)
})

test("inPlace.decorations.tables=false leaves a GFM table as source", async () => {
  const { view } = await mount("| A | B |\n| - | - |\n| 1 | 2 |\n\ntail", {
    decorations: { tables: false },
  })
  view.dispatch({ selection: { anchor: view.state.doc.length } })

  expect(view.state.field(tableField).size).toBe(0)
})

test("inPlace.decorations.frontmatter=false leaves the YAML block visible", async () => {
  const { view } = await mount("---\ntitle: x\n---\n\n# Body", {
    decorations: { frontmatter: false },
  })
  view.dispatch({ selection: { anchor: view.state.doc.length } })

  expect(view.state.field(frontmatterField).size).toBe(0)
})

test("inPlace.decorations.code covers inline code, not just fenced blocks", async () => {
  const inline = await mount("some `code` here\n\ntail", { decorations: { code: false } })
  expect(hasClass(inline.view, "cm-inplace-code")).toBe(false)

  // emphasis stays off inline code's separate toggle
  const emphasisOff = await mount("some `code` here\n\ntail", { decorations: { emphasis: false } })
  expect(hasClass(emphasisOff.view, "cm-inplace-code")).toBe(true)
})

test("inPlace.decorations.tasks=false leaves a task item fully as source", async () => {
  const { view } = await mount("- [ ] todo\n\ntail", { decorations: { tasks: false } })
  view.dispatch({ selection: { anchor: view.state.doc.length } })

  expect(countWidgets(view, CheckboxWidget)).toBe(0)
  expect(hidesAMarker(view)).toBe(false) // the "- " prefix stays too
})
