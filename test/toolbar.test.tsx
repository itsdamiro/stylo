import { useState } from "react"
import { afterEach, expect, test, vi } from "vitest"
import { cleanup, render } from "@testing-library/react"
import { EditorSelection, EditorState } from "@codemirror/state"
import { EditorView } from "@codemirror/view"
import { markdownLanguage } from "@codemirror/lang-markdown"
import { Stylo } from "../src/Stylo"
import stylo from "../src/styles/stylo.module.css"
import { BUILTIN_BY_ID, BUILTIN_COMMANDS } from "../src/toolbar/commands"
import { DEFAULT_TOOLBAR_ITEMS, resolveToolbarItems } from "../src/toolbar/config"

afterEach(cleanup)

/** A bare view with the Markdown grammar and an optional selection. */
function mkView(doc: string, anchor = doc.length, head = anchor): EditorView {
  return new EditorView({
    state: EditorState.create({
      doc,
      extensions: [markdownLanguage],
      selection: EditorSelection.single(anchor, head),
    }),
  })
}

test("bold wraps the selection and toggles back off", () => {
  const view = mkView("hello world", 0, 5)
  BUILTIN_BY_ID.bold!.run(view)
  expect(view.state.doc.toString()).toBe("**hello** world")
  BUILTIN_BY_ID.bold!.run(view)
  expect(view.state.doc.toString()).toBe("hello world")
})

test("Code block / Block math insert land the caret between the fences", () => {
  const cb = mkView("", 0)
  BUILTIN_BY_ID.codeBlock!.run(cb)
  expect(cb.state.doc.toString()).toBe("```\n\n```")
  expect(cb.state.selection.main.head).toBe(4) // the empty line between

  const mb = mkView("", 0)
  BUILTIN_BY_ID.mathBlock!.run(mb)
  expect(mb.state.doc.toString()).toBe("$$\n\n$$")
  expect(mb.state.selection.main.head).toBe(3)
})

test("bold on a whole-link selection wraps the link, and toggles back", () => {
  const view = mkView("x [two words](http://a) y", 2, 23) // the whole [..](..) span
  BUILTIN_BY_ID.bold!.run(view)
  expect(view.state.doc.toString()).toBe("x **[two words](http://a)** y")
  view.dispatch({ selection: EditorSelection.single(4, 25) }) // the link again, now inside **…**
  BUILTIN_BY_ID.bold!.run(view)
  expect(view.state.doc.toString()).toBe("x [two words](http://a) y")
})

test("bold on a whole-wikilink selection wraps it outside the brackets", () => {
  const view = mkView("x [[Page Name]] y", 2, 15) // "[[Page Name]]" is [2, 15)
  BUILTIN_BY_ID.bold!.run(view)
  expect(view.state.doc.toString()).toBe("x **[[Page Name]]** y")
})

test("bold is disabled at a bare caret with no word to wrap", () => {
  expect(BUILTIN_BY_ID.bold!.disabled!(mkView("", 0).state)).toBe(true)
  expect(BUILTIN_BY_ID.bold!.disabled!(mkView("a word here", 4).state)).toBe(false) // on "word"
})

test("bold with a bare caret mid-word wraps the whole word instead of splitting it", () => {
  const view = mkView("a word here", 4) // caret between "wo" and "rd"
  BUILTIN_BY_ID.bold!.run(view)
  expect(view.state.doc.toString()).toBe("a **word** here")
})

test("wrapActive reports the pressed state for bold", () => {
  const view = mkView("a **bold** word", 5)
  expect(BUILTIN_BY_ID.bold!.isActive!(view.state)).toBe(true)
  view.dispatch({ selection: EditorSelection.single(0) })
  expect(BUILTIN_BY_ID.bold!.isActive!(view.state)).toBe(false)
})

/** Move the selection back onto the "word" run, whatever marks now flank it. */
function reSelectWord(view: EditorView) {
  const i = view.state.doc.toString().indexOf("word")
  view.dispatch({ selection: EditorSelection.range(i, i + 4) })
}

/** Run a sequence of built-in commands over the word in "x word y". */
function seq(...ids: (keyof typeof BUILTIN_BY_ID)[]) {
  const view = mkView("x word y", 2, 6)
  for (const id of ids) {
    BUILTIN_BY_ID[id]!.run(view)
    reSelectWord(view)
  }
  return view.state.doc.toString()
}

test("bold then italic nests to ***word*** — it does not eat a marker", () => {
  expect(seq("bold", "italic")).toBe("x ***word*** y")
})

