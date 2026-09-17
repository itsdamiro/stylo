import { markdownLanguage } from "@codemirror/lang-markdown"
import { EditorSelection, EditorState } from "@codemirror/state"
import { EditorView } from "@codemirror/view"
import { expect, test } from "vitest"
import { inPlaceConfigFacet, resolveToggles, revealModeFacet } from "../src/inplace/config"
import { unwrapLinePrefix } from "../src/inplace/edit-line-prefix"
import { inPlaceDecorations } from "../src/inplace/plugin"

function mkView(doc: string, head: number, reveal: "caret" | "never" = "never"): EditorView {
  return new EditorView({
    state: EditorState.create({
      doc,
      selection: EditorSelection.single(head),
      extensions: [
        markdownLanguage,
        inPlaceConfigFacet.of(resolveToggles()),
        revealModeFacet.of(reveal),
        inPlaceDecorations(),
      ],
    }),
  })
}

test("Backspace at column 0 of a heading drops the whole prefix", () => {
  const view = mkView("### Title\n\nbody", 4) // visual start of "Title"
  expect(unwrapLinePrefix(view)).toBe(true)
  expect(view.state.doc.toString()).toBe("Title\n\nbody")
})

test("Backspace at column 0 of a blockquote steps out one level", () => {
  const view = mkView("> > deep", 4)
  expect(unwrapLinePrefix(view)).toBe(true)
  expect(view.state.doc.toString()).toBe("> deep")
})

test("Backspace at column 0 of a flush list item drops the marker", () => {
  const view = mkView("- item", 2)
  expect(unwrapLinePrefix(view)).toBe(true)
  expect(view.state.doc.toString()).toBe("item")
})

test("Backspace at column 0 of a nested list item outdents one step", () => {
  const view = mkView("- a\n  - b", 8) // visual start of "b"
  expect(unwrapLinePrefix(view)).toBe(true)
  expect(view.state.doc.toString()).toBe("- a\n- b")
})

test("Backspace under a 3-wide ordered marker outdents by the parent's own width", () => {
  // "1. " is 3 columns; a fixed 2-space outdent would leave a stray leading
  // space that reparses as a detached top-level list instead of a sibling.
  const view = mkView("1. a\n   - b", 10) // visual start of "b"
  expect(unwrapLinePrefix(view)).toBe(true)
  expect(view.state.doc.toString()).toBe("1. a\n- b")
})

test("Backspace at column 0 of a task line drops the checkbox prefix", () => {
  const view = mkView("- [ ] todo", 6)
  expect(unwrapLinePrefix(view)).toBe(true)
  expect(view.state.doc.toString()).toBe("todo")
})

test("not at column 0 — the key falls through", () => {
  const view = mkView("## Title", 6) // mid-word
  expect(unwrapLinePrefix(view)).toBe(false)
  expect(view.state.doc.toString()).toBe("## Title")
})

test("a plain paragraph is left alone", () => {
  const view = mkView("just text", 0)
  expect(unwrapLinePrefix(view)).toBe(false)
})

test("reveal: 'caret' with the caret on the line does not unwrap", () => {
  const view = mkView("## Title", 3, "caret")
  expect(unwrapLinePrefix(view)).toBe(false)
  expect(view.state.doc.toString()).toBe("## Title")
})
