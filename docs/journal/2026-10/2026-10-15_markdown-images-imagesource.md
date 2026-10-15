---
title: "Markdown images through a host imageSource, on every surface"
created: 2026-10-15
type: journal
parent: index
tags:
  - stylo
  - images
  - engineering
  - standard
---

# Markdown images through a host `imageSource`, on every surface

## Context

`![alt](src)` showed as raw source in the in-place canvas, and in `preview` it was left to the browser: a relative path resolved against the host page, and `react-markdown`'s URL filter dropped a `data:` address. A host that serves a note's pictures from its own route had no way to reach either. `![[image.png]]` already worked through `embedSource`. Recorded in [ADR-014](../../decisions/014-image-source-for-markdown-images.md).

## What changed

- **A new optional prop, `imageSource(src, alt)`.** It is called with `src` and `alt` as written, before any URL filtering; a returned node is drawn in place of an image alone on its line, `null` keeps the source, and omitting the prop changes nothing. It works on `preview`, `split` and the in-place canvas, and the canvas reads it once at mount, like `embedSource`.
- **One parser, two surfaces.** `parseImage` takes the image's raw text and returns `src` and `alt`; `preview` (a `remarkImage` plugin) and the canvas (an `imageField` with an `ImageWidget` on the embed registry) both call it, so the host receives the same strings on both.
- **`HostImage` wraps `Embed`,** so an image gets the embed's cache, literal fallback, error report and invalidation. `StyloHandle.invalidateImage(src?)` drops a `src` for every `alt`. `ResolveErrorInfo.source` gains `"imageSource"`.
- **A size convention, documented and not parsed.** The host reads `|300` / `|w300` (width), `|h200` (height) or `|300x200` (both) off `alt`; the props reference carries an example hook, and the browser fixture one that reads all four.
- **A fix on the way:** a source that threw synchronously escaped the embed cache instead of reaching `onResolveError`. It is now a rejection, for `embedSource` too.

## Consequences

- An image inside a sentence, a list item, a quote or a table cell is not drawn by the hook on either surface.
- `InPlaceView` grew about 480 B gzip and two shared chunks are new; the budgets in `scripts/check-bundle-size.mjs` were raised to match.
- Tests: `test/image.test.ts` (the parser), `test/preview-image.test.tsx` (`preview`, `split`, the cache, invalidation, errors), `test/inplace-image.test.tsx` (the canvas field, caret, scope) and `test/browser/image.spec.ts` (the portalled picture, its size, the caret reveal, `preview` and `split` parity in Chromium).
