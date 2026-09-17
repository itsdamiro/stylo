import type { Root } from "mdast"
import { expect, test } from "vitest"
import { remarkWikilink } from "../src/render/remark-wikilink"

function paragraph(text: string): Root {
  return {
    type: "root",
    children: [{ type: "paragraph", children: [{ type: "text", value: text }] }],
  }
}

function runOn(text: string) {
  const tree = paragraph(text)
  remarkWikilink()(tree)
  const para = tree.children[0]
  if (para?.type !== "paragraph") throw new Error("expected a paragraph")
  return para.children
}

test("rewrites [[target]] into a link carrying data-wikilink", () => {
  const nodes = runOn("see [[Note]] here")
  expect(nodes.map((n) => n.type)).toEqual(["text", "link", "text"])
  const link = nodes[1]
  if (link?.type !== "link") throw new Error("expected a link")
  expect(link.data?.hProperties?.["data-wikilink"]).toBe("Note")
  expect(link.children[0]).toMatchObject({ type: "text", value: "Note" })
})

test("[[target|label]] uses the label as text and the target as data", () => {
  const nodes = runOn("[[Real Target|shown label]]")
  const link = nodes[0]
  if (link?.type !== "link") throw new Error("expected a link")
  expect(link.data?.hProperties?.["data-wikilink"]).toBe("Real Target")
  expect(link.children[0]).toMatchObject({ value: "shown label" })
})

test("handles multiple wikilinks in one text node", () => {
  const nodes = runOn("[[A]] and [[B]]")
  expect(nodes.map((n) => n.type)).toEqual(["link", "text", "link"])
})

test("leaves text without wikilinks untouched", () => {
  const nodes = runOn("no links, just [brackets] and text")
  expect(nodes).toHaveLength(1)
  expect(nodes[0]).toMatchObject({ type: "text" })
})

test("a bare ![[embed]] is left untouched, not turned into a dead link", () => {
  // With no `embedSource`, `remarkEmbed` never runs — this is the one place
  // in the pipeline that sees the raw `![[…]]` text, and it must leave the
  // inner `[[…]]` alone rather than rewriting it into a link the `!` then
  // sits in front of.
  const nodes = runOn("before ![[Note]] after")
  expect(nodes).toHaveLength(1)
  expect(nodes[0]).toMatchObject({ type: "text", value: "before ![[Note]] after" })
})

test("a real wikilink next to a ![[embed]] on the same line is still rewritten", () => {
  const nodes = runOn("![[Embed]] and [[Real]]")
  expect(nodes.map((n) => n.type)).toEqual(["text", "link"])
  expect(nodes[0]).toMatchObject({ value: "![[Embed]] and " })
  const link = nodes[1]
  if (link?.type !== "link") throw new Error("expected a link")
  expect(link.data?.hProperties?.["data-wikilink"]).toBe("Real")
})