test("italic then bold also nests to ***word***", () => {
  expect(seq("italic", "bold")).toBe("x ***word*** y")
})

test("bold+italic, then bold off leaves italic; then italic off leaves plain", () => {
  const view = mkView("x word y", 2, 6)
  BUILTIN_BY_ID.bold!.run(view)
  BUILTIN_BY_ID.italic!.run(view)
  expect(view.state.doc.toString()).toBe("x ***word*** y")

  reSelectWord(view)
  BUILTIN_BY_ID.bold!.run(view)
  expect(view.state.doc.toString()).toBe("x *word* y")

  reSelectWord(view)
  BUILTIN_BY_ID.italic!.run(view)
  expect(view.state.doc.toString()).toBe("x word y")
})

test("bold+italic, then italic off leaves bold", () => {
  const view = mkView("x word y", 2, 6)
  BUILTIN_BY_ID.bold!.run(view)
  BUILTIN_BY_ID.italic!.run(view)
  reSelectWord(view)
  BUILTIN_BY_ID.italic!.run(view)
  expect(view.state.doc.toString()).toBe("x **word** y")
})

test("bold, italic, strike all on then all off round-trips cleanly", () => {
  const view = mkView("x word y", 2, 6)
  for (const id of ["bold", "italic", "strike"] as const) {
    BUILTIN_BY_ID[id]!.run(view)
    reSelectWord(view)
  }
  expect(view.state.doc.toString()).toBe("x ***~~word~~*** y")

  for (const id of ["strike", "italic", "bold"] as const) {
    BUILTIN_BY_ID[id]!.run(view)
    reSelectWord(view)
  }
  expect(view.state.doc.toString()).toBe("x word y")
})

test("interleaved marks (b,s,i order) still strip cleanly in any removal order", () => {
  // Applying bold, then strike, then italic nests them interleaved:
  // the *word*'s italic is innermost, strike around it, bold outermost.
  expect(seq("bold", "strike", "italic")).toBe("x **~~*word*~~** y")

  const view = mkView("x word y", 2, 6)
  for (const id of ["bold", "strike", "italic"] as const) {
    BUILTIN_BY_ID[id]!.run(view)
    reSelectWord(view)
  }
  // Remove in a different order than applied — bold (outer), italic (inner), strike.
  for (const id of ["bold", "italic", "strike"] as const) {
    BUILTIN_BY_ID[id]!.run(view)
    reSelectWord(view)
  }
  expect(view.state.doc.toString()).toBe("x word y")
})

test("interleaved marks (i,s,b order) strip cleanly too", () => {
  expect(seq("italic", "strike", "bold")).toBe("x *~~**word**~~* y")

  const view = mkView("x word y", 2, 6)
  for (const id of ["italic", "strike", "bold"] as const) {
    BUILTIN_BY_ID[id]!.run(view)
    reSelectWord(view)
  }
  for (const id of ["bold", "italic", "strike"] as const) {
    BUILTIN_BY_ID[id]!.run(view)
    reSelectWord(view)
  }
  expect(view.state.doc.toString()).toBe("x word y")
})

test("a mark strips out of the middle of a stack, leaving the others", () => {
  const view = mkView("x word y", 2, 6)
  for (const id of ["bold", "italic", "strike"] as const) {
    BUILTIN_BY_ID[id]!.run(view)
    reSelectWord(view)
  }
  expect(view.state.doc.toString()).toBe("x ***~~word~~*** y")

  // italic sits between the outer *** and the inner ~~ — toggling it off must
  // leave `**~~word~~**`, not stack another pair or eat a `*`.
  BUILTIN_BY_ID.italic!.run(view)
  expect(view.state.doc.toString()).toBe("x **~~word~~** y")

  reSelectWord(view)
  BUILTIN_BY_ID.strike!.run(view)
  expect(view.state.doc.toString()).toBe("x **word** y")
})

test("B I S I S I S I S settles to plain bold, never stacks (the reported case)", () => {
  const view = mkView("x word y", 2, 6)
  BUILTIN_BY_ID.bold!.run(view)
  for (const id of [
    "italic",
    "strike",
    "italic",
    "strike",
    "italic",
    "strike",
    "italic",
    "strike",
  ] as const) {
    reSelectWord(view)
    BUILTIN_BY_ID[id]!.run(view)
  }
  // italic and strike each toggled an even number of times → both off, bold left.
  expect(view.state.doc.toString()).toBe("x **word** y")
})

