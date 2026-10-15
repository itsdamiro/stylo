import { expect, test } from "vitest"
import { parseImage } from "../src/image"

test("src and alt come out as written", () => {
  expect(parseImage("![logo](a/b.svg)")).toEqual({ src: "a/b.svg", alt: "logo" })
})

test("a size suffix stays in alt, untouched", () => {
  expect(parseImage("![logo|300](a.png)")).toEqual({ src: "a.png", alt: "logo|300" })
  expect(parseImage("![|h200](a.png)")).toEqual({ src: "a.png", alt: "|h200" })
})

test("alt keeps the Markdown written in it", () => {
  expect(parseImage("![a *b* [c]](d.png)")).toEqual({ src: "d.png", alt: "a *b* [c]" })
})

test("angle brackets are removed from the destination and nothing else is", () => {
  expect(parseImage("![a](<my file.png>)")).toEqual({ src: "my file.png", alt: "a" })
  expect(parseImage("![a](my%20file.png)")).toEqual({ src: "my%20file.png", alt: "a" })
  expect(parseImage("![a](a\\_b.png)")).toEqual({ src: "a\\_b.png", alt: "a" })
})

test("a data: source is kept whole", () => {
  expect(parseImage("![a](data:image/png;base64,AAAA)")).toEqual({
    src: "data:image/png;base64,AAAA",
    alt: "a",
  })
})

test("balanced parentheses in the destination belong to it", () => {
  expect(parseImage("![a](b(1).png)")).toEqual({ src: "b(1).png", alt: "a" })
})

test("a title is ignored", () => {
  expect(parseImage('![a](b.png "A title")')).toEqual({ src: "b.png", alt: "a" })
  expect(parseImage("![a](<b c.png> 'x')")).toEqual({ src: "b c.png", alt: "a" })
})

test("surrounding whitespace is allowed", () => {
  expect(parseImage("  ![a](b.png)  ")).toEqual({ src: "b.png", alt: "a" })
})

test("not exactly one image, or no destination, is null", () => {
  expect(parseImage("text ![a](b.png)")).toBeNull()
  expect(parseImage("![a](b.png) text")).toBeNull()
  expect(parseImage("[a](b.png)")).toBeNull()
  expect(parseImage("![a]()")).toBeNull()
  expect(parseImage("![[note.png]]")).toBeNull()
})
