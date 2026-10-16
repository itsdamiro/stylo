import { StrictMode, useState } from "react"
import { createRoot } from "react-dom/client"
import {
  Stylo,
  type EmbedSource,
  type ImageSource,
  type RevealMode,
  type SelectionUI,
  type StyloMode,
  type TableEditing,
  type TagSource,
  type WikiLinkSource,
} from "../src/index"
import type { EditorState } from "@codemirror/state"
import { Decoration, EditorView, gutter, GutterMarker } from "@codemirror/view"
import "katex/dist/katex.min.css"

/**
 * Deterministic mount of `<Stylo>` for the Playwright suite (`test/browser/`).
 * Everything is driven by URL query params so a spec controls the surface
 * without touching a control panel:
 *
 *   ?mode=in-place|source|preview|split   (default in-place)
 *   ?selectionUI=menu|bar|none            (default menu)
 *   ?table=source|cells                   (default source)
 *   ?reveal=caret|never                   (default caret)
 *   ?sticky=top|bottom                    (default none)
 *   ?toolbar=0                            (default on)
 *   ?theme=dark                           (default light)
 *   ?doc=basic|math|code|rule|table|long|embed|embedtight|image|imagefull|imageedge|imagewide|imageinline|imageinlinewide (default basic)
 *   ?wikilinks=1                          (canned wikiLinkSource; default off)
 *   ?tags=1                               (canned tagSource; default off)
 *   ?embed=1                              (canned embedSource; default off)
 *   ?image=1                              (canned imageSource: an inline SVG picture, sized
 *                                          by a `|w120` / `|h80` suffix on the alt; default off;
 *                                          `image=slow` resolves each after 600 ms)
 *   ?imageWidth=wide  ?imageAlign=center|right   (the props of the same names; default column, left)
 *   ?hostCap=0                            (the canned picture drops its own `max-width: 100%`, so
 *                                          only Stylo's cap holds it)
 *   ?editorHeight=480                     (the canvas editor is that many px tall, so its scroller
 *                                          scrolls and shows a scrollbar, as in a host's fixed pane)
 *   ?column=420                           (a host column: `.cm-content` capped at that many px and
 *                                          centred in the editor, as a host that lays out a page does)
 *   ?hostItem=1                           (one right-click "Comment" item, readOnlySafe; its
 *                                          run writes the selected text to window.__hostRun)
 *   ?cellMark=1                           (doc=table, table=cells: marks the word "paint" in its
 *                                          cell; a click on it increments window.__markClicks)
 *   ?cellWidget=1                         (doc=table, table=cells: a button after the word "paint";
 *                                          a click on it increments window.__widgetClicks)
 *   ?readOnly=1                           (default off)
 */

/** A fixed candidate list, filtered by prefix — enough to exercise the popup. */
const WIKI_TARGETS = ["Getting Started", "Guide/Setup", "Guide/API Reference", "Changelog"]
const cannedWikiLinkSource: WikiLinkSource = (query) => {
  const q = query.trim().toLowerCase()
  return WIKI_TARGETS.filter((t) => t.toLowerCase().includes(q)).map((target) => ({ target }))
}

const TAG_CANDIDATES = ["project", "project/urgent", "recipe", "reading-list"]
const cannedTagSource: TagSource = (query) => {
  const q = query.trim().toLowerCase()
  return TAG_CANDIDATES.filter((t) => t.toLowerCase().includes(q)).map((tag) => ({ tag }))
}

/**
 * Resolves any `![[ref]]` to a marked node — enough to prove the portal path.
 * Phrasing content (a `<span>`, not a `<div>`) so it also sits correctly when the
 * embed is inline mid-sentence.
 */
const cannedEmbedSource: EmbedSource = (ref) => (
  <span className="fixture-embed">
    embed: {ref} <button type="button">act</button>
  </span>
)

/**
 * Resolves any image to a small inline-SVG `<img>` (no network), reading the
 * size convention from ADR-014 off `alt` (`|300`, `|w300`, `|h200`, `|300x200`, `|full`)
 * as a host would. `data-src` and `data-alt` record what the hook was given.
 */
