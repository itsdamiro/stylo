import { createRef } from "react"
import { afterEach, expect, test, vi } from "vitest"
import { cleanup, render, screen } from "@testing-library/react"
import { Stylo } from "../src/Stylo"
import type { ImageSource, StyloHandle } from "../src/types"

afterEach(cleanup)

const picture: ImageSource = (src, alt) => (
  <img data-testid="pic" src={`/served/${src}`} alt={alt} />
)

function preview(value: string, imageSource?: ImageSource, extra: object = {}) {
  return render(
    <Stylo value={value} onChange={() => {}} mode="preview" imageSource={imageSource} {...extra} />,
  )
}

test("a lone image is drawn by imageSource", async () => {
  preview("![logo](a/b.svg)", picture)
  const img = await screen.findByTestId("pic")
  expect(img.getAttribute("src")).toBe("/served/a/b.svg")
  expect(img.getAttribute("alt")).toBe("logo")
})

test("alt reaches the host with its size suffix intact", async () => {
  const source = vi.fn(picture)
  preview("![logo|w300](a.png)", source)
  await screen.findByTestId("pic")
  expect(source).toHaveBeenCalledWith("a.png", "logo|w300")
})

test("a data: source reaches the host unfiltered", async () => {
  const source = vi.fn(picture)
  preview("![dot](data:image/png;base64,AAAA)", source)
  await screen.findByTestId("pic")
  expect(source).toHaveBeenCalledWith("data:image/png;base64,AAAA", "dot")
})

test("without imageSource the image renders as it did before", () => {
  const { container } = preview("![logo](a/b.svg)")
  expect(container.querySelector(".stylo-image")).toBeNull()
  expect(container.querySelector("img")?.getAttribute("src")).toBe("a/b.svg")
})

test("null keeps the source as literal text", async () => {
  const { container } = preview("![logo](a/b.svg)", () => null)
  await vi.waitFor(() => expect(container.textContent).toContain("![logo](a/b.svg)"))
  expect(container.querySelector("img")).toBeNull()
})

test("the source shows while an async resolution is pending, then the picture", async () => {
  let release: (n: React.ReactNode) => void = () => {}
  const source: ImageSource = () => new Promise((resolve) => (release = resolve))
  const { container } = preview("![logo](a.png)", source)
  expect(container.textContent).toContain("![logo](a.png)")
  release(<img data-testid="pic" alt="" />)
  await screen.findByTestId("pic")
  expect(container.textContent).not.toContain("![logo](a.png)")
})

test("a throw reaches onResolveError and the source stays", async () => {
  const onResolveError = vi.fn()
  const boom = new Error("nope")
  const { container } = preview(
    "![logo](a.png)",
    () => {
      throw boom
    },
    { onResolveError },
  )
  await vi.waitFor(() => expect(onResolveError).toHaveBeenCalled())
  expect(onResolveError).toHaveBeenCalledWith(boom, { source: "imageSource", input: "a.png" })
  expect(container.textContent).toContain("![logo](a.png)")
})

test("the source text is shown as written, with angle brackets and title", async () => {
  const { container } = preview('![a](<my file.png> "t")', () => null)
  await vi.waitFor(() => expect(container.textContent).toContain('![a](<my file.png> "t")'))
})

test("an image inside a sentence, a list item or a quote is left alone", () => {
  const source = vi.fn(picture)
  const { container } = preview("see ![a](b.png) here\n\n- ![c](d.png)\n\n> ![e](f.png)\n", source)
  expect(source).not.toHaveBeenCalled()
  expect(container.querySelectorAll("img")).toHaveLength(3)
})

test("an image that continues a paragraph is not a lone image", () => {
  const source = vi.fn(picture)
  preview("some words\n![a](b.png)\n", source)
  expect(source).not.toHaveBeenCalled()
})

test("an image followed by words in the same paragraph is left alone", () => {
  const source = vi.fn(picture)
  const { container } = preview("![a](b.png) and more words\n", source)
  expect(source).not.toHaveBeenCalled()
  expect(container.textContent).toContain("and more words")
})

test("two images on one line are not a lone image", () => {
  const source = vi.fn(picture)
  preview("![a](b.png) ![c](d.png)\n", source)
  expect(source).not.toHaveBeenCalled()
})

test("an image with no destination is left alone", () => {
  const source = vi.fn(picture)
  const { container } = preview("![a]()\n", source)
  expect(source).not.toHaveBeenCalled()
  expect(container.querySelector(".stylo-image")).toBeNull()
})

test("changing only the alt resolves the image again", async () => {
  const source = vi.fn(picture)
  const props = { onChange: () => {}, mode: "preview" as const, imageSource: source }
  const { rerender } = render(<Stylo value="![a|100](x.png)" {...props} />)
  await screen.findByTestId("pic")
  rerender(<Stylo value="![a|400](x.png)" {...props} />)
  await vi.waitFor(() => expect(source).toHaveBeenLastCalledWith("x.png", "a|400"))
})

