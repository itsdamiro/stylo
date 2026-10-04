import { StrictMode, useState } from "react"
import { createRoot } from "react-dom/client"
import {
  Stylo,
  type EmbedSource,
  type RevealMode,
  type SelectionUI,
  type StyloMode,
  type TableEditing,
  type TagSource,
  type WikiLinkSource,
} from "../src/index"
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
 *   ?doc=basic|math|code|rule|table|long|embed (default basic)
 *   ?wikilinks=1                          (canned wikiLinkSource; default off)
 *   ?tags=1                               (canned tagSource; default off)
 *   ?embed=1                              (canned embedSource; default off)
 *   ?hostItem=1                           (one right-click "Comment" item, readOnlySafe; its
 *                                          run writes the selected text to window.__hostRun)
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
const wikiLinkSource = params.get("wikilinks") === "1" ? cannedWikiLinkSource : undefined
const tagSource = params.get("tags") === "1" ? cannedTagSource : undefined
const embedSource = params.get("embed") === "1" ? cannedEmbedSource : undefined
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

if (params.get("theme") === "dark") document.documentElement.dataset.theme = "dark"

function Fixture() {
  const [value, setValue] = useState(doc)
  return (
    <div style={width ? { width: `${width}px` } : undefined}>
      <Stylo
        value={value}
        onChange={setValue}
        mode={mode}
        inPlace={{ selectionUI, table, reveal, contextMenu: { items: hostItems } }}
        readOnly={params.get("readOnly") === "1"}
        toolbar={sticky || overflow ? { sticky: sticky ?? false, overflow } : toolbar}
        wikiLinkSource={wikiLinkSource}
        tagSource={tagSource}
        embedSource={embedSource}
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