const cannedImageSource: ImageSource = (src, alt) => {
  const [text = "", size = ""] = alt.split("|")
  const full = size.trim() === "full"
  const m = /^(?:(\d+)|w(\d+)|h(\d+)|(\d+)x(\d+))$/.exec(size.trim())
  const width = m?.[1] ?? m?.[2] ?? m?.[4]
  const height = m?.[3] ?? m?.[5]
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="120"><rect width="240" height="120" fill="#cde"/></svg>`
  return (
    <img
      className="fixture-image"
      src={`data:image/svg+xml;utf8,${encodeURIComponent(svg)}`}
      alt={text}
      data-src={src}
      data-alt={alt}
      width={width ? Number(width) : undefined}
      height={height ? Number(height) : undefined}
      style={{
        maxWidth: new URLSearchParams(location.search).get("hostCap") === "0" ? undefined : "100%",
        width: full ? "100%" : undefined,
        height: full || (width && !height) ? "auto" : undefined,
      }}
    />
  )
}

const DOCS: Record<string, string> = {
  basic: [
    "# Field notes",
    "",
    "Text can be **bold**, _italic_, or `inline code`, plus a [link](https://codemirror.net).",
    "",
    "A second paragraph so there is a plain line to click into.",
  ].join("\n"),
  math: [
    "# Math",
    "",
    "Inline: $e^{i\\pi} + 1 = 0$.",
    "",
    "$$",
    "\\int_0^1 x^2 \\, dx = \\frac{1}{3}",
    "$$",
  ].join("\n"),
  code: [
    "# Code",
    "",
    "A paragraph before the block.",
    "",
    "```ts",
    "const answer = 42",
    "```",
    "",
    "A paragraph after the block.",
  ].join("\n"),
  rule: [
    "# Rule",
    "",
    "A paragraph above the rule.",
    "",
    "---",
    "",
    "A paragraph below the rule.",
  ].join("\n"),
  table: [
    "# Table",
    "",
    "| Surface | Live | Chunk |",
    "| ------- | ---- | ----- |",
    "| source  | no   | no    |",
    "| in-place| yes  | paint |",
  ].join("\n"),
  long: [
    "# Long document",
    "",
    ...Array.from(
      { length: 60 },
      (_, i) => `Paragraph ${i + 1}. Enough lines that the window scrolls.`,
    ),
  ].join("\n"),
  image: [
    "# Images",
    "",
    "Text before the image.",
    "",
    "![logo|w120](a/b.svg)",
    "",
    "A sentence with ![inline](c.png) in it.",
    "",
    "![tall|h80](d.svg)",
    "",
    "Text after the image.",
  ].join("\n"),
  imagefull: ["# Wide", "", "Text before.", "", "![wide|full](a/b.svg)", "", "Text after."].join(
    "\n",
  ),
  imagewide: [
    "# Wide",
    "",
    "Text before.",
    "",
    "![narrow|w200](a.svg)",
    "",
    "Text between.",
    "",
    "![mid|w450](b.svg)",
    "",
    "Text beside.",
    "",
    "![huge|w1500](c.svg)",
    "",
    "Text after.",
    "",
    ...Array.from(
      { length: new URLSearchParams(location.search).get("long") === "1" ? 40 : 0 },
      (_, i) => `Filler ${i + 1}.\n`,
    ),
  ].join("\n"),
  imageinline: [
    "# Heading with ![h](h.svg) in it",
    "",
    "A sentence with ![sentence](s.svg) in it.",
    "",
    "- a list item with ![item](i.svg) in it",
    "",
    "> a quote with ![quote](q.svg) in it",
    "",
    "- ![alone in an item](a.svg)",
    "",
    "| a | b |",
    "| - | - |",
    "| ![cell](c.svg) | x |",
    "",
    "A badge [![linked](l.svg)](https://example.com) stays source.",
    "",
    "Code `![code](k.svg)` stays source.",
  ].join("\n"),
  imageinlinewide: ["# Inline", "", "A sentence with ![big|w1500](big.svg) in it."].join("\n"),
  imageedge: ["![top|w120](a/b.svg)", "", "middle", "", "![bottom|h80](d.svg)"].join("\n"),
  embedtight: [
    "# Tight",
    "",
    "A long paragraph that wraps over several visual lines so the caret has to cross them before it reaches the embed. ".repeat(
      4,
    ),
    "![[Weekly note]]",
    "Text below the embed line.",
  ].join("\n"),
  embed: [
    "# Embeds",
    "",
    "Text before the embed.",
    "",
    "![[Weekly note]]",
    "",
    "A paragraph that mentions ![[Inline ref]] partway through the line.",
    "",
    "| Col | Note |",
    "| --- | ---- |",
    "| a | see ![[Cell ref]] here |",
    "",
    "Text after the embed.",
  ].join("\n"),
}

