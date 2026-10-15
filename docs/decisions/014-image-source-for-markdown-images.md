---
type: decision
status: accepted
date: 2026-10-15
projects: [stylo]
concepts: [Host integration, In-place canvas]
amends: []
supersedes: []
tags: [type/decision, status/accepted, project/stylo, topic/architecture, topic/privacy]
---

# 014 — A host `imageSource` for `![alt](src)` images

Accepted by the owner on 2026-10-15, with the cache key on `src` and `alt`, the sibling `invalidateImage`, the documented parity gap and the four-form size convention as written.

> **Summary.** A new optional prop, `imageSource(src, alt)`, lets the host draw a Markdown image that sits alone on its line, in `preview`, `split` and the in-place canvas, the way `embedSource` draws `![[ref]]`. It is called before any URL filtering and is off when omitted. It costs a second resolution cache, one new handle call, and an image inside a sentence that stays as source on the canvas.

## Context

A request from the owner's project Sympose (`docs/requests/2026-10-15_images-in-the-in-place-canvas.md`, local-only) asks for this. Facts below come from reading the code on 2026-10-15, not from running it.

- **The canvas has no image handling.** `decorateNode` in `src/inplace/nodes.ts` has a case for `Link` and none for the Lezer `Image` node, so `![alt](src)` shows as its source.
- **`preview` draws an `<img>` but the host cannot resolve the source.** `react-markdown` runs its default URL filter first: it keeps `http`, `https`, `irc`, `ircs`, `mailto`, `xmpp` and relative values and blanks the rest, so a `data:` URL is dropped. A relative path reaches the browser as written and resolves against the host page, not against the note's folder.
- **`![[image.png|300]]` already works** on every surface through `embedSource`, when it is alone on its line. This record does not touch it.
- **The machinery to copy exists.** `embedSource` runs through `Embed` (`src/render/Embed.tsx`), a process-wide cache keyed by resolver identity and string (`src/render/embed-cache.ts`, ADR-011), a remark plugin that turns a lone `![[ref]]` into a carrier element (`src/render/remark-embed.ts`), and in the canvas a state field with a block widget and a registry that portals a React `Embed` into CodeMirror's DOM (`src/inplace/embed.ts`, `embed-registry.ts`, ADR-009).
- **Why a hook, not a base URL.** The host knows where a note's files live (a vault route, a signed URL, a blob). A `data:` source must reach it unfiltered. Loading a remote image on open is a tracking risk, so the host should decide per source.
- **What Obsidian documents** (its help page on embeds, read 2026-10-15): `![[file.jpg|640x480]]` sets a size and a single number sets the width only; an externally hosted image is embedded with the Markdown form, with the same size syntax (its example is `![250](https://…)`). The page does not describe `![alt](path)` for a file in the vault, or how Live Preview and Reading view differ, so this record claims nothing about either.

## Decision