test("strike toggles independently of bold", () => {
  const view = mkView("x word y", 2, 6)
  BUILTIN_BY_ID.bold!.run(view)
  reSelectWord(view)
  BUILTIN_BY_ID.strike!.run(view)
  expect(view.state.doc.toString()).toBe("x **~~word~~** y")
  reSelectWord(view)
  BUILTIN_BY_ID.strike!.run(view)
  expect(view.state.doc.toString()).toBe("x **word** y")
})

test("h2 sets a heading, swaps from another level, then clears", () => {
  const view = mkView("Title", 0)
  BUILTIN_BY_ID.h2!.run(view)
  expect(view.state.doc.toString()).toBe("## Title")
  BUILTIN_BY_ID.h1!.run(view)
  expect(view.state.doc.toString()).toBe("# Title")
  BUILTIN_BY_ID.h1!.run(view)
  expect(view.state.doc.toString()).toBe("Title")
})

test("task prefixes a checkbox and isActive follows it", () => {
  const view = mkView("buy milk", 0)
  BUILTIN_BY_ID.task!.run(view)
  expect(view.state.doc.toString()).toBe("- [ ] buy milk")
  expect(BUILTIN_BY_ID.task!.isActive!(view.state)).toBe(true)
  BUILTIN_BY_ID.task!.run(view)
  expect(view.state.doc.toString()).toBe("buy milk")
})

test("a list / task / quote starts on a lone blank line", () => {
  for (const [id, out] of [
    ["bulletList", "- "],
    ["orderedList", "1. "],
    ["task", "- [ ] "],
    ["quote", "> "],
  ] as const) {
    const view = mkView("", 0)
    BUILTIN_BY_ID[id]!.run(view)
    expect(view.state.doc.toString(), id).toBe(out)
  }
})

test("bulletList toggles across a multi-line selection", () => {
  const view = mkView("one\ntwo\nthree", 0, 13)
  BUILTIN_BY_ID.bulletList!.run(view)
  expect(view.state.doc.toString()).toBe("- one\n- two\n- three")
  BUILTIN_BY_ID.bulletList!.run(view)
  expect(view.state.doc.toString()).toBe("one\ntwo\nthree")
})

test("the list buttons are mutually exclusive — they swap, never stack", () => {
  const view = mkView("first item", 0)
  BUILTIN_BY_ID.bulletList!.run(view)
  expect(view.state.doc.toString()).toBe("- first item")
  BUILTIN_BY_ID.orderedList!.run(view)
  expect(view.state.doc.toString()).toBe("1. first item")
  BUILTIN_BY_ID.task!.run(view)
  expect(view.state.doc.toString()).toBe("- [ ] first item")
  BUILTIN_BY_ID.bulletList!.run(view)
  expect(view.state.doc.toString()).toBe("- first item")
  BUILTIN_BY_ID.bulletList!.run(view)
  expect(view.state.doc.toString()).toBe("first item")
})

test("orderedList over a mix of bullets and plain lines numbers them all", () => {
  const view = mkView("- a\nb\n- c", 0, 9)
  BUILTIN_BY_ID.orderedList!.run(view)
  expect(view.state.doc.toString()).toBe("1. a\n2. b\n3. c")
})

test("orderedList numbers the selected lines 1. 2. 3. and strips them back", () => {
  const view = mkView("alpha\nbeta\ngamma", 0, 16)
  BUILTIN_BY_ID.orderedList!.run(view)
  expect(view.state.doc.toString()).toBe("1. alpha\n2. beta\n3. gamma")
  BUILTIN_BY_ID.orderedList!.run(view)
  expect(view.state.doc.toString()).toBe("alpha\nbeta\ngamma")
})

test("orderedList recognizes existing 1) 2) markers, not just 1.", () => {
  const doc = "1) First\n2) Second"
  const view = mkView(doc, 0, doc.length)
  expect(BUILTIN_BY_ID.orderedList!.isActive!(view.state)).toBe(true)
  BUILTIN_BY_ID.orderedList!.run(view)
  // Already ordered (paren style counts) — toggling strips it rather than
  // stacking a second, period-style marker in front.
  expect(view.state.doc.toString()).toBe("First\nSecond")
})

