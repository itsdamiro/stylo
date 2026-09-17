import { createRef, useState } from "react"
import { afterEach, expect, test, vi } from "vitest"
import { cleanup, render, screen } from "@testing-library/react"
import { Stylo } from "../src/Stylo"
import type { StyloHandle } from "../src/types"

afterEach(cleanup)

/** Controlled wrapper so `onChange` round-trips back into `value`. */
function Harness({
  initial,
  onSave,
  handleRef,
}: {
  initial: string
  onSave?: (v: string) => void
  handleRef?: React.Ref<StyloHandle>
}) {
  const [doc, setDoc] = useState(initial)
  return <Stylo ref={handleRef} value={doc} onChange={setDoc} mode="source" onSave={onSave} />
}

function pressModS(el: Element) {
  // jsdom reports a non-Mac platform, so CodeMirror maps "Mod-" to Ctrl.
  const ev = new KeyboardEvent("keydown", {
    key: "s",
    ctrlKey: true,
    bubbles: true,
    cancelable: true,
  })
  el.dispatchEvent(ev)
  return ev
}

test("Mod-s calls onSave with the current document and suppresses the default", () => {
  const onSave = vi.fn()
  const { container } = render(<Harness initial="# draft" onSave={onSave} />)

  const ev = pressModS(container.querySelector(".cm-content")!)

  expect(onSave).toHaveBeenCalledWith("# draft")
  expect(ev.defaultPrevented).toBe(true)
})

test("Mod-s is left to the browser when no onSave is given", () => {
  const { container } = render(<Harness initial="# draft" />)

  const ev = pressModS(container.querySelector(".cm-content")!)

  expect(ev.defaultPrevented).toBe(false)
})

test("the ref handle exposes the view, insert, and heading navigation", () => {
  const ref = createRef<StyloHandle>()
  const { container } = render(
    <Harness initial={"# Alpha\n\nbody\n\n## Beta section\n\nmore"} handleRef={ref} />,
  )

  expect(ref.current!.getView()).not.toBeNull()

  expect(ref.current!.scrollToHeading("beta SECTION")).toBe(true)
  expect(ref.current!.scrollToHeading("no such heading")).toBe(false)

  ref.current!.insertAtCursor("INSERTED")
  expect(container.querySelector(".cm-content")!.textContent).toContain("INSERTED")

  expect(() => ref.current!.focus()).not.toThrow()
})

test("the save toolbar button runs onSave and is disabled without a handler", () => {
  const onSave = vi.fn()
  const withHandler = render(
    <Stylo
      value="# doc"
      onChange={() => {}}
      mode="source"
      onSave={onSave}
      toolbar={{ items: ["save"] }}
    />,
  )
  const btn = withHandler.container.querySelector('button[aria-label="Save"]') as HTMLButtonElement
  expect(btn.disabled).toBe(false)
  btn.click()
  expect(onSave).toHaveBeenCalledWith("# doc")
  cleanup()

  const noHandler = render(
    <Stylo value="# doc" onChange={() => {}} mode="source" toolbar={{ items: ["save"] }} />,
  )
  const disabled = noHandler.container.querySelector(
    'button[aria-label="Save"]',
  ) as HTMLButtonElement
  expect(disabled.disabled).toBe(true)
})

test("the handle is inert in preview mode", () => {
  const ref = createRef<StyloHandle>()
  render(<Stylo ref={ref} value="# hi" onChange={() => {}} mode="preview" />)

  expect(ref.current!.getView()).toBeNull()
  expect(ref.current!.scrollToHeading("hi")).toBe(false)
  expect(() => ref.current!.insertAtCursor("x")).not.toThrow()
  expect(() => ref.current!.focus()).not.toThrow()
})

test("invalidateEmbed is a no-op without an embedSource, in every mode", () => {
  const ref = createRef<StyloHandle>()
  render(<Stylo ref={ref} value="# hi" onChange={() => {}} mode="preview" />)
  expect(() => ref.current!.invalidateEmbed("Note")).not.toThrow()
  expect(() => ref.current!.invalidateEmbed()).not.toThrow()
})

test("invalidateEmbed makes an already-rendered embed re-resolve and update", async () => {
  const ref = createRef<StyloHandle>()
  let version = 1
  const embedSource = vi.fn(() => <span data-testid="embed">v{version}</span>)
  render(
    <Stylo
      ref={ref}
      value="![[Note]]"
      onChange={() => {}}
      mode="preview"
      embedSource={embedSource}
    />,
  )

  expect((await screen.findByTestId("embed")).textContent).toBe("v1")
  expect(embedSource).toHaveBeenCalledTimes(1)

  version = 2
  ref.current!.invalidateEmbed("Note")

  await vi.waitFor(() => {
    expect(screen.getByTestId("embed").textContent).toBe("v2")
  })
  expect(embedSource).toHaveBeenCalledTimes(2)
})

test("invalidateEmbed with no ref clears every cached embed for the source", async () => {
  const ref = createRef<StyloHandle>()
  const embedSource = vi.fn((r: string) => <span data-testid={`embed-${r}`}>{r}</span>)
  render(
    <Stylo
      ref={ref}
      value={"![[A]]\n\n![[B]]"}
      onChange={() => {}}
      mode="preview"
      embedSource={embedSource}
    />,
  )

  await screen.findByTestId("embed-A")
  await screen.findByTestId("embed-B")
  expect(embedSource).toHaveBeenCalledTimes(2)

  ref.current!.invalidateEmbed()

  await vi.waitFor(() => expect(embedSource).toHaveBeenCalledTimes(4))
})