1. **Add an optional prop `imageSource?: ImageSource`**, with `type ImageSource = (src: string, alt: string) => ReactNode | Promise<ReactNode>`, exported with the other source types. Called with `src` and `alt` as the parser reads them, with no percent-decoding or normalisation and an `|300` suffix on `alt` intact, **before any URL filtering**. A returned node replaces the image; `null` keeps the source literal. Off when omitted. Read once at mount on the canvas, like `embedSource`, and reactive in `preview` and `split`.
2. **Scope of the first version: an image alone on its line.** `![a](b)` with only whitespace around it, outside code, and on the canvas outside a table cell. An image inside a sentence keeps today's behaviour (source on the canvas, the default `<img>` in `preview`). The docs say so.
3. **`preview` and `split`: a remark plugin, `remarkImage`,** added only when `imageSource` is set, in the way `remarkEmbed` is. A paragraph whose only child is an `image` node becomes `<div class="stylo-image" data-stylo-image="…" data-stylo-image-alt="…">`; a `div` component renders the host node. The data attributes are not URL attributes, so `react-markdown`'s filter never sees them.
4. **The canvas: a state field and block widget,** `imageField` in a new `src/inplace/image.ts`, on the pattern of `embedField`. A lone-image line outside the caret's line becomes a block widget; the caret on the line withholds it, so the source shows for editing. The widget reuses `EmbedRegistry`: a slot gains a `kind` and, for an image, `src` and `alt`, and `InPlaceView` portals a new `HostImage` component (shared with `preview`) into it. Atomic ranges, the `ignoreEvent` handling and the click guard for `.stylo-embed-content` apply to images too.
5. **One component, `HostImage`,** does what `Embed` does: while resolving, on `null`, and on a throw or rejection the literal `![alt](src)` text stands in. A rejection calls `onResolveError` with `info.source: "imageSource"` and `info.input: src`, so `ResolveErrorInfo["source"]` gains a member. `HostImage` stops `mousedown` on the resolved content as `Embed` does.
6. **A second cache, `src/render/image-cache.ts`,** with the shape of `embed-cache.ts`: a `WeakMap` keyed by the `imageSource` function, then by `src` and `alt` together (a JSON pair, so any character in either is safe), so the same file with two alt texts gets two results. In-flight promises are shared, rejections are not cached, the cap is the same 64.
7. **Invalidation: a sibling call, `StyloHandle.invalidateImage(src?)`,** that drops every entry for that `src` (all alts), or all of the source's entries with no argument, and re-resolves what is mounted. It is a no-op without `imageSource`, and works in every mode like `invalidateEmbed`.
8. **No new dependency.** The remark plugin uses `unist-util-visit`, already used by `remarkEmbed`; the canvas uses the Lezer `Image` and `URL` nodes already in the Markdown grammar.
9. **A size convention for the host, documented and not parsed by Stylo.** The text after the last `|` in `alt` may be one of `300` or `w300` (width), `h200` (height), or `300x200` (both). A single dimension is set alone and the other left `auto`, so the picture scales with its aspect ratio. The bare number and `WxH` are Obsidian's forms (its help page, read 2026-10-15), so a note written there keeps sizing; `w`/`h` are Stylo's addition, which gives a height-only form and an unambiguous width. The owner's words: a user should be able to dictate the size, and `w300` / `h200` so that it scales appropriately. The props reference carries one example `imageSource` that reads all four forms, so hosts copy one convention instead of each inventing one. Stylo ships no parser for it: the hook receives `alt` whole, and a host that wants no sizing ignores the suffix.
10. **Closing the slice** writes the props reference, a wiki page on the image flow, and a journal note, and adds integration tests for the three surfaces, the caret on the canvas, the `null`, omitted and async cases, a `data:` source reaching the hook unfiltered, and a throw reaching `onResolveError`.

## Consequences

- **Easier.** A host can serve `![alt](path)` from a vault route, decide size and lazy loading, and show an SVG only through `<img>`, with no change to what the file contains. A consumer that never passes `imageSource` sees nothing change: the plugin and the field are not added.
- **Harder.** A second cache and a second invalidation call sit beside the embed ones. `EmbedRegistry` and `ResolveErrorInfo` widen, and both are public or near-public shapes. Whether the eager `StyloHandle` change moves the bundle budget has not been measured; `npm run check:size` decides when it is built.
- **A parity gap by design.** An image mid-sentence is source on the canvas and the host-less default `<img>` in `preview`, even with `imageSource` set. The docs say so, and a test pins it.
- **Open edge: `src` as written.** The parser resolves backslash escapes and entities in a destination in `preview` (mdast), while the canvas reads the raw text. The canvas applies the same unescape so both give the same string, and a parity test pins a destination with an escape and one in `<angle brackets>`. A link title (`"title"`) is ignored on both surfaces.
- **Left open.** Images inside a sentence and images in a table cell on the canvas are not handled here.
- **The size convention is a promise in the docs, not in the code.** A host that implements only part of it (say, `|300` but not `|h200`) silently shows an unsized picture for the rest, and Stylo cannot warn. If hosts end up copying the same parsing code, exporting a small helper that returns `{ width, height }` becomes right, and would be a new record.

## Alternatives rejected

- **Reuse `embedSource` and `invalidateEmbed`.** One prop and one call, but `![[ref]]` takes a single string and the image hook needs `src` and `alt`, and a shared `ref` namespace would let `![[a.png]]` and `![x](a.png)` share a cache entry. Becomes right if a host asks for the two to be one thing.
- **`urlTransform` set to identity, with a `components.img`.** Smaller, but it turns off the filter for every link and image whether or not a host set the hook, which changes today's behaviour and lets `javascript:` through on links. Becomes right only if the filter is made per attribute and per element.
- **`components.img` on its own.** It receives the `src` after the filter, so a `data:` URL is already blank. It also cannot give the canvas the same result.
- **A base-URL prop (`imageBase`).** Fixes relative paths in `preview`, but not a signed or blob route, and says nothing for the canvas. Becomes right if hosts turn out to want only a prefix.
- **Cache by `src` alone.** The request says "cached by its source", but the node can depend on `alt` (a size suffix), so the same `src` with two alts would show the wrong picture.
- **Render images inline in a sentence on the canvas now.** Closer to editors that draw them, but inline widgets mid-text bring reveal, wrapping and caret questions that block widgets avoid. Becomes right when the lone-line version is in use and a host asks.
- **Raw `<img>` or `<svg>` through `rehype-raw`.** Needs a sanitiser, and Stylo keeps raw HTML off on purpose. An SVG file is covered by `imageSource` returning an `<img>`.
- **Loading remote images by default.** A note that fetches any address on open is a tracking risk; the host decides through the hook.
- **Paste or upload, resize handles, a lightbox, captions.** Out of scope for the request; each is its own decision.