test("codeBlock fences the selected lines and unwraps them again", () => {
  const view = mkView("a = 1\nb = 2", 0, 11)
  BUILTIN_BY_ID.codeBlock!.run(view)
  expect(view.state.doc.toString()).toBe("```\na = 1\nb = 2\n```")
  view.dispatch({ selection: EditorSelection.single(4) })
  BUILTIN_BY_ID.codeBlock!.run(view)
  expect(view.state.doc.toString()).toBe("a = 1\nb = 2")
})

test("hr inserts a divider after a paragraph line, with a blank line before it", () => {
  const view = mkView("a paragraph", 5)
  BUILTIN_BY_ID.hr!.run(view)
  expect(view.state.doc.toString()).toBe("a paragraph\n\n---\n")
})

test("hr replaces an empty line in place and toggles back off", () => {
  const view = mkView("above\n\nbelow", 6) // the blank middle line
  BUILTIN_BY_ID.hr!.run(view)
  expect(view.state.doc.toString()).toBe("above\n---\nbelow")
  expect(BUILTIN_BY_ID.hr!.isActive!(view.state)).toBe(true)
  BUILTIN_BY_ID.hr!.run(view)
  expect(view.state.doc.toString()).toBe("above\nbelow")
})

test("frontmatter wraps the top of the doc and toggling off keeps the YAML", () => {
  const view = mkView("title: Foo\ntags: [x]\n\n# Heading", 0, 20)
  BUILTIN_BY_ID.frontmatter!.run(view)
  expect(view.state.doc.toString()).toBe("---\ntitle: Foo\ntags: [x]\n---\n\n# Heading")
  expect(BUILTIN_BY_ID.frontmatter!.isActive!(view.state)).toBe(true)

  BUILTIN_BY_ID.frontmatter!.run(view)
  expect(view.state.doc.toString()).toBe("title: Foo\ntags: [x]\n\n# Heading")
  expect(BUILTIN_BY_ID.frontmatter!.isActive!(view.state)).toBe(false)
})

test("frontmatter with no selection wraps just the first line", () => {
  const view = mkView("title: Only\n\nbody", 3)
  BUILTIN_BY_ID.frontmatter!.run(view)
  expect(view.state.doc.toString()).toBe("---\ntitle: Only\n---\n\nbody")
})

test("mathBlock fences the selection in $$ and unwraps from inside", () => {
  const view = mkView("x^2 + y^2", 0, 9)
  BUILTIN_BY_ID.mathBlock!.run(view)
  expect(view.state.doc.toString()).toBe("$$\nx^2 + y^2\n$$")
  view.dispatch({ selection: EditorSelection.single(5) })
  expect(BUILTIN_BY_ID.mathBlock!.isActive!(view.state)).toBe(true)
  BUILTIN_BY_ID.mathBlock!.run(view)
  expect(view.state.doc.toString()).toBe("x^2 + y^2")
})

test("in a $$ block, mathBlock is active and inline math is not — on a fence line too", () => {
  const view = mkView("$$\nx^2 + y^2\n$$")
  for (const anchor of [1, 6, 13]) {
    // opening fence, body, closing fence
    view.dispatch({ selection: EditorSelection.single(anchor) })
    expect(BUILTIN_BY_ID.mathBlock!.isActive!(view.state), `mathBlock @ ${anchor}`).toBe(true)
    expect(BUILTIN_BY_ID.math!.isActive!(view.state), `math @ ${anchor}`).toBe(false)
  }
})

test("inline math is active only inside a real $…$ span", () => {
  const view = mkView("energy $E=mc^2$ here", 10)
  expect(BUILTIN_BY_ID.math!.isActive!(view.state)).toBe(true)
})

test("link wraps the selection and selects the url placeholder", () => {
  const view = mkView("docs", 0, 4)
  BUILTIN_BY_ID.link!.run(view)
  expect(view.state.doc.toString()).toBe("[docs](url)")
  const { from, to } = view.state.selection.main
  expect(view.state.sliceDoc(from, to)).toBe("url")
})

test("link toggles off by unlinking — the label stays, the url goes", () => {
  const view = mkView("see [the docs](https://x.dev) now", 8)
  expect(BUILTIN_BY_ID.link!.isActive!(view.state)).toBe(true)
  BUILTIN_BY_ID.link!.run(view)
  expect(view.state.doc.toString()).toBe("see the docs now")
})

test("wikilink wraps the selection as [[…]] with the target selected", () => {
  const view = mkView("Home Page", 0, 9)
  BUILTIN_BY_ID.wikilink!.run(view)
  expect(view.state.doc.toString()).toBe("[[Home Page]]")
  const { from, to } = view.state.selection.main
  expect(view.state.sliceDoc(from, to)).toBe("Home Page")
})