test("an image reference ![a][ref] and a link are left alone", () => {
  const source = vi.fn(picture)
  preview("![a][ref]\n\n[a](b.png)\n\n[ref]: c.png\n", source)
  expect(source).not.toHaveBeenCalled()
})

test("two lone images are resolved separately", async () => {
  preview("![one](a.png)\n\n![two](b.png)\n", picture)
  await vi.waitFor(() => expect(screen.getAllByTestId("pic")).toHaveLength(2))
})

test("results are cached by src and alt", async () => {
  const source = vi.fn(picture)
  preview("![a|100](x.png)\n\n![a|100](x.png)\n\n![a|400](x.png)\n", source)
  await vi.waitFor(() => expect(screen.getAllByTestId("pic")).toHaveLength(3))
  expect(source).toHaveBeenCalledTimes(2)
})

test("invalidateImage(src) re-resolves every alt for that src, and only that src", async () => {
  const ref = createRef<StyloHandle>()
  let version = 1
  const source = vi.fn((src: string, alt: string) => (
    <span data-testid={`${src}-${alt}`}>v{version}</span>
  ))
  render(
    <Stylo
      ref={ref}
      value={"![s](a.png)\n\n![l](a.png)\n\n![s](b.png)"}
      onChange={() => {}}
      mode="preview"
      imageSource={source}
    />,
  )
  await screen.findByTestId("a.png-s")
  await screen.findByTestId("a.png-l")
  await screen.findByTestId("b.png-s")
  expect(source).toHaveBeenCalledTimes(3)

  version = 2
  ref.current!.invalidateImage("a.png")
  await vi.waitFor(() => expect(screen.getByTestId("a.png-s").textContent).toBe("v2"))
  expect(screen.getByTestId("a.png-l").textContent).toBe("v2")
  expect(screen.getByTestId("b.png-s").textContent).toBe("v1")
  expect(source).toHaveBeenCalledTimes(5)
})

test("invalidateImage() with no src clears every image, and is a no-op without imageSource", async () => {
  const ref = createRef<StyloHandle>()
  const source = vi.fn(picture)
  render(
    <Stylo
      ref={ref}
      value={"![a](a.png)\n\n![b](b.png)"}
      onChange={() => {}}
      mode="preview"
      imageSource={source}
    />,
  )
  await vi.waitFor(() => expect(screen.getAllByTestId("pic")).toHaveLength(2))
  ref.current!.invalidateImage()
  await vi.waitFor(() => expect(source).toHaveBeenCalledTimes(4))

  cleanup()
  const bare = createRef<StyloHandle>()
  render(<Stylo ref={bare} value="x" onChange={() => {}} mode="preview" />)
  expect(() => bare.current!.invalidateImage("a.png")).not.toThrow()
  expect(() => bare.current!.invalidateImage()).not.toThrow()
})

test("invalidateImage() reaches a mounted image whose cache entry was evicted", async () => {
  const ref = createRef<StyloHandle>()
  let version = 1
  const source = vi.fn((src: string) => <span data-testid={src}>v{version}</span>)
  const doc = Array.from({ length: 70 }, (_, i) => `![a](img-${i}.png)`).join("\n\n")
  render(<Stylo ref={ref} value={doc} onChange={() => {}} mode="preview" imageSource={source} />)
  await vi.waitFor(() => expect(source).toHaveBeenCalledTimes(70))
  await screen.findByTestId("img-0.png")

  version = 2
  ref.current!.invalidateImage()
  await vi.waitFor(() => expect(screen.getByTestId("img-0.png").textContent).toBe("v2"))
  ref.current!.invalidateImage("img-1.png")
  await vi.waitFor(() => expect(screen.getByTestId("img-1.png").textContent).toBe("v2"))
})

test("a src with a NUL character reaches the host whole", async () => {
  const source = vi.fn(picture)
  preview("![a](x\u0000y.png)", source)
  await screen.findByTestId("pic")
  expect(source).toHaveBeenCalledWith("x\u0000y.png", "a")
})

test("split mode draws the same picture", async () => {
  const { container } = render(
    <Stylo value="![logo](a/b.svg)" onChange={() => {}} mode="split" imageSource={picture} />,
  )
  const img = await screen.findByTestId("pic")
  expect(img.getAttribute("src")).toBe("/served/a/b.svg")
  expect(container.querySelector(".stylo-image")).not.toBeNull()
})

test("an ![[embed]] still goes to embedSource when imageSource is set", async () => {
  const embedSource = vi.fn(() => <span data-testid="emb">e</span>)
  preview("![[Note]]\n\n![a](b.png)\n", picture, { embedSource })
  await screen.findByTestId("emb")
  await screen.findByTestId("pic")
  expect(embedSource).toHaveBeenCalledWith("Note")
})
