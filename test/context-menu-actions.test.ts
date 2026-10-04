import { markdownLanguage } from "@codemirror/lang-markdown"
import { EditorSelection, EditorState } from "@codemirror/state"
import { EditorView } from "@codemirror/view"
import { expect, test } from "vitest"
import { codeBlockRow, menuRows } from "../src/inplace/context-menu-actions"
import type { MenuAction, MenuField, MenuRow, MenuSubmenu } from "../src/inplace/context-menu"
import {
  menuGroupsFacet,
  resolveContextMenu,
  resolveSelectionBarItems,
  selectionUIFacet,
} from "../src/inplace/config"
import { linkRow, wikiLinkRow } from "../src/inplace/link-row"
import { mathRow } from "../src/inplace/math-edit"
import type { MenuGroupId, SelectionUI } from "../src/types"
import { linkPartsIn, wikiLinkPartsIn } from "../src/toolbar/inline-ops"

function mkView(doc: string, anchor = doc.length, head = anchor, ui?: SelectionUI): EditorView {
  return new EditorView({
    state: EditorState.create({
      doc,
      extensions: ui ? [markdownLanguage, selectionUIFacet.of(ui)] : [markdownLanguage],
      selection: EditorSelection.single(anchor, head),
    }),
  })
}

function mkGroupsView(doc: string, groups: MenuGroupId[], ui?: SelectionUI): EditorView {
  return new EditorView({
    state: EditorState.create({
      doc,
      extensions: [
        markdownLanguage,
        menuGroupsFacet.of(groups),
        ...(ui ? [selectionUIFacet.of(ui)] : []),
      ],
      selection: EditorSelection.single(0, 5),
    }),
  })
}

const labels = (rows: MenuRow[]): string[] =>
  rows.filter((r): r is Exclude<MenuRow, "separator"> => r !== "separator").map((r) => r.label)

const isSubmenu = (r: MenuRow): r is MenuSubmenu => typeof r !== "string" && "rows" in r
const sub = (rows: MenuRow[], label: string): MenuSubmenu | undefined =>
  rows.find((r): r is MenuSubmenu => isSubmenu(r) && r.label === label)

test("the menu keeps one shape: link rows, Format / Paragraph / Insert, clipboard", () => {
  const l = labels(menuRows(mkView("hello world", 0, 5)))
  expect(l).toEqual([
    "Add link",
    "Add external link",
    "Format",
    "Paragraph",
    "Insert",
    "Cut",
    "Copy",
    "Paste",
  ])
})

test("the Format submenu carries the inline marks, inline code, and a math field", () => {
  const fmt = sub(menuRows(mkView("hello world", 0, 5)), "Format")!
  expect(labels(fmt.rows)).toEqual([
    "Bold",
    "Italic",
    "Strikethrough",
    "Inline code",
    "Add math", // no existing $…$ at the caret — an empty field that wraps a selection
  ])
})

test("the Paragraph submenu carries list types, heading levels and quote", () => {
  const para = sub(menuRows(mkView("some text")), "Paragraph")!
  expect(labels(para.rows)).toEqual([
    "Bulleted list",
    "Numbered list",
    "Task list",
    "Heading 1",
    "Heading 2",
    "Heading 3",
    "Body",
    "Blockquote",
  ])
})

test("Format and Insert trade places between a blank line and a line with text", () => {
  const blank = menuRows(mkView(""))
  expect(sub(blank, "Format")!.disabled, "Format off on a blank line").toBe(true)
  expect(sub(blank, "Insert")!.disabled, "Insert on on a blank line").toBe(false)

  const withWord = menuRows(mkView("word", 2)) // caret in "word"
  expect(sub(withWord, "Format")!.disabled, "Format on when there's a word").toBe(false)
  expect(sub(withWord, "Insert")!.disabled, "Insert off on a line with text").toBe(true)
})

test("the whole Insert submenu is disabled off an empty line, enabled on one", () => {
  expect(sub(menuRows(mkView("plain text")), "Insert")!.disabled).toBe(true)

  const emptyLine = sub(menuRows(mkView("")), "Insert")!
  expect(emptyLine.disabled).toBe(false)
  expect(labels(emptyLine.rows)).toEqual([
    "Table",
    "Divider",
    "Code block",
    "Block math",
    "Frontmatter",
  ])
})