test("wikilink toggles off to the label, dropping the target and pipe", () => {
  const view = mkView("see [[api/ref|the API]] now", 12) // caret inside the wikilink
  expect(BUILTIN_BY_ID.wikilink!.isActive!(view.state)).toBe(true)
  BUILTIN_BY_ID.wikilink!.run(view)
  expect(view.state.doc.toString()).toBe("see the API now")
})

test("wikilink toggling a plain [[target]] off leaves the bare target", () => {
  const view = mkView("go [[Notes]] here", 6)
  BUILTIN_BY_ID.wikilink!.run(view)
  expect(view.state.doc.toString()).toBe("go Notes here")
})

const TABLE_DOC = "intro\n\n| A | B |\n| - | - |\n| c | d |\n\ntail"

/**
 * The sorted ids whose `disabled` fires for the caret at `pos` in `doc`.
 * `save` is excluded — its `disabled` tracks whether an `onSave` handler is
 * wired, not the caret context, and these bare views register none.
 */
function disabledAt(doc: string, pos: number): string[] {
  const { state } = mkView(doc, pos)
  return BUILTIN_COMMANDS.filter((c) => c.id !== "save" && c.disabled?.(state))
    .map((c) => c.id)
    .sort()
}

test("nothing is disabled in a plain paragraph", () => {
  expect(disabledAt("just a line of text", 6)).toEqual([])
})

test("a table cell disables the block commands, not the inline ones", () => {
  expect(disabledAt(TABLE_DOC, 29)).toEqual(
    [
      "body",
      "bulletList",
      "frontmatter",
      "h1",
      "h2",
      "h3",
      "hr",
      "orderedList",
      "quote",
      "table",
      "task",
    ].sort(),
  )
})

test("a heading line disables lists, hr's peers, and block inserts — quote and headings stay", () => {
  expect(disabledAt("## A Heading", 5)).toEqual(
    ["bulletList", "codeBlock", "frontmatter", "mathBlock", "orderedList", "table", "task"].sort(),
  )
})

test("the frontmatter block disables every formatting command but frontmatter itself", () => {
  const dis = disabledAt("---\ntitle: x\n---\n\n# Body", 8)
  expect(dis).not.toContain("frontmatter")
  for (const id of [
    "bold",
    "italic",
    "h1",
    "quote",
    "bulletList",
    "hr",
    "table",
    "codeBlock",
    "mathBlock",
    "link",
    "math",
  ]) {
    expect(dis, id).toContain(id)
  }
})

test("a fenced code block keeps codeBlock live (to unwrap) and disables the rest", () => {
  const dis = disabledAt("t\n\n```\ncode\n```\n\nx", 8) // inside "code"
  expect(dis).not.toContain("codeBlock")
  expect(dis).toEqual(expect.arrayContaining(["bold", "h1", "quote", "hr", "mathBlock", "table"]))
})

test("a $$ math block keeps mathBlock live and disables the rest", () => {
  const dis = disabledAt("t\n\n$$\nx^2\n$$\n\ny", 7) // inside "x^2"
  expect(dis).not.toContain("mathBlock")
  expect(dis).toEqual(expect.arrayContaining(["bold", "h1", "codeBlock", "hr", "table"]))
})

test("codeBlock and mathBlock degrade to inline inside a table cell", () => {
  const view = mkView(TABLE_DOC, 29, 30) // "c"
  BUILTIN_BY_ID.codeBlock!.run(view)
  expect(view.state.doc.toString()).toContain("| `c` | d |")
  expect(BUILTIN_BY_ID.codeBlock!.isActive!(view.state)).toBe(true)

  const v2 = mkView(TABLE_DOC, 29, 30)
  BUILTIN_BY_ID.mathBlock!.run(v2)
  expect(v2.state.doc.toString()).toContain("| $c$ | d |")
})

test("codeBlock still fences whole lines outside a table", () => {
  const view = mkView("a = 1\nb = 2", 0, 11)
  BUILTIN_BY_ID.codeBlock!.run(view)
  expect(view.state.doc.toString()).toBe("```\na = 1\nb = 2\n```")
})

