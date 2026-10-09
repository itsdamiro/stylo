---
title: "![[embed]] transclusion — Stylo detects, the host renders"
created: 2026-09-10
type: journal
parent: index
tags:
  - stylo/journal
  - engineering/milestone
---

# `![[embed]]` transclusion

## Context

`![[ref]]` was the last item on the Sympose integration audit's Stylo-side list. It is Obsidian's transclusion syntax: pull another note, a heading, a block, or an image in where the `![[…]]` sits. Everything else in the audit was closed by the `[[wikilink]]` autocomplete work; this finishes the set.

The wall is the same one `[[wikilinks]]` hit. Stylo's canonical model is a Markdown string and it has **no vault** — no notion of what other notes exist or what they contain. So it cannot resolve `ref` itself, exactly as it cannot navigate a `[[wikilink]]` (`onWikiLinkClick`) or rank completions (`wikiLinkSource`). Detection is Stylo's; resolution is the host's.

## Decision

A new prop, **`embedSource`**:

```ts
type EmbedSource = (ref: string) => ReactNode | Promise<ReactNode>
```

`ref` is the raw string between `![[` and `]]`, trimmed — any `#heading`, `#^blockid`, or `|size` suffix left intact. The host returns a React node; Stylo drops it where the `![[…]]` was. `null` (or a rejection, or the pending state) leaves the literal `![[ref]]` text in place, so a reference is never silently lost.

Implemented as:

- [`src/embed.ts`](../../../src/embed.ts) — `EMBED_PATTERN` and an `isLoneEmbed` guard.
- [`src/render/remark-embed.ts`](../../../src/render/remark-embed.ts) — a remark plugin that retypes a lone-`![[ref]]` paragraph to an empty `<div class="stylo-embed" data-stylo-embed="ref">`.
- [`src/render/Embed.tsx`](../../../src/render/Embed.tsx) — the component that calls `embedSource`, awaits a promise, and renders the result inside `<div class="stylo-embed-content">`.
- [`src/render/Preview.tsx`](../../../src/render/Preview.tsx) — adds `remarkEmbed` to the pipeline (only when `embedSource` is set) and routes `data-stylo-embed` to `<Embed>`. Threaded through `Stylo` and `SplitView` to the `preview` and `split` surfaces.

### Choices

- **Host returns a React node, not a Markdown string or a tagged descriptor.** It matches how the rest of Stylo delegates — navigation, the wikilink index — and it is the smallest honest API: Stylo owns the detection and the slot, the host owns what goes in it. A host that wants recursive Markdown renders `<Stylo mode="preview">` (or its own renderer) into the node. No recursion or cycle guard in Stylo, no format negotiation, no new dependency. A Markdown string would have forced a depth/cycle limiter and still not covered images or PDFs; a `{ kind }` descriptor is a wider surface to keep stable for no gain over "return whatever you want".
- **Raw reference, passed verbatim.** `WIKILINK_PATTERN` is deliberately not reused — in `![[image.png|300]]` the `|` is a size hint, not a display label, so splitting on it would be wrong. `EMBED_PATTERN` is its own regex and the whole reference goes to the host to parse.
- **Preview and split only.** The in-place canvas needs an async React widget inside the CodeMirror surface with reveal-on-caret behaviour and cursor navigation past it — a separate increment. Staging it this way keeps each change reviewable, as with the toolbar customizer and wikilink autocomplete.
- **Lone-embed paragraphs only.** An `![[ref]]` is treated as an embed only when it is the entire paragraph (trimmed). An `![[ref]]` inside a sentence stays literal — rendering it as a block would nest a host-supplied `<div>` inside a `<p>`, which React rejects. Inline embeds are a fast-follow item alongside the in-place canvas.
- **Opt-in, no behaviour change without the prop.** `Preview` only adds `remarkEmbed` to the pipeline when `embedSource` is present, so a document with `![[x]]` renders exactly as before (a `!` then a `[[x]]` wikilink) for every consumer not using the feature.
- **`embedSource` is reactive, not read-once.** Unlike `wikiLinkSource` and the other CodeMirror-surface config, the preview is a pure function of its props — a changed `embedSource` just re-renders. The doc note asks for a stable reference so the memoised plugin list is not rebuilt each frame.

### Dependency

None. `embedSource` is a function prop; `remark-embed` uses `unist-util-visit`, already a dependency. No ADR-gated addition.

## Consequences

- One more prop on `StyloProps` (`embedSource`) and one more exported type (`EmbedSource`). The props reference gains an "Embeds" section.
- New stable style hooks: `.stylo-embed`, `.stylo-embed-content`, and the `--stylo-embed-accent` variable.
- `test/embed.test.ts` covers the pattern and the plugin; `test/preview.test.tsx` covers the resolved node, the async path, the literal fallbacks, and the inline-`![[…]]` boundary. No browser spec — there is no floating UI this time.
- The Sympose audit's Stylo-side list is now empty.

### Follow-ups

- The in-place canvas: a reveal-on-caret block widget, same pattern as `math.ts` and the table widgets.
- Inline `![[…]]` (mid-paragraph), once it can render without the `<div>`-in-`<p>` nesting problem — likely an inline wrapper element.
