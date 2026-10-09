---
title: "`#tag` autocomplete — mirrors `wikiLinkSource` exactly"
created: 2026-09-13
type: journal
parent: index
tags:
  - stylo/journal
  - engineering/milestone
---

# `#tag` autocomplete

## Context

Sympose wanted `#tag` autocomplete to match `[[wikilink]]` autocomplete's UX exactly — same trigger-while-typing popup, same themed dropdown. Its own engineering log traced why it couldn't be built from `ui/` alone: the `[[` trigger, the completion-source registration, and the shared tooltip all live inside Stylo's own editor factory, and there was no equivalent hook for `#`. Filed as an upstream request; landed here as a thin prop, mirroring `wikiLinkSource`'s shape.

## Decision

A new prop, **`tagSource`**:

```ts
type TagCompletion = { tag: string }
type TagSource = (query: string) => readonly TagCompletion[] | Promise<readonly TagCompletion[]>
```

Implemented in [`src/editor/tag-complete.ts`](../../../src/editor/tag-complete.ts) as a `@codemirror/autocomplete` source, wired into `baseExtensions` right after the wikilink one so `source`, `split`, and `in-place` share it. Read once at mount, like `wikiLinkSource`. Off entirely when the prop is absent — `tagCompletion(undefined)` returns `[]`.

### Choices

- **No `label` field.** `WikiLinkCompletion.label` exists because `[[target|label]]` is real syntax; tags have no alias form, so `TagCompletion` stays `{ tag: string }`. Adding a field later is non-breaking if that ever changes.
- **Trigger:** `matchBefore(/(?<=^|\s)#[^\s#]*$/)` — `#` at the start of a line or after whitespace, with the tag typed so far, stopping at whitespace or a second `#`. The lookbehind is what wikilinks didn't need: `[[` can't collide with anything else in Markdown, but a bare `#` is also the ATX heading marker and shows up mid-word in URL fragments. Two exclusions fall out of it for free:
  - **Headings never trigger it.** `# Heading` requires a space after `#` (CommonMark), and the query segment excludes whitespace — the moment a space follows `#`, the match breaks before there is any heading text to react to. No separate heading-detection code needed.
  - **Mid-word `#` never triggers it** (`word#word`, `page.md#section`) — the lookbehind requires whitespace or start-of-line immediately before `#`.
- **Also skips a digit right after `#`** (`#1234`) — that reads as an issue or anchor reference, not a tag. This one is not free from the regex; it is a small explicit check, since `#1` is a syntactically valid tag start by the whitespace rule alone.
- **Insert:** replace the query with `tag` — no closing delimiter to manage, unlike `[[wikilink]]`, which has to reuse-or-append `]]`.
- **Same `autocompletion()` extension, same tooltip.** `autocompletion()`'s state field and facet are module-level singletons in `@codemirror/autocomplete`, so calling it again from `tagCompletion()` does not duplicate anything — it just adds another `markdownLanguage.data` completion source alongside the wikilink one. No new CSS: the popup was already unstyled (CodeMirror's own default), so tags render identically to wikilinks for free.

## Consequences

- One more mount-time prop. The props reference and README now list four (`inPlace`, `codeLanguages`, `wikiLinkSource`, `tagSource`).
- `test/tag-complete.test.ts` covers the source, the trigger exclusions, and the insert logic; `test/browser/tag-complete.spec.ts` drives the real popup in `source` and `in-place`, mirroring the wikilink spec.
- Sympose's own tag-index / prop-threading work (`tagSource` through `app-shell.tsx` → `markdown-panel.tsx`) is unblocked once this ships in a release.