## Amendment (2026-10-15): what the implementation settled

Written when the slice was built; the decision above stands, with these details fixed.

- **`src` and `alt` come from the raw source text, on both surfaces.** One pure function, `parseImage` (`src/image.ts`), takes the image as written and returns the two strings. `preview` slices the text from the file by the image node's offsets, the canvas slices the document by the Lezer `Image` node, and both call it, so parity does not depend on two parsers agreeing. This replaces "the canvas applies the same unescape": nothing is unescaped or entity-decoded, which also keeps Markdown written in `alt` (`*b*`) as written. The `<angle brackets>` of a destination are removed, a title is ignored, and an empty destination (`![a]()`) is not an image to resolve.
- **Top-level only, on both surfaces.** An image is drawn only when it is a top-level paragraph by itself. In a list item or a quote the host is not called, on the canvas or in `preview`, so the two stay equal. This narrows "alone on its line" and is in the props reference.
- **The cache is an adapter over `embed-cache.ts`, not a copy.** `src/render/image-cache.ts` gives each `imageSource` a one-argument source that reads a `src`/`alt` key, so the embed cache's sharing of in-flight promises, its 64-entry cap and its invalidation listeners apply unchanged. `invalidateImage(src)` reaches every `alt` through a new `invalidateEmbedWhere(source, match)` in `embed-cache.ts`, which matches on the refs that have a cached entry and on the refs a mounted `Embed` is listening for, so an image that the cap evicted while it stayed on screen is still told; the adapter keeps no index of its own. `HostImage` is a thin wrapper over `Embed`, which gained two optional props, `literal` and `errorInfo`.
- **No separate wiki page on the image flow.** Point 10 promised one; the `Images` section of the props reference carries the flow (the hook, the scope, the cache, the markup, the privacy note), as `Embeds` does for `![[ref]]`, and a page of its own would repeat it.
- **No `images` toggle.** The pass is on when `imageSource` is passed and is not tied to `inPlace.decorations.embeds`, which names `![[ref]]` transclusion.
- **A synchronous throw is now a rejection.** `embed-cache.ts` called the host source directly, so a source that threw (rather than returned a rejected promise) escaped into the effect and `onResolveError` was never called. It now wraps the call, which fixes `embedSource` the same way; a test pins it. The request asked for a throw to reach `onResolveError`.
- **The pass is a separate facet, `imageRegistryFacet`,** pointing at the same registry as `embedRegistryFacet`, so passing only `imageSource` does not make `![[ref]]` lines empty slots, nor the reverse.
- **Bundle budgets.** The `InPlaceView` chunk grew about 480 B gzip (to 26,408 B) and two shared chunks are new, about 1,300 B and 1,900 B; the budgets in `scripts/check-bundle-size.mjs` were set to 27,000 B and 2,000 B each. `stylo.js`, which holds the handle, grew about 60 B.

## Amendment (2026-10-15): a `full` size form

The owner asked for an image that fills the text column. The size convention in point 9 gains a fifth form: `|full`, as in `![logo|full](a/b.svg)`. The host draws the picture at the full width of its container and scales the height with the aspect ratio, so a small picture is stretched and a large one is capped, which `|300` alone does not do.

- **Still the host's to read.** Stylo does not parse `full` any more than it parses `300`: `alt` reaches the hook whole, and a host that ignores the suffix shows the picture unsized. Nothing in `src/` changes except the doc comment on `ImageSource`.
- **Why a word, not a number.** A width in pixels cannot say "whatever the column is", and a percentage (`|100%`) would add a unit to a convention whose other forms have none. `full` reads the same in a note written elsewhere, where it is ignored, as it does here.
- **It does not break out of the column.** A picture wider than the text, edge to edge, is a layout rule on the canvas with its own `--stylo-*` token and a `preview` reach (ADR-002 §3), so it would be a new record if it is wanted.
- **The example hook and the fixture read it,** so hosts copy one convention. A host that implements only the numeric forms silently shows `|full` unsized, the same promise-in-the-docs cost as point 9.