const params = new URLSearchParams(location.search)
const mode = (params.get("mode") as StyloMode) ?? "in-place"
const selectionUI = (params.get("selectionUI") as SelectionUI) ?? "menu"
const table = (params.get("table") as TableEditing) ?? "source"
const reveal = (params.get("reveal") as RevealMode) ?? "caret"
const sticky = params.get("sticky") as "top" | "bottom" | null
const toolbar = params.get("toolbar") !== "0"
const overflow = params.get("overflow") === "menu" ? "menu" : undefined
const width = params.get("width")
const column = Number(params.get("column")) || null
const editorHeight = Number(params.get("editorHeight")) || null
const imageWidth = params.get("imageWidth") === "wide" ? "wide" : undefined
const imageAlign = (["center", "right"] as const).find((a) => a === params.get("imageAlign"))
const wikiLinkSource = params.get("wikilinks") === "1" ? cannedWikiLinkSource : undefined
const tagSource = params.get("tags") === "1" ? cannedTagSource : undefined
const embedSource = params.get("embed") === "1" ? cannedEmbedSource : undefined
const slowImageSource: ImageSource = (src, alt) =>
  new Promise((resolve) => setTimeout(() => resolve(cannedImageSource(src, alt)), 600))
const imageSource =
  params.get("image") === "1"
    ? cannedImageSource
    : params.get("image") === "slow"
      ? slowImageSource
      : undefined
class Dot extends GutterMarker {
  override toDOM() {
    return document.createTextNode("•")
  }
}
const hostExtensions =
  params.get("hostExt") === "1"
    ? [
        EditorView.decorations.of(
          Decoration.set([Decoration.mark({ class: "host-mark" }).range(0, 5)]),
        ),
        gutter({ class: "host-gutter", lineMarker: () => new Dot() }),
      ]
    : undefined
const hostItems =
  params.get("hostItem") === "1"
    ? [
        {
          id: "comment",
          title: "Comment",
          when: "selection" as const,
          readOnlySafe: true,
          icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 5h16v11H9l-5 4z" />
            </svg>
          ),
          run: (view: EditorView) => {
            const { from, to } = view.state.selection.main
            ;(window as unknown as { __hostRun?: string }).__hostRun = view.state.sliceDoc(from, to)
          },
        },
      ]
    : undefined
const doc = DOCS[params.get("doc") ?? "basic"] ?? DOCS.basic!
const cellMarks =
  params.get("cellMark") === "1"
    ? () => {
        const from = doc.indexOf("paint")
        return [
          { from, to: from + 5, class: "host-cell-mark", attributes: { "data-mark-id": "1" } },
        ]
      }
    : undefined
if (cellMarks) {
  document.addEventListener("click", (e) => {
    if ((e.target as HTMLElement).closest("[data-mark-id]")) {
      const w = window as unknown as { __markClicks?: number }
      w.__markClicks = (w.__markClicks ?? 0) + 1
    }
  })
}

const cellWidgets =
  params.get("cellWidget") === "1"
    ? (state: EditorState) => {
        const pos = state.doc.toString().search(/paint/) + 5
        return [
          {
            pos,
            key: "w1",
            cellClass: "host-cell-widget",
            toDOM: () => {
              const b = document.createElement("button")
              b.type = "button"
              b.textContent = "Accept"
              b.dataset.widgetId = "1"
              b.addEventListener("click", () => {
                const w = window as unknown as { __widgetClicks?: number }
                w.__widgetClicks = (w.__widgetClicks ?? 0) + 1
              })
              return b
            },
          },
        ]
      }
    : undefined

if (params.get("theme") === "dark") document.documentElement.dataset.theme = "dark"
if (column || editorHeight) {
  const style = document.createElement("style")
  style.textContent = [
    column && `#fixture .cm-editor .cm-content { max-width: ${column}px; margin-inline: auto; }`,
    editorHeight && `#fixture .cm-editor { height: ${editorHeight}px; }`,
  ]
    .filter(Boolean)
    .join("\n")
  document.head.appendChild(style)
}

function Fixture() {
  const [value, setValue] = useState(doc)
  return (
    <div style={width ? { width: `${width}px` } : undefined}>
      <Stylo
        value={value}
        onChange={(v) => {
          ;(window as unknown as { __value?: string }).__value = v
          setValue(v)
        }}
        mode={mode}
        inPlace={{
          selectionUI,
          table,
          reveal,
          cellMarks,
          cellWidgets,
          contextMenu: { items: hostItems },
        }}
        readOnly={params.get("readOnly") === "1"}
        toolbar={sticky || overflow ? { sticky: sticky ?? false, overflow } : toolbar}
        wikiLinkSource={wikiLinkSource}
        tagSource={tagSource}
        embedSource={embedSource}
        imageSource={imageSource}
        imageWidth={imageWidth}
        imageAlign={imageAlign}
        extensions={hostExtensions}
      />
    </div>
  )
}

const el = document.getElementById("fixture")
if (!el) throw new Error("#fixture not found")
createRoot(el).render(
  <StrictMode>
    <Fixture />
  </StrictMode>,
)