test("a table-cell selection gets only Format plus clipboard", () => {
  // No editable table here, so this just exercises the non-cell path staying
  // stable; the cell path is covered in context-menu.test.tsx.
  const l = labels(menuRows(mkView("word", 0, 4)))
  expect(l).toContain("Format")
})

test("linkPartsIn breaks out the URL and its span", () => {
  const text = "see [the docs](https://example.com) now"
  const parts = linkPartsIn(text, text.indexOf("docs"))
  expect(parts).not.toBeNull()
  expect(parts!.label).toBe("the docs")
  expect(parts!.url).toBe("https://example.com")
  expect(text.slice(parts!.urlFrom, parts!.urlTo)).toBe("https://example.com")
})

test("'Add external link' wraps the selection on submit", () => {
  const view = mkView("make this a link", 5, 9) // "this"
  const row = linkRow(view)
  expect(row.label).toBe("Add external link")
  expect(row.value).toBe("")
  row.onSubmit("https://x.test")
  expect(view.state.doc.toString()).toBe("make [this](https://x.test) a link")
})

test("a URL with spaces is angle-bracketed so it stays a valid link", () => {
  const view = mkView("wrap word here", 5, 9) // "word"
  linkRow(view).onSubmit("https://ex.test/a b c")
  expect(view.state.doc.toString()).toBe("wrap [word](<https://ex.test/a b c>) here")
})

test("editing a link's URL to one with spaces re-brackets it", () => {
  const doc = "see [x](https://a.test) end"
  const view = mkView(doc, doc.indexOf("x") + 1)
  linkRow(view).onSubmit("https://a.test/with space")
  expect(view.state.doc.toString()).toBe("see [x](<https://a.test/with space>) end")
})

test("the caret in a link gets a prefilled 'Edit external link' field with Remove link", () => {
  const doc = "go to [home](https://a.test) please"
  const view = mkView(doc, doc.indexOf("home") + 1)
  const row = linkRow(view)
  expect(row.label).toBe("Edit external link")
  expect(row.value).toBe("https://a.test")
  expect(row.actions?.some((a) => a.label === "Remove link")).toBe(true)

  row.onSubmit("https://b.test")
  expect(view.state.doc.toString()).toBe("go to [home](https://b.test) please")

  row.actions!.find((a) => a.label === "Remove link")!.onSelect()
  expect(view.state.doc.toString()).toBe("go to home please")
})

test("wikiLinkPartsIn breaks out the target and its span", () => {
  const text = "jump to [[api/reference|the api]] now"
  const parts = wikiLinkPartsIn(text, text.indexOf("reference"))
  expect(parts).not.toBeNull()
  expect(parts!.target).toBe("api/reference")
  expect(parts!.label).toBe("the api")
  expect(text.slice(parts!.targetFrom, parts!.targetTo)).toBe("api/reference")
})

test("'Add link' wraps the selection as a wikilink on submit", () => {
  const view = mkView("see the docs page", 8, 12) // "docs"
  const row = wikiLinkRow(view)
  expect(row.label).toBe("Add link")
  expect(row.value).toBe("")
  row.onSubmit("guides/docs")
  expect(view.state.doc.toString()).toBe("see the [[guides/docs|docs]] page")
})

test("submitting a blank target wraps the selection as a plain [[wikilink]]", () => {
  const view = mkView("see the docs page", 8, 12)
  wikiLinkRow(view).onSubmit("")
  expect(view.state.doc.toString()).toBe("see the [[docs]] page")
})

test("the caret in a wikilink gets a prefilled 'Edit link' field with Remove link", () => {
  const doc = "open [[api/ref|the API]] please"
  const view = mkView(doc, doc.indexOf("ref") + 1)
  const row = wikiLinkRow(view)
  expect(row.label).toBe("Edit link")
  expect(row.value).toBe("api/ref")
  row.onSubmit("api/REF") // same length keeps the row's spans valid for the next call
  expect(view.state.doc.toString()).toBe("open [[api/REF|the API]] please")

  row.actions!.find((a) => a.label === "Remove link")!.onSelect()
  expect(view.state.doc.toString()).toBe("open the API please")
})

