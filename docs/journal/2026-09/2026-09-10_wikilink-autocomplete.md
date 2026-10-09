---
title: "[[wikilink]] autocomplete — the host indexes, Stylo triggers and inserts"
created: 2026-09-10
type: journal
parent: index
tags:
  - stylo/journal
  - engineering/milestone
---

# `[[wikilink]]` autocomplete

## Context

The Sympose integration audit listed `[[` autocomplete as a gap, and filed it host-side: "buildable on `getView()` / the vault tree already fetched — none of it needs a stylo change." That was true, but it meant every consumer re-solving the same CodeMirror plumbing — the trigger regex, the bracket-closing on accept, keeping the source out of fenced code. A thin prop moves the plumbing into the library and leaves the part that is genuinely the host's — the index — with the host. The browser harness landed first, so the completion popup (a floating widget jsdom can't lay out) is now testable.

## Decision

A new prop, **`wikiLinkSource`**:

```ts
type WikiLinkCompletion = { target: string; label?: string }
type WikiLinkSource = (
  query: string,
) => readonly WikiLinkCompletion[] | Promise<readonly WikiLinkCompletion[]>
```

Implemented in [`src/editor/wikilink-complete.ts`](../../../src/editor/wikilink-complete.ts) as a `@codemirror/autocomplete` source, wired into `baseExtensions` next to find / replace so `source`, `split`, and `in-place` share it. Read once at mount, like `codeLanguages`. Off entirely when the prop is absent — `wikilinkCompletion(undefined)` returns `[]`.

### Choices

- **Registered through `markdownLanguage.data.of({ autocomplete })`, not `autocompletion({ override })`.** `override` would replace every source, killing any completions an embedded code grammar contributes; language-data registration adds ours alongside and, because it is scoped to the Markdown language, makes it inert inside a fenced code block for free.
- **Trigger:** `matchBefore(/\[\[([^[\]\n|]*)$/)` — an unclosed `[[` with the target typed so far, stopping at `]`, `|`, or newline. A bare `[[` with nothing after it waits for a keystroke (or an explicit `Ctrl-Space`) rather than firing on the bracket.
- **`filter: false`.** The host has already searched and ranked its index; CodeMirror re-fuzzy-matching against `label` would reorder and drop rows. Stylo shows exactly what the source returns.
- **Insert:** replace the query with `target`, append `]]` unless the next two characters already are `]]` (so re-completing `[[Pag|]]` doesn't double them), and drop the caret after the closing brackets. `label` is display-only unless it differs from `target`, in which case the link is written `[[target|label]]`.
- **Scope stays `[[`.** `![[embed]]` transclusion is a separate parked item.

### Dependency

`@codemirror/autocomplete` moves from transitive (via `@codemirror/lang-markdown`) to a declared regular `dependency` — the same call as `@codemirror/search` for find / replace: small, no cross-boundary state, caught by the build's `/^@codemirror\//` external rule so it adds nothing to the bundle and dedupes onto the host's CodeMirror copy. Not a peer.

## Consequences

- One more mount-time prop. The props reference and README now list three (`inPlace`, `codeLanguages`, `wikiLinkSource`).
- `test/wikilink-complete.test.ts` covers the source and the insert logic; `test/browser/wikilink-complete.spec.ts` drives the real popup in `source` and `in-place`, and asserts nothing appears without the prop.
- The Sympose audit's Stylo-side list is now down to `![[embed]]` alone.