test("the h2 button renders disabled when the caret is in a table row", async () => {
  function Host() {
    const [v, setV] = useState(TABLE_DOC)
    return <Stylo value={v} onChange={setV} mode="source" />
  }
  const { container } = render(<Host />)
  const view = EditorView.findFromDOM(container.querySelector(".cm-editor")!)!
  const h2 = container.querySelector<HTMLButtonElement>('button[aria-label="Heading 2"]')!

  view.dispatch({ selection: EditorSelection.single(29) }) // into "| c | d |"
  container.querySelector(".cm-content")!.dispatchEvent(new Event("keyup"))
  await vi.waitFor(() => expect(h2.disabled).toBe(true))

  view.dispatch({ selection: EditorSelection.single(2) }) // back to plain text
  container.querySelector(".cm-content")!.dispatchEvent(new Event("keyup"))
  await vi.waitFor(() => expect(h2.disabled).toBe(false))
})

test("resolveToolbarItems: default, explicit true, hidden, custom", () => {
  expect(resolveToolbarItems(undefined)).toEqual(DEFAULT_TOOLBAR_ITEMS)
  expect(resolveToolbarItems(true)).toEqual(DEFAULT_TOOLBAR_ITEMS)
  expect(resolveToolbarItems(false)).toBeNull()
  expect(resolveToolbarItems({ items: ["bold", "|", "italic"] })).toEqual(["bold", "|", "italic"])
})

test("Stylo shows the bar for source mode and a button runs its command", async () => {
  function Host() {
    const [v, setV] = useState("hi")
    return <Stylo value={v} onChange={setV} mode="source" />
  }
  const { container } = render(<Host />)
  const bold = container.querySelector<HTMLButtonElement>('button[aria-label="Bold"]')!
  expect(bold).not.toBeNull()

  const view = EditorView.findFromDOM(container.querySelector(".cm-editor")!)!
  view.dispatch({ selection: EditorSelection.single(0, 2) })
  bold.click()
  await vi.waitFor(() => expect(view.state.doc.toString()).toBe("**hi**"))
})

test("toolbar={false} hides the bar; preview mode never has one", () => {
  const { container: a } = render(
    <Stylo value="x" onChange={() => {}} mode="source" toolbar={false} />,
  )
  expect(a.querySelector('[role="toolbar"]')).toBeNull()

  const { container: b } = render(<Stylo value="x" onChange={() => {}} mode="preview" />)
  expect(b.querySelector('[role="toolbar"]')).toBeNull()
})

test("a custom items list renders exactly those buttons in order", () => {
  const { container } = render(
    <Stylo
      value="x"
      onChange={() => {}}
      mode="source"
      toolbar={{ items: ["bold", "|", "italic", "task"] }}
    />,
  )
  const labels = [...container.querySelectorAll('[role="toolbar"] button')].map((b) =>
    b.getAttribute("aria-label"),
  )
  expect(labels).toEqual(["Bold", "Italic", "Task list"])
})

test("every default item resolves to a built-in command or a separator", () => {
  for (const item of DEFAULT_TOOLBAR_ITEMS) {
    if (item === "|") continue
    expect(BUILTIN_BY_ID[item], item).toBeDefined()
  }
})

test("a custom item renders between built-ins and runs against the live view", () => {
  const run = vi.fn()
  const { container } = render(
    <Stylo
      value="hello"
      onChange={() => {}}
      mode="source"
      toolbar={{
        items: ["bold", "|", { id: "shout", title: "Shout", icon: <span>!</span>, run }, "italic"],
      }}
    />,
  )
  const labels = [...container.querySelectorAll('[role="toolbar"] button')].map((b) =>
    b.getAttribute("aria-label"),
  )
  expect(labels).toEqual(["Bold", "Shout", "Italic"])

  const btn = container.querySelector<HTMLButtonElement>('button[data-command="shout"]')!
  const view = EditorView.findFromDOM(container.querySelector(".cm-editor")!)!
  btn.click()
  expect(run).toHaveBeenCalledTimes(1)
  expect(run.mock.calls[0]?.[0]).toBe(view)
})

test("a custom item reflects isActive and disabled from the state", async () => {
  const { container } = render(
    <Stylo
      value="abc"
      onChange={() => {}}
      mode="source"
      toolbar={{
        items: [
          {
            id: "at-start",
            title: "At start",
            icon: <span>s</span>,
            run: () => {},
            isActive: (state) => state.selection.main.head === 0,
            disabled: (state) => state.doc.length === 0,
          },
        ],
      }}
    />,
  )
  const btn = container.querySelector<HTMLButtonElement>('button[data-command="at-start"]')!
  const view = EditorView.findFromDOM(container.querySelector(".cm-editor")!)!

  view.dispatch({ selection: EditorSelection.single(0) })
  view.contentDOM.dispatchEvent(new Event("keyup"))
  await vi.waitFor(() => expect(btn.getAttribute("aria-pressed")).toBe("true"))
  expect(btn.disabled).toBe(false)

  view.dispatch({ selection: EditorSelection.single(2) })
  view.contentDOM.dispatchEvent(new Event("keyup"))
  await vi.waitFor(() => expect(btn.getAttribute("aria-pressed")).toBe("false"))
})