test("wikilink over a selection already inside a link replaces the link, no nesting", () => {
  const doc = "is the [source](link.com) of truth"
  const s = doc.indexOf("source")
  const view = mkView(doc, s, s + 6) // select the visible "source"
  wikiLinkRow(view).onSubmit("wiki term")
  expect(view.state.doc.toString()).toBe("is the [[wiki term|source]] of truth")
})

test("link over a selection already inside a wikilink replaces the wikilink", () => {
  const doc = "see [[Page|the page]] now"
  const s = doc.indexOf("the page")
  const view = mkView(doc, s, s + 8)
  linkRow(view).onSubmit("https://x.test")
  expect(view.state.doc.toString()).toBe("see [the page](https://x.test) now")
})

test("selectionUI 'bar' and 'none' drop the link rows and Format from the menu", () => {
  for (const ui of ["bar", "none"] as const) {
    const l = labels(menuRows(mkView("hello world", 0, 5, ui)))
    expect(l).toEqual(["Paragraph", "Insert", "Cut", "Copy", "Paste"])
  }
})

test("selectionUI 'menu' (default) keeps the link rows and Format in the menu", () => {
  const l = labels(menuRows(mkView("hello world", 0, 5, "menu")))
  expect(l.slice(0, 3)).toEqual(["Add link", "Add external link", "Format"])
})

test("inside a fenced code block the menu is just Language + clipboard", () => {
  const doc = "```ts\nconst x = 1\n```"
  const view = mkView(doc, doc.indexOf("const") + 2)
  expect(labels(menuRows(view))).toEqual(["Language", "Cut", "Copy", "Paste"])
})

test("the Language row edits the fence info string and can remove the block", () => {
  const doc = "```ts\ncode here\n```"
  const view = mkView(doc, doc.indexOf("code") + 1)
  const row = codeBlockRow(view)
  expect(row.value).toBe("ts")
  row.onSubmit("python")
  expect(view.state.doc.toString()).toBe("```python\ncode here\n```")

  codeBlockRow(view)
    .actions!.find((a) => a.label === "Remove code block")!
    .onSelect()
  expect(view.state.doc.toString()).toBe("code here")
})

test("a fence with no language shows an empty Language field", () => {
  const doc = "```\nplain\n```"
  const view = mkView(doc, doc.indexOf("plain"))
  expect(codeBlockRow(view).value).toBe("")
})

test("the Paragraph submenu's Body row clears a heading", () => {
  const view = mkView("## A Heading", 5)
  const body = sub(menuRows(view), "Paragraph")!.rows.find(
    (r): r is MenuAction => r !== "separator" && r.label === "Body",
  )!
  expect(body.disabled).toBeFalsy()
  body.onSelect()
  expect(view.state.doc.toString()).toBe("A Heading")
})

test("inside $math$ the Format submenu greys every mark and offers Edit math", () => {
  const doc = "wrap $x$ up"
  const view = mkView(doc, doc.indexOf("x") + 1)
  const fmt = sub(menuRows(view), "Format")!
  const byLabel = (l: string) =>
    fmt.rows.find((r): r is MenuAction => r !== "separator" && "onSelect" in r && r.label === l)!
  expect(byLabel("Bold").disabled).toBe(true)
  expect(byLabel("Italic").disabled).toBe(true)
  expect(byLabel("Inline code").disabled).toBe(true)

  const field = fmt.rows.find((r): r is MenuField => r !== "separator" && "field" in r)!
  expect(field.label).toBe("Edit math")
  expect(field.value).toBe("x")
})

test("'Add math' wraps the selection as $…$ on submit", () => {
  const view = mkView("wrap word here", 5, 9) // "word"
  const row = mathRow(view)
  expect(row.label).toBe("Add math")
  expect(row.value).toBe("")
  row.onSubmit("x^2")
  expect(view.state.doc.toString()).toBe("wrap $x^2$ here")
})

