import katex from "katex"
import { WIKILINK_PATTERN } from "../wikilink"
import { INLINE_MATH } from "./math"

/**
 * Render a single line of inline Markdown to DOM nodes — the subset that can
 * appear in a table cell: `` `code` ``, `$math$`, `[[wiki]]`, `[text](url)`,
 * `***both***`, `**bold**`, `*em*`, `~~strike~~`. Block constructs are out of
 * scope (a cell is one line). Reuses the `.cm-inplace-*` classes so cell text
 * matches the rest of the canvas, and tags wikilinks with `data-stylo-wikilink`
 * so the existing delegated click handler picks them up.
 *
 * `code` and `math` win first and keep their contents literal; everything else
 * recurses so `**a `code` b**` styles the bold and the code.
 *
 * With `embeds` set (the host passed `embedSource`), a `![[ref]]` is shown as
 * literal text — the in-place editable/rendered table cell does not transclude;
 * `preview` / `split` do. The literal keeps the `[[ref]]` inside from being
 * picked up as a wikilink chip.
 */
export function renderInline(text: string, embeds = false): DocumentFragment {
  const frag = document.createDocumentFragment()
  fill(frag, text, embeds)
  return frag
}

/** A `![[ref]]` — non-global, so `exec` gives a fresh `index` each call. */
const EMBED_RE = /!\[\[[^\]\n]+?\]\]/

interface Rule {
  re: RegExp
  build: (m: RegExpMatchArray, embeds: boolean) => Node
}

const RULES: Rule[] = [
  {
    re: /`([^`\n]+)`/,
    build: (m) => el("code", "cm-inplace-code", document.createTextNode(m[1]!)),
  },
  {
    // Non-global copy — `exec` on the shared, `g`-flagged pattern would carry
    // its `lastIndex` across calls (the same reason the wikilink rule below
    // copies its pattern too).
    re: new RegExp(INLINE_MATH.source),
    build: (m) => {
      const span = el("span", "cm-inplace-math")
      katex.render(m[1]!, span as HTMLElement, { throwOnError: false })
      return span
    },
  },
  {
    // a non-global copy — the shared pattern carries `g` and its own lastIndex
    re: new RegExp(WIKILINK_PATTERN.source),
    build: (m) => {
      const span = el("span", "cm-inplace-wikilink", document.createTextNode(m[2] || m[1] || ""))
      ;(span as HTMLElement).dataset.styloWikilink = m[1] ?? ""
      return span
    },
  },
  {
    re: /\[([^\]\n]*)\]\(([^)\n]*)\)/,
    build: (m, embeds) => {
      const a = el("a", "cm-inplace-link") as HTMLAnchorElement
      a.href = m[2] ?? ""
      a.append(inlineFrag(m[1] ?? "", embeds))
      return a
    },
  },
  {
    re: /\*\*\*([^*\n]+?)\*\*\*/,
    build: (m, embeds) =>
      el("strong", "cm-inplace-strong", el("em", "cm-inplace-em", inlineFrag(m[1]!, embeds))),
  },
  {
    re: /\*\*([^\n]+?)\*\*/,
    build: (m, embeds) => el("strong", "cm-inplace-strong", inlineFrag(m[1]!, embeds)),
  },
  {
    re: /~~([^\n]+?)~~/,
    build: (m, embeds) => el("span", "cm-inplace-strike", inlineFrag(m[1]!, embeds)),
  },
  {
    re: /(?<!\*)\*(?!\*|\s)([^\n]+?)(?<!\s)\*(?!\*)/,
    build: (m, embeds) => el("em", "cm-inplace-em", inlineFrag(m[1]!, embeds)),
  },
]

function el(tag: string, className: string, ...children: Node[]): Element {
  const node = document.createElement(tag)
  node.className = className
  node.append(...children)
  return node
}

function inlineFrag(text: string, embeds: boolean): DocumentFragment {
  const frag = document.createDocumentFragment()
  fill(frag, text, embeds)
  return frag
}

/** Tokenise `text` into `parent`, honouring the earliest-matching rule. */
function fill(parent: Node, text: string, embeds: boolean): void {
  while (text) {
    let at = -1
    let hit: { rule: Rule; m: RegExpMatchArray } | { literal: string } | null = null

    // A `![[ref]]` is kept literal, and consumed whole so the wikilink rule
    // never sees the `[[ref]]` inside it.
    const embed = embeds ? EMBED_RE.exec(text) : null
    if (embed) {
      at = embed.index!
      hit = { literal: embed[0] }
    }

    for (const rule of RULES) {
      const m = rule.re.exec(text)
      if (m && (at < 0 || m.index! < at)) {
        at = m.index!
        hit = { rule, m }
      }
    }

    if (!hit) {
      parent.appendChild(document.createTextNode(text))
      return
    }
    if (at > 0) parent.appendChild(document.createTextNode(text.slice(0, at)))
    if ("literal" in hit) {
      parent.appendChild(document.createTextNode(hit.literal))
      text = text.slice(at + hit.literal.length)
    } else {
      parent.appendChild(hit.rule.build(hit.m, embeds))
      text = text.slice(at + hit.m[0].length)
    }
  }
}