test("built-in buttons also carry data-command", () => {
  const { container } = render(
    <Stylo value="x" onChange={() => {}} mode="source" toolbar={{ items: ["bold", "italic"] }} />,
  )
  expect(container.querySelector('button[data-command="bold"]')).not.toBeNull()
  expect(container.querySelector('button[data-command="italic"]')).not.toBeNull()
})

test("toolbar.render wraps the built-in bar", () => {
  const { container } = render(
    <Stylo
      value="x"
      onChange={() => {}}
      mode="source"
      toolbar={{
        items: ["bold"],
        render: (bar) => (
          <div data-testid="wrapper">
            {bar}
            <button type="button" data-command="external">
              ext
            </button>
          </div>
        ),
      }}
    />,
  )
  const wrapper = container.querySelector('[data-testid="wrapper"]')!
  expect(wrapper).not.toBeNull()
  expect(wrapper.querySelector('[role="toolbar"] button[data-command="bold"]')).not.toBeNull()
  // the extra control sits outside the role="toolbar" element
  expect(wrapper.querySelector(':scope > button[data-command="external"]')).not.toBeNull()
})

test("toolbar.render receives the view once the surface mounts", async () => {
  const seen: (EditorView | null)[] = []
  render(
    <Stylo
      value="x"
      onChange={() => {}}
      mode="source"
      toolbar={{
        items: ["bold"],
        render: (bar, { view }) => {
          seen.push(view)
          return bar
        },
      }}
    />,
  )
  await vi.waitFor(() => expect(seen.at(-1)).toBeInstanceOf(EditorView))
  expect(seen[0]).toBeNull() // first render, before the lazy view is ready
})

test("toolbar.sticky is off by default — no sticky class, no root modifier", () => {
  const { container } = render(<Stylo value="x" onChange={() => {}} mode="source" />)
  const bar = container.querySelector('[role="toolbar"]')!
  expect(bar.classList.contains(stylo.toolbarSticky!)).toBe(false)
  const root = container.querySelector(`.${stylo.root}`)!
  expect(root.classList.contains(stylo.stickyToolbarRootBottom!)).toBe(false)
  expect(root.classList.contains(stylo.stickyToolbarRootTop!)).toBe(false)
})

test("toolbar={{ sticky: true }} is an alias for bottom", () => {
  const { container } = render(
    <Stylo value="x" onChange={() => {}} mode="source" toolbar={{ sticky: true }} />,
  )
  const bar = container.querySelector('[role="toolbar"]')!
  expect(bar.classList.contains(stylo.toolbarSticky!)).toBe(true)
  expect(bar.classList.contains(stylo.toolbarStickyBottom!)).toBe(true)
  expect(bar.classList.contains(stylo.toolbarStickyTop!)).toBe(false)
  expect(bar.getAttribute("style")).toContain("translate") // nudged by useKeyboardInset
  const root = container.querySelector(`.${stylo.root}`)!
  expect(root.classList.contains(stylo.stickyToolbarRootBottom!)).toBe(true)
})

test("toolbar={{ sticky: 'top' }} pins to the top instead", () => {
  const { container } = render(
    <Stylo value="x" onChange={() => {}} mode="source" toolbar={{ sticky: "top" }} />,
  )
  const bar = container.querySelector('[role="toolbar"]')!
  expect(bar.classList.contains(stylo.toolbarSticky!)).toBe(true)
  expect(bar.classList.contains(stylo.toolbarStickyTop!)).toBe(true)
  expect(bar.classList.contains(stylo.toolbarStickyBottom!)).toBe(false)
  // No inline style yet: React never sets one for "top", and the rAF
  // watchdog (see next test) hasn't ticked in this same synchronous pass.
  expect(bar.getAttribute("style")).toBeNull()
  const root = container.querySelector(`.${stylo.root}`)!
  expect(root.classList.contains(stylo.stickyToolbarRootTop!)).toBe(true)
  expect(root.classList.contains(stylo.stickyToolbarRootBottom!)).toBe(false)
})