test("the caret in $…$ gets a prefilled 'Edit math' field with Remove math", () => {
  const doc = "see $e^{i\\pi}$ here"
  const view = mkView(doc, doc.indexOf("pi") + 1)
  const row = mathRow(view)
  expect(row.label).toBe("Edit math")
  expect(row.value).toBe("e^{i\\pi}")

  row.onSubmit("x^2")
  expect(view.state.doc.toString()).toBe("see $x^2$ here")
})

test("Remove math unwraps to the literal LaTeX", () => {
  const doc = "see $e^{i\\pi}$ here"
  const view = mkView(doc, doc.indexOf("pi") + 1)
  mathRow(view)
    .actions!.find((a) => a.label === "Remove math")!
    .onSelect()
  expect(view.state.doc.toString()).toBe("see e^{i\\pi} here")
})

test("the caret in a one-line $$…$$ block gets a prefilled field rewritten as $$…$$", () => {
  const doc = "before $$x^2 + 1$$ after"
  const view = mkView(doc, doc.indexOf("x^2"))
  const row = mathRow(view)
  expect(row.label).toBe("Edit math")
  expect(row.value).toBe("x^2 + 1")
  row.onSubmit("y^3")
  expect(view.state.doc.toString()).toBe("before $$y^3$$ after")
})

test("a multi-line $$ block's opening fence has no math at the caret — an empty Add math field", () => {
  const view = mkView("$$\nx^2\n$$", 0)
  const row = mathRow(view)
  expect(row.label).toBe("Add math")
})

test("Paste is disabled with a hint when async clipboard read is unavailable", () => {
  // jsdom has no `navigator.clipboard`, so the menu can't read to paste.
  const rows = menuRows(mkView("hello world", 0, 5))
  const paste = rows.find((r): r is MenuAction => r !== "separator" && r.label === "Paste")!
  expect(paste.disabled).toBe(true)
  expect(paste.title).toMatch(/keyboard/i)
})

test("menu groups: config picks and orders the top-level sections", () => {
  const l = labels(menuRows(mkGroupsView("hello world", ["clipboard", "insert"])))
  expect(l).toEqual(["Cut", "Copy", "Paste", "Insert"])
})

test("menu groups: a single group yields just that group", () => {
  const l = labels(menuRows(mkGroupsView("hello world", ["paragraph"])))
  expect(l).toEqual(["Paragraph"])
})

test("menu groups: link and format still yield to selectionUI 'bar'", () => {
  const l = labels(menuRows(mkGroupsView("hello world", ["link", "format", "insert"], "bar")))
  expect(l).toEqual(["Insert"])
})

test("resolveContextMenu maps the prop shapes", () => {
  expect(resolveContextMenu(false).enabled).toBe(false)
  expect(resolveContextMenu(true).groups).toEqual([
    "host",
    "link",
    "format",
    "paragraph",
    "insert",
    "clipboard",
  ])
  expect(resolveContextMenu(undefined).groups).toContain("link")
  expect(resolveContextMenu({ groups: ["insert"] }).groups).toEqual(["insert"])
  expect(resolveContextMenu({ groups: [] }).groups).toContain("clipboard") // empty → default
})

test("resolveSelectionBarItems keeps known inline ids in order, drops the rest", () => {
  expect(resolveSelectionBarItems()).toHaveLength(7)
  expect(resolveSelectionBarItems(["math", "bold"])).toEqual(["math", "bold"])
  expect(resolveSelectionBarItems(["h1", "table"])).toHaveLength(7) // none valid → default
})

test("commands that can't apply where the caret sits are greyed, not removed", () => {
  // Inside frontmatter the inline wrap commands report disabled.
  const fm = "---\ntitle: x\n---\n"
  const inFm = fm.indexOf("title")
  const fmt = sub(menuRows(mkView(fm, inFm, inFm + 5)), "Format")!
  const bold = fmt.rows.find((r): r is MenuAction => r !== "separator" && r.label === "Bold")!
  expect(bold.disabled).toBe(true)
})