test("sticky: 'top' re-asserts its transform via a rAF watchdog, not a one-time style", async () => {
  const { container } = render(
    <Stylo value="x" onChange={() => {}} mode="source" toolbar={{ sticky: "top" }} />,
  )
  const bar = container.querySelector('[role="toolbar"]')!
  await vi.waitFor(() => expect(bar.getAttribute("style")).toContain("translate3d"))
  const first = bar.getAttribute("style")
  // The jitter alternates every frame — wait for it to actually change, not
  // just remain set once.
  await vi.waitFor(() => expect(bar.getAttribute("style")).not.toBe(first))
})

test("stickyVisibility defaults to 'consistent' — no fade", () => {
  const { container } = render(
    <Stylo value="x" onChange={() => {}} mode="source" toolbar={{ sticky: "top" }} />,
  )
  const bar = container.querySelector('[role="toolbar"]')!
  expect(bar.classList.contains(stylo.toolbarStickyHidden!)).toBe(false)
  expect(bar.getAttribute("aria-hidden")).toBeNull()
})

test("stickyVisibility: 'dynamic' fades the bar out until the surface is focused", async () => {
  const { container } = render(
    <Stylo
      value="x"
      onChange={() => {}}
      mode="source"
      toolbar={{ sticky: "top", stickyVisibility: "dynamic" }}
    />,
  )
  const bar = container.querySelector('[role="toolbar"]')!
  const view = EditorView.findFromDOM(container.querySelector(".cm-editor")!)!

  expect(bar.classList.contains(stylo.toolbarStickyHidden!)).toBe(true)
  expect(bar.getAttribute("aria-hidden")).toBe("true")

  view.contentDOM.dispatchEvent(new FocusEvent("focus"))
  await vi.waitFor(() => expect(bar.classList.contains(stylo.toolbarStickyHidden!)).toBe(false))
  expect(bar.getAttribute("aria-hidden")).toBeNull()

  view.contentDOM.dispatchEvent(new FocusEvent("blur"))
  await vi.waitFor(() => expect(bar.classList.contains(stylo.toolbarStickyHidden!)).toBe(true))
})

test("a sticky bar still renders its buttons and runs commands", async () => {
  function Host() {
    const [v, setV] = useState("hi")
    return <Stylo value={v} onChange={setV} mode="source" toolbar={{ sticky: true }} />
  }
  const { container } = render(<Host />)
  const bold = container.querySelector<HTMLButtonElement>('button[data-command="bold"]')!
  const view = EditorView.findFromDOM(container.querySelector(".cm-editor")!)!
  view.dispatch({ selection: EditorSelection.single(0, 2) })
  bold.click()
  await vi.waitFor(() => expect(view.state.doc.toString()).toBe("**hi**"))
})

test("underline wraps the selection in <u>…</u> and toggles back off", () => {
  const view = mkView("hello world", 0, 5)
  BUILTIN_BY_ID.underline!.run(view)
  expect(view.state.doc.toString()).toBe("<u>hello</u> world")
  // caret now sits inside the span; running it again unwraps
  BUILTIN_BY_ID.underline!.run(view)
  expect(view.state.doc.toString()).toBe("hello world")
})

test("underlineActive reports the pressed state", () => {
  const view = mkView("a <u>marked</u> word", 6) // inside "marked"
  expect(BUILTIN_BY_ID.underline!.isActive!(view.state)).toBe(true)
  view.dispatch({ selection: EditorSelection.single(0) })
  expect(BUILTIN_BY_ID.underline!.isActive!(view.state)).toBe(false)
})

test("underline is disabled in a fenced code block and inside inline code", () => {
  const fenced = mkView("```\ncode\n```", 6) // on the "code" line
  expect(BUILTIN_BY_ID.underline!.disabled!(fenced.state)).toBe(true)
  const inlineCode = mkView("a `snippet` b", 5) // inside `snippet`
  expect(BUILTIN_BY_ID.underline!.disabled!(inlineCode.state)).toBe(true)
  expect(BUILTIN_BY_ID.underline!.disabled!(mkView("plain words", 3).state)).toBe(false)
})

test("underline ships as a command, bound to Mod-u, but is not in the default bar", () => {
  expect(BUILTIN_BY_ID.underline).toBeDefined()
  expect(BUILTIN_BY_ID.underline!.keys).toEqual(["Mod-u"])
  expect(DEFAULT_TOOLBAR_ITEMS).not.toContain("underline")
})
